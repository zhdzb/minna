/**
 * App.js: 核心前端应用控制器
 */

// 实例化 Skills
const generateSkill = new GenerateGrammarExerciseSkill(CONFIG.GEMINI_API_KEY);
const evaluateSkill = new EvaluateSentenceSkill(CONFIG.GEMINI_API_KEY);

// 缓存状态
let currentExercises = [];
let currentQuestionIndex = 0;
let userAnswers = {}; // { exerciseId: "回答" }

// DOM 元素引用
const els = {
    // 导航与状态
    currentLesson: document.getElementById('ui-current-lesson'),
    mistakesCount: document.getElementById('ui-mistakes-count'),
    dashLessonNum: document.getElementById('dash-lesson-num'),
    // 面板
    panelDashboard: document.getElementById('panel-dashboard'),
    panelTraining: document.getElementById('panel-dashboard'), // Fix later 
    panelTrainingReal: document.getElementById('panel-training'),
    panelResults: document.getElementById('panel-results'),
    // 按钮
    btnHome: document.getElementById('btn-home'),
    btnStart: document.getElementById('btn-start-training'),
    btnPrev: document.getElementById('btn-prev-question'),
    btnNext: document.getElementById('btn-next-question'),
    btnSubmit: document.getElementById('btn-submit-batch'),
    btnFinish: document.getElementById('btn-finish-review'),
    // 动态容器
    loader: document.getElementById('loader-overlay'),
    containerExercise: document.getElementById('exercise-container'),
    containerResults: document.getElementById('results-container'),
    trainingProgress: document.getElementById('training-progress')
};

// 初始化 App
function initApp() {
    refreshDashboardStats();
    bindEvents();
    switchPanel('dashboard');
}

// 刷新顶部状态
function refreshDashboardStats() {
    const data = LocalState.getData();
    els.currentLesson.textContent = data.progress.current_lesson;
    els.dashLessonNum.textContent = data.progress.current_lesson;
    els.mistakesCount.textContent = data.mistakes_book.length;
}

// 绑定全局事件
function bindEvents() {
    els.btnHome.addEventListener('click', () => switchPanel('dashboard'));
    els.btnStart.addEventListener('click', startTrainingSession);
    els.btnPrev.addEventListener('click', () => navigateQuestion(-1));
    els.btnNext.addEventListener('click', () => navigateQuestion(1));
    els.btnSubmit.addEventListener('click', submitForEvaluation);
    els.btnFinish.addEventListener('click', () => {
        LocalState.updateProgress(LocalState.getData().progress.current_lesson + 1);
        initApp(); // 回到首页并刷新进度
    });
}

function switchPanel(panelName) {
    els.panelDashboard.classList.remove('active');
    els.panelTrainingReal.classList.remove('active');
    els.panelResults.classList.remove('active');
    
    if (panelName === 'dashboard') els.panelDashboard.classList.add('active');
    if (panelName === 'training') els.panelTrainingReal.classList.add('active');
    if (panelName === 'results') els.panelResults.classList.add('active');
}

// 开始一轮新训练
async function startTrainingSession() {
    switchPanel('training');
    els.loader.classList.remove('hidden');
    els.containerExercise.innerHTML = '';
    hideTrainingNav();
    
    const data = LocalState.getData();
    // 组装 Context
    const context = {
        currentLesson: data.progress.current_lesson,
        mistakes: data.mistakes_book.slice(-5).map(m => `对于【${m.grammar_point}】曾将 ${m.correct_answer} 错误写成了 ${m.user_wrong_input}`)
    };

    // 调用出题 Skill
    const result = await generateSkill.generate(context);
    
    currentExercises = result.exercises || [];
    currentQuestionIndex = 0;
    userAnswers = {};

    els.loader.classList.add('hidden');
    
    if (currentExercises.length === 0) {
        els.containerExercise.innerHTML = '<p class="error">出题失败，请检查网络或 API Key。</p>';
        return;
    }

    renderCurrentQuestion();
}

function hideTrainingNav() {
    els.btnPrev.classList.add('hidden');
    els.btnNext.classList.add('hidden');
    els.btnSubmit.classList.add('hidden');
}

function renderCurrentQuestion() {
    const exercise = currentExercises[currentQuestionIndex];
    els.trainingProgress.textContent = `${currentQuestionIndex + 1} / ${currentExercises.length}`;
    hideTrainingNav();

    if (currentQuestionIndex > 0) els.btnPrev.classList.remove('hidden');
    if (currentQuestionIndex < currentExercises.length - 1) {
        els.btnNext.classList.remove('hidden');
    } else {
        els.btnSubmit.classList.remove('hidden');
    }

    let html = `<div class="exercise-card" id="ex-${exercise.id}">
        <span class="ex-type-badge">${exercise.type === 'level_1_fill' ? '基础填空' : '翻译造句'}</span>
        <div class="ex-question">${exercise.question || exercise.chinese_prompt}</div>
    `;

    if (exercise.type === 'level_2_translate' && exercise.vocab_hints) {
        html += `<div class="vocab-hints">`;
        exercise.vocab_hints.forEach(hint => {
            html += `<div class="hint-item">
                <span class="hint-kana">${hint.kana}</span>
                <span class="hint-kanji">${hint.word}</span>
                <span class="hint-cn">${hint.cn}</span>
            </div>`;
        });
        html += `</div>`;
        
        let existingAnswer = userAnswers[exercise.id] || '';
        html += `<input type="text" class="user-input-box" id="input-${exercise.id}" placeholder="在这里输入日语罗马音或假名..." value="${existingAnswer}" autocomplete="off">`;
    } else if (exercise.type === 'level_1_fill') {
        html += `<div class="options-grid">`;
        exercise.options.forEach(opt => {
            const isSelected = userAnswers[exercise.id] === opt ? 'selected' : '';
            html += `<button class="option-btn ${isSelected}" onclick="selectOption('${exercise.id}', '${opt}')">${opt}</button>`;
        });
        html += `</div>`;
    }

    html += `</div>`;
    els.containerExercise.innerHTML = html;

    // 绑定罗马音输入法 WanaKana
    if (exercise.type === 'level_2_translate') {
        const inputEl = document.getElementById(`input-${exercise.id}`);
        // WanaKana 会自动把英文字母转化为假名
        if (typeof wanakana !== 'undefined') {
            wanakana.bind(inputEl, { IMEMode: true });
        }
        inputEl.addEventListener('input', (e) => {
            userAnswers[exercise.id] = e.target.value;
        });
    }
}

// 填空题选择逻辑
window.selectOption = function(exerciseId, option) {
    userAnswers[exerciseId] = option;
    renderCurrentQuestion(); // 重新渲染以更新高亮
};

function navigateQuestion(direction) {
    currentQuestionIndex += direction;
    renderCurrentQuestion();
}

// 提交批改
async function submitForEvaluation() {
    els.containerExercise.innerHTML = '';
    hideTrainingNav();
    els.loader.textContent = 'AI 老师正在认真批改你的答卷... (这大概需要几秒钟)';
    els.loader.classList.remove('hidden');

    const data = LocalState.getData();
    // 提取所有主观造句题发给 AI，填空题直接本地判分
    const translateExercises = currentExercises.filter(ex => ex.type === 'level_2_translate');
    const batchArray = translateExercises.map(ex => ({
        id: ex.id,
        original_prompt: ex.chinese_prompt,
        user_answer: userAnswers[ex.id] || ''
    }));

    let aiResults = [];
    if (batchArray.length > 0) {
        aiResults = await evaluateSkill.evaluate(data.progress.current_lesson, batchArray);
    }
    
    els.loader.classList.add('hidden');
    renderResults(aiResults);
    switchPanel('results');
}

// 渲染结果
function renderResults(aiResults) {
    let html = '';
    currentExercises.forEach(ex => {
        let isCorrect = false;
        let correctAnswer = '';
        let explanation = '';

        if (ex.type === 'level_1_fill') {
            // 本地直接对答案
            isCorrect = (userAnswers[ex.id] === ex.answer);
            correctAnswer = ex.answer;
            explanation = ex.explanation || "无";
        } else {
            // AI 批改结果
            const aiRes = aiResults.find(r => r.id === ex.id);
            if (aiRes) {
                 isCorrect = aiRes.is_correct;
                 correctAnswer = aiRes.correct_answer;
                 explanation = aiRes.explanation;
                 if(aiRes.natural_expression) explanation += `<br><br>💡 <b>职场加点料：</b>${aiRes.natural_expression}`;
            } else {
                 isCorrect = false;
                 explanation = '批改超时，请自行对照标准答案。';
            }
        }

        // 记入错题本
        if (!isCorrect) {
            LocalState.addMistake({
                lesson: LocalState.getData().progress.current_lesson,
                grammar_point: ex.type,
                user_wrong_input: userAnswers[ex.id] || "未填写",
                correct_answer: correctAnswer
            });
        }

        html += `
        <div class="result-card ${isCorrect ? 'correct' : 'incorrect'}">
            <div class="result-title">${ex.question || ex.chinese_prompt}</div>
            <div style="font-size:0.9rem; margin-bottom:5px;">你的答案: ${userAnswers[ex.id] || '-'}</div>
            <div class="result-correction">正解: ${correctAnswer}</div>
            <div class="result-explanation">${explanation}</div>
        </div>`;
    });

    els.containerResults.innerHTML = html;
    refreshDashboardStats(); // 刷新顶部的错题数字
}

// 启动应用
document.addEventListener('DOMContentLoaded', initApp);
