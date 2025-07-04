/**
 * Configuration management
 */

export interface AppConfig {
  defaultQuality: string;
  preferredPlayer: string;
  downloadPath: string;
  autoPlay: boolean;
  autoPlayNextEpisode: boolean;
  enableHistory: boolean;
  enableDiscordRPC: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  defaultQuality: '720p',
  preferredPlayer: 'mpv',
  downloadPath: './downloads',
  autoPlay: false,
  autoPlayNextEpisode: true, // Enable auto-play next episode by default
  enableHistory: true,
  enableDiscordRPC: true // Discord Rich Presence varsayılan olarak açık
};

/**
 * Get application configuration
 */
export function getConfig(): AppConfig {
  // TODO: Load config from file
  return DEFAULT_CONFIG;
}

/**
 * Save application configuration
 */
export function saveConfig(config: AppConfig): void {
  // TODO: Save config to file
  console.log('Saving config:', config);
}

/**
 * Reset configuration to defaults
 */
export function resetConfig(): AppConfig {
  return { ...DEFAULT_CONFIG };
}
