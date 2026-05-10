# 👹 Lucifer AI Assistant (Hybrid v7.1)

**Lucifer** is a professional, high-performance agentic AI assistant designed specifically for macOS. Version 7.1 introduces the **Industrial Core**, featuring deterministic stability guards, high-precision guided pipelines, and security-hardened tool execution.

## 🚀 Key Features
- **Hybrid Intelligence:** Powered by **Qwen 2.5 Coder 7B (Local MLX)** for unlimited coding tasks and **Gemini 2.0 Flash** for vision tasks.
- **Industrial Core (v7.1):** Hardened stability via pre-flight tool validation and a mandatory "Read-Before-Write" security lock.
- **Guided Pipelines:** Dedicated `!fix` command for autonomous multi-step problem solving with zero agentic drift.
- **Visual Safety:** Interactive Git-style diffs for all file edits, ensuring you audit every change before it hits the disk.
- **Autonomous Verification:** Built-in TDD loop that automatically runs tests/syntax checks after edits to fix its own errors.
- **Local Search Engine:** High-speed full-text indexing via `minisearch` and native `grep` integration for high-precision codebase exploration.
- **Adaptive Core:** Real-time autonomous self-healing via `search_web` and comprehensive error analysis.
- **Manifest-Driven:** Configuration (tools, security rules, paths) is decoupled into `lucifer-manifest.json` for easy updates.
- **System Agency:** Lucifer can run terminal commands, manage files, and research updated syntax or docs online.
- **Persistence:** Markdown session logs (`~/.lucifer-logs`) with automatic log rotation (keeps last 50).
- **Vision Ready:** Built-in `!screen` command to analyze your workspace using Gemini 2.0 Vision.
- **Surgical Precision:** Uses specialized tools to edit specific lines of code without overwriting entire files.
- **Self-Evolution:** Enhanced `--evolve` mode for system-wide health checks, dependency audits, and manifest updates.

...
| **v4.8** | Stability & Polish | Log rotation, path sanitization, pinned dependencies, and tool call robustness. |
| **v5.0** | Adaptive Core | Self-healing via search_web, captured stderr, manifest-driven configuration, and evolution audit. |
| **v5.1** | Quick Search | Added `!search` shortcut for direct, non-agentic web research. |
| **v5.2** | Resiliency Plus | Context-aware history pruning, synthetic history for shortcuts, and loop step warnings. |
| **v5.3** | Local Optimized | Line-based editing, async shell execution, and deterministic evolution pipeline. |
| **v5.4** | Precision Pipeline | Added `search_codebase` (grep), numbered `read_file`, and standardized `edit_file_lines`. |
| **v6.0** | Professional Core | Interactive diffs, autonomous verification loop, and local search index. |
| **v7.1** | Industrial Core | Pre-flight validator, Read-Before-Write lock, and guided `!fix` pipeline. |

- `docs/EVOLUTION.md`: Detailed history of the architectural leaps from v1.0 to v4.5.
- `package.json`: Project configuration and dependencies.

## 🏃 Getting Started

### Prerequisites
1. **LM Studio:** Running a local server on port `1234`.
2. **Model:** `qwen2.5-coder-7b-instruct-mlx` loaded in LM Studio.
3. **API Key:** A Gemini API key (stored in `~/.lucifer-env`) for Vision tasks.

### Installation & Global Setup
```bash
# Clone the repository
git clone https://github.com/infamous-lucifer/lucifer-ai-assistant.git
cd lucifer-ai-assistant

# Install dependencies
npm install

# Rebuild and Register the global command
npm run build
npm link
```

### Usage
Run the assistant from anywhere:
```bash
lucifer
```

**Special Commands:**
- `!search <query>`: Instantly search the web for technical info or documentation.
- `!tldr <command>`: Get a simplified, community-driven cheat sheet for any terminal command.
- `!report`: Generate a deep system diagnostics report instantly.
- `!read <path>`: Quickly inspect the content of any project file.
- `!test`: Execute the full project unit test suite.
- `!status`: Run a real-time health check on the Lucifer environment.
- `!lms`: Check the current status of the local LM Studio server.
- `!screen [query]`: Take a screenshot and analyze it using Gemini Vision.
- `!clip [query]`: Analyze current clipboard content.
- `--evolve`: Run in maintenance mode to audit and improve Lucifer's source code.
- `--rollback`: Instantly restore the last stable version.
- `--status`: Run a system and environment health check.

## 📈 Version History

| Version | Milestone | Description |
| :--- | :--- | :--- |
| **v1.0** | Initial Release | Basic chat-only assistant with Gemini API. |
| **v2.5** | Hybrid Leap | Integrated LM Studio & Qwen 2.5 Coder for local processing. |
| **v3.5** | Precision Phase | Added surgical tools (`replace_in_file`) and range-based reading. |
| **v4.4** | Daily Driver | Streaming output, onboarding wizard, session logging, and macOS integration. |
| **v4.5** | Deep Insight | Advanced system diagnostics (`get_deep_system_report`) and API polish. |
| **v4.6** | Security Hardened | Mandatory command approval, path traversal protection, and injection defense. |
| **v4.7** | Type-Safe Architecture | Strict TypeScript interfaces, robust error handling, and surgical tool precision. |
| **v4.8** | Stability & Polish | Log rotation, path sanitization, pinned dependencies, and tool call robustness. |
| **v5.0** | Adaptive Core | Self-healing via search_web, captured stderr, manifest-driven configuration, and evolution audit. |
| **v5.1** | Quick Search | Added `!search` shortcut for direct, non-agentic web research. |

## 🛠 Development & Maintenance

To ensure the global `lucifer` command reflects your latest source code changes, you must rebuild the production binary:

### Build & Sync
```bash
# 1. Compile and bundle source code
npm run build

# 2. Ensure global link points to the production binary (one-time setup)
# ln -sf $(pwd)/dist/index.js /Users/lucifer/bin/lucifer
```

### Testing Source Changes
If you want to test changes without rebuilding the binary, run the source code directly using the development runtime:
```bash
npm start -- [args]
# Example: npm start -- --status
```

## 🧪 Testing
Run the comprehensive unit test suite to verify security guards and utility logic:
```bash
npm test
```

## 🛡 Security & Safety
- **Mandatory Approval:** All terminal commands require explicit manual approval ('y/n') before execution.
- **Path Guarding:** File operations are strictly restricted to the project root and allowed runtime directories.
- **Injection Defense:** Clipboard content is treated as untrusted data to prevent prompt injection attacks.
- **Privacy:** 100% of your code and terminal data stays local. Only screenshots are sent to Gemini API.

---
*Created with 🖤 for the M5 MacBook Air.*
