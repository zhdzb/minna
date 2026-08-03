<template>
  <div class="listening-lab">
    <header class="lab-header">
      <div>
        <p class="eyebrow">WORKPLACE JAPANESE</p>
        <h1>听读跟读</h1>
        <p class="subtitle">
          {{ session ? `${session.plan.scenario_label} · ${session.plan.level}` : '独立听读训练空间' }}
        </p>
      </div>
      <div class="header-actions">
        <el-button :loading="isGenerating" type="primary" @click="generateSession">
          生成新训练
        </el-button>
        <el-button
          v-if="attempt && !isSubmitted"
          :loading="isSaving"
          @click="saveAttempt"
        >
          保存进度
        </el-button>
        <el-button :loading="isLoading" @click="loadDashboard">刷新</el-button>
      </div>
    </header>

    <el-alert
      v-if="errorMessage"
      class="message-band"
      :closable="false"
      show-icon
      type="error"
      title="操作失败"
      :description="errorMessage"
    />
    <el-alert
      v-else-if="actionMessage"
      class="message-band"
      :closable="false"
      show-icon
      type="success"
      title="已更新"
      :description="actionMessage"
    />

    <section v-if="isLoading" class="loading-band">
      <el-skeleton :rows="10" animated />
    </section>

    <template v-else>
      <el-tabs v-model="activeView" class="lab-tabs">
        <el-tab-pane label="今日训练" name="training">
          <el-empty
            v-if="!session || !attempt"
            description="当前还没有听读训练"
          >
            <el-button type="primary" :loading="isGenerating" @click="generateSession">
              生成第一份训练
            </el-button>
          </el-empty>

          <template v-else>
            <section class="session-summary">
              <div>
                <span class="summary-label">当前场景</span>
                <strong>{{ session.plan.title }}</strong>
              </div>
              <div>
                <span class="summary-label">预计用时</span>
                <strong>{{ session.plan.estimated_minutes }} 分钟</strong>
              </div>
              <div>
                <span class="summary-label">课次范围</span>
                <strong>{{ lessonLabel }}</strong>
              </div>
              <div>
                <span class="summary-label">训练状态</span>
                <strong>{{ statusLabel }}</strong>
              </div>
            </section>

            <section class="stage-strip" aria-label="训练阶段">
              <button
                v-for="(stage, index) in stages"
                :key="stage.id"
                type="button"
                class="stage-item"
                :class="{
                  active: currentStageIndex === index,
                  complete: currentStageIndex > index || isSubmitted
                }"
                :disabled="!canOpenStage(index)"
                @click="openStage(stage.id, index)"
              >
                <span>{{ index + 1 }}</span>
                <b>{{ stage.label }}</b>
              </button>
            </section>

            <section v-if="currentStage === 'blind_listening'" class="training-band">
              <div class="section-heading">
                <div>
                  <p class="step-label">第 1 阶段</p>
                  <h2>盲听理解</h2>
                </div>
                <div class="audio-toolbar">
                  <el-segmented v-model="playbackRate" :options="rateOptions" size="small" />
                  <el-button
                    type="primary"
                    :loading="activePlayback === 'full'"
                    @click="playFullAudio"
                  >
                    播放完整音频
                  </el-button>
                </div>
              </div>

              <p class="stage-instruction">
                原文暂时隐藏。先听主旨和关键信息，完成理解题后再进入文本阶段。
              </p>

              <div class="question-list">
                <article
                  v-for="(question, index) in session.comprehension.questions"
                  :key="question.id"
                  class="question-item"
                >
                  <div class="question-number">{{ index + 1 }}</div>
                  <div class="question-content">
                    <h3>{{ question.prompt_zh }}</h3>
                    <el-radio-group
                      v-if="question.type === 'single_choice'"
                      :model-value="attempt.answers[question.id]"
                      :disabled="attempt.transcript_revealed"
                      @update:model-value="updateAnswer(question.id, $event)"
                    >
                      <el-radio
                        v-for="choice in question.choices"
                        :key="choice"
                        :value="choice"
                        border
                      >
                        {{ choice }}
                      </el-radio>
                    </el-radio-group>
                    <el-input
                      v-else
                      :model-value="attempt.answers[question.id]"
                      :disabled="attempt.transcript_revealed"
                      placeholder="写出听到的关键信息"
                      @update:model-value="updateAnswer(question.id, $event)"
                    />
                  </div>
                </article>
              </div>

              <div class="stage-actions">
                <span>已播放 {{ attempt.playback_counts.full || 0 }} 次</span>
                <el-button
                  type="primary"
                  :disabled="!allComprehensionAnswered"
                  :loading="isSaving"
                  @click="revealTranscript"
                >
                  提交理解答案并查看原文
                </el-button>
              </div>
            </section>

            <section v-else-if="currentStage === 'transcript_reading'" class="training-band">
              <div class="section-heading">
                <div>
                  <p class="step-label">第 2 阶段</p>
                  <h2>对照阅读</h2>
                </div>
                <div class="toggle-row">
                  <el-checkbox v-model="showKana">显示假名</el-checkbox>
                  <el-checkbox v-model="showMeaning">显示中文</el-checkbox>
                </div>
              </div>

              <div class="transcript-list">
                <article
                  v-for="segment in session.script.segments"
                  :key="segment.id"
                  class="transcript-row"
                >
                  <button
                    type="button"
                    class="play-button"
                    :title="'播放 ' + segment.speaker"
                    @click="playSegment(segment)"
                  >
                    播放
                  </button>
                  <div>
                    <span class="speaker">{{ segment.speaker }}</span>
                    <p class="japanese-text">{{ segment.text }}</p>
                    <p v-if="showKana" class="kana-text">{{ segment.kana }}</p>
                    <p v-if="showMeaning" class="meaning-text">{{ segment.meaning_zh }}</p>
                    <span class="focus-note">{{ segment.focus }}</span>
                  </div>
                </article>
              </div>

              <div v-if="session.script.glossary.length" class="glossary-band">
                <h3>本轮词汇</h3>
                <div class="glossary-grid">
                  <div v-for="item in session.script.glossary" :key="item.id">
                    <strong>{{ item.word }}</strong>
                    <span>{{ item.kana }}</span>
                    <p>{{ item.meaning }}</p>
                  </div>
                </div>
              </div>

              <div class="stage-actions">
                <el-button @click="openStage('blind_listening', 0)">返回盲听</el-button>
                <el-button type="primary" @click="advanceToShadowing">进入分段跟读</el-button>
              </div>
            </section>

            <section v-else-if="currentStage === 'shadowing'" class="training-band">
              <div class="section-heading">
                <div>
                  <p class="step-label">第 3 阶段</p>
                  <h2>分段影子跟读</h2>
                </div>
                <el-segmented v-model="playbackRate" :options="rateOptions" size="small" />
              </div>

              <div class="shadow-list">
                <article
                  v-for="segment in session.script.segments"
                  :key="segment.id"
                  class="shadow-row"
                >
                  <div class="shadow-copy">
                    <span class="speaker">{{ segment.speaker }}</span>
                    <p class="japanese-text">{{ segment.text }}</p>
                    <p class="kana-text">{{ segment.kana }}</p>
                  </div>
                  <div class="shadow-controls">
                    <el-button @click="playSegment(segment)">播放</el-button>
                    <el-button
                      v-if="recordingSegmentId !== segment.id"
                      :disabled="Boolean(recordingSegmentId)"
                      @click="startRecording(segment.id)"
                    >
                      录音
                    </el-button>
                    <el-button
                      v-else
                      type="danger"
                      @click="stopRecording"
                    >
                      停止
                    </el-button>
                    <audio
                      v-if="shadowingEntry(segment.id)?.recording_file"
                      class="recording-player"
                      :src="recordingUrl(shadowingEntry(segment.id).recording_file)"
                      controls
                    />
                  </div>
                  <div class="shadow-check">
                    <el-checkbox
                      :model-value="shadowingEntry(segment.id)?.completed"
                      @update:model-value="updateShadowing(segment.id, { completed: $event })"
                    >
                      已完成跟读
                    </el-checkbox>
                    <div class="rating-row">
                      <span>节奏自评</span>
                      <el-rate
                        :model-value="shadowingEntry(segment.id)?.self_rating || 0"
                        @update:model-value="updateShadowing(segment.id, { self_rating: $event })"
                      />
                    </div>
                  </div>
                </article>
              </div>

              <div class="stage-actions">
                <span>已完成 {{ completedShadowingCount }} / {{ session.script.segments.length }} 段</span>
                <el-button type="primary" :loading="isSaving" @click="advanceToResponse">
                  进入职场应答
                </el-button>
              </div>
            </section>

            <section v-else-if="currentStage === 'workplace_response'" class="training-band">
              <div class="section-heading">
                <div>
                  <p class="step-label">第 4 阶段</p>
                  <h2>职场应答</h2>
                </div>
                <el-button @click="playFullAudio">再次播放完整音频</el-button>
              </div>

              <div class="response-prompt">
                <span>你的任务</span>
                <h3>{{ session.workplace_response.prompt_zh }}</h3>
                <p>{{ session.workplace_response.context_zh }}</p>
              </div>

              <label class="answer-field">
                <span>你的日语回应</span>
                <textarea
                  ref="responseInput"
                  class="response-input"
                  rows="4"
                  :value="attempt.response_answer"
                  placeholder="输入一句自然日语"
                  @input="updateResponseAnswer"
                />
              </label>

              <div class="reflection-grid">
                <label>
                  <span>理解信心</span>
                  <el-rate
                    :model-value="attempt.reflection.confidence || 0"
                    @update:model-value="updateReflection({ confidence: $event })"
                  />
                </label>
                <label>
                  <span>需要重练的句段</span>
                  <el-checkbox-group
                    :model-value="attempt.reflection.difficult_segment_ids"
                    @update:model-value="updateReflection({ difficult_segment_ids: $event })"
                  >
                    <el-checkbox
                      v-for="(segment, index) in session.script.segments"
                      :key="segment.id"
                      :value="segment.id"
                    >
                      第 {{ index + 1 }} 段
                    </el-checkbox>
                  </el-checkbox-group>
                </label>
              </div>

              <el-input
                :model-value="attempt.reflection.note"
                type="textarea"
                :rows="2"
                placeholder="可选：记录误听、停顿或不熟悉的表达"
                @update:model-value="updateReflection({ note: $event })"
              />

              <div class="stage-actions">
                <el-button @click="openStage('shadowing', 2)">返回跟读</el-button>
                <el-button
                  type="primary"
                  :disabled="!String(attempt.response_answer || '').trim()"
                  :loading="isSubmitting"
                  @click="submitAttempt"
                >
                  提交训练并查看反馈
                </el-button>
              </div>
            </section>

            <section v-else class="training-band feedback-band">
              <div class="section-heading">
                <div>
                  <p class="step-label">第 5 阶段</p>
                  <h2>训练反馈</h2>
                </div>
                <strong class="accuracy">{{ formatPercent(attempt.feedback?.accuracy) }}</strong>
              </div>

              <p class="feedback-summary">{{ attempt.feedback?.summary_zh }}</p>

              <div class="result-list">
                <article
                  v-for="result in attempt.feedback?.question_results || []"
                  :key="result.question_id"
                  class="result-row"
                  :class="{ correct: result.is_correct, wrong: !result.is_correct }"
                >
                  <div>
                    <strong>{{ result.is_correct ? '正确' : '需要重听' }}</strong>
                    <p>{{ result.prompt_zh }}</p>
                  </div>
                  <dl>
                    <dt>你的答案</dt>
                    <dd>{{ result.user_answer || '未作答' }}</dd>
                    <dt>参考答案</dt>
                    <dd>{{ result.answer_reference }}</dd>
                    <dt>说明</dt>
                    <dd>{{ result.explanation_zh }}</dd>
                  </dl>
                </article>
              </div>

              <div class="response-feedback">
                <span>你的职场回应</span>
                <p class="japanese-text">{{ attempt.response_answer }}</p>
                <span>参考表达</span>
                <p class="japanese-text">{{ session.workplace_response.answer_reference }}</p>
                <p
                  v-for="variant in session.workplace_response.acceptable_variants"
                  :key="variant"
                  class="variant"
                >
                  {{ variant }}
                </p>
              </div>

              <div class="next-focus">
                <h3>下一轮重点</h3>
                <ul>
                  <li v-for="item in attempt.feedback?.next_focus || []" :key="item">
                    {{ item }}
                  </li>
                </ul>
              </div>

              <div class="stage-actions">
                <el-button :loading="isRetrying" @click="retrySession(session.id)">
                  重练本篇
                </el-button>
                <el-button type="primary" :loading="isGenerating" @click="generateSession">
                  生成新训练
                </el-button>
              </div>
            </section>
          </template>
        </el-tab-pane>

        <el-tab-pane label="历史记录" name="history">
          <section class="history-band">
            <div class="section-heading">
              <div>
                <p class="step-label">LISTENING ARCHIVE</p>
                <h2>训练历史</h2>
              </div>
              <span>{{ history.length }} 篇</span>
            </div>
            <el-empty v-if="!history.length" description="还没有历史训练" />
            <div v-else class="history-list">
              <article v-for="item in history" :key="item.id" class="history-row">
                <div>
                  <span>{{ item.date }} · {{ item.scenario }}</span>
                  <h3>{{ item.title }}</h3>
                  <p>
                    {{ item.status === 'submitted' ? `正确率 ${formatPercent(item.accuracy)}` : '尚未提交' }}
                  </p>
                </div>
                <el-button :loading="isRetrying" @click="retrySession(item.id)">
                  重练
                </el-button>
              </article>
            </div>
          </section>
        </el-tab-pane>

        <el-tab-pane label="听读进度" name="progress">
          <section class="progress-grid">
            <div>
              <span>已完成训练</span>
              <strong>{{ progress.completed_attempts }}</strong>
            </div>
            <div>
              <span>理解正确率</span>
              <strong>{{ formatPercent(progress.average_accuracy) }}</strong>
            </div>
            <div>
              <span>已跟读句段</span>
              <strong>
                {{ progress.shadowing_completed_segments }}/{{ progress.shadowing_total_segments }}
              </strong>
            </div>
            <div>
              <span>平均节奏自评</span>
              <strong>{{ progress.average_shadowing_rating.toFixed(1) }}/5</strong>
            </div>
          </section>

          <section class="queue-band">
            <div class="section-heading">
              <div>
                <p class="step-label">MODULE REVIEW QUEUE</p>
                <h2>模块复习队列</h2>
              </div>
              <span>{{ reviewQueue.items.length }} 项</span>
            </div>
            <el-empty v-if="!reviewQueue.items.length" description="当前没有待安排的听读复习" />
            <div v-else class="queue-list">
              <article v-for="item in reviewQueue.items" :key="item.id">
                <div>
                  <strong>{{ historyTitle(item.session_id) }}</strong>
                  <p>{{ item.reason }}</p>
                </div>
                <div class="queue-meta">
                  <span>{{ item.status === 'due' ? '已到期' : `计划 ${item.due_date}` }}</span>
                  <el-button size="small" @click="retrySession(item.session_id)">开始</el-button>
                </div>
              </article>
            </div>
          </section>
        </el-tab-pane>
      </el-tabs>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { createListeningLabClient } from '@/utils/listeningLabClient'
import { toKanaInputWithSelection } from '@/utils/wanakanaInput'
import { useJapaneseSpeech } from '@/composables/useJapaneseSpeech'

const props = defineProps({
  client: {
    type: Object,
    default: null
  }
})

const stages = [
  { id: 'blind_listening', label: '盲听' },
  { id: 'transcript_reading', label: '阅读' },
  { id: 'shadowing', label: '跟读' },
  { id: 'workplace_response', label: '应答' },
  { id: 'feedback', label: '反馈' }
]
const rateOptions = [
  { label: '0.75x', value: 0.75 },
  { label: '0.9x', value: 0.9 },
  { label: '1.0x', value: 1 }
]

const activeView = ref('training')
const isLoading = ref(true)
const isGenerating = ref(false)
const isSaving = ref(false)
const isSubmitting = ref(false)
const isRetrying = ref(false)
const errorMessage = ref('')
const actionMessage = ref('')
const dashboard = ref(null)
const playbackRate = ref(0.9)
const activePlayback = ref('')
const { speak: speakJapanese } = useJapaneseSpeech()
const showKana = ref(true)
const showMeaning = ref(true)
const recordingSegmentId = ref('')
const responseInput = ref(null)
let mediaRecorder = null
let recordingStream = null
let recordingChunks = []

const client = computed(() => props.client || createListeningLabClient())
const session = computed(() => dashboard.value?.latestSession || null)
const attempt = computed(() => dashboard.value?.latestAttempt || null)
const progress = computed(
  () =>
    dashboard.value?.progress || {
      completed_attempts: 0,
      average_accuracy: 0,
      shadowing_completed_segments: 0,
      shadowing_total_segments: 0,
      average_shadowing_rating: 0
    }
)
const reviewQueue = computed(() => dashboard.value?.reviewQueue || { items: [] })
const history = computed(() => dashboard.value?.history || [])
const currentStage = computed(() =>
  attempt.value?.status === 'submitted' ? 'feedback' : attempt.value?.current_stage || 'blind_listening'
)
const currentStageIndex = computed(() =>
  Math.max(0, stages.findIndex((stage) => stage.id === currentStage.value))
)
const isSubmitted = computed(() => attempt.value?.status === 'submitted')
const lessonLabel = computed(() =>
  (session.value?.plan.focus_lessons || []).map((lesson) => `第 ${lesson} 课`).join('、')
)
const statusLabel = computed(() => (isSubmitted.value ? '已完成' : `第 ${currentStageIndex.value + 1} 阶段`))
const allComprehensionAnswered = computed(() =>
  Boolean(session.value?.comprehension.questions.length) &&
  session.value.comprehension.questions.every((question) =>
    String(attempt.value?.answers?.[question.id] || '').trim()
  )
)
const completedShadowingCount = computed(
  () => attempt.value?.shadowing.filter((item) => item.completed).length || 0
)

const clone = (value) => JSON.parse(JSON.stringify(value))
const formatPercent = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value * 100)}%` : '--'

const applyDashboard = (value) => {
  dashboard.value = value
}

const clearMessages = () => {
  errorMessage.value = ''
  actionMessage.value = ''
}

const loadDashboard = async () => {
  isLoading.value = true
  clearMessages()
  try {
    applyDashboard(await client.value.loadDashboard())
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    isLoading.value = false
  }
}

const generateSession = async () => {
  isGenerating.value = true
  clearMessages()
  try {
    applyDashboard(await client.value.generateSession())
    activeView.value = 'training'
    actionMessage.value = '已根据当前课次、薄弱点、错题和词汇生成新的独立听读训练。'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    isGenerating.value = false
  }
}

const updateAttempt = (updater) => {
  if (!dashboard.value?.latestAttempt) return
  dashboard.value = {
    ...dashboard.value,
    latestAttempt: updater(clone(dashboard.value.latestAttempt))
  }
}

const updateAnswer = (questionId, value) => {
  updateAttempt((draft) => {
    draft.answers[questionId] = String(value || '')
    return draft
  })
}

const shadowingEntry = (segmentId) =>
  attempt.value?.shadowing.find((item) => item.segment_id === segmentId) || null

const updateShadowing = (segmentId, patch) => {
  updateAttempt((draft) => {
    draft.shadowing = draft.shadowing.map((item) =>
      item.segment_id === segmentId ? { ...item, ...patch } : item
    )
    return draft
  })
}

const updateReflection = (patch) => {
  updateAttempt((draft) => {
    draft.reflection = { ...draft.reflection, ...patch }
    return draft
  })
}

const updateResponseAnswer = (event) => {
  const input = event.target
  const converted = toKanaInputWithSelection(
    input.value,
    input.selectionStart,
    input.selectionEnd
  )
  updateAttempt((draft) => {
    draft.response_answer = converted.value
    return draft
  })
  nextTick(() => {
    if (document.activeElement === input && converted.selectionStart !== null) {
      input.setSelectionRange(converted.selectionStart, converted.selectionEnd)
    }
  })
}

const persistAttempt = async ({ message = '' } = {}) => {
  if (!attempt.value || isSubmitted.value) return
  isSaving.value = true
  clearMessages()
  try {
    applyDashboard(await client.value.saveAttempt(clone(attempt.value)))
    actionMessage.value = message || '听读训练进度已保存。'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
    throw error
  } finally {
    isSaving.value = false
  }
}

const saveAttempt = async () => {
  try {
    await persistAttempt()
  } catch (_error) {
    // The error is already visible in the page alert.
  }
}

const setStageAndSave = async (stage, { reveal = false, message = '' } = {}) => {
  updateAttempt((draft) => {
    draft.current_stage = stage
    if (reveal) draft.transcript_revealed = true
    return draft
  })
  await persistAttempt({ message })
}

const revealTranscript = async () => {
  if (!allComprehensionAnswered.value) return
  try {
    await setStageAndSave('transcript_reading', {
      reveal: true,
      message: '理解答案已锁定，现在可以对照原文阅读。'
    })
  } catch (_error) {
    // The error is already visible in the page alert.
  }
}

const advanceToShadowing = async () => {
  try {
    await setStageAndSave('shadowing', { message: '已进入分段影子跟读。' })
  } catch (_error) {
    // The error is already visible in the page alert.
  }
}

const advanceToResponse = async () => {
  try {
    await setStageAndSave('workplace_response', {
      message: '跟读状态已保存，现在完成职场应答。'
    })
  } catch (_error) {
    // The error is already visible in the page alert.
  }
}

const canOpenStage = (index) => {
  if (isSubmitted.value) return true
  if (index === 0) return true
  if (index === 1) return Boolean(attempt.value?.transcript_revealed)
  return index <= currentStageIndex.value
}

const openStage = (stage, index) => {
  if (!canOpenStage(index)) return
  updateAttempt((draft) => {
    draft.current_stage = stage
    return draft
  })
}

const incrementPlayback = (key) => {
  updateAttempt((draft) => {
    draft.playback_counts[key] = Number(draft.playback_counts[key] || 0) + 1
    return draft
  })
}

const playText = (text, key) => {
  const started = speakJapanese(text, {
    lang: session.value?.audio.lang || 'ja-JP',
    rate: playbackRate.value,
    onStart: () => {
      activePlayback.value = key
      incrementPlayback(key)
    },
    onEnd: () => {
      if (activePlayback.value === key) activePlayback.value = ''
    },
    onError: () => {
      activePlayback.value = ''
      errorMessage.value = '语音播放失败，请检查浏览器的日语语音设置。'
    }
  })
  if (!started) errorMessage.value = '当前浏览器不支持日语语音播放。'
}

const playFullAudio = () => {
  if (session.value) playText(session.value.script.full_text, 'full')
}

const playSegment = (segment) => {
  playText(segment.text, segment.id)
}

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('录音读取失败'))
    reader.readAsDataURL(blob)
  })

const startRecording = async (segmentId) => {
  clearMessages()
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder !== 'function') {
    errorMessage.value = '当前浏览器不支持录音，请使用最新版 Chrome 或 Edge。'
    return
  }
  try {
    recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const preferredType = MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : ''
    mediaRecorder = new MediaRecorder(
      recordingStream,
      preferredType ? { mimeType: preferredType } : undefined
    )
    recordingChunks = []
    mediaRecorder.ondataavailable = (event) => {
      if (event.data?.size) recordingChunks.push(event.data)
    }
    mediaRecorder.onstop = async () => {
      const activeSegmentId = recordingSegmentId.value
      try {
        const mimeType = (mediaRecorder?.mimeType || 'audio/webm').split(';')[0]
        const blob = new Blob(recordingChunks, { type: mimeType })
        const dataUrl = await blobToDataUrl(blob)
        applyDashboard(
          await client.value.saveRecording({
            attemptId: attempt.value.id,
            segmentId: activeSegmentId,
            dataUrl
          })
        )
        updateShadowing(activeSegmentId, { completed: true })
        actionMessage.value = '跟读录音已保存。'
      } catch (error) {
        errorMessage.value = error instanceof Error ? error.message : String(error)
      } finally {
        recordingStream?.getTracks().forEach((track) => track.stop())
        recordingStream = null
        mediaRecorder = null
        recordingChunks = []
        recordingSegmentId.value = ''
      }
    }
    recordingSegmentId.value = segmentId
    mediaRecorder.start()
  } catch (error) {
    recordingStream?.getTracks().forEach((track) => track.stop())
    recordingStream = null
    recordingSegmentId.value = ''
    errorMessage.value =
      error?.name === 'NotAllowedError'
        ? '麦克风权限未开启，无法保存跟读录音。'
        : error instanceof Error
          ? error.message
          : String(error)
  }
}

const stopRecording = () => {
  if (mediaRecorder?.state === 'recording') mediaRecorder.stop()
}

const recordingUrl = (recordingPath) => client.value.buildRecordingUrl(recordingPath)

const submitAttempt = async () => {
  if (!attempt.value || !String(attempt.value.response_answer || '').trim()) return
  isSubmitting.value = true
  clearMessages()
  try {
    applyDashboard(await client.value.submitAttempt(clone(attempt.value)))
    actionMessage.value = '训练已提交，反馈和模块复习安排已经生成。'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    isSubmitting.value = false
  }
}

const retrySession = async (sessionId) => {
  isRetrying.value = true
  clearMessages()
  try {
    applyDashboard(await client.value.retrySession(sessionId))
    activeView.value = 'training'
    actionMessage.value = '已建立新的重练记录，原有训练结果仍然保留。'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    isRetrying.value = false
  }
}

const historyTitle = (sessionId) =>
  history.value.find((item) => item.id === sessionId)?.title || sessionId

onMounted(loadDashboard)

onBeforeUnmount(() => {
  if (mediaRecorder?.state === 'recording') mediaRecorder.stop()
  recordingStream?.getTracks().forEach((track) => track.stop())
})
</script>

<style scoped>
.listening-lab {
  min-height: 100%;
  padding: 24px;
  color: var(--app-text);
}

.lab-header,
.section-heading,
.stage-actions,
.history-row,
.queue-list article {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.lab-header {
  align-items: end;
  margin-bottom: 18px;
}

.lab-header h1,
.section-heading h2,
.question-content h3,
.response-prompt h3,
.history-row h3,
.next-focus h3 {
  margin: 0;
}

.eyebrow,
.subtitle,
.step-label,
.stage-instruction,
.meaning-text,
.kana-text,
.focus-note,
.history-row p,
.history-row span,
.queue-list p,
.response-prompt p,
.variant {
  margin: 0;
}

.eyebrow,
.step-label {
  color: var(--app-accent);
  font-size: 12px;
  font-weight: 700;
}

.subtitle {
  margin-top: 6px;
  color: var(--app-text-muted);
}

.header-actions,
.audio-toolbar,
.toggle-row,
.shadow-controls,
.rating-row,
.queue-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.message-band,
.loading-band {
  margin-bottom: 16px;
}

.loading-band,
.training-band,
.history-band,
.queue-band {
  padding: 20px;
  background: var(--app-panel-bg);
  border: 1px solid var(--app-border);
  border-radius: 8px;
}

.lab-tabs :deep(.el-tabs__content) {
  overflow: visible;
}

.session-summary,
.progress-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 16px;
  border: 1px solid var(--app-border);
  background: var(--app-panel-bg);
}

.session-summary > div,
.progress-grid > div {
  min-width: 0;
  padding: 16px;
  border-right: 1px solid var(--app-border);
}

.session-summary > div:last-child,
.progress-grid > div:last-child {
  border-right: 0;
}

.summary-label,
.progress-grid span {
  display: block;
  color: var(--app-text-soft);
  font-size: 12px;
}

.session-summary strong,
.progress-grid strong {
  display: block;
  margin-top: 7px;
  color: var(--app-text-strong);
  font-size: 18px;
}

.stage-strip {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin-bottom: 16px;
  border: 1px solid var(--app-border);
  background: var(--app-card-bg);
}

.stage-item {
  min-width: 0;
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-right: 1px solid var(--app-border);
  background: transparent;
  color: var(--app-text-soft);
  cursor: pointer;
}

.stage-item:last-child {
  border-right: 0;
}

.stage-item span {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border: 1px solid var(--app-border-strong);
  border-radius: 50%;
  font-size: 12px;
}

.stage-item.active {
  color: var(--app-text-strong);
  box-shadow: inset 0 -3px var(--app-accent);
}

.stage-item.complete span {
  color: var(--app-success);
  border-color: var(--app-success);
}

.stage-item:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.section-heading {
  align-items: end;
  margin-bottom: 18px;
}

.stage-instruction {
  padding: 12px 14px;
  margin-bottom: 16px;
  background: var(--app-soft-bg);
  border-left: 3px solid var(--app-accent);
  color: var(--app-text-muted);
  line-height: 1.6;
}

.question-list,
.transcript-list,
.shadow-list,
.result-list,
.history-list,
.queue-list {
  display: grid;
  gap: 12px;
}

.question-item {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid var(--app-border);
}

.question-number {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid var(--app-border-strong);
  border-radius: 50%;
  color: var(--app-text-muted);
  font-weight: 700;
}

.question-content {
  min-width: 0;
}

.question-content h3 {
  margin-bottom: 12px;
  font-size: 16px;
}

.question-content :deep(.el-radio-group) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.question-content :deep(.el-radio) {
  margin-right: 0;
}

.stage-actions {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--app-border);
}

.stage-actions > span {
  color: var(--app-text-soft);
  font-size: 13px;
}

.transcript-row,
.shadow-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 14px;
  padding: 16px 0;
  border-bottom: 1px solid var(--app-border);
}

.play-button {
  align-self: start;
  min-width: 54px;
  height: 34px;
  border: 1px solid var(--app-border-strong);
  border-radius: 6px;
  background: var(--app-card-bg);
  color: var(--app-text-strong);
  cursor: pointer;
}

.speaker,
.focus-note,
.response-feedback > span {
  color: var(--app-text-soft);
  font-size: 12px;
}

.japanese-text {
  margin: 6px 0 0;
  color: var(--app-text-strong);
  font-size: 19px;
  line-height: 1.7;
}

.kana-text {
  margin-top: 4px;
  color: var(--app-text-muted);
  line-height: 1.6;
}

.meaning-text {
  margin-top: 4px;
  color: var(--app-text-muted);
  line-height: 1.6;
}

.focus-note {
  display: inline-block;
  margin-top: 8px;
}

.glossary-band {
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px solid var(--app-border);
}

.glossary-band h3 {
  margin: 0 0 12px;
}

.glossary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  background: var(--app-border);
  border: 1px solid var(--app-border);
}

.glossary-grid > div {
  min-width: 0;
  padding: 12px;
  background: var(--app-card-bg);
}

.glossary-grid span {
  display: block;
  margin-top: 2px;
  color: var(--app-text-soft);
  font-size: 12px;
}

.glossary-grid p {
  margin: 8px 0 0;
  color: var(--app-text-muted);
}

.shadow-row {
  grid-template-columns: minmax(0, 1fr) minmax(180px, 0.6fr);
}

.shadow-copy {
  min-width: 0;
}

.shadow-controls {
  align-content: start;
}

.recording-player {
  width: min(100%, 300px);
  height: 34px;
}

.shadow-check {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.rating-row > span {
  color: var(--app-text-soft);
  font-size: 12px;
}

.response-prompt,
.response-feedback,
.next-focus {
  padding: 16px;
  background: var(--app-soft-bg);
  border: 1px solid var(--app-border);
}

.response-prompt > span,
.answer-field > span,
.reflection-grid label > span {
  color: var(--app-text-soft);
  font-size: 12px;
}

.response-prompt h3 {
  margin-top: 8px;
  font-size: 18px;
}

.response-prompt p {
  margin-top: 8px;
  color: var(--app-text-muted);
}

.answer-field {
  display: grid;
  gap: 8px;
  margin-top: 18px;
}

.response-input {
  width: 100%;
  min-height: 104px;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid var(--app-border-strong);
  border-radius: 6px;
  background: var(--app-card-bg);
  color: var(--app-text-strong);
  font: inherit;
  resize: vertical;
}

.reflection-grid {
  display: grid;
  grid-template-columns: minmax(180px, 0.5fr) minmax(0, 1fr);
  gap: 16px;
  margin: 18px 0;
}

.reflection-grid label {
  display: grid;
  gap: 8px;
}

.accuracy {
  color: var(--app-success);
  font-size: 32px;
}

.feedback-summary {
  margin: 0 0 18px;
  color: var(--app-text-muted);
  line-height: 1.6;
}

.result-row {
  padding: 16px;
  border: 1px solid var(--app-border);
  background: var(--app-card-bg);
}

.result-row.correct {
  border-left: 4px solid var(--app-success);
}

.result-row.wrong {
  border-left: 4px solid var(--app-danger);
}

.result-row p,
.result-row dl,
.result-row dd {
  margin: 0;
}

.result-row p {
  margin-top: 6px;
  color: var(--app-text-muted);
}

.result-row dl {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 7px 12px;
  margin-top: 14px;
}

.result-row dt {
  color: var(--app-text-soft);
  font-size: 12px;
}

.result-row dd {
  color: var(--app-text);
}

.response-feedback,
.next-focus {
  margin-top: 16px;
}

.response-feedback .variant {
  margin-top: 6px;
  color: var(--app-text-muted);
}

.next-focus ul {
  margin: 10px 0 0;
  padding-left: 20px;
  color: var(--app-text-muted);
}

.history-row,
.queue-list article {
  padding: 14px 0;
  border-bottom: 1px solid var(--app-border);
}

.history-row h3 {
  margin-top: 5px;
}

.history-row p,
.queue-list p {
  margin-top: 5px;
  color: var(--app-text-muted);
}

.progress-grid {
  margin-top: 4px;
}

.progress-grid strong {
  font-size: 28px;
}

.queue-band {
  margin-top: 16px;
}

.queue-meta {
  flex-shrink: 0;
}

.queue-meta > span {
  color: var(--app-text-soft);
  font-size: 12px;
}

@media (max-width: 900px) {
  .listening-lab {
    padding: 16px;
  }

  .lab-header {
    align-items: start;
    flex-direction: column;
  }

  .session-summary,
  .progress-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .session-summary > div:nth-child(2),
  .progress-grid > div:nth-child(2) {
    border-right: 0;
  }

  .session-summary > div:nth-child(-n + 2),
  .progress-grid > div:nth-child(-n + 2) {
    border-bottom: 1px solid var(--app-border);
  }

  .stage-strip {
    grid-template-columns: 1fr;
  }

  .stage-item {
    justify-content: start;
    padding: 0 14px;
    border-right: 0;
    border-bottom: 1px solid var(--app-border);
  }

  .stage-item:last-child {
    border-bottom: 0;
  }

  .stage-item.active {
    box-shadow: inset 3px 0 var(--app-accent);
  }

  .section-heading,
  .stage-actions,
  .history-row,
  .queue-list article,
  .shadow-check {
    align-items: start;
    flex-direction: column;
  }

  .shadow-row,
  .reflection-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .shadow-controls,
  .shadow-check {
    grid-column: 1;
  }

  .glossary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .result-row dl {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .session-summary,
  .progress-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .session-summary > div,
  .progress-grid > div {
    border-right: 0;
    border-bottom: 1px solid var(--app-border);
  }

  .session-summary > div:last-child,
  .progress-grid > div:last-child {
    border-bottom: 0;
  }

  .glossary-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .question-item {
    grid-template-columns: minmax(0, 1fr);
  }

  .question-content :deep(.el-radio-group) {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
