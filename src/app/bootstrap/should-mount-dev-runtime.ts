export function shouldMountDevRuntime(
  rootElement: HTMLElement | null,
  isDev: boolean,
): boolean {
  if (rootElement === null) {
    return false
  }
  if (isDev) {
    return true
  }
  return rootElement.hasAttribute('data-enable-dev-mode')
}
