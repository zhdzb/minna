import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"
import AgentStudyWorkspace from "../src/components/AgentStudyWorkspace.vue"

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

const createDailyPacket = (overrides = {}) => ({
  id: "daily-2026-06-26",
  date: "2026-06-26",
  revision: 2,
  status: "planned",
  mission: {
    title: "Lesson 7 Foundation Reset",
    goals: ["Review giving and receiving", "Produce short answers"],
    available_minutes: 60,
    focus_lessons: [7]
  },
  tasks: [{ id: "task-1", title: "Review grammar", type: "grammar_review", minutes: 15, status: "pending" }],
  study_materials: [
    {
      id: "material-1",
      title: "Giving and receiving notes",
      type: "grammar_note",
      lesson: 7,
      content: "Short study note.",
      examples: [{ ja: "sensei ni hon o agemasu", zh: "give a book to the teacher" }]
    }
  ],
  exercises: [
    {
      id: "exercise-fill",
      prompt: "Fill the missing particle",
      type: "q_fill",
      lesson: 7,
      target_grammar: "N ni V",
      metadata: { skill: "grammar" },
      vocab_hints: ["ni"]
    },
    {
      id: "exercise-translate",
      prompt: "Translate this sentence",
      type: "q_translate",
      lesson: 7,
      target_grammar: "N1 wa N2 ni agemasu",
      metadata: { skill: "output" },
      vocab_hints: ["teacher", "book"]
    },
    {
      id: "exercise-conversation",
      prompt: "Reply in one short line",
      type: "q_conversation",
      lesson: 7,
      target_grammar: "N1 wa N2 ni moraimasu",
      metadata: { skill: "conversation" },
      vocab_hints: ["friend"]
    }
  ],
  review_items: [{ review_queue_id: "rq-1" }],
  correction: { status: "pending" },
  answers: {
    "exercise-fill": "",
    "exercise-translate": "",
    "exercise-conversation": ""
  },
  ...overrides
})

const createClient = (options = {}) => ({
  loadLatestAgentStudy: vi.fn().mockResolvedValue({
    index: {
      latest_review: "study/reviews/2026-06-26-review.json"
    },
    dailyPacket: createDailyPacket(options.dailyPacket),
    reviewResult: null
  }),
  saveDailyPacket: vi.fn().mockResolvedValue({
    dailyPacket: createDailyPacket({
      status: "answering",
      answers: options.savedAnswers || {
        "exercise-fill": "ni",
        "exercise-translate": "watashi wa sensei ni hon o agemasu",
        "exercise-conversation": "tomodachi ni moraimashita"
      }
    }),
    targetPath: "study/daily/2026-06-26.json"
  })
})

const mountWorkspace = (client) =>
  mount(AgentStudyWorkspace, {
    props: { client },
    global: {
      stubs: {
        "el-button": {
          props: ["disabled", "loading"],
          emits: ["click"],
          template:
            '<button :disabled="disabled" :data-loading="loading" @click="$emit(\'click\')"><slot /></button>'
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
        },
        "el-input": {
          props: ["modelValue", "type", "rows", "placeholder"],
          emits: ["update:modelValue"],
          template: `
            <input
              v-if="type !== 'textarea'"
              class="stub-input"
              :value="modelValue"
              :placeholder="placeholder"
              @input="$emit('update:modelValue', $event.target.value)"
            />
            <textarea
              v-else
              class="stub-textarea"
              :rows="rows"
              :value="modelValue"
              :placeholder="placeholder"
              @input="$emit('update:modelValue', $event.target.value)"
            />
          `
        }
      }
    }
  })

describe("AgentStudyWorkspace", () => {
  it("renders the latest daily packet mission, sections, and exercises", async () => {
    const client = createClient()
    const wrapper = mountWorkspace(client)
    await flushPromises()

    expect(client.loadLatestAgentStudy).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain("Lesson 7 Foundation Reset")
    expect(wrapper.text()).toContain("Review grammar")
    expect(wrapper.text()).toContain("Giving and receiving notes")
    expect(wrapper.text()).toContain("Translate this sentence")
    expect(wrapper.text()).toContain("study/reviews/2026-06-26-review.json")
  })

  it("updates answers and saves them through the daily save client", async () => {
    const client = createClient()
    const wrapper = mountWorkspace(client)
    await flushPromises()

    const inputs = wrapper.findAll(".stub-input")
    const textareas = wrapper.findAll(".stub-textarea")

    await inputs[0].setValue("ni")
    await textareas[0].setValue("watashi wa sensei ni hon o agemasu")
    await textareas[1].setValue("tomodachi ni moraimashita")
    await wrapper.findAll("button")[1].trigger("click")
    await flushPromises()

    expect(client.saveDailyPacket).toHaveBeenCalledWith({
      dailyPacket: expect.objectContaining({
        revision: 2,
        status: "answering",
        answers: {
          "exercise-fill": "ni",
          "exercise-translate": "watashi wa sensei ni hon o agemasu",
          "exercise-conversation": "tomodachi ni moraimashita"
        }
      })
    })
    expect(wrapper.text()).toContain("Draft saved")
  })

  it("shows a refresh prompt when draft save hits a revision conflict", async () => {
    const client = createClient()
    client.saveDailyPacket.mockRejectedValueOnce(new Error("Revision conflict detected"))

    const wrapper = mountWorkspace(client)
    await flushPromises()

    await wrapper.find(".stub-input").setValue("ni")
    await wrapper.findAll("button")[1].trigger("click")
    await flushPromises()

    expect(wrapper.text()).toContain("Draft save failed")
    expect(wrapper.text()).toContain("Please refresh")
  })

  it("renders an empty state when there is no daily packet", async () => {
    const client = {
      loadLatestAgentStudy: vi.fn().mockResolvedValue({
        index: null,
        dailyPacket: null,
        reviewResult: null
      }),
      saveDailyPacket: vi.fn()
    }

    const wrapper = mountWorkspace(client)
    await flushPromises()

    expect(wrapper.text()).toContain("No daily packet is available right now.")
  })
})
