import devConfig from '../dev/config.json'
import { AppShell } from './app-shell'
import { readRuntimeConfig, type RuntimeConfig } from './bootstrap/read-runtime-config'

const defaultDevConfig = devConfig as RuntimeConfig

interface AppProps {
  devConfigOverride?: RuntimeConfig
  isDevelopment?: boolean
  rootElement?: HTMLElement | null
}

export function App({
  devConfigOverride = defaultDevConfig,
  isDevelopment = import.meta.env.DEV || false,
  rootElement = document.getElementById('root'),
}: AppProps) {
  const runtimeConfig = readRuntimeConfig({
    devConfig: devConfigOverride,
    isDevelopment,
    rootElement,
  })

  return <AppShell isDevelopment={isDevelopment} runtimeConfig={runtimeConfig} />
}
