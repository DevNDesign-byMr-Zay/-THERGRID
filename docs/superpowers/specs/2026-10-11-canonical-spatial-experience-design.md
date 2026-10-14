# ÆTHERGRID canonical frontend and spatial experience

Status: approved by the operator; production foundation implementation is in progress. Authentication and persisted-history integrations await published backend contracts.

## Purpose and baseline

Build a refined, responsive spatial investigation experience for an operator who moves from a real city/entity to timestamped operational context, specialist analysis, scenario comparison and evidence review.

Inspected baseline: `9b61b86e674d2bd35f7fcfb6ecf71fec7d6e5283`, which is both fetched main and the remote `v0.2.1` tag on 2026-10-11. The old local vNext branch is preserved; it is not the new implementation base.

The canonical application remains `apps/aethergrid-console/web/`, with React/TypeScript and Cesium, plus the maintained native WebGL renderer fallback. Backend provider adapters, authentication services and release packaging remain outside this frontend workstream. No release or hardware job is part of this assignment. D-Wave stays on hold, unconfigured and non-executable; IBM uses the existing abstraction and separate quantum workstream.

## Approach and alternatives

Recommended: incrementally extend the existing typed renderer, source clients, temporal clock and shell in five focused PRs. This preserves canonical startup, existing acceptance coverage and renderer fallback while allowing each visual and interaction change to be independently reviewed.

An alternative is a parallel replacement frontend. It would duplicate state, provenance and renderer behavior and increase migration risk, so it is rejected. A screenshot-backed city presentation cannot meet interactive geometry acceptance and is rejected.

## Existing surfaces and verified gaps

| Concern | Existing surface | Upgrade boundary |
| --- | --- | --- |
| Shell | `src/app/App.tsx`, `command-center.css`, `use-command-drawer.ts` | Persistent viewport, drawer focus, workspace transitions and responsive hierarchy |
| Appearance | `use-appearance.ts`, `SettingsPanel.tsx` | Existing dark/light/system behavior; expand readable coverage and browser acceptance |
| Profile | `ProfileMenu.tsx`, `services/profile-client.ts` | Existing `/api/aethergrid/profile` is profile storage, not authenticated identity |
| Provider readiness | `RuntimeDiagnosticsPanel.tsx`, `services/runtime-client.ts` | Distinguish configuration, readiness and observed live success |
| City geometry | `services/city-power-overlay.ts`, `renderer/cesium/network-overlay-layer.ts` | Already carries height sources, building parts, roof and material tags; render supported attributes without inventing identity |
| Adaptive detail | `renderer/cesium/cesium-renderer.ts` | Existing geographic detail/SSE controls; add bounded performance adaptation |
| Temporal operations | `TemporalRail.tsx`, `time/`, operational source clients | Historical retrieval remains pending; weather forecast uses real returned samples |
| Spatial tools | analysis, dossier, workset, comparison, bookmark and session components | Preserve measurements and provenance; improve shared selection and comparisons |
| Specialists | `AgentDock.tsx`, `services/agent-client.ts` | Existing model metadata, handoffs and TEAM contributions; consume authorized tool receipts when published |

The checked server exposes profile GET/PUT routes but no published login/logout API. Do not fabricate endpoint names, roles or authenticated status. Inspect main and Jules PRs again before each implementation checkpoint.

Stored acceptance captures are baseline references only. The inspected desktop image depicts an earlier degraded/loading state and must not be used as evidence of current live renderer behavior.

## Shared frontend architecture

Keep the world viewport mounted across navigation and presentation changes. Navigation selects an intelligence workspace; it does not instantiate another world or discard selection, camera, temporal cursor or layers. Split shell responsibilities into focused hooks/components as needed while preserving the existing app state contracts.

Source state remains attached to each dataset/entity: provider, source timestamp, fetch timestamp, units, quality flags, coverage, fallback/simulation status and limitation. Use explicit LIVE, STALE, SIMULATED and UNAVAILABLE labels. Configuration success is not live verification. Static mapped topology has its own source/coverage label and must not appear to be a current measurement.

Async loads are abortable and keyed by target, temporal mode and cursor/request generation. Late responses cannot overwrite a newer city, user session or time frame. API errors retain context and provide a scoped retry. Offline cached values remain stale and identify their timestamp.

Renderer-specific geometry is behind the maintained adapter interface. Every new method has explicit supported/unsupported capability behavior in the native adapter. No UI control advertises an effect the active renderer cannot implement.

## PR 1: production shell and authenticated UX

Preserve the spatial-first layout and brand assets. Desktop uses collapsible navigation and intelligence panels; tablets and phones use mutually exclusive drawers/sheets with bounded internal scrolling. Keep search, source status and time controls discoverable. The scene remains visible while a compact tool is open.

Polish active states, hierarchy, panel entrance/exit and loading feedback. Respect reduced motion, 200% text zoom, touch targets, safe-area insets and short landscape heights. Keyboard focus moves into the active dialog, stays contained, returns to the trigger and never reaches an inert drawer. Escape closes the current dismissible surface. Provide meaningful accessible labels and status announcements without per-frame announcement spam.

Expand light/dark/system tokens across profile, agent, operational, inspector and comparison surfaces. System appearance reacts to OS changes; storage failures retain the in-memory setting. Scene lighting remains physical/time-based and separate from UI theme.

Consume Jules authentication only after its real routes, session transport, CSRF policy, role/capability response and error semantics are published. Model checking, anonymous, authenticated, expired and unavailable states. UI capabilities derive from server responses; 401/403 clears privileged affordances and handles pending requests. Login/logout do not use local profile edits as proof of identity. Never persist credentials or allow local role overrides. The backend remains the authorization authority.

If authentication contracts are absent, complete independently testable shell work, show authentication unavailable and keep the authenticated portion explicitly incomplete. Do not open a supposedly complete authenticated UX PR with placeholder endpoints.

Connection Center presents configured provider, declared capability, most recent validated result, source/fetch time, degraded reason and retry when supported. Keep it useful to operators without exposing secrets, CRNs or raw debug payloads. D-Wave remains only its existing on-hold/unconfigured status.

## PR 2: city realism and renderer upgrades

Start with New York, London and Tokyo using actual supplied source footprints, parts and attributes. City identity must derive from map geometry and verified named features rather than a city-name-dependent fabricated skyline. Show footprint count, measured/source-tagged height coverage and modeled height coverage.

Validate finite coordinates/heights, positive roof dimensions, polygon closure and supported roof shape before constructing geometry. Distinguish explicit height, levels-derived height and inferred height. Where height is missing, either retain the existing clearly modeled extrusion or show footprint-only detail; do not call its envelope architecturally accurate. Unsupported roof shapes remain simple massing with a visible limitation.

Use validated building/roof materials and colors, source-backed structure parts and supported roof forms. Neutral unclassified materials remain neutral. Glass shading is a visual material treatment, not evidence of verified facade construction. Keep picking IDs/provenance on every rendered part.

Preserve real Cesium terrain, imagery and building tiles where available, avoiding duplicate buildings when tiles are active. Improve depth, selection outlines, solar lighting and bounded shadows. Sky, clouds and precipitation are visualizations of valid weather observations/forecast samples; stale conditions are labeled and unavailable conditions do not trigger claimed real weather effects. Water/coastline/vegetation derive from source polygons. Computed solar illumination is labeled computed.

Animate vehicles only from valid timestamped positions with source-supported heading and coordinates. Any demonstrative movement must be explicitly simulated and independently toggleable. Empty fresh feeds are not invented traffic.

Extend existing SSE/detail settings with bounded quality presets and adaptation based on measured frame/tile performance, viewport and capability. Use hysteresis to prevent quality oscillation; pause unnecessary animation in hidden tabs; dispose replaced geometry and event listeners. Validate remaining supported cities through the same architecture after the first three.

## PR 3: 4D operational timeline

One responsive temporal controller owns LIVE, HISTORICAL, FORECAST and SCENARIO cursor/range, replay speed, bookmarks and comparison frame selection. Present available coverage per layer; derive scrub ranges from returned source samples rather than a decorative fixed range.

Historical observations require Jules' persisted timestamped records and their provenance. No historical request may silently fall back to current observations. If retrieval is missing or outside coverage, hide current-only overlays and show unavailable historical data. Static geometry may remain visible with its map timestamp and an explicit statement that historical building reconstruction is unavailable.

Forecast selection snaps to valid samples or a source-defined interpolation rule, with issued-at time, valid-at time and interval. Missing samples are gaps. Scenario state stays modeled and separate from observed/forecast values.

Synchronize environmental, network, vehicle and event overlays to the selected frame. Replay speed changes temporal progression, not source refresh cadence. Debounce/cancel scrub requests, bound cached observations and stop playback at supported range limits. Bookmarks store context without certifying freshness.

A/B comparison uses distinct immutable frame receipts. Provide synchronized camera/layers with independent timestamps and accessible stacked presentation on phones. If dual rendering exceeds the measured GPU budget, provide frame switching and numeric differences with an explicit reduced comparison mode rather than pretending a single current world is two historical worlds.

## PR 4: holographic tools and scenario comparisons

Expose solid, wireframe, grid and holographic presentations through the current adapter, with actual geometry effects, predictable selection and independent layer visibility/opacity. Preserve source-backed geodetic and power network overlays; inferred relationships are visibly modeled.

Refine picking, distance/area measurement, inspector provenance, comparison, investigation, bookmarks and saved views. Measurements identify coordinate system, units and terrain/geodesic approximation limits. Selection survives presentation switches and expires/revalidates when its source changes.

Scenario effects are operator-created or returned by the authorized backend, always modeled. Export JSON scene descriptions with schema, camera, target, presentation, layers, temporal frames, selection references, source receipts, modeled effects and limitations. Exclude tokens, account secrets and unintended personal profile fields. Export remains a reproducible scene description, not proof that all data remains available.

## Operational dashboard work across PRs 1–4

New York consumes existing weather, EIA NYIS, NOAA BATN6, NWS hazards, mapped power infrastructure and decoded GTFS-Realtime clients. Each card shows value, unit, source time, freshness and quality flags. Missing sentinels remain withheld.

EIA is regional fuel mix and cannot become verified per-building flow or building consumption. NOAA gauges remain explicitly bound to the identified station, not inferred from cursor proximity. NWS geometry uses source validity intervals. GTFS catalog discovery and trip updates are distinguished from actual vehicle positions. Maps and numeric cards show the same source receipt and temporal availability.

## PR 5: agent integration and final visual QA

Retain the existing VÆLON, AUREN, SOLVÆR and TEAM marks and clarify each specialist's purpose. Display actual provider/model, fallback status, tool execution provenance, citations and returned TEAM contributions. Do not invent citations or synthesize backend tool decisions in the browser.

Guided flow: selected entity and frame → choose specialist/task → authorized backend analysis → inspect returned scenario comparison → review cited evidence. Include context in a readable confirmation before submitting; do not auto-submit analyses when selection changes. Keep histories readable, abort/cancel only where the contract supports it and show a request still running accurately.

Link only returned entity, scenario and evidence identifiers. Missing tool receipts or unavailable authorized endpoints produce an explicit limitation. Render all provider output as untrusted text/validated structured data. No D-Wave additions.

## Acceptance and delivery

Each focused PR includes actual source/styles/tests and required assets, base/head SHAs, screenshots from the running compiled canonical app, source-contract dependencies and explicit remaining gaps. PRs are delivered in the requested sequence; no automatic merge or release is implied.

Required per-PR gates: TypeScript build, applicable root tests/coverage with unchanged thresholds, browser acceptance, Engineering CI and CodeQL. Existing packaging checks continue unchanged. Credentialed live evidence runs through maintained protected workflows; offline fixtures are labeled contract tests, never live acceptance.

Browser matrix: 1536×1024, 1440×900, 1366×768, 1024×768, 768×1024 and 390×844, plus narrow landscape and text zoom. Cover both themes/system switching, keyboard-only navigation, reduced motion, offline/API failure, denied/expired authentication when contracts exist, renderer fallback, source gaps and city switching during requests.

Spatial acceptance: New York/London/Tokyo distinct source geometries; actual interactive picking/measurement; no duplicate tile/footprint city; unsupported geometry labeled; weather tied to valid timestamps; fallback reports limitations. Capture exact source coverage with the visual evidence.

Performance acceptance: repeat city/mode switches and a 15-minute 4D replay, record renderer, GPU/browser environment, frame-time distribution, tile-loading progress, failures and available memory/resource counters. Check disposed resources and bounded caches for growth. Compare against a fresh baseline on the same device/runtime; do not claim software-rendered cloud tests certify mobile hardware performance. Final report identifies devices not available for physical GPU testing.

Definition of done requires all five PRs' behavior working together and all available contracts integrated. Missing authentication or history contracts are explicit unfinished dependencies; passing offline screenshots cannot erase them.

## Review checklist

- Scope matches the user's five frontend PRs and seven batches.
- Existing renderer/application surfaces are extended; backend and packaging are untouched.
- Authentication is not confused with profile or local workspace sessions.
- Historical frames cannot reuse live observations.
- Modeled heights/material treatment, solar calculations and scenarios remain distinct from measurements.
- Regional energy is not building electricity flow.
- D-Wave remains on hold; no hardware submission is introduced.
- No credentials or fabricated reference imagery enter evidence.
- Tests report offline, live and physical-device coverage separately.

Next step after user design review: write the detailed implementation plan for PR 1 against the latest main and Jules contracts, then execute and verify the focused source changes.
