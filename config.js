const CONFIG = {
    // Phase 5 开源重构：这里不再硬编码，而是做 fallback 读取，核心设置通过页面录入
    get GEMINI_API_KEY() {
        if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage.getItem('gemini_api_key') || "";
        }
        // Unit Test Mock fallback
        if (typeof process !== 'undefined' && process.env) {
            return process.env.GEMINI_API_KEY || "TEST_MOCK_API_KEY";
        }
        return "";
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}
