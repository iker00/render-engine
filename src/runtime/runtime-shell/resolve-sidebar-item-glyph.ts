// Shared fallback glyph for a `sidebarItem` that declares no `icon` (design decisión 8): the
// first character of its already resolved `label`, uppercased. Callers pass the label through
// `resolveRuntimeTextReference` first so the glyph always matches the same text exposed as the
// accessible name (`aria-label`/`title` in rail mode, visible text in `SidebarRailFlyout`).
// Whether to use this fallback at all (vs. rendering the item's `icon`) is the call site's
// decision — see `renderSidebarItemGlyphOrIcon` in `app-shell-sidebar.tsx`.
export function resolveSidebarItemGlyph(resolvedLabel: string): string {
  return resolvedLabel.trim().charAt(0).toUpperCase()
}
