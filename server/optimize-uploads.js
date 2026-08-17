import crypto from 'node:crypto';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const apply = process.argv.includes('--apply');
const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDirectory = path.resolve(rootDirectory, process.env.DATA_DIR || 'data');
const uploadsDirectory = path.join(dataDirectory, 'uploads');
const originalsDirectory = path.join(uploadsDirectory, 'originals');
const dataFile = path.join(dataDirectory, 'site-data.json');
const supportedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);

const source = JSON.parse(await readFile(dataFile, 'utf8'));
const replacements = new Map();

const optimizeUrl = async (url) => {
  if (replacements.has(url)) return replacements.get(url);
  if (!url.startsWith('/uploads/') || url.startsWith('/uploads/originals/')) return url;

  const filename = path.basename(url);
  const extension = path.extname(filename).toLowerCase();
  if (!supportedExtensions.has(extension)) return url;

  const sourcePath = path.join(uploadsDirectory, filename);
  try {
    await stat(sourcePath);
  } catch {
    return url;
  }

  const optimizedFilename = `${path.basename(filename, extension)}-optimized-${crypto.randomUUID()}.webp`;
  const optimizedUrl = `/uploads/${optimizedFilename}`;
  replacements.set(url, optimizedUrl);
  if (!apply) return optimizedUrl;

  const buffer = await readFile(sourcePath);
  const metadata = await sharp(buffer).metadata();
  const image = sharp(buffer).rotate().resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true });
  const optimized = metadata.format === 'png'
    ? await image.webp({ lossless: true, effort: 4 }).toBuffer()
    : await image.webp({ quality: 86, effort: 4, smartSubsample: true }).toBuffer();

  await mkdir(originalsDirectory, { recursive: true });
  await Promise.all([
    copyFile(sourcePath, path.join(originalsDirectory, filename)),
    writeFile(path.join(uploadsDirectory, optimizedFilename), optimized),
  ]);
  return optimizedUrl;
};

const visit = async (value) => {
  if (typeof value === 'string') return optimizeUrl(value);
  if (Array.isArray(value)) {
    const items = [];
    for (const child of value) items.push(await visit(child));
    return items;
  }
  if (value && typeof value === 'object') {
    const result = {};
    for (const [key, child] of Object.entries(value)) result[key] = await visit(child);
    return result;
  }
  return value;
};

const optimizedData = await visit(source);

if (!apply) {
  console.log(`Dry run: ${replacements.size} image(s) can be optimized. Run with --apply to update files.`);
  process.exit(0);
}

if (!replacements.size) {
  console.log('No existing images require optimization.');
  process.exit(0);
}

const backupFile = `${dataFile}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
await copyFile(dataFile, backupFile);
await writeFile(dataFile, JSON.stringify(optimizedData, null, 2), 'utf8');
console.log(`Optimized ${replacements.size} image(s). Backup: ${backupFile}`);
