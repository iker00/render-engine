import { beforeEach, expect, it, vi } from 'vitest'

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

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>'
  renderMock.mockClear()
  createRootMock.mockClear()
  vi.resetModules()
})

it('boots the React app into the root element', async () => {
  await import('../main')

  expect(createRootMock).toHaveBeenCalledWith(document.getElementById('root'))
  expect(renderMock).toHaveBeenCalledTimes(1)
})
