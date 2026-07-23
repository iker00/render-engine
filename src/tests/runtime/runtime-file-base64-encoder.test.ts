import { describe, expect, it, vi } from 'vitest'
import { encodeFileToBase64Entry, encodeFilesToBase64Entries } from '../../queries/runtime-file-base64-encoder'

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

describe('encodeFileToBase64Entry', () => {
  it('produces a ready result with name, size, mime and standard base64 data (no data: prefix)', async () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255, 42])
    const file = new File([bytes], 'a.bin', { type: 'application/octet-stream' })

    const result = await encodeFileToBase64Entry(file)

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('expected ready result')

    expect(result.entry.name).toBe('a.bin')
    expect(result.entry.size).toBe(bytes.length)
    expect(result.entry.mime).toBe('application/octet-stream')
    expect(result.entry.data.startsWith('data:')).toBe(false)
    expect(result.entry.data).toBe(btoa(String.fromCharCode(...bytes)))
  })

  it('round-trips: decoding entry.data from base64 reproduces the original bytes', async () => {
    const bytes = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
    const file = new File([bytes], 'roundtrip.bin', { type: 'application/octet-stream' })

    const result = await encodeFileToBase64Entry(file)
    if (result.status !== 'ready') throw new Error('expected ready result')

    const decoded = base64ToBytes(result.entry.data)
    expect(Array.from(decoded)).toEqual(Array.from(bytes))
  })

  it('preserves an empty mime type when the browser reports none', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'no-type.bin', { type: '' })

    const result = await encodeFileToBase64Entry(file)
    if (result.status !== 'ready') throw new Error('expected ready result')

    expect(result.entry.mime).toBe('')
  })

  it('produces size 0 and data "" for a 0-byte file', async () => {
    const file = new File([], 'empty.bin', { type: 'text/plain' })

    const result = await encodeFileToBase64Entry(file)
    if (result.status !== 'ready') throw new Error('expected ready result')

    expect(result.entry.size).toBe(0)
    expect(result.entry.data).toBe('')
  })

  it('returns a typed error result instead of throwing when the browser read fails', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'broken.bin', { type: 'application/octet-stream' })
    const spy = vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementation(function (this: FileReader) {
      queueMicrotask(() => this.dispatchEvent(new Event('error')))
    })

    await expect(encodeFileToBase64Entry(file)).resolves.toEqual({ status: 'error' })

    spy.mockRestore()
  })
})

describe('encodeFilesToBase64Entries', () => {
  it('encodes multiple files in parallel and returns all entries in order', async () => {
    const fileA = new File([new Uint8Array([1, 2, 3])], 'a.bin', { type: 'application/octet-stream' })
    const fileB = new File([new Uint8Array([4, 5, 6, 7])], 'b.bin', { type: 'text/plain' })

    const result = await encodeFilesToBase64Entries([fileA, fileB])

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('expected ready result')

    expect(result.entries).toHaveLength(2)
    expect(result.entries[0].name).toBe('a.bin')
    expect(result.entries[1].name).toBe('b.bin')
  })

  it('returns a global error result with no partial entries when one file fails to encode', async () => {
    const fileA = new File([new Uint8Array([1, 2, 3])], 'a.bin', { type: 'application/octet-stream' })
    const fileB = new File([new Uint8Array([4, 5, 6])], 'broken.bin', { type: 'application/octet-stream' })

    const original = FileReader.prototype.readAsArrayBuffer
    const spy = vi
      .spyOn(FileReader.prototype, 'readAsArrayBuffer')
      .mockImplementation(function (this: FileReader, blob: Blob) {
        if (blob === fileB) {
          queueMicrotask(() => this.dispatchEvent(new Event('error')))
          return
        }
        original.call(this, blob)
      })

    const result = await encodeFilesToBase64Entries([fileA, fileB])

    expect(result).toEqual({ status: 'error' })

    spy.mockRestore()
  })
})
