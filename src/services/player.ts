/**
 * Video player service for handling video playback
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export interface PlaybackOptions {
  startTime?: number;
  quality?: string;
  subtitles?: string;
  // Episode info for history tracking
  animeId?: string;
  animeTitle?: string;
  animeSlug?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
  fansubName?: string;
}

export interface PlaybackProgress {
  progress: number;
  timePos: number;
  duration: number;
}

/**
 * Play video using MPV player with progress tracking
 */
export async function playVideo(url: string, options: PlaybackOptions = {}): Promise<PlaybackProgress> {
  try {
    // Check if mpv is installed
    try {
      await execAsync('which mpv');
    } catch {
      console.log('❌ MPV player not found. Please install MPV:');
      console.log('Ubuntu/Debian: sudo apt install mpv');
      console.log('macOS: brew install mpv');
      console.log('Windows: Download from https://mpv.io/installation/');
      return { progress: 0, timePos: 0, duration: 0 };
    }
    
    // Create progress tracking file
    const __dirname = import.meta.dirname;
    const progressFile = path.join(__dirname, '..', '..', 'temp_progress.json');
    const mpvScriptPath = path.join(__dirname, 'mpv-progress.lua');
    
    // Ensure temp directory exists
    const tempDir = path.dirname(progressFile);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    let mpvCommand = `mpv "${url}"`;
    
    // Add start time if specified
    if (options.startTime) {
      mpvCommand += ` --start=${options.startTime}`;
    }
    
    // Add progress tracking script
    mpvCommand += ` --script="${mpvScriptPath}"`;
    
    // Add script options for history tracking
    const historyFile = path.join(process.env.HOME || '~', '.openanime-cli', 'watch-history.json');
    const scriptOpts = [
      `progress_file="${progressFile}"`,
      `history_file="${historyFile}"`,
      `anime_id="${options.animeId || ''}"`,
      `anime_title="${options.animeTitle || ''}"`,
      `anime_slug="${options.animeSlug || ''}"`,
      `season_number=${options.seasonNumber || 0}`,
      `episode_number=${options.episodeNumber || 0}`,
      `episode_title="${options.episodeTitle || ''}"`,
      `fansub_name="${options.fansubName || ''}"`
    ].join(',');
    
    mpvCommand += ` --script-opts="${scriptOpts}"`;
    
    // Debug: Show the full command
    console.log('🐛 MPV Command:', mpvCommand);
    console.log('🐛 Script Path:', mpvScriptPath);
    console.log('🐛 Progress File:', progressFile);
    
    // Add additional mpv options for better streaming
    mpvCommand += ' --cache=yes --demuxer-max-bytes=50M --demuxer-max-back-bytes=25M';
    
    console.log('🎬 Starting MPV player with progress tracking...');
    console.log('Press Ctrl+C or Q to stop playback');
    
    // Start mpv and wait for it to finish
    const mpvProcess = exec(mpvCommand);
    
    // Handle process events
    let finalProgress = 0;
    let finalTimePos = 0;
    let finalDuration = 0;
    
    await new Promise((resolve, reject) => {
      mpvProcess.on('close', (code) => {
        console.log(`\n🔚 MPV exited with code: ${code}`);
        
        // Read final progress
        try {
          if (fs.existsSync(progressFile)) {
            const progressData = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
            finalTimePos = Math.round(progressData.time_pos || 0);
            finalDuration = Math.round(progressData.duration || 0);
            
            // Calculate progress percentage ourselves if not provided
            if (finalDuration > 0 && finalTimePos > 0) {
              finalProgress = Math.round((finalTimePos / finalDuration) * 100);
            } else {
              finalProgress = Math.round(progressData.percent_pos || 0);
            }
            
            console.log(`📊 Final progress data:`, progressData);
            console.log(`📊 Final progress: ${finalProgress}%`);
            console.log(`⏱️ Watched: ${finalTimePos}s / ${finalDuration}s`);
            // Don't clean up temp file to preserve progress
            // fs.unlinkSync(progressFile);
          } else {
            console.log('⚠️ Progress file not found');
          }
        } catch (error) {
          console.log('⚠️ Could not read progress data:', error instanceof Error ? error.message : String(error));
        }
        
        if (code === 0) {
          console.log('✅ Video playback finished normally');
        } else {
          console.log(`⚠️ MPV exited with code ${code}`);
        }
        resolve(code);
      });
      
      mpvProcess.on('error', (error) => {
        console.error('❌ Error starting MPV:', error.message);
        reject(error);
      });
    });
    
    return { progress: finalProgress, timePos: finalTimePos, duration: finalDuration };
    
  } catch (error) {
    console.error('Error playing video:', error);
    return { progress: 0, timePos: 0, duration: 0 };
  }
}

/**
 * Download video for offline viewing
 */
export async function downloadVideo(url: string, filename: string): Promise<void> {
  try {
    // Check if yt-dlp or youtube-dl is installed
    let downloader = '';
    try {
      await execAsync('which yt-dlp');
      downloader = 'yt-dlp';
    } catch {
      try {
        await execAsync('which youtube-dl');
        downloader = 'youtube-dl';
      } catch {
        console.log('❌ No downloader found. Please install yt-dlp or youtube-dl:');
        console.log('pip install yt-dlp');
        return;
      }
    }
    
    const downloadCommand = `${downloader} -o "${filename}" "${url}"`;
    console.log(`⬇️ Starting download with ${downloader}...`);
    
    await execAsync(downloadCommand);
    console.log('✅ Download completed!');
    
  } catch (error) {
    console.error('Error downloading video:', error);
  }
}
