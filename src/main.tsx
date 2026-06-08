import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import './app/index.css'
import { shouldMountDevRuntime } from './app/bootstrap/should-mount-dev-runtime'

async function bootstrap() {
  const rootElement = document.getElementById('layout-renderer')!
  const root = ReactDOM.createRoot(rootElement)

  if (shouldMountDevRuntime(rootElement, import.meta.env.DEV)) {
    const { DevRuntime } = await import('./dev-runtime/dev-runtime')
    root.render(
      <React.StrictMode>
        <DevRuntime />
      </React.StrictMode>,
    )
  } else {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
  }
}

void bootstrap()
