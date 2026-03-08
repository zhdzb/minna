/**
 * 负责本地数据同步和读取
 * 核心架构要求：无后端，使用浏览器的 LocalStorage 或纯 JS 变量作兜底
 */
class LocalState {
    static STORAGE_KEY = 'minna_app_data';

    static getDefaultData() {
        return {
            user_profile: {
                target_level: "JLPT_N4",
                focus: ["reading", "listening", "speaking"]
            },
            progress: {
                current_lesson: 1,
                completed_lessons: []
            },
            mistakes_book: [],
            collections: []
        };
    }

    static getData() {
        let dataStr = null;
        try {
           dataStr = localStorage.getItem(this.STORAGE_KEY);
        } catch(e) {
           // environment without localStorage, e.g. Node for testing
        }
        
        if (!dataStr) {
            // 在内存中保存一份作为兜底
            if (!this._memoryData) {
                 this._memoryData = this.getDefaultData();
            }
            return this._memoryData;
        }
        return JSON.parse(dataStr);
    }

    static saveData(data) {
        this._memoryData = data;
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        } catch(e) {
            // ignore
        }
    }

    static updateProgress(lessonNumber) {
        const data = this.getData();
        data.progress.current_lesson = lessonNumber;
        // 自动完成之前的课程
        for (let i = 1; i < lessonNumber; i++) {
            if (!data.progress.completed_lessons.includes(i)) {
                data.progress.completed_lessons.push(i);
            }
        }
        this.saveData(data);
    }

    static addMistake(mistakeData) {
        const data = this.getData();
        const entry = {
            id: 'm_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            lesson: mistakeData.lesson,
            grammar_point: mistakeData.grammar_point || 'Unknown',
            user_wrong_input: mistakeData.user_wrong_input,
            correct_answer: mistakeData.correct_answer,
            timestamp: Date.now(),
            review_count: 0
        };
        data.mistakes_book.push(entry);
        this.saveData(data);
    }

    static clearAll() {
        this._memoryData = null;
        try {
             localStorage.removeItem(this.STORAGE_KEY);
        } catch(e) {}
    }
}

// 兼容 Node.js 测试环境和浏览器环境
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocalState;
} else {
    window.LocalState = LocalState;
}
