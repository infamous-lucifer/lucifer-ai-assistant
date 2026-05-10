# 👹 Lucifer AI Assistant (Hybrid v4.3)

**Lucifer** is a professional, high-performance agentic AI assistant designed specifically for macOS (optimized for Apple Silicon M5). It combines the lightning-fast logic of a local model with the advanced visual capabilities of the Gemini 2.0 API.

## 🚀 Key Features
- **Hybrid Intelligence:** Powered by **Qwen 2.5 Coder 7B (Local MLX)** for unlimited coding tasks and **Gemini 2.0 Flash** for vision tasks.
- **System Agency:** Lucifer can run terminal commands, manage files, and check system health directly.
- **Vision Ready:** Built-in `!screen` command to analyze your workspace using Gemini Vision.
- **Surgical Precision:** Uses specialized tools to edit specific lines of code without overwriting entire files.
- **Self-Correction Loop:** Features an `--evolve` mode where the assistant audits its own code and proposes improvements for review.
- **Command Center Aware:** Integrated with a centralized `~/runtimes` folder for reliable tool execution and path resolution.

## 🛠 Project Structure
- `index.ts`: The main entry point containing the agentic loop and tool definitions.
- `docs/EVOLUTION.md`: Detailed history of the architectural leaps from v1.0 to v4.3.
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
- `!screen [query]`: Take a screenshot and analyze it using Gemini Vision.
- `--evolve`: Run in maintenance mode to audit and improve Lucifer's source code.
- `--rollback`: Instantly restore the last stable version of the assistant.

## 📈 Version History

| Version | Milestone | Description |
| :--- | :--- | :--- |
| **v1.0** | Initial Release | Basic chat-only assistant with Gemini API. |
| **v2.5** | Hybrid Leap | Integrated LM Studio & Qwen 2.5 Coder for local processing. |
| **v3.5** | Precision Phase | Added surgical tools (`replace_in_file`) and range-based reading. |
| **v4.2** | Hardening | Implemented Guard Rails, Rollback, and History Trimming. |
| **v4.3** | Pro Release | Final Polish: Integrated Command Center logic, fixed deps, and added global link instructions. |

## 🛡 Security & Safety
- **Guard Rails:** Hardcoded blocks for dangerous commands (e.g., `rm -rf /`, `sudo`, `mkfs`).
- **Privacy:** 100% of your code and terminal data stays local. Only screenshots are sent to Gemini API.
- **Human-in-the-Loop:** All evolution proposals require manual approval before implementation.

---
*Created with 🖤 for the M5 MacBook Air.*
