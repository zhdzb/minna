<template>
  <main class="vocabulary-page">
    <header class="vocabulary-header">
      <div>
        <p class="vocabulary-eyebrow">N5–N4 高频核心词</p>
        <h1>单词本</h1>
      </div>
      <el-button :loading="loading" @click="loadBook">刷新</el-button>
    </header>

    <section class="vocabulary-summary" aria-label="词汇进度">
      <div class="summary-item">
        <span>总词数</span>
        <strong>{{ summary.total }}</strong>
      </div>
      <div class="summary-item status-new">
        <span>新词</span>
        <strong>{{ summary.new }}</strong>
      </div>
      <div class="summary-item status-learning">
        <span>学习中</span>
        <strong>{{ summary.learning }}</strong>
      </div>
      <div class="summary-item status-due">
        <span>今日到期</span>
        <strong>{{ summary.due }}</strong>
      </div>
      <div class="summary-item status-mastered">
        <span>已掌握</span>
        <strong>{{ summary.mastered }}</strong>
      </div>
    </section>

    <section class="vocabulary-controls">
      <el-input
        v-model="query"
        clearable
        placeholder="搜索单词、假名或中文"
        class="vocabulary-search"
      />
      <el-segmented v-model="levelFilter" :options="levelOptions" />
      <el-select v-model="statusFilter" aria-label="掌握状态">
        <el-option
          v-for="option in statusOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
    </section>

    <el-alert
      v-if="errorMessage"
      :title="errorMessage"
      type="error"
      show-icon
      :closable="false"
      class="vocabulary-error"
    />

    <section class="vocabulary-table-band">
      <el-table
        v-loading="loading"
        :data="filteredItems"
        row-key="id"
        height="calc(100vh - 330px)"
        empty-text="没有符合条件的词"
      >
        <el-table-column prop="priority_rank" label="优先级" width="82" />
        <el-table-column label="词汇" min-width="170">
          <template #default="{ row }">
            <div class="word-cell">
              <strong>{{ row.word }}</strong>
              <span>{{ row.kana }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="meaning" label="中文义" min-width="190" />
        <el-table-column label="等级" width="76">
          <template #default="{ row }">
            <el-tag :type="row.estimated_level === 'N5' ? 'info' : 'warning'" effect="plain">
              {{ row.estimated_level }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="场景" width="106" />
        <el-table-column label="状态" width="108">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row)" effect="light">
              {{ statusLabel(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="正确/出现" width="104">
          <template #default="{ row }">
            {{ row.correct_count }}/{{ row.seen_count }}
          </template>
        </el-table-column>
        <el-table-column label="能力证据" min-width="190">
          <template #default="{ row }">
            <div class="mode-evidence">
              <span>输出 {{ modeScore(row, 'production') }}</span>
              <span>阅读 {{ modeScore(row, 'reading') }}</span>
              <span>听力 {{ modeScore(row, 'listening') }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="下次复习" width="116">
          <template #default="{ row }">
            <span :class="{ 'due-date': row.is_due }">{{ row.due_date || '—' }}</span>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <footer class="vocabulary-footer">
      显示 {{ filteredItems.length }} / {{ summary.total }} 个词
    </footer>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { createAgentStudyClient } from '@/utils/agentStudyClient'

const loading = ref(false)
const errorMessage = ref('')
const items = ref([])
const summary = ref({
  total: 0,
  new: 0,
  learning: 0,
  review: 0,
  mastered: 0,
  due: 0,
  n5: 0,
  n4: 0
})
const query = ref('')
const levelFilter = ref('全部')
const statusFilter = ref('all')

const levelOptions = ['全部', 'N5', 'N4']
const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '新词', value: 'new' },
  { label: '学习中', value: 'learning' },
  { label: '待复习', value: 'review' },
  { label: '今日到期', value: 'due' },
  { label: '已掌握', value: 'mastered' }
]

const normalizeSearch = (value) => String(value || '').normalize('NFKC').toLowerCase().trim()

const filteredItems = computed(() => {
  const search = normalizeSearch(query.value)
  return items.value.filter((item) => {
    if (levelFilter.value !== '全部' && item.estimated_level !== levelFilter.value) return false
    if (statusFilter.value === 'due' && !item.is_due) return false
    if (
      statusFilter.value !== 'all' &&
      statusFilter.value !== 'due' &&
      item.status !== statusFilter.value
    ) {
      return false
    }
    if (!search) return true
    return [item.word, item.kana, item.meaning, item.category].some((value) =>
      normalizeSearch(value).includes(search)
    )
  })
})

const statusLabel = (item) => {
  if (item.is_due) return '今日到期'
  return {
    new: '新词',
    learning: '学习中',
    review: '待复习',
    mastered: '已掌握'
  }[item.status] || item.status
}

const statusTagType = (item) => {
  if (item.is_due) return 'danger'
  return {
    new: 'info',
    learning: 'warning',
    review: 'primary',
    mastered: 'success'
  }[item.status] || 'info'
}

const modeScore = (item, mode) => {
  const value = item.modes?.[mode]
  return `${value?.correct_count || 0}/${value?.seen_count || 0}`
}

const loadBook = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const payload = await createAgentStudyClient().loadVocabulary()
    items.value = Array.isArray(payload?.items) ? payload.items : []
    summary.value = payload?.summary || summary.value
  } catch (error) {
    errorMessage.value = `单词本加载失败：${error.message}`
  } finally {
    loading.value = false
  }
}

onMounted(loadBook)
</script>

<style scoped>
.vocabulary-page {
  min-width: 0;
  color: var(--app-text);
}

.vocabulary-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  padding: 4px 0 20px;
  border-bottom: 1px solid var(--app-border);
}

.vocabulary-header h1 {
  margin: 4px 0 0;
  color: var(--app-text-strong);
  font-size: 30px;
  line-height: 1.2;
  letter-spacing: 0;
}

.vocabulary-eyebrow {
  margin: 0;
  color: var(--app-text-soft);
  font-size: 13px;
}

.vocabulary-summary {
  display: grid;
  grid-template-columns: repeat(5, minmax(110px, 1fr));
  border-bottom: 1px solid var(--app-border);
}

.summary-item {
  min-width: 0;
  padding: 18px 20px;
  border-right: 1px solid var(--app-border);
}

.summary-item:last-child {
  border-right: 0;
}

.summary-item span {
  display: block;
  color: var(--app-text-soft);
  font-size: 13px;
}

.summary-item strong {
  display: block;
  margin-top: 5px;
  color: var(--app-text-strong);
  font-size: 24px;
}

.status-new strong {
  color: #64748b;
}

.status-learning strong {
  color: #b45309;
}

.status-due strong {
  color: #be123c;
}

.status-mastered strong {
  color: #15803d;
}

.vocabulary-controls {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto 160px;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
}

.vocabulary-search {
  max-width: 480px;
}

.vocabulary-error {
  margin-bottom: 14px;
}

.vocabulary-table-band {
  min-width: 0;
  border-top: 1px solid var(--app-border);
  border-bottom: 1px solid var(--app-border);
}

.word-cell {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.word-cell strong {
  color: var(--app-text-strong);
  font-size: 16px;
  overflow-wrap: anywhere;
}

.word-cell span {
  color: var(--app-text-soft);
  font-size: 12px;
}

.mode-evidence {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 10px;
  color: var(--app-text-muted);
  font-size: 12px;
}

.due-date {
  color: #be123c;
  font-weight: 700;
}

.vocabulary-footer {
  padding-top: 12px;
  color: var(--app-text-soft);
  font-size: 12px;
  text-align: right;
}

@media (max-width: 900px) {
  .vocabulary-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .summary-item {
    border-bottom: 1px solid var(--app-border);
  }

  .vocabulary-controls {
    grid-template-columns: 1fr;
  }

  .vocabulary-search {
    max-width: none;
  }
}
</style>
