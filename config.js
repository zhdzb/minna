const CONFIG = {
    _sanitizeApiKey(raw) {
        const value = String(raw || "").trim().replace(/^['"]|['"]$/g, "");
        // Header values must be ByteString-safe. Drop non-ASCII residue from copied placeholders.
        return /[^\x00-\x7F]/.test(value) ? "" : value;
    },
    // Phase 5 开源重构：这里不再硬编码，而是做 fallback 读取，核心设置通过页面录入
    get GEMINI_API_KEY() {
        if (typeof window !== 'undefined' && window.localStorage) {
            return this._sanitizeApiKey(window.localStorage.getItem('gemini_api_key'));
        }
        // Unit Test Mock fallback
        if (typeof process !== 'undefined' && process.env) {
            return this._sanitizeApiKey(process.env.GEMINI_API_KEY || "TEST_MOCK_API_KEY");
        }
        return "";
    },
    get OPENAI_API_KEY() {
        if (typeof window !== 'undefined' && window.localStorage) {
            return this._sanitizeApiKey(window.localStorage.getItem('openai_api_key'));
        }
        if (typeof process !== 'undefined' && process.env) {
            return this._sanitizeApiKey(process.env.OPENAI_API_KEY);
        }
        return "";
    },
    get LLM_PROVIDER() {
        if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage.getItem('llm_provider') || "gemini";
        }
        if (typeof process !== 'undefined' && process.env) {
            return process.env.LLM_PROVIDER || "gemini";
        }
        return "gemini";
    },
    get GEMINI_MODEL() {
        if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage.getItem('gemini_model') || "gemini-2.5-flash";
        }
        if (typeof process !== 'undefined' && process.env) {
            return process.env.GEMINI_MODEL || "gemini-2.5-flash";
        }
        return "gemini-2.5-flash";
    },
    get OPENAI_MODEL() {
        if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage.getItem('openai_model') || "gpt-5.4";
        }
        if (typeof process !== 'undefined' && process.env) {
            return process.env.OPENAI_MODEL || "gpt-5.4";
        }
        return "gpt-5.4";
    },
    get OPENAI_BASE_URL() {
        if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage.getItem('openai_base_url') || "https://llmapi.devart.ai";
        }
        if (typeof process !== 'undefined' && process.env) {
            return process.env.OPENAI_BASE_URL || "https://llmapi.devart.ai";
        }
        return "https://llmapi.devart.ai";
    },
    get OPENAI_REASONING_EFFORT() {
        if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage.getItem('openai_reasoning_effort') || "xhigh";
        }
        if (typeof process !== 'undefined' && process.env) {
            return process.env.OPENAI_REASONING_EFFORT || "xhigh";
        }
        return "xhigh";
    },
    get OPENROUTER_API_KEY() {
        if (typeof window !== 'undefined' && window.localStorage) {
            return this._sanitizeApiKey(window.localStorage.getItem('openrouter_api_key'));
        }
        if (typeof process !== 'undefined' && process.env) {
            return this._sanitizeApiKey(process.env.OPENROUTER_API_KEY);
        }
        return "";
    },
    get OPENROUTER_MODEL() {
        if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage.getItem('openrouter_model') || "minimax/minimax-m2.7";
        }
        if (typeof process !== 'undefined' && process.env) {
            return process.env.OPENROUTER_MODEL || "minimax/minimax-m2.7";
        }
        return "minimax/minimax-m2.7";
    },
    get OPENROUTER_BASE_URL() {
        if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage.getItem('openrouter_base_url') || "https://openrouter.ai/api";
        }
        if (typeof process !== 'undefined' && process.env) {
            return process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api";
        }
        return "https://openrouter.ai/api";
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}
