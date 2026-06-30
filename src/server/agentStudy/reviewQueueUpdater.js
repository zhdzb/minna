import { validateReviewQueue, validateReviewResult } from '../../utils/agentStudySchema'

const clone = (value) => JSON.parse(JSON.stringify(value))

const REVIEW_RESULTS = ['wrong', 'hard', 'good', 'easy']

const clampEase = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error('Review queue updater expected numeric ease values')
  }

  return Number(Math.min(3, Math.max(1.3, value)).toFixed(2))
}

const formatDateOnly = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) {
    throw new Error('Review queue updater expected an ISO-like timestamp or date string')
  }

  return value.slice(0, 10)
}

const shiftDate = (dateText, days) => {
  const [year, month, day] = dateText.split('-').map(Number)
  const utcDate = new Date(Date.UTC(year, month - 1, day))
  utcDate.setUTCDate(utcDate.getUTCDate() + days)
  return utcDate.toISOString().slice(0, 10)
}

const normalizeReviewQueueUpdate = (update, index) => {
  if (!update || typeof update !== 'object' || Array.isArray(update)) {
    throw new Error('reviewResult.review_queue_updates[' + index + '] must be an object')
  }

  if (typeof update.review_queue_id !== 'string' || update.review_queue_id.trim() === '') {
    throw new Error('reviewResult.review_queue_updates[' + index + '].review_queue_id must be a non-empty string')
  }

  if (typeof update.last_result !== 'string' || !REVIEW_RESULTS.includes(update.last_result.trim())) {
    throw new Error(
      'reviewResult.review_queue_updates[' +
        index +
        '].last_result must be one of: ' +
        REVIEW_RESULTS.join(', ')
    )
  }

  if (!Number.isInteger(update.interval_days) || update.interval_days < 1) {
    throw new Error('reviewResult.review_queue_updates[' + index + '].interval_days must be an integer >= 1')
  }

  if (typeof update.action !== 'string' || update.action.trim() === '') {
    throw new Error('reviewResult.review_queue_updates[' + index + '].action must be a non-empty string')
  }

  return {
    review_queue_id: update.review_queue_id.trim(),
    action: update.action.trim(),
    interval_days: update.interval_days,
    last_result: update.last_result.trim()
  }
}

const computeNextIntervalDays = ({ currentIntervalDays, reviewResult, requestedIntervalDays }) => {
  const current = Math.max(1, currentIntervalDays)

  if (reviewResult === 'wrong') {
    return 1
  }

  if (reviewResult === 'hard') {
    return Math.max(1, Math.floor(current * 1.2))
  }

  if (reviewResult === 'good') {
    return Math.max(requestedIntervalDays, Math.ceil(current * 2))
  }

  if (reviewResult === 'easy') {
    return Math.max(requestedIntervalDays, Math.ceil(current * 3))
  }

  throw new Error('Unsupported review result: ' + reviewResult)
}

const computeNextEase = ({ currentEase, reviewResult }) => {
  if (reviewResult === 'wrong') return clampEase(currentEase - 0.2)
  if (reviewResult === 'hard') return clampEase(currentEase - 0.1)
  if (reviewResult === 'good') return clampEase(currentEase + 0.05)
  if (reviewResult === 'easy') return clampEase(currentEase + 0.15)
  throw new Error('Unsupported review result: ' + reviewResult)
}

const computeNextStatus = ({ reviewResult, nextIntervalDays }) => {
  if (reviewResult === 'wrong') {
    return 'due'
  }

  if (reviewResult === 'hard' && nextIntervalDays <= 1) {
    return 'due'
  }

  return 'scheduled'
}

const updateReviewQueueFromReview = ({
  reviewQueue,
  reviewResult,
  now = () => new Date().toISOString()
}) => {
  const normalizedReviewQueue = validateReviewQueue(clone(reviewQueue))
  const normalizedReviewResult = validateReviewResult(clone(reviewResult))
  const normalizedUpdates = normalizedReviewResult.review_queue_updates.map(normalizeReviewQueueUpdate)
  const timestamp = now()

  if (normalizedUpdates.length === 0) {
    return normalizedReviewQueue
  }

  const nextReviewQueue = clone(normalizedReviewQueue)
  const queueIndex = new Map(nextReviewQueue.items.map((item) => [item.id, item]))
  const today = formatDateOnly(timestamp)
  let didChange = false

  for (const update of normalizedUpdates) {
    const queueItem = queueIndex.get(update.review_queue_id)
    if (!queueItem) {
      throw new Error('Review queue item not found: ' + update.review_queue_id)
    }

    const nextIntervalDays = computeNextIntervalDays({
      currentIntervalDays: queueItem.interval_days,
      reviewResult: update.last_result,
      requestedIntervalDays: update.interval_days
    })
    const nextStatus = computeNextStatus({
      reviewResult: update.last_result,
      nextIntervalDays
    })

    queueItem.interval_days = nextIntervalDays
    queueItem.last_result = update.last_result
    queueItem.status = nextStatus
    queueItem.ease = computeNextEase({
      currentEase: queueItem.ease,
      reviewResult: update.last_result
    })
    queueItem.due_date = nextStatus === 'due' ? today : shiftDate(today, nextIntervalDays)
    didChange = true
  }

  if (!didChange) {
    return normalizedReviewQueue
  }

  nextReviewQueue.revision = normalizedReviewQueue.revision + 1
  nextReviewQueue.updated_at = timestamp
  return validateReviewQueue(nextReviewQueue)
}

export { updateReviewQueueFromReview }
