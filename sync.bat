@echo off
REM 同步用户学习进度的快捷脚本
REM 使用方法：双击运行

echo ===================================
echo 🌸 Minna no Nihongo Data Sync 🌸
echo ===================================

echo [1/3] 检查并添加本地变更 (git add) ...
git add .

echo [2/3] 提交本地学习进度 (git commit) ...
git commit -m "docs: sync user learning progress data"

echo [3/3] 推送并拉取最新进度 (git pull & git push) ...
git pull origin main --rebase
git push origin main

echo ===================================
echo ✅ 同步完成！您的进度已保存到远端。
echo ===================================
pause
