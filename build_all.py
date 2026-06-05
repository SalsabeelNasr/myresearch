#!/usr/bin/env python3
"""Regenerate all vertical data.js files."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

scripts = [
    ROOT / "gastro" / "build_data.py",
    ROOT / "nutrition" / "build_data.py",
]

for script in scripts:
    print(f"\n=== {script.relative_to(ROOT)} ===")
    r = subprocess.run([sys.executable, str(script)], cwd=script.parent)
    if r.returncode != 0:
        sys.exit(r.returncode)

print("\n=== localize_thumbnails.py ===")
r = subprocess.run([sys.executable, str(ROOT / "localize_thumbnails.py")], cwd=ROOT)
if r.returncode != 0:
    sys.exit(r.returncode)

print("\nAll data builds finished.")
