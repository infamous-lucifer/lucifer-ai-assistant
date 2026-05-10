# 👹 Lucifer AI Assistant (Hybrid v5.1)

**Lucifer** is a professional, high-performance agentic AI assistant designed specifically for macOS. Version 5.1 introduces direct search capabilities alongside the **Adaptive Core**.

## 🚀 Key Features
- **Hybrid Intelligence:** Powered by **Qwen 2.5 Coder 7B (Local MLX)** for unlimited coding tasks and **Gemini 2.0 Flash** for vision tasks.
- **Adaptive Core (v5.0):** Real-time autonomous self-healing via `search_web` and comprehensive error analysis.
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

## 🛡 Security & Safety
- **Mandatory Approval:** All terminal commands require explicit manual approval ('y/n') before execution.
- **Path Guarding:** File operations are strictly restricted to the project root and allowed runtime directories.
- **Injection Defense:** Clipboard content is treated as untrusted data to prevent prompt injection attacks.
- **Privacy:** 100% of your code and terminal data stays local. Only screenshots are sent to Gemini API.

---
*Created with 🖤 for the M5 MacBook Air.*
