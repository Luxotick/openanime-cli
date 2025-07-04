/**
 * Utility functions for file operations
 */

import fs from 'fs';
import path from 'path';

/**
 * Check if a file exists
 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Create directory if it doesn't exist
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Sanitize filename for safe file system operations
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .trim();
}

/**
 * Get app data directory
 */
export function getAppDataDir(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const appDataDir = path.join(homeDir, '.openanime-cli');
  ensureDir(appDataDir);
  return appDataDir;
}
