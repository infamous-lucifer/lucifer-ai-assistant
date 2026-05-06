# Lucifer AI Assistant

A command-line AI assistant optimized for free-tier Gemini API usage, with screen analysis, web search, and rate limit management.

## Features

- **Multi-model optimization**: Uses free-tier friendly models (Gemini 2.5 Flash for search, 3.1 Flash Lite for vision/chat)
- **Screen analysis**: Captures and analyzes your screen with caching to avoid redundant API calls
- **Web search**: Integrated Google Search grounding with high limits
- **Rate limit tracking**: Monitors daily usage with visual progress bars
- **Retry logic**: Automatic exponential backoff for rate limit errors
- **Cross-platform**: Works on macOS, Linux, and Windows (with appropriate screen capture tools)

## Installation

### Option 1: Global NPM Install (Recommended)
```bash
npm install -g lucifer-ai-assistant
lucifer
```

### Option 2: From Source
```bash
git clone https://github.com/infamous-lucifer/lucifer-ai-assistant.git
cd lucifer-ai-assistant
npm install
npm link  # or npm install -g .
lucifer
```

## Setup

1. **Get a Gemini API key** from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. **Create `.env` file** in the project root:
   ```
   API_KEY=your_gemini_api_key_here
   ```
3. **Install system dependencies**:
   - **macOS**: `screencapture` (built-in)
   - **Linux**: `scrot` or `maim` (`sudo apt install scrot`)
   - **Windows**: `nircmd` or PowerShell screenshot tools

## Usage

```bash
lucifer
```

### Commands
- `!search <query>` - Search the web using Gemini 2.5 Flash
- `!screen [query]` - Analyze your screen (cached for performance)
- `!limits` - View today's API usage with progress bars
- `exit` - Quit and show final usage stats

### Examples
```
lucifer@m5-air > !search latest TypeScript features
lucifer@m5-air > !screen what applications are open?
lucifer@m5-air > !limits
lucifer@m5-air > Hello, how are you?
```

## Rate Limits (Free Tier)

- **Gemini 2.5 Flash**: 1,500 requests/day (search)
- **Gemini 3.1 Flash Lite**: 500 requests/day (vision/chat)
- Automatic retry with exponential backoff on rate limits

## Development

```bash
npm run build  # if you add a build script
npm test       # add tests
```

## Requirements

- Node.js 18+
- TypeScript
- Gemini API key
- Screen capture tool for your OS

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Disclaimer

This tool uses Google's Gemini API. Usage is subject to Google's terms of service and rate limits. The author is not responsible for any API costs or usage violations.