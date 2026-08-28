import { useEffect, useRef } from 'react'
import { useRuntimeCurrentPage } from './runtime-state/use-runtime-state'

export function RuntimeDocumentTitleEffect() {
  const page = useRuntimeCurrentPage()
  const initialTitleRef = useRef<string | null>(null)

  if (initialTitleRef.current === null) {
    initialTitleRef.current = document.title
  }

  useEffect(() => {
    const initialTitle = initialTitleRef.current ?? ''

    if (page?.title) {
      document.title = `${page.title} | ${initialTitle}`
    } else {
      document.title = initialTitle
    }
  }, [page?.id, page?.title])

  return null
}
