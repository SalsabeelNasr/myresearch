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
    (r"لقيمات|فثلث|ثلث للطعام|كميات|كميتك|portion|moderation|حجم الوجبة|نصف الكمية|تحدد كمي", "Portion control / moderation"),
    (r"بالليل|قبل النوم|اكل بالليل|الاكل بالليل|late.?night|سهر|آخر الليل", "Late-night eating & sleep"),
    (r"سكر|محلي|محليات|sugar|sweetener", "Sugar & sweeteners"),
    (r"عيش|خبز|نشويات|كارب|bread|carb", "Bread & carbs (comparison)"),
    (r"احتباس|املاح|أملاح|retention", "Water retention"),
    (r"درقية|الغده|الغدة|thyroid", "Thyroid"),
    (r"انتفاخ|قولون|هضم|bloating|sibo", "Bloating / digestion"),
    (r"دهون حشوية|الحشوية|visceral|الكرش|كرش|دهون البطن", "Belly & visceral fat"),
    (r"الديدان|الجرثومة|طفيليات|h\.?\s*pylori|بكتيريا المعدة", "Gut parasites / H. pylori"),
    (r"مرارة|gall\s*bladder|كبد دهني|الكبد الدهني|fatty liver", "Liver & gallbladder"),
    (r"(دوا|دواء|أدوية|حبوب).{0,14}(وزن|تخسيس)|weight.?gain drugs", "Weight-gain/loss drugs (warning)"),
    (r"اكل صحي|أكل صحي|نظام غذائي|نمط حياة صحي|دايت صحي|اختيارات.{0,8}دايت|أنظمة دايت", "Healthy eating / diet basics"),
    (r"زيادة الوزن|نظام وجبات|اكتساب وزن|weight.?gain|تسمين|للنحاف|زود وزنك", "Weight gain / muscle meal plan"),
    (r"خروجات|عزومات|مطاعم|اكل بره|eating.?out|الأكل بالخارج|سفر|مناسبات", "Eating out / social meals"),
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
    all_doctors = base["doctors"]
    # Sanitization: off-niche (not nutrition/weight-loss) or off-location (outside Egypt)
    # accounts are kept in the report but split out so they never pollute the analysis.
    excluded_docs = [d for d in all_doctors if d.get("excluded")]
    excluded_names = {d.get("name", "") for d in excluded_docs}
    doctors = [d for d in all_doctors if not d.get("excluded")]
    posts = [p for p in base["posts"] if p.get("account", "") not in excluded_names]

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

    # Backfill caption topics with the CURRENT classifier — fills "Unclassified" gaps from
    # captions that have usable keywords (without overriding already-good labels).
    for p in posts:
        if p.get("topicCaption") in (None, "", "Unclassified"):
            p["topicCaption"] = classify(p.get("caption", ""))[0]

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

    # ---------------------------------------------------------------------
    # CROSS-PLATFORM "PROVEN TOPICS": pool Instagram + TikTok viral content,
    # score each post by NORMALIZED virality (engagement ÷ that account's median),
    # and validate a topic by how many DISTINCT accounts went viral with it.
    # A topic is "proven/recreatable" only if 3+ independent accounts hit with it.
    # ---------------------------------------------------------------------
    import statistics as _stp
    _recent = json.loads((REPO / "sources" / "recent_metrics.json").read_text(encoding="utf-8")) if (REPO / "sources" / "recent_metrics.json").exists() else {}
    _ttm = json.loads((REPO / "sources" / "tt_metrics.json").read_text(encoding="utf-8")) if (REPO / "sources" / "tt_metrics.json").exists() else {}
    _ctx = json.loads((REPO / "sources" / "cross_transcripts.json").read_text(encoding="utf-8")) if (REPO / "sources" / "cross_transcripts.json").exists() else {}
    # classify a FB/TikTok post from caption + spoken transcript (when we have it).
    def _xtopic(url, caption):
        tr = _ctx.get(url, "")
        return classify((caption or "") + " " + tr), tr

    def _igh(d):
        for a in d.get("accounts", []):
            m = re.search(r"instagram\.com/([^/?#]+)", a.get("url", ""))
            if m:
                return m.group(1).lower().rstrip("/")
        return None

    name2h = {d["name"]: _igh(d) for d in doctors}
    h2name = {_igh(d): d["name"] for d in doctors}
    tt2h = {}
    for d in doctors:
        h = _igh(d)
        for a in d.get("accounts", []):
            m = re.search(r"tiktok\.com/@([^/?#]+)", a.get("url", "").lower())
            if m:
                tt2h[m.group(1)] = h

    pool = []
    for p in non_pinned:  # Instagram viral content
        h = name2h.get(p.get("account"))
        med = (_recent.get(h) or {}).get("median90") or 0
        eng = p.get("engagement", 0)
        pool.append({
            "account": p.get("account"), "handle": h or p.get("account"), "platform": "Instagram",
            "eng": eng, "topic": eff_topic(p), "clinical": is_clinical_post(p),
            "url": p.get("postUrl", ""), "caption": (p.get("caption") or "")[:140],
            "x": round(eng / med, 1) if med else None,
            "video": bool((p.get("transcript") or {}).get("text")),
            "likes": p.get("likes", 0), "comments": p.get("comments", 0),
            "shares": p.get("shares", 0), "views": p.get("views", 0),
        })
    TTC = REPO / "sources" / "_tt_captions.txt"
    if TTC.exists():
        for line in TTC.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            o = json.loads(line)
            if o.get("isPinned"):
                continue
            u = o["input"].lower()
            h = tt2h.get(u)
            eng = o.get("diggCount", 0) + o.get("commentCount", 0) + o.get("shareCount", 0)
            med = (_ttm.get(h) or {}).get("median90") or 0
            topic, clin = classify(o.get("text", ""))
            pool.append({
                "account": h2name.get(h, u), "handle": h or u, "platform": "TikTok",
                "eng": eng, "topic": topic, "clinical": clin,
                "url": o.get("webVideoUrl", ""), "caption": (o.get("text") or "")[:140],
                "x": round(eng / med, 1) if med else None, "video": True,
                "likes": o.get("diggCount", 0), "comments": o.get("commentCount", 0),
                "shares": o.get("shareCount", 0), "views": o.get("playCount", 0),
            })

    # Facebook all-time virals (≥1000 likes) → topic pool + cross-platform hall of fame.
    _fbm = json.loads((REPO / "sources" / "fb_metrics.json").read_text(encoding="utf-8")) if (REPO / "sources" / "fb_metrics.json").exists() else {}
    fb_url2h = {}
    for d in doctors:
        h = _igh(d)
        for a in d.get("accounts", []):
            if "facebook" in a.get("url", "").lower():
                fb_url2h[a["url"].rstrip("/").lower()] = h
    FBV = REPO / "sources" / "_fb_virals.txt"
    if FBV.exists():
        for line in FBV.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            o = json.loads(line)
            h = fb_url2h.get(o["inputUrl"].rstrip("/").lower())
            eng = o.get("likes", 0) + o.get("comments", 0) + o.get("shares", 0)
            med = (_fbm.get(h) or {}).get("median90") or 0
            (topic, clin), tr = _xtopic(o.get("url", ""), o.get("text", ""))
            pool.append({
                "account": h2name.get(h, o["inputUrl"]), "handle": h or o["inputUrl"], "platform": "Facebook",
                "eng": eng, "topic": topic, "clinical": clin, "url": o.get("url", ""),
                "caption": (o.get("text") or "")[:140], "x": round(eng / med, 1) if med else None,
                "video": bool(o.get("viewsCount")), "date": o.get("time", ""), "transcript": tr,
                "likes": o.get("likes", 0), "comments": o.get("comments", 0),
                "shares": o.get("shares", 0), "views": o.get("viewsCount", 0),
            })

    # TikTok all-time virals (with video links) → pool + hall of fame.
    TTV = REPO / "sources" / "_tt_virals.txt"
    if TTV.exists():
        for line in TTV.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            o = json.loads(line)
            h = tt2h.get(o["input"].lower())
            eng = o.get("diggCount", 0) + o.get("commentCount", 0) + o.get("shareCount", 0)
            med = (_ttm.get(h) or {}).get("median90") or 0
            (topic, clin), tr = _xtopic(o.get("url", ""), o.get("text", ""))
            pool.append({
                "account": h2name.get(h, o["input"]), "handle": h or o["input"], "platform": "TikTok",
                "eng": eng, "topic": topic, "clinical": clin, "url": o.get("url", ""),
                "caption": (o.get("text") or "")[:140], "x": round(eng / med, 1) if med else None,
                "video": True, "date": o.get("date", ""), "transcript": tr,
                "likes": o.get("diggCount", 0), "comments": o.get("commentCount", 0),
                "shares": o.get("shareCount", 0), "views": o.get("playCount", 0),
            })

    # Cross-platform "hall of fame": FB + TikTok viral posts shaped like base posts, so they
    # flow into the evergreen list and the vault alongside Instagram.
    # Reach-weighted score uses ALL metrics: reactions + interaction + amplification + reach.
    # likes×1 + comments×2 + shares×3 + views×0.05 (shares amplify most; views = passive reach).
    def reach_score(likes, comments, shares, views):
        return round((likes or 0) + (comments or 0) * 2 + (shares or 0) * 3 + (views or 0) * 0.05)

    cross_posts = []
    for it in pool:
        if it["platform"] in ("Facebook", "TikTok") and it.get("url"):
            cross_posts.append({
                "account": it["account"], "platform": it["platform"], "date": it.get("date", ""),
                "engagement": it["eng"], "views": it.get("views", 0), "postUrl": it["url"],
                "topicAudio": it["topic"] if (it.get("transcript") and it["topic"] != "Unclassified") else "—",
                "topicCaption": it["topic"] if it["topic"] != "Unclassified" else "غير مصنف",
                "topicSource": "audio" if it.get("transcript") else "caption",
                "transcript": ({"text": it["transcript"], "segments": [], "matchedBy": "video-url"} if it.get("transcript") else None),
                "caption": it["caption"], "pinned": False,
                "likes": it.get("likes", 0), "comments": it.get("comments", 0),
                "shares": it.get("shares", 0), "followers": 0, "rank": 0,
                "reachScore": reach_score(it.get("likes"), it.get("comments"), it.get("shares"), it.get("views")),
            })
    cross_posts.sort(key=lambda p: -p["engagement"])

    _byt = defaultdict(lambda: {"accts": set(), "platforms": set(), "best": None, "viral": 0, "video": 0, "n": 0, "eng": 0})
    for it in pool:
        if not it["clinical"] or it["topic"] == "Unclassified":
            continue
        g = _byt[it["topic"]]
        g["accts"].add(it["handle"]); g["platforms"].add(it["platform"]); g["n"] += 1; g["eng"] += it["eng"]
        if it["video"]:
            g["video"] += 1
        if it.get("x") and it["x"] >= 3:
            g["viral"] += 1
        if not g["best"] or it["eng"] > g["best"]["eng"]:
            g["best"] = {"eng": it["eng"], "account": it["account"], "platform": it["platform"],
                         "url": it["url"], "caption": it["caption"], "x": it.get("x")}

    provenTopics = sorted(
        ({
            "topic": t, "accountCount": len(v["accts"]), "proven": len(v["accts"]) >= 3,
            "platforms": sorted(v["platforms"]), "posts": v["n"], "engagement": v["eng"],
            "viralCount": v["viral"], "videoShare": round(v["video"] / v["n"] * 100) if v["n"] else 0,
            "bestExample": v["best"],
        } for t, v in _byt.items()),
        key=lambda x: (-x["accountCount"], -x["engagement"]),
    )
    # Enrich the existing IG recommendations with the cross-platform validation.
    _pt = {x["topic"]: x for x in provenTopics}
    for r in topicRecommendations:
        x = _pt.get(r["topic"])
        if x:
            r["accountCount"] = x["accountCount"]; r["proven"] = x["proven"]
            r["platforms"] = x["platforms"]; r["viralCount"] = x["viralCount"]
            r["bestExample"] = x["bestExample"]
        else:
            r["accountCount"] = 0; r["proven"] = False; r["platforms"] = ["Instagram"]
            r["viralCount"] = 0; r["bestExample"] = None

    # Strict last-90-days window, relative to the most recent scraped post (≈ the scrape date).
    WINDOW = 90
    _alldates = [p.get("date") for p in non_pinned if p.get("date")]
    ref = max(_alldates) if _alldates else datetime.date.today().isoformat()
    cutoff = (datetime.date.fromisoformat(ref) - datetime.timedelta(days=WINDOW)).isoformat()
    # Split cross-platform (FB/TikTok) virals by date too: recent ones join the last-90-days
    # page, older ones go to the all-time Hall of Fame — same rule as Instagram.
    cross_recent = [p for p in cross_posts if (p.get("date") or "") >= cutoff]
    cross_old = [p for p in cross_posts if (p.get("date") or "") < cutoff]
    current_posts = [p for p in non_pinned if p.get("date", "") >= cutoff] + cross_recent
    older_posts = [p for p in non_pinned if p.get("date", "") < cutoff] + cross_old  # >90d IG + older cross-platform virals
    for i, p in enumerate(current_posts, 1):
        p["rank"] = i
    for i, p in enumerate(older_posts, 1):
        p["rank"] = i
    for i, p in enumerate(pinned_posts, 1):
        p["rank"] = i
    for p in current_posts + older_posts + pinned_posts:
        if "reachScore" not in p:
            p["reachScore"] = reach_score(p.get("likes"), p.get("comments"), p.get("shares"), p.get("views"))

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

        # --- Robust recent-sample metrics (median, cadence, viral-skew flag) ---------
        # Computed from each account's UNBIASED last ~12 posts (profile scrape), NOT the
        # cherry-picked virals. This is what protects the ranking from one-viral accounts
        # (e.g. an account whose mean is huge but median is tiny = ⚠️ viral-driven).
        import statistics as _st
        RECENT = REPO / "sources" / "recent_metrics.json"
        recent = json.loads(RECENT.read_text(encoding="utf-8")) if RECENT.exists() else {}
        FBM = REPO / "sources" / "fb_metrics.json"
        fbm = json.loads(FBM.read_text(encoding="utf-8")) if FBM.exists() else {}
        TTM = REPO / "sources" / "tt_metrics.json"
        ttm = json.loads(TTM.read_text(encoding="utf-8")) if TTM.exists() else {}

        def ig_handle(d):
            for a in d.get("accounts", []):
                m = re.search(r"instagram\.com/([^/?#]+)", a.get("url", ""))
                if m:
                    return m.group(1).lower().rstrip("/")
            return None

        # curefit's own recent metrics, computed the SAME way (apples-to-apples).
        _bz = sorted(p["engagement"] for p in sp)
        biz_median = round(_st.median(_bz), 1)
        _bd = sorted(p.get("date", "") for p in sp if p.get("date"))
        if len(_bd) > 1:
            _span = (datetime.date.fromisoformat(_bd[-1]) - datetime.date.fromisoformat(_bd[0])).days
            biz_ppm = round(len(_bd) / (_span / 30), 1) if _span > 0 else None
        else:
            biz_ppm = None
        recent[biz["handle"].lower()] = {
            "n90": len(sp), "mean90": biz_eng, "median90": biz_median,
            "topSharePct": round(max(_bz) / sum(_bz) * 100, 1) if sum(_bz) else 0,
            "postsPerMonth": biz_ppm, "viralSkew": False,
        }

        # Per-platform + overall bundle (Instagram / Facebook / TikTok) keyed by IG handle.
        def _pick(m):
            if not (m and m.get("n90")):
                return None
            return {"median": m.get("median90"), "mean": m.get("mean90"),
                    "postsPerMonth": m.get("postsPerMonth"), "n": m.get("n90") or 0,
                    "viralSkew": bool(m.get("viralSkew"))}

        def plat_bundle(h):
            igb, fbb, ttb = _pick(recent.get(h)), _pick(fbm.get(h)), _pick(ttm.get(h))
            present = [b for b in (igb, fbb, ttb) if b]
            overall = None
            if present:
                # Overall = total typical engagement/post across the platforms the account is active on.
                overall = {
                    "median": round(sum(b["median"] for b in present), 1),
                    "mean": round(sum(b["mean"] for b in present), 1),
                    "postsPerMonth": round(sum((b["postsPerMonth"] or 0) for b in present), 1),
                    "n": sum(b["n"] for b in present),
                    "viralSkew": any(b["viralSkew"] for b in present),
                    "platforms": len(present),
                }
            return {"ig": igb, "fb": fbb, "tt": ttb, "overall": overall}

        # Per-platform follower counts (IG known; TikTok fans scraped; FB page-followers n/a for personal profiles).
        PFOL = REPO / "sources" / "platform_followers.json"
        pfol = json.loads(PFOL.read_text(encoding="utf-8")) if PFOL.exists() else {}

        # Attach recent metrics + platform bundle + follower counts onto each analyzed doctor.
        for d in doctors:
            h = ig_handle(d)
            rmd = recent.get(h)
            if rmd and rmd.get("n90"):
                d["recent"] = rmd
            pb = plat_bundle(h)
            if pb["overall"]:
                d["platforms"] = pb
            pf = pfol.get(h, {})
            d["platformFollowers"] = {"ig": d.get("followers") or 0, "fb": pf.get("fb"), "tt": pf.get("tt")}

        def tier_of(v):
            if v >= 3000: return "النخبة"            # Elite
            if v >= 1500: return "متقدّم"            # Advanced
            if v >= 700:  return "متوسّط"            # Mid
            if v >= 200:  return "ناشئ"              # Emerging
            return "تحت خط المنافسة"                 # Below the competition line

        def attach_recent(r, h):
            r["igh"] = h
            rm = recent.get(h, {})
            r["recentMedian"] = rm.get("median90")
            r["recentMean"] = rm.get("mean90")
            r["postsPerMonth"] = rm.get("postsPerMonth")
            r["recentN"] = rm.get("n90") or 0
            r["topSharePct"] = rm.get("topSharePct")
            r["viralSkew"] = bool(rm.get("viralSkew"))
            # Robust engagement = recent median when we have a real sample, else the deep avg.
            r["robustEng"] = rm.get("median90") if rm.get("n90") else r["avgEng"]
            r["estimated"] = not bool(rm.get("n90"))
            return r

        rows = []
        for x in doctors:
            if x.get("analyzed") is False:
                continue
            pc = x.get("postCount") or 0
            if pc == 0:
                continue
            rows.append(attach_recent({
                "name": x["name"], "handle": x["name"],
                "avgEng": round(x.get("totalEngagement", 0) / pc),
                "followers": x.get("followers", 0), "isBusiness": False,
            }, ig_handle(x)))
        rows.append(attach_recent({
            "name": biz["name"], "handle": biz["handle"], "avgEng": biz_eng,
            "followers": biz["followers"], "isBusiness": True,
        }, biz["handle"].lower()))
        # Rank by the ROBUST metric (recent median), not the viral-skewed mean.
        rows.sort(key=lambda r: -(r["robustEng"] or 0))
        for i, r in enumerate(rows, 1):
            r["rank"] = i
            r["tier"] = tier_of(r["robustEng"] or 0)
        brank = next(r["rank"] for r in rows if r["isBusiness"])
        analyzed_engs = sorted((r["robustEng"] or 0) for r in rows if not r["isBusiness"])

        # Tier ladder (who sits in each tier).
        tier_order = ["النخبة", "متقدّم", "متوسّط", "ناشئ", "تحت خط المنافسة"]
        tier_rng = {"النخبة": "≥ 3000", "متقدّم": "1500–3000", "متوسّط": "700–1500",
                    "ناشئ": "200–700", "تحت خط المنافسة": "< 200"}
        tiers = []
        for tn in tier_order:
            members = [{"name": r["name"], "avgEng": r["robustEng"] or r["avgEng"], "isBusiness": r["isBusiness"]}
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
        # Reach-up examples now come from the CROSS-PLATFORM pool, ranked by NORMALIZED
        # virality (engagement ÷ that account's median). A post that beat its own account's
        # norm by 3×+ is proof the *content* worked — recreatable regardless of follower count.
        _plat_ar = {"Instagram": "إنستجرام", "TikTok": "تيك توك", "Facebook": "فيسبوك"}
        cands = [it for it in pool
                 if it["clinical"] and it["topic"] not in NON
                 and "promo" not in it["topic"].lower() and it.get("url")]
        cands.sort(key=lambda it: (-(it.get("x") or 0), -it["eng"]))
        reachable, seen_topic, per_acc = [], set(), defaultdict(int)
        for it in cands:
            if it["topic"] in seen_topic:   # one best example per topic → diverse proven set
                continue
            if per_acc[it["handle"]] >= 2:
                continue
            seen_topic.add(it["topic"]); per_acc[it["handle"]] += 1
            reachable.append({
                "account": it["account"], "tier": _plat_ar.get(it["platform"], it["platform"]),
                "platform": it["platform"], "normX": it.get("x"),
                "exampleTopic": it["topic"], "exampleEng": it["eng"],
                "exampleViews": 0, "exampleUrl": it["url"], "caption": it["caption"],
            })
            if len(reachable) >= 8:
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
                "note": "كل الـ108 حساب اتعملهم مسح للمتابعين. والتفاعل اتقاس بعمق لـ51 حساب. حسابنا في منتصف القايمة من حيث عدد المتابعين، لكنه في القاع من حيث التفاعل — يعني عندنا جمهور بس المحتوى هو المشكلة.",
            }

        # Same-size comparison from the FINAL deep numbers: analyzed accounts in our follower
        # band (+ us), ranked by real avg engagement/post. This is the single comparison list.
        notes_map = {}
        PEERS = REPO / "sources" / "peers_band.json"
        if PEERS.exists():
            for p in json.loads(PEERS.read_text(encoding="utf-8")).get("peers", []):
                n = (p.get("note", "").replace("✅ اتعمله تحليل عميق", "")
                     .replace("✅ تحليل عميق", "").strip())
                if n:
                    notes_map[p["handle"].lower()] = n
        allr = sorted(rows, key=lambda r: -(r["robustEng"] or 0))
        peers_out = []
        for r in allr:
            rob = r["robustEng"] or 0
            er = round(rob / r["followers"] * 100, 3) if r.get("followers") else 0
            in_band = 8000 <= (r.get("followers") or 0) <= 45000
            peers_out.append({
                "handle": r["name"], "followers": r["followers"], "avgEng": r["avgEng"],
                "median": r["recentMedian"], "mean": r["recentMean"],
                "postsPerMonth": r["postsPerMonth"], "n": r["recentN"],
                "topSharePct": r["topSharePct"], "viralSkew": r["viralSkew"],
                "estimated": r["estimated"],
                "likeRate": er, "xBusiness": round(rob / biz_median, 1) if biz_median else 0,
                "isBusiness": r["isBusiness"], "inBand": in_band,
                "platforms": plat_bundle(r["igh"]),
                "note": notes_map.get(r["name"].lower(), ""),
            })
        band_only = [p for p in peers_out if p["inBand"]]
        size_peers = {
            "band": "8 آلاف–45 ألف متابع",
            "businessAvgEng": biz_eng,
            "businessMedian": biz_median,
            "businessFollowers": biz["followers"],
            "businessRankInBand": next((i + 1 for i, p in enumerate(band_only) if p["isBusiness"]), None),
            "bandCount": len(band_only),
            "count": len(peers_out),
            "peers": peers_out,
        }

        benchmark = {
            "tiers": tiers,
            "fullMarket": full_market,
            "sizePeers": size_peers,
            "business": {
                "name": biz["name"], "handle": biz["handle"], "followers": biz["followers"],
                "avgEng": biz_eng, "median": biz_median, "postsPerMonth": biz_ppm,
                "avgViews": biz_views, "sampleSize": len(sp),
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
        "excludedDoctors": excluded_docs,
        "posts": current_posts,
        "olderPosts": older_posts,
        "pinnedPosts": pinned_posts,
        "topicRecommendations": topicRecommendations,
        "provenTopics": provenTopics,
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
                for p in posts + cross_posts
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
