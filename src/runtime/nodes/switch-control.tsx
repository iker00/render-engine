interface SwitchControlProps {
  checked: boolean
  onClick: () => void
  trackClassName: string
  knobClassName: string
  ariaLabel?: string
  ariaDescribedBy?: string
}

export function SwitchControl({
  checked,
  onClick,
  trackClassName,
  knobClassName,
  ariaLabel,
  ariaDescribedBy,
}: SwitchControlProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      onClick={onClick}
      className={trackClassName}
    >
      <span className={knobClassName} />
    </button>
  )
}
