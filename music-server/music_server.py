#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""拾心界 · 一起听歌 —— 本地网易云音乐代理服务（零依赖，仅标准库）

作用：
  拾心界是纯前端站点（双击 index.html 打开），浏览器无法直连网易云接口（跨域+防盗链+需登录Cookie）。
  本服务在本地跑一个小型 HTTP 服务，带 CORS（Access-Control-Allow-Origin: *），
  供拾心界前端 fetch 完成：搜索歌曲 / 导入歌单 / 获取播放链接 / 歌词，并在本地缓存音频文件。

用法：
  python3 music_server.py            # 默认端口 9801
  PORT=9090 python3 music_server.py  # 自定义端口
  也可直接双击 start.command（自动后台启动本服务）

Cookie（可选但强烈建议）：
  在 music-server 目录下创建 .netease_cred 文件，内容一行：
      MUSIC_U=你的网易云登录Cookie
  配置后能播放需要登录/会员的歌曲；不配置也能播放部分免费歌曲。

接口：
  GET /health                         健康检查（无鉴权）
  GET /search?q=关键词                搜索歌曲，返回 {songs:[{id,name,artist,album,cover}]}
  GET /playlist?id=歌单ID              导入网易云歌单（也兼容 "https://music.163.com/#/playlist?id=xxx" 链接），返回 {name, songs:[...]}
  GET /song/url?id=歌曲ID              获取/缓存音频，返回 {url:"/file/<id>.mp3"|null, error?}
  GET /file/<id>.mp3                   带 Range 的本地缓存音频
  GET /lyric?id=歌曲ID                 歌词（可选功能）
数据目录：music-server/cache/  （音频与歌词缓存）
"""
from __future__ import annotations

import json
import mimetypes
import os
import re
import sys
import time
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
CACHE_DIR = HERE / "cache"
PORT = int(os.environ.get("PORT", "9801"))

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"


def log(*args):
    line = " ".join(str(a) for a in args)
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {line}", flush=True)


# ── 网易云 Cookie（可选）────────────────────────────────────────────────────
def netease_cookie() -> str:
    cred = HERE / ".netease_cred"
    try:
        for line in cred.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("MUSIC_U="):
                return f"MUSIC_U={line.split('=', 1)[1].strip()}"
    except OSError:
        pass
    return ""


def netease_request(url: str, data: bytes | None = None,
                    headers: dict | None = None, timeout: int = 12):
    """带网易云来源头的请求，返回解析后的 JSON。"""
    hdrs = {
        "Cookie": netease_cookie(),
        "Referer": "https://music.163.com",
        "User-Agent": UA,
    }
    if headers:
        hdrs.update(headers)
    if data is not None:
        hdrs["Content-Type"] = "application/x-www-form-urlencoded"
    req = urllib.request.Request(url, data=data, headers=hdrs)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", errors="replace"))


def _norm_song(s, force_id_key="id"):
    """把网易云原始歌曲对象整理成拾心界用的轻量结构。"""
    sid = s.get("id") or s.get("songId")
    artists = s.get("artists") or (s.get("ar") or [])
    album = s.get("album") or {}
    al_name = album.get("name", "")
    al_pic = album.get("picUrl") or album.get("pic") or ""
    artist_name = ", ".join(a.get("name", "") for a in artists if a.get("name"))
    if al_pic and not al_pic.startswith("http"):
        al_pic = "https:" + al_pic
    # fee: 0=免费, 1=VIP, 4=付费下载, 8=其他; 无则尝试取 privilege 里的 fee
    fee = s.get("fee")
    if fee is None:
        fee = (s.get("privilege") or {}).get("fee") or 0
    return {
        "id": sid,
        "name": s.get("name", ""),
        "artist": artist_name,
        "album": al_name,
        "cover": al_pic,
        "duration": s.get("duration") or s.get("dt") or 0,
        "fee": int(fee or 0),
    }


def parse_playlist_id(input_str: str):
    """从歌单链接或纯数字 ID 中提取歌单 ID。"""
    s = str(input_str).strip()
    if s.isdigit():
        return s
    m = re.search(r"[?&#]id=(\d+)", s)
    if m:
        return m.group(1)
    m = re.search(r"/playlist/(\d+)", s)
    if m:
        return m.group(1)
    return None


# ── 网易云接口封装 ──────────────────────────────────────────────────────────

def _fill_covers(songs):
    """搜索接口不返回封面，批量用 song/detail 补齐封面图。失败静默跳过。"""
    if not songs:
        return songs
    ids = ",".join(str(s["id"]) for s in songs)
    try:
        url = f"https://music.163.com/api/song/detail?ids=[{ids}]"
        raw = netease_request(url)
        songs_map = {str(s.get("id")): s for s in (raw.get("songs") or [])}
        for item in songs:
            detail = songs_map.get(str(item["id"]))
            if not detail:
                continue
            album = detail.get("album") or {}
            pic = album.get("picUrl") or ""
            if pic and not pic.startswith("http"):
                pic = "https:" + pic
            if pic:
                item["cover"] = pic
    except Exception:
        pass  # 封面非关键，失败静默
    return songs


def search_songs(keyword: str, limit: int = 20):
    """先试新版 weapi 封装会失败，统一走老版公开搜索接口。"""
    url = "https://music.163.com/api/search/get"
    post = urllib.parse.urlencode({
        "s": keyword, "type": "1", "limit": str(limit), "offset": "0",
    }).encode()
    raw = netease_request(url, data=post)
    result = raw.get("result") or {}
    songs = result.get("songs") or []
    out = []
    for s in songs[:limit]:
        item = _norm_song(s)
        item["_src"] = "search"
        out.append(item)
    return _fill_covers(out)


def playlist_detail(pid: str, limit: int = 20000, exclude_vip: bool = False):
    """获取网易云歌单【完整】歌曲。

    新版 v6 接口 POST /api/v6/playlist/detail 返回 playlist.trackIds（全量 id）
    与 playlist.tracks（全量歌曲，含 fee 字段）。优先用 trackIds 分批调
    song/detail 补齐（保证全量），trackIds 缺失时直接用 tracks 兜底。
    可选 exclude_vip：过滤掉 VIP/付费歌曲（fee in (1,4)）。
    返回 (name, songs, skipped, source)。
    """
    def _is_vip(item):
        return int(item.get("fee") or 0) in (1, 4)

    raw = netease_request(
        "https://music.163.com/api/v6/playlist/detail",
        data=urllib.parse.urlencode({"id": pid, "n": "1000", "s": "8"}).encode(),
        timeout=15,
    )
    pl = raw.get("playlist") or {}
    name = pl.get("name", "未命名歌单")
    track_ids = [t.get("id") for t in (pl.get("trackIds") or []) if t.get("id")]
    tracks = pl.get("tracks") or []

    out = []
    source = "v6-trackIds"
    if track_ids:
        for i in range(0, len(track_ids), 200):
            if len(out) >= limit:
                break
            batch = track_ids[i:i + 200]
            ids_str = "[" + ",".join(str(x) for x in batch) + "]"
            try:
                d = netease_request(f"https://music.163.com/api/song/detail?ids={ids_str}")
            except Exception:
                time.sleep(0.3)
                continue
            got = 0
            for s in (d.get("songs") or []):
                item = _norm_song(s)
                item["_src"] = "playlist"
                out.append(item)
                got += 1
            if got == 0:
                time.sleep(0.5)
            else:
                time.sleep(0.15)
        if not out:
            source = "v6-tracks"
            for s in tracks[:limit]:
                item = _norm_song(s)
                item["_src"] = "playlist"
                out.append(item)
    else:
        source = "v6-tracks"
        for s in tracks[:limit]:
            item = _norm_song(s)
            item["_src"] = "playlist"
            out.append(item)
    if not out:
        return name, [], 0, source

    skipped = 0
    if exclude_vip:
        kept = []
        for it in out:
            if _is_vip(it):
                skipped += 1
                continue
            kept.append(it)
        out = kept
    return name, out[:limit], skipped, source


def fetch_song_url(song_id) -> tuple:
    """获取歌曲可播放地址，并下载到本地缓存。返回 (ok, url_or_error, action)。"""
    cache_dir = CACHE_DIR
    cache_dir.mkdir(parents=True, exist_ok=True)
    mp3 = cache_dir / f"{song_id}.mp3"
    if mp3.exists() and mp3.stat().st_size > 1024:
        return True, f"/file/{song_id}.mp3", "cached"
    br = os.environ.get("BR", "128000")
    url = f"https://music.163.com/api/song/enhance/player/url?ids=[{song_id}]&br={br}"
    try:
        raw = netease_request(url)
        data_list = raw.get("data") or []
        audio_url = data_list[0].get("url") if data_list else None
        if not audio_url:
            return False, "无播放地址（歌曲可能需会员/登录）", "no-url"
        # 下载到本地缓存（带 Referer/Cookie 绕过防盗链）
        areq = urllib.request.Request(audio_url, headers={
            "User-Agent": UA,
            "Referer": "https://music.163.com",
            "Cookie": netease_cookie(),
        })
        tmp = mp3.with_suffix(".tmp")
        with urllib.request.urlopen(areq, timeout=120) as aresp:
            with open(tmp, "wb") as f:
                while True:
                    chunk = aresp.read(65536)
                    if not chunk:
                        break
                    f.write(chunk)
        tmp.rename(mp3)
        if mp3.stat().st_size > 1024:
            return True, f"/file/{song_id}.mp3", "downloaded"
        mp3.unlink(missing_ok=True)
        return False, "下载失败（文件过小）", "download-short"
    except urllib.error.HTTPError as e:
        return False, f"下载失败 HTTP {e.code}", "http-error"
    except Exception as e:
        return False, str(e), "exception"


def fetch_lyric(song_id):
    cache_dir = CACHE_DIR
    cache_dir.mkdir(parents=True, exist_ok=True)
    lrc_f = cache_dir / f"{song_id}.lrc"
    if lrc_f.exists():
        return True, lrc_f.read_text(encoding="utf-8", errors="replace")
    try:
        url = f"https://music.163.com/api/song/lyric?id={song_id}&lv=1&tv=-1"
        raw = netease_request(url)
        lrc = (raw.get("lrc") or {}).get("lyric", "")
        if lrc:
            lrc_f.write_text(lrc, encoding="utf-8")
        return True, lrc
    except Exception:
        return False, ""


# ── HTTP 服务 ───────────────────────────────────────────────────────────────

class ListenTogetherHandler(BaseHTTPRequestHandler):
    server_version = "ListenTogether/1.0"

    def log_message(self, fmt, *args):
        pass  # 自己打日志，去重

    def _send_json(self, status: int, body: dict):
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Range")
        self.end_headers()
        self.wfile.write(data)

    def _send_audio(self, path: str):
        """带 Range 支持的本地音频文件服务。"""
        filename = path[len("/file/"):]
        if not filename or ".." in filename or "/" in filename:
            self._send_json(400, {"error": "bad path"})
            return
        target = (CACHE_DIR / filename).resolve()
        try:
            target.relative_to(CACHE_DIR.resolve())
        except ValueError:
            self._send_json(403, {"error": "forbidden"})
            return
        if not target.exists() or not target.is_file():
            self._send_json(404, {"error": "not found"})
            return
        size = target.stat().st_size
        ctype = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        range_header = self.headers.get("Range")
        if range_header:
            try:
                spec = range_header.replace("bytes=", "")
                start_str, end_str = spec.split("-", 1)
                start = int(start_str) if start_str else 0
                end = int(end_str) if end_str else size - 1
                end = min(end, size - 1)
                length = end - start + 1
                self.send_response(206)
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
                self.send_header("Content-Length", str(length))
                self.send_header("Content-Type", ctype)
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                with open(target, "rb") as f:
                    f.seek(start)
                    remaining = length
                    while remaining > 0:
                        chunk = f.read(min(65536, remaining))
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                        remaining -= len(chunk)
                return
            except Exception:
                pass
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(size))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        with open(target, "rb") as f:
            while True:
                chunk = f.read(65536)
                if not chunk:
                    break
                self.wfile.write(chunk)

    def do_HEAD(self):
        self.do_GET()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Range")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)
        if path == "/health":
            self._send_json(200, {"ok": True, "service": "listen-together", "version": "1.0"})
            return
        if path.startswith("/file/"):
            self._send_audio(path)
            return
        if path == "/search":
            q = (qs.get("q") or [""])[0].strip()
            if not q:
                self._send_json(400, {"error": "missing q"})
                return
            try:
                songs = search_songs(q, min(int((qs.get("limit") or ["20"])[0]), 50))
                self._send_json(200, {"ok": True, "songs": songs})
            except Exception as e:
                log("search error:", e)
                self._send_json(200, {"ok": False, "songs": [], "error": str(e)})
            return
        if path == "/playlist":
            pid = parse_playlist_id((qs.get("id") or [""])[0])
            if not pid:
                self._send_json(400, {"error": "invalid playlist id"})
                return
            skip_vip = (qs.get("skip_vip") or ["0"])[0] in ("1", "true", "yes", "on")
            try:
                name, songs, skipped, src = playlist_detail(pid, 20000, skip_vip)
                log(f"playlist id={pid} src={src} kept={len(songs)} skipped={skipped}")
                self._send_json(200, {"ok": True, "playlistId": pid, "name": name, "songs": songs, "skipped": skipped})
            except Exception as e:
                log("playlist error:", e)
                self._send_json(200, {"ok": False, "name": "", "songs": [], "error": str(e)})
            return
        if path == "/song/url":
            sid = (qs.get("id") or [""])[0].strip()
            if not sid:
                self._send_json(400, {"error": "missing id"})
                return
            try:
                ok, result, action = fetch_song_url(sid)
                if ok:
                    self._send_json(200, {"ok": True, "url": result, "action": action})
                else:
                    self._send_json(200, {"ok": False, "error": result})
            except Exception as e:
                log("song/url error:", e)
                self._send_json(500, {"ok": False, "error": str(e)})
            return
        if path == "/lyric":
            sid = (qs.get("id") or [""])[0].strip()
            if not sid:
                self._send_json(400, {"error": "missing id"})
                return
            ok, lrc = fetch_lyric(sid)
            self._send_json(200, {"ok": ok, "lrc": lrc})
            return
        self._send_json(404, {"error": "not found"})

    def do_POST(self):
        self._send_json(405, {"error": "method not allowed"})


def main():
    global PORT
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        PORT = int(sys.argv[1])
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", PORT), ListenTogetherHandler)
    log("=" * 50)
    log("拾心界 · 一起听歌 音乐服务已启动")
    log(f"地址: http://127.0.0.1:{PORT}")
    log(f"缓存目录: {CACHE_DIR}")
    if netease_cookie():
        log("网易云 Cookie: 已配置 ✓")
    else:
        log("网易云 Cookie: 未配置（可播放部分免费歌曲；建议创建 .netease_cred 写入 MUSIC_U=xxx）")
    log("按 Ctrl+C 停止服务")
    log("=" * 50)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("服务已停止")
        server.shutdown()


if __name__ == "__main__":
    main()
