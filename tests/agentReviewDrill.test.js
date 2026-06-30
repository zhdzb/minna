import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"
import AgentReviewDrill from "../src/components/AgentReviewDrill.vue"

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

const createClient = (overrides = {}) => ({
  loadProgressReview: vi.fn().mockResolvedValue({
    current: {
      current_lesson: 7,
      learning_mode: "foundation_rebuild"
    },
    mastery: {
      grammar_points: {
        "lesson-7/tool-means": {
          lesson: 7,
          pattern: "N de V",
          status: "weak",
          controlled_output: 0.15,
          free_output: 0.05
        }
      }
    },
    reviewQueue: {
      items: [
        {
          id: "rq-001",
          kind: "grammar_point",
          key: "lesson-7/tool-means",
          status: "due",
          due_date: "2026-06-30",
          interval_days: 1,
          ease: 2.1,
          last_result: "wrong"
        },
        {
          id: "rq-002",
          kind: "grammar_point",
          key: "lesson-7/ageru",
          status: "scheduled",
          due_date: "2026-07-02",
          interval_days: 2,
          ease: 2.2,
          last_result: "good"
        }
      ]
    },
    reviewResult: {
      id: "review-2026-06-26",
      overall: {
        accuracy: 0.74
      },
      items: [
        {
          exercise_id: "ex-001",
          target_grammar: "N de V",
          error_tags: ["particle", "grammar_pattern"],
          explanation: "This sentence needs the means particle de, not ni.",
          correct_answer: "de",
          retry_recommended: true,
          is_correct: false
        }
      ]
    },
    ...overrides
  })
})

const mountDrill = (client) =>
  mount(AgentReviewDrill, {
    props: { client },
    global: {
      stubs: {
        "el-button": {
          props: ["loading"],
          emits: ["click"],
          template: '<button :data-loading="loading" @click="$emit(\'click\')"><slot /></button>'
        },
        "el-skeleton": {
          template: '<div class="stub-skeleton"></div>'
        },
        "el-alert": {
          props: ["title", "description"],
          template: '<div class="stub-alert">{{ title }} {{ description }}</div>'
        },
        "el-empty": {
          props: ["description"],
          template: '<div class="stub-empty">{{ description }}</div>'
        },
        "el-tag": {
          template: "<span><slot /></span>"
        }
      }
    }
  })

describe("AgentReviewDrill", () => {
  it("renders due review items with grammar, error cause, and placeholder answer areas", async () => {
    const client = createClient()
    const wrapper = mountDrill(client)
    await flushPromises()

    expect(client.loadProgressReview).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain("Agent Review Drill")
    expect(wrapper.text()).toContain("lesson-7 / tool-means")
    expect(wrapper.text()).toContain("N de V")
    expect(wrapper.text()).toContain("particle, grammar_pattern")
    expect(wrapper.text()).toContain("This sentence needs the means particle de, not ni.")
    expect(wrapper.find("textarea").exists()).toBe(true)
    expect(wrapper.text()).not.toContain("lesson-7/ageru")
  })

  it("shows an empty state when there are no due review items", async () => {
    const client = createClient({
      reviewQueue: {
        items: [
          {
            id: "rq-002",
            kind: "grammar_point",
            key: "lesson-7/ageru",
            status: "scheduled",
            due_date: "2026-07-02",
            interval_days: 2,
            ease: 2.2,
            last_result: "good"
          }
        ]
      }
    })

    const wrapper = mountDrill(client)
    await flushPromises()

    expect(wrapper.text()).toContain("No due review items are waiting right now.")
  })
})
