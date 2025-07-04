#!/usr/bin/env node

import { Command } from 'commander';
import prompts from 'prompts';
import { searchAnime, AnimeResult, getAnimeDetail, getAnimeEpisodes, Episode, getEpisodeDetail, getVideoUrl } from '../services/api.js';
import { playVideo } from '../services/player.js';
import { downloadVideo } from '../services/download.js';
import { saveWatchHistory, getWatchHistory, getLastWatchedAnime, clearWatchHistory, formatHistoryEntry, getContinueWatchingSuggestions } from '../utils/historyUtils.js';
import { getConfig } from '../utils/config.js';
import { discordRPC } from '../services/discord.js';
import open from 'open';

const program = new Command();

/**
 * Display search results and handle user selection
 */
async function handleSearchResults(results: AnimeResult[]): Promise<void> {
  if (results.length === 0) {
    console.log('No anime found for your search.');
    return;
  }

  if (results.length === 1) {
    const anime = results[0];
    console.log(`\nFound: ${anime.english || anime.turkish || anime.romaji}`);

    await handleAnimeSelection(anime);
  }

  // Multiple results - show selection menu
  const choices = results.map((anime, index) => ({
    title: anime.english || anime.turkish || anime.romaji,
    description: `${anime.type} - ${anime.summary?.substring(0, 100)}...`,
    value: index
  }));

  const selection = await prompts({
    type: 'select',
    name: 'animeIndex',
    message: 'Select an anime:',
    choices
  });

  if (selection.animeIndex !== undefined) {
    await handleAnimeSelection(results[selection.animeIndex]);
  }
}

/**
 * Handle anime selection and get episodes
 */
async function handleAnimeSelection(anime: AnimeResult): Promise<void> {
  console.log(`\nGetting details for: ${anime.english || anime.turkish || anime.romaji}`);
  
  const animeDetail = await getAnimeDetail(anime.slug);
  if (!animeDetail) {
    console.log('Could not get anime details.');
    return;
  }
  
  console.log(`\nSeasons: ${animeDetail.numberOfSeasons}`);
  console.log(`Total Episodes: ${animeDetail.numberOfEpisodes}`);
  
  // If only one season, go directly to episodes
  if (animeDetail.seasons.length === 1) {
    const season = animeDetail.seasons[0];
    if (season.hasEpisode) {
      await handleSeasonSelection(anime.slug, season.season_number, season.name);
    } else {
      console.log('No episodes available for this season.');
    }
    return;
  }
  
  // Multiple seasons - show selection
  const seasonChoices = animeDetail.seasons
    .filter(season => season.hasEpisode)
    .map(season => ({
      title: `${season.name} (${season.episode_count} episodes)`,
      description: `Air date: ${season.air_date}`,
      value: season.season_number
    }));
  
  if (seasonChoices.length === 0) {
    console.log('No episodes available for this anime.');
    return;
  }
  
  const seasonResponse = await prompts({
    type: 'select',
    name: 'seasonNumber',
    message: 'Select a season:',
    choices: seasonChoices
  });
  
  if (seasonResponse.seasonNumber) {
    const selectedSeason = animeDetail.seasons.find(s => s.season_number === seasonResponse.seasonNumber);
    await handleSeasonSelection(anime.slug, seasonResponse.seasonNumber, selectedSeason?.name || `Season ${seasonResponse.seasonNumber}`);
  }
}

/**
 * Handle season selection and show episodes
 */
async function handleSeasonSelection(slug: string, seasonNumber: number, seasonName: string): Promise<void> {
  console.log(`\nGetting episodes for ${seasonName}...`);
  
  const episodes = await getAnimeEpisodes(slug, seasonNumber);
  if (episodes.length === 0) {
    console.log('No episodes found for this season.');
    return;
  }
  
  const episodeChoices = episodes.map(episode => ({
    title: episode.title,
    description: `Season ${episode.seasonNumber}, Episode ${episode.episodeNumber}`,
    value: episode
  }));
  
  const episodeResponse = await prompts({
    type: 'select',
    name: 'episode',
    message: 'Select an episode:',
    choices: episodeChoices
  });
  
  if (episodeResponse.episode) {
    const selectedEpisode = episodeResponse.episode as Episode;
    console.log(`\nSelected: ${selectedEpisode.title}`);
    await handleEpisodeSelection(slug, selectedEpisode);
  }
}

/**
 * Handle episode selection and show fansub options
 */
async function handleEpisodeSelection(slug: string, episode: Episode, startTime?: number): Promise<void> {
  console.log(`\nGetting episode details...`);
  
  const episodeDetail = await getEpisodeDetail(slug, episode.seasonNumber, episode.episodeNumber);
  if (!episodeDetail) {
    console.log('Could not get episode details.');
    return;
  }
  
  const episodeData = episodeDetail.episodeData;
  console.log(`\nEpisode: ${episodeData.name}`);
  console.log(`Air Date: ${episodeData.airDate}`);
  
  if (startTime && startTime > 0) {
    const timeStr = `${Math.floor(startTime / 60)}:${Math.floor(startTime % 60).toString().padStart(2, '0')}`;
    console.log(`🔄 Resuming from: ${timeStr}`);
  }
  
  // Debug: Show fansub count
  console.log(`\nAvailable fansubs: ${episodeDetail.fansubs.length}`);
  episodeDetail.fansubs.forEach((fansub, index) => {
    console.log(`${index + 1}. ${fansub.name} - ${fansub.contributors}`);
  });
  
  // Show available fansubs
  if (episodeDetail.fansubs.length > 1) {
    const fansubChoices = episodeDetail.fansubs.map(fansub => ({
      title: fansub.name,
      description: `Contributors: ${fansub.contributors}`,
      value: fansub.id
    }));
    
    const fansubResponse = await prompts({
      type: 'select',
      name: 'fansubId',
      message: 'Select a fansub:',
      choices: fansubChoices
    });
    
    if (fansubResponse.fansubId) {
      await handleVideoPlayback(slug, episode, fansubResponse.fansubId, startTime);
    }
  } else if (episodeDetail.fansubs.length === 1) {
    // Only one fansub available
    console.log(`\nUsing fansub: ${episodeDetail.fansubs[0].name}`);
    await handleVideoPlayback(slug, episode, episodeDetail.fansubs[0].id, startTime);
  } else {
    console.log('\n❌ No fansubs available for this episode.');
  }
}

/**
 * Handle video playback
 */
async function handleVideoPlayback(slug: string, episode: Episode, fansubId: string, startTime?: number): Promise<void> {
  console.log(`\nGetting video URL...`);
  
  const videoUrl = await getVideoUrl(slug, episode.seasonNumber, episode.episodeNumber, fansubId);
  if (!videoUrl) {
    console.log('Could not get video URL.');
    return;
  }
  
  console.log(`Video URL: ${videoUrl}`);
  
  // Get anime details for history tracking
  const animeDetail = await getAnimeDetail(slug);
  const episodeDetail = await getEpisodeDetail(slug, episode.seasonNumber, episode.episodeNumber);
  const fansub = episodeDetail?.fansubs.find(f => f.id === fansubId);
  
  const playChoice = await prompts({
    type: 'select',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      { title: '▶️  Play with MPV', value: 'play' },
      { title: '🔗 Copy URL to clipboard', value: 'copy' },
      { title: '⬇️  Download episode', value: 'download' },
      { title: '🌐 Open in browser', value: 'browser' }
    ]
  });
  
  switch (playChoice.action) {
    case 'play':
      console.log('\nStarting video playback...');
      
      // Create play options with episode info for live history tracking
      const playOptions: any = {};
      if (startTime) playOptions.startTime = startTime;
      
      if (animeDetail) {
        playOptions.animeId = animeDetail.id;
        playOptions.animeTitle = animeDetail.english || animeDetail.turkish || animeDetail.romaji;
        playOptions.animeSlug = slug;
        playOptions.seasonNumber = episode.seasonNumber;
        playOptions.episodeNumber = episode.episodeNumber;
        playOptions.episodeTitle = episode.title;
        playOptions.fansubName = fansub?.name || 'Unknown';
        
        // Discord RPC ile izleme durumunu güncelle - eski projeye benzer şekilde daha fazla bilgi ile
        const animeTitle = animeDetail.english || animeDetail.turkish || animeDetail.romaji;
        const episodeInfo = `S${episode.seasonNumber}E${episode.episodeNumber}`;
        const episodeUrl = `anime/${slug}/${episode.seasonNumber}/${episode.episodeNumber}`;
        await discordRPC.updateWatchingAnime(animeTitle, episodeInfo, episodeUrl, animeDetail.pictures?.avatar);
      }
      
      // Save initial history entry
      await saveToHistory(slug, episode, fansubId, 0);
      
      // Play video with live history tracking
      const playbackResult = await playVideo(videoUrl, playOptions);
      
      // Final history update
      await saveToHistory(slug, episode, fansubId, playbackResult.progress, playbackResult.timePos, playbackResult.duration);
      
      // Get user configuration to check if auto-play is enabled
      const config = getConfig();
      
      // Check if auto-play is enabled, episode was watched to completion (> 85%) and there's a next episode
      if (config.autoPlayNextEpisode && playbackResult.progress >= 85 && episodeDetail?.episodeData.hasNextEpisode) {
        console.log('\n✅ Episode completed! Moving to next episode...');
        
        // Get the next episode and play it automatically
        const nextEpisodeNumber = episode.episodeNumber + 1;
        const episodes = await getAnimeEpisodes(slug, episode.seasonNumber);
        const nextEpisode = episodes.find(e => e.episodeNumber === nextEpisodeNumber);
        
        if (nextEpisode) {
          console.log(`\n🔄 Automatically playing next episode: ${nextEpisode.title}`);
          // Play the next episode with the same fansub
          await handleEpisodeSelection(slug, nextEpisode);
        } else {
          console.log('\n❌ Could not find next episode.');
        }
      }
      break;
    case 'copy':
      console.log(`\n📋 Video URL: ${videoUrl}`);
      console.log('Copy the URL above to play in your preferred player.');
      // Save to history when URL is copied (assuming user will watch)
      await saveToHistory(slug, episode, fansubId, 100, 0, 0);
      break;
    case 'download':
      await handleDownload(slug, episode, videoUrl);
      break;
    case 'browser':
      console.log('\n🌐 Opening in browser...');
      console.log(`URL: ${videoUrl}`);
      try {
        const { exec } = await import('child_process');
        const platform = process.platform;
        
        let command = '';
        if (platform === 'darwin') {
          command = `open "${videoUrl}"`;
        } else if (platform === 'win32') {
          command = `start "${videoUrl}"`;
        } else {
          command = `xdg-open "${videoUrl}"`;
        }
        
        exec(command);
        console.log('✅ Opened in default browser');
        process.exit(0);
      } catch (error) {
        console.log('❌ Could not open browser automatically');
        console.log('Please copy the URL above and open it manually in your browser');
      }
      break;
  }
}

/**
 * Handle episode download
 */
async function handleDownload(slug: string, episode: Episode, videoUrl: string): Promise<void> {
  console.log('\n⬇️ Starting download...');
  
  // Get anime details for proper naming
  const animeDetail = await getAnimeDetail(slug);
  const animeTitle = animeDetail?.english || animeDetail?.turkish || animeDetail?.romaji || slug;
  
  const episodeName = `S${episode.seasonNumber}E${episode.episodeNumber} - ${episode.title}`;
  
  const success = await downloadVideo(videoUrl, animeTitle, episodeName);
  
  if (success) {
    console.log('\n🎉 Download completed successfully!');
    
    // Ask if user wants to continue with more episodes
    const continueChoice = await prompts({
      type: 'confirm',
      name: 'continue',
      message: 'Would you like to download another episode?',
      initial: false
    });
    
    if (continueChoice.continue) {
      // Go back to episode selection
      await handleSeasonSelection(slug, episode.seasonNumber, `Season ${episode.seasonNumber}`);
    }
  } else {
    console.log('\n❌ Download failed. Please try again or check your internet connection.');
  }
}

/**
 * Show main menu with history options
 */
async function showMainMenu(): Promise<void> {
  const lastWatched = getLastWatchedAnime();
  const continueWatching = getContinueWatchingSuggestions();
  const recentHistory = getWatchHistory(5);
  
  // Ana menüde Discord RPC durumunu güncelle
  await discordRPC.updateMainMenu();
  
  const choices = [];
  
  // Add continue watching options
  if (lastWatched) {
    choices.push({
      title: `🔄 Continue: ${lastWatched.animeTitle}`,
      description: `S${lastWatched.seasonNumber}E${lastWatched.episodeNumber}: ${lastWatched.episodeTitle}`,
      value: { type: 'continue', entry: lastWatched }
    });
    
    choices.push({
      title: '─────────────────────────────────────',
      disabled: true
    });
  }
  
  // Add recent history if available
  if (recentHistory.length > 0) {
    choices.push({
      title: '📋 Watch History',
      description: 'View your recently watched anime',
      value: { type: 'history' }
    });
    
    choices.push({
      title: '🗑️ Clear History',
      description: 'Delete all watch history',
      value: { type: 'clear-history' }
    });
    
    choices.push({
      title: '─────────────────────────────────────',
      disabled: true
    });
  }
  
  // Add search option
  choices.push({
    title: '🔍 Search for anime',
    description: 'Search for a new anime to watch',
    value: { type: 'search' }
  });
  
  const response = await prompts({
    type: 'select',
    name: 'action',
    message: 'Select an option:',
    choices: choices
  });
  
  if (!response.action) return;
  
  switch (response.action.type) {
    case 'continue':
      await continuePreviousWatch(response.action.entry);
      break;
    case 'history':
      await showWatchHistory();
      break;
    case 'clear-history':
      await confirmClearHistory();
      break;
    case 'search':
      await promptSearch();
      break;
  }
}

/**
 * Continue watching from history
 */
async function continuePreviousWatch(entry: any): Promise<void> {
  console.log(`\nContinuing: ${entry.animeTitle}`);
  console.log(`Last watched: S${entry.seasonNumber}E${entry.episodeNumber} - ${entry.episodeTitle}`);
  
  // Discord RPC ile izlemeye devam ediliyor durumunu güncelle
  await discordRPC.updateWatchingAnime(entry.animeTitle, `S${entry.seasonNumber}E${entry.episodeNumber}`);
  
  // Show progress info if available
  if (entry.timePos && entry.duration && entry.progress < 90) {
    const timeStr = `${Math.floor(entry.timePos / 60)}:${Math.floor(entry.timePos % 60).toString().padStart(2, '0')}`;
    const durationStr = `${Math.floor(entry.duration / 60)}:${Math.floor(entry.duration % 60).toString().padStart(2, '0')}`;
    console.log(`Progress: ${entry.progress}% (${timeStr}/${durationStr})`);
  }
  
  // Build choices based on progress
  const choices = [];
  
  // Add "resume from where I left off" option if progress < 90%
  if (entry.timePos && entry.duration && entry.progress < 90) {
    const timeStr = `${Math.floor(entry.timePos / 60)}:${Math.floor(entry.timePos % 60).toString().padStart(2, '0')}`;
    choices.push({
      title: `⏯️ Resume from ${timeStr} (${entry.progress}%)`,
      value: 'resume'
    });
  }
  
  // Add next episode option
  const nextEpisode = entry.episodeNumber + 1;
  choices.push({
    title: `▶️ Continue to Episode ${nextEpisode}`,
    value: 'next'
  });
  
  // Add rewatch option
  choices.push({
    title: `🔄 Rewatch Episode ${entry.episodeNumber}`,
    value: 'rewatch'
  });
  
  // Add choose different episode option
  choices.push({
    title: '📋 Choose different episode',
    value: 'choose'
  });
  
  const choice = await prompts({
    type: 'select',
    name: 'action',
    message: 'What would you like to do?',
    choices: choices
  });
  
  if (choice.action === 'resume') {
    // Get episode details and play from the saved position
    const episodes = await getAnimeEpisodes(entry.animeSlug, entry.seasonNumber);
    const episode = episodes.find(e => e.episodeNumber === entry.episodeNumber);
    
    if (episode) {
      await handleEpisodeSelection(entry.animeSlug, episode, entry.timePos);
    } else {
      console.log('❌ Could not find episode to resume');
    }
  } else if (choice.action === 'next') {
    // Automatically select and play the next episode
    const nextEpisodeNumber = entry.episodeNumber + 1;
    const episodes = await getAnimeEpisodes(entry.animeSlug, entry.seasonNumber);
    const nextEpisode = episodes.find(e => e.episodeNumber === nextEpisodeNumber);
    
    if (nextEpisode) {
      console.log(`\nAutomatically playing next episode: ${nextEpisode.title}`);
      await handleEpisodeSelection(entry.animeSlug, nextEpisode);
    } else {
      console.log('❌ Could not find next episode, going to episode selection');
      await handleSeasonSelection(entry.animeSlug, entry.seasonNumber, `Season ${entry.seasonNumber}`);
    }
  } else if (choice.action === 'rewatch') {
    const episodes = await getAnimeEpisodes(entry.animeSlug, entry.seasonNumber);
    const currentEpisode = episodes.find(e => e.episodeNumber === entry.episodeNumber);
    
    if (currentEpisode) {
      await handleEpisodeSelection(entry.animeSlug, currentEpisode);
    } else {
      await handleSeasonSelection(entry.animeSlug, entry.seasonNumber, `Season ${entry.seasonNumber}`);
    }
  } else if (choice.action === 'choose') {
    await handleSeasonSelection(entry.animeSlug, entry.seasonNumber, `Season ${entry.seasonNumber}`);
  }
}

/**
 * Show watch history
 */
async function showWatchHistory(): Promise<void> {
  const history = getWatchHistory(10);
  
  if (history.length === 0) {
    console.log('No watch history found.');
    return;
  }
  
  console.log('\n📋 Watch History:');
  history.forEach((entry, index) => {
    console.log(`${index + 1}. ${formatHistoryEntry(entry)}`);
  });
  
  const choices = history.map((entry, index) => ({
    title: `${entry.animeTitle} - S${entry.seasonNumber}E${entry.episodeNumber}`,
    description: `${entry.episodeTitle} (${entry.watchedAt.toLocaleDateString()})`,
    value: entry
  }));
  
  const selection = await prompts({
    type: 'select',
    name: 'entry',
    message: 'Select an anime to continue:',
    choices: choices
  });
  
  if (selection.entry) {
    await continuePreviousWatch(selection.entry);
  }
}

/**
 * Confirm and clear history
 */
async function confirmClearHistory(): Promise<void> {
  const confirm = await prompts({
    type: 'confirm',
    name: 'clear',
    message: 'Are you sure you want to clear all watch history?',
    initial: false
  });
  
  if (confirm.clear) {
    clearWatchHistory();
    console.log('Watch history cleared.');
  }
}

/**
 * Prompt for search
 */
async function promptSearch(): Promise<void> {
  const searchResponse = await prompts({
    type: 'text',
    name: 'query',
    message: 'Enter anime name to search:'
  });
  
  if (searchResponse.query) {
    console.log(`Searching for: ${searchResponse.query}`);
    // Discord RPC'yi arama durumuna güncelle
    await discordRPC.updateSearching(searchResponse.query);
    const results = await searchAnime(searchResponse.query);
    await handleSearchResults(results);
  }
}

/**
 * Save episode to watch history
 */
/**
 * Save episode to watch history
 */
async function saveToHistory(slug: string, episode: Episode, fansubId: string, progress: number = 100, timePos: number = 0, duration: number = 0): Promise<void> {
  try {
    // Get anime details
    const animeDetail = await getAnimeDetail(slug);
    if (!animeDetail) return;
    
    // Get episode details for fansub name
    const episodeDetail = await getEpisodeDetail(slug, episode.seasonNumber, episode.episodeNumber);
    if (!episodeDetail) return;
    
    const fansub = episodeDetail.fansubs.find(f => f.id === fansubId);
    
    const historyEntry = {
      animeId: animeDetail.id,
      animeTitle: animeDetail.english || animeDetail.turkish || animeDetail.romaji,
      animeSlug: slug,
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
      episodeTitle: episode.title,
      fansubName: fansub?.name || 'Unknown',
      watchedAt: new Date(),
      progress: Math.max(0, Math.min(100, progress)), // Ensure progress is between 0-100
      timePos: Math.max(0, timePos),
      duration: Math.max(0, duration)
    };
    
    saveWatchHistory(historyEntry);
    
    if (timePos > 0 && duration > 0) {
      const timeStr = `${Math.floor(timePos / 60)}:${Math.floor(timePos % 60).toString().padStart(2, '0')}`;
      const durationStr = `${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}`;
      console.log(`✅ Saved to watch history: ${progress}% progress (${timeStr}/${durationStr})`);
    } else {
      console.log(`✅ Saved to watch history with ${progress}% progress`);
    }
  } catch (error) {
    console.error('Error saving to history:', error);
  }
}

program
  .name('openanime-cli')
  .description('A command-line interface for watching anime from various streaming sites')
  .version('1.0.0');

// Initialize Discord RPC - non-blocking
discordRPC.connect().catch(error => {
  console.error('Error initializing Discord RPC:', error);
});

// Default command for anime search
program
  .argument('[animeName...]', 'Name of the anime to search for')
  .description('Search for and watch anime')
  .action(async (animeNameArgs) => {
    const animeName = animeNameArgs.join(' ').replace(/^"(.*)"$/, '$1');
    
    if (!animeName) {
      await discordRPC.updateMainMenu();
      await showMainMenu();
      return;
    }
    
    console.log(`Searching for: ${animeName}`);
    await discordRPC.updateSearching(animeName);
    const results = await searchAnime(animeName);
    await handleSearchResults(results);
  });

// Parse arguments
program.parse(process.argv);

// Program kapatıldığında Discord RPC bağlantısını kapat
process.on('exit', () => {
  discordRPC.disconnect();
});

process.on('SIGINT', () => {
  discordRPC.disconnect();
  process.exit(0);
});
