import vocabularyData from '../../data/vocabulary.json'

const EXPECTED_COLUMNS = [
  'word',
  'kana',
  'meaning',
  'part_of_speech',
  'estimated_level',
  'category'
]

const assertNonEmptyString = (value, label) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(label + ' must be a non-empty string')
  }
  return value.trim()
}

const loadVocabularyCatalog = (data = vocabularyData) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('vocabulary catalog must be an object')
  }
  if (!Array.isArray(data.columns) || data.columns.join('|') !== EXPECTED_COLUMNS.join('|')) {
    throw new Error('vocabulary catalog columns do not match the expected schema')
  }
  if (!Array.isArray(data.items)) {
    throw new Error('vocabulary catalog items must be an array')
  }

  const seenTerms = new Set()
  const items = data.items.map((row, index) => {
    if (!Array.isArray(row) || row.length !== EXPECTED_COLUMNS.length) {
      throw new Error(`vocabulary catalog item ${index + 1} must contain ${EXPECTED_COLUMNS.length} columns`)
    }

    const values = Object.fromEntries(
      EXPECTED_COLUMNS.map((column, columnIndex) => [
        column,
        assertNonEmptyString(row[columnIndex], `vocabulary catalog item ${index + 1}.${column}`)
      ])
    )
    const termKey = values.word + '|' + values.kana
    if (seenTerms.has(termKey)) {
      throw new Error('vocabulary catalog contains a duplicate term: ' + termKey)
    }
    seenTerms.add(termKey)

    return {
      id: `vocab-${String(index + 1).padStart(3, '0')}`,
      priority_rank: index + 1,
      ...values,
      usage: `${values.category}高频词；${values.estimated_level} 预估范围`
    }
  })

  return {
    version: Number(data.version || 1),
    updated_at: assertNonEmptyString(data.updated_at, 'vocabulary catalog.updated_at'),
    ranking: data.ranking,
    items
  }
}

export { EXPECTED_COLUMNS, loadVocabularyCatalog }
