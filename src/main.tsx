import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import './app/index.css'

async function bootstrap() {
  const root = ReactDOM.createRoot(document.getElementById('root')!)

  if (import.meta.env.DEV) {
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
