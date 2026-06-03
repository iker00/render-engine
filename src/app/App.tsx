import devConfig from '../dev/config.json'
import devDataValues from '../dev/data-values.json'
import { AppShell } from './app-shell'
import { readRuntimeActiveLanguage } from './bootstrap/read-runtime-active-language'
import { readRuntimeConfig, type RuntimeConfig } from './bootstrap/read-runtime-config'
import { readRuntimeDataValues } from './bootstrap/read-runtime-data-values'

const defaultDevConfig = devConfig as RuntimeConfig
const defaultDevDataValues = devDataValues as Record<string, unknown>

interface AppProps {
  devConfigOverride?: RuntimeConfig
  devDataValuesOverride?: Record<string, unknown>
  isDevelopment?: boolean
  rootElement?: HTMLElement | null
}

export function App({
  devConfigOverride = defaultDevConfig,
  devDataValuesOverride = defaultDevDataValues,
  isDevelopment = import.meta.env.DEV || false,
  rootElement = document.getElementById('root'),
}: AppProps) {
  const runtimeConfig = readRuntimeConfig({
    devConfig: devConfigOverride,
    isDevelopment,
    rootElement,
  })

  const dataValuesResult = readRuntimeDataValues({
    devDataValues: devDataValuesOverride,
    isDevelopment,
    rootElement,
  })

  const activeLanguage = readRuntimeActiveLanguage({ rootElement })

  return (
    <AppShell
      isDevelopment={isDevelopment}
      runtimeConfig={runtimeConfig}
      dataValues={dataValuesResult.status === 'ready' ? dataValuesResult.dataValues : undefined}
      dataValuesError={dataValuesResult.status === 'error' ? dataValuesResult.error : undefined}
      activeLanguage={activeLanguage}
    />
  )
}
