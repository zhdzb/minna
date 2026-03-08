/**
 * API Skill: 生成练习题
 * 职责：只负责根据进度组装 Prompt 发送给 Gemini，并清洗返回的 JSON
 */
export default class GenerateGrammarExerciseSkill {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    }

    _buildSystemPrompt(context) {
        // 解构新的深度大纲上下文
        const { lesson, grammar_points, hidden_knowledge, config } = context;
        const difficulty = config?.difficulty || '基础巩固';
        const customPrompt = config?.customPrompt || '';
        const targetType = config?.questionType || 'ALL';

        let prompt = `你是一个非常专业的、具有多年经验的日本语教师和 JLPT 考官。
你要为学生生成一套高度定制化的日语练习题。

【1. 出题范围严格界定 (不可越界生词)】
当前学习进度：『大家的日语』 ${lesson}
本次核心语法点(必须覆盖)：
${grammar_points.join('\n- ')}

本次附加隐性感悟/语感难点(尝试融入情景)：
${hidden_knowledge.join('\n- ')}

【2. 动态定制化要求】
- 学习者要求的难度阶梯：【${difficulty}】 (请相应调整词汇的生僻度、句子的阅读长度，如果是JLPT级，请设置混淆项)。
- 学习者输入的特殊强调(Custom Prompt)：【${customPrompt ? customPrompt : '无特殊限制'}】

【3. 题型与数量要求】
`;
        
        if (targetType === 'ALL') {
            prompt += `请生成总计 10 道以上的混合题目，包含 4 道【基础助词选择(q_fill)】，4 道【降维翻译造句(q_translate)】，2 道【职场商务情景对话(q_conversation)】。`;
        } else if (targetType === 'q_fill') {
            prompt += `【专项拉练模式】请生成 10 道【基础助词选择(q_fill)】，考察语法点中的助词变化。`;
        } else if (targetType === 'q_translate') {
            prompt += `【专项拉练模式】请生成 10 道【降维翻译造句(q_translate)】，给出中文要求写日语长句。必须附带 vocab_hints 卡片。`;
        } else if (targetType === 'q_conversation') {
            prompt += `【专项拉练模式】请生成 10 道【职场商务情景对话(q_conversation)】，模拟A和B在日本公司的交流，要求学习者补全符合职场身份的对话。`;
        }

        prompt += `

【4. 输出约束与 JSON 结构参考】
1. 绝对不要返回任何 Markdown \`\`\`json 标记，直接返回纯净的 JSON 字符串！
2. 每道题的 JSON 对象必须包含：
  - "id" 唯一字符串
  - "type": "q_fill" | "q_translate" | "q_conversation"
  - "question" 或 "chinese_prompt"
  - "target_grammar": 标注这道题考查的是上述语法点中的哪一个（非常重要，用于成绩细分）

JSON 示例：
{
  "exercises": [
    { "id": "1", "type": "q_fill", "target_grammar": "N1 は N2 です", "question": "わたしは 肉を (...)", "options": ["買います", "買いました"], "answer": "買います" },
    { "id": "2", "type": "q_translate", "target_grammar": "句子 か", "chinese_prompt": "我每天吃鸡蛋吗", "vocab_hints": [{"word": "毎日", "kana": "まいにち", "cn": "每天"}], "answer_pattern": "わたしは まいにち たまごを たべますか。" },
    { "id": "3", "type": "q_conversation", "target_grammar": "隐性难点：初次见面寒暄", "question": "A: おはようございます。新入社員の山田です。\nB: (...)", "answer_pattern": "おはようございます。どうぞよろしく。" }
  ]
}`;

        return prompt;
    }

    async generate(context) {
        const sysPrompt = this._buildSystemPrompt(context);
        
        try {
            const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: "请基于系统指令，直接输出纯净JSON结构的题目数据。" }]
                    }],
                    systemInstruction: {
                        parts: [{ text: sysPrompt }]
                    },
                    generationConfig: {
                        temperature: 0.7,
                        responseMimeType: "application/json"
                    }
                })
            });

            if (!response.ok) {
                throw new Error("API Request Failed");
            }

            const data = await response.json();
            const textResponse = data.candidates[0].content.parts[0].text;
            
            // 洗掉可能出现的 markdown
            let cleanJsonStr = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            
            return JSON.parse(cleanJsonStr);
        } catch (error) {
            console.error("GenerateGrammarExerciseSkill Error:", error);
            throw new Error("AI生成失败，原因: " + error.message);
        }
    }
}
