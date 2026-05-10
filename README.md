# 👹 Lucifer AI: The Hybrid Utility Engine (v9.2)

**Lucifer** is a professional, high-performance AI utility designed for macOS power users and developers. Optimized for Apple Silicon (M5), it serves as a specialized **CLI wrapper** that connects your terminal to a private local model (Qwen 2.5) for text/coding tasks and Gemini 2.0 for vision.

Unlike mass-market cloud agents, Lucifer follows the **UNIX Philosophy**: "Write programs that do one thing and do it well." It is built for developers who prioritize **100% privacy** and deterministic execution over autonomous black-box reasoning.

## 🎯 Core Philosophy
- **Deterministic Utility:** No autonomous wandering. Lucifer acts as a surgical power tool, ensuring predictable results and human-in-the-loop safety.
- **Privacy First:** All code reasoning happens locally on your Mac via LM Studio. No code is ever sent to the cloud.
- **Text Stream Optimized:** Built to live in your shell pipelines (`stdin` ➔ `stdout`).

## 🚀 Key Features
- **Local Brain:** Qwen 2.5 Coder 7B (via LM Studio) for infinite, zero-cost, offline coding assistance.
- **Vision Brain:** Gemini 2.0 Flash for high-accuracy screen and UI analysis.
- **UNIX Pipeline:** Support for native piping (`cat logs.txt | lucifer`) and one-shot execution.
- **Command Suggest:** Generate and optionally execute shell commands with a secure `y/n/explain` loop.
- **Industrial Hardening:** Features OOM-safe indexing, context window protection, and a mandatory "Read-Before-Write" security lock.

## ⚠️ Limitations & Scope
Lucifer is a **high-precision utility**, not a general-purpose AGI. 
- **Optimized for 7B Models:** Best used with Qwen 2.5 Coder 7B or similar. Larger tasks should be broken down into surgical steps.
- **Context Constraints:** Operates under a local memory ceiling (~4000 tokens). Large data should be piped or read via line numbers.
- **Requires LM Studio:** You must be comfortable managing a local inference server for the best experience.

## 🏃 Getting Started

### Prerequisites
1. **LM Studio:** [Download here](https://lmstudio.ai). Required for 100% private, zero-cost local reasoning.
2. **Model:** Load `qwen2.5-coder-7b-instruct-mlx`.
3. **Environment:** A Gemini API key (in `~/.lucifer-env`) for Vision capabilities.

### Installation
```bash
git clone https://github.com/infamous-lucifer/lucifer-ai-assistant.git
cd lucifer-ai-assistant
npm install && npm run build && npm link
```

## 📈 Version History (Milestones)
| Version | Milestone | The Result |
| :--- | :--- | :--- |
| **v1.0** | API Wrapper | Initial cloud-based prototype. |
| **v4.6** | Security Pivot | Added sandboxing and mandatory human approval. |
| **v7.1** | Industrial Core | Solved logic loops via deterministic guards. |
| **v9.2** | Honest Reality | Current stable release. Optimized as a professional CLI wrapper. |

---
*Created with 🖤 for the M5 MacBook Air. Built for developers who value control.*
