# Lucifer AI Assistant

A command-line AI assistant optimized for free-tier Gemini API usage, with screen analysis, web search, and rate limit management.

## Features

* **Multi-model optimization**: Uses free-tier friendly models (Gemini 2.5 Flash for search, 3.1 Flash Lite for vision/chat)
* **Screen analysis**: Captures and analyzes your screen with caching to avoid redundant API calls
* **Web search**: Integrated Google Search grounding with high limits
* **Rate limit tracking**: Monitors daily usage with visual progress bars
* **Retry logic**: Automatic exponential backoff for rate limit errors
* **Cross-platform**: Works on macOS, Linux, and Windows (with appropriate screen capture tools)

## Installation

### Option 1: Global Install from GitHub (Recommended)
All dependencies are bundled into a single executable file, so you won't run into any environment or sub-dependency (`spawn sh ENOENT`) errors during setup.

```bash
npm install -g github:infamous-lucifer/lucifer-ai-assistant
lucifer
```

### Option 2: From Source (For Developers)
```bash
git clone [https://github.com/infamous-lucifer/lucifer-ai-assistant.git](https://github.com/infamous-lucifer/lucifer-ai-assistant.git)
cd lucifer-ai-assistant
npm install
npm run build  # Bundles code into dist/index.js
npm link       # Makes the 'lucifer' command available globally
lucifer
```

## Setup

1. **Get a Gemini API key** from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. **Configure your API Key**: Create a `.env` file in the directory where you run the tool (or set it as a system environment variable `API_KEY`):
   ```env
   API_KEY=your_gemini_api_key_here
   ```
3. **Install system dependencies**:
   * **macOS**: `screencapture` (built-in)
   * **Linux**: `scrot` or `maim` (`sudo apt install scrot`)
   * **Windows**: `nircmd` or PowerShell screenshot tools

## Usage

```bash
lucifer
```

### Commands
* `!search <query>` - Search the web using Gemini 2.5 Flash
* `!screen [query]` - Analyze your screen (cached for performance)
* `!limits` - View today's API usage with progress bars
* `exit` - Quit and show final usage stats

### Examples
```text
lucifer@m5-air > !search latest TypeScript features
lucifer@m5-air > !screen what applications are open?
lucifer@m5-air > !limits
lucifer@m5-air > Hello, how are you?
```

## Rate Limits (Free Tier)

* **Gemini 2.5 Flash**: 1,500 requests/day (search)
* **Gemini 3.1 Flash Lite**: 500 requests/day (vision/chat)
* Automatic retry with exponential backoff on rate limits

## Development

```bash
npm run build  # Uses @vercel/ncc to compile and bundle into dist/index.js
```

## Requirements

* Node.js 18+
* TypeScript
* Gemini API key
* Screen capture tool for your OS

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Disclaimer

This tool uses Google's Gemini API. Usage is subject to Google's terms of service and rate limits. The author is not responsible for any API costs or usage violations.