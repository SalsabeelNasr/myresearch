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

    # Also load any repo-committed transcripts (sources/transcripts.json: {shortcode: text}).
    TRANSCRIPTS_JSON = REPO / "sources" / "transcripts.json"
    if TRANSCRIPTS_JSON.exists():
        tj = json.loads(TRANSCRIPTS_JSON.read_text(encoding="utf-8"))
        for sc, txt in tj.items():
            transcripts.setdefault(sc, txt)
        print(f"Repo transcripts loaded: {len(tj)} from transcripts.json")

    matched = 0          # posts matched to a transcript CSV row
    audio_classified = 0  # posts with a real (audio-derived) topic = overrides + transcript matches
    for p in posts:
        sc = shortcode(p.get("postUrl", ""))
        txt = transcripts.get(sc)
        if txt:  # attach the spoken text to the post even if topic comes from an override
            p["transcript"] = {"text": txt, "segments": [], "matchedBy": "video-url"}
        if sc in overrides:
            p["topicAudio"] = overrides[sc]["topic"]
            p["topicSource"] = "audio"
            audio_classified += 1
            if txt:
                matched += 1
            continue
        if txt:
            matched += 1
            audio_classified += 1
            topic, _ = classify(txt)
            p["topicAudio"] = topic
            p["topicSource"] = "audio"
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

    # Split off pinned/evergreen posts (an account's own hand-picked highlights, often a
    # year old, that accumulate views and skew a "current" ranking).
    non_pinned, pinned_posts = [], []
    for p in posts:
        sc = shortcode(p.get("postUrl", ""))
        p["pinned"] = sc in pinned_set
        (pinned_posts if p["pinned"] else non_pinned).append(p)

    # Topic intel uses ALL non-pinned posts so no data is lost.
    topicAudit, topicRecommendations = analyze(non_pinned)
    _, pinnedTopics = analyze(pinned_posts)

    # Strict last-90-days window, relative to the most recent scraped post (≈ the scrape date).
    WINDOW = 90
    _alldates = [p.get("date") for p in non_pinned if p.get("date")]
    ref = max(_alldates) if _alldates else datetime.date.today().isoformat()
    cutoff = (datetime.date.fromisoformat(ref) - datetime.timedelta(days=WINDOW)).isoformat()
    current_posts = [p for p in non_pinned if p.get("date", "") >= cutoff]
    older_posts = [p for p in non_pinned if p.get("date", "") < cutoff]  # high-engagement but >90d — kept, not lost
    for i, p in enumerate(current_posts, 1):
        p["rank"] = i
    for i, p in enumerate(older_posts, 1):
        p["rank"] = i
    for i, p in enumerate(pinned_posts, 1):
        p["rank"] = i

    _cd = sorted(p.get("date") for p in current_posts if p.get("date"))
    date_from = _cd[0] if _cd else cutoff
    date_to = _cd[-1] if _cd else ref

    # -------------------------------------------------------------------
    # Benchmark: rank the business (curefit) vs the analyzed accounts on
    # AVG engagement/post — a fair, size-independent metric.
    # -------------------------------------------------------------------
    BUSINESS = REPO / "sources" / "business.json"
    benchmark = None
    if BUSINESS.exists():
        biz = json.loads(BUSINESS.read_text(encoding="utf-8"))
        sp = biz["samplePosts"]
        biz_eng = round(sum(p["engagement"] for p in sp) / len(sp), 1)
        vv = [p["views"] for p in sp if p.get("views", 0) > 0]
        biz_views = round(sum(vv) / len(vv)) if vv else 0

        def tier_of(v):
            if v >= 3000: return "النخبة"            # Elite
            if v >= 1500: return "متقدّم"            # Advanced
            if v >= 700:  return "متوسّط"            # Mid
            if v >= 200:  return "ناشئ"              # Emerging
            return "تحت خط المنافسة"                 # Below the competition line

        rows = []
        for x in doctors:
            if x.get("analyzed") is False:
                continue
            pc = x.get("postCount") or 0
            if pc == 0:
                continue
            rows.append({
                "name": x["name"], "handle": x["name"],
                "avgEng": round(x.get("totalEngagement", 0) / pc),
                "followers": x.get("followers", 0), "isBusiness": False,
            })
        rows.append({
            "name": biz["name"], "handle": biz["handle"], "avgEng": biz_eng,
            "followers": biz["followers"], "isBusiness": True,
        })
        rows.sort(key=lambda r: -r["avgEng"])
        for i, r in enumerate(rows, 1):
            r["rank"] = i
            r["tier"] = tier_of(r["avgEng"])
        brank = next(r["rank"] for r in rows if r["isBusiness"])
        analyzed_engs = sorted((r["avgEng"] for r in rows if not r["isBusiness"]))

        # Tier ladder (who sits in each tier).
        tier_order = ["النخبة", "متقدّم", "متوسّط", "ناشئ", "تحت خط المنافسة"]
        tier_rng = {"النخبة": "≥ 3000", "متقدّم": "1500–3000", "متوسّط": "700–1500",
                    "ناشئ": "200–700", "تحت خط المنافسة": "< 200"}
        tiers = []
        for tn in tier_order:
            members = [{"name": r["name"], "avgEng": r["avgEng"], "isBusiness": r["isBusiness"]}
                       for r in rows if r["tier"] == tn]
            tiers.append({"name": tn, "range": tier_rng[tn], "count": len(members), "accounts": members})

        # Realistic "reach-up" examples: top EDUCATIONAL viral posts from the emerging/mid
        # tiers (just above the business), so curefit sees concrete templates that work and
        # are realistically within reach. Max 2 per account, 6 total.
        NON = {"Music / no speech", "Greeting / occasion", "Motivational", "Off-topic",
               "Personal story / community", "Storytelling / community", "Religious / occasion",
               "Motivational / community", "Motivational / trend", "Unclassified",
               "Recipe / cooking", "Brand / product promo (peanut butter)",
               "Brand / product promo (healthy chocolate)"}
        reach_names = {r["name"] for r in rows
                       if not r["isBusiness"] and biz_eng < r["avgEng"] <= 1500}
        avg_by_name = {r["name"]: r["avgEng"] for r in rows}
        tier_by_name = {r["name"]: r["tier"] for r in rows}
        cands = [p for p in posts
                 if p.get("account") in reach_names and eff_topic(p) not in NON
                 and "promo" not in eff_topic(p).lower()]
        cands.sort(key=lambda p: -p.get("engagement", 0))
        reachable, per_acc = [], defaultdict(int)
        for p in cands:
            acc = p.get("account")
            if per_acc[acc] >= 2:
                continue
            per_acc[acc] += 1
            reachable.append({
                "account": acc, "avgEng": avg_by_name.get(acc, 0), "tier": tier_by_name.get(acc, ""),
                "exampleTopic": eff_topic(p), "exampleEng": p.get("engagement", 0),
                "exampleViews": p.get("views", 0), "exampleUrl": p.get("postUrl", ""),
            })
            if len(reachable) >= 6:
                break

        # Full-market context: we profile-scraped all 108 accounts for followers.
        # Engagement was deep-measured for the 30 (+ business); curefit sits mid-pack on
        # audience size but rock-bottom on engagement — a content-type gap, not a reach gap.
        full_market = None
        FOLLOWERS108 = REPO / "sources" / "profiles108_followers.json"
        if FOLLOWERS108.exists():
            f108 = json.loads(FOLLOWERS108.read_text(encoding="utf-8"))
            cf = biz["followers"]
            fewer = sum(1 for v in f108.values() if 0 < v < cf)
            full_market = {
                "total": 108,
                "followersRank": 108 - fewer,            # ~ position by audience size
                "followers": cf,
                "engagementMeasured": len([r for r in rows if not r["isBusiness"]]),
                "note": "كل الـ108 حساب اتعملهم مسح للمتابعين. التفاعل اتقاس بعمق لأعلى 30 حساب. حسابنا في منتصف القايمة من حيث عدد المتابعين، لكنه في القاع من حيث التفاعل — يعني عندنا جمهور بس المحتوى هو المشكلة.",
            }

        # Same-size peer benchmark: accounts in our follower band ranked by like-rate.
        size_peers = None
        PEERS = REPO / "sources" / "peers_band.json"
        if PEERS.exists():
            pb = json.loads(PEERS.read_text(encoding="utf-8"))
            br = pb["businessLikeRate"]
            plist = []
            for p in pb["peers"]:
                er = round(p["avgLikes"] / p["followers"] * 100, 3)
                plist.append({**p, "likeRate": er, "xBusiness": round(er / br, 1) if br else 0})
            plist.sort(key=lambda x: -x["likeRate"])
            size_peers = {
                "band": "8k–45k متابع",
                "businessLikeRate": br,
                "businessAvgLikes": pb["businessAvgLikes"],
                "businessFollowers": pb["businessFollowers"],
                "count": len(plist),
                "peers": plist,
            }

        benchmark = {
            "tiers": tiers,
            "fullMarket": full_market,
            "sizePeers": size_peers,
            "business": {
                "name": biz["name"], "handle": biz["handle"], "followers": biz["followers"],
                "avgEng": biz_eng, "avgViews": biz_views, "sampleSize": len(sp),
                "accounts": biz["accounts"], "note": biz.get("note", ""),
                "engagementRatePct": round(biz_eng / biz["followers"] * 100, 3),
                "tier": tier_of(biz_eng),
            },
            "ranking": rows,
            "businessRank": brank,
            "total": len(rows),
            "lowestAnalyzed": analyzed_engs[0],
            "medianAnalyzed": analyzed_engs[len(analyzed_engs) // 2],
            "topAnalyzed": analyzed_engs[-1],
            "reachable": reachable,
        }

    data = {
        "meta": {
            "title": "نتائج بحث السوق - التغذية",
            "totalPosts": base.get("meta_total", len(posts)),
            "totalDoctors": len(doctors),
            "dateFrom": date_from,
            "dateTo": date_to,
            "windowDays": WINDOW,
        },
        "doctors": doctors,
        "posts": current_posts,
        "olderPosts": older_posts,
        "pinnedPosts": pinned_posts,
        "topicRecommendations": topicRecommendations,
        "pinnedTopics": pinnedTopics,
        "topicAudit": topicAudit,
        "benchmark": benchmark,
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
            "olderPosts": len(older_posts),
            "doctorsWithoutPosts": 0,
        },
        "raw": {
            # Vault = the full, untrimmed record of everything we collected.
            "posts": [
                {
                    "Rank": str(p.get("rank", "")), "Account": p.get("account", ""),
                    "Platform": p.get("platform", ""), "Date": p.get("date", ""),
                    "Topic (from audio)": p.get("topicAudio", "—"),
                    "Topic (from caption)": p.get("topicCaption", ""),
                    "Caption": p.get("caption", ""), "Views": str(p.get("views", 0)),
                    "Likes": str(p.get("likes", 0)), "Comments": str(p.get("comments", 0)),
                    "Shares": str(p.get("shares", 0)), "Engagement": str(p.get("engagement", 0)),
                    "Followers": str(p.get("followers", 0)), "URL": p.get("postUrl", ""),
                }
                for p in posts
            ],
            "entities": [
                {
                    "Name": d.get("name", ""),
                    "Specialization": " • ".join(d.get("specializations", [])),
                    "Platform": a.get("platform", ""), "URL": a.get("url", ""),
                    "Confidence": a.get("confidence", ""),
                }
                for d in doctors for a in d.get("accounts", [])
            ],
            "topics": topicAudit,
            "transcripts": [
                {
                    "videoUrl": p.get("postUrl", ""),
                    "title": f"Video by {p.get('account', '')}",
                    "description": p.get("caption", ""),
                    "duration": 0,
                    "thumbnail": "",
                    "text": (p.get("transcript") or {}).get("text", ""),
                    "segments": [],
                }
                for p in posts if (p.get("transcript") or {}).get("text")
            ],
        },
    }
    OUT.write_text("const DATA = " + json.dumps(data, ensure_ascii=False) + ";\n", encoding="utf-8")
    print(
        f"nutrition/data.js written — {len(current_posts)} current (last {WINDOW}d, {date_from}..{date_to}), "
        f"{len(older_posts)} older high-engagement, {len(pinned_posts)} pinned; "
        f"{len(topicRecommendations)} topic recs."
    )


if __name__ == "__main__":
    main()
