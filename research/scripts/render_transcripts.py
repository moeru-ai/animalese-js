#!/usr/bin/env python3
"""Render Qwen3-ASR JSON into Markdown and SRT transcript documents."""

import argparse
import json
from pathlib import Path


def clock(seconds, srt=False):
    millis = round(float(seconds) * 1000)
    hours, rem = divmod(millis, 3_600_000)
    minutes, rem = divmod(rem, 60_000)
    secs, ms = divmod(rem, 1000)
    sep = "," if srt else "."
    if srt:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}{sep}{ms:03d}"
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


def join_tokens(tokens):
    text = ""
    for token in tokens:
        piece = token["text"]
        if text and piece and text[-1].isascii() and piece[0].isascii() and text[-1].isalnum() and piece[0].isalnum():
            text += " "
        text += piece
    return text.strip()


def sentence_cues(entries, max_duration=12.0):
    cues, current = [], []
    terminal = set("。！？!?；;\n")
    for entry in entries:
        for token in entry.get("timestamps", []):
            current.append(token)
            duration = token["end"] - current[0]["start"]
            if token["text"][-1:] in terminal or duration >= max_duration:
                cues.append(current)
                current = []
    if current:
        cues.append(current)
    return cues


def write_srt(path, entries):
    lines = []
    for index, cue in enumerate(sentence_cues(entries), 1):
        lines.extend(
            [
                str(index),
                f"{clock(cue[0]['start'], True)} --> {clock(cue[-1]['end'], True)}",
                join_tokens(cue),
                "",
            ]
        )
    path.write_text("\n".join(lines), encoding="utf-8")


def render_video(entries, output, source_url):
    tokens = [token for entry in entries for token in entry.get("timestamps", [])]
    end = max((token["end"] for token in tokens), default=0)
    lines = [
        "# BV1Mf4y1S7Gs 转录",
        "",
        f"来源：[{source_url}]({source_url})",
        "",
        "> 由 Qwen3-ASR-0.6B 自动转录，并用 Qwen3-ForcedAligner-0.6B 对齐时间戳。示范中的拟声、快速读音和英文软件名可能存在误识别；下文保留机器结果，仅做了按时间分段。",
        "",
        "> 专名核对：画面水印与元数据表明 UP 主为“重轻_大灰狠”；`glows` 应为 `GLaDOS`；`Waves Tune Life` 应为画面中的 `Waves Tune Real-Time`。为保证可追溯性，正文没有直接覆盖模型原词。",
        "",
        "## 连续文本（保留模型标点）",
        "",
        "\n\n".join(entry.get("text", "").strip() for entry in entries),
        "",
        "## 时间轴",
        "",
    ]
    bucket = 15
    for start in range(0, int(end) + bucket, bucket):
        selected = [token for token in tokens if start <= token["start"] < start + bucket]
        if not selected:
            continue
        image = f"../screenshots/video/{start:03d}s.jpg"
        lines.extend(
            [
                f"### {clock(start)}–{clock(min(start + bucket, end))}",
                "",
                f"![{clock(start)} 画面]({image})",
                "",
                join_tokens(selected),
                "",
            ]
        )
    output.write_text("\n".join(lines), encoding="utf-8")


def render_audio(entries, output, source_path):
    lines = [
        "# 9968b25b-ed24-494e-96de-928406cda51b.mp3 转录",
        "",
        f"来源：`{source_path}`",
        "",
        "> 由 Qwen3-ASR-0.6B 自动转录，并用 Qwen3-ForcedAligner-0.6B 对齐时间戳。原音频较长，按约四分钟切分；切点附近可能有断句或漏字。每节附该时段的完整波形。",
        "",
        "> 内容提示：开头约一分半为有声书广告；主体为动森与电子游戏拟声语音讨论；01:16:00 后为英文歌曲。歌曲已用 English 模式单独重跑，但歌唱识别仍属低置信度。明显专名可能包括 Animalese、Bebebese、Simlish、GLaDOS、Splatoon、Celeste、Star Fox 与 Metal Gear，正文保留模型原词。",
        "",
    ]
    for index, entry in enumerate(entries):
        timestamps = entry.get("timestamps", [])
        start = entry["offset"]
        end = timestamps[-1]["end"] if timestamps else start + 240
        text = entry.get("text", "").strip() or join_tokens(timestamps)
        image = f"../screenshots/audio/segment_{index:03d}.png"
        lines.extend(
            [
                f"## {clock(start)}–{clock(end)}",
                "",
                f"![{clock(start)}–{clock(end)} 波形]({image})",
                "",
                text,
                "",
            ]
        )
    output.write_text("\n".join(lines), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", required=True)
    parser.add_argument("--markdown", required=True)
    parser.add_argument("--srt", required=True)
    parser.add_argument("--kind", choices=("video", "audio"), required=True)
    parser.add_argument("--source", required=True)
    args = parser.parse_args()

    entries = json.loads(Path(args.json).read_text(encoding="utf-8"))
    markdown = Path(args.markdown)
    markdown.parent.mkdir(parents=True, exist_ok=True)
    if args.kind == "video":
        render_video(entries, markdown, args.source)
    else:
        render_audio(entries, markdown, args.source)
    write_srt(Path(args.srt), entries)


if __name__ == "__main__":
    main()
