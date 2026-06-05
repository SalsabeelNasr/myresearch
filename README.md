# Market Research Hub

Mobile-first Arabic RTL static site for Egypt medical social-media market research.

## Structure

```
index.html              → Home hub (3 verticals)
gastro/                 → Gastroenterology (live data)
nutrition/              → Nutrition (scaffold — data collection pending)
libyan-clinic/          → Coming soon placeholder
assets/css/             → Shared styles
assets/js/shared/       → Utils, deep links, nav
assets/js/research-app.js → Generic vertical app (loads page partials)
build_all.py            → Regenerates all data.js files + localizes thumbnails
localize_thumbnails.py  → Downloads remote CDN thumbnails into <vertical>/thumbs/
```

Each vertical (`gastro/`, `nutrition/`) has:
- `index.html` — thin shell + sidebar (~50 lines)
- `pages/*.html` — one partial per section (dashboard, doctors, posts, topics, vault)
- `data.js` — generated dataset
- `build_data.py` — source → data.js builder

## Run locally

Page partials load via `fetch()`, so use a local server (not `file://`):

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Rebuild data

Always use `build_all.py` — it regenerates every `data.js` **and** localizes thumbnails:

```bash
python3 build_all.py
```

Per-vertical builds are also available, but if you run them directly you MUST
re-localize thumbnails afterwards (see next section):

```bash
python3 gastro/build_data.py
python3 nutrition/build_data.py
python3 localize_thumbnails.py
```

## Thumbnails (ALWAYS run after adding/changing data)

Instagram/Facebook CDN image URLs are signed and time-limited, so hotlinking
them breaks intermittently and eventually 403s entirely. Whenever data is added
or rebuilt, download the images into the repo so thumbnails stay reliable:

```bash
python3 localize_thumbnails.py            # all verticals
python3 localize_thumbnails.py gastro     # a single vertical
```

This scans each vertical's `data.js`, downloads every `cdninstagram.com` /
`fbcdn.net` image into `<vertical>/thumbs/`, and rewrites the URLs to local
relative paths. It is idempotent (skips already-downloaded files) and runs
automatically as the last step of `build_all.py`. Commit the `<vertical>/thumbs/`
folders so the images ship with the site.

## Gastro sources

Configured in `gastro/build_data.py` — Excel viral report, entities CSV, transcriber CSV.

## Nutrition

Add source files under `nutrition/sources/` then extend `nutrition/build_data.py` (mirror gastro builder).
