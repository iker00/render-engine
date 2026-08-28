export function getSkeletonBaseClassName(): string {
  return 'bg-neutral-200'
}

export function getSkeletonAnimateClassName(animate: boolean): string {
  return animate ? 'animate-pulse' : ''
}
