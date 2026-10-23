# Groq agent skills acceptance checkpoint

Baseline: main `7558309a648fd5fd59633b2636ebfa78a96890fe`, released v0.3.1. This is the agent batch of the broader v0.4.0 mission; it does not declare the full mission or release complete.

| Check | Observed result |
|---|---|
| Node22 conventional tests | 608 passed, zero failed |
| Coverage | 94.45% lines, 79.63% branches, 95.90% functions; maintained thresholds unchanged |
| Agent browser workflows | 18 passed, including desktop1366/mobile390, real app state changes, keyboard Undo, stopped response isolation and history review |
| Syntax, lint, formatting | Passed |
| Maintained JS / strict renderer type checks | Passed |
| Canonical production build and packaged runtime smoke | Passed; extracted files matched SHA256 inventory |
| Fresh review | Three Important findings fixed and re-reviewed; no remaining Important/Critical in reviewed scope |
| Current released Groq inference | Protected run39892894560 verified all three specialists and TEAM on baseline main |
| New authenticated Groq skills | Pending protected exact-candidate acceptance; no private credential available in this workspace |
| Native Windows / Docker | Not executed here; maintained checks preserved for CI |

Model-selected app controls now inspect context/observations, change view/layer/location/time, and compare explicit modeled load/generation assumptions. The server and client reject malformed actions, partial/fallback/stopped requests cannot apply controls, and Undo restores affected UI state. No skill actuates infrastructure or submits quantum hardware jobs.

Free-plan use depends on the actual Groq account plan. Runtime requests stay on the selected provider/model, enforce bounded prompts/tool loops, share cooldown by credential scope and expose provider-reported quotas. No key or paid fallback is embedded in the package. Secure configuration and current official provider documentation are in `docs/GROQ_GRID_AGENTS.md`.
