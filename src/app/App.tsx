import devConfig from '../dev/config.json'
import { AppShell } from './app-shell'
import { readRuntimeConfig, type RuntimeConfig } from './bootstrap/read-runtime-config'

interface AppProps {
  devConfigOverride?: RuntimeConfig
  isDevelopment?: boolean
  rootElement?: HTMLElement | null
}

export function App({
  devConfigOverride = devConfig,
  isDevelopment = import.meta.env.DEV,
  rootElement = document.getElementById('root'),
}: AppProps) {
  const runtimeConfig = readRuntimeConfig({
    devConfig: devConfigOverride,
    isDevelopment,
    rootElement,
  })

  return <AppShell runtimeConfig={runtimeConfig} />
}
