/**
 * Discord Rich Presence integration for OpenAnime CLI
 * Provides Discord status updates about what anime/episode is being watched
 */

import RPC from 'discord-rpc';
import { getConfig } from '../utils/config.js';

// Discord Developer Portal client ID - from previous project
const CLIENT_ID = '1335425935578628208';

// Register client ID with Discord RPC
RPC.register(CLIENT_ID);

// Class to manage Discord Rich Presence functionality
export class DiscordRPC {
  private static instance: DiscordRPC;
  private client: RPC.Client;
  private connected: boolean = false;
  private startTimestamp: Date = new Date();
  private connectionAttempts: number = 0;
  private maxConnectionAttempts: number = 5;
  
  // Default activity with buttons
  private defaultActivity = {
    details: 'Browsing Anime',
    state: 'Idle',
    largeImageKey: 'ads_z',
    largeImageText: 'OpenAnime CLI',
    instance: false,
    buttons: [
      {
        label: 'GitHub Project',
        url: 'https://github.com/Luxotick/openanime-cli',
      },
      {
        label: 'OpenAnime',
        url: 'https://openani.me',
      },
    ],
  };

  private constructor() {
    this.client = new RPC.Client({ transport: 'ipc' });
    this.startTimestamp = new Date();
  }

  // Get singleton instance
  public static getInstance(): DiscordRPC {
    if (!DiscordRPC.instance) {
      DiscordRPC.instance = new DiscordRPC();
    }
    return DiscordRPC.instance;
  }

  // Connect to Discord RPC - non-blocking implementation
  public connect(): Promise<void> {
    return new Promise<void>((resolve) => {
      const config = getConfig();
      
      // Skip if Discord RPC is disabled in config
      if (!config.enableDiscordRPC) {
        console.log('Discord RPC is disabled in config');
        resolve();
        return;
      }

      // Skip if already connected
      if (this.connected) {
        console.log('Discord RPC is already connected');
        resolve();
        return;
      }
      
      // Set up event handlers first
      this.setupEventHandlers();
      
      // Attempt connection in a non-blocking way
      console.log(`Connecting to Discord RPC (Client ID: ${CLIENT_ID})...`);
      
      this.client.login({ clientId: CLIENT_ID })
        .then(() => {
          // Login is successful, but we don't need to do anything here
          // The 'ready' event handler will handle the rest
          this.connectionAttempts = 0;
        })
        .catch(error => {
          this.connected = false;
          this.connectionAttempts++;
          
          console.error('Discord RPC connection error:', error);
          if (error instanceof Error) {
            console.error('Error message:', error.message);
          }
          
          if (this.connectionAttempts < this.maxConnectionAttempts) {
            console.log(`Retrying connection in 30 seconds (Attempt ${this.connectionAttempts}/${this.maxConnectionAttempts})...`);
            setTimeout(() => this.connect(), 30000);
          } else {
            console.log('Maximum connection attempts reached. Discord RPC will be disabled.');
          }
        });
      
      // Always resolve immediately to prevent blocking the CLI
      resolve();
    });
  }
  
  // Set up event handlers for the Discord RPC client
  private setupEventHandlers(): void {
    // Handle ready event
    this.client.on('ready', () => {
      this.connected = true;
      console.log(`Discord RPC connected successfully (User: ${this.client.user?.username})`);
      
      // Clear activity and set default activity
      this.clearActivity()
        .then(() => this.updateDefaultActivity())
        .catch(error => console.error('Error updating default activity:', error));
    });

    // Handle disconnected event
    this.client.on('disconnected', () => {
      this.connected = false;
      console.log('Discord RPC connection lost, will retry in 30 seconds');
      
      setTimeout(() => {
        if (this.connectionAttempts < this.maxConnectionAttempts) {
          this.connect();
        } else {
          console.log('Maximum reconnection attempts reached. Discord RPC will remain disconnected.');
        }
      }, 30000);
    });
  }

  // Clear activity - non-blocking implementation
  public clearActivity(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.connected) {
        resolve();
        return;
      }
      
      this.client.clearActivity()
        .then(() => resolve())
        .catch(error => {
          console.error('Failed to clear Discord activity:', error);
          resolve(); // Still resolve to not block CLI
        });
    });
  }

  // Set default activity - non-blocking implementation
  public updateDefaultActivity(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.connected) {
        resolve();
        return;
      }
      
      this.client.setActivity(this.defaultActivity)
        .then(() => resolve())
        .catch(error => {
          console.error('Failed to set default Discord activity:', error);
          resolve(); // Still resolve to not block CLI
        });
    });
  }

  // Update activity with custom details - non-blocking implementation
  public updateActivity(details: string, state: string, imageKey: string = 'ads_z', imageText: string = 'OpenAnime CLI'): Promise<void> {
    return new Promise<void>((resolve) => {
      const config = getConfig();
      
      // Skip if Discord RPC is disabled or not connected
      if (!config.enableDiscordRPC || !this.connected) {
        resolve();
        return;
      }

      // Create activity object with buttons
      const activity: RPC.Presence = {
        details,
        state,
        startTimestamp: this.startTimestamp,
        largeImageKey: imageKey,
        largeImageText: imageText,
        instance: false,
        buttons: [
          {
            label: 'GitHub Project',
            url: 'https://github.com/Luxotick/openanime-cli',
          },
          {
            label: 'OpenAnime',
            url: 'https://openani.me',
          },
        ]
      };

      // Debug logging
      console.log('Updating Discord RPC activity:', JSON.stringify(activity, null, 2));
      
      // Set activity without blocking
      this.client.setActivity(activity)
        .then(() => {
          console.log('Discord RPC activity updated successfully');
          resolve();
        })
        .catch(error => {
          console.error('Failed to update Discord activity:', error);
          if (error instanceof Error) {
            console.error('Error message:', error.message);
          }
          resolve(); // Still resolve to not block CLI
        });
    });
  }

  // Update activity for watching anime - non-blocking implementation
  public updateWatchingAnime(animeTitle: string, episodeInfo: string, episodeUrl?: string, imageUrl?: string): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.connected) {
        resolve();
        return;
      }
      
      let imageKey = 'ads_z';
      
      // Try to parse image URL for custom image key
      if (imageUrl) {
        try {
          const parsedUrl = new URL(imageUrl);
          const pathParts = parsedUrl.pathname.split('/');
          const filename = pathParts[pathParts.length - 1];
          if (filename) {
            imageKey = filename.split('.')[0]; // Remove extension
          }
        } catch (error) {
          console.error('Error parsing image URL:', error);
        }
      }

      const watchUrl = episodeUrl ? `https://openani.me/${episodeUrl}` : 'https://openani.me';
      
      // Create activity object with anime details and buttons
      const activity: RPC.Presence = {
        details: `Watching: ${animeTitle}`,
        state: `Episode: ${episodeInfo}`,
        startTimestamp: this.startTimestamp,
        largeImageKey: imageKey,
        largeImageText: animeTitle,
        instance: false,
        buttons: [
          {
            label: 'GitHub Project',
            url: 'https://github.com/Luxotick/openanime-cli',
          },
          {
            label: 'Watch Episode',
            url: watchUrl,
          },
        ]
      };
      
      // Debug logging
      console.log('Updating anime watching activity:', JSON.stringify(activity, null, 2));
      
      // Set activity without blocking
      this.client.setActivity(activity)
        .then(() => {
          console.log('Anime watching activity updated successfully');
          resolve();
        })
        .catch(error => {
          console.error('Failed to update anime watching activity:', error);
          if (error instanceof Error) {
            console.error('Error message:', error.message);
          }
          resolve(); // Still resolve to not block CLI
        });
    });
  }

  // Update searching activity
  public updateSearching(query: string): Promise<void> {
    return this.updateActivity(
      'Searching Anime',
      `Query: ${query}`,
      'search',
      'Searching for anime'
    );
  }

  // Update main menu activity
  public updateMainMenu(): Promise<void> {
    return this.updateActivity(
      'Browsing Anime',
      'In Main Menu',
      'ads_z',
      'OpenAnime CLI'
    );
  }

  // Disconnect from Discord RPC
  public disconnect(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.connected) {
        resolve();
        return;
      }
      
      this.clearActivity()
        .then(() => {
          try {
            this.client.destroy();
            this.connected = false;
            console.log('Discord RPC connection closed');
          } catch (error) {
            console.error('Error closing Discord RPC connection:', error);
          } finally {
            resolve(); // Always resolve to not block CLI
          }
        })
        .catch(() => {
          try {
            this.client.destroy();
            this.connected = false;
          } catch (error) {
            console.error('Error closing Discord RPC connection:', error);
          } finally {
            resolve(); // Always resolve to not block CLI
          }
        });
    });
  }
  
  // Generate anime URL
  private getAnimeUrl(slug: string, season?: number, episode?: number): string {
    let url = `https://openani.me/anime/${slug}`;
    if (season) {
      url += `/${season}`;
      if (episode) {
        url += `/${episode}`;
      }
    }
    return url;
  }
}

// Export singleton instance
export const discordRPC = DiscordRPC.getInstance();
