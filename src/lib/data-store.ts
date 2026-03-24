/**
 * Data directory helper
 * Vercel serverless = read-only filesystem → dùng /tmp/
 * Local dev = dùng project root/data/
 */

import fs from 'fs';
import path from 'path';

const IS_VERCEL = !!process.env.VERCEL;

export const DATA_DIR = IS_VERCEL
  ? path.join('/tmp', 'data')
  : path.join(process.cwd(), 'data');

export function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readJsonFile<T>(filename: string): T | null {
  try {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJsonFile(filename: string, data: unknown): void {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
