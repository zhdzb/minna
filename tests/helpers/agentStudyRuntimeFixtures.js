const createSampleDailyPacket = ({
  date = '2026-06-26',
  revision = 1,
  status = 'planned',
  lesson = 7
} = {}) => ({
  schema_version: 1,
  revision,
  updated_at: `${date}T09:00:00+08:00`,
  id: `daily-${date}`,
  date,
  status,
  created_at: `${date}T09:00:00+08:00`,
  mission: {
    title: `第 ${lesson} 课复习`,
    plan_type: 'review_then_output',
    available_minutes: 40,
    focus_lessons: [lesson],
    goals: [`稳定第 ${lesson} 课输出`]
  },
  tasks: [
    {
      id: 'task-shadowing',
      type: 'listening_shadowing',
      title: '跟读课文对话',
      minutes: 20,
      required: true,
      status: 'pending'
    }
  ],
  study_materials: [
    {
      id: 'material-grammar',
      type: 'grammar_note',
      lesson,
      title: '手段助词 de',
      content: '表示交通手段、工具和通讯方式。',
      examples: [
        { ja: 'バスで いきます。', zh: '坐公交去。', note: '交通手段' },
        { ja: 'メールで おくります。', zh: '用邮件发送。', note: '通讯手段' }
      ]
    },
    {
      id: 'material-listening',
      type: 'listening_script',
      lesson,
      title: '听力脚本',
      content: 'A: なんで いきますか。 B: バスで いきます。',
      examples: [
        { ja: 'なんで いきますか。', zh: '怎么去？', note: '提问' },
        { ja: 'バスで いきます。', zh: '坐公交去。', note: '回答' }
      ]
    }
  ],
  review_items: [
    {
      review_queue_id: 'rq-lesson-7-tool-means',
      lesson,
      skill: 'grammar',
      target_grammar: 'N で V'
    }
  ],
  exercises: [
    {
      id: 'ex-001',
      type: 'q_translate',
      lesson,
      target_grammar: 'N で V',
      prompt: '翻译：我坐公交去。',
      vocab_hints: ['バス'],
      answer_reference: 'バスで いきます。',
      metadata: {
        source: 'codex',
        difficulty: 'foundation',
        skill: 'output'
      },
      review_queue_id: 'rq-lesson-7-tool-means'
    },
    {
      id: 'ex-002',
      type: 'q_conversation',
      lesson,
      target_grammar: 'A は B に C を あげます',
      prompt: '对话补全：我把资料发给老师。',
      vocab_hints: ['しりょう', 'せんせい'],
      answer_reference: 'せんせいに しりょうを あげます。',
      metadata: {
        source: 'codex',
        difficulty: 'foundation',
        skill: 'conversation'
      }
    }
  ],
  answers: {
    'ex-001': '',
    'ex-002': ''
  },
  self_assessment: {
    difficulty: null,
    uncertain_exercise_ids: [],
    confusing_points: [],
    pace: '',
    note: ''
  },
  correction: {
    status: 'pending',
    prompt_file: '',
    review_file: ''
  },
  review_result: null
})

const createSampleReviewResult = ({ date = '2026-06-26' } = {}) => ({
  schema_version: 1,
  revision: 1,
  updated_at: `${date}T21:00:00+08:00`,
  id: `review-${date}`,
  daily_id: `daily-${date}`,
  created_at: `${date}T21:00:00+08:00`,
  overall: {
    accuracy: 0.74,
    can_advance: false,
    summary: '核心意思基本正确，但手段助词和授受方向还需要再练。',
    next_focus: ['N で V', 'あげます / もらいます']
  },
  items: [
    {
      exercise_id: 'ex-001',
      is_correct: false,
      score: 0.25,
      error_tags: ['particle'],
      target_grammar: 'N で V',
      user_answer: 'バスに いきます。',
      correct_answer: 'バスで いきます。',
      explanation: '这里要用表示手段的「で」。',
      retry_recommended: true,
      rubric: {
        grammar: 0.3,
        particles: 0.1,
        naturalness: 0.6
      },
      confidence: 0.95,
      needs_user_input: false,
      acceptable_variants: [],
      manual_override: null
    },
    {
      exercise_id: 'ex-002',
      is_correct: true,
      score: 0.78,
      error_tags: ['naturalness'],
      target_grammar: 'A は B に C を あげます',
      user_answer: 'せんせいに しりょうを あげました。',
      correct_answer: 'せんせいに しりょうを あげました。',
      explanation: '语法方向正确，但还可以更自然地补足上下文。',
      retry_recommended: false,
      rubric: {
        grammar: 0.9,
        context_match: 0.7,
        naturalness: 0.7
      },
      confidence: 0.8,
      needs_user_input: false,
      acceptable_variants: ['せんせいに しりょうを おくりました。'],
      manual_override: null
    }
  ],
  mastery_updates: [
    {
      scope: 'grammar_point',
      key: 'lesson-7/tool-means',
      from_status: 'learning',
      to_status: 'weak',
      evidence: ['ex-001']
    }
  ],
  review_queue_updates: [
    {
      review_queue_id: 'rq-lesson-7-tool-means',
      action: 'due_soon',
      interval_days: 1,
      last_result: 'wrong'
    }
  ],
  promotion_decision: {
    can_advance: false,
    reason: '手段助词还不稳定。'
  }
})

const createSampleReviewDrill = ({ date = '2026-06-30', revision = 1, status = 'draft' } = {}) => ({
  schema_version: 1,
  revision,
  updated_at: `${date}T09:00:00+08:00`,
  id: `review-drill-${date}`,
  date,
  status,
  created_at: `${date}T09:00:00+08:00`,
  source_review: 'study/reviews/2026-06-26-review.json',
  summary: {
    title: '第 7 课弱点回炉',
    focus: ['N で V', '授受方向'],
    due_review_queue_ids: ['rq-lesson-7-tool-means']
  },
  items: [
    {
      id: 'drill-001',
      review_queue_id: 'rq-lesson-7-tool-means',
      key: 'lesson-7/tool-means',
      lesson: 7,
      target_grammar: 'N で V',
      weakness_explanation: '最近批改里，手段助词「で」仍然会和其他助词混淆。',
      error_tags: ['particle'],
      original_prompt: '翻译：我坐公交去。',
      variant_prompt: '请用日语表达：我今天坐出租车去车站。',
      answer_reference: 'きょうは タクシーで えきへ いきます。',
      user_answer: '',
      hint: '先把交通工具和「で」连起来，再补全去向。',
      status: 'pending'
    }
  ],
  submission: {
    submitted_at: null,
    note: ''
  }
})

export {
  createSampleDailyPacket,
  createSampleReviewDrill,
  createSampleReviewResult
}
