---
name: project-0043-dev-mode-editor
description: Feature 0043 dev mode live config editor — implementation status and key decisions
metadata:
  type: project
---

Feature 0043 (dev mode live config editor) was fully implemented across 9 tasks (T1–T9). All 583 tests pass, coverage 90.64%, lint 0 errors, build clean.

**Why:** Adds a Monaco-based JSON editor as a dev-only wrapper that lets developers edit the runtime config in-browser without restarting.

**Key decisions:**
- `zod-to-json-schema@3.25.2` does not support Zod v4 internals — replaced by Zod v4's built-in `toJSONSchema()`. Package still installed but unused.
- T9 bundle gate uses Vite's programmatic `build()` API with explicit `define` flags to force tree-shaking (without them, `import.meta.env.DEV` is not replaced inside Vitest's test environment).
- `flushSync` is imported from `react-dom`, not `react`.
- Wrapper lives under `src/dev-runtime/`, mounted only under `import.meta.env.DEV` via dynamic import in `src/main.tsx`.

**Documentation pending (update-app-documentation):**
- Create `ai-workflow/docs/app-features/development/dev-mode-editor.md`
- Update `ai-workflow/docs/app-features/development/index.md`
- Update `ai-workflow/docs/app-features/development/local-config.md` (section "Límites de v1")
- Update `ai-workflow/docs/current-state.md`
