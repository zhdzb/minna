import fs from 'fs'
import path from 'path'
import { createServer } from 'vite'

const readOption = (name) => {
  const prefix = `--${name}=`
  const argument = process.argv.slice(2).find((item) => item.startsWith(prefix))
  return argument ? argument.slice(prefix.length) : null
}

const cwd = process.cwd()
const current = JSON.parse(
  fs.readFileSync(path.join(cwd, 'study', 'state', 'current.json'), 'utf8')
)
const today = new Date().toISOString().slice(0, 10)
const recommendedDate = String(current.next_recommendation?.date || '')
const defaultDate = recommendedDate >= today ? recommendedDate : today
const vite = await createServer({
  configFile: false,
  appType: 'custom',
  server: { middlewareMode: true },
  optimizeDeps: {
    noDiscovery: true,
    include: []
  }
})

try {
  const { createAgentStudyVocabularyStore, VOCABULARY_SELECTION_PATH } =
    await vite.ssrLoadModule('/src/server/agentStudy/vocabularyStore.js')
  const { createAgentStudyContextWriter } =
    await vite.ssrLoadModule('/src/server/agentStudy/contextWriter.js')
  const store = createAgentStudyVocabularyStore({
    studyRoot: path.join(cwd, 'study')
  })
  const selection = store.selectForPacket({
    lesson: Number(readOption('lesson') || current.current_lesson || 1),
    date: readOption('date') || defaultDate,
    count: Number(readOption('count') || 18)
  })
  createAgentStudyContextWriter({
    studyRoot: path.join(cwd, 'study')
  }).writeNextAgentContext()

  process.stdout.write(
    JSON.stringify(
      {
        path: VOCABULARY_SELECTION_PATH,
        next_context: 'study/context/next-agent-context.md',
        count: selection.count,
        words: selection.items.map((item) => ({
          id: item.id,
          word: item.word,
          kana: item.kana,
          meaning: item.meaning,
          reason: item.selection_reason
        }))
      },
      null,
      2
    ) + '\n'
  )
} finally {
  await vite.close()
}
