# Specialist integration and final acceptance

> Execute inline with superpowers:executing-plans; the user has approved continuous execution. No merge or release.

**Goal:** Complete the available specialist, operational and final acceptance work using the canonical frontend and published backend contracts.

**Spec:** docs/superpowers/specs/2026-10-11-canonical-spatial-experience-design.md

**Architecture:** Extend AgentDock and existing clients, retain per-specialist bounded request receipts in memory, and guide operators through existing scenario/comparison/evidence surfaces. Never infer backend decisions or invent tool/citation APIs. Regional measurements remain independent from mapped infrastructure.

## Global constraints

- Backend adapters, authentication and release packaging stay unchanged.
- Missing authenticated-session, historical observation, tool and citation contracts remain explicit limitations.
- D-Wave existing frontend is held unconfigured and cannot discover, poll or submit jobs; IBM abstraction remains available.
- Credentials never enter histories, export or captures.
- Software GPU results cannot certify physical mobile performance.

## Review focus

- Aborted specialist requests cannot overwrite a new handoff or specialist receipt.
- Returning to a specialist retains its own model, context, execution receipt and bounded task history.
- Execution receipts are not labeled factual verification; absent tools/citations remain unavailable.
- D-Wave cannot send any provider request even if a server reports configured.
- Operational measurements retain source scope, units and unknown quality flags.
- Sustained replay and city transitions retain bounded resources and usable controls.

### Task 1: Specialist receipts and guided investigation

Files: AgentDock.tsx, agent-client.ts, App.tsx, command-center.css; tests/specialist-integration.spec.ts and browser acceptance.

Interfaces: bounded per-agent run records carry request/start/completion time, copied spatial context references and actual AgentResponse. Preserve backend request endpoint and history payload. Abort guards check signal and controller identity after response. Expose backend evidence only when returned, with existing evidence workspace navigation. Dedicated specialist identities and actual provider/model/fallback labels remain functional.

- [x] Write/run RED for late response after handoff, separate specialist receipts/history, unknown runtime, and readable evidence/contribution provenance.
- [x] Implement bounded records, readable task history, request context and existing comparison/evidence navigation. Explicitly disclose missing backend tool/citation receipts.
- [x] Run pure and compiled desktop/mobile acceptance, build; commit.

### Task 2: Operational scope and D-Wave hold

Files: OperationalDataPanel.tsx, operational-source-bindings.ts, QuantumPanel.tsx, quantum-client.ts, runtime diagnostics/settings existing controls; targeted tests.

Interfaces: use existing energy/grid and NOAA gauge endpoints. Offer explicit NYIS/BATN6 pilot bindings without treating them as building observations. Show missing provider quality metadata honestly. Existing D-Wave service calls reject before fetch while held; existing controls are disabled with on-hold text. No new hardware interface.

- [x] Write/run RED for provider-configured D-Wave still sending requests and pilot measurements lacking explicit scope/quality disclosure.
- [x] Implement hold and operational cards through existing APIs; IBM untouched.
- [x] Run contracts and compiled operational/hold acceptance, build; commit.

### Task 3: Final visual and sustained acceptance

Files: existing viewport/temporal CSS and renderer only for verified findings; browser tests/workflow; docs/acceptance and actual screenshots.

- [ ] Verify desktop/tablet/mobile/landscape, text zoom, reduced motion, keyboard, offline and both real Cesium/native WebGL.
- [ ] Run actual 15-minute 4D replay, record browser/GPU environment, timing, resource/memory availability, tile progress and errors; compare fresh same-runtime baseline. Distinguish rAF from GPU frame rate.
- [ ] Fix reproducible in-scope failures RED→GREEN; capture actual source scenes and specialist/operational panels.
- [ ] Run full Engineering, TypeScript build and applicable browser suites serially; fresh whole-branch review; fix Important/Critical once with regressions.
- [ ] Publish stacked draft PR5 with exact tested tree, await Engineering CI/CodeQL/browser gates, update all remaining contract/device limits. No completion claim for unavailable dependencies.
