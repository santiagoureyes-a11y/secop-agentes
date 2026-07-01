import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Puerto fijo distinto al 5173 para no chocar con el otro proyecto del usuario
  // (la app de mascotas) que normalmente lo ocupa.
  server: { port: 5180, strictPort: true },
})
