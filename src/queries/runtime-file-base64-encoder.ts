/**
 * Codificación base64 aislada de un `File` del navegador. Este módulo no conoce
 * request-building, resolución de referencias ni estado de formulario: solo
 * transforma un `File` en el shape `{ name, size, mime, data }` requerido por el
 * body de la request, o modela el fallo de lectura como resultado tipado.
 */

const BASE64_CHUNK_SIZE = 0x8000

export interface FileBase64Entry {
  name: string
  size: number
  mime: string
  data: string
}

export type EncodeFileToBase64Result = { status: 'ready'; entry: FileBase64Entry } | { status: 'error' }

export type EncodeFilesToBase64Result = { status: 'ready'; entries: FileBase64Entry[] } | { status: 'error' }

export async function encodeFileToBase64Entry(file: File): Promise<EncodeFileToBase64Result> {
  try {
    const buffer = await readFileAsArrayBuffer(file)

    return {
      status: 'ready',
      entry: {
        name: file.name,
        size: file.size,
        mime: file.type,
        data: encodeBytesToBase64(new Uint8Array(buffer)),
      },
    }
  } catch {
    return { status: 'error' }
  }
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result)
      } else {
        reject(new Error('Unexpected FileReader result type'))
      }
    }

    reader.onerror = () => {
      reject(reader.error ?? new Error('FileReader failed to read the file'))
    }

    reader.readAsArrayBuffer(file)
  })
}

export async function encodeFilesToBase64Entries(files: readonly File[]): Promise<EncodeFilesToBase64Result> {
  const results = await Promise.all(files.map((file) => encodeFileToBase64Entry(file)))

  const entries: FileBase64Entry[] = []
  for (const result of results) {
    if (result.status === 'error') {
      return { status: 'error' }
    }
    entries.push(result.entry)
  }

  return { status: 'ready', entries }
}

function encodeBytesToBase64(bytes: Uint8Array): string {
  if (bytes.length === 0) {
    return ''
  }

  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + BASE64_CHUNK_SIZE)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}
