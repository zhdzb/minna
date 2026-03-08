import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import fs from 'fs'

// Custom Vite plugin to handle local data.json saving automatically
const saveLocalDataPlugin = () => {
  return {
    name: 'save-local-data',
    configureServer(server) {
      server.middlewares.use('/api/save-progress', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              // Write directly to the project root data.json
              fs.writeFileSync(path.resolve(__dirname, 'data.json'), body, 'utf8');
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
        }
      });
    }
  }
}

export default defineConfig({
  plugins: [vue(), saveLocalDataPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 8080
  },
  test: {
    globals: true,
    environment: 'happy-dom'
  }
})
