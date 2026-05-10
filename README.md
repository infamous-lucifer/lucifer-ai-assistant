# 👹 Lucifer AI Assistant (Hybrid v3.5)

**Lucifer** is a professional, high-performance agentic AI assistant designed specifically for macOS (optimized for Apple Silicon M5). It combines the lightning-fast logic of a local model with the advanced visual capabilities of the Gemini API.

## 🚀 Key Features
- **Hybrid Intelligence:** Powered by **Qwen 2.5 Coder 7B (Local MLX)** for unlimited coding tasks and **Gemini 1.5 Flash** for vision tasks.
- **System Agency:** Lucifer can run terminal commands, manage files, and check system health (battery, uptime) directly.
- **Surgical Precision:** Uses specialized tools to edit specific lines of code without overwriting entire files.
- **Self-Correction Loop:** Features an `--evolve` mode where the assistant audits its own code and proposes improvements for "Senior Review."
- **Dashboard Aware:** Integrated with a centralized `~/runtimes` folder for reliable tool execution.

## 🛠 Project Structure
- `index.ts`: The main entry point containing the agentic loop and tool definitions.
- `docs/EVOLUTION.md`: Detailed history of the architectural leaps from v1.0 to v3.5.
- `package.json`: Project configuration and dependencies (OpenAI, Google GenAI, Chalk).

## 🏃 Getting Started

### Prerequisites
1. **LM Studio:** Running a local server on port `1234`.
2. **Model:** `qwen2.5-coder-7b-instruct-mlx` loaded in LM Studio.
3. **API Key:** A Gemini API key (stored in `~/.lucifer-env`) for Vision tasks.

### Installation
```bash
# Clone the repository
git clone https://github.com/infamous-lucifer/lucifer-ai-assistant.git
cd lucifer-ai-assistant

# Install dependencies
npm install
```

### Usage
Run the assistant from anywhere (if symlinked to your PATH):
```bash
lucifer
```

**Special Commands:**
- `!screen [query]`: Take a screenshot and analyze it using Gemini Vision.
- `--evolve`: Run in maintenance mode to improve Lucifer's own source code.
- `--rollback`: Instantly restore the last stable version of the assistant.

## 📈 Version History

| Version | Milestone | Description |
| :--- | :--- | :--- |
| **v1.0** | Initial Release | Basic chat-only assistant with Gemini API. |
| **v2.0** | Agency Phase | Added `run_command` and basic filesystem access. |
| **v2.5** | Hybrid Leap | Integrated LM Studio & Qwen 2.5 Coder for local processing. |
| **v3.0** | Precision Phase | Added surgical tools (`replace_in_file`) and range-based reading. |
| **v3.3** | Evolution Loop | Created the `propose_fix` workflow with Gemini CLI as Senior Reviewer. |
| **v3.5** | Responsiveness | Optimized loops for M5 chip and improved error feedback. |

## 🛡 Security & Safety
- **Guard Rails:** Hardcoded blocks for dangerous commands (e.g., `rm -rf /`, `sudo`).
- **Privacy:** 100% of your code and terminal data stays local. Only screenshots are sent to Gemini API.
- **Human-in-the-Loop:** All evolution proposals require manual approval before implementation.

---
*Created with 🖤 for the M5 MacBook Air.*
