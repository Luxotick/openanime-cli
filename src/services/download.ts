/**
 * Download service for saving episodes locally
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { sanitizeFilename, ensureDir, getAppDataDir } from '../utils/fileUtils.js';

const execAsync = promisify(exec);

export interface DownloadOptions {
  quality?: string;
  outputDir?: string;
  filename?: string;
  onProgress?: (progress: string) => void;
}

/**
 * Download video using yt-dlp or curl
 */
export async function downloadVideo(
  url: string, 
  animeTitle: string, 
  episodeName: string, 
  options: DownloadOptions = {}
): Promise<boolean> {
  try {
    // Create download directory
    const downloadDir = options.outputDir || path.join(getAppDataDir(), 'downloads');
    const animeDir = path.join(downloadDir, sanitizeFilename(animeTitle));
    ensureDir(animeDir);
    
    // Generate filename
    const filename = options.filename || `${sanitizeFilename(episodeName)}.mp4`;
    const filePath = path.join(animeDir, filename);
    
    // Check if file already exists
    if (fs.existsSync(filePath)) {
      console.log(`⚠️ File already exists: ${filePath}`);
      return true;
    }
    
    console.log(`📁 Download directory: ${animeDir}`);
    console.log(`📄 Filename: ${filename}`);
    
    // Try yt-dlp first, then curl as fallback
    const success = await tryYtDlp(url, filePath) || await tryCurl(url, filePath);
    
    if (success) {
      console.log(`✅ Download completed: ${filePath}`);
      return true;
    } else {
      console.log('❌ Download failed with all methods');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Download error:', error);
    return false;
  }
}

/**
 * Try downloading with yt-dlp
 */
async function tryYtDlp(url: string, outputPath: string): Promise<boolean> {
  try {
    // Check if yt-dlp is installed
    await execAsync('which yt-dlp');
    
    console.log('⬇️ Starting download with yt-dlp...');
    
    const command = `yt-dlp -o "${outputPath}" "${url}"`;
    
    const process = exec(command);
    
    // Show progress
    process.stdout?.on('data', (data) => {
      const output = data.toString().trim();
      if (output.includes('%')) {
        // Extract progress percentage
        const progressMatch = output.match(/(\d+(?:\.\d+)?)%/);
        if (progressMatch) {
          console.log(`📊 Progress: ${progressMatch[1]}%`);
        }
      }
    });
    
    process.stderr?.on('data', (data) => {
      const error = data.toString().trim();
      if (error && !error.includes('WARNING')) {
        console.error(`\n⚠️ yt-dlp warning: ${error}`);
      }
    });
    
    await new Promise((resolve, reject) => {
      process.on('close', (code) => {
        if (code === 0) {
          console.log('\n✅ yt-dlp download completed');
          resolve(true);
        } else {
          console.log(`\n❌ yt-dlp failed with code ${code}`);
          reject(new Error(`yt-dlp failed with code ${code}`));
        }
      });
      process.on('error', reject);
    });
    
    return true;
    
  } catch (error) {
    console.log('⚠️ yt-dlp not available or failed');
    return false;
  }
}

/**
 * Try downloading with curl
 */
async function tryCurl(url: string, outputPath: string): Promise<boolean> {
  try {
    console.log('⬇️ Starting download with curl...');
    
    const command = `curl -L --progress-bar -o "${outputPath}" "${url}"`;
    
    const process = exec(command);
    
    // Show progress
    process.stderr?.on('data', (data) => {
      const output = data.toString();
      // Curl shows progress on stderr
      if (output.includes('#')) {
        console.log(output.trim());
      }
    });
    
    await new Promise((resolve, reject) => {
      process.on('close', (code) => {
        if (code === 0) {
          console.log('\n✅ curl download completed');
          resolve(true);
        } else {
          console.log(`\n❌ curl failed with code ${code}`);
          reject(new Error(`curl failed with code ${code}`));
        }
      });
      process.on('error', reject);
    });
    
    return true;
    
  } catch (error) {
    console.log('❌ curl download failed');
    return false;
  }
}

/**
 * Get download progress for a specific file
 */
export function getDownloadProgress(filePath: string, expectedSize?: number): number {
  try {
    if (!fs.existsSync(filePath)) return 0;
    
    const stats = fs.statSync(filePath);
    const currentSize = stats.size;
    
    if (expectedSize && expectedSize > 0) {
      return Math.round((currentSize / expectedSize) * 100);
    }
    
    // If we don't know expected size, just return the file size in MB
    return Math.round(currentSize / (1024 * 1024));
    
  } catch (error) {
    return 0;
  }
}

/**
 * List downloaded episodes for an anime
 */
export function getDownloadedEpisodes(animeTitle: string): string[] {
  try {
    const downloadDir = path.join(getAppDataDir(), 'downloads');
    const animeDir = path.join(downloadDir, sanitizeFilename(animeTitle));
    
    if (!fs.existsSync(animeDir)) return [];
    
    const files = fs.readdirSync(animeDir);
    return files.filter(file => file.endsWith('.mp4'));
    
  } catch (error) {
    return [];
  }
}

/**
 * Delete downloaded episode
 */
export function deleteDownloadedEpisode(animeTitle: string, filename: string): boolean {
  try {
    const downloadDir = path.join(getAppDataDir(), 'downloads');
    const animeDir = path.join(downloadDir, sanitizeFilename(animeTitle));
    const filePath = path.join(animeDir, filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Deleted: ${filename}`);
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
}
