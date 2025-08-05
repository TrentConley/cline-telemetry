import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Dev server proxy so the React app can call the Express backend without CORS
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/stats': 'http://localhost:8000'
    }
  }
})
