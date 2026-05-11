# 👹 Lucifer AI: Hardened Edition (v9.3)

**Lucifer** is a security-hardened, agentic AI developer partner for macOS, optimized for local execution on M-series chips. It serves as a specialized **CLI wrapper** that connects your terminal to a private local model (Qwen 2.5) for text/coding tasks and Gemini 2.0 for vision.

Unlike mass-market cloud agents, Lucifer follows the **UNIX Philosophy**: "Write programs that do one thing and do it well." It is built for developers who prioritize **100% privacy**, deterministic execution, and industrial-grade security.

## 🛡 Security First Architecture

Lucifer v9.3 introduces a "Deterministic Security" model that protects your system from AI hallucinations and malicious injections:

- **Command Injection Protection**: All native tool calls (like `tldr` and `git`) use `execFileSync` with argument arrays, bypassing the shell and neutralizing metacharacter attacks.
- **Hardened Command Execution**: User-requested shell commands (`run_command`) are executed via a shell but are protected by a two-tier validator: a strict metacharacter blacklist and an anchored, allow-list regex.
- **Atomic File Operations**: The `search_and_replace` tool now enforces string uniqueness. If a search snippet appears more than once in a file, the operation is blocked to prevent accidental destructive overwrites.
- **Type-Safe Core**: Replaced loose `any` types with strict `Message` and `ToolCall` interfaces, ensuring structural integrity of the AI-to-System communication pipe.

## 🚀 Key Features

- **Flexible Configuration**: Choose your local and vision models via environment variables (`LUCIFER_MODEL`, `LUCIFER_VISION_MODEL`).
- **Local Brain:** Qwen 2.5 Coder 7B (via LM Studio) for infinite, zero-cost, offline coding assistance.
- **Vision Brain:** Gemini 2.0 Flash for high-accuracy screen and UI analysis.
- **Modular Core**: Decoupled architecture with discrete CLI handlers (`parser.ts` for one-shot, `repl.ts` for interactive).
- **Resilient AI Parsing**: Built-in fault-tolerant JSON parsing that automatically repairs common LLM hallucinations like trailing commas or markdown wrapping.
- **Guided Auto-Repair**: Use `!fix <issue>` for an autonomous Search -> Read -> Edit pipeline.

## 🏃 Getting Started

### Prerequisites
1. **LM Studio:** [Download here](https://lmstudio.ai). Required for 100% private, zero-cost local reasoning.
2. **Model:** Load `qwen2.5-coder-7b-instruct-mlx`.
3. **Environment:** A Gemini API key (in `~/.lucifer-env`) for Vision capabilities. You can optionally set `LUCIFER_MODEL` and `LUCIFER_VISION_MODEL`.

### Installation
```bash
git clone https://github.com/infamous-lucifer/lucifer-ai-assistant.git
cd lucifer-ai-assistant
npm install && npm run build && npm link
```

## 🛠 Usage

```bash
# Interactive Mode
lucifer

# One-Shot Command
lucifer "How do I list listening ports on macOS?"

# Security-Hardened Command Generation
lucifer -c "Create a new git branch called feature/security"

# Vision Mode
lucifer --vision "What is in my browser window?"
```

## 🛡 Vision Privacy Notice
The Vision tool currently uses `screencapture -x`, which captures all active displays. Ensure no sensitive information is visible on your screens when using vision-based features. Future updates will focus on focused window capture.

---
*Created with 🖤 for the M5 MacBook Air. Built for developers who value control.*
