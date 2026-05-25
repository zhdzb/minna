const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value)

const validateBackupPayloadShape = (payload) => {
  if (!isPlainObject(payload)) {
    throw new Error('备份文件必须是 JSON 对象。')
  }

  if (!isPlainObject(payload.progress)) {
    throw new Error('备份缺少 progress 字段。')
  }

  if (!Array.isArray(payload.mistakes_book)) {
    throw new Error('备份缺少 mistakes_book 数组。')
  }

  if (!isPlainObject(payload.daily_plan)) {
    throw new Error('备份缺少 daily_plan 字段。')
  }

  if (!isPlainObject(payload.lesson_mastery)) {
    throw new Error('备份缺少 lesson_mastery 字段。')
  }

  if (!isPlainObject(payload.pattern_mastery)) {
    throw new Error('备份缺少 pattern_mastery 字段。')
  }

  if (!Array.isArray(payload.study_backups)) {
    throw new Error('备份缺少 study_backups 数组。')
  }

  return payload
}

export { validateBackupPayloadShape }
