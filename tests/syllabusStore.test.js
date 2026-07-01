import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { createSyllabusStore, validateSyllabusDocument } from '../src/server/agentStudy/syllabusStore.js'

const tempDirs = []

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('syllabusStore', () => {
  it('validates and round-trips syllabus documents', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'syllabus-store-'))
    tempDirs.push(tempRoot)
    const syllabusPath = path.join(tempRoot, 'syllabus.json')
    const initial = {
      question_types: [
        {
          id: 'q_fill',
          name: '填空',
          desc: '基础填空',
          difficulty_range: [1, 3]
        }
      ],
      lessons: [
        {
          id: 1,
          title: '第1课',
          theme: '自我介绍',
          grammar_points: ['N1 は N2 です'],
          sentence_patterns: ['はじめまして。'],
          hidden_knowledge: ['助词は读作 wa。'],
          core_vocabulary: [
            { word: 'わたし', kana: 'わたし', meaning: '我', usage: '自我介绍' }
          ],
          enabled_question_types: ['q_fill']
        }
      ]
    }
    fs.writeFileSync(syllabusPath, JSON.stringify(initial, null, 2) + '\n', 'utf8')

    const store = createSyllabusStore({ syllabusPath })
    expect(store.loadSyllabus()).toEqual(initial)

    const next = validateSyllabusDocument({
      ...initial,
      lessons: [
        {
          ...initial.lessons[0],
          theme: '身份介绍'
        }
      ]
    })

    expect(store.saveSyllabus(next)).toEqual(next)
    expect(JSON.parse(fs.readFileSync(syllabusPath, 'utf8'))).toEqual(next)
  })
})
