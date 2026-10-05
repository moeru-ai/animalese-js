#!/usr/bin/env python3
"""Transcribe pre-segmented audio with Qwen3-ASR and its forced aligner."""

import argparse
import json
from pathlib import Path

import torch
from qwen_asr import Qwen3ASRModel


def serialize_timestamp(item, offset):
    return {
        "text": item.text,
        "start": round(float(item.start_time) + offset, 3),
        "end": round(float(item.end_time) + offset, 3),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--segment-seconds", type=float, default=240.0)
    parser.add_argument("--language", default="Chinese")
    parser.add_argument("--context", default="")
    parser.add_argument("--model", default="Qwen/Qwen3-ASR-0.6B")
    args = parser.parse_args()

    files = sorted(
        path
        for path in Path(args.input_dir).iterdir()
        if path.suffix.lower() in {".flac", ".wav", ".mp3", ".m4a"}
    )
    if not files:
        raise SystemExit(f"no audio segments found in {args.input_dir}")

    model = Qwen3ASRModel.from_pretrained(
        args.model,
        dtype=torch.bfloat16,
        device_map="cuda:0",
        max_inference_batch_size=1,
        max_new_tokens=2048,
        forced_aligner="Qwen/Qwen3-ForcedAligner-0.6B",
        forced_aligner_kwargs={"dtype": torch.bfloat16, "device_map": "cuda:0"},
    )

    completed = []
    output = Path(args.output)
    if output.exists():
        completed = json.loads(output.read_text(encoding="utf-8"))
    done = {entry["file"] for entry in completed}

    for index, path in enumerate(files):
        if path.name in done:
            continue
        offset = index * args.segment_seconds
        result = model.transcribe(
            audio=str(path),
            language=args.language or None,
            context=args.context,
            return_time_stamps=True,
        )[0]
        completed.append(
            {
                "file": path.name,
                "offset": offset,
                "language": result.language,
                "text": result.text,
                "timestamps": [serialize_timestamp(x, offset) for x in (result.time_stamps or [])],
            }
        )
        output.write_text(json.dumps(completed, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps({"file": path.name, "text": result.text}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
