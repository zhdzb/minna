/**
 * API Skill: 生成练习题
 * 职责：只负责根据进度组装 Prompt 发送给 Gemini，并清洗返回的 JSON
 */
export default class GenerateGrammarExerciseSkill {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
        this.maxRetries = 3;
        this.timeoutMs = 120000;
    }

    _buildSystemPrompt(context) {
        // 解构新的深度大纲上下文
        const { lesson, grammar_points, hidden_knowledge, config, recent_exercises } = context;
        const difficulty = config?.difficulty || '基础巩固';
        const customPrompt = config?.customPrompt || '';
        const targetType = config?.questionType || 'ALL';
        const questionCount = config?.questionCount || 10;

        let prompt = `你是一个非常专业的、具有多年经验的日本语教师和 JLPT 考官。
你要为学生生成一套高度定制化的日语练习题。

【1. 出题范围严格界定 (不可越界生词)】
当前学习进度：『大家的日语』 ${lesson}
本次核心语法点(必须覆盖)：
${grammar_points.join('\n- ')}

本次附加隐性感悟/语感难点(尝试融入情景)：
${hidden_knowledge.join('\n- ')}

【1.1 语法点覆盖强制轮询 (绝对遵守！)】
每个语法点都必须至少出 1 道题！target_grammar 字段必须精确匹配上述语法点列表中的文字。
如果语法点数量(${grammar_points.length}) > 题目数量(${questionCount})，则优先覆盖核心语法点。
输出前自检：逐一核对每个 target_grammar 是否存在于上述语法点列表中。

【2. 动态定制化要求】
- 学习者要求的难度阶梯：【${difficulty}】 (请相应调整词汇的生僻度、句子的阅读长度，如果是JLPT级，请设置混淆项)。
- 学习者输入的特殊强调(Custom Prompt)：【${customPrompt ? customPrompt : '无特殊限制'}】

【3. 题型与数量约束 (非常重要！)】
严格警告：你必须且只能精确输出正好 ${questionCount} 道题，不可多也不可少！
`;
        
        if (targetType === 'ALL') {
            const splitFill = Math.ceil(questionCount * 0.4);
            const splitTrans = Math.ceil(questionCount * 0.4);
            const splitConv = questionCount - splitFill - splitTrans;
            prompt += `请生成总计 EXACTLY ${questionCount} 道混合题目：包含 ${splitFill} 道【基础助词选择(q_fill)】，${splitTrans} 道【降维翻译造句(q_translate)】，${splitConv} 道【职场商务情景对话(q_conversation)】。`;
        } else if (targetType === 'q_fill') {
            prompt += `【专项拉练模式】请生成 EXACTLY ${questionCount} 道【基础助词选择(q_fill)】，考察语法点中的助词变化。`;
        } else if (targetType === 'q_translate') {
            prompt += `【专项拉练模式】请生成 EXACTLY ${questionCount} 道【降维翻译造句(q_translate)】，给出中文要求写日语长句。必须附带 vocab_hints 卡片。`;
        } else if (targetType === 'q_conversation') {
            prompt += `【专项拉练模式】请生成 EXACTLY ${questionCount} 道【职场商务情景对话(q_conversation)】，模拟A和B在日本公司的交流，要求学习者补全符合职场身份的对话。`;
        }

        // 添加题目去重逻辑
        if (recent_exercises && recent_exercises.length > 0) {
            prompt += `

【3.1 题目去重约束 (严格禁止重复！)】
以下题目已生成过，绝对禁止重复！重复判定标准：
1. 禁止使用相同的中文提示语句
2. 禁止使用相同的日语例句
3. 禁止使用相同的场景设定
4. 禁止使用相同的核心词汇组合（超过50%相同视为重复）

已生成题目清单：
${JSON.stringify(recent_exercises.slice(0, 15), null, 2)}

输出前自检：逐一比对新生成的每道题与上述清单，确保无任何重复。`;
        }

        prompt += `

【4. 输出约束与 JSON 结构参考】
1. 绝对不要返回任何 Markdown \`\`\`json 标记，直接返回纯净的 JSON 字符串！
2. 你必须返回一个包含 "exercises" 键的对象，该键的值是一个包含题目对象的数组。
   结构如下： { "exercises": [ {...}, {...} ] }
3. 每道题的 JSON 对象必须包含：
  - "id" 唯一字符串
  - "type": "q_fill" | "q_translate" | "q_conversation"
  - "question" 或 "chinese_prompt"
  - "target_grammar": 标注这道题考查的是上述语法点中的哪一个（非常重要，用于成绩细分）

【5. 特殊人名与专有名词要求 (必须遵守)】
如果你在造句中（尤其在情景对话或翻译题中）生造了人名（如：木村、山田、田中）或日本特有的专有名词、地名，**必须强制将其放入 \`vocab_hints\` 数组中提供假名读音作为提示**！因为学习者可能懂语法但不知道人名怎么拼。

【5.1 词汇范围硬约束】
所有题目中出现的日语词汇必须严格限定在当前课程（${lesson}）及之前课程的范围内。
禁止使用任何超出此范围的词汇，除非在 vocab_hints 中明确标注并提供假名注音。

【5.2 核心词汇强制提示规则 (No-Assumption Policy)】
对于 q_translate (翻译造句) 型，**严禁** 主观假设某个单词对学生是简单的。
你 **必须** 为中文提示中出现的 **每一个** 核心名词、动词、形容词提供 vocab_hints。
例如：中文提示包含“关窗户”，你 **必须** 提供“窗户(窓)”和“关上(閉める)”的提示，即使你认为它们很简单。

【6. 唯一答案绝对约束 (消灭主观歧义)】
对于选择题 (q_fill)，**绝对不允许**出现所有选项在语法和逻辑上都能填入空格且都正确的情况！
你**必须**在题干中提供足以唯一锁定答案的中文提示或强烈上下文语境。

【7. q_conversation 题型特殊格式】
对于 q_conversation 类型，必须包含：
- "scene_description": 场景描述
- "turns": 对话轮次数组，每个元素包含 "speaker" (A/B) 和 "content"
- "missing_turn_index": 需要学习者补全的轮次索引
- "answer": 正确答案

【8. Few-Shot 示例参考】

**JSON 整体结构示例 (包裹在 exercises 键中)：**
{
  "exercises": [
    {
      "id": "fill_example_1",
      "type": "q_fill",
      "target_grammar": "N1 は N2 です",
      "question": "那是书。[指着稍远处] (___) は 本 です。",
      "options": ["それ", "这", "あれ"],
      "answer": "それ"
    },
    {
      "id": "trans_example_1",
      "type": "q_translate",
      "target_grammar": "～を ～ます",
      "chinese_prompt": "田中先生每天在图书馆看书",
      "vocab_hints": [
        {"word": "田中", "kana": "たなか", "cn": "田中"},
        {"word": "图书馆", "kana": "としょかん", "cn": "图书馆"},
        {"word": "毎日", "kana": "まいにち", "cn": "每天"},
        {"word": "本", "kana": "ほん", "cn": "书"}
      ],
      "answer_pattern": "たなかさんは まいにち としょかんで ほんを よみます。"
    }
  ]
}

【9. 最终质量检查清单 (输出前必须逐项确认，任何一项不通过则重新生成)】
□ 题目数量精确等于 ${questionCount} 道
□ 结果包裹在 {"exercises": [...]} 结构中
□ 每题都有唯一 id
□ 每道题的 target_grammar 都在语法点列表中
□ 语法点覆盖度 >= 80%
□ q_fill 题目选项有且仅有唯一正确答案
□ JSON 格式正确，无 markdown 包裹
□ 所有日语假名使用正确
□ 未使用超出当前课程范围的语法或词汇`;

        return prompt;
    }

    async _fetchWithTimeout(url, options) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            return response;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async _fetchWithRetry(url, options) {
        let lastError;
        
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                return await this._fetchWithTimeout(url, options);
            } catch (error) {
                lastError = error;
                if (error.name === 'AbortError') {
                    throw new Error(`API 请求超时 (${this.timeoutMs}ms)`);
                }
                if (attempt < this.maxRetries - 1) {
                    const delay = Math.pow(2, attempt) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw lastError;
    }

    _validateApiResponse(data) {
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof text !== 'string' || text.trim() === '') {
            throw new Error('API 响应结构无效：无法获取有效的文本内容');
        }
        return text;
    }

    _validateExercises(parsed, expectedGrammarPoints = []) {
        let exercises;
        // 增强鲁棒性：兼容直接返回数组和包裹在 exercises 键中两种情况
        if (Array.isArray(parsed)) {
            exercises = parsed;
            // 自动转换为标准结构，方便后续代码统一访问
            parsed = { exercises: exercises };
        } else {
            exercises = parsed?.exercises;
        }

        if (!Array.isArray(exercises)) {
            console.error("Invalid AI structure:", parsed);
            throw new Error('AI 返回数据格式错误：缺少 exercises 数组');
        }

        const requiredFields = ['id', 'type', 'target_grammar'];
        for (let i = 0; i < exercises.length; i++) {
            const exercise = exercises[i];
            for (const field of requiredFields) {
                if (!exercise[field]) {
                    throw new Error(`第 ${i + 1} 题缺少必要字段: ${field}`);
                }
            }
            if (!['q_fill', 'q_translate', 'q_conversation'].includes(exercise.type)) {
                throw new Error(`第 ${i + 1} 题 type 无效: ${exercise.type}`);
            }
            // 验证 target_grammar 是否在预期语法点列表中
            if (expectedGrammarPoints.length > 0) {
                const isValidGrammar = expectedGrammarPoints.some(gp => 
                    exercise.target_grammar.includes(gp) || gp.includes(exercise.target_grammar)
                );
                if (!isValidGrammar) {
                    console.warn(`⚠️ 第 ${i + 1} 题 target_grammar "${exercise.target_grammar}" 不在预期语法点列表中`);
                }
            }

            // q_conversation 题型特殊验证
            if (exercise.type === 'q_conversation') {
                if (!exercise.scene_description) {
                    throw new Error(`第 ${i + 1} 题 q_conversation 缺少 scene_description`);
                }
                if (!Array.isArray(exercise.turns) || exercise.turns.length < 2) {
                    throw new Error(`第 ${i + 1} 题 q_conversation turns 数组无效或轮次不足`);
                }
                if (typeof exercise.missing_turn_index !== 'number') {
                    throw new Error(`第 ${i + 1} 题 q_conversation 缺少 missing_turn_index`);
                }
            }

            // q_fill 题型选项验证
            if (exercise.type === 'q_fill') {
                if (!exercise.question) {
                    throw new Error(`第 ${i + 1} 题 q_fill 缺少 question`);
                }
                if (!Array.isArray(exercise.options) || exercise.options.length < 2) {
                    throw new Error(`第 ${i + 1} 题 q_fill 选项不足`);
                }
                if (!exercise.answer) {
                    throw new Error(`第 ${i + 1} 题 q_fill 缺少 answer`);
                }
            }

            // q_translate 题型验证
            if (exercise.type === 'q_translate') {
                if (!exercise.chinese_prompt) {
                    throw new Error(`第 ${i + 1} 题 q_translate 缺少 chinese_prompt`);
                }
                if (!exercise.answer_pattern && !exercise.answer) {
                    throw new Error(`第 ${i + 1} 题 q_translate 缺少 answer_pattern 或 answer`);
                }
                // 强度验证：如果没有提示词，或者提示词太少（通常核心名词+动词至少2个），则警告
                if (!exercise.vocab_hints || exercise.vocab_hints.length < 2) {
                    console.warn(`⚠️ 第 ${i + 1} 题 (q_translate) 的 vocab_hints 数量可能不足 (${exercise.vocab_hints?.length || 0})，请检查是否遗漏核心动词/名词提示。`);
                }
            }
        }

        // 语法点覆盖度检查
        if (expectedGrammarPoints.length > 0) {
            const coveredGrammars = new Set();
            exercises.forEach(ex => {
                expectedGrammarPoints.forEach(gp => {
                    if (ex.target_grammar.includes(gp) || gp.includes(ex.target_grammar)) {
                        coveredGrammars.add(gp);
                    }
                });
            });
            const coverage = coveredGrammars.size / expectedGrammarPoints.length;
            console.log(`📊 语法点覆盖度: ${coveredGrammars.size}/${expectedGrammarPoints.length} (${(coverage * 100).toFixed(1)}%)`);
            if (coverage < 0.6) {
                console.warn(`⚠️ 语法点覆盖度偏低，仅覆盖 ${coveredGrammars.size} 个语法点`);
            }
        }

        return parsed;
    }

    async generate(context) {
        const sysPrompt = this._buildSystemPrompt(context);
        
        try {
            const response = await this._fetchWithRetry(`${this.baseUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: "请基于系统指令，直接输出纯净JSON结构的题目数据。确保输出不被截断。" }]
                    }],
                    systemInstruction: {
                        parts: [{ text: sysPrompt }]
                    },
                    generationConfig: {
                        temperature: 0.15,
                        topP: 0.7,
                        topK: 20,
                        maxOutputTokens: 32768,
                        responseMimeType: "application/json"
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`API 请求失败: ${response.status}`);
            }

            const data = await response.json();
            const textResponse = this._validateApiResponse(data);
            
            let cleanJsonStr = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            
            let parsed;
            try {
                parsed = JSON.parse(cleanJsonStr);
            } catch (parseError) {
                throw new Error(`JSON 解析失败: ${parseError.message}`);
            }

            return this._validateExercises(parsed, context.grammar_points || []);
        } catch (error) {
            console.error("GenerateGrammarExerciseSkill Error:", error);
            throw new Error("AI生成失败，原因: " + error.message);
        }
    }
}
