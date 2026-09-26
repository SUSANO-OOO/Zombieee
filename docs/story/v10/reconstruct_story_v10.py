#!/usr/bin/env python3
"""Reconstruct and verify the exact v10 story Markdown source."""

from __future__ import annotations

import argparse
import base64
import binascii
import bz2
import hashlib
from pathlib import Path

EXPECTED_PARTS = 15
EXPECTED_COMPRESSED_BYTES = 33_613
EXPECTED_COMPRESSED_SHA256 = (
    "cf20d5637fb94c8a62abfc946980e3b03e94e3b318e5304e91b19d022c794815"
)
EXPECTED_SOURCE_BYTES = 138_747
EXPECTED_SOURCE_LINES = 2_681
EXPECTED_SOURCE_SHA256 = (
    "c7293d739998431c38f337a7ef8d4e724b74696537ff44ad8f0c30d854a017a4"
)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def reconstruct(output_path: Path) -> None:
    root = Path(__file__).resolve().parent
    source_dir = root / "source"
    parts = sorted(source_dir.glob("STORY_SCRIPT_V10.md.bz2.base64.part*"))

    if len(parts) != EXPECTED_PARTS:
        raise RuntimeError(
            f"Expected {EXPECTED_PARTS} source parts, found {len(parts)}: "
            f"{[path.name for path in parts]}"
        )

    expected_names = [
        f"STORY_SCRIPT_V10.md.bz2.base64.part{index:02d}"
        for index in range(1, EXPECTED_PARTS + 1)
    ]
    actual_names = [path.name for path in parts]
    if actual_names != expected_names:
        raise RuntimeError(
            "Source part names are missing, duplicated, or out of order. "
            f"Expected {expected_names}; found {actual_names}"
        )

    encoded = "".join(
        "".join(path.read_text(encoding="ascii").split()) for path in parts
    )

    try:
        compressed = base64.b64decode(encoded, validate=True)
    except binascii.Error as exc:
        raise RuntimeError("The source archive is not valid base64") from exc

    compressed_hash = sha256(compressed)
    if len(compressed) != EXPECTED_COMPRESSED_BYTES:
        raise RuntimeError(
            f"Compressed byte count mismatch: expected {EXPECTED_COMPRESSED_BYTES}, "
            f"found {len(compressed)}"
        )
    if compressed_hash != EXPECTED_COMPRESSED_SHA256:
        raise RuntimeError(
            "Compressed SHA-256 mismatch: "
            f"expected {EXPECTED_COMPRESSED_SHA256}, found {compressed_hash}"
        )

    try:
        source = bz2.decompress(compressed)
    except OSError as exc:
        raise RuntimeError("The bzip2 source archive cannot be decompressed") from exc

    source_hash = sha256(source)
    source_lines = len(source.splitlines())
    if len(source) != EXPECTED_SOURCE_BYTES:
        raise RuntimeError(
            f"Source byte count mismatch: expected {EXPECTED_SOURCE_BYTES}, "
            f"found {len(source)}"
        )
    if source_lines != EXPECTED_SOURCE_LINES:
        raise RuntimeError(
            f"Source line count mismatch: expected {EXPECTED_SOURCE_LINES}, "
            f"found {source_lines}"
        )
    if source_hash != EXPECTED_SOURCE_SHA256:
        raise RuntimeError(
            "Source SHA-256 mismatch: "
            f"expected {EXPECTED_SOURCE_SHA256}, found {source_hash}"
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(source)

    print(f"Wrote: {output_path}")
    print(f"UTF-8 bytes: {len(source)}")
    print(f"Lines: {source_lines}")
    print(f"SHA-256: {source_hash}")
    print("VERIFIED: exact v10 story source")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Reconstruct the exact v10 story Markdown and verify its hashes."
    )
    parser.add_argument(
        "output",
        nargs="?",
        type=Path,
        default=Path("/tmp/STORY_SCRIPT_V10.md"),
        help="Output Markdown path (default: /tmp/STORY_SCRIPT_V10.md)",
    )
    args = parser.parse_args()
    reconstruct(args.output)


if __name__ == "__main__":
    main()
