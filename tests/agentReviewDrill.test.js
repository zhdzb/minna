import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"
import AgentReviewDrill from "../src/components/AgentReviewDrill.vue"

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

const createProgressPayload = () => ({
  current: {
    current_lesson: 7,
    learning_mode: "foundation_rebuild"
  },
  reviewQueue: {
    items: [
      {
        id: "rq-lesson-7-tool-means",
        kind: "grammar_point",
        key: "lesson-7/tool-means",
        status: "due",
        due_date: "2026-06-30",
        interval_days: 1,
        ease: 2.1,
        last_result: "wrong"
      }
    ]
  },
  reviewResult: {
    id: "review-2026-06-26",
    overall: {
      accuracy: 0.74
    }
  }
})

const createReviewDrill = ({ status = "draft", revision = 1 } = {}) => ({
  schema_version: 1,
  revision,
  updated_at: "2026-06-30T09:00:00+08:00",
  id: "review-drill-2026-06-30",
  date: "2026-06-30",
  status,
  created_at: "2026-06-30T09:00:00+08:00",
  source_review: "study/reviews/2026-06-26-review.json",
  summary: {
    title: "Lesson 7 weak point refresh",
    focus: ["means particle", "morau response"],
    due_review_queue_ids: ["rq-lesson-7-tool-means"]
  },
  items: [
    {
      id: "drill-001",
      review_queue_id: "rq-lesson-7-tool-means",
      key: "lesson-7/tool-means",
      lesson: 7,
      target_grammar: "N de V",
      weakness_explanation: "The means particle is still unstable in free output.",
      error_tags: ["particle", "grammar_pattern"],
      original_prompt: "Translate: I go by bus.",
      variant_prompt: "Say: I go to the station by taxi today.",
      answer_reference: "Kyou wa takushii de eki ni ikimasu.",
      user_answer: "",
      hint: "Keep de attached to the transport phrase.",
      status: "pending"
    }
  ],
  submission: {
    submitted_at: null,
    note: ""
  }
})

const createClient = (overrides = {}) => ({
  loadProgressReview: vi.fn().mockResolvedValue(createProgressPayload()),
  loadLatestReviewDrill: vi.fn().mockResolvedValue(createReviewDrill()),
  saveReviewDrill: vi.fn().mockImplementation(async ({ reviewDrill }) => ({
    reviewDrill: {
      ...reviewDrill,
      revision: reviewDrill.revision + 1
    },
    targetPath: "study/review-drills/2026-06-30.json"
  })),
  submitReviewDrill: vi.fn().mockImplementation(async ({ reviewDrill }) => ({
    reviewDrill: {
      ...reviewDrill,
      revision: reviewDrill.revision + 1,
      status: "submitted",
      submission: {
        ...reviewDrill.submission,
        submitted_at: "2026-06-30T12:00:00+08:00"
      },
      items: reviewDrill.items.map((item) => ({
        ...item,
        status: "submitted"
      }))
    },
    targetPath: "study/review-drills/2026-06-30.json"
  })),
  ...overrides
})

const mountDrill = (client) =>
  mount(AgentReviewDrill, {
    props: { client },
    global: {
      stubs: {
        "el-button": {
          props: ["loading", "type"],
          emits: ["click"],
          template: '<button :data-type="type" :data-loading="loading" @click="$emit(\'click\')"><slot /></button>'
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
  it("renders structured review drill items", async () => {
    const client = createClient()
    const wrapper = mountDrill(client)
    await flushPromises()

    expect(client.loadProgressReview).toHaveBeenCalledTimes(1)
    expect(client.loadLatestReviewDrill).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain("Structured Drill Packet")
    expect(wrapper.text()).toContain("lesson-7 / tool-means")
    expect(wrapper.text()).toContain("The means particle is still unstable in free output.")
    expect(wrapper.text()).toContain("Say: I go to the station by taxi today.")
    expect(wrapper.text()).toContain("Kyou wa takushii de eki ni ikimasu.")
    expect(wrapper.find("textarea").exists()).toBe(true)
  })

  it("saves and submits review drill answers", async () => {
    const client = createClient()
    const wrapper = mountDrill(client)
    await flushPromises()

    await wrapper.find("textarea").setValue("Kyou wa takushii de eki ni ikimasu.")

    const buttons = wrapper.findAll("button")
    await buttons[0].trigger("click")
    await flushPromises()

    expect(client.saveReviewDrill).toHaveBeenCalledTimes(1)
    expect(client.saveReviewDrill.mock.calls[0][0].reviewDrill.items[0].user_answer).toBe(
      "Kyou wa takushii de eki ni ikimasu."
    )
    expect(wrapper.text()).toContain("Draft answers were saved to the review drill packet.")

    await buttons[1].trigger("click")
    await flushPromises()

    expect(client.submitReviewDrill).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain("Review drill answers were submitted successfully.")
    expect(wrapper.text()).toContain("submitted")
  })

  it("shows an empty state when no review drill packet exists", async () => {
    const client = createClient({
      loadLatestReviewDrill: vi.fn().mockResolvedValue(null)
    })
    const wrapper = mountDrill(client)
    await flushPromises()

    expect(wrapper.text()).toContain("No review drill packet is available yet.")
  })
})
