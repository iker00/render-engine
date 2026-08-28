// Kept in its own module (rather than alongside the `IconNode` component) so
// `icon-node.tsx` only exports a component — Fast Refresh requires component-only modules to
// preserve state across edits.
export function toPascalCase(name: string): string {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}
