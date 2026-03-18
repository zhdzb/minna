/**
 * API Skill: 智能批改造句题
 * 职责：接收用户做完的一组造句题，打包发给模型进行批改和解析，并支持罗马音宽容规则。
 */
export default class EvaluateSentenceSkill {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = "https://openrouter.ai/api/v1/chat/completions";
        this.model = "nvidia/nemotron-3-super-120b-a12b:free";
    }

    _buildSystemPrompt(currentLesson, batchArray) {
        let taskString = batchArray.map((item, index) => {
            return `【任务 ${index + 1}】\n- 题目ID: ${item.id}\n- 中文原题意: "${item.original_prompt}"\n- 用户的答案: "${item.user_answer}"`;
        }).join('\n\n');

        return `你是一个耐心的日语外教。任务是同时批改多道初学者的造句练习。
当前学习者进度：《大家的日语》第 1 到 ${currentLesson} 课。

【批改准则（核心约束）】：
1. 罗马音宽容：如果用户答案包含【纯英文字母拼写的罗马音】（如 watashi wa...），请将其视作对应的平假名进行同标准批改，坚决不能直接判错，但必须在反馈中用【假名】给出正确结果并提示其假名拼法。
2. 汉字/假名双轨判定：如果单词的发音与假写是正确的，即便没有写成复杂的汉字，也必须判定为正确 (is_correct: true)。
3. 语序宽容：日语造句语序灵活（例如"明日 私は" vs "私は 明日"，"に"和"へ"互通等），只要语法传达无误，均判定正确。
4. 标点容错：忽略句末是否漏写句号。

【输出要求】
必须严格返回以下 JSON 数组格式（不要包含 markdown 代码块符号）：
[
  {
    "id": "对应题目的id",
    "is_correct": true, // 或 false
    "error_type": "无 / 助词错误 / 动词变形错误等",
    "correct_answer": "わたしは あした 京都へ 行きます。", // 给出带有正常汉字和假名的标准答案
    "explanation": "简短的一段中文名师解析，点明为什么错或为什么对",
    "natural_expression": "（可选）一句适用于赴日工作的更地道职场或母语者表达"
  }
]

【用户的答卷内容】：
${taskString}`;
    }

    async evaluate(currentLesson, batchArray) {
        if (!batchArray || batchArray.length === 0) return [];

        const sysPrompt = this._buildSystemPrompt(currentLesson, batchArray);

        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'X-Title': 'Minna no Nihongo Tutor'
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: "system", content: sysPrompt },
                        { role: "user", content: "请批改上述考题" }
                    ],
                    temperature: 0.2
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || "API Request Failed during evaluation");
            }

            const data = await response.json();
            const textResponse = data.choices[0].message.content;
            
            let cleanJsonStr = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJsonStr);
        } catch (error) {
            console.error("EvaluateSentenceSkill Error:", error);
            // 兜底返回，防止应用崩溃
            return batchArray.map(item => ({
                id: item.id,
                is_correct: false,
                error_type: "Network_Error",
                correct_answer: "无法连接到 AI",
                explanation: "批改服务网络异常，请稍后重试。"
            }));
        }
    }
}
