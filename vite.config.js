import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages servíruje projektové stránky z /<repo>/, proto base jen pro build.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/fitness-coach-app/' : '/',
}))
