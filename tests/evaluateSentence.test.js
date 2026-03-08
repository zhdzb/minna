import { describe, it, expect, vi, beforeEach } from 'vitest'
import EvaluateSentenceSkill from '../src/skills/evaluateSentence.js'

global.fetch = vi.fn()

describe('EvaluateSentenceSkill Phase 3 tests', () => {
    beforeEach(() => {
        global.fetch.mockClear()
    })

    it('should parse batch evaluation results array correctly mapped to Phase 3 formats', async () => {
        const mockApiResponse = {
            candidates: [{
                content: {
                    parts: [{
                        text: '```json\n[{"id": "q1", "is_correct": true, "correct_answer": "あした 京都へ 行きます。", "explanation": "非常好，毫无错误", "natural_expression": "..."}]\n```'
                    }]
                }
            }]
        }

        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => mockApiResponse
        })

        const skill = new EvaluateSentenceSkill("dummy_key")
        
        // Evaluate batch requires an array of questions objects
        const results = await skill.evaluate(1, [
            { id: "q1", original_prompt: "明天去京都", user_answer: "あした京都へ行きます", type: "q_translate" }
        ])
        
        expect(Array.isArray(results)).toBe(true)
        expect(results.length).toBe(1)
        expect(results[0].id).toBe("q1")
        expect(results[0].is_correct).toBe(true)
        expect(results[0].explanation).toContain('非常')
    })
})
