import { describe, it, expect, vi, beforeEach } from 'vitest'
import GenerateGrammarExerciseSkill from '../src/skills/generateExercise.js'

global.fetch = vi.fn()

describe('GenerateGrammarExerciseSkill Phase 3 tests', () => {
    beforeEach(() => {
        global.fetch.mockClear()
    })

    it('should completely parse Gemini JSON response directly mapped to Phase 2/3 ES Module structure', async () => {
        const mockApiResponse = {
            candidates: [{
                content: {
                    parts: [{
                        text: '```json\n{"exercises": [{"id": "1", "type": "q_fill"}]}\n```'
                    }]
                }
            }]
        }

        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => mockApiResponse
        })

        const skill = new GenerateGrammarExerciseSkill("dummy_key")
        
        // Pass the deep config context required by Phase 3 architecture
        const result = await skill.generate({ 
            lesson: "第1课", 
            grammar_points: ["名词 は 名词 です"], 
            hidden_knowledge: ["职场初次见面寒暄"], 
            config: { questionCount: 5, difficulty: '基础', questionType: 'ALL' } 
        })
        
        expect(result.exercises).toBeDefined()
        expect(result.exercises[0].id).toBe("1")
        expect(result.exercises[0].type).toBe("q_fill")
        
        // Ensure network fired
        expect(global.fetch).toHaveBeenCalledTimes(1)
    })
})
