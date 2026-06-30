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
  self_assessment: {
    difficulty: null,
    uncertain_exercise_ids: [],
    confusing_points: [],
    pace: "",
    note: ""
  },
  ...overrides
})

const createReviewResult = (overrides = {}) => ({
  id: "review-2026-06-26",
  created_at: "2026-06-26T21:00:00+08:00",
  overall: {
    accuracy: 0.74,
    summary: "Core meaning is mostly there, but the means particle is still unstable.",
    next_focus: ["N de V transport sentences", "More natural short conversation replies"]
  },
  items: [
    {
      exercise_id: "exercise-fill",
      is_correct: false,
      score: 0.25,
      error_tags: ["particle", "grammar_pattern"],
      target_grammar: "N de V",
      user_answer: "ni",
      correct_answer: "de",
      explanation: "This sentence needs the means particle de, not ni.",
      retry_recommended: true,
      rubric: {
        target_particle: 0.0,
        pattern_match: 0.5
      },
      confidence: 0.97,
      needs_user_input: false,
      acceptable_variants: [],
      manual_override: null
    },
    {
      exercise_id: "exercise-conversation",
      is_correct: true,
      score: 0.68,
      error_tags: ["naturalness"],
      target_grammar: "N1 wa N2 ni moraimasu",
      user_answer: "tomodachi ni moraimashita",
      correct_answer: "tomodachi ni hon o moraimashita yo",
      explanation: "The answer is correct, but it sounds a little bare as a conversation reply.",
      retry_recommended: true,
      rubric: {
        context_match: 0.7,
        politeness: 0.7,
        naturalness: 0.5
      },
      confidence: 0.63,
      needs_user_input: true,
      acceptable_variants: ["tomodachi ni hon o moraimashita"],
      manual_override: {
        reason: "Teacher accepted this as understandable, but wants a fuller reply next time."
      }
    }
  ],
  promotion_decision: {
    can_advance: false,
    reason: "Lesson 7 output is close, but the means particle still needs another correct cycle before promotion."
  },
  ...overrides
})

const createClient = (options = {}) => ({
  loadLatestAgentStudy: vi.fn().mockResolvedValue({
    index: {
      latest_review: "study/reviews/2026-06-26-review.json"
    },
    dailyPacket: createDailyPacket(options.dailyPacket),
    reviewResult: options.reviewResult === undefined ? null : createReviewResult(options.reviewResult)
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
  }),
  submitDailyPacket: vi.fn().mockResolvedValue({
    dailyPacket: createDailyPacket({
      status: "submitted",
      answers: options.savedAnswers || {
        "exercise-fill": "ni",
        "exercise-translate": "watashi wa sensei ni hon o agemasu",
        "exercise-conversation": "tomodachi ni moraimashita"
      },
      self_assessment: {
        difficulty: "steady",
        uncertain_exercise_ids: ["exercise-conversation"],
        confusing_points: ["ageru and morau contrast"],
        pace: "steady",
        note: "Need another look at receiving verbs."
      },
      correction: {
        status: "pending",
        prompt_file: "study/prompts/generated/2026-06-26-review.md",
        review_file: ""
      }
    }),
    targetPath: "study/daily/2026-06-26.json"
  }),
  loadPromptFile: vi.fn().mockResolvedValue({
    path: "study/prompts/generated/2026-06-26-review.md",
    content: "Review prompt body"
  })
})

const mountWorkspace = (client, options = {}) =>
  mount(AgentStudyWorkspace, {
    props: { client, ...(options.props || {}) },
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

  it("renders the latest review summary and per-item feedback when review data exists", async () => {
    const client = createClient({
      dailyPacket: {
        status: "reviewed",
        correction: {
          status: "reviewed",
          prompt_file: "study/prompts/generated/2026-06-26-review.md",
          review_file: "study/reviews/2026-06-26-review.json"
        }
      },
      reviewResult: {}
    })

    const wrapper = mountWorkspace(client)
    await flushPromises()

    expect(wrapper.text()).toContain("Latest Review")
    expect(wrapper.text()).toContain("74%")
    expect(wrapper.text()).toContain("Hold current lesson")
    expect(wrapper.text()).toContain("Core meaning is mostly there")
    expect(wrapper.text()).toContain("N de V transport sentences")
    expect(wrapper.text()).toContain("This sentence needs the means particle de, not ni.")
    expect(wrapper.text()).toContain("Acceptable Variants")
    expect(wrapper.text()).toContain("Needs user input")
    expect(wrapper.text()).toContain("Teacher accepted this as understandable")
    expect(wrapper.text()).toContain("target_particle")
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

  it("submits the packet with self assessment and shows the next review handoff", async () => {
    const client = createClient()
    const wrapper = mountWorkspace(client)
    await flushPromises()

    const inputs = wrapper.findAll(".stub-input")
    const textareas = wrapper.findAll(".stub-textarea")

    await inputs[0].setValue("ni")
    await wrapper.find('select.assessment-input').setValue("steady")
    await wrapper.find('input.assessment-input').setValue("steady")
    await textareas[0].setValue("watashi wa sensei ni hon o agemasu")
    await textareas[1].setValue("tomodachi ni moraimashita")
    await wrapper.find('textarea.assessment-input').setValue("ageru and morau contrast")
    await wrapper.findAll('textarea.assessment-input')[1].setValue("Need another look at receiving verbs.")
    await wrapper.find('input[type="checkbox"]').setValue(true)
    await wrapper.findAll("button")[2].trigger("click")
    await flushPromises()

    expect(client.submitDailyPacket).toHaveBeenCalledWith({
      dailyPacket: expect.objectContaining({
        revision: 2,
        status: "submitted",
        answers: expect.objectContaining({
          "exercise-fill": "ni",
          "exercise-translate": "watashi wa sensei ni hon o agemasu",
          "exercise-conversation": "tomodachi ni moraimashita"
        }),
        self_assessment: {
          difficulty: "steady",
          uncertain_exercise_ids: ["exercise-fill"],
          confusing_points: ["ageru and morau contrast"],
          pace: "steady",
          note: "Need another look at receiving verbs."
        }
      })
    })
    expect(wrapper.text()).toContain("Packet submitted")
    expect(wrapper.text()).toContain("study/prompts/generated/2026-06-26-review.md")
  })

  it("loads and copies the review prompt after submission", async () => {
    const client = createClient()
    const copyText = vi.fn().mockResolvedValue(undefined)
    const wrapper = mountWorkspace(client, {
      props: { copyText }
    })
    await flushPromises()

    await wrapper.findAll("button")[2].trigger("click")
    await flushPromises()
    await wrapper.findAll("button")[3].trigger("click")
    await flushPromises()

    expect(client.loadPromptFile).toHaveBeenCalledWith("study/prompts/generated/2026-06-26-review.md")
    expect(copyText).toHaveBeenCalledWith("Review prompt body")
    expect(wrapper.text()).toContain("The review prompt was copied")
    expect(wrapper.text()).toContain("Review prompt body")
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

  it("shows a refresh prompt when submit hits a revision conflict", async () => {
    const client = createClient()
    client.submitDailyPacket.mockRejectedValueOnce(new Error("Revision conflict detected"))

    const wrapper = mountWorkspace(client)
    await flushPromises()

    await wrapper.findAll("button")[2].trigger("click")
    await flushPromises()

    expect(wrapper.text()).toContain("Submit failed")
    expect(wrapper.text()).toContain("Please refresh")
  })

  it("shows a clear prompt hint when no generated review prompt is linked", async () => {
    const client = createClient({
      dailyPacket: {
        status: "submitted",
        correction: {
          status: "pending",
          prompt_file: "",
          review_file: ""
        }
      }
    })

    const wrapper = mountWorkspace(client)
    await flushPromises()

    expect(wrapper.text()).toContain("No generated review prompt is linked to this packet yet.")
  })

  it("renders an empty state when there is no daily packet", async () => {
    const client = {
      loadLatestAgentStudy: vi.fn().mockResolvedValue({
        index: null,
        dailyPacket: null,
        reviewResult: null
      }),
      saveDailyPacket: vi.fn(),
      submitDailyPacket: vi.fn(),
      loadPromptFile: vi.fn()
    }

    const wrapper = mountWorkspace(client)
    await flushPromises()

    expect(wrapper.text()).toContain("No daily packet is available right now.")
  })
})
