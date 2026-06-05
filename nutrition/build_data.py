#!/usr/bin/env python3
"""Build nutrition/data.js from the scraped base + (optional) audio transcripts.

Pipeline (mirrors gastro):
  1. Load nutrition/sources/base.json  -> the scraped doctors + viral posts (immutable).
  2. If an Apify video-transcriber CSV is found, attach each transcript to its post
     (matched by Instagram shortcode) and derive the *audio* topic from the spoken text.
     This is what reclassifies the posts whose real topic is in the reel, not the caption.
  3. Recompute topic recommendations, topic audit, coverage, meta.
  4. Write nutrition/data.js.

Run (after the credit resets and you've exported the transcriber CSV to ~/Downloads):
    python3 build_data.py

Transcript CSV: any Apify "video-transcriber" export. The script auto-detects a URL
column and a text column, so you don't need to reformat it. Override the path with:
    python3 build_data.py /path/to/transcripts.csv
"""
import csv
import datetime
import glob
import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parent
BASE = REPO / "sources" / "base.json"
OVERRIDES = REPO / "sources" / "topic_overrides.json"  # hand-verified audio topics {shortcode: {topic, recreate}}
PINNED = REPO / "sources" / "pinned_shortcodes.json"   # shortcodes of pinned/evergreen posts (excluded from the recent ranking)
OUT = REPO / "data.js"
DOWNLOADS = Path.home() / "Downloads"

# ---------------------------------------------------------------------------
# Arabic/English topic keyword map (same logic used to build the first pass).
# Each entry: (regex, label).  CLIN = clinical recreate-candidate topics.
# ---------------------------------------------------------------------------
CLIN = [
    (r"مقاومة|الانسولين|الأنسولين|insulin", "Insulin resistance"),
    (r"تكيس|pcos|المبايض", "PCOS / ovarian health"),
    (r"بلاستيك|\bbpa\b|disruptor|الاستروجين الكاذب", "Endocrine disruptors (BPA)"),
    (r"هرمون|hormon|استروجين|كورتيزول", "Hormonal health"),
    (r"حديد|انيميا|انميا|iron|فقر الدم", "Anemia / iron absorption"),
    (r"اوميجا|omega", "Omega-3 / essential fats"),
    (r"فيتامين|vitamin|مكمل|امتصاص|مهضم|انزيم", "Vitamins, supplements & absorption"),
    (r"حرق|الايض|الأيض|metabolism", "Metabolism"),
    (r"مونجارو|اوزمبك|ozempic|wegovy|ابر|حقن|ببتيد|peptide|glp|تنحيف", "GLP-1 / weight-loss injections"),
    (r"شبع|شهية|الجوع|appetite|satiety", "Appetite & satiety"),
    (r"سكر|محلي|محليات|sugar|sweetener", "Sugar & sweeteners"),
    (r"عيش|خبز|نشويات|كارب|bread|carb", "Bread & carbs (comparison)"),
    (r"احتباس|املاح|أملاح|retention", "Water retention"),
    (r"درقية|الغده|الغدة|thyroid", "Thyroid"),
    (r"انتفاخ|قولون|هضم|bloating|sibo", "Bloating / digestion"),
    (r"دوره|الدورة|period|menstr", "Cycle / menstrual health"),
    (r"نوم|sleep", "Sleep & stress"),
    (r"بروتين|protein", "Protein"),
]
NON = [
    (r"وصفه|وصفة|اكله|أكله|أكلة|سناك|سلطة|فطار|عشا|غدا|طريقة عمل|recipe|meal|snack", "Recipe / meal"),
    (r"نفسك|تحفيز|motivat|رحلتك|الراقية", "Motivational"),
    (r"عيد|مبروك|الحج|عرفه|عرفة|تهنئة|كل سنة|اضحى|greeting", "Greeting / occasion"),
    (r"عياده|عيادة|احجز|خصم|عرض|booking|clinic|كود", "Clinic / promo"),
    (r"متحف|museum|gem", "Off-topic"),
]


def classify(text):
    t = text or ""
    for rx, label in CLIN:
        if re.search(rx, t, re.I):
            return label, True
    for rx, label in NON:
        if re.search(rx, t, re.I):
            return label, False
    return "Unclassified", False


def shortcode(url):
    m = re.search(r"instagram\.com/(?:p|reel|tv)/([^/?#]+)", url or "", re.I)
    return m.group(1) if m else ""


def find_transcript_csv():
    if len(sys.argv) > 1:
        return Path(sys.argv[1])
    hits = sorted(
        glob.glob(str(DOWNLOADS / "*video-transcriber*.csv"))
        + glob.glob(str(DOWNLOADS / "*transcri*nutrition*.csv")),
        key=os.path.getmtime,
        reverse=True,
    )
    return Path(hits[0]) if hits else None


def load_transcripts(path):
    """Return {shortcode: text}. Auto-detects URL and text columns."""
    if not path or not path.exists():
        return {}
    out = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        cols = reader.fieldnames or []
        url_col = next((c for c in cols if re.search(r"url|link|input", c, re.I)), None)
        text_col = next((c for c in cols if re.search(r"text|transcript|caption", c, re.I)), None)
        if not url_col or not text_col:
            print(f"!! Could not detect url/text columns in {path.name}; columns = {cols}")
            return {}
        for row in reader:
            sc = shortcode(row.get(url_col, ""))
            txt = (row.get(text_col) or "").strip()
            if sc and txt:
                out[sc] = txt
    return out


def main():
    base = json.loads(BASE.read_text(encoding="utf-8"))
    doctors = base["doctors"]
    posts = base["posts"]

    tpath = find_transcript_csv()
    transcripts = load_transcripts(tpath)
    print(
        f"Transcripts loaded: {len(transcripts)}"
        + (f" from {tpath.name}" if tpath else " (none found — caption-only build)")
    )

    overrides = {}
    if OVERRIDES.exists():
        overrides = json.loads(OVERRIDES.read_text(encoding="utf-8"))
        print(f"Topic overrides loaded: {len(overrides)} hand-verified audio topics")

    pinned_set = set()
    if PINNED.exists():
        pinned_set = set(json.loads(PINNED.read_text(encoding="utf-8")))
        print(f"Pinned shortcodes loaded: {len(pinned_set)}")

    matched = 0          # posts matched to a transcript CSV row
    audio_classified = 0  # posts with a real (audio-derived) topic = overrides + transcript matches
    for p in posts:
        sc = shortcode(p.get("postUrl", ""))
        if sc in overrides:
            p["topicAudio"] = overrides[sc]["topic"]
            p["topicSource"] = "audio"
            audio_classified += 1
            continue
        txt = transcripts.get(sc)
        if txt:
            matched += 1
            audio_classified += 1
            topic, _ = classify(txt)
            p["topicAudio"] = topic
            p["topicSource"] = "audio"
            p["transcript"] = {"text": txt, "segments": [], "matchedBy": "video-url"}
        elif p.get("topicSource") != "audio":
            p["topicAudio"] = "—"

    # Effective topic per post: prefer the spoken (audio) topic, else the caption topic.
    def eff_topic(p):
        if p.get("topicSource") == "audio" and p.get("topicAudio") not in ("—", None):
            return p["topicAudio"]
        return p.get("topicCaption", "Unclassified")

    def is_clinical_post(p):
        sc = shortcode(p.get("postUrl", ""))
        if sc in overrides:
            return overrides[sc].get("recreate", False)
        src_text = (p.get("transcript") or {}).get("text") or p.get("caption", "")
        return classify(src_text)[1]

    def analyze(post_list):
        """Return (topicAudit, topicRecommendations) for a list of posts."""
        agg = defaultdict(lambda: {"posts": 0, "eng": 0, "views": 0, "clinical": False, "ex": []})
        for p in post_list:
            t = eff_topic(p)
            a = agg[t]
            a["posts"] += 1
            a["eng"] += p.get("engagement", 0)
            a["views"] += p.get("views", 0)
            a["clinical"] = a["clinical"] or is_clinical_post(p)
            if len(a["ex"]) < 2 and p.get("caption"):
                a["ex"].append(p["caption"][:160])
        audit = sorted(
            ({"topic": t, "posts": v["posts"], "engagement": v["eng"]} for t, v in agg.items()),
            key=lambda x: -x["engagement"],
        )
        recs = sorted(
            (
                {
                    "topic": t,
                    "posts": v["posts"],
                    "engagement": v["eng"],
                    "views": v["views"],
                    "score": round(v["eng"] + 0.2 * v["views"]),
                    "suggestion": "قدّم هذا الموضوع ككاروسيل تثقيفي (هوك فضول + شرح بنقاط + خلاصة آمنة تحت إشراف طبي).",
                    "examples": v["ex"],
                }
                for t, v in agg.items()
                if v["clinical"] and t != "Unclassified"
            ),
            key=lambda x: -x["score"],
        )
        return audit, recs

    # Split: pinned/evergreen posts vs recent posts. Pinned posts are an account's own
    # hand-picked highlights (often a year old) that accumulate views — they skew a
    # "current performance" ranking, so they get their own list and analysis.
    recent_posts, pinned_posts = [], []
    for p in posts:
        sc = shortcode(p.get("postUrl", ""))
        p["pinned"] = sc in pinned_set
        (pinned_posts if p["pinned"] else recent_posts).append(p)
    for i, p in enumerate(recent_posts, 1):
        p["rank"] = i
    for i, p in enumerate(pinned_posts, 1):
        p["rank"] = i

    topicAudit, topicRecommendations = analyze(recent_posts)
    _, pinnedTopics = analyze(pinned_posts)

    _dates = sorted(p.get("date") for p in recent_posts if p.get("date"))
    date_from = _dates[0] if _dates else ""
    date_to = _dates[-1] if _dates else ""

    data = {
        "meta": {
            "title": "نتائج بحث السوق - التغذية",
            "totalPosts": base.get("meta_total", len(posts)),
            "totalDoctors": len(doctors),
            "dateFrom": date_from,
            "dateTo": date_to,
        },
        "doctors": doctors,
        "posts": recent_posts,
        "pinnedPosts": pinned_posts,
        "topicRecommendations": topicRecommendations,
        "pinnedTopics": pinnedTopics,
        "topicAudit": topicAudit,
        "transcripts": [{"shortcode": sc, "text": txt} for sc, txt in transcripts.items()],
        "coverage": {
            "totalPosts": base.get("meta_total", len(posts)),
            "totalEntities": len(doctors),
            "totalTopicAudit": len(topicAudit),
            "totalTranscripts": len(transcripts),
            "postsWithTranscript": audio_classified,
            "transcriptsMatched": matched,
            "transcriptsUnmatched": max(0, len(transcripts) - matched),
            "pinnedPosts": len(pinned_posts),
            "doctorsWithoutPosts": 0,
        },
        "raw": {"posts": [], "entities": [], "topics": [], "transcripts": []},
    }
    OUT.write_text("const DATA = " + json.dumps(data, ensure_ascii=False) + ";\n", encoding="utf-8")
    print(
        f"nutrition/data.js written — {len(recent_posts)} recent posts, "
        f"{len(pinned_posts)} pinned, {len(topicRecommendations)} recent topic recs, "
        f"{len(pinnedTopics)} pinned topic recs."
    )


if __name__ == "__main__":
    main()
