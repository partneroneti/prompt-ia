import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Expose a configurable backend target so the dev proxy works in both local and containerized setups.
export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_TARGET || 'http://localhost:3001'

  return defineConfig({
    plugins: [react()],
    server: {
      port: 5174,
      proxy: {
        '/api': apiTarget
      }
    }
  })
}
