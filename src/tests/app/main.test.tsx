import { beforeEach, expect, it, vi, describe } from 'vitest'

const renderMock = vi.fn()
const createRootMock = vi.fn(() => ({
  render: renderMock,
}))

vi.mock('react-dom/client', () => ({
  default: {
    createRoot: createRootMock,
  },
  createRoot: createRootMock,
}))

// Mock DevRuntime so Monaco and other heavy deps are not loaded in tests.
// When import.meta.env.DEV is true (the Vitest test environment default),
// main.tsx will dynamically import this module.
vi.mock('../../dev-runtime/dev-runtime', () => ({
  DevRuntime: () => null,
}))

async function flushMicrotasks() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>'
  renderMock.mockClear()
  createRootMock.mockClear()
  vi.resetModules()
})

describe('main (DEV mode — default Vitest environment)', () => {
  it('creates the root from the #root element', async () => {
    await import('../../main')
    await flushMicrotasks()
    expect(createRootMock).toHaveBeenCalledWith(document.getElementById('root'))
  })

  it('renders the app into the root element exactly once', async () => {
    await import('../../main')
    await flushMicrotasks()
    expect(renderMock).toHaveBeenCalledTimes(1)
  })

  it('mounts DevRuntime (not App) when import.meta.env.DEV is true', async () => {
    const { DevRuntime } = await import('../../dev-runtime/dev-runtime')
    await import('../../main')
    await flushMicrotasks()

    expect(renderMock).toHaveBeenCalledTimes(1)

    // The rendered element wraps DevRuntime in StrictMode
    const renderedElement = renderMock.mock.calls[0][0]
    const innerType = renderedElement.props?.children?.type
    expect(innerType).toBe(DevRuntime)
  })
})

// Note: Testing import.meta.env.DEV = false (production path) is not directly possible
// in Vitest because import.meta.env.DEV is a compile-time constant set to true in test mode.
// The production path (App mounted, DevRuntime not imported) is covered by the bundle
// verification gate in T9 (dev-runtime-bundle.test.ts), which builds with vite and confirms
// that monaco-editor, DevRuntime, and runtimeConfigRootSchema are absent from dist/assets/.
