<template>
  <div class="syllabus-page">
    <header class="syllabus-header">
      <div>
        <p class="syllabus-eyebrow">课程知识点管理</p>
        <h1>课纲与题型</h1>
        <p class="syllabus-subtitle">这里维护每日学习包生成所依赖的课文主题、文法、句型、隐藏句式和词汇池。</p>
      </div>
      <div class="syllabus-actions">
        <el-button :loading="isLoading" @click="loadSyllabus">刷新</el-button>
        <el-button @click="resetCurrentLesson">恢复当前课原始内容</el-button>
        <el-button type="primary" :loading="isSaving" :disabled="!hasChanges" @click="saveSyllabus">
          保存课纲
        </el-button>
      </div>
    </header>

    <section v-if="loadError" class="syllabus-band">
      <el-alert :closable="false" show-icon title="加载失败" type="error" :description="loadError" />
    </section>

    <section v-else-if="saveMessage" class="syllabus-band">
      <el-alert :closable="false" show-icon title="已保存" type="success" :description="saveMessage" />
    </section>

    <section v-else-if="saveError" class="syllabus-band">
      <el-alert :closable="false" show-icon title="保存失败" type="error" :description="saveError" />
    </section>

    <div v-if="syllabus" class="syllabus-layout">
      <aside class="syllabus-sidebar syllabus-band">
        <div class="section-heading">
          <h2>题型池</h2>
          <span>{{ syllabus.question_types.length }} 个</span>
        </div>
        <div class="type-list">
          <article v-for="type in syllabus.question_types" :key="type.id" class="type-card">
            <div class="type-card-top">
              <strong>{{ type.name }}</strong>
              <span>{{ type.id }}</span>
            </div>
            <p>{{ type.desc }}</p>
            <small>难度 {{ type.difficulty_range[0] }} - {{ type.difficulty_range[1] }}</small>
          </article>
        </div>

        <div class="section-heading section-heading-lessons">
          <h2>课程目录</h2>
          <span>{{ syllabus.lessons.length }} 课</span>
        </div>
        <div class="lesson-list">
          <button
            v-for="lesson in syllabus.lessons"
            :key="lesson.id"
            class="lesson-button"
            :class="{ active: lesson.id === selectedLessonId }"
            @click="selectedLessonId = lesson.id"
          >
            <strong>{{ lesson.title }}</strong>
            <span>{{ lesson.theme }}</span>
          </button>
        </div>
      </aside>

      <main class="syllabus-editor syllabus-band" v-if="selectedLesson">
        <div class="section-heading">
          <h2>{{ selectedLesson.title }}</h2>
          <span>用于生成每日学习包与练习题</span>
        </div>

        <div class="form-grid">
          <label class="field">
            <span>课程标题</span>
            <input v-model="selectedLesson.title" class="field-input" />
          </label>
          <label class="field">
            <span>课程主题</span>
            <input v-model="selectedLesson.theme" class="field-input" />
          </label>
        </div>

        <section class="editor-section">
          <div class="section-heading">
            <h3>核心文法</h3>
            <span>{{ selectedLesson.grammar_points.length }} 条</span>
          </div>
          <div class="list-editor">
            <div v-for="(item, index) in selectedLesson.grammar_points" :key="`grammar-${index}`" class="list-row">
              <input v-model="selectedLesson.grammar_points[index]" class="field-input" />
              <button class="remove-button" @click="removeArrayItem(selectedLesson.grammar_points, index)">删除</button>
            </div>
            <button class="add-button" @click="selectedLesson.grammar_points.push('')">新增文法</button>
          </div>
        </section>

        <section class="editor-section">
          <div class="section-heading">
            <h3>句型骨架</h3>
            <span>{{ selectedLesson.sentence_patterns.length }} 条</span>
          </div>
          <div class="list-editor">
            <div v-for="(item, index) in selectedLesson.sentence_patterns" :key="`pattern-${index}`" class="list-row">
              <input v-model="selectedLesson.sentence_patterns[index]" class="field-input" />
              <button class="remove-button" @click="removeArrayItem(selectedLesson.sentence_patterns, index)">删除</button>
            </div>
            <button class="add-button" @click="selectedLesson.sentence_patterns.push('')">新增句型</button>
          </div>
        </section>

        <section class="editor-section">
          <div class="section-heading">
            <h3>隐藏知识点 / 特殊句式</h3>
            <span>{{ selectedLesson.hidden_knowledge.length }} 条</span>
          </div>
          <div class="list-editor">
            <div v-for="(item, index) in selectedLesson.hidden_knowledge" :key="`hidden-${index}`" class="list-row">
              <textarea v-model="selectedLesson.hidden_knowledge[index]" class="field-input field-textarea" rows="2" />
              <button class="remove-button" @click="removeArrayItem(selectedLesson.hidden_knowledge, index)">删除</button>
            </div>
            <button class="add-button" @click="selectedLesson.hidden_knowledge.push('')">新增提醒</button>
          </div>
        </section>

        <section class="editor-section">
          <div class="section-heading">
            <h3>核心词汇</h3>
            <span>{{ selectedLesson.core_vocabulary.length }} 个</span>
          </div>
          <div class="vocabulary-list">
            <article
              v-for="(item, index) in selectedLesson.core_vocabulary"
              :key="`vocab-${index}`"
              class="vocabulary-card"
            >
              <div class="form-grid">
                <label class="field">
                  <span>词汇</span>
                  <input v-model="item.word" class="field-input" />
                </label>
                <label class="field">
                  <span>假名</span>
                  <input v-model="item.kana" class="field-input" />
                </label>
                <label class="field">
                  <span>中文</span>
                  <input v-model="item.meaning" class="field-input" />
                </label>
                <label class="field">
                  <span>使用场景</span>
                  <input v-model="item.usage" class="field-input" />
                </label>
              </div>
              <button class="remove-button" @click="removeArrayItem(selectedLesson.core_vocabulary, index)">删除词汇</button>
            </article>
            <button class="add-button" @click="addVocabularyItem">新增词汇</button>
          </div>
        </section>

        <section class="editor-section">
          <div class="section-heading">
            <h3>启用题型</h3>
            <span>{{ selectedLesson.enabled_question_types.length }} 项</span>
          </div>
          <label
            v-for="type in syllabus.question_types"
            :key="`enabled-${type.id}`"
            class="checkbox-row"
          >
            <input
              type="checkbox"
              :checked="selectedLesson.enabled_question_types.includes(type.id)"
              @change="toggleQuestionType(type.id, $event.target.checked)"
            />
            <span>{{ type.name }}</span>
            <small>{{ type.id }}</small>
          </label>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { createAgentStudyClient } from '@/utils/agentStudyClient'

const props = defineProps({
  client: {
    type: Object,
    default: null
  }
})

const syllabus = ref(null)
const originalSyllabus = ref(null)
const selectedLessonId = ref(1)
const isLoading = ref(false)
const isSaving = ref(false)
const loadError = ref('')
const saveError = ref('')
const saveMessage = ref('')

const client = computed(() => props.client || createAgentStudyClient())

const selectedLesson = computed(() =>
  syllabus.value?.lessons?.find((lesson) => lesson.id === selectedLessonId.value) || null
)

const hasChanges = computed(() => {
  if (!syllabus.value || !originalSyllabus.value) return false
  return JSON.stringify(syllabus.value) !== JSON.stringify(originalSyllabus.value)
})

const resetMessages = () => {
  loadError.value = ''
  saveError.value = ''
  saveMessage.value = ''
}

const normalizeLoadedSyllabus = (value) => JSON.parse(JSON.stringify(value))

const loadSyllabus = async () => {
  isLoading.value = true
  resetMessages()

  try {
    const result = await client.value.loadSyllabus()
    syllabus.value = normalizeLoadedSyllabus(result)
    originalSyllabus.value = normalizeLoadedSyllabus(result)
    if (!syllabus.value.lessons.find((lesson) => lesson.id === selectedLessonId.value)) {
      selectedLessonId.value = syllabus.value.lessons[0]?.id || 1
    }
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isLoading.value = false
  }
}

const saveSyllabus = async () => {
  if (!syllabus.value) return

  isSaving.value = true
  saveError.value = ''
  saveMessage.value = ''

  try {
    const result = await client.value.saveSyllabus(syllabus.value)
    syllabus.value = normalizeLoadedSyllabus(result)
    originalSyllabus.value = normalizeLoadedSyllabus(result)
    saveMessage.value = '课纲已保存，后续每日学习包会直接使用这份最新知识点。'
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isSaving.value = false
  }
}

const removeArrayItem = (list, index) => {
  list.splice(index, 1)
  resetMessages()
}

const addVocabularyItem = () => {
  selectedLesson.value?.core_vocabulary.push({
    word: '',
    kana: '',
    meaning: '',
    usage: ''
  })
  resetMessages()
}

const toggleQuestionType = (typeId, checked) => {
  if (!selectedLesson.value) return
  const next = new Set(selectedLesson.value.enabled_question_types)
  if (checked) {
    next.add(typeId)
  } else {
    next.delete(typeId)
  }
  selectedLesson.value.enabled_question_types = [...next]
  resetMessages()
}

const resetCurrentLesson = () => {
  if (!syllabus.value || !originalSyllabus.value || !selectedLesson.value) return
  const source = originalSyllabus.value.lessons.find((lesson) => lesson.id === selectedLesson.value.id)
  const targetIndex = syllabus.value.lessons.findIndex((lesson) => lesson.id === selectedLesson.value.id)
  if (source && targetIndex >= 0) {
    syllabus.value.lessons[targetIndex] = JSON.parse(JSON.stringify(source))
    resetMessages()
  }
}

loadSyllabus()
</script>

<style scoped>
.syllabus-page {
  min-height: 100%;
  padding: 24px;
  display: grid;
  gap: 16px;
  color: var(--app-text);
}

.syllabus-header,
.syllabus-layout,
.syllabus-actions,
.form-grid {
  display: grid;
  gap: 16px;
}

.syllabus-header {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
}

.syllabus-eyebrow {
  margin: 0;
  font-size: 12px;
  color: var(--app-text-soft);
}

.syllabus-header h1,
.section-heading h2,
.section-heading h3 {
  margin: 0;
}

.syllabus-subtitle {
  margin: 8px 0 0;
  color: var(--app-text-muted);
  line-height: 1.6;
}

.syllabus-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: end;
}

.syllabus-layout {
  grid-template-columns: 320px minmax(0, 1fr);
  align-items: start;
}

.syllabus-band {
  padding: 20px;
  background: var(--app-panel-bg);
  border: 1px solid var(--app-border);
  border-radius: 8px;
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.08);
}

.syllabus-sidebar,
.syllabus-editor,
.type-list,
.lesson-list,
.editor-section,
.list-editor,
.vocabulary-list {
  display: grid;
  gap: 14px;
}

.section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.section-heading span {
  color: var(--app-text-soft);
  font-size: 12px;
}

.section-heading-lessons {
  margin-top: 12px;
}

.type-card,
.vocabulary-card {
  padding: 14px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-card-bg);
}

.type-card-top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: var(--app-text-strong);
}

.type-card p {
  margin: 10px 0 8px;
  color: var(--app-text-muted);
  line-height: 1.5;
}

.type-card small {
  color: var(--app-text-soft);
}

.lesson-button {
  width: 100%;
  display: grid;
  gap: 6px;
  text-align: left;
  padding: 14px;
  border-radius: 8px;
  border: 1px solid var(--app-border);
  background: var(--app-card-bg);
  color: var(--app-text);
  cursor: pointer;
}

.lesson-button.active {
  border-color: var(--app-accent);
  box-shadow: inset 0 0 0 1px var(--app-accent);
}

.lesson-button span {
  color: var(--app-text-soft);
  font-size: 12px;
}

.form-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.field {
  display: grid;
  gap: 8px;
}

.field span {
  font-size: 13px;
  color: var(--app-text-muted);
}

.field-input {
  width: 100%;
  min-height: 42px;
  padding: 10px 12px;
  border: 1px solid var(--app-border-strong);
  border-radius: 8px;
  background: var(--app-card-bg);
  color: var(--app-text-strong);
  font: inherit;
  box-sizing: border-box;
}

.field-textarea {
  min-height: 72px;
  resize: vertical;
}

.list-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
}

.checkbox-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
  color: var(--app-text-muted);
}

.checkbox-row small {
  color: var(--app-text-soft);
}

.add-button,
.remove-button {
  min-height: 40px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid var(--app-border);
  background: var(--app-soft-bg);
  color: var(--app-text);
  cursor: pointer;
}

.remove-button {
  color: var(--app-danger);
}

@media (max-width: 1100px) {
  .syllabus-header,
  .syllabus-layout,
  .form-grid,
  .list-row {
    grid-template-columns: 1fr;
  }

  .syllabus-actions {
    justify-content: start;
  }
}
</style>
