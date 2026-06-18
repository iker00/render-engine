interface FileManagerErrorListProps {
  errors: string[]
}

export function FileManagerErrorList({ errors }: FileManagerErrorListProps) {
  if (errors.length === 0) {
    return null
  }

  return (
    <ul role="alert" className="mt-2 space-y-1">
      {errors.map((error, index) => (
        <li key={index} className="text-sm text-red-600">
          {error}
        </li>
      ))}
    </ul>
  )
}
