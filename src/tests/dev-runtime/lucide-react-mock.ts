import { createElement } from 'react'
import type { ComponentType, SVGProps } from 'react'

// Canonical mock catalog shared by T1/T2/T3 of feature 0129: a small, fixed subset of
// `lucide-react` icon names stands in for the real ~3900-icon namespace. Enumerating and rendering
// the real namespace made every icon-picker grid render take seconds, which blew past Vitest's
// global 5000ms timeout during the first T1 run (see status.yaml).
export const CATALOG = [
  'Home',
  'Settings',
  'Bell',
  'ChevronRight',
  'Users',
  'LayoutDashboard',
  'Search',
  'X',
] as const

// Every other named `lucide-react` icon import anywhere in the `dev-runtime`/`runtime` module
// graphs, beyond the icon-picker's own `CATALOG` above (T2, 0129). A test file that renders the
// full `DevRuntimeReady` tree, or `PropertyFieldDispatcher`'s full `WIDGET_REGISTRY`, pulls every
// one of these modules into its import graph regardless of which of them actually renders in a
// given test — ES module named-import bindings are resolved at module-load time, so a name
// missing from a `vi.mock('lucide-react', ...)` factory throws immediately on import, not only
// when the icon would actually render. Kept as one flat list (rather than each caller hand-picking
// its own subset) so a new icon import landing anywhere in either tree has one place to register
// it instead of silently breaking whichever test file didn't happen to list it yet.
export const OTHER_MODULE_ICON_NAMES = [
  'LayoutPanelTop',
  'LayoutPanelLeft', // tabs-orientation-property-field.tsx
  'Columns2',
  'LayoutGrid', // container-columns-mode-property-field.tsx
  'ChevronDown',
  'ChevronRight',
  'ListTree', // shell-menu-list-editor.tsx, sidebar-item-list-editor.tsx
  'LayoutTemplate',
  'Plug',
  'StickyNote',
  'KeyRound',
  'PanelTop',
  'Braces',
  'Plus',
  'SquarePen', // dev-editor-floating-toolbar.tsx
  'Check',
  'CloudAlert',
  'CloudSync',
  'CloudUpload', // file-manager-drop-zone.tsx
  'Download',
  'Eye',
  'EyeOff',
  'Trash2', // file-manager-row.tsx
  'HelpCircle', // field-tooltip.tsx
] as const

function createIconStub(name: string): ComponentType<SVGProps<SVGSVGElement>> {
  // Default `data-testid` first, `...props` last (T3, 0129): a couple of call sites
  // (`ShellMenuListEditor`/`SidebarItemListEditor`'s branch indicator) pass their own
  // `data-testid` straight to the Lucide icon component. Spreading `props` after the default lets
  // that caller-supplied id win, instead of this stub silently overwriting it with `lucide-${name}`
  // — which every other, decorative usage (no `data-testid` prop of its own) still falls back to.
  function IconStub(props: SVGProps<SVGSVGElement>) {
    return createElement('svg', { 'data-testid': `lucide-${name}`, ...props })
  }
  IconStub.displayName = `LucideIconStub(${name})`
  return IconStub
}

// Factory consumed by each test file's own `vi.mock('lucide-react', ...)` call. Vitest mock
// factories are hoisted above the file's own imports, so callers reach this helper via a dynamic
// `await import('./lucide-react-mock')` inside the factory rather than a static top-level import:
//
//   vi.mock('lucide-react', async () => {
//     const { createLucideReactMock } = await import('./lucide-react-mock')
//     return createLucideReactMock()
//   })
//
// `extraIconNames` (T2, 0129): a test file that mounts `IconPickerPropertyField` indirectly —
// through `PropertyFieldDispatcher`'s `x-widget` registry or the full properties panel — pulls in
// every sibling widget's own static `lucide-react` imports too (e.g. `TabsOrientationPropertyField`
// imports `LayoutPanelTop`/`LayoutPanelLeft` at module scope, evaluated the moment the module
// graph loads, regardless of whether that widget actually renders in a given test). A bare mock of
// just `CATALOG` throws "no export defined" for those names. Callers pass the exact extra names
// their own render tree needs; defaulting to none keeps every existing caller (this catalog's own
// exact-length assertions in particular) unaffected. Extras are exposed only as namespace exports,
// never folded into the mock's `icons` registry below — which doubles as the regression fixture for
// `IconPickerPropertyField`'s dedup derivation (T4, 0129): a caller can pass an `Icon`-suffixed
// alias (e.g. `'HomeIcon'`) as an extra to simulate the real package's namespace-only aliases,
// which the widget's catalog must not surface.
//
// `iconNames` (T4, 0129): replaces `CATALOG` as the base for both the direct PascalCase namespace
// exports and the `icons` registry, so a test can swap in a synthetic multi-page catalog (e.g. for
// pagination) without touching the shared `CATALOG` constant that T1-T3 and the ten regression
// suites listed in tasks.md depend on unchanged.
export function createLucideReactMock(
  extraIconNames: readonly string[] = [],
  iconNames: readonly string[] = CATALOG,
): Record<string, unknown> {
  const iconExports = Object.fromEntries(iconNames.map((name) => [name, createIconStub(name)]))
  const extraExports = Object.fromEntries(extraIconNames.map((name) => [name, createIconStub(name)]))
  const known: Record<string, unknown> = {
    ...iconExports,
    ...extraExports,
    // Non-icon export (regression target for the catalog's validity filter, T1): a lowercase key,
    // the same naming shape as the real `lucide-react` package's own `createLucideIcon` factory
    // export, which the picker's catalog derivation must exclude even though it is a function.
    createLucideIcon: () => null,
    // Canonical deduplicated registry (T4, 0129), mirroring the real package's own `icons` export:
    // one PascalCase key per icon, built from `iconNames` only — never `extraIconNames`, which
    // stands in for namespace-only aliases the real registry excludes.
    icons: { ...iconExports },
  }

  // Wrapped in a `Proxy` (T2, 0129) rather than returned as a plain object: `IconNode` and
  // `input-layout-node.tsx` do a *dynamic* `(LucideIcons as Record<string, unknown>)[name]` lookup
  // on the whole namespace at runtime for a user-supplied icon name, including names that simply
  // don't exist (degrading to `null`, by design — see `IconNode`'s own doc comment). Against the
  // real `lucide-react` package that lookup just yields `undefined` for an unknown key. Against a
  // bare `vi.mock` object, Vitest's own module Proxy instead throws "no export is defined" for any
  // property this factory didn't return, which fires for every test that renders a node with an
  // unrecognized `props.icon` (several of this feature's own acceptance tests do exactly that). The
  // `has` trap unconditionally answering `true` is what defeats that guard: Vitest checks
  // `prop in target` against whatever this factory returns before deciding whether to throw, so
  // every property "exists" here from its perspective, and resolution falls through to this `get`
  // trap — which mirrors the real package by returning `undefined` for anything outside `known`.
  return new Proxy(known, {
    has: () => true,
    get: (target, prop, receiver) => Reflect.get(target, prop, receiver),
  })
}
