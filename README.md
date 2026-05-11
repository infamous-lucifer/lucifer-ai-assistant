# 👹 Lucifer AI: Hardened Edition (v9.3)

**Lucifer** is a security-hardened, agentic AI developer partner for macOS, optimized for local execution on M-series chips. It serves as a specialized **CLI wrapper** that connects your terminal to a private local model (Qwen 2.5) for text/coding tasks and Gemini 2.0 for vision.

Unlike mass-market cloud agents, Lucifer follows the **UNIX Philosophy**: "Write programs that do one thing and do it well." It is built for developers who prioritize **100% privacy**, deterministic execution, and industrial-grade security.

## 🛡 Security First Architecture

Lucifer v9.3 introduces a "Deterministic Security" model that protects your system from AI hallucinations and malicious injections:

- **Command Injection Protection**: All native tool calls (like `tldr`) use `execFileSync` with argument arrays, bypassing the shell and neutralizing metacharacter attacks.
- **Hardened Auto-Approval**: The auto-approval engine for `run_command` now uses an anchored, strict-regex validator. It automatically blocks shell chaining (`&&`, `;`), redirection (`>`, `>>`), and command substitution (`$()`, `` ` ``) from unprompted execution.
- **Atomic File Operations**: The `search_and_replace` tool now enforces string uniqueness. If a search snippet appears more than once in a file, the operation is blocked to prevent accidental destructive overwrites.
- **Type-Safe Core**: Replaced loose `any` types with strict `Message` and `ToolCall` interfaces, ensuring structural integrity of the AI-to-System communication pipe.

## 🚀 Key Features

- **Local Brain:** Qwen 2.5 Coder 7B (via LM Studio) for infinite, zero-cost, offline coding assistance.
- **Vision Brain:** Gemini 2.0 Flash for high-accuracy screen and UI analysis.
- **Modular Core**: Decoupled architecture with discrete CLI handlers (`parser.ts` for one-shot, `repl.ts` for interactive).
- **Resilient AI Parsing**: Built-in fault-tolerant JSON parsing that automatically repairs common LLM hallucinations like trailing commas or markdown wrapping.
- **Guided Auto-Repair**: Use `!fix <issue>` for an autonomous Search -> Read -> Edit pipeline.

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

---
*Created with 🖤 for the M5 MacBook Air. Built for developers who value control.*
