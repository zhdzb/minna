<template>
  <div>
    <el-card shadow="hover">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 1.2rem; font-weight: bold; color: #F56C6C;">
            📓 错题本 (复习与消除体系)
          </div>
          <el-button type="danger" plain @click="clearAll" :disabled="tableData.length === 0">清空错题本</el-button>
        </div>
      </template>

      <el-alert
        v-if="tableData.length === 0"
        title="太棒了！您的错题本空空如也"
        type="success"
        description="继续去训练营挑战自己吧！"
        show-icon
        :closable="false"
      />

      <el-table
        v-else
        :data="tableData"
        style="width: 100%"
        stripe
        :default-sort="{ prop: 'timestamp', order: 'descending' }"
      >
        <el-table-column prop="timestamp" label="记录时间" width="160" sortable>
           <template #default="scope">
             {{ formatTime(scope.row.timestamp) }}
           </template>
        </el-table-column>
        <el-table-column prop="lesson" label="知识来源" width="100" sortable>
           <template #default="scope">
             <el-tag size="small">第 {{ scope.row.lesson }} 课</el-tag>
           </template>
        </el-table-column>
        <el-table-column prop="grammar_point" label="题型追踪" width="150" sortable />
        <el-table-column label="你的作答 (易错点)" min-width="150">
           <template #default="scope">
             <span style="color: #F56C6C; text-decoration: line-through;">{{ scope.row.user_wrong_input || '(空白)' }}</span>
           </template>
        </el-table-column>
        <el-table-column prop="correct_answer" label="正解参考" min-width="170" style="color: #67C23A;">
           <template #default="scope">
             <div style="display: flex; align-items: center; gap: 8px;">
               <span style="color: #67C23A;">{{ scope.row.correct_answer }}</span>
               <el-button 
                  v-if="scope.row.type !== 'q_fill'"
                  size="small"
                  circle
                  icon="el-icon-headset"
                  @click="playAudio(scope.row.correct_answer)"
                  title="播报日语"
               >
                 🔊
               </el-button>
             </div>
           </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="scope">
            <el-button
              size="small"
              type="danger"
              plain
              @click="removeMistake(scope.row.id)"
              title="已掌握，从错题本中移除"
            >
              消除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMainStore } from '@/store/mainStore'
import { ElMessageBox, ElMessage } from 'element-plus'

const store = useMainStore()

// We compute directly off the reactive store array
const tableData = computed(() => store.mistakes_book)

const formatTime = (ts) => {
    if (!ts) return '未知时间';
    const d = new Date(ts);
    // YYYY-MM-DD HH:mm
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const removeMistake = (id) => {
   // Assuming store.mistakes_book is fully reactive
   const index = store.mistakes_book.findIndex(m => m.id === id);
   if (index !== -1) {
       store.mistakes_book.splice(index, 1);
       store.saveStateToLocal(); // persist immediately
       ElMessage({ type: 'success', message: '已从错题库中擦除！' })
   }
}

const clearAll = () => {
    ElMessageBox.confirm(
        '此操作将永久清空您所有的错题记录（不可恢复）, 是否继续?',
        '清空危险警告',
        {
          confirmButtonText: '确定清空',
          cancelButtonText: '点错了',
          type: 'warning',
        }
    ).then(() => {
        store.mistakes_book = [];
        store.saveStateToLocal();
        ElMessage({ type: 'success', message: '错题本已斩草除根！' })
    }).catch(() => {});
}

const playAudio = (text) => {
    if ('speechSynthesis' in window) {
        const sentences = new SpeechSynthesisUtterance(text);
        sentences.lang = 'ja-JP';
        sentences.rate = 0.85; 
        window.speechSynthesis.speak(sentences);
    } else {
        ElMessage({ type: 'error', message: '非常抱歉，您的浏览器不支持 Web Speech 语音引擎。' });
    }
}
</script>
