# 🧬 Lucifer Evolution: Phase 2 (Hybrid Intelligence)

This document tracks the transition of Lucifer to a high-performance, cost-effective hybrid architecture optimized for the M5 chip.

## 📋 Evolution Summary
In Phase 2, we decoupled "Reasoning/Coding" from "Vision". By moving the main brain to a local model, we achieved unlimited usage and zero-latency interactions while maintaining advanced vision capabilities.

## 🛠 Architectural Changes (Hybrid)
| Feature | Phase 1 (API Only) | Phase 2 (Hybrid) |
| :--- | :--- | :--- |
| **Primary Brain** | Gemini 2.5 Flash (API) | **Qwen 2.5 Coder 7B (Local)** |
| **Vision Brain** | Gemini 1.5 Flash (API) | Gemini 1.5 Flash (API) |
| **Inference Cost** | Quota Limited | **Unlimited (Local)** |
| **Latency** | Network Dependent | **Instantaneous** |
| **Protocol** | Google GenAI SDK | **OpenAI Compatible (via LM Studio)** |

## 🚀 Phase 2: Local Integration Details

### 1. LM Studio Synergy
- **Model:** Qwen 2.5 Coder 7B (Q4_K_M).
- **Setup:** Configured to run on 8 threads for thermal safety on the MacBook Air M5.
- **Server:** Running on `localhost:1234` using the OpenAI-compatible endpoint.

### 2. The Hybrid Loop
- **General Queries:** Handled locally by Qwen.
- **Agentic Tasks:** Qwen decides when to run local shell commands via the `run_command` tool.
- **Vision Tasks:** Triggered by the `!screen` command, which bypasses the local model and calls the Gemini API directly.

## 🏃 How to Run the Hybrid Version
1. **Open LM Studio.**
2. **Load Qwen 2.5 Coder 7B.**
3. **Start the Local Server** (ensure port is `1234`).
4. Run Lucifer:
   ```bash
   cd /Users/lucifer/lucifer-sandbox
   npx ts-node index.ts
   ```

---
**Status:** Phase 2 Complete. Lucifer is now a private, high-speed, and hybrid-capable assistant.
