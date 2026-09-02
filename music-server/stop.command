#!/bin/bash
# 拾心界 · 一起听歌 —— 停止本地音乐服务（双击本文件即可）
pkill -f "music_server.py" 2>/dev/null
sleep 1
echo "一起听歌音乐服务已停止。"
read -n 1 -p "按任意键关闭本窗口..."
