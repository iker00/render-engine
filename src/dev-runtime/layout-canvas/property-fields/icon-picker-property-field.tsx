import * as LucideIcons from 'lucide-react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { IconNode } from '../../../runtime/nodes/icon-node'
import { PropertyFieldRow } from './property-field-row'

const GRID_COLUMNS = 4

// Number of icon cells rendered per grid page (T4, 0129). The deduplicated catalog below (1713
// icons as of this writing) would otherwise mount thousands of DOM cells at once. Exported so
// tests can reference it instead of hardcoding the value.
export const ICON_PICKER_PAGE_SIZE = 60

// Catalog of valid Lucide icon names, derived once at module load (not per render) from
// `lucide-react`'s own canonical `icons` registry rather than its full namespace. The namespace
// additionally exposes an `Icon`-suffixed alias for every icon (e.g. both `Home` and `HomeIcon`
// resolve to the same component) plus non-icon helpers (`createLucideIcon`, `useLucideContext`);
// `icons` is the package's own deduplicated registry — one PascalCase key per icon, no aliases —
// so reading it directly is both correct and simpler than re-deriving that dedup logic here.
const ICON_CATALOG: readonly string[] = Object.keys(LucideIcons.icons)

interface IconPickerPropertyFieldProps {
  label: string
  value: unknown
  onChange: (value: unknown) => void
}

/**
 * Presentational Lucide icon picker shared by the `icon` widget (T2) and the Shell editors (T3):
 * a search input plus a grid of icon/name cells, with a selection highlight, an explicit clear
 * control and bidirectional keyboard navigation. Mounted directly by both consumers with the
 * standard `{ label, value, onChange }` widget shape — it owns no knowledge of `x-widget` or
 * Shell schemas.
 */
export function IconPickerPropertyField({ label, value, onChange }: IconPickerPropertyFieldProps) {
  const searchInputId = useId()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  // Disclosure state (T5, 0129): the grid is unmounted by default and only rendered while `open`
  // is `true`, following the same self-contained pattern as `SidebarRailFlyout` (0123) and
  // `MenuItemDropdown` (0122) — local `open` state, a `mousedown` listener on `document` for
  // click-outside, `Escape` closes and refocuses the trigger. Unlike those two, this panel is not
  // `position: fixed` and needs no `getBoundingClientRect()` measurement: it stays in normal flow.
  const [open, setOpen] = useState(false)
  const cellRefs = useRef<Array<HTMLDivElement | null>>([])
  const containerRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  // Set only by the "grid closed, ArrowDown" branch of `handleSearchKeyDown` so the open-effect
  // below can tell that opening apart from a plain focus/click on the input, which must NOT move
  // focus into the grid.
  const focusFirstCellOnOpenRef = useRef(false)
  // Closing the grid via selection or `Escape` programmatically refocuses the search input
  // (`refocusSearchInput` below). That `.focus()` call fires a genuine native `focus` event, which
  // would otherwise re-enter `handleSearchFocus` and immediately reopen the grid it just closed.
  // Set right before that call and consumed by `handleSearchFocus` to skip exactly that one event.
  const suppressNextSearchFocusOpenRef = useRef(false)

  function refocusSearchInput() {
    suppressNextSearchFocusOpenRef.current = true
    searchInputRef.current?.focus()
  }

  // Non-string `value` (number, object, boolean...) degrades to "no selection" visually: no cell
  // highlighted, no clear button, no "unrecognized value" note. The component never rewrites or
  // clears it on the caller's behalf — it simply has nothing string-shaped to render.
  const currentValue = typeof value === 'string' ? value : undefined
  const isRecognizedValue = currentValue !== undefined && ICON_CATALOG.includes(currentValue)
  const isUnrecognizedValue = currentValue !== undefined && currentValue !== '' && !isRecognizedValue

  const normalizedQuery = query.toLowerCase().trim()
  const visibleCatalog =
    normalizedQuery === '' ? ICON_CATALOG : ICON_CATALOG.filter((name) => name.toLowerCase().includes(normalizedQuery))

  const totalPages = Math.max(1, Math.ceil(visibleCatalog.length / ICON_PICKER_PAGE_SIZE))
  const pageCatalog = visibleCatalog.slice(page * ICON_PICKER_PAGE_SIZE, (page + 1) * ICON_PICKER_PAGE_SIZE)

  const rows: string[][] = []
  for (let index = 0; index < pageCatalog.length; index += GRID_COLUMNS) {
    rows.push(pageCatalog.slice(index, index + GRID_COLUMNS))
  }

  // Roving tabindex: the selected cell (if visible on the current page) is the sole `Tab` stop,
  // otherwise the first cell is, matching `SegmentedTogglePropertyField`'s pattern (0128) so `Tab`
  // enters/leaves the grid in one step instead of visiting every cell.
  const tabbableIndex = currentValue !== undefined ? Math.max(pageCatalog.indexOf(currentValue), 0) : 0

  // Selecting a cell always closes the grid and returns focus to the search input, whether or not
  // it changes `value` — reselecting the already-current value (idempotent, no `onChange`) still
  // closes, because the user's action of choosing a cell is what closes it, not the resulting
  // change (T5, decision 2).
  function selectIcon(name: string) {
    if (name !== currentValue) {
      onChange(name)
    }
    setOpen(false)
    refocusSearchInput()
  }

  function handleQueryChange(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value)
    // A new query always starts at its own first page of results, rather than keeping whatever
    // page the previous (unrelated) result set was showing.
    setPage(0)
  }

  function handleSearchFocus() {
    if (suppressNextSearchFocusOpenRef.current) {
      suppressNextSearchFocusOpenRef.current = false
      return
    }
    setOpen(true)
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'ArrowDown' || pageCatalog.length === 0) return
    event.preventDefault()
    if (!open) {
      // Opening from a closed grid: defer the focus move to the effect below, once the grid has
      // actually mounted and `cellRefs` point at real nodes.
      focusFirstCellOnOpenRef.current = true
      setOpen(true)
      return
    }
    cellRefs.current[0]?.focus()
  }

  // Escape closes the grid and returns focus to the search input regardless of whether the
  // currently focused element is the input itself or a cell — attached to the root container so
  // it catches the bubbled keydown from either (T5, decision 3). Never invokes `onChange`.
  function handleContainerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape') return
    event.preventDefault()
    setOpen(false)
    refocusSearchInput()
  }

  // Moves focus to the first visible cell once the grid mounts, but only when it was opened via
  // `ArrowDown` from the search input (flagged above) — a plain focus/click open must leave focus
  // in the input (T5, decision 1 vs. decision 6).
  useEffect(() => {
    if (!open || !focusFirstCellOnOpenRef.current) return
    focusFirstCellOnOpenRef.current = false
    cellRefs.current[0]?.focus()
  }, [open])

  // Click outside the widget's root container closes the grid without moving focus anywhere
  // (unlike Escape/selection, which refocus the input) — same `mousedown`-on-`document` pattern as
  // `SidebarRailFlyout` (T5, decision 4).
  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [open])

  // Grid navigation clamps at every edge of the visible page (no wraparound, unlike the
  // radiogroup pattern of `SegmentedTogglePropertyField`, and no auto-advance to the next/previous
  // page): `ArrowLeft`/`ArrowRight` stay within the current row, `ArrowUp`/`ArrowDown` stay within
  // the column across rows. Changing page is a separate, explicit action on the
  // Anterior/Siguiente controls below.
  function handleCellKeyDown(event: KeyboardEvent<HTMLDivElement>, index: number) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectIcon(pageCatalog[index])
      return
    }

    const col = index % GRID_COLUMNS
    const totalCount = pageCatalog.length
    let nextIndex: number | undefined

    if (event.key === 'ArrowRight') {
      const isLastInRow = col === GRID_COLUMNS - 1 || index === totalCount - 1
      if (!isLastInRow) nextIndex = index + 1
    } else if (event.key === 'ArrowLeft') {
      if (col !== 0) nextIndex = index - 1
    } else if (event.key === 'ArrowDown') {
      const candidate = index + GRID_COLUMNS
      if (candidate < totalCount) nextIndex = candidate
    } else if (event.key === 'ArrowUp') {
      const candidate = index - GRID_COLUMNS
      if (candidate >= 0) nextIndex = candidate
    } else {
      return
    }

    if (nextIndex !== undefined) {
      event.preventDefault()
      cellRefs.current[nextIndex]?.focus()
    }
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-2" onKeyDown={handleContainerKeyDown}>
      {isUnrecognizedValue && (
        <p className="text-xs text-gray-500">
          Valor actual: <span className="font-medium text-gray-700">{currentValue}</span>
        </p>
      )}
      <PropertyFieldRow htmlFor={searchInputId} label={label}>
        <div className="flex items-center gap-2">
          <input
            ref={searchInputRef}
            id={searchInputId}
            type="text"
            aria-label="Buscar icono"
            aria-haspopup="grid"
            aria-expanded={open}
            placeholder="Buscar icono"
            value={query}
            onChange={handleQueryChange}
            onFocus={handleSearchFocus}
            onKeyDown={handleSearchKeyDown}
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
          />
          {isRecognizedValue && (
            // Preview chip (T5, decision 7): with the grid hidden by default, this is the only
            // signal of the currently recognized value — visible independent of `open`, so it
            // survives closing the grid after a selection.
            <span className="flex shrink-0 items-center gap-1 text-xs text-gray-600">
              <IconNode name={currentValue} className="h-4 w-4" />
              {currentValue}
            </span>
          )}
          {currentValue !== undefined && currentValue !== '' && (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="shrink-0 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
            >
              Quitar icono
            </button>
          )}
        </div>
      </PropertyFieldRow>
      {open && (
        <>
          <div
            role="grid"
            aria-label={label}
            className="grid max-h-56 grid-cols-4 gap-1 overflow-y-auto rounded border border-gray-200 p-1"
          >
            {rows.map((row, rowIndex) => (
              <div key={rowIndex} role="row" className="contents">
                {row.map((name, columnIndex) => {
                  const index = rowIndex * GRID_COLUMNS + columnIndex
                  const isSelected = isRecognizedValue && name === currentValue

                  return (
                    <div
                      key={name}
                      ref={(node) => {
                        cellRefs.current[index] = node
                      }}
                      role="gridcell"
                      aria-selected={isSelected}
                      tabIndex={index === tabbableIndex ? 0 : -1}
                      onClick={() => selectIcon(name)}
                      onKeyDown={(event) => handleCellKeyDown(event, index)}
                      className={
                        isSelected
                          ? 'flex flex-col items-center gap-0.5 rounded border-2 border-gray-800 bg-gray-100 p-1 text-[10px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500'
                          : 'flex flex-col items-center gap-0.5 rounded border border-gray-200 p-1 text-[10px] text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500'
                      }
                    >
                      <IconNode name={name} className="h-4 w-4" />
                      <span className="w-full truncate text-center">{name}</span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 text-xs text-gray-600">
              <button
                type="button"
                onClick={() => setPage((current) => current - 1)}
                disabled={page === 0}
                className="shrink-0 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>
              <span>
                Página {page + 1} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                disabled={page === totalPages - 1}
                className="shrink-0 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
