# OpenAnime CLI

A command-line interface for watching anime from various streaming sites.

## Features (Planned)

- 🔍 Search anime across multiple streaming sites
- 📺 Stream episodes directly from terminal
- 📖 Episode management and tracking
- 📜 Watch history
- ⚙️ Configurable settings
- 🎬 Multiple video players support

## Installation

```bash
npm install -g openanime-cli
```

## Usage

```bash
# Search and watch anime
openanime "Your Anime Name"

# Interactive mode
openanime
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build project
npm run build
```

## Project Structure

```
src/
├── core/           # Main application logic
├── services/       # API and external services
│   ├── api.ts      # Anime data fetching
│   └── player.ts   # Video playback
└── utils/          # Utility functions
    ├── config.ts   # Configuration management
    ├── fileUtils.ts # File operations
    └── historyUtils.ts # Watch history
```

## Requirements

- Node.js >= 18.0.0
- A video player (mpv recommended)

## License

MIT
