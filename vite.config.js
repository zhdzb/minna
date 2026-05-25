import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import fs from 'fs'
import { handleDailyPlanEnhancement } from './src/server/routes/dailyPlanRoute.js'
import { handleExerciseGeneration } from './src/server/routes/exerciseGenerationRoute.js'
import { handleExerciseEvaluation } from './src/server/routes/exerciseEvaluationRoute.js'
import { handleWeeklySummary } from './src/server/routes/weeklySummaryRoute.js'
import { createServerPersistenceAdapter } from './src/server/persistence/serverPersistenceAdapter.js'
import {
  handleLoadStudyState,
  handlePatchStudyState,
  handleSaveStudyState
} from './src/server/routes/studyStateRoute.js'

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

const readJsonBody = (req) =>
  new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })

const writeJson = (res, statusCode, payload) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

const aiRoutePlugin = (runtimeEnv) => {
  return {
    name: 'ai-routes',
    configureServer(server) {
      server.middlewares.use('/api/ai/daily-plan', async (req, res) => {
        if (req.method !== 'POST') {
          writeJson(res, 405, { success: false, error: 'Method not allowed' })
          return
        }

        try {
          const payload = await readJsonBody(req)
          const result = await handleDailyPlanEnhancement(payload, {
            providerOptions: { env: runtimeEnv }
          })

          writeJson(res, 200, { success: true, data: result })
        } catch (error) {
          writeJson(res, 400, {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      })

      server.middlewares.use('/api/ai/exercise-generate', async (req, res) => {
        if (req.method !== 'POST') {
          writeJson(res, 405, { success: false, error: 'Method not allowed' })
          return
        }

        try {
          const payload = await readJsonBody(req)
          const result = await handleExerciseGeneration(payload, {
            providerOptions: { env: runtimeEnv }
          })

          writeJson(res, 200, { success: true, data: result })
        } catch (error) {
          writeJson(res, 400, {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      })

      server.middlewares.use('/api/ai/exercise-evaluate', async (req, res) => {
        if (req.method !== 'POST') {
          writeJson(res, 405, { success: false, error: 'Method not allowed' })
          return
        }

        try {
          const payload = await readJsonBody(req)
          const result = await handleExerciseEvaluation(payload, {
            providerOptions: { env: runtimeEnv }
          })

          writeJson(res, 200, { success: true, data: result })
        } catch (error) {
          writeJson(res, 400, {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      })

      server.middlewares.use('/api/ai/weekly-summary', async (req, res) => {
        if (req.method !== 'POST') {
          writeJson(res, 405, { success: false, error: 'Method not allowed' })
          return
        }

        try {
          const payload = await readJsonBody(req)
          const result = await handleWeeklySummary(payload, {
            providerOptions: { env: runtimeEnv }
          })

          writeJson(res, 200, { success: true, data: result })
        } catch (error) {
          writeJson(res, 400, {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      })

    }
  }
}

const stateRoutePlugin = (runtimeEnv) => {
  const adapter = createServerPersistenceAdapter({ env: runtimeEnv })

  return {
    name: 'state-routes',
    configureServer(server) {
      server.middlewares.use('/api/state/load', async (req, res) => {
        if (req.method !== 'GET') {
          writeJson(res, 405, { success: false, error: 'Method not allowed' })
          return
        }

        try {
          const result = await handleLoadStudyState({ adapter })
          writeJson(res, 200, { success: true, data: result })
        } catch (error) {
          writeJson(res, 400, {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      })

      server.middlewares.use('/api/state/save', async (req, res) => {
        if (req.method !== 'POST') {
          writeJson(res, 405, { success: false, error: 'Method not allowed' })
          return
        }

        try {
          const payload = await readJsonBody(req)
          const result = await handleSaveStudyState(payload, { adapter })
          writeJson(res, 200, { success: true, data: result })
        } catch (error) {
          writeJson(res, 400, {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      })

      server.middlewares.use('/api/state/patch', async (req, res) => {
        if (req.method !== 'POST') {
          writeJson(res, 405, { success: false, error: 'Method not allowed' })
          return
        }

        try {
          const payload = await readJsonBody(req)
          const result = await handlePatchStudyState(payload, { adapter })
          writeJson(res, 200, { success: true, data: result })
        } catch (error) {
          writeJson(res, 400, {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      })
    }
  }
}

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), '')
  const runtimeEnv = { ...process.env, ...fileEnv }

  return {
    plugins: [vue(), saveLocalDataPlugin(), llmProxyPlugin(), aiRoutePlugin(runtimeEnv), stateRoutePlugin(runtimeEnv)],
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
  }
})
