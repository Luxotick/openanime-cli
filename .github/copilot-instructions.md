<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# OpenAnime CLI Development Instructions

## Project Overview
This is a TypeScript-based CLI application for streaming anime from various websites. The project uses:
- Node.js with TypeScript
- Commander.js for CLI interface
- Cheerio for HTML parsing
- Fetch API for HTTP requests
- No Selenium (kept simple)

## Code Style Guidelines
- Use modern ES modules (import/export)
- Prefer async/await over promises
- Use TypeScript strict mode
- Keep functions pure when possible
- Use descriptive variable names
- Add JSDoc comments for public APIs

## Architecture
- `src/core/` - Main application logic
- `src/services/` - External service integrations (API calls, video player)
- `src/utils/` - Utility functions (file operations, config, history)

## Development Notes
- All API implementations are currently stubs (TODO comments)
- Focus on clean interfaces and type safety
- Keep dependencies minimal
- Prioritize cross-platform compatibility
