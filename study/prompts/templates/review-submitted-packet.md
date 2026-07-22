# Codex Study Loop 提示词：review_submitted_packet

## 目标

批改一份已经提交的 daily packet，写入结构化 review 结果，只更新流程允许更新的学习状态，并留下可审计的痕迹。

## 先读这些文件

- `study/index.json`
- `study/index.json` 指向的已提交 daily packet，或明确指定给你的那一份
- `study/state/current.json`
- `study/state/mastery.json`
- `study/state/review-queue.json`
- `study/state/promotion-rules.json`
- `study/state/profile.json`
- `src/data/syllabus.json`
- `study/index.json` 指向的最新 review（如果存在）
- `study/logs/agent-events.jsonl`

## 允许写入

- `study/reviews/YYYY-MM-DD-review.json`
- 正在被批改的 submitted daily packet
- `study/state/current.json`
- `study/state/mastery.json`
- `study/state/review-queue.json`
- `study/context/next-agent-context.md`
- `study/logs/agent-events.jsonl`
- `study/index.json`

## 硬规则

- 不要覆盖或删除历史 review 文件，也不要改写旧的 event-log 行。
- 只批改状态为 `submitted` 的学习包。
- 没有来自当前结构化 review 与 `study/state/promotion-rules.json` 的证据时，不要推进课程。
- 如果答案可能有多个合理表达，优先使用 `acceptable_variants` 或 `needs_user_input`，不要强行猜测。
- 如果判断不确定，降低 `confidence` 并说明不确定原因。
- review item 只保存 schema 要求的批改证据，不要复制题干、instruction、context_note、supporting_lines 或整道原题；前端会通过 `exercise_id` 从 daily packet 关联题目数据。
- 所有状态变化都必须能通过 review 文件和事件日志追溯。

## Review JSON 要求

写出的 review 文件必须符合当前 `reviewResult` schema，并包含：

- `schema_version`、`revision`、`updated_at`、`id`、`daily_id`、`created_at`
- `overall`
- `items`
- `mastery_updates`
- `review_queue_updates`
- `promotion_decision`

每个 item 至少包含：

- `exercise_id`
- `is_correct`
- `score`
- `error_tags`
- `target_grammar`
- `user_answer`
- `correct_answer`
- `explanation`
- `retry_recommended`
- `confidence`
- `needs_user_input`
- `acceptable_variants`
- `vocabulary_feedback`
- `manual_override`

## 错误标签 taxonomy

除非 schema 之后扩展，否则只使用下列标签：

- `particle`
- `conjugation`
- `tense_aspect`
- `politeness`
- `word_order`
- `vocabulary`
- `kana_kanji`
- `grammar_pattern`
- `listening_mishear`
- `meaning_drift`
- `naturalness`

## 评分与反馈规则

### 目标能力优先

- 人物姓名和姓名读音不是评分目标。姓名存在单个假名误写、长音差异或汉字/假名写法差异时，只要指代清楚且不影响句子语法、语义和交流意图，`is_correct` 必须为 `true`，不得建议重做，也不得进入 mastery 弱点或 review queue；可在 explanation 中作为不计分备注说明。
- 空格、句末标点、全角/半角、阿拉伯数字/日语数字，以及汉字/假名之间的等价书写差异，默认不扣分。
- 非目标词汇的一次性轻微拼写偏差，如果仍可唯一识别且不改变语义，不得单独导致整题判错；可以保留简短的非阻断性纠正。
- 不要因为答案没有逐字复现参考答案而扣分。语义、目标语法、信息方向和场景意图正确的自然变体应判为正确并加入 `acceptable_variants`。
- 仍需计分的内容包括：影响理解的词汇错误、助词和词形、时态与肯否定、授受或移动方向、听力/阅读关键信息，以及职场场景明确要求的礼貌程度。重复出现并妨碍理解的拼写问题也应记录。
- `kana_kanji` 只能用于会影响词义、读音辨识或交流理解的书写错误，不能用于单纯的人名拼写、空格标点或等价字形。
- 只要 `error_tags` 包含 `vocabulary`，该题的 `vocabulary_feedback` 必须逐个列出影响理解的词汇，格式为 `{ "dictionary_form": "正确词的辞书形", "meaning": "中文义项" }`。动词必须给辞书形（如「のみます」对应「のむ」），不可只重复题目中的ます形、て形或过去形；名词给通常词形，い形容词给以「い」结尾的基本形，な形容词给不带「です」的基本形。没有计分词汇错误时写空数组。姓名和不计分的轻微拼写偏差不得写入此字段。

- `q_fill`：严格按答案或选项匹配
- `q_translate`：综合语义、目标语法、助词、变形、自然度评分
- `q_conversation`：综合上下文贴合度、礼貌程度、回应意图、自然度评分
- `q_shadowing`：若无法直接评估，明确标记为以自评为主
- `q_listening_keyword`：根据关键词命中率和误听模式评分
- `q_pattern_substitution`：根据句型保持和替换位准确性评分
- `q_reading`：综合短文理解、关键信息提取、目标语法理解和日语回答自然度评分
- `q_listening`：综合听取信息、关键词命中、意义方向和日语回答自然度评分；不要因未逐字听写而直接判错

## 推进与复习队列规则

推进判断使用 `study/state/promotion-rules.json`。

没有满足阈值时，不得推进。

review queue 更新遵循简化 SRS 规则：

- wrong：间隔变为 `1`，状态变为 `due`
- hard：间隔变为 `max(1, floor(interval_days * 1.2))`
- good：间隔变为 `ceil(interval_days * 2)`
- easy：间隔变为 `ceil(interval_days * 3)`
- 即使 mastery 很高，也仍要保留长期复习资格

## Daily Packet 更新要求

被批改的 daily packet 需要同步更新：

- `correction.status` 改成已批改状态
- `correction.review_file` 指向新的 review 文件
- `review_result` 按当前流程设计保存或建立引用

## 事件日志要求

所有写入成功后，追加一条 JSONL 事件，至少包含：

- `event_id`
- `time`
- `actor`
- `event`
- `input_files`
- `output_files`
- `summary`

事件类型可使用 `daily_packet_reviewed`。

## Index 更新要求

最后一步再更新 `study/index.json`；确保 review 文件、daily packet 更新、状态回写、context 更新、event log 都已经成功完成。

## 最终检查

完成前确认：

1. 被批改的 packet 确实处于 `submitted`
2. 每个错误答案都有 explanation 和 taxonomy tag
3. `confidence` 与 `needs_user_input` 的使用是诚实的
4. 推进决策能被当前规则解释
5. 没有覆盖任何历史 review/log 文件
