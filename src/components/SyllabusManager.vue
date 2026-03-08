<template>
  <div>
    <el-card shadow="never" style="margin-bottom: 20px;">
      <template #header>
        <div style="font-size: 1.2rem; font-weight: bold;">
          📚 知识大纲与题库字典管理 (Syllabus & Type CRUD)
        </div>
      </template>
      <p style="color: #666; font-size: 0.9rem;">
        您可以在此自建独属于您的考点组合。AI 将在出题时严格受到这些准绳的约束。
      </p>
    </el-card>
    
    <el-row :gutter="20">
      <!-- 左侧：课程导航 -->
      <el-col :span="6">
        <el-card shadow="hover">
          <template #header>课程目录</template>
          <div style="max-height: 65vh; overflow-y: auto; padding-right: 5px;" class="custom-scrollbar">
            <el-menu
              :default-active="selectedLesson ? selectedLesson.id.toString() : '1'"
              @select="handleSelectLesson"
              style="border-right: none;"
            >
              <el-menu-item v-for="lesson in syllabus.lessons" :key="lesson.id" :index="lesson.id.toString()">
                {{ lesson.title }}
              </el-menu-item>
            </el-menu>
          </div>
        </el-card>
      </el-col>

      <!-- 右侧：当前课时配置表单 -->
      <el-col :span="18">
        <el-card shadow="hover" v-if="selectedLesson">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span><strong>{{ selectedLesson.title }}</strong> 大纲配置编辑</span>
              <el-button type="success" size="small" @click="saveSyllabusOverride">💾 保存该课配置</el-button>
            </div>
          </template>
          
          <el-form label-position="top">
            
            <el-form-item label="核心语法点 (Grammar Points)：">
              <div v-for="(point, idx) in selectedLesson.grammar_points" :key="idx" style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;">
                <el-input v-model="selectedLesson.grammar_points[idx]" placeholder="如：N1 は N2 です" />
                <el-button type="danger" text plain @click="selectedLesson.grammar_points.splice(idx, 1)">删除</el-button>
              </div>
              <el-button type="primary" plain size="small" @click="selectedLesson.grammar_points.push('')">+ 增加核心语法</el-button>
            </el-form-item>

            <el-divider />

            <el-form-item label="隐性感悟 / 职场语感 (Hidden Knowledge)：">
              <p style="font-size: 0.8rem; color: #888; margin-top: -10px; margin-bottom: 15px;">AI 将尝试把这些要点融入“职场对话补全”等题型的情境中。</p>
              <div v-for="(hk, idx) in selectedLesson.hidden_knowledge" :key="idx" style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;">
                <el-input v-model="selectedLesson.hidden_knowledge[idx]" placeholder="如：日本职场的初次见面鞠躬寒暄表达" />
                <el-button type="danger" text plain @click="selectedLesson.hidden_knowledge.splice(idx, 1)">删除</el-button>
              </div>
              <el-button type="primary" plain size="small" @click="selectedLesson.hidden_knowledge.push('')">+ 增加语感考查</el-button>
            </el-form-item>

            <el-divider />

            <el-form-item label="当前课时激活题型集合 (Enabled Types)：">
              <el-checkbox-group v-model="selectedLesson.enabled_types">
                 <el-checkbox 
                    v-for="typeDef in allTypes.pools" 
                    :key="typeDef.id" 
                    :label="typeDef.id"
                 >
                    {{ typeDef.label }}
                 </el-checkbox>
              </el-checkbox-group>
            </el-form-item>
            
          </el-form>
        </el-card>

        <el-card shadow="never" style="margin-top: 20px; border-style: dashed; background-color: #fcfcfc;">
            <div style="text-align: center; color: #999;">
                <p>全局字典管理器：您想创造一种全新的题型？ (如: 看日剧截图猜对话)</p>
                <el-button type="info" size="small" @click="addTypeDialogVisible = true">⚙️ 配置全局题型池 (Types Pool)</el-button>
            </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 添加题型弹窗 -->
    <el-dialog v-model="addTypeDialogVisible" title="创造新题型范式" width="500px">
      <el-form label-position="top">
         <el-form-item label="唯一标识符 (ID)：">
            <el-input v-model="newTypeForm.id" placeholder="如：q_listen_guess" />
         </el-form-item>
         <el-form-item label="展示标签 (Label)：">
            <el-input v-model="newTypeForm.label" placeholder="如：🎧 听音辨意挑战" />
         </el-form-item>
         <el-form-item label="AI 识别描述 (Description)：">
            <el-input type="textarea" v-model="newTypeForm.description" placeholder="系统将把这段话喂给 AI，告诉它这种题怎么出..." />
         </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="addTypeDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitNewType">永久添加至字典池</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import defaultSyllabus from '@/data/syllabus.json'
import typesDict from '@/data/types.json'
import { ElMessage } from 'element-plus'

const syllabus = ref(defaultSyllabus)
const allTypes = ref(typesDict)
const selectedLesson = ref(null)

const addTypeDialogVisible = ref(false)
const newTypeForm = ref({ id: '', label: '', description: '' })

onMounted(() => {
    if (syllabus.value.lessons.length > 0) {
        selectedLesson.value = syllabus.value.lessons[0]
    }
})

const handleSelectLesson = (index) => {
    selectedLesson.value = syllabus.value.lessons.find(l => l.id.toString() === index)
}

const saveSyllabusOverride = () => {
    // Phase 4可持久化写入后端或LocalStorage，此处作内存级演练
    ElMessage({
        message: '该课的大纲配置已保存并在本次会话生效。AI 的生成流出题将立即受此约束！',
        type: 'success',
        duration: 3000
    })
}

const submitNewType = () => {
    allTypes.value.pools.push({...newTypeForm.value})
    ElMessage.success(`全新题型集 ${newTypeForm.value.label} 已熔炼入库！现在可以在上方分配给任意课时了。`)
    addTypeDialogVisible.value = false
    newTypeForm.value = { id: '', label: '', description: '' }
}
</script>
