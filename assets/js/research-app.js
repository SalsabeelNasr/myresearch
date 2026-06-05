/* Generic research vertical app — expects window.DATA and window.VERTICAL_CONFIG */
window.MRResearchApp = (function () {
  const { formatNumber, escapeHtml, formatTime } = window.MRUtils;
  const { bindOpenAppButtons } = window.MRDeepLinks;

  let state = {
    sortMetric: "engagement",
    doctorSortMetric: "followers",
    search: "",
    vaultSearch: "",
    currentPage: "dashboard",
  };

  let els = {};

  function cacheElements() {
    els = {
      kpiGrid: document.getElementById("kpiGrid"),
      doctorsGrid: document.getElementById("doctorsGrid"),
      doctorsCount: document.getElementById("doctorsCount"),
      competitorsGrid: document.getElementById("competitorsGrid"),
      competitorsCount: document.getElementById("competitorsCount"),
      doctorSortMetric: document.getElementById("doctorSortMetric"),
      postsList: document.getElementById("postsList"),
      postsCount: document.getElementById("postsCount"),
      postsPeriod: document.getElementById("postsPeriod"),
      postsAccountsTable: document.querySelector("#postsAccountsTable tbody"),
      postsTopicsList: document.getElementById("postsTopicsList"),
      olderPostsTable: document.querySelector("#olderPostsTable tbody"),
      pinnedPostsTable: document.querySelector("#pinnedPostsTable tbody"),
      pinnedTopicsList: document.getElementById("pinnedTopicsList"),
      topicsList: document.getElementById("topicsList"),
      topicAuditTable: document.querySelector("#topicAuditTable tbody"),
      benchmarkBusiness: document.getElementById("benchmarkBusiness"),
      benchmarkHeadline: document.getElementById("benchmarkHeadline"),
      benchmarkFullMarket: document.getElementById("benchmarkFullMarket"),
      benchmarkTiers: document.getElementById("benchmarkTiers"),
      benchmarkReachable: document.getElementById("benchmarkReachable"),
      benchmarkRankingTable: document.querySelector("#benchmarkRankingTable tbody"),
      sortMetric: document.getElementById("sortMetric"),
      searchInput: document.getElementById("searchInput"),
      navBtns: document.querySelectorAll(".nav-btn"),
      vaultCoverageStrip: document.getElementById("vaultCoverageStrip"),
      vaultSearch: document.getElementById("vaultSearch"),
      vaultPostsTable: document.querySelector("#vaultPostsTable tbody"),
      vaultEntitiesTable: document.querySelector("#vaultEntitiesTable tbody"),
      vaultTopicsTable: document.querySelector("#vaultTopicsTable tbody"),
      vaultTranscriptsList: document.getElementById("vaultTranscriptsList"),
      vaultPostsCount: document.getElementById("vaultPostsCount"),
      vaultEntitiesCount: document.getElementById("vaultEntitiesCount"),
      vaultTopicsCount: document.getElementById("vaultTopicsCount"),
      vaultTranscriptsCount: document.getElementById("vaultTranscriptsCount"),
    };
  }

  function emptyState(msg) {
    return `<div class="empty-state card"><p>${escapeHtml(msg)}</p></div>`;
  }

  // Instagram only reports views for video/reels; image & carousel posts have no view
  // count, so 0 means "not a video" rather than "unseen" — show a dash instead of 0.
  function viewsLabel(v) {
    return v && v > 0 ? formatNumber(v) : "—";
  }

  function dashboardKpis() {
    const c = DATA.coverage || {};
    const totalEngagement = DATA.posts.reduce((sum, p) => sum + p.engagement, 0);
    const topDoctor = [...DATA.doctors].sort((a, b) => b.totalEngagement - a.totalEngagement)[0];
    const topTopic = [...DATA.topicRecommendations].sort((a, b) => b.score - a.score)[0];
    return [
      { label: "أطباء مؤكدين", value: formatNumber(DATA.meta.totalDoctors) },
      { label: "منشورات منتشرة", value: formatNumber(c.totalPosts ?? DATA.meta.totalPosts) },
      { label: "إجمالي التفاعل", value: formatNumber(totalEngagement) },
      { label: "أقوى حساب", value: topDoctor ? topDoctor.name : "-" },
      { label: "أعلى موضوع طبي", value: topTopic ? topTopic.topic : "-" },
      { label: "صفوف مواضيع", value: formatNumber(c.totalTopicAudit) },
      { label: "تفريغات صوتية", value: formatNumber(c.totalTranscripts) },
      { label: "منشورات ليها نصوص", value: formatNumber(c.postsWithTranscript) },
    ];
  }

  function buildKpis() {
    if (!els.kpiGrid) return;
    if (!DATA.posts.length) {
      els.kpiGrid.innerHTML = emptyState("مفيش بيانات لسه — المؤشرات هتظهر أول ما نخلص جمع البيانات.");
      return;
    }
    els.kpiGrid.innerHTML = dashboardKpis()
      .map((k) => `<article class="kpi"><div class="label">${k.label}</div><div class="value">${escapeHtml(k.value)}</div></article>`)
      .join("");
  }

  function coverageItems() {
    const c = DATA.coverage || {};
    return [
      { label: "منشورات منتشرة", value: c.totalPosts },
      { label: "حسابات وجهات", value: c.totalEntities },
      { label: "صفوف مواضيع", value: c.totalTopicAudit },
      { label: "تفريغات صوتية", value: c.totalTranscripts },
      { label: "منشورات ليها نصوص", value: c.postsWithTranscript },
    ];
  }

  function renderCoverage() {
    const html = coverageItems()
      .map((i) => `<div class="coverage-item"><span class="coverage-value">${formatNumber(i.value)}</span><span class="coverage-label">${i.label}</span></div>`)
      .join("");
    if (els.vaultCoverageStrip) els.vaultCoverageStrip.innerHTML = html;
  }

  const PLATFORM_ICONS = {
    Instagram: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4A5.8 5.8 0 0 1 16.2 22H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8A3.6 3.6 0 0 0 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6A3.6 3.6 0 0 0 16.4 4H7.6m9.65 1.5a1.08 1.08 0 1 1 0 2.16 1.08 1.08 0 0 1 0-2.16M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10m0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>`,
    Facebook: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M22 12a10 10 0 1 0-11.5 9.9v-7h-2.3V12h2.3V9.8c0-2.3 1.4-3.6 3.5-3.6 1 0 2 .2 2 .2v2.2h-1.1c-1.1 0-1.4.7-1.4 1.4V12h2.4l-.4 2.9h-2v7A10 10 0 0 0 22 12z"/></svg>`,
    TikTok: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.6 5.8a4.3 4.3 0 0 1-1-2.8h-3v12.1a2.4 2.4 0 1 1-2.4-2.4c.2 0 .5 0 .7.1V9.7a5.6 5.6 0 0 0-.7-.1 5.5 5.5 0 1 0 5.5 5.5V9a7.3 7.3 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.4-1.6z"/></svg>`,
  };

  const METRIC_ICONS = {
    likes: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
    comments: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`,
    views: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    shares: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>`
  };

  function parseFollowersFromConfidence(confidence) {
    const match = (confidence || "").match(/([\d,.]+)\s*([KkMm])?\s*followers/i);
    if (!match) return 0;
    let n = parseFloat(match[1].replace(/,/g, ""));
    if (match[2]?.toUpperCase() === "K") n *= 1000;
    if (match[2]?.toUpperCase() === "M") n *= 1000000;
    return Math.round(n);
  }

  function followersForPlatform(doctor, platform) {
    const fromPosts = DATA.posts
      .filter((p) => p.account === doctor.name && p.platform === platform)
      .reduce((max, p) => Math.max(max, p.followers || 0), 0);
    if (fromPosts) return fromPosts;
    const account = doctor.accounts.find((a) => a.platform === platform);
    return account ? parseFollowersFromConfidence(account.confidence) : 0;
  }

  function socialLinkButton(acc, doctor) {
    const platform = acc.platform;
    const icon = PLATFORM_ICONS[platform] || "";
    const followers = followersForPlatform(doctor, platform);
    const label = platform === "Instagram" ? "إنستجرام" : platform === "Facebook" ? "فيسبوك" : platform === "TikTok" ? "تيك توك" : platform;
    const slug = platform.toLowerCase();
    return `
      <button
        class="social-link-btn social-link-btn--${slug} open-app"
        type="button"
        data-url="${escapeHtml(acc.url)}"
        data-platform="${escapeHtml(platform)}"
        data-type="profile"
        aria-label="${escapeHtml(label)} — ${formatNumber(followers)} متابع"
      >
        ${icon}
        <span class="social-link-count">${formatNumber(followers)}</span>
      </button>`;
  }

  function postOpenButton(post) {
    const platform = post.platform;
    const icon = PLATFORM_ICONS[platform] || "";
    const label = platform === "Instagram" ? "إنستجرام" : platform === "Facebook" ? "فيسبوك" : platform === "TikTok" ? "تيك توك" : platform;
    const slug = platform.toLowerCase();
    return `
      <button
        class="social-link-btn social-link-btn--${slug} open-app"
        type="button"
        data-url="${escapeHtml(post.postUrl)}"
        data-platform="${escapeHtml(platform)}"
        data-type="post"
        aria-label="فتح المنشور على ${escapeHtml(label)}"
      >
        ${icon}
        <span>مشاهدة المنشور</span>
      </button>`;
  }

  // Build an embeddable URL for a post so it can be shown inline on demand.
  // Returns "" when the platform/URL can't be embedded reliably.
  function embedUrl(post) {
    const url = (post.postUrl || "").trim();
    if (!url) return "";
    if (post.platform === "Instagram") {
      const clean = url.split("?")[0].replace(/\/+$/, "");
      return `${clean}/embed/`;
    }
    if (post.platform === "Facebook") {
      return `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&show_text=true&width=500`;
    }
    return "";
  }

  // The card's left visual: a lightweight thumbnail that, on click, lazily
  // swaps in the live post embed. Falls back to the platform-icon placeholder
  // when the scraped thumbnail URL has expired (403) or is missing.
  function postVisual(p) {
    const embed = embedUrl(p);
    const hasThumb = !!p.transcript?.thumbnail;
    const playIcon = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`;
    const placeholder = `<div class="post-thumb-placeholder">${playIcon}</div>`;
    const img = hasThumb
      ? `<img class="post-thumb" src="${escapeHtml(p.transcript.thumbnail)}" alt="" loading="lazy" referrerpolicy="no-referrer"
             onerror="this.closest('.post-thumb-btn,.post-thumb-link')?.classList.add('thumb-failed')" />`
      : "";

    if (!embed) {
      return hasThumb
        ? `<a href="${escapeHtml(p.postUrl)}" target="_blank" rel="noopener noreferrer" class="post-thumb-link">${img}${placeholder}</a>`
        : placeholder;
    }

    return `
      <button type="button" class="post-thumb-btn load-embed${hasThumb ? "" : " no-thumb"}"
              data-embed="${escapeHtml(embed)}" aria-label="عرض المنشور داخل الصفحة">
        ${img}
        ${placeholder}
        <span class="thumb-play" aria-hidden="true">▶</span>
      </button>`;
  }

  function bindEmbedButtons(container) {
    container.querySelectorAll(".load-embed").forEach((btn) => {
      btn.addEventListener("click", () => {
        const embed = btn.getAttribute("data-embed");
        const visual = btn.closest(".post-visual");
        if (!embed || !visual) return;
        visual.classList.add("embed-active");
        visual.innerHTML = `
          <div class="post-embed">
            <iframe src="${escapeHtml(embed)}" loading="lazy" frameborder="0" scrolling="no"
                    allowtransparency="true" allow="encrypted-media" title="منشور"></iframe>
          </div>`;
      });
    });
  }

  function doctorCardHtml(doctor) {
    const metaChips = doctor.analyzed === false
      ? [`<span class="chip chip--muted">منافس محتمل — لسه متحللش</span>`]
      : [
          `<span class="chip">متابعين: ${formatNumber(doctor.followers)}</span>`,
          `<span class="chip">منشورات منتشرة: ${formatNumber(doctor.postCount)}</span>`,
          `<span class="chip">تفاعل: ${formatNumber(doctor.totalEngagement)}</span>`,
        ];
    const socialLinks = doctor.accounts.length
      ? doctor.accounts.map((acc) => socialLinkButton(acc, doctor)).join("")
      : `<span class="muted">مفيش روابط حسابات مؤكدة لسه.</span>`;
    return `
      <article class="doctor-card${doctor.analyzed === false ? " doctor-card--competitor" : ""}">
        <div class="doctor-head">
          <div class="doctor-info">
            <div class="doctor-name">${escapeHtml(doctor.name)}</div>
            <div class="doctor-spec">${escapeHtml(doctor.specializations.join(" • "))}</div>
          </div>
        </div>
        <div class="meta-row doctor-summary-metrics">${metaChips.join("")}</div>
        <div class="doctor-social-row">${socialLinks}</div>
      </article>`;
  }

  function renderDoctors() {
    if (!els.doctorsGrid) return;
    if (!DATA.doctors.length) {
      els.doctorsGrid.innerHTML = emptyState("مفيش حسابات لسه. الأطباء والحسابات هتظهر أول ما نخلص جمع البيانات.");
      return;
    }
    const analyzed = DATA.doctors.filter((d) => d.analyzed !== false);
    const competitors = DATA.doctors
      .filter((d) => d.analyzed === false)
      .sort((a, b) => (b.followers || 0) - (a.followers || 0));

    const metric = state.doctorSortMetric || "followers";
    const sorted = analyzed.slice().sort((a, b) => {
      const diff = (b[metric] || 0) - (a[metric] || 0);
      return diff !== 0 ? diff : (b.totalEngagement || 0) - (a.totalEngagement || 0);
    });
    els.doctorsGrid.innerHTML = sorted.map(doctorCardHtml).join("");
    bindOpenAppButtons(els.doctorsGrid);

    if (els.doctorsCount) els.doctorsCount.textContent = formatNumber(analyzed.length);
    if (els.competitorsCount) els.competitorsCount.textContent = formatNumber(competitors.length);
    if (els.competitorsGrid) {
      els.competitorsGrid.innerHTML = competitors.length
        ? competitors.map(doctorCardHtml).join("")
        : emptyState("مفيش منافسين محتملين في القايمة دلوقتي.");
      bindOpenAppButtons(els.competitorsGrid);
    }
  }

  function renderBenchmark() {
    const b = DATA.benchmark;
    if (!b) return;
    const bz = b.business;
    const topName = (b.ranking[0] || {}).name || "";

    if (els.benchmarkBusiness) {
      const links = (bz.accounts || [])
        .map((a) => `<a class="chip chip--link" href="${escapeHtml(a.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.platform)} ↗</a>`)
        .join("");
      els.benchmarkBusiness.innerHTML = `
      <div class="biz-card">
        <div class="biz-head">
          <div><div class="biz-name">${escapeHtml(bz.name)}</div><div class="biz-handle">@${escapeHtml(bz.handle)}</div></div>
          <span class="tier-badge tier-below">${escapeHtml(bz.tier)}</span>
        </div>
        <div class="biz-metrics">
          <div class="biz-metric"><span class="bm-val">${formatNumber(bz.followers)}</span><span class="bm-lbl">متابعون</span></div>
          <div class="biz-metric"><span class="bm-val">${formatNumber(bz.avgEng)}</span><span class="bm-lbl">متوسط التفاعل/منشور</span></div>
          <div class="biz-metric"><span class="bm-val">${formatNumber(bz.avgViews)}</span><span class="bm-lbl">متوسط المشاهدات (ريلز)</span></div>
          <div class="biz-metric"><span class="bm-val">${bz.engagementRatePct}%</span><span class="bm-lbl">معدل التفاعل</span></div>
        </div>
        <div class="biz-links">${links}</div>
        <p class="biz-note">${escapeHtml(bz.note)}</p>
      </div>`;
    }

    if (els.benchmarkHeadline) {
      const fLow = Math.round(b.lowestAnalyzed / bz.avgEng);
      const fMed = Math.round(b.medianAnalyzed / bz.avgEng);
      els.benchmarkHeadline.innerHTML = `
      <div class="rank-headline">
        <div class="rank-big">#${b.businessRank}<span>/ ${b.total}</span></div>
        <div class="rank-text">
          <p>ترتيبنا الحالي هو <strong>الأخير</strong> من بين ${b.total} حساب، على أساس متوسط التفاعل لكل منشور.</p>
          <ul>
            <li>أقل حساب مُحلَّل متوسطه <strong>${formatNumber(b.lowestAnalyzed)}</strong> تفاعل/منشور — أعلى مننا بحوالي <strong>×${fLow}</strong>.</li>
            <li>وسيط السوق <strong>${formatNumber(b.medianAnalyzed)}</strong> تفاعل/منشور — أعلى مننا بحوالي <strong>×${fMed}</strong>.</li>
            <li>أعلى حساب (${escapeHtml(topName)}) متوسطه <strong>${formatNumber(b.topAnalyzed)}</strong> تفاعل/منشور.</li>
          </ul>
          <p class="rank-note">الفجوة كبيرة، لكنها فجوة <strong>نوع محتوى</strong> مش حجم جمهور — الحلّ في الأقسام التحت.</p>
        </div>
      </div>`;
    }

    if (els.benchmarkFullMarket && b.fullMarket) {
      const fm = b.fullMarket;
      els.benchmarkFullMarket.innerHTML = `
      <div class="fm-grid">
        <div class="fm-stat"><span class="fm-val">#${fm.followersRank}<span>/ ${fm.total}</span></span><span class="fm-lbl">ترتيبنا بعدد المتابعين (وسط القايمة)</span></div>
        <div class="fm-stat fm-stat--bad"><span class="fm-val">#${b.total}<span>/ ${b.total}</span></span><span class="fm-lbl">ترتيبنا بالتفاعل (بين الـ${b.total} المُحلَّلين بعمق)</span></div>
      </div>
      <p class="fm-note">${escapeHtml(fm.note)}</p>`;
    }

    if (els.benchmarkTiers) {
      els.benchmarkTiers.innerHTML = b.tiers
        .map((t) => {
          const mine = t.accounts.some((m) => m.isBusiness);
          const chips = t.accounts
            .map((m) => `<span class="tier-chip${m.isBusiness ? " tier-chip--me" : ""}">${escapeHtml(m.name)} · ${formatNumber(m.avgEng)}</span>`)
            .join("");
          return `<div class="tier-row${mine ? " tier-row--me" : ""}">
        <div class="tier-meta"><span class="tier-name">${escapeHtml(t.name)}</span><span class="tier-range">${escapeHtml(t.range)} · ${t.count} حساب</span></div>
        <div class="tier-chips">${chips}</div>
      </div>`;
        })
        .join("");
    }

    if (els.benchmarkReachable) {
      els.benchmarkReachable.innerHTML = b.reachable
        .map((r) => `
      <article class="reach-card">
        <div class="reach-top"><span class="reach-acc">${escapeHtml(r.account)}</span><span class="tier-pill">${escapeHtml(r.tier)}</span></div>
        <div class="reach-topic">${escapeHtml(r.exampleTopic)}</div>
        <div class="reach-stats"><span>❤️ ${formatNumber(r.exampleEng)}</span><span>👁️ ${viewsLabel(r.exampleViews)}</span><span class="reach-avg">متوسط الحساب: ${formatNumber(r.avgEng)}</span></div>
        <a class="reach-link" href="${escapeHtml(r.exampleUrl)}" target="_blank" rel="noopener noreferrer">شوف المنشور ↗</a>
      </article>`)
        .join("");
    }

    if (els.benchmarkRankingTable) {
      // Show only a window of ±5 accounts around our rank (the rest is noise).
      const idx = b.ranking.findIndex((r) => r.isBusiness);
      const lo = Math.max(0, idx - 5);
      const hi = Math.min(b.ranking.length, idx + 6);
      els.benchmarkRankingTable.innerHTML = b.ranking
        .slice(lo, hi)
        .map((r) => `<tr class="${r.isBusiness ? "rank-me" : ""}">
        <td>${r.rank}</td>
        <td>${escapeHtml(r.name)}${r.isBusiness ? " <strong>(إحنا 🟢)</strong>" : ""}</td>
        <td>${escapeHtml(r.tier)}</td>
        <td>${formatNumber(r.avgEng)}</td>
        <td>${formatNumber(r.followers)}</td>
      </tr>`)
        .join("");
    }
  }

  function postMatchesFilters(post) {
    if (!state.search) return true;
    const q = state.search.toLowerCase();
    return (
      post.account.toLowerCase().includes(q) ||
      post.platform.toLowerCase().includes(q) ||
      (post.topicAudio || "").toLowerCase().includes(q) ||
      (post.topicCaption || "").toLowerCase().includes(q) ||
      (post.caption || "").toLowerCase().includes(q) ||
      (post.transcript?.text ? post.transcript.text.toLowerCase().includes(q) : false)
    );
  }

  function comparePosts(a, b) {
    const primary = (b[state.sortMetric] || 0) - (a[state.sortMetric] || 0);
    return primary !== 0 ? primary : a.rank - b.rank;
  }

  function transcriptBlock(p) {
    if (!p.transcript) {
      const msg = p.topicSource === "caption"
        ? "التصنيف معمول بناءً على الكابشن المفصل للحساب ده، فمش محتاج تفريغ صوتي."
        : "مفيش تفريغ صوتي للمنشور ده (ممكن يكون صورة أو مش موجود في مجموعة التفريغ).";
      return `<div class="transcript-block muted">${msg}</div>`;
    }
    const t = p.transcript;
    const segs = (t.segments || [])
      .map((s) => `<div class="seg"><span class="seg-time">${formatTime(s.start)}</span><span class="seg-text">${escapeHtml(s.text)}</span></div>`)
      .join("");
    const matchLabel = t.matchedBy === "caption-twin" ? "مطابقة عبر التوأم (Reel نفسه على إنستجرام)" : "مطابقة عبر رابط الفيديو";
    return `
    <details class="transcript-block">
      <summary>نص الفيديو الكامل (${(t.segments || []).length} مقطع) — ${matchLabel}</summary>
      <p class="transcript-full">${escapeHtml(t.text)}</p>
      <div class="segments">${segs}</div>
    </details>`;
  }

  function renderPosts() {
    if (!els.postsList) return;
    if (!DATA.posts.length) {
      els.postsList.innerHTML = emptyState("مفيش منشورات لسه.");
      if (els.postsCount) els.postsCount.textContent = "";
      return;
    }
    const posts = DATA.posts.filter(postMatchesFilters).sort(comparePosts);
    if (els.postsCount) {
      els.postsCount.textContent = `عرض ${formatNumber(posts.length)} من أصل ${formatNumber(DATA.posts.length)} منشور`;
    }
    if (els.postsPeriod) {
      const m = DATA.meta || {};
      els.postsPeriod.textContent = (m.dateFrom && m.dateTo)
        ? `🗓️ فترة التحليل (آخر ${m.windowDays || 90} يوم): من ${m.dateFrom} لحد ${m.dateTo} — بناءً على تواريخ المنشورات. المنشورات الأقدم موجودة في قسم لوحدها تحت.`
        : "";
    }
    if (!posts.length) {
      els.postsList.innerHTML = `<div class="post-card">مفيش نتائج مطابقة للبحث ده.</div>`;
      return;
    }
    els.postsList.innerHTML = posts.map((p) => {
      const tThumb = postVisual(p);
      const hasAudio = p.topicSource === "audio" && p.topicAudio && p.topicAudio !== "—";
      const hasCaption = p.topicCaption && p.topicCaption !== "Unclassified" && p.topicCaption !== "—";
      const topicLabel = hasAudio
        ? p.topicAudio
        : (hasCaption ? p.topicCaption : "غير مصنف — الموضوع جوه الفيديو (محتاج تفريغ صوتي)");

      return `
    <article class="post-card">
      <div class="post-header">
        <div class="post-meta-left">
          <span class="post-rank">#${p.rank}</span>
          <span class="post-date-tag">${escapeHtml(p.date)}</span>
        </div>
        <div class="engagement-stat" title="إجمالي التفاعل">
          <span class="stat-value">${formatNumber(p.engagement)}</span>
          <span class="stat-label">تفاعل</span>
        </div>
      </div>

      <div class="post-content">
        <div class="post-visual">
          ${tThumb}
        </div>
        <div class="post-info">
          <h3 class="post-title">${escapeHtml(topicLabel)}</h3>
          <div class="post-account-name">${escapeHtml(p.account)}</div>
          
          <div class="post-stats-grid">
            <div class="stat-item" title="إعجابات">
              <span class="stat-icon">${METRIC_ICONS.likes}</span>
              <span class="stat-value">${formatNumber(p.likes)}</span>
            </div>
            <div class="stat-item" title="مشاهدات">
              <span class="stat-icon">${METRIC_ICONS.views}</span>
              <span class="stat-value">${viewsLabel(p.views)}</span>
            </div>
            <div class="stat-item" title="تعليقات">
              <span class="stat-icon">${METRIC_ICONS.comments}</span>
              <span class="stat-value">${formatNumber(p.comments)}</span>
            </div>
            <div class="stat-item" title="مشاركات">
              <span class="stat-icon">${METRIC_ICONS.shares}</span>
              <span class="stat-value">${formatNumber(p.shares)}</span>
            </div>
          </div>

          <div class="post-actions">
            ${postOpenButton(p)}
          </div>
        </div>
      </div>

      <details class="post-expandable">
        <summary>التفاصيل والكابشن</summary>
        <div class="expandable-content">
          <div class="detail-chips">
            ${p.topicSource === "caption"
              ? `<span class="chip">الموضوع: ${escapeHtml(p.topicCaption)}</span>`
              : `<span class="chip">موضوع الصوت: ${escapeHtml(p.topicAudio)}</span><span class="chip">موضوع الكابشن: ${escapeHtml(p.topicCaption)}</span>`}
          </div>
          <p class="post-caption-text">${escapeHtml(p.caption) || "(مفيش نص متاح)"}</p>
          ${transcriptBlock(p)}
        </div>
      </details>
    </article>`;
    }).join("");
    bindOpenAppButtons(els.postsList);
    bindEmbedButtons(els.postsList);
  }

  function topicCardHtml(t, i) {
    return `
      <article class="topic-card">
        <div class="topic-name">${i + 1}. ${escapeHtml(t.topic)}</div>
        <div class="meta-row">
          <span class="chip">مشاهدات: ${formatNumber(t.views)}</span>
          <span class="chip">تفاعل: ${formatNumber(t.engagement)}</span>
          <span class="chip">منشورات: ${formatNumber(t.posts)}</span>
          <span class="chip">قوة الموضوع: ${formatNumber(t.score)}</span>
        </div>
        ${t.suggestion ? `<p class="muted">${escapeHtml(t.suggestion)}</p>` : ""}
      </article>`;
  }

  // Posts page only: secondary post tables (older high-engagement + pinned/evergreen).
  // Recent posts are in renderPosts; accounts live on the doctors page; topics on the topics page.
  function postsTableHtml(list, emptyMsg) {
    return list && list.length
      ? list.map((p, i) => {
          const lab = (p.topicSource === "audio" && p.topicAudio && p.topicAudio !== "—")
            ? p.topicAudio
            : (p.topicCaption && p.topicCaption !== "Unclassified" ? p.topicCaption : "غير مصنف");
          const link = p.postUrl
            ? `<a href="${escapeHtml(p.postUrl)}" target="_blank" rel="noopener">فتح ↗</a>`
            : `<span class="muted">—</span>`;
          return `<tr><td>${i + 1}</td><td>${escapeHtml(p.account)}</td><td>${escapeHtml(p.date || "")}</td><td>${escapeHtml(lab)}</td><td>${viewsLabel(p.views)}</td><td>${formatNumber(p.engagement)}</td><td>${link}</td></tr>`;
        }).join("")
      : `<tr><td colspan="7" class="muted">${escapeHtml(emptyMsg)}</td></tr>`;
  }

  function renderPinnedPosts() {
    if (els.olderPostsTable) els.olderPostsTable.innerHTML = postsTableHtml(DATA.olderPosts, "مفيش منشورات قديمة.");
    if (els.pinnedPostsTable) els.pinnedPostsTable.innerHTML = postsTableHtml(DATA.pinnedPosts, "مفيش منشورات مثبتة.");
  }

  function renderTopics() {
    if (!els.topicsList) return;
    if (!DATA.topicRecommendations.length) {
      els.topicsList.innerHTML = emptyState("مفيش توصيات مواضيع لسه — هتظهر هنا أول ما نخلص جمع البيانات وتحليلها.");
    } else {
      els.topicsList.innerHTML = DATA.topicRecommendations.map((t) => {
        const evidence = DATA.posts
          .filter((p) => p.topicAudio === t.topic)
          .sort((a, b) => b.engagement - a.engagement)
          .slice(0, 3)
          .map((p) => `<li>#${p.rank} • ${escapeHtml(p.account)} <span class="muted">(${formatNumber(p.engagement)} تفاعل)</span></li>`)
          .join("");
        return `
      <article class="topic-card">
        <div class="topic-name">${escapeHtml(t.topic)}</div>
        <div class="meta-row">
          <span class="chip">منشورات: ${formatNumber(t.posts)}</span>
          <span class="chip">تفاعل: ${formatNumber(t.engagement)}</span>
          <span class="chip">مشاهدات: ${formatNumber(t.views)}</span>
        </div>
        ${evidence ? `<details class="sub-details"><summary>المنشورات اللي بتدعم الموضوع ده</summary><ul class="linked-posts">${evidence}</ul></details>` : ""}
      </article>`;
      }).join("");
    }
    if (els.pinnedTopicsList) {
      const pt = DATA.pinnedTopics || [];
      els.pinnedTopicsList.innerHTML = pt.length
        ? pt.map(topicCardHtml).join("")
        : emptyState("مفيش مواضيع دايمة لسه.");
    }
    if (els.topicAuditTable) {
      els.topicAuditTable.innerHTML = (DATA.topicAudit || [])
        .map((t) => `<tr><td>${escapeHtml(t.topic)}</td><td>${formatNumber(t.posts)}</td><td>${formatNumber(t.engagement)}</td></tr>`)
        .join("");
    }
  }

  function rowMatchesVault(text) {
    if (!state.vaultSearch) return true;
    return text.toLowerCase().includes(state.vaultSearch.toLowerCase());
  }

  function renderVault() {
    const raw = DATA.raw || { posts: [], entities: [], topics: [], transcripts: [] };
    if (els.vaultPostsCount) els.vaultPostsCount.textContent = formatNumber(raw.posts.length);
    if (els.vaultEntitiesCount) els.vaultEntitiesCount.textContent = formatNumber(raw.entities.length);
    if (els.vaultTopicsCount) els.vaultTopicsCount.textContent = formatNumber(raw.topics.length);
    if (els.vaultTranscriptsCount) els.vaultTranscriptsCount.textContent = formatNumber(raw.transcripts.length);

    if (els.vaultPostsTable) {
      els.vaultPostsTable.innerHTML = DATA.posts
        .filter((p) => rowMatchesVault(`${p.account} ${p.platform} ${p.topicAudio} ${p.topicCaption} ${p.caption} ${p.transcript?.text || ""}`))
        .map((p) => `<tr>
          <td>${p.rank}</td><td>${escapeHtml(p.account)}</td><td>${escapeHtml(p.platform)}</td>
          <td>${escapeHtml(p.date)}</td><td>${escapeHtml(p.topicAudio)}</td>
          <td>${formatNumber(p.engagement)}</td><td>${viewsLabel(p.views)}</td>
          <td>${p.transcript ? "✓" : "—"}</td></tr>`)
        .join("");
    }
    if (els.vaultEntitiesTable) {
      els.vaultEntitiesTable.innerHTML = raw.entities
        .filter((e) => rowMatchesVault(Object.values(e).join(" ")))
        .map((e) => `<tr>
          <td>${escapeHtml(e.Name)}</td><td>${escapeHtml(e.Specialization)}</td>
          <td>${escapeHtml(e.Platform)}</td><td>${escapeHtml(e.Confidence)}</td>
          <td><a href="${escapeHtml(e.URL)}" target="_blank" rel="noopener noreferrer">رابط</a></td></tr>`)
        .join("");
    }
    if (els.vaultTopicsTable) {
      els.vaultTopicsTable.innerHTML = raw.topics
        .filter((t) => rowMatchesVault(t.topic))
        .map((t) => `<tr><td>${escapeHtml(t.topic)}</td><td>${formatNumber(t.posts)}</td><td>${formatNumber(t.engagement)}</td></tr>`)
        .join("");
    }
    if (els.vaultTranscriptsList) {
      els.vaultTranscriptsList.innerHTML = raw.transcripts.length
        ? raw.transcripts.filter((t) => rowMatchesVault(`${t.title} ${t.description} ${t.text} ${t.videoUrl}`)).map((t) => {
            const segs = (t.segments || [])
              .map((s) => `<div class="seg"><span class="seg-time">${formatTime(s.start)}</span><span class="seg-text">${escapeHtml(s.text)}</span></div>`)
              .join("");
            const thumb = t.thumbnail ? `<a href="${escapeHtml(t.videoUrl)}" target="_blank" rel="noopener noreferrer" class="post-thumb-link"><img class="post-thumb" src="${escapeHtml(t.thumbnail)}" alt="" loading="lazy" referrerpolicy="no-referrer" /></a>` : "";
            return `
        <article class="vault-transcript">
          <div class="post-body">${thumb}<div>
            <div class="post-title">${escapeHtml(t.title) || "(بدون عنوان)"}</div>
            <div class="post-subtitle">${formatTime(t.duration)} دقيقة • <a href="${escapeHtml(t.videoUrl)}" target="_blank" rel="noopener noreferrer">المصدر</a></div>
            ${t.description ? `<p class="vault-desc">${escapeHtml(t.description)}</p>` : ""}
          </div></div>
          <details class="transcript-block">
            <summary>عرض النص (${(t.segments || []).length} مقطع)</summary>
            <p class="transcript-full">${escapeHtml(t.text)}</p>
            <div class="segments">${segs}</div>
          </details>
        </article>`;
          }).join("")
        : emptyState("مفيش تفريغات صوتية لسه.");
    }
  }

  function bindPageEvents() {
    els.sortMetric?.addEventListener("change", (e) => { state.sortMetric = e.target.value; renderPosts(); });
    els.doctorSortMetric?.addEventListener("change", (e) => { state.doctorSortMetric = e.target.value; renderDoctors(); });
    els.searchInput?.addEventListener("input", (e) => { state.search = e.target.value.trim(); renderPosts(); });
    els.vaultSearch?.addEventListener("input", (e) => { state.vaultSearch = e.target.value.trim(); renderVault(); });
  }

  function renderPage(page) {
    cacheElements();
    bindPageEvents();
    if (page === "dashboard") buildKpis();
    if (page === "doctors") renderDoctors();
    if (page === "posts") { renderPosts(); renderPinnedPosts(); }
    if (page === "topics") renderTopics();
    if (page === "benchmark") renderBenchmark();
    if (page === "vault") { renderCoverage(); renderVault(); }
  }

  function pageMarkup(page) {
    if (page === "dashboard") return VERTICAL_CONFIG.dashboardHtml || "";
    return (window.MRPageTemplates && window.MRPageTemplates[page]) || "";
  }

  function loadPage(page) {
    state.currentPage = page;
    const host = document.getElementById("pageHost");
    if (!host) return;
    host.innerHTML = pageMarkup(page);
    document.title = `${VERTICAL_CONFIG.pages[page]?.title || page} — ${VERTICAL_CONFIG.title}`;
    const mobileTitle = document.querySelector(".mobile-title");
    if (mobileTitle) mobileTitle.textContent = VERTICAL_CONFIG.pages[page]?.shortTitle || VERTICAL_CONFIG.title;

    window.MRSidebar?.setActivePage?.(page);
    renderPage(page);
    window.MRSidebar?.closeMobileSidebar?.();
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (location.hash.replace("#", "") !== page) {
      history.replaceState(null, "", `#${page}`);
    }
  }

  function setupNav() {
    window.addEventListener("hashchange", () => {
      const hash = location.hash.replace("#", "");
      if (VERTICAL_CONFIG.pages[hash]) loadPage(hash);
    });
    const hash = location.hash.replace("#", "");
    const initial = VERTICAL_CONFIG.pages[hash] ? hash : "dashboard";
    return loadPage(initial);
  }

  function init() {
    return setupNav();
  }

  return { init, loadPage, renderPage };
})();
