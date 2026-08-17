import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import 'dotenv/config';
import compression from 'compression';
import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { createStore } from './store.js';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDirectory = path.resolve(rootDirectory, process.env.DATA_DIR || 'data');
const uploadsDirectory = path.join(dataDirectory, 'uploads');
const originalUploadsDirectory = path.join(uploadsDirectory, 'originals');
const imageVariantsDirectory = path.join(uploadsDirectory, 'variants');
const distDirectory = path.join(rootDirectory, 'dist');
const isDevelopment = process.argv.includes('--dev');
const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 3000);
const adminAccount = process.env.ADMIN_ACCOUNT || 'AILAB';
const adminPassword = process.env.ADMIN_PASSWORD || 'AILAB123';
const sessionSecret = process.env.SESSION_SECRET || 'change-this-session-secret-before-production';
const sessionCookie = 'ailab_admin_session';
const cookieSecure = isProduction && process.env.COOKIE_SECURE !== 'false';
const execFileAsync = promisify(execFile);

if (isProduction) {
  const configurationErrors = [];
  if (!process.env.ADMIN_PASSWORD || adminPassword.length < 12 || adminPassword === 'AILAB123' || adminPassword.includes('replace-with')) configurationErrors.push('ADMIN_PASSWORD');
  if (!process.env.SESSION_SECRET || sessionSecret.length < 32 || sessionSecret.includes('replace-with') || sessionSecret === 'change-this-session-secret-before-production') configurationErrors.push('SESSION_SECRET');
  if (configurationErrors.length) {
    throw new Error(`Production configuration requires secure values for: ${configurationErrors.join(', ')}`);
  }
  if (!cookieSecure) console.warn('COOKIE_SECURE=false: administrator cookies will not require HTTPS.');
}

await Promise.all([
  mkdir(uploadsDirectory, { recursive: true }),
  mkdir(originalUploadsDirectory, { recursive: true }),
  mkdir(imageVariantsDirectory, { recursive: true }),
]);
const store = createStore(dataDirectory);
const app = express();
const httpServer = createHttpServer(app);
const loginAttempts = new Map();
const loginWindowMs = 15 * 60 * 1000;
const maxLoginAttempts = 10;
const allowedUploadExtensions = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif',
  '.mp4', '.webm', '.ogg', '.mov', '.m4v',
  '.pdf', '.txt', '.md', '.csv', '.json', '.zip', '.gz',
  '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx',
  '.py', '.ipynb', '.js', '.jsx', '.ts', '.tsx', '.css',
]);
const blockedUploadMimeTypes = new Set(['text/html', 'application/xhtml+xml', 'image/svg+xml', 'application/xml', 'text/xml']);
const bilibiliMetadataCache = new Map();
const bilibiliCoverCache = new Map();
const bilibiliCacheTtlMs = 12 * 60 * 60 * 1000;
const bilibiliCoverMaxBytes = 10 * 1024 * 1024;
const resourceCoverCache = new Map();
const imageVariantWidths = [320, 640, 960, 1440, 1920];
const imageVariantJobs = new Map();
const imageVariantExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);

const normalizeVariantWidth = (value) => {
  const requested = Number(value);
  if (!Number.isFinite(requested) || requested <= 0) return 960;
  return imageVariantWidths.find((width) => requested <= width) || imageVariantWidths.at(-1);
};

const getImageVariantPaths = (filename, width) => {
  if (!filename || path.basename(filename) !== filename || !imageVariantExtensions.has(path.extname(filename).toLowerCase())) {
    return null;
  }
  const sourcePath = path.join(uploadsDirectory, filename);
  const digest = crypto.createHash('sha256').update(filename).digest('hex').slice(0, 20);
  return {
    sourcePath,
    variantPath: path.join(imageVariantsDirectory, `${digest}-w${width}-q84.webp`),
  };
};

const ensureImageVariant = async (filename, width) => {
  const paths = getImageVariantPaths(filename, width);
  if (!paths || !existsSync(paths.sourcePath)) {
    const error = new Error('图片不存在');
    error.status = 404;
    throw error;
  }
  if (existsSync(paths.variantPath)) return paths.variantPath;

  const jobKey = `${filename}:${width}`;
  if (imageVariantJobs.has(jobKey)) return imageVariantJobs.get(jobKey);

  const job = (async () => {
    const temporaryPath = `${paths.variantPath}.${crypto.randomUUID()}.tmp`;
    try {
      await sharp(paths.sourcePath)
        .rotate()
        .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 84, effort: 4, smartSubsample: true })
        .toFile(temporaryPath);
      await rename(temporaryPath, paths.variantPath);
      return paths.variantPath;
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => {});
      throw error;
    } finally {
      imageVariantJobs.delete(jobKey);
    }
  })();

  imageVariantJobs.set(jobKey, job);
  return job;
};

const getBilibiliId = (value = '') => {
  const input = String(value).trim();
  const match = input.match(/BV[0-9A-Za-z]{10}/i);
  if (!match) return '';
  try {
    const url = new URL(input);
    const hostname = url.hostname.toLowerCase();
    if (hostname !== 'bilibili.com' && !hostname.endsWith('.bilibili.com')) return '';
  } catch {
    if (input !== match[0]) return '';
  }
  return `BV${match[0].slice(2)}`;
};

const normalizeBilibiliImage = (value) => {
  if (!value) return '';
  const normalized = value.startsWith('//') ? `https:${value}` : value;
  try {
    const url = new URL(normalized);
    const hostname = url.hostname.toLowerCase();
    if (!['http:', 'https:'].includes(url.protocol) || (!hostname.endsWith('.hdslb.com') && !hostname.endsWith('.biliimg.com'))) return '';
    url.protocol = 'https:';
    return url.href;
  } catch {
    return '';
  }
};

const fetchBilibiliMetadata = async (value) => {
  const bvid = getBilibiliId(value);
  if (!bvid) {
    const error = new Error('无法识别该 B 站视频链接');
    error.status = 400;
    throw error;
  }

  const cached = bilibiliMetadataCache.get(bvid);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'DHU-AILAB-Homepage/1.0' },
    });
    if (!response.ok) throw new Error(`Bilibili responded with ${response.status}`);
    const payload = await response.json();
    const thumbnailUrl = normalizeBilibiliImage(payload?.data?.pic);
    if (payload?.code !== 0 || !thumbnailUrl) throw new Error('Bilibili metadata is unavailable');

    const metadataValue = {
      bvid,
      title: String(payload.data.title || ''),
      description: String(payload.data.desc || ''),
      thumbnail_url: thumbnailUrl,
    };
    if (bilibiliMetadataCache.size >= 200) bilibiliMetadataCache.delete(bilibiliMetadataCache.keys().next().value);
    bilibiliMetadataCache.set(bvid, { value: metadataValue, expiresAt: Date.now() + bilibiliCacheTtlMs });
    return metadataValue;
  } catch (cause) {
    const error = new Error(cause?.name === 'AbortError' ? '获取 B 站封面超时' : '暂时无法获取 B 站视频封面');
    error.status = 502;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const fetchBilibiliCover = async (value) => {
  const imageUrl = normalizeBilibiliImage(value);
  if (!imageUrl) {
    const error = new Error('无法识别该 B 站封面地址');
    error.status = 400;
    throw error;
  }

  const cached = bilibiliCoverCache.get(imageUrl);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        Referer: 'https://www.bilibili.com/',
        'User-Agent': 'DHU-AILAB-Homepage/1.0',
      },
    });
    const contentType = response.headers.get('content-type') || '';
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (!response.ok || !contentType.startsWith('image/') || contentLength > bilibiliCoverMaxBytes) {
      throw new Error('Bilibili cover is unavailable');
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > bilibiliCoverMaxBytes) throw new Error('Bilibili cover is too large');
    const valueToCache = { buffer, contentType };
    if (bilibiliCoverCache.size >= 100) bilibiliCoverCache.delete(bilibiliCoverCache.keys().next().value);
    bilibiliCoverCache.set(imageUrl, { value: valueToCache, expiresAt: Date.now() + bilibiliCacheTtlMs });
    return valueToCache;
  } catch (cause) {
    const error = new Error(cause?.name === 'AbortError' ? '获取 B 站封面超时' : '暂时无法加载 B 站视频封面');
    error.status = 502;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const shouldRefreshBilibiliThumbnail = (thumbnailUrl = '') => {
  if (!thumbnailUrl) return true;
  try {
    const hostname = new URL(thumbnailUrl).hostname.toLowerCase();
    return hostname.endsWith('.hdslb.com') || hostname.endsWith('.biliimg.com');
  } catch {
    return false;
  }
};

const getYouTubeId = (value = '') => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || '';
    if (host !== 'youtube.com' && host !== 'm.youtube.com') return '';
    if (url.pathname === '/watch') return url.searchParams.get('v') || '';
    return url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1] || '';
  } catch { return ''; }
};

const getGitHubRepository = (value = '') => {
  try {
    const url = new URL(value);
    if (url.hostname.toLowerCase() !== 'github.com') return null;
    const [owner, repository] = url.pathname.split('/').filter(Boolean);
    if (!owner || !repository) return null;
    return { owner, repository: repository.replace(/\.git$/i, '') };
  } catch { return null; }
};

const getAutomaticResourceThumbnail = (value = '') => {
  const youtubeId = getYouTubeId(value);
  if (youtubeId && /^[\w-]{6,20}$/.test(youtubeId)) return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
  const github = getGitHubRepository(value);
  if (github) return `https://opengraph.githubassets.com/1/${encodeURIComponent(github.owner)}/${encodeURIComponent(github.repository)}`;
  return '';
};

const normalizeResourceCoverUrl = (value = '') => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const allowed = host === 'opengraph.githubassets.com' || host === 'i.ytimg.com' || host === 'img.youtube.com' || host.endsWith('.hdslb.com') || host.endsWith('.biliimg.com');
    if (!allowed || !['http:', 'https:'].includes(url.protocol)) return '';
    url.protocol = 'https:';
    return url.href;
  } catch { return ''; }
};

const fetchResourceCover = async (value) => {
  const imageUrl = normalizeResourceCoverUrl(value);
  if (!imageUrl) {
    const error = new Error('不支持该封面地址');
    error.status = 400;
    throw error;
  }
  const cached = resourceCoverCache.get(imageUrl);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(imageUrl, { signal: controller.signal, headers: { Referer: 'https://www.dhuailab.com/', 'User-Agent': 'DHU-AILAB-Homepage/1.0' } });
    const contentType = response.headers.get('content-type') || '';
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (!response.ok || !contentType.startsWith('image/') || contentLength > bilibiliCoverMaxBytes) throw new Error('Cover unavailable');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > bilibiliCoverMaxBytes) throw new Error('Cover too large');
    const cover = { buffer, contentType };
    if (resourceCoverCache.size >= 150) resourceCoverCache.delete(resourceCoverCache.keys().next().value);
    resourceCoverCache.set(imageUrl, { value: cover, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
    return cover;
  } catch (cause) {
    const error = new Error(cause?.name === 'AbortError' ? '获取封面超时' : '暂时无法加载封面');
    error.status = 502;
    throw error;
  } finally { clearTimeout(timeout); }
};

const enrichEntityPayload = async (entityName, payload) => {
  if (entityName === 'VideoLink' && payload?.bilibili_url && shouldRefreshBilibiliThumbnail(payload.thumbnail_url)) {
    try {
      const metadata = await fetchBilibiliMetadata(payload.bilibili_url);
      return {
        ...payload,
        title: payload.title || metadata.title,
        description: payload.description || metadata.description,
        thumbnail_url: metadata.thumbnail_url,
      };
    } catch {
      return payload;
    }
  }

  if (entityName === 'StudyMaterial' && payload?.file_url && !payload.thumbnail_url) {
    if (getBilibiliId(payload.file_url)) {
      try {
        const metadata = await fetchBilibiliMetadata(payload.file_url);
        return { ...payload, thumbnail_url: metadata.thumbnail_url };
      } catch { return payload; }
    }
    const thumbnailUrl = getAutomaticResourceThumbnail(payload.file_url);
    if (thumbnailUrl) return { ...payload, thumbnail_url: thumbnailUrl };
  }

  if (entityName !== 'GuideCourse' || !shouldRefreshBilibiliThumbnail(payload?.image_url)) return payload;
  const bilibiliUrl = [payload.primary_url, payload.secondary_url].find((value) => getBilibiliId(value));
  if (!bilibiliUrl) return payload;
  try {
    const metadata = await fetchBilibiliMetadata(bilibiliUrl);
    return {
      ...payload,
      title: payload.title || metadata.title,
      description: payload.description || metadata.description,
      image_url: metadata.thumbnail_url,
    };
  } catch {
    return payload;
  }
};

app.disable('x-powered-by');
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
app.use(compression({ threshold: 1024 }));
app.use(express.json({ limit: '1mb' }));
app.get('/media/image/:filename', async (req, res, next) => {
  try {
    const width = normalizeVariantWidth(req.query.w);
    const variantPath = await ensureImageVariant(req.params.filename, width);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Type', 'image/webp');
    res.sendFile(path.basename(variantPath), { root: imageVariantsDirectory });
  } catch (error) {
    next(error);
  }
});
app.use('/uploads', express.static(uploadsDirectory, {
  fallthrough: false,
  immutable: true,
  maxAge: '30d',
}));
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

const parseCookies = (header = '') => Object.fromEntries(
  header.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  })
);

const createSession = () => {
  const payload = Buffer.from(JSON.stringify({ role: 'admin', exp: Date.now() + 12 * 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};

const verifySession = (token = '') => {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return session.role === 'admin' && session.exp > Date.now();
  } catch {
    return false;
  }
};

const requireAdmin = (req, res, next) => {
  const token = parseCookies(req.headers.cookie)[sessionCookie];
  if (!verifySession(token)) return res.status(401).json({ message: '请先登录管理员账号' });
  next();
};

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/auth/login', (req, res) => {
  const { account, password } = req.body || {};
  const now = Date.now();
  for (const [key, attempt] of loginAttempts) {
    if (attempt.resetAt <= now) loginAttempts.delete(key);
  }
  const clientKey = req.ip || req.socket.remoteAddress || 'unknown';
  const attempt = loginAttempts.get(clientKey);
  if (attempt && attempt.count >= maxLoginAttempts) {
    res.setHeader('Retry-After', String(Math.ceil((attempt.resetAt - now) / 1000)));
    return res.status(429).json({ message: '登录尝试次数过多，请稍后再试' });
  }
  if (account !== adminAccount || password !== adminPassword) {
    loginAttempts.set(clientKey, {
      count: (attempt?.count || 0) + 1,
      resetAt: attempt?.resetAt || now + loginWindowMs,
    });
    return res.status(401).json({ message: '账号或密码错误' });
  }
  loginAttempts.delete(clientKey);
  res.cookie(sessionCookie, createSession(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure,
    path: '/',
    maxAge: 12 * 60 * 60 * 1000,
  });
  res.json({ id: 'ailab-admin', role: 'admin', full_name: 'AILAB 管理员' });
});

app.get('/api/auth/me', requireAdmin, (_req, res) => {
  res.json({ id: 'ailab-admin', role: 'admin', full_name: 'AILAB 管理员' });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(sessionCookie, { httpOnly: true, sameSite: 'lax', secure: cookieSecure, path: '/' });
  res.status(204).end();
});

app.get('/api/entities/:entity', async (req, res, next) => {
  try {
    res.json(await store.list(req.params.entity, req.query.sort, req.query.limit));
  } catch (error) {
    next(error);
  }
});

app.post('/api/entities/:entity', requireAdmin, async (req, res, next) => {
  try {
    const payload = await enrichEntityPayload(req.params.entity, req.body || {});
    res.status(201).json(await store.create(req.params.entity, payload));
  } catch (error) {
    next(error);
  }
});

app.put('/api/entities/:entity/:id', requireAdmin, async (req, res, next) => {
  try {
    const payload = await enrichEntityPayload(req.params.entity, req.body || {});
    res.json(await store.update(req.params.entity, req.params.id, payload));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/entities/:entity/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json(await store.remove(req.params.entity, req.params.id));
  } catch (error) {
    next(error);
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedUploadExtensions.has(extension) || blockedUploadMimeTypes.has(file.mimetype.toLowerCase())) {
      const error = new Error('不支持该文件类型');
      error.status = 400;
      callback(error);
      return;
    }
    callback(null, true);
  },
});

app.get('/api/bilibili/preview', async (req, res, next) => {
  try {
    res.json(await fetchBilibiliMetadata(req.query.url));
  } catch (error) {
    next(error);
  }
});

app.get('/api/bilibili/cover', async (req, res, next) => {
  try {
    const cover = await fetchBilibiliCover(req.query.url);
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.type(cover.contentType).send(cover.buffer);
  } catch (error) {
    next(error);
  }
});

app.get('/api/resource/cover', async (req, res, next) => {
  try {
    const cover = await fetchResourceCover(req.query.url);
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.type(cover.contentType).send(cover.buffer);
  } catch (error) { next(error); }
});

const optimizableImageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);

const persistUpload = async (file) => {
  const extension = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
  const basename = `${Date.now()}-${crypto.randomUUID()}`;
  const isOptimizableImage = file.mimetype.startsWith('image/') && optimizableImageExtensions.has(extension);

  if (!isOptimizableImage) {
    const filename = `${basename}${extension}`;
    const filePath = path.join(uploadsDirectory, filename);
    await writeFile(filePath, file.buffer);
    if (extension === '.pdf') {
      const previewPrefix = path.join(uploadsDirectory, `${basename}-preview`);
      const previewPng = `${previewPrefix}.png`;
      const coverFilename = `${basename}-cover.webp`;
      try {
        await execFileAsync('pdftoppm', ['-f', '1', '-singlefile', '-scale-to-x', '1280', '-scale-to-y', '-1', '-png', filePath, previewPrefix], { timeout: 15000, maxBuffer: 1024 * 1024 });
        await sharp(previewPng).webp({ quality: 84, effort: 4 }).toFile(path.join(uploadsDirectory, coverFilename));
        return { file_url: `/uploads/${filename}`, thumbnail_url: `/uploads/${coverFilename}` };
      } catch (error) {
        console.warn('PDF preview generation skipped:', error.message);
      } finally {
        await rm(previewPng, { force: true }).catch(() => {});
      }
    }
    return { file_url: `/uploads/${filename}` };
  }

  try {
    const metadata = await sharp(file.buffer).metadata();
    const image = sharp(file.buffer)
      .rotate()
      .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true });
    const optimizedBuffer = metadata.format === 'png'
      ? await image.webp({ lossless: true, effort: 4 }).toBuffer()
      : await image.webp({ quality: 86, effort: 4, smartSubsample: true }).toBuffer();
    const originalFilename = `${basename}${extension}`;
    const optimizedFilename = `${basename}.webp`;

    await Promise.all([
      writeFile(path.join(originalUploadsDirectory, originalFilename), file.buffer),
      writeFile(path.join(uploadsDirectory, optimizedFilename), optimizedBuffer),
    ]);

    return {
      file_url: `/uploads/${optimizedFilename}`,
      original_file_url: `/uploads/originals/${originalFilename}`,
    };
  } catch {
    const error = new Error('图片处理失败，请检查图片文件是否完整');
    error.status = 400;
    throw error;
  }
};

app.post('/api/upload', requireAdmin, upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ message: '请选择文件' });
  try {
    res.status(201).json(await persistUpload(req.file));
  } catch (error) {
    next(error);
  }
});

app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

if (isDevelopment) {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({ server: { middlewareMode: true, hmr: { server: httpServer } }, appType: 'spa' });
  app.use(vite.middlewares);
} else {
  if (!existsSync(path.join(distDirectory, 'index.html'))) {
    console.error('Missing dist/index.html. Run npm run build first.');
    process.exit(1);
  }
  app.use('/assets', express.static(path.join(distDirectory, 'assets'), {
    fallthrough: false,
    immutable: true,
    maxAge: '1y',
  }));
  app.use(express.static(distDirectory, {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      if (path.basename(filePath) === 'index.html') res.setHeader('Cache-Control', 'no-cache');
    },
  }));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(distDirectory, 'index.html'), {
      headers: { 'Cache-Control': 'no-cache' },
    });
  });
}

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error instanceof multer.MulterError) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ message: error.code === 'LIMIT_FILE_SIZE' ? '文件不能超过 25MB' : '文件上传失败' });
  }
  res.status(error.status || 500).json({ message: error.message || '服务器错误' });
});

httpServer.listen(port, () => {
  console.log(`AILAB website listening on http://localhost:${port}`);
});
