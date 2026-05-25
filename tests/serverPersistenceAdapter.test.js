import { describe, expect, it } from 'vitest'
import {
  createFilePersistenceAdapter,
  createMemoryPersistenceAdapter,
  createServerPersistenceAdapter,
  isDeployedMode
} from '../src/server/persistence/serverPersistenceAdapter'
import path from 'path'
import fs from 'fs'

describe('serverPersistenceAdapter', () => {
  it('selects deployed mode based on env flags', () => {
    expect(isDeployedMode({ APP_RUNTIME_MODE: 'deployed' })).toBe(true)
    expect(isDeployedMode({ DEPLOYED_MODE: 'true' })).toBe(true)
    expect(isDeployedMode({ VERCEL: '1' })).toBe(true)
    expect(isDeployedMode({ APP_RUNTIME_MODE: 'local' })).toBe(false)
  })

  it('stores state in memory adapter', async () => {
    const adapter = createMemoryPersistenceAdapter()
    await adapter.save({ progress: { current_lesson: 2 } })
    expect(await adapter.load()).toEqual({ progress: { current_lesson: 2 } })
  })

  it('stores state in file adapter', async () => {
    const filePath = path.resolve('C:/tmp/minna_server_state_test.json')
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      const adapter = createFilePersistenceAdapter({ stateFile: filePath })
      await adapter.save({ progress: { current_lesson: 5 } })
      expect(await adapter.load()).toEqual({ progress: { current_lesson: 5 } })
    } finally {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    }
  })

  it('creates memory-backed adapter in deployed mode', async () => {
    const adapter = createServerPersistenceAdapter({
      env: { APP_RUNTIME_MODE: 'deployed' }
    })

    await adapter.save({ progress: { current_lesson: 6 } })
    expect(await adapter.load()).toEqual({ progress: { current_lesson: 6 } })
  })
})
