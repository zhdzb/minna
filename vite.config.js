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
import {
  handleGetAgentProgressReview,
  handleGetLatestAgentStudy,
  handleGetPromptFile,
  handleGetLatestReviewDrill,
  handleGetLatestReview,
  handleGetMistakes,
  handleGetVocabulary,
  handleGetSyllabus,
  handleSaveDailyPacket,
  handleSaveSyllabus,
  handleSaveReviewDrill,
  handleSubmitReviewDrill,
  handleSubmitMistakeAttempt,
  handleSubmitDailyPacket
} from './src/server/agentStudy/routes.js'
import {
  handleGenerateListeningSession,
  handleGetListeningLab,
  handleGetListeningRecording,
  handleRetryListeningSession,
  handleSaveListeningAttempt,
  handleSaveListeningRecording,
  handleSubmitListeningAttempt
} from './src/server/listeningLab/routes.js'

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

const agentStudyRoutePlugin = () => {
  return {
    name: 'agent-study-routes',
    configureServer(server) {
      server.middlewares.use('/api/agent-study/latest', async (req, res) => {
        if (req.method !== 'GET') {
          writeJson(res, 405, { success: false, error: 'Method not allowed' })
          return
        }

        try {
          const result = await handleGetLatestAgentStudy()
          writeJson(res, 200, { success: true, data: result })
        } catch (error) {
          writeJson(res, 400, {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      })

      server.middlewares.use('/api/agent-study/progress', async (req, res) => {
        if (req.method !== 'GET') {
          writeJson(res, 405, { success: false, error: 'Method not allowed' })
          return
        }

        try {
          const result = await handleGetAgentProgressReview()
          writeJson(res, 200, { success: true, data: result })
        } catch (error) {
          writeJson(res, 400, {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      })

      server.middlewares.use('/api/agent-study/daily/save', async (req, res) => {
        if (req.method !== 'POST') {
          writeJson(res, 405, { success: false, error: 'Method not allowed' })
          return
        }

        try {
          const payload = await readJsonBody(req)
          const result = await handleSaveDailyPacket(payload)
          writeJson(res, 200, { success: true, data: result })
        } catch (error) {
          writeJson(res, 400, {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      })

      server.middlewares.use('/api/agent-study/daily/submit', async (req, res) => {
        if (req.method !== 'POST') {
          writeJson(res, 405, { success: false, error: 'Method not allowed' })
          return
        }

        try {
          const payload = await readJsonBody(req)
          const result = await handleSubmitDailyPacket(payload)
          writeJson(res, 200, { success: true, data: result })
        } catch (error) {
          writeJson(res, 400, {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      })

      server.middlewares.use('/api/agent-study/review/latest', async (req, res) => {
        if (req.method !== 'GET') {
          writeJson(res, 405, { success: false, error: 'Method not allowed' })
          return
        }

        try {
          const result = await handleGetLatestReview()
          writeJson(res, 200, { success: true, data: result })
        } catch (error) {
          writeJson(res, 400, {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      })

      server.middlewares.use('/api/agent-study/mistakes/attempt', async (req, res) => {
        if (req.method !== 'POST') {
          writeJson(res, 405, { success: false, error: 'Method not allowed' })
          return
        }

        try {
          const payload = await readJsonBody(req)
          const result = await handleSubmitMistakeAttempt(payload)
          writeJson(res, 200, { success: true, data: result })
        } catch (error) {
          writeJson(res, 400, {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      })

      server.middlewares.use('/api/agent-study/mistakes', async (req, res) => {
        if (req.method !== 'GET') {
          writeJson(res, 405, { success: false, error: 'Method not allowed' })
          return
        }

        try {
          const result = await handleGetMistakes()
          writeJson(res, 200, { success: true, data: result })
        } catch (error) {
          writeJson(res, 400, {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      })

      server.middlewares.use('/api/agent-study/vocabulary', async (req, res) => {
        if (req.method !== 'GET') {
          writeJson(res, 405, { success: false, error: 'Method not allowed' })
          return
        }

        try {
          const result = await handleGetVocabulary()
          writeJson(res, 200, { success: true, data: result })
        } catch (error) {
          writeJson(res, 500, {
            success: false,
            error: error.message || 'Failed to load vocabulary book'
          })
        }
      })

      server.middlewares.use('/api/agent-study/review-drill/latest', async (req, res) => {
        if (req.method !== 'GET') {
          writeJson(res, 405, { success: false, error: 'Method not allowed' })
          return
        }

        try {
          const result = await handleGetLatestReviewDrill()
          writeJson(res, 200, { success: true, data: result })
        } catch (error) {
          writeJson(res, 400, {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      })

      server.middlewares.use('/api/agent-study/review-drill/save', async (req, res) => {
        if (req.method !== 'POST') {
          writeJson(res, 405, { success: false, error: 'Method not allowed' })
          return
        }

        try {
          const payload = await readJsonBody(req)
          const result = await handleSaveReviewDrill(payload)
          writeJson(res, 200, { success: true, data: result })
        } catch (error) {
          writeJson(res, 400, {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      })

      server.middlewares.use('/api/agent-study/review-drill/submit', async (req, res) => {
        if (req.method !== 'POST') {
          writeJson(res, 405, { success: false, error: 'Method not allowed' })
          return
        }

        try {
          const payload = await readJsonBody(req)
          const result = await handleSubmitReviewDrill(payload)
          writeJson(res, 200, { success: true, data: result })
        } catch (error) {
          writeJson(res, 400, {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      })

      server.middlewares.use('/api/agent-study/prompt', async (req, res) => {
        if (req.method !== 'GET') {
          writeJson(res, 405, { success: false, error: 'Method not allowed' })
          return
        }

        try {
          const requestUrl = new URL(req.url || '/', 'http://127.0.0.1')
          const result = await handleGetPromptFile({
            path: requestUrl.searchParams.get('path') || ''
          })
          writeJson(res, 200, { success: true, data: result })
        } catch (error) {
          writeJson(res, 400, {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      })

      server.middlewares.use('/api/agent-study/syllabus', async (req, res) => {
        if (req.method === 'GET') {
          try {
            const result = await handleGetSyllabus()
            writeJson(res, 200, { success: true, data: result })
          } catch (error) {
            writeJson(res, 400, {
              success: false,
              error: error instanceof Error ? error.message : String(error)
            })
          }
          return
        }

        if (req.method === 'POST') {
          try {
            const payload = await readJsonBody(req)
            const result = await handleSaveSyllabus(payload)
            writeJson(res, 200, { success: true, data: result })
          } catch (error) {
            writeJson(res, 400, {
              success: false,
              error: error instanceof Error ? error.message : String(error)
            })
          }
          return
        }

        writeJson(res, 405, { success: false, error: 'Method not allowed' })
      })
    }
  }
}

const listeningLabRoutePlugin = () => {
  return {
    name: 'listening-lab-routes',
    configureServer(server) {
      const useJsonPostRoute = (route, handler) => {
        server.middlewares.use(route, async (req, res) => {
          if (req.method !== 'POST') {
            writeJson(res, 405, { success: false, error: 'Method not allowed' })
            return
          }
          try {
            const payload = await readJsonBody(req)
            const result = await handler(payload)
            writeJson(res, 200, { success: true, data: result })
          } catch (error) {
            writeJson(res, 400, {
              success: false,
              error: error instanceof Error ? error.message : String(error)
            })
          }
        })
      }

      useJsonPostRoute('/api/listening-lab/generate', handleGenerateListeningSession)
      useJsonPostRoute('/api/listening-lab/attempt/save', handleSaveListeningAttempt)
      useJsonPostRoute('/api/listening-lab/attempt/submit', handleSubmitListeningAttempt)
      useJsonPostRoute('/api/listening-lab/retry', handleRetryListeningSession)

      server.middlewares.use('/api/listening-lab/recording', async (req, res) => {
        if (req.method === 'POST') {
          try {
            const payload = await readJsonBody(req)
            const result = await handleSaveListeningRecording(payload)
            writeJson(res, 200, { success: true, data: result })
          } catch (error) {
            writeJson(res, 400, {
              success: false,
              error: error instanceof Error ? error.message : String(error)
            })
          }
          return
        }

        if (req.method === 'GET') {
          try {
            const requestUrl = new URL(req.url || '/', 'http://127.0.0.1')
            const recording = await handleGetListeningRecording({
              path: requestUrl.searchParams.get('path') || ''
            })
            res.statusCode = 200
            res.setHeader('Content-Type', recording.mimeType)
            fs.createReadStream(recording.absolutePath).pipe(res)
          } catch (error) {
            writeJson(res, 404, {
              success: false,
              error: error instanceof Error ? error.message : String(error)
            })
          }
          return
        }

        writeJson(res, 405, { success: false, error: 'Method not allowed' })
      })

      server.middlewares.use('/api/listening-lab', async (req, res) => {
        if (req.method !== 'GET') {
          writeJson(res, 405, { success: false, error: 'Method not allowed' })
          return
        }
        try {
          const result = await handleGetListeningLab()
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
    plugins: [
      vue(),
      saveLocalDataPlugin(),
      llmProxyPlugin(),
      aiRoutePlugin(runtimeEnv),
      stateRoutePlugin(runtimeEnv),
      agentStudyRoutePlugin(),
      listeningLabRoutePlugin()
    ],
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
