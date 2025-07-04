/**
 * Watch history management
 */

import { getAppDataDir, fileExists } from './fileUtils.js';
import fs from 'fs';
import path from 'path';

export interface WatchHistoryEntry {
  animeId: string;
  animeTitle: string;
  animeSlug: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string;
  fansubName: string;
  watchedAt: Date;
  progress: number; // percentage watched
  timePos: number; // seconds watched
  duration: number; // total duration in seconds
}

const HISTORY_FILE = path.join(getAppDataDir(), 'watch-history.json');

/**
 * Load watch history from file
 */
export function getWatchHistory(limit?: number): WatchHistoryEntry[] {
  try {
    if (!fileExists(HISTORY_FILE)) {
      return [];
    }
    
    const data = fs.readFileSync(HISTORY_FILE, 'utf8');
    const history = JSON.parse(data) as WatchHistoryEntry[];
    
    // Convert string dates back to Date objects and add default values for missing fields
    const processedHistory = history.map(entry => ({
      ...entry,
      watchedAt: new Date(entry.watchedAt),
      timePos: entry.timePos || 0, // Default to 0 if missing
      duration: entry.duration || 0 // Default to 0 if missing
    }));
    
    // Sort by watch date (newest first)
    processedHistory.sort((a, b) => b.watchedAt.getTime() - a.watchedAt.getTime());
    
    // Apply limit if specified
    return limit ? processedHistory.slice(0, limit) : processedHistory;
    
  } catch (error) {
    console.error('Error loading watch history:', error);
    return [];
  }
}

/**
 * Save watch history entry
 */
export function saveWatchHistory(entry: WatchHistoryEntry): void {
  try {
    const history = getWatchHistory();
    
    // Remove existing entry for same anime/episode if exists
    const existingIndex = history.findIndex(h => 
      h.animeId === entry.animeId && 
      h.seasonNumber === entry.seasonNumber && 
      h.episodeNumber === entry.episodeNumber
    );
    
    if (existingIndex >= 0) {
      history.splice(existingIndex, 1);
    }
    
    // Add new entry at the beginning
    history.unshift(entry);
    
    // Keep only last 50 entries
    const trimmedHistory = history.slice(0, 50);
    
    // Save to file
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmedHistory, null, 2));
    
    console.log('✅ Saved to watch history');
    
  } catch (error) {
    console.error('Error saving watch history:', error);
  }
}

/**
 * Get last watched anime
 */
export function getLastWatchedAnime(): WatchHistoryEntry | null {
  const history = getWatchHistory(1);
  return history.length > 0 ? history[0] : null;
}

/**
 * Get recent watch history for a specific anime
 */
export function getAnimeWatchHistory(animeId: string): WatchHistoryEntry[] {
  const history = getWatchHistory();
  return history.filter(entry => entry.animeId === animeId);
}

/**
 * Clear watch history
 */
export function clearWatchHistory(): void {
  try {
    if (fileExists(HISTORY_FILE)) {
      fs.unlinkSync(HISTORY_FILE);
      console.log('🗑️ Watch history cleared');
    } else {
      console.log('No watch history to clear');
    }
  } catch (error) {
    console.error('Error clearing watch history:', error);
  }
}

/**
 * Format watch history entry for display
 */
export function formatHistoryEntry(entry: WatchHistoryEntry): string {
  const date = entry.watchedAt.toLocaleDateString();
  const time = entry.watchedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  // Format time position and duration
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  let progressInfo = '';
  if (entry.timePos && entry.duration) {
    const timeStr = formatTime(entry.timePos);
    const durationStr = formatTime(entry.duration);
    progressInfo = ` [${timeStr}/${durationStr} - ${entry.progress}%]`;
  } else if (entry.progress > 0) {
    progressInfo = ` [${entry.progress}%]`;
  }
  
  return `${entry.animeTitle} - S${entry.seasonNumber}E${entry.episodeNumber}: ${entry.episodeTitle}${progressInfo} (${date} ${time})`;
}

/**
 * Get continue watching suggestions
 */
export function getContinueWatchingSuggestions(): WatchHistoryEntry[] {
  const history = getWatchHistory();
  const animeMap = new Map<string, WatchHistoryEntry>();
  
  // Get the most recent episode for each anime
  history.forEach(entry => {
    if (!animeMap.has(entry.animeId)) {
      animeMap.set(entry.animeId, entry);
    }
  });
  
  return Array.from(animeMap.values()).slice(0, 5);
}
