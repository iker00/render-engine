interface DevRuntimeToggleButtonProps {
  onToggle: () => void
}

export function DevRuntimeToggleButton({ onToggle }: DevRuntimeToggleButtonProps) {
  return (
    <button
      data-testid="dev-runtime-toggle"
      onClick={onToggle}
      className="fixed bottom-4 right-4 z-[9999] flex h-10 w-10 items-center justify-center rounded-full bg-gray-800 text-white shadow-lg hover:bg-gray-700"
      aria-label="Toggle dev editor"
    >
      {'{}'}
    </button>
  )
}
