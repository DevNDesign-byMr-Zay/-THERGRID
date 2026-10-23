# Groq grid agents

Implement Phase 8 of the supplied v0.4.0 execution mission first, as explicitly emphasized in the follow-up. Preserve v0.3.1 architecture, contracts, offline mode, and physical-infrastructure advisory boundary.

The existing server owns credentials and observed data. VÆLON, AUREN and SOLVÆR remain independently configurable specialists; TEAM combines actual contributions. Default to supported Groq GPT-OSS 20B, with conservative token budgets and shared cooldowns, no paid-provider fallback. Configuration is not execution proof.

Model-callable skills inspect current spatial context and recorded observations, propose view/layer/city/time changes, and provide bounded local scenario comparison. Changes control only the application's visualization. Model responses carry validated typed actions, not executable code; the React app applies actions through existing state handlers, records each effect and supports undo. Tools never control real infrastructure, run arbitrary code, submit paid quantum jobs, or edit credentials.

Approaches: retain the provider-neutral runtime with bounded local tool calling (chosen to preserve contracts); remote MCP adds an unnecessary hosted dependency; text-command parsing cannot prove a model selected a valid skill. Preserve OpenAI-compatible and Ollama behavior. Groq free access is conditional on the user's account, not a promise that application code can guarantee billing.

Exact local credentials are unavailable in this session; inspect workflow bindings and sanitized prior protected evidence first. Never extract GitHub secrets. Add protected verification of all three independent responses and TEAM skills, leaving missing live execution explicitly unverified.
