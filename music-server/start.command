#!/bin/bash
# 拾心界 · 一起听歌 —— 启动本地音乐服务（双击本文件即可）
cd "$(dirname "$0")"

if curl -s -m 2 http://127.0.0.1:9801/health >/dev/null 2>&1; then
  echo "一起听歌音乐服务已在运行：http://127.0.0.1:9801"
  echo "直接回到拾心界聊天页 -> 加号菜单 -> 一起听歌 即可使用。"
  read -n 1 -p "按任意键关闭本窗口..."
  exit 0
fi

nohup python3 music_server.py > music_server.log 2>&1 &
sleep 1

echo ""
echo "=============================================="
echo "  拾心界 · 一起听歌 音乐服务已启动"
echo "  地址: http://127.0.0.1:9801"
echo "  缓存: $(pwd)/cache"
echo ""
echo "  用法: 回到拾心界聊天页 -> 加号(+) -> 一起听歌"
echo "  停止: 双击 stop.command"
echo "=============================================="
echo ""
read -n 1 -p "按任意键关闭本窗口（服务会继续在后台运行）..."
