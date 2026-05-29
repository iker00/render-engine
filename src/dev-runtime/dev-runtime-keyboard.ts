import { useEffect } from 'react'

interface UseDevRuntimeKeyboardOptions {
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}

export function useDevRuntimeKeyboard({ isOpen, onToggle, onClose }: UseDevRuntimeKeyboardOptions) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isToggleShortcut =
        (event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'J'

      if (isToggleShortcut) {
        event.preventDefault()
        onToggle()
        return
      }

      if (event.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onToggle, onClose])
}
