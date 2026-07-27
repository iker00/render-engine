import { useId } from 'react'
import { HelpCircle } from 'lucide-react'

interface FieldTooltipProps {
  text: string | undefined
}

export function FieldTooltip({ text }: FieldTooltipProps) {
  const tooltipId = useId()

  if (!text) {
    return null
  }

  return (
    <span className="relative inline-flex items-center ml-1 group">
      <span
        tabIndex={0}
        aria-label="Help"
        aria-describedby={tooltipId}
      >
        <HelpCircle
          size={16}
          className="text-app-text/50 cursor-help"
          aria-hidden="true"
        />
      </span>
      <span
        id={tooltipId}
        role="tooltip"
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs rounded bg-gray-900 text-white w-max max-w-xs break-words whitespace-normal pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-10"
      >
        {text}
      </span>
    </span>
  )
}
