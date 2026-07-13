const PHASES = {
  NEEDS_PACKET: 'needs_packet',
  STUDYING: 'studying',
  AWAITING_REVIEW: 'awaiting_review',
  REVIEW_DUE: 'review_due',
  READY_FOR_NEXT: 'ready_for_next'
}

const PHASE_DETAILS = {
  [PHASES.NEEDS_PACKET]: {
    step: 1,
    label: '准备学习包',
    description: '当前没有学习包，先生成今天的学习内容。',
    action: '生成学习包'
  },
  [PHASES.STUDYING]: {
    step: 2,
    label: '学习与作答',
    description: '阅读资料并完成当前学习包，答案会保存在草稿中。',
    action: '继续作答'
  },
  [PHASES.AWAITING_REVIEW]: {
    step: 3,
    label: '等待批改',
    description: '学习包已经提交，下一步是完成结构化批改。',
    action: '复制批改提示词'
  },
  [PHASES.REVIEW_DUE]: {
    step: 4,
    label: '复习巩固',
    description: '当前学习包已批改，并且有到期错题需要巩固。',
    action: '开始复习'
  },
  [PHASES.READY_FOR_NEXT]: {
    step: 5,
    label: '本轮完成',
    description: '当前学习包已完成，可以准备下一份学习包。',
    action: '生成下一学习包'
  }
}

const matchesDaily = (dailyPacket, reviewResult) =>
  Boolean(dailyPacket?.id && reviewResult?.daily_id && dailyPacket.id === reviewResult.daily_id)

const deriveAgentStudyPhase = ({ dailyPacket = null, reviewResult = null, reviewQueue = null } = {}) => {
  if (!dailyPacket) return PHASES.NEEDS_PACKET

  const status = String(dailyPacket.status || '').trim()
  if (['planned', 'learning', 'answering', 'draft'].includes(status)) {
    return PHASES.STUDYING
  }

  if (status === 'submitted' || dailyPacket?.correction?.status === 'pending') {
    return PHASES.AWAITING_REVIEW
  }

  if (status === 'reviewed' && matchesDaily(dailyPacket, reviewResult)) {
    const hasDueReview = (reviewQueue?.items || []).some((item) => item.status === 'due')
    return hasDueReview ? PHASES.REVIEW_DUE : PHASES.READY_FOR_NEXT
  }

  return status === 'reviewed' ? PHASES.READY_FOR_NEXT : PHASES.STUDYING
}

const getAgentStudyPhaseDetails = (phase) => PHASE_DETAILS[phase] || PHASE_DETAILS[PHASES.STUDYING]

export { PHASES, deriveAgentStudyPhase, getAgentStudyPhaseDetails, matchesDaily }
