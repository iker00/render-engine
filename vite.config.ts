import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    base: './',
    plugins: [react(), tailwindcss()],
    build: {
        cssCodeSplit: false,
        rollupOptions: {
            // `leaflet` ships only a CommonJS build with no `sideEffects: false` in its
            // package.json, so Rollup's default tree-shaking conservatively assumes it has
            // side effects and keeps it reachable from the entry as soon as any module (even
            // the dead eager-import branch of node-components-map.ts) references it statically.
            // This defeats the map node's lazy code-splitting even though its component is
            // never actually rendered eagerly. Leaflet's only top-level side effect is an
            // optional `window.L` assignment that this app never relies on, so it's safe to
            // mark side-effect free for bundling purposes.
            treeshake: {
                moduleSideEffects: (id) => !/node_modules\/leaflet\//.test(id),
            },
            output: {
                entryFileNames: 'assets/index.js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name?.endsWith('.css')) {
                        return 'index.css'
                    }
                    return '[name]-[hash][extname]'
                }
            }
        }
    }
})
