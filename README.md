# 👹 Lucifer AI: The Hybrid Utility Engine (v9.1)

**Lucifer** is a high-performance, privacy-first AI utility designed for the macOS terminal. Optimized for Apple Silicon (M5), it follows the **UNIX Philosophy**: "Write programs that do one thing and do it well. Write programs to work together. Write programs to handle text streams."

Unlike traditional "agentic" AIs that suffer from context collapse and loops, Lucifer v9.1 functions as a deterministic **AI Swiss Army Knife**. It combines the private reasoning of a local 7B model (Qwen 2.5) with the advanced visual capabilities of Gemini 2.0.

## 🎯 Core Philosophy
- **Deterministic > Agentic:** No autonomous wandering. Lucifer acts only when commanded, ensuring 100% predictable behavior.
- **Text Stream First:** Built to live in shell pipelines (`stdin` ➔ `stdout`).
- **Private & Local:** All code reasoning happens on your Mac. Only screenshots are sent to Gemini API for vision tasks.

## 🚀 Key Features

### 1. Hybrid Intelligence
- **Local Brain:** Qwen 2.5 Coder 7B (via LM Studio) for infinite, zero-cost coding and text processing.
- **Vision Brain:** Gemini 2.0 Flash for high-accuracy screen and UI analysis.

### 2. The UNIX Pipeline
- **Native Piping:** Pipe any command output directly into Lucifer for analysis.
  ```bash
  cat logs.txt | lucifer "Find the root cause of this error"
  ```
- **Command Forge (`-c`):** Generate shell commands with a secure `y/n/explain` loop.
- **Structured Data:** Use `--json` to force machine-readable outputs for your own scripts.

### 3. High-Precision Tools
- **Grep Search:** Native `grep` integration for finding exact coordinates in your codebase.
- **Numbered Reading:** Files are read with `[Line X]` anchors, eliminating hallucination during edits.
- **Surgical Edits:** Line-based replacements with **Interactive Diffs** so you can audit every change.

### 4. Industrial Hardening
- **Context Sentinel:** Physically prevents context window blowout by capping tool outputs and rejecting massive file reads.
- **Security Lock:** Mandatory "Read-Before-Write" enforcement for all file modifications.
- **OOM Guard:** High-speed codebase indexing that ignores binaries and massive files to prevent system crashes.

## 🏃 Getting Started

### Prerequisites
1. **LM Studio:** Running a local server on port `1234`.
2. **Model:** `qwen2.5-coder-7b-instruct-mlx` loaded.
3. **Dependencies:** `brew install ddgr` (for web search).

### Quick Install
```bash
git clone https://github.com/infamous-lucifer/lucifer-ai-assistant.git
cd lucifer-ai-assistant
npm install && npm run build && npm link
```

## ⌨️ Command Reference

### One-Shot & Pipe (Recommended)
| Command | Action |
| :--- | :--- |
| `lucifer "query"` | Get a quick answer and exit. |
| `cat file \| lucifer` | Analyze piped data instantly. |
| `lucifer -c "query"` | Suggest a command with `y/n/explain`. |
| `lucifer --vision` | Capture and analyze screen. |
| `lucifer --search` | Direct web research. |

### Interactive Agent (`lucifer`)
| Command | Action |
| :--- | :--- |
| `!fix <issue>` | Guided auto-repair pipeline. |
| `!tldr <cmd>` | Get quick macOS cheat sheets. |
| `!report` | Deep system diagnostics. |
| `!test` | Run project unit tests. |

## 🛡 Security & Safety
- **100% Human-in-the-Loop:** No command runs and no file is changed without a manual `y` confirmation.
- **Secure Execution:** Uses `execFileSync` to prevent shell injection attacks.
- **Supply Chain Guard:** SHA256 checksum verification for all managed tool binaries.

---
*Created with 🖤 for the M5 MacBook Air. Optimized for stability and privacy.*
