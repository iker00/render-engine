import MonacoEditor from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { getRuntimeConfigJsonSchema } from './dev-runtime-json-schema'

const RUNTIME_CONFIG_SCHEMA_URI = 'inmemory://runtime-config.json'

interface DevRuntimeMonacoEditorProps {
  value: string
  onChange: (value: string) => void
  onMount: (editorInstance: editor.IStandaloneCodeEditor) => void
}

export function DevRuntimeMonacoEditor({ value, onChange, onMount }: DevRuntimeMonacoEditorProps) {
  function handleMount(editorInstance: editor.IStandaloneCodeEditor, monacoInstance: typeof import('monaco-editor')) {
    registerJsonSchema(monacoInstance)
    onMount(editorInstance)
  }

  return (
    <MonacoEditor
      height="100%"
      defaultLanguage="json"
      value={value}
      onChange={(val) => onChange(val ?? '')}
      onMount={handleMount as Parameters<typeof MonacoEditor>[0]['onMount']}
      options={{
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 13,
        wordWrap: 'on',
        formatOnPaste: true,
      }}
    />
  )
}

function registerJsonSchema(monacoInstance: unknown) {
  try {
    const monaco = monacoInstance as {
      languages?: {
        json?: {
          jsonDefaults?: {
            setDiagnosticsOptions: (opts: unknown) => void
          }
        }
      }
    }

    monaco.languages?.json?.jsonDefaults?.setDiagnosticsOptions({
      validate: true,
      enableSchemaRequest: false,
      schemas: [
        {
          uri: RUNTIME_CONFIG_SCHEMA_URI,
          fileMatch: ['*'],
          schema: getRuntimeConfigJsonSchema(),
        },
      ],
    })
  } catch {
    // Degrade silently if Monaco JSON API is unavailable in this environment
  }
}
