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

const llmProxyPlugin = () => {
  return {
    name: 'llm-proxy',
    configureServer(server) {
      server.middlewares.use('/api/llm', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body || '{}');
            const targetUrl = payload?.url;
            const headers = payload?.headers || {};
            const reqBody = payload?.body || {};

            if (!targetUrl || typeof targetUrl !== 'string') {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'Missing target url' }));
              return;
            }

            const upstream = await fetch(targetUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...headers
              },
              body: JSON.stringify(reqBody)
            });

            const text = await upstream.text();
            res.statusCode = upstream.status;
            const contentType = upstream.headers.get('content-type');
            if (contentType) {
              res.setHeader('Content-Type', contentType);
            }
            res.end(text);
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      });
    }
  }
}

export default defineConfig({
  plugins: [vue(), saveLocalDataPlugin(), llmProxyPlugin()],
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
