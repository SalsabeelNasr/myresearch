#!/usr/bin/env python3
"""Download remote CDN thumbnails referenced in a vertical's data.js and
rewrite the file to point at locally-stored copies.

Instagram/Facebook CDN image URLs are signed and time-limited, so hotlinking
them from the static site fails intermittently and eventually breaks entirely.
Storing the images in the repo makes the thumbnails reliable.

Usage: python3 localize_thumbnails.py <vertical-dir> [<vertical-dir> ...]
       python3 localize_thumbnails.py            # defaults to all known verticals
"""
import hashlib
import re
import sys
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent
DEFAULT_VERTICALS = ["gastro", "nutrition"]
CDN_RE = re.compile(r'https?://[^"\\]+(?:cdninstagram\.com|fbcdn\.net)[^"\\]*')
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": ""})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def localize(vertical: str) -> None:
    base = REPO / vertical
    data_file = base / "data.js"
    if not data_file.exists():
        print(f"[{vertical}] no data.js, skipping")
        return
    text = data_file.read_text(encoding="utf-8")
    urls = sorted(set(CDN_RE.findall(text)))
    if not urls:
        print(f"[{vertical}] no remote thumbnails found")
        return

    thumbs_dir = base / "thumbs"
    thumbs_dir.mkdir(exist_ok=True)
    print(f"[{vertical}] {len(urls)} unique remote thumbnails")

    ok = fail = 0
    for url in urls:
        name = hashlib.sha1(url.encode("utf-8")).hexdigest()[:16] + ".jpg"
        dest = thumbs_dir / name
        rel = f"thumbs/{name}"
        if not dest.exists():
            try:
                dest.write_bytes(fetch(url))
            except Exception as exc:  # noqa: BLE001
                print(f"  FAIL {url[:60]}... -> {exc}")
                fail += 1
                continue
        text = text.replace(url, rel)
        ok += 1

    data_file.write_text(text, encoding="utf-8")
    print(f"[{vertical}] localized {ok}, failed {fail} -> {thumbs_dir}")


def main() -> None:
    verticals = sys.argv[1:] or DEFAULT_VERTICALS
    for v in verticals:
        localize(v.rstrip("/"))


if __name__ == "__main__":
    main()
