/**
 * API service for fetching anime data from streaming sites
 */

import fetch from 'node-fetch';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface AnimeResult {
  id: string;
  type: string;
  english: string;
  turkish: string;
  slug: string;
  romaji: string;
  pictures: {
    banner: string;
    avatar: string;
  };
  summary: string;
}

export interface AnimeDetail {
  id: string;
  type: string;
  english: string;
  turkish: string;
  slug: string;
  romaji: string;
  pictures: {
    banner: string;
    avatar: string;
  };
  summary: string;
  seasons: Array<{
    id: string;
    season_number: number;
    episode_count: number;
    name: string;
    air_date: string;
    hasEpisode: boolean;
  }>;
  numberOfSeasons: number;
  numberOfEpisodes: number;
}

export interface Episode {
  title: string;
  number: number;
  url: string;
  seasonNumber: number;
  episodeNumber: number;
}

export interface StreamUrl {
  url: string;
  quality: string;
  type: 'm3u8' | 'mp4' | 'other';
}

export interface EpisodeDetail {
  animeMeta: {
    pictures: {
      banner: string;
      avatar: string;
    };
    type: string;
    malID: number;
    romaji: string;
    english: string;
    turkish: string;
    slug: string;
    summary: string;
    id: string;
  };
  episodeData: {
    episodeNumber: number;
    fansub: {
      id: string;
      name: string;
      secureName: string;
      avatar: string;
      contributors: string;
    };
    processing: boolean;
    resolutions: number[];
    files: Array<{
      storage_cluster_id: string;
      resolution: number;
      size: number;
      file: string;
    }>;
    hasNextEpisode: boolean;
    hasPrevEpisode: boolean;
    name: string;
    summary: string;
    avatar: string;
    airDate: string;
    season: {
      number: number;
      name: string;
      mal_id: number;
    };
  };
  fansubs: Array<{
    id: string;
    name: string;
    secureName: string;
    avatar: string;
    website?: string;
    discord?: string;
    contributors: string;
  }>;
}

/**
 * Base API service class
 */
export abstract class BaseApiService {
  abstract search(query: string): Promise<AnimeResult[]>;
  abstract getEpisodes(animeId: string): Promise<Episode[]>;
  abstract getStreamUrl(episodeUrl: string): Promise<StreamUrl[]>;
}

/**
 * Search for anime across all available services
 */
export async function searchAnime(query: string): Promise<AnimeResult[]> {
  try {
    // Use curl as fallback since node-fetch might have issues with this API
    const encodedQuery = encodeURIComponent(query);
    const curlCommand = `curl -s -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "https://api.openani.me/anime/search?q=${encodedQuery}"`;
    
    const { stdout } = await execAsync(curlCommand);
    const data = JSON.parse(stdout) as AnimeResult[];
    
    return data;
  } catch (error) {
    console.error('Error searching anime:', error);
    return [];
  }
}

/**
 * Get anime details including seasons and episodes
 */
export async function getAnimeDetail(slug: string): Promise<AnimeDetail | null> {
  try {
    const curlCommand = `curl -s -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "https://api.openani.me/anime/${slug}"`;
    
    const { stdout } = await execAsync(curlCommand);
    const data = JSON.parse(stdout) as AnimeDetail;
    
    return data;
  } catch (error) {
    console.error('Error getting anime detail:', error);
    return null;
  }
}

/**
 * Get episodes for a specific anime season
 */
export async function getAnimeEpisodes(slug: string, seasonNumber: number): Promise<Episode[]> {
  try {
    const animeDetail = await getAnimeDetail(slug);
    if (!animeDetail) return [];
    
    const season = animeDetail.seasons.find(s => s.season_number === seasonNumber);
    if (!season || !season.hasEpisode) return [];
    
    const episodes: Episode[] = [];
    for (let i = 1; i <= season.episode_count; i++) {
      episodes.push({
        title: `Episode ${i}`,
        number: i,
        url: `https://openani.me/anime/${slug}/${seasonNumber}/${i}`,
        seasonNumber: seasonNumber,
        episodeNumber: i
      });
    }
    
    return episodes;
  } catch (error) {
    console.error('Error getting episodes:', error);
    return [];
  }
}

/**
 * Get stream URL for a specific episode
 */
export async function getEpisodeStreamUrl(episodeUrl: string): Promise<StreamUrl[]> {
  // TODO: Implement stream URL extraction
  console.log(`Getting stream URL for: ${episodeUrl}`);
  return [];
}

/**
 * Get episode details including fansubs and video files
 */
export async function getEpisodeDetail(slug: string, seasonNumber: number, episodeNumber: number): Promise<EpisodeDetail | null> {
  try {
    const curlCommand = `curl -s -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "https://api.openani.me/anime/${slug}/season/${seasonNumber}/episode/${episodeNumber}"`;
    
    const { stdout } = await execAsync(curlCommand);
    const data = JSON.parse(stdout) as EpisodeDetail;
    
    return data;
  } catch (error) {
    console.error('Error getting episode detail:', error);
    return null;
  }
}

/**
 * Get direct video URL for streaming
 */
export async function getVideoUrl(slug: string, seasonNumber: number, episodeNumber: number, fansubId?: string): Promise<string | null> {
  try {
    const episodeDetail = await getEpisodeDetail(slug, seasonNumber, episodeNumber);
    if (!episodeDetail) return null;
    
    // If fansubId is provided, try to get episode with that specific fansub
    let targetFansubId = episodeDetail.episodeData.fansub.id;
    if (fansubId) {
      const fansub = episodeDetail.fansubs.find(f => f.id === fansubId);
      if (fansub) {
        targetFansubId = fansubId;
        // Try to get episode detail with specific fansub
        // For now, we'll construct the URL manually since the API might return different data
      }
    }
    
    // Get the highest quality video file
    const files = episodeDetail.episodeData.files;
    if (files.length === 0) return null;
    
    // Sort by resolution (highest first)
    const sortedFiles = files.sort((a, b) => b.resolution - a.resolution);
    const bestFile = sortedFiles[0];
    
    // Construct the full video URL based on the pattern:
    // https://do7---ha-k8y3jyfa-8gcx.zyapbot.eu.org/animes/{slug}/{season}/{episode}-{fansubId}-{resolution}p.mp4?big=1
    const baseUrl = "https://do7---ha-k8y3jyfa-8gcx.zyapbot.eu.org";
    const videoUrl = `${baseUrl}/animes/${slug}/${seasonNumber}/${episodeNumber}-${targetFansubId}-${bestFile.resolution}p.mp4?big=1`;
    
    return videoUrl;
  } catch (error) {
    console.error('Error getting video URL:', error);
    return null;
  }
}
