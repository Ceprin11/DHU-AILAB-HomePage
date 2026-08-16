import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { createStore } from './store.js';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDirectory = path.resolve(rootDirectory, process.env.DATA_DIR || 'data');
const uploadsDirectory = path.join(dataDirectory, 'uploads');
const distDirectory = path.join(rootDirectory, 'dist');
const isDevelopment = process.argv.includes('--dev');
const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 3000);
const adminAccount = process.env.ADMIN_ACCOUNT || 'AILAB';
const adminPassword = process.env.ADMIN_PASSWORD || 'AILAB123';
const sessionSecret = process.env.SESSION_SECRET || 'change-this-session-secret-before-production';
const sessionCookie = 'ailab_admin_session';
const cookieSecure = isProduction && process.env.COOKIE_SECURE !== 'false';

if (isProduction) {
  const configurationErrors = [];
  if (!process.env.ADMIN_PASSWORD || adminPassword.length < 12 || adminPassword === 'AILAB123' || adminPassword.includes('replace-with')) configurationErrors.push('ADMIN_PASSWORD');
  if (!process.env.SESSION_SECRET || sessionSecret.length < 32 || sessionSecret.includes('replace-with') || sessionSecret === 'change-this-session-secret-before-production') configurationErrors.push('SESSION_SECRET');
  if (configurationErrors.length) {
    throw new Error(`Production configuration requires secure values for: ${configurationErrors.join(', ')}`);
  }
  if (!cookieSecure) console.warn('COOKIE_SECURE=false: administrator cookies will not require HTTPS.');
}

await mkdir(uploadsDirectory, { recursive: true });
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

app.disable('x-powered-by');
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploadsDirectory, { fallthrough: false }));

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
    res.status(201).json(await store.create(req.params.entity, req.body || {}));
  } catch (error) {
    next(error);
  }
});

app.put('/api/entities/:entity/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json(await store.update(req.params.entity, req.params.id, req.body || {}));
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

const storage = multer.diskStorage({
  destination: uploadsDirectory,
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  },
});
const upload = multer({
  storage,
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

app.post('/api/upload', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: '请选择文件' });
  res.status(201).json({ file_url: `/uploads/${req.file.filename}` });
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
  app.use(express.static(distDirectory));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(distDirectory, 'index.html'));
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
