import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        proxy: {
            // Solo en desarrollo: el navegador llama a /api/... (mismo origen, sin CORS)
            // y Vite reenvia la peticion al backend real quitando el prefijo /api.
            '/api': {
                //target: 'http://vmwspresaawa1:2802',  //Servidor de API interno 'Privado'
                target: 'https://pre-frontapi.pamplona.es', //Servidor de API externo 'Publico'
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/api/, ''),
            },
        },
    },
    build: {
        cssCodeSplit: false,
        rollupOptions: {
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
