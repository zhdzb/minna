/**
 * 数据同步与导出模块
 * 负责打通 LocalStorage 和物理 data.json 的壁垒，以便完成 Git 同步
 */

class DataSync {
    // 导出当前的 LocalStorage 为 JSON 文件供用户保存到仓库
    static exportData() {
        const data = LocalState.getData();
        const dataStr = JSON.stringify(data, null, 2);
        
        // 创建一个 Blob 和下载链接
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'data.json';
        document.body.appendChild(a);
        a.click();
        
        // 清理
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert("进度已导出！请将其覆盖本目录下的 data.json 并用 git commit 提交同步。");
    }

    // 允许用户手动导入项目里的 data.json (通常在 git pull 之后)
    static async importDataFromFile(file) {
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            // 简单校验一下
            if (data && data.progress && data.mistakes_book) {
                LocalState.saveData(data);
                alert("学习进度恢复成功！页面将刷新。");
                window.location.reload();
            } else {
                throw new Error("JSON 格式不正确");
            }
        } catch (e) {
            alert("读取失败: " + e.message);
        }
    }
}

// 绑定到 Window
window.DataSync = DataSync;
