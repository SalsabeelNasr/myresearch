#!/usr/bin/env python3
"""Build nutrition/data.js when source files are available.

Expected sources (same schema as gastro):
  - egypt_nutrition_viral_report.xlsx  (Viral posts + By audio topic)
  - egypt_nutrition_entities.csv
  - dataset_video-transcriber_nutrition_*.csv

Until those exist, run with --scaffold to write an empty dataset.
"""
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent
SRC = REPO / "sources"

SCAFFOLD = {
    "meta": {"title": "نتائج بحث السوق - التغذية", "totalPosts": 0, "totalDoctors": 0},
    "doctors": [],
    "posts": [],
    "topicRecommendations": [],
    "topicAudit": [],
    "transcripts": [],
    "coverage": {
        "totalPosts": 0,
        "totalEntities": 0,
        "totalTopicAudit": 0,
        "totalTranscripts": 0,
        "postsWithTranscript": 0,
        "transcriptsMatched": 0,
        "transcriptsUnmatched": 0,
        "doctorsWithoutPosts": 0,
    },
    "raw": {"posts": [], "entities": [], "topics": [], "transcripts": []},
}


def write_scaffold():
    out = "const DATA = " + json.dumps(SCAFFOLD, ensure_ascii=False) + ";\n"
    (REPO / "data.js").write_text(out, encoding="utf-8")
    print("nutrition/data.js scaffold written (empty — add sources to nutrition/sources/ then extend this builder)")


if __name__ == "__main__":
    report = SRC / "egypt_nutrition_viral_report.xlsx"
    if not report.exists():
        write_scaffold()
        sys.exit(0)
    print("Source files found — extend this script mirroring gastro/build_data.py")
    sys.exit(1)
