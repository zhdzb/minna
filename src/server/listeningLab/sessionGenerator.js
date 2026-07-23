import { loadVocabularyCatalog } from '../agentStudy/vocabularyCatalog.js'
import {
  LISTENING_LAB_SCHEMA_VERSION,
  validateListeningAttempt,
  validateListeningSession
} from '../../utils/listeningLabSchema.js'

const SCENARIOS = [
  {
    id: 'morning-meeting',
    label: '晨会与会议安排',
    title: '晨会前的会议确认',
    level: 'N5-N4',
    lessons: [4, 6, 10],
    grammar: ['time に V', 'place で V', 'N は place です'],
    goals: ['听清会议时间和地点', '理解工作前需要完成的动作', '练习确认安排的自然回应'],
    vocabulary_terms: ['今日', '会議', '時間', '会社', '見る', '来る'],
    segments: [
      {
        speaker: '佐藤（さとう）',
        text: 'おはようございます。今日の会議は九時からです。',
        kana: 'おはようございます。きょうの かいぎは くじからです。',
        meaning_zh: '早上好。今天的会议从九点开始。',
        focus: '时间与主题'
      },
      {
        speaker: '李（り）',
        text: '会議室はどこですか。',
        kana: 'かいぎしつは どこですか。',
        meaning_zh: '会议室在哪里？',
        focus: '地点确认'
      },
      {
        speaker: '佐藤（さとう）',
        text: '二階の会議室です。八時五十分までに来てください。',
        kana: 'にかいの かいぎしつです。はちじ ごじゅっぷんまでに きてください。',
        meaning_zh: '在二楼的会议室。请在八点五十分之前来。',
        focus: '楼层与截止时间'
      },
      {
        speaker: '李（り）',
        text: 'はい、分かりました。資料は先に自分の席で見ます。',
        kana: 'はい、わかりました。しりょうは さきに じぶんの せきで みます。',
        meaning_zh: '好的，明白了。我会先在自己的座位上看资料。',
        focus: '确认与动作地点'
      }
    ],
    questions: [
      {
        type: 'single_choice',
        prompt_zh: '这段对话主要在确认什么？',
        choices: ['会议安排', '午饭菜单', '回家路线'],
        answer_reference: '会议安排',
        accepted_keywords: ['会议'],
        explanation_zh: '两人确认了会议开始时间、会议室和到达时间。',
        segment_indexes: [0, 1, 2]
      },
      {
        type: 'single_choice',
        prompt_zh: '会议在哪里举行？',
        choices: ['一楼前台', '二楼会议室', '公司食堂'],
        answer_reference: '二楼会议室',
        accepted_keywords: ['二楼', '会议室'],
        explanation_zh: '佐藤说「二階の会議室です」。',
        segment_indexes: [2]
      },
      {
        type: 'short_answer',
        prompt_zh: '李需要在几点之前到达？可用中文或日语回答。',
        choices: [],
        answer_reference: '八点五十分之前',
        accepted_keywords: ['八点五十分', '8点50分', '八時五十分', '8時50分'],
        explanation_zh: '关键词是「八時五十分までに」。',
        segment_indexes: [2]
      }
    ],
    response: {
      prompt_zh: '你是李。请用一句自然日语确认自己会在八点五十分之前到。',
      context_zh: '这是对同事说明自己已经听懂安排，不需要重复全部信息。',
      answer_reference: 'はい、八時五十分までに行きます。',
      acceptable_variants: [
        '分かりました。八時五十分までに行きます。',
        'はい、八時五十分までに会議室へ行きます。'
      ]
    }
  },
  {
    id: 'send-materials',
    label: '资料发送与确认',
    title: '邮件发送资料',
    level: 'N5-N4',
    lessons: [6, 7],
    grammar: ['tool で V', 'もう Vました', 'N を V'],
    goals: ['听清资料发送手段', '区分已经完成与尚未完成', '练习简短的工作确认'],
    vocabulary_terms: ['送る', '見る', '仕事', '会社', '言う', '分かる'],
    segments: [
      {
        speaker: '山田（やまだ）',
        text: '田中さん、会議の資料をもう送りましたか。',
        kana: 'たなかさん、かいぎの しりょうを もう おくりましたか。',
        meaning_zh: '田中，会议资料已经发了吗？',
        focus: '完成确认'
      },
      {
        speaker: '田中（たなか）',
        text: 'はい、さっきメールで送りました。',
        kana: 'はい、さっき メールで おくりました。',
        meaning_zh: '是的，刚才已经用邮件发了。',
        focus: '手段与过去式'
      },
      {
        speaker: '山田（やまだ）',
        text: 'ありがとうございます。午後の会議の前に見ます。',
        kana: 'ありがとうございます。ごごの かいぎの まえに みます。',
        meaning_zh: '谢谢。我会在下午的会议前看。',
        focus: '动作顺序'
      },
      {
        speaker: '田中（たなか）',
        text: '分からないところがあったら、言ってください。',
        kana: 'わからない ところが あったら、いってください。',
        meaning_zh: '如果有不明白的地方，请告诉我。',
        focus: '职场协助表达'
      }
    ],
    questions: [
      {
        type: 'single_choice',
        prompt_zh: '田中用什么方式发送了资料？',
        choices: ['邮件', '快递', '聊天软件'],
        answer_reference: '邮件',
        accepted_keywords: ['邮件', 'メール'],
        explanation_zh: '田中说「メールで送りました」。',
        segment_indexes: [1]
      },
      {
        type: 'single_choice',
        prompt_zh: '山田准备什么时候看资料？',
        choices: ['上午下班后', '下午会议前', '明天早上'],
        answer_reference: '下午会议前',
        accepted_keywords: ['下午', '会议前'],
        explanation_zh: '山田说「午後の会議の前に見ます」。',
        segment_indexes: [2]
      },
      {
        type: 'short_answer',
        prompt_zh: '资料是否已经发送？可用中文或日语简短回答。',
        choices: [],
        answer_reference: '已经发送了',
        accepted_keywords: ['已经', '发了', '送りました', 'はい'],
        explanation_zh: '「もう送りましたか」的回答是「はい、送りました」。',
        segment_indexes: [0, 1]
      }
    ],
    response: {
      prompt_zh: '你是山田。请用一句日语感谢对方，并说明会在会议前查看。',
      context_zh: '保持简短、礼貌，不需要逐字复述整段对话。',
      answer_reference: 'ありがとうございます。会議の前に見ます。',
      acceptable_variants: [
        'ありがとうございます。午後の会議の前に確認します。',
        '分かりました。会議の前に資料を見ます。'
      ]
    }
  },
  {
    id: 'office-announcement',
    label: '工作通知短文',
    title: '会议室临时调整通知',
    level: 'N5-N4',
    lessons: [6, 8, 9, 10],
    grammar: ['place で V', 'N が あります', '〜から、〜'],
    goals: ['听懂公告的主题和时间范围', '捕捉地点变更及原因', '练习简短复述工作通知'],
    vocabulary_terms: ['今日', '時間', '会議', '部屋', '使う', '聞く', '受付'],
    segments: [
      {
        speaker: '社内放送（しゃないほうそう）',
        text: '社員のみなさんにお知らせします。',
        kana: 'しゃいんの みなさんに おしらせします。',
        meaning_zh: '向各位员工通知一件事情。',
        focus: '公告开场'
      },
      {
        speaker: '社内放送（しゃないほうそう）',
        text: '今日の午後二時から三時まで、三階の会議室は使えません。',
        kana: 'きょうの ごご にじから さんじまで、さんがいの かいぎしつは つかえません。',
        meaning_zh: '今天下午两点到三点，三楼会议室不能使用。',
        focus: '时间范围与肯否定'
      },
      {
        speaker: '社内放送（しゃないほうそう）',
        text: '新しいパソコンを運びますから、会議は二階の部屋でします。',
        kana: 'あたらしい パソコンを はこびますから、かいぎは にかいの へやで します。',
        meaning_zh: '因为要搬运新电脑，会议改在二楼房间举行。',
        focus: '原因与地点变更'
      },
      {
        speaker: '社内放送（しゃないほうそう）',
        text: '質問がある人は、受付の佐藤さんに聞いてください。',
        kana: 'しつもんが ある ひとは、うけつけの さとうさんに きいてください。',
        meaning_zh: '有问题的人请询问前台的佐藤。',
        focus: '咨询对象'
      }
    ],
    questions: [
      {
        type: 'single_choice',
        prompt_zh: '这篇通知主要说明什么？',
        choices: ['会议室临时调整', '公司开始招聘', '午休时间延长'],
        answer_reference: '会议室临时调整',
        accepted_keywords: ['会议室', '调整', '变更'],
        explanation_zh: '通知说明三楼会议室暂时不能使用，并给出了新的会议地点。',
        segment_indexes: [1, 2]
      },
      {
        type: 'single_choice',
        prompt_zh: '三楼会议室在哪个时间段不能使用？',
        choices: ['上午九点到十点', '下午两点到三点', '下午三点到四点'],
        answer_reference: '下午两点到三点',
        accepted_keywords: ['下午两点', '三点', '二時から三時'],
        explanation_zh: '第二句是「午後二時から三時まで」。',
        segment_indexes: [1]
      },
      {
        type: 'short_answer',
        prompt_zh: '有问题时应该询问谁？',
        choices: [],
        answer_reference: '前台的佐藤',
        accepted_keywords: ['佐藤', 'さとう', '前台', '受付'],
        explanation_zh: '最后一句指定了「受付の佐藤さん」。人名写法不影响评分。',
        segment_indexes: [3]
      }
    ],
    response: {
      prompt_zh: '请用一句自然日语向同事复述：会议改在二楼举行。',
      context_zh: '这是听完公司通知后向旁边同事确认最新地点。',
      answer_reference: '会議は二階の部屋でします。',
      acceptable_variants: [
        '今日の会議は二階です。',
        '三階の会議室は使えませんから、二階で会議をします。'
      ]
    }
  },
  {
    id: 'quiet-work-room',
    label: '办公室环境与位置',
    title: '寻找安静的工作地点',
    level: 'N5-N4',
    lessons: [8, 10],
    grammar: ['な形容词です', 'N が あります', 'N は place です'],
    goals: ['理解办公室环境描述', '听清房间所在楼层', '练习询问和确认工作地点'],
    vocabulary_terms: ['場所', '静か', '便利', '仕事', 'ある', '使う'],
    segments: [
      {
        speaker: '王（おう）',
        text: 'この近くに静かな部屋がありますか。',
        kana: 'この ちかくに しずかな へやが ありますか。',
        meaning_zh: '这附近有安静的房间吗？',
        focus: '存在与形容'
      },
      {
        speaker: '鈴木（すずき）',
        text: 'はい、三階に小さい会議室があります。',
        kana: 'はい、さんがいに ちいさい かいぎしつが あります。',
        meaning_zh: '有，三楼有一间小会议室。',
        focus: '地点与存在'
      },
      {
        speaker: '王（おう）',
        text: 'その部屋は今、使いますか。',
        kana: 'その へやは いま、つかいますか。',
        meaning_zh: '那个房间现在有人使用吗？',
        focus: '当前状态确认'
      },
      {
        speaker: '鈴木（すずき）',
        text: 'いいえ、四時までだれも使いません。そこで仕事ができます。',
        kana: 'いいえ、よじまで だれも つかいません。そこで しごとが できます。',
        meaning_zh: '没有，四点之前没人使用。可以在那里工作。',
        focus: '时间范围与许可信息'
      }
    ],
    questions: [
      {
        type: 'single_choice',
        prompt_zh: '王在找什么样的地方？',
        choices: ['热闹的食堂', '安静的房间', '宽敞的大厅'],
        answer_reference: '安静的房间',
        accepted_keywords: ['安静', '房间'],
        explanation_zh: '王问「静かな部屋がありますか」。',
        segment_indexes: [0]
      },
      {
        type: 'single_choice',
        prompt_zh: '小会议室在哪里？',
        choices: ['二楼', '三楼', '四楼'],
        answer_reference: '三楼',
        accepted_keywords: ['三楼', '三階'],
        explanation_zh: '铃木说「三階に小さい会議室があります」。',
        segment_indexes: [1]
      },
      {
        type: 'short_answer',
        prompt_zh: '这间会议室几点之前没人使用？',
        choices: [],
        answer_reference: '四点之前',
        accepted_keywords: ['四点', '4点', '四時', '4時'],
        explanation_zh: '关键词是「四時までだれも使いません」。',
        segment_indexes: [3]
      }
    ],
    response: {
      prompt_zh: '你是王。请用一句自然日语表示感谢，并说明会在那里工作。',
      context_zh: '这是得到同事帮助后的简短回应。',
      answer_reference: 'ありがとうございます。そこで仕事をします。',
      acceptable_variants: [
        'ありがとうございます。その会議室で仕事をします。',
        '分かりました。三階の会議室を使います。'
      ]
    }
  },
  {
    id: 'overtime-reason',
    label: '工作进度与原因',
    title: '说明今天加班的原因',
    level: 'N5-N4',
    lessons: [8, 9],
    grammar: ['〜から、〜', 'い形容词です', 'N が あります'],
    goals: ['听懂工作量和加班原因', '捕捉数量与截止信息', '练习说明自己的工作安排'],
    vocabulary_terms: ['仕事', '多い', '今日', '明日', '残業', '時間'],
    segments: [
      {
        speaker: '高橋（たかはし）',
        text: '今日は仕事が多いですね。',
        kana: 'きょうは しごとが おおいですね。',
        meaning_zh: '今天工作很多啊。',
        focus: '工作量描述'
      },
      {
        speaker: '陳（ちん）',
        text: 'はい。明日の朝までにレポートを三つ作ります。',
        kana: 'はい。あしたの あさまでに レポートを みっつ つくります。',
        meaning_zh: '是的。明天早上之前要做三份报告。',
        focus: '截止时间与数量'
      },
      {
        speaker: '高橋（たかはし）',
        text: '大変ですね。何時ごろ帰りますか。',
        kana: 'たいへんですね。なんじごろ かえりますか。',
        meaning_zh: '很辛苦啊。大概几点回去？',
        focus: '关心与时间提问'
      },
      {
        speaker: '陳（ちん）',
        text: '仕事が多いですから、今日は八時まで残業します。',
        kana: 'しごとが おおいですから、きょうは はちじまで ざんぎょうします。',
        meaning_zh: '因为工作很多，所以今天加班到八点。',
        focus: '原因与结果'
      }
    ],
    questions: [
      {
        type: 'single_choice',
        prompt_zh: '陈为什么今天要加班？',
        choices: ['工作很多', '电车晚点', '要参加聚餐'],
        answer_reference: '工作很多',
        accepted_keywords: ['工作多', '仕事が多い'],
        explanation_zh: '陈说「仕事が多いですから」。',
        segment_indexes: [3]
      },
      {
        type: 'single_choice',
        prompt_zh: '陈需要制作几份报告？',
        choices: ['一份', '两份', '三份'],
        answer_reference: '三份',
        accepted_keywords: ['三份', '三个', '三つ'],
        explanation_zh: '第二句中出现了「レポートを三つ」。',
        segment_indexes: [1]
      },
      {
        type: 'short_answer',
        prompt_zh: '陈今天加班到几点？',
        choices: [],
        answer_reference: '八点',
        accepted_keywords: ['八点', '8点', '八時', '8時'],
        explanation_zh: '关键词是「八時まで残業します」。',
        segment_indexes: [3]
      }
    ],
    response: {
      prompt_zh: '你是陈。请用一句自然日语说明因为工作多，今天会加班。',
      context_zh: '需要包含原因和今天的安排，具体时间可以省略。',
      answer_reference: '仕事が多いですから、今日は残業します。',
      acceptable_variants: [
        '今日は仕事が多いですから、八時まで残業します。',
        'レポートを作りますから、今日は残業します。'
      ]
    }
  },
  {
    id: 'lunch-invitation',
    label: '午休邀请与回应',
    title: '同事之间的午饭邀请',
    level: 'N5',
    lessons: [6, 8, 9],
    grammar: ['Vませんか', 'Vましょう', 'な形容词です'],
    goals: ['听懂邀请和回应', '理解餐厅位置与特点', '练习自然接受同事邀请'],
    vocabulary_terms: ['食べる', '行く', '近い', '好き', '店', '一緒に'],
    segments: [
      {
        speaker: '木村（きむら）',
        text: '十二時ですね。いっしょに昼ごはんを食べませんか。',
        kana: 'じゅうにじですね。いっしょに ひるごはんを たべませんか。',
        meaning_zh: '十二点了。要不要一起吃午饭？',
        focus: '礼貌邀请'
      },
      {
        speaker: '林（りん）',
        text: 'いいですね。どこへ行きますか。',
        kana: 'いいですね。どこへ いきますか。',
        meaning_zh: '好啊。去哪里？',
        focus: '接受与目的地提问'
      },
      {
        speaker: '木村（きむら）',
        text: '会社の近くに静かな店があります。魚の料理がおいしいです。',
        kana: 'かいしゃの ちかくに しずかな みせが あります。さかなの りょうりが おいしいです。',
        meaning_zh: '公司附近有一家安静的店。鱼料理很好吃。',
        focus: '地点与餐厅描述'
      },
      {
        speaker: '林（りん）',
        text: '魚が好きです。そこへ行きましょう。',
        kana: 'さかなが すきです。そこへ いきましょう。',
        meaning_zh: '我喜欢鱼。就去那里吧。',
        focus: '喜好与共同决定'
      }
    ],
    questions: [
      {
        type: 'single_choice',
        prompt_zh: '木村邀请林做什么？',
        choices: ['一起吃午饭', '一起开会', '一起回家'],
        answer_reference: '一起吃午饭',
        accepted_keywords: ['午饭', '吃饭'],
        explanation_zh: '邀请句是「いっしょに昼ごはんを食べませんか」。',
        segment_indexes: [0]
      },
      {
        type: 'single_choice',
        prompt_zh: '那家店有什么特点？',
        choices: ['很安静，鱼料理好吃', '很热闹，价格很贵', '离公司很远'],
        answer_reference: '很安静，鱼料理好吃',
        accepted_keywords: ['安静', '鱼', '好吃'],
        explanation_zh: '木村提到了「静かな店」和「魚の料理がおいしい」。',
        segment_indexes: [2]
      },
      {
        type: 'short_answer',
        prompt_zh: '林是否接受了邀请？可用中文或日语回答。',
        choices: [],
        answer_reference: '接受了',
        accepted_keywords: ['接受', '去了', '行きましょう', 'はい'],
        explanation_zh: '林最后说「そこへ行きましょう」。',
        segment_indexes: [3]
      }
    ],
    response: {
      prompt_zh: '你是林。请用一句自然日语接受午饭邀请。',
      context_zh: '可以表达同意，也可以顺便确认去哪里。',
      answer_reference: 'いいですね。いっしょに行きましょう。',
      acceptable_variants: [
        'はい、いっしょに昼ごはんを食べましょう。',
        'ありがとうございます。そこへ行きましょう。'
      ]
    }
  },
  {
    id: 'schedule-change',
    label: '日程变更与联络',
    title: '确认会议时间变更',
    level: 'N5-N4',
    lessons: [4, 5, 7, 9],
    grammar: ['time に V', 'tool で V', '〜から、〜'],
    goals: ['听清变更前后的时间', '理解变更原因和通知方式', '练习复述最新安排'],
    vocabulary_terms: ['会議', '時間', '変わる', '連絡', '来る', '明日'],
    segments: [
      {
        speaker: '中村（なかむら）',
        text: '明日の会議の時間が変わりました。',
        kana: 'あしたの かいぎの じかんが かわりました。',
        meaning_zh: '明天会议的时间变更了。',
        focus: '变更通知'
      },
      {
        speaker: '趙（ちょう）',
        text: '何時からですか。',
        kana: 'なんじからですか。',
        meaning_zh: '从几点开始？',
        focus: '时间确认'
      },
      {
        speaker: '中村（なかむら）',
        text: '十時からです。部長が九時に会社へ来ませんから。',
        kana: 'じゅうじからです。ぶちょうが くじに かいしゃへ きませんから。',
        meaning_zh: '从十点开始。因为部长九点不能到公司。',
        focus: '新时间与原因'
      },
      {
        speaker: '趙（ちょう）',
        text: '分かりました。ほかの人にもチャットで連絡します。',
        kana: 'わかりました。ほかの ひとにも チャットで れんらくします。',
        meaning_zh: '明白了。我也会通过聊天软件通知其他人。',
        focus: '确认与联络手段'
      }
    ],
    questions: [
      {
        type: 'single_choice',
        prompt_zh: '明天的会议改到几点开始？',
        choices: ['九点', '十点', '十一点'],
        answer_reference: '十点',
        accepted_keywords: ['十点', '10点', '十時', '10時'],
        explanation_zh: '中村说「十時からです」。',
        segment_indexes: [2]
      },
      {
        type: 'single_choice',
        prompt_zh: '会议时间为什么改变？',
        choices: ['部长九点不能到公司', '会议室正在维修', '资料还没有完成'],
        answer_reference: '部长九点不能到公司',
        accepted_keywords: ['部长', '九点', '不能到'],
        explanation_zh: '原因是「部長が九時に会社へ来ませんから」。',
        segment_indexes: [2]
      },
      {
        type: 'short_answer',
        prompt_zh: '赵准备怎样通知其他人？',
        choices: [],
        answer_reference: '通过聊天软件通知',
        accepted_keywords: ['聊天', 'チャット', '联络', '連絡'],
        explanation_zh: '赵说「チャットで連絡します」。',
        segment_indexes: [3]
      }
    ],
    response: {
      prompt_zh: '你是赵。请用一句自然日语确认会议从十点开始。',
      context_zh: '只需确认最新时间，不需要解释全部原因。',
      answer_reference: '分かりました。会議は十時からですね。',
      acceptable_variants: [
        'はい、明日の会議は十時からですね。',
        '分かりました。十時に会議室へ行きます。'
      ]
    }
  }
]

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .toLowerCase()

const buildGlossary = ({ scenario, catalog, sourceSnapshot }) => {
  const sourceIds = new Set(sourceSnapshot.vocabulary_targets.map((item) => item.id))
  const scriptText = normalizeText(scenario.segments.map((segment) => segment.text).join(''))
  return catalog.items
    .filter((item) => {
      const termMatch = scenario.vocabulary_terms.some(
        (term) => normalizeText(term) === normalizeText(item.word)
      )
      const normalizedWord = normalizeText(item.word)
      const normalizedKana = normalizeText(item.kana)
      const scriptMatch =
        (normalizedWord.length >= 2 && scriptText.includes(normalizedWord)) ||
        (normalizedKana.length >= 2 && scriptText.includes(normalizedKana))
      return termMatch || scriptMatch
    })
    .sort(
      (left, right) => {
        const leftExplicit = scenario.vocabulary_terms.some(
          (term) => normalizeText(term) === normalizeText(left.word)
        )
        const rightExplicit = scenario.vocabulary_terms.some(
          (term) => normalizeText(term) === normalizeText(right.word)
        )
        return (
          Number(!leftExplicit) - Number(!rightExplicit) ||
          Number(!sourceIds.has(left.id)) - Number(!sourceIds.has(right.id)) ||
          left.priority_rank - right.priority_rank
        )
      }
    )
    .slice(0, 8)
    .map((item) => ({
      id: item.id,
      word: item.word,
      kana: item.kana,
      meaning: item.meaning
    }))
}

const chooseScenario = ({ sourceSnapshot, sequence = 0, scenarioId = '' }) => {
  if (scenarioId) {
    const requested = SCENARIOS.find((scenario) => scenario.id === scenarioId)
    if (!requested) throw new Error('Unknown listening scenario: ' + scenarioId)
    return requested
  }

  const relevant = SCENARIOS.filter((scenario) =>
    scenario.lessons.some((lesson) => sourceSnapshot.focus_lessons.includes(lesson))
  )
  const candidates = relevant.length ? relevant : SCENARIOS
  return candidates[Math.max(0, sequence) % candidates.length]
}

const buildListeningSession = ({
  id,
  date,
  timestamp,
  sequence = 0,
  scenarioId = '',
  sourceSnapshot,
  catalog = loadVocabularyCatalog()
}) => {
  const scenario = chooseScenario({ sourceSnapshot, sequence, scenarioId })
  const glossary = buildGlossary({ scenario, catalog, sourceSnapshot })
  const segments = scenario.segments.map((segment, index) => ({
    id: id + '-segment-' + (index + 1),
    ...segment
  }))

  return validateListeningSession({
    schema_version: LISTENING_LAB_SCHEMA_VERSION,
    revision: 1,
    updated_at: timestamp,
    id,
    date,
    created_at: timestamp,
    source_snapshot_id: sourceSnapshot.id,
    prompt_file: 'study/listening/prompts/generated/' + id + '.md',
    plan: {
      title: scenario.title,
      scenario_id: scenario.id,
      scenario_label: scenario.label,
      level: scenario.level,
      estimated_minutes: 20,
      focus_lessons: scenario.lessons.filter((lesson) =>
        sourceSnapshot.focus_lessons.includes(lesson)
      ).length
        ? scenario.lessons.filter((lesson) => sourceSnapshot.focus_lessons.includes(lesson))
        : scenario.lessons,
      target_grammar: scenario.grammar,
      target_vocabulary_ids: glossary.map((item) => item.id),
      goals: scenario.goals
    },
    audio: {
      lang: 'ja-JP',
      default_rate: 0.9,
      voice_hint: 'Japanese'
    },
    script: {
      title: scenario.title,
      summary_zh: scenario.label + '。先盲听，再对照文本完成分段跟读。',
      full_text: segments.map((segment) => segment.text).join(' '),
      segments,
      glossary
    },
    comprehension: {
      questions: scenario.questions.map((question, index) => ({
        id: id + '-question-' + (index + 1),
        type: question.type,
        prompt_zh: question.prompt_zh,
        choices: question.choices,
        answer_reference: question.answer_reference,
        accepted_keywords: question.accepted_keywords,
        explanation_zh: question.explanation_zh,
        segment_ids: question.segment_indexes.map(
          (segmentIndex) => segments[segmentIndex].id
        )
      }))
    },
    workplace_response: scenario.response
  })
}

const buildListeningAttempt = ({ session, attemptNumber, timestamp }) =>
  validateListeningAttempt({
    schema_version: LISTENING_LAB_SCHEMA_VERSION,
    revision: 1,
    updated_at: timestamp,
    id: session.id + '-attempt-' + String(attemptNumber).padStart(2, '0'),
    session_id: session.id,
    status: 'in_progress',
    started_at: timestamp,
    submitted_at: null,
    current_stage: 'blind_listening',
    transcript_revealed: false,
    playback_counts: {
      full: 0,
      ...Object.fromEntries(session.script.segments.map((segment) => [segment.id, 0]))
    },
    answers: Object.fromEntries(
      session.comprehension.questions.map((question) => [question.id, ''])
    ),
    response_answer: '',
    shadowing: session.script.segments.map((segment) => ({
      segment_id: segment.id,
      completed: false,
      self_rating: null,
      recording_file: null,
      recorded_at: null
    })),
    reflection: {
      confidence: null,
      difficult_segment_ids: [],
      note: ''
    },
    feedback: null
  })

export {
  SCENARIOS,
  buildGlossary,
  buildListeningAttempt,
  buildListeningSession,
  chooseScenario
}
