#!/usr/bin/env python3
"""Synthesize one line with edge-tts and write mp3 + word/sentence timestamps.

WordBoundary offsets from the service are in 100-nanosecond ticks.
"""

import argparse
import asyncio
import json
import sys

import edge_tts


def sentences_from_words(words):
    sentences = []
    current = []
    for word in words:
        if current:
            gap = word["start"] - current[-1]["end"]
            prev = current[-1]["text"]
            if gap > 0.45 or (prev and prev[-1] in "。！？!?"):
                sentences.append(span(current))
                current = []
        current.append(word)
    if current:
        sentences.append(span(current))
    return sentences


def span(words):
    return {
        "text": "".join(word["text"] for word in words),
        "start": words[0]["start"],
        "end": words[-1]["end"],
    }


async def synthesize(text, voice, rate, mp3_path, meta_path):
    communicate = edge_tts.Communicate(
        text,
        voice,
        rate=rate,
        boundary="WordBoundary",
    )
    audio = bytearray()
    words = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            start = chunk["offset"] / 10_000_000
            duration = chunk["duration"] / 10_000_000
            words.append(
                {
                    "text": chunk["text"],
                    "start": round(start, 4),
                    "end": round(start + duration, 4),
                }
            )
    if not audio or not words:
        raise RuntimeError("edge-tts 沒有回傳音訊或單字時間")
    with open(mp3_path, "wb") as handle:
        handle.write(audio)
    meta = {
        "text": text,
        "voice": voice,
        "rate": rate,
        "provider": "edge",
        "words": words,
        "sentences": sentences_from_words(words),
    }
    with open(meta_path, "w", encoding="utf-8") as handle:
        json.dump(meta, handle, ensure_ascii=False, indent=2)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", required=True)
    parser.add_argument("--voice", required=True)
    parser.add_argument("--rate", default="+0%")
    parser.add_argument("--mp3", required=True)
    parser.add_argument("--meta", required=True)
    args = parser.parse_args()
    try:
        asyncio.run(synthesize(args.text, args.voice, args.rate, args.mp3, args.meta))
    except Exception as exc:
        print(f"{type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
