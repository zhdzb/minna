# 🗻 日语进阶私教 (Minna no Nihongo AI Tutor)

一款**全纯前端**、**0 后端服务成本**、**基于 Google Gemini 2.5 驱动**的个人日语辅助伴读 Web 应用。专注于《大家的日语》体系，为您提供针对性的语法训练、造句批改、情景口语、职场礼仪补全等全方位私教指导！

![Demo Preview](src/assets/anime_bg.png)

## 🌟 核心理念与技术极客特色
本项目的最大特点是：**完全无须自建服务器，100% Client-Side 运行**。我们利用强大的 Chrome `LocalStorage` 进行数据闭环，同时将高强度的智力运算下放给了目前慷慨免费的 Google Gemini API。
您可以十分放心地在公司或公网开启它：应用内置了 **工作伪装 (VSCode Dark)** 与 **ACG 沉浸二次元** 双皮肤，按 `Alt + D` 即可在一瞬间隐匿所有动漫元素。

## ✨ Core Features (硬核特性)
- 🧠 **真·AI 知识追踪驱动**：区别于普通的死题库，AI Agent 会通过加载深度的打分算法与课程知识点 `syllabus.json` (内置详细课时语感)，为您跨课时**动态组合出题**。
- 📊 **细粒度数据可视化**：通过直观的网格流跳转，实时观察你的单元掌握度，并能在批改报告页一键触发**同语法点弱项大回环加练**。
- 📓 **艾宾浩斯错题回收站**：每次做错的造句均会被抓取进错题库。你可以随时回看复盘自己犯下错误的语法逻辑（带有 AI 的详细纠偏中文解析及罗马音标注、汉字校正）。
- 🗣️ **全局 Web Speech 语音磨耳朵**：内置原生的 `speechSynthesis`，你看到的每一条日语句子都能在页面随时进行母语级的全句发音，全面模拟高频度泛听环境。
- 🎨 **极致心流交互 (Vue3 + Element Plus)**：沉寂的深空琉璃色搭配极简按钮，没有繁复的花里胡哨功能干扰。

## 🚀 起步指南 / Quick Start

**1️⃣ 克隆或下载代码：**
```bash
git clone https://github.com/your-repo/minna-no-nihongo-tutor.git
cd minna-no-nihongo-tutor
npm install
```

**2️⃣ 获取一枚 Gemini API Key：**
本应用无需注册任何三方系统，只需要您自己去 Google AI Studio 申请一个个人专属的免费密钥。
获取地址：`https://aistudio.google.com/app/apikey`

**3️⃣ 本地极速启动：**
```bash
npm run dev
# 或使用 npm run start (基于 vite 开发服务器)
```

**4️⃣ 初始化装填向导：**
首次进入 Web 界面，点击左侧菜单底部的 **⚙️ 全局系统设置**。
把您申请到的 `AIzaSy...` 密钥填入到该面板并保存（密钥仅保存在你当前浏览器的 LocalStorage 中，绝对物理隔离，无法被任何人截获）。
同时，您可以在该页面自定义您的 ACG 模式背景图像网址。开始沉浸式学习！

## 👨‍💻 二度开发与魔改
- **更改教材体系**：若您想训练新标日或 N2 系列，只需替换项目根目录下的 `src/data/syllabus.json` 课时字段字典，系统即可无缝衔接。
- **自定义题型扩展**：我们在 `src/data/types.json` 允许您随时在全局题库添加诸如“看图说话”、“新闻理解”、“商务敬语听写”等新范式，AI 出题流会自动承接识别。

---
*Built with Vue 3, Vite, Pinia, Element Plus, WanKana.js, and endless love for Anime culture.*
