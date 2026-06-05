/* Generic research vertical app — expects window.DATA and window.VERTICAL_CONFIG */
window.MRResearchApp = (function () {
  const { formatNumber, escapeHtml, formatTime } = window.MRUtils;
  const { bindOpenAppButtons } = window.MRDeepLinks;

  let state = {
    sortMetric: "engagement",
    doctorSortMetric: "overall",
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
      excludedGrid: document.getElementById("excludedGrid"),
      excludedCount: document.getElementById("excludedCount"),
      doctorSortMetric: document.getElementById("doctorSortMetric"),
      postsList: document.getElementById("postsList"),
      postsCount: document.getElementById("postsCount"),
      postsAccountsTable: document.querySelector("#postsAccountsTable tbody"),
      postsTopicsList: document.getElementById("postsTopicsList"),
      evergreenTable: document.querySelector("#evergreenTable tbody"),
      evergreenTableEl: document.getElementById("evergreenTable"),
      evergreenCount: document.getElementById("evergreenCount"),
      pinnedTopicsList: document.getElementById("pinnedTopicsList"),
      topicsList: document.getElementById("topicsList"),
      topicAuditTable: document.querySelector("#topicAuditTable tbody"),
      benchmarkBusiness: document.getElementById("benchmarkBusiness"),
      benchmarkHeadline: document.getElementById("benchmarkHeadline"),
      benchmarkFullMarket: document.getElementById("benchmarkFullMarket"),
      benchmarkPeersTable: document.querySelector("#benchmarkPeersTable tbody"),
      benchmarkPeersTableEl: document.getElementById("benchmarkPeersTable"),
      benchmarkPlatform: document.getElementById("benchmarkPlatform"),
      benchmarkPeersFoot: document.getElementById("benchmarkPeersFoot"),
      benchmarkTiers: document.getElementById("benchmarkTiers"),
      benchmarkReachable: document.getElementById("benchmarkReachable"),
      benchmarkRankingTable: document.querySelector("#benchmarkRankingTable tbody"),
      benchmarkFullRanking: document.querySelector("#benchmarkFullRanking tbody"),
      benchmarkFullRankingEl: document.getElementById("benchmarkFullRanking"),
      benchmarkFullCount: document.getElementById("benchmarkFullCount"),
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
    const pkey = platform === "Instagram" ? "ig" : platform === "Facebook" ? "fb" : platform === "TikTok" ? "tt" : null;
    const pf = doctor.platformFollowers || {};
    const followers = (pkey && pf[pkey] != null) ? pf[pkey] : followersForPlatform(doctor, platform);
    const label = platform === "Instagram" ? "إنستجرام" : platform === "Facebook" ? "فيسبوك" : platform === "TikTok" ? "تيك توك" : platform;
    const slug = platform.toLowerCase();
    const hasCount = followers > 0;
    const countHtml = hasCount
      ? `<span class="social-link-count">${formatNumber(followers)}</span>`
      : "";
    const ariaCount = hasCount ? ` — ${formatNumber(followers)} متابع` : "";
    return `
      <button
        class="social-link-btn social-link-btn--${slug}${hasCount ? "" : " social-link-btn--icon-only"} open-app"
        type="button"
        data-url="${escapeHtml(acc.url)}"
        data-platform="${escapeHtml(platform)}"
        data-type="profile"
        aria-label="${escapeHtml(label)}${ariaCount}"
      >
        ${icon}
        ${countHtml}
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

  const DOCTOR_EXPANDER_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;

  function doctorCardHtml(doctor) {
    const pf = doctor.platforms;
    const platChip = (lbl, m) => m
      ? `<span class="chip" title="وسيط التفاعل/منشور على ${lbl} (آخر ${m.n} منشور) · نشر/شهر ${m.postsPerMonth != null ? m.postsPerMonth : "—"}${m.viralSkew ? " · ⚠️ متوسط متضخّم بفيرالي" : ""}">${lbl} · تفاعل/منشور: ${formatNumber(m.median)}${m.viralSkew ? " ⚠️" : ""}</span>`
      : "";
    const recChips = pf ? [
      pf.overall ? `<span class="chip chip--strong" title="مجموع وسيط التفاعل عبر المنصّات النشِطة">إجمالي التفاعل/منشور: ${formatNumber(pf.overall.median)}</span>` : "",
      platChip("إنستجرام", pf.ig),
      platChip("فيسبوك", pf.fb),
      platChip("تيك توك", pf.tt),
    ].filter(Boolean) : (doctor.recent ? [
      `<span class="chip" title="وسيط آخر ${doctor.recent.n90} منشور">وسيط التفاعل (إنستجرام): ${formatNumber(doctor.recent.median90)}</span>`,
    ] : []);
    const metaChips = doctor.analyzed === false
      ? [`<span class="chip chip--muted">منافس محتمل — لسه متحللش</span>`]
      : [
          `<span class="chip">منشورات منتشرة: ${formatNumber(doctor.postCount)}</span>`,
          ...recChips,
        ];
    const socialLinks = doctor.accounts.length
      ? doctor.accounts.map((acc) => socialLinkButton(acc, doctor)).join("")
      : `<span class="muted doctor-no-links">—</span>`;
    const metricsLabel = doctor.analyzed === false ? "عرض الحالة" : "عرض الأرقام";
    return `
      <article class="doctor-card${doctor.analyzed === false ? " doctor-card--competitor" : ""}">
        <div class="doctor-top">
          <div class="doctor-main">
            <div class="doctor-info">
              <details class="doctor-metrics-toggle">
                <summary class="doctor-headline" aria-label="${metricsLabel}">
                  <span class="doctor-expander" aria-hidden="true">${DOCTOR_EXPANDER_ICON}</span>
                  <span class="doctor-name">${escapeHtml(doctor.name)}</span>
                </summary>
                <div class="doctor-spec">${escapeHtml(doctor.specializations.join(" • "))}</div>
                <div class="meta-row doctor-summary-metrics">${metaChips.join("")}</div>
              </details>
            </div>
          </div>
          <div class="doctor-social-row">${socialLinks}</div>
        </div>
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

    const metric = state.doctorSortMetric || "overall";
    const platKeys = { overall: "overall", ig: "ig", fb: "fb", tt: "tt" };
    const valOf = (d) => {
      if (platKeys[metric]) {
        const m = (d.platforms || {})[platKeys[metric]];
        return m && m.median != null ? m.median : -1;
      }
      return d[metric] || 0;
    };
    const sorted = analyzed.slice().sort((a, b) => {
      const diff = valOf(b) - valOf(a);
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

    const excluded = DATA.excludedDoctors || [];
    if (els.excludedCount) els.excludedCount.textContent = formatNumber(excluded.length);
    if (els.excludedGrid) {
      els.excludedGrid.innerHTML = excluded.length
        ? excluded.map((d) => {
            const links = d.accounts.length
              ? d.accounts.map((acc) => socialLinkButton(acc, d)).join("")
              : `<span class="muted">—</span>`;
            return `
      <article class="doctor-card doctor-card--excluded">
        <div class="doctor-top">
          <div class="doctor-main">
            <div class="doctor-info">
              <details class="doctor-metrics-toggle">
                <summary class="doctor-headline" aria-label="عرض سبب الاستبعاد">
                  <span class="doctor-name">${escapeHtml(d.name)}</span>
                  <span class="doctor-expander" aria-hidden="true">${DOCTOR_EXPANDER_ICON}</span>
                </summary>
                <div class="doctor-spec">${escapeHtml((d.specializations || []).join(" • "))}</div>
                <div class="meta-row"><span class="chip chip--excluded">${escapeHtml(d.excludeReason || "مستبعد")}</span></div>
              </details>
            </div>
          </div>
          <div class="doctor-social-row">${links}</div>
        </div>
      </article>`;
          }).join("")
        : emptyState("لا يوجد مستبعدون.");
      bindOpenAppButtons(els.excludedGrid);
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
      const fm = b.fullMarket || {};
      els.benchmarkBusiness.innerHTML = `
      <div class="biz-card">
        <div class="biz-head">
          <div><div class="biz-name">${escapeHtml(bz.name)}</div><div class="biz-handle">@${escapeHtml(bz.handle)}</div></div>
          <span class="tier-badge tier-below">${escapeHtml(bz.tier)}</span>
        </div>
        
        <div class="biz-metrics">
          <div class="biz-metric"><span class="bm-val">${formatNumber(bz.followers)}</span><span class="bm-lbl">متابعون</span></div>
          <div class="biz-metric"><span class="bm-val">${formatNumber(bz.median != null ? bz.median : bz.avgEng)}</span><span class="bm-lbl">وسيط التفاعل/منشور</span></div>
          <div class="biz-metric"><span class="bm-val">${bz.postsPerMonth != null ? bz.postsPerMonth : "—"}</span><span class="bm-lbl">نشر/شهر</span></div>
          <div class="biz-metric"><span class="bm-val">${bz.engagementRatePct}%</span><span class="bm-lbl">معدل التفاعل</span></div>
          <div class="biz-metric biz-metric--highlight"><span class="bm-val">#${fm.followersRank}<span>/${fm.total}</span></span><span class="bm-lbl">ترتيب المتابعين</span></div>
          <div class="biz-metric biz-metric--bad"><span class="bm-val">#${b.businessRank}<span>/${b.total}</span></span><span class="bm-lbl">ترتيب التفاعل</span></div>
        </div>

        <div class="biz-footer">
          <div class="biz-links">${links}</div>
          <p class="fm-note fm-note--compact">
            وصول حسابات في نفس حجمنا لتفاعل أضعافنا بيأكد إن الفجوة في <strong>نوع المحتوى</strong> مش حجم الجمهور — الحل في الأقسام التحت.
          </p>
        </div>
      </div>`;
    }

    if (els.benchmarkHeadline) {
      els.benchmarkHeadline.innerHTML = "";
    }

    if (els.benchmarkPeersTable && b.sizePeers) {
      const sp = b.sizePeers;
      const bizMed = sp.businessMedian || 4.5;
      const getTierInfo = (avg) => {
        if (avg >= 3000) return { name: "النخبة", cls: "tier-elite" };
        if (avg >= 1500) return { name: "متقدّم", cls: "tier-advanced" };
        if (avg >= 700) return { name: "متوسّط", cls: "tier-mid" };
        if (avg >= 200) return { name: "ناشئ", cls: "tier-emerging" };
        return { name: "تحت المنافسة", cls: "tier-below" };
      };
      const platLabel = { overall: "الإجمالي", ig: "إنستجرام", fb: "فيسبوك", tt: "تيك توك" };

      const renderPeers = (platKey) => {
        const m = (p) => (p.platforms || {})[platKey] || null;
        // Show only accounts that actually have data on the selected platform.
        // Show accounts that have data on the selected platform — but always keep curefit (our reference).
        const rows = sp.peers
          .filter((p) => { const md = m(p); return (md && md.median != null) || p.isBusiness; })
          .sort((a, bb) => { const va = m(a) && m(a).median != null ? m(a).median : -1; const vb = m(bb) && m(bb).median != null ? m(bb).median : -1; return vb - va; });
        let usRank = 0;
        const usShown = rows.some((p) => p.isBusiness && m(p));
        els.benchmarkPeersTable.innerHTML = rows.map((p, i) => {
          if (p.isBusiness) usRank = i + 1;
          const md = m(p);
          const isHandle = /^[a-z0-9._]+$/i.test(p.handle);
          const name = (p.isBusiness || !isHandle)
            ? `<strong>${escapeHtml(p.handle)}</strong>`
            : `<a href="https://www.instagram.com/${escapeHtml(p.handle)}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.handle)}</a>`;
          const sizeBadge = p.inBand && !p.isBusiness ? ` <span class="size-badge" title="في نفس شريحة متابعينا">👥 نفس حجمنا</span>` : "";
          const xb = (md && md.median != null) ? Math.round(md.median / bizMed * 10) / 10 : null;
          const cls = p.isBusiness ? "row-us" : (p.inBand && xb != null && xb >= 5 ? "peer-role" : "");
          if (!md || md.median == null) {
            // Only reachable for curefit on a platform we haven't measured yet.
            return `
        <tr class="row-us">
          <td>${i + 1}</td>
          <td><strong>${escapeHtml(p.handle)}</strong> (إحنا)</td>
          <td><span class="tier-badge tier-below">—</span></td>
          <td>${formatNumber(p.followers)}</td>
          <td data-sort="-1" title="لسه ماكشطناش بيانات حسابنا على ${platLabel[platKey]}">—</td>
          <td data-sort="-1">—</td>
          <td data-sort="-1">—</td>
          <td data-sort="-1">—</td>
          <td>👈 وضعنا</td>
        </tr>`;
          }
          const tier = getTierInfo(md.median);
          const skew = md.viralSkew
            ? ` <span class="skew-flag" title="المتوسط متضخّم: التفاعل جاي بمعظمه من منشور واحد فيرالي. اعتمد على الوسيط.">⚠️</span>`
            : "";
          const platCount = platKey === "overall" && md.platforms ? ` <span class="size-badge" title="عدد المنصّات الفعّالة">${md.platforms}🌐</span>` : "";
          return `
        <tr${cls ? ` class="${cls}"` : ""}>
          <td>${i + 1}</td>
          <td>${name}${p.isBusiness ? " (إحنا)" : ""}${sizeBadge}${platCount}</td>
          <td><span class="tier-badge ${tier.cls}">${tier.name}</span></td>
          <td>${formatNumber(p.followers)}</td>
          <td data-sort="${md.median}"><strong title="وسيط آخر ${md.n} منشور">${formatNumber(md.median)}</strong></td>
          <td data-sort="${md.mean}">${formatNumber(md.mean)}${skew}</td>
          <td data-sort="${md.postsPerMonth != null ? md.postsPerMonth : -1}">${md.postsPerMonth != null ? md.postsPerMonth : "—"}</td>
          <td data-sort="${xb}">${p.isBusiness ? "×1" : `<strong>×${xb}</strong>`}</td>
          <td>${escapeHtml(p.note || (p.isBusiness ? "👈 وضعنا" : ""))}</td>
        </tr>`;
        }).join("");
        makeSortable(els.benchmarkPeersTableEl);
        if (els.benchmarkPeersFoot) {
          const withData = sp.peers.filter((p) => m(p) && m(p).median != null).length;
          const skewCount = sp.peers.filter((p) => m(p) && m(p).viralSkew).length;
          els.benchmarkPeersFoot.innerHTML = `<strong>الخلاصة (${platLabel[platKey]}):</strong> مرتّبين بـ<strong>وسيط التفاعل</strong> (مش المتوسط) عشان منشور فيرالي واحد ميطلّعش حساب لفوق بالغلط. الـ<strong>⚠️</strong> = متوسط الحساب متضخّم بمنشور واحد (${skewCount} حساب). الجدول بيعرض بس الحسابات اللي عندها وجود على ${platLabel[platKey]} (<strong>${withData}</strong> حساب). موقعنا (curefit): <strong>${usShown ? "#" + usRank : "مش نشط على المنصّة دي"}</strong>. <br><span class="muted">«الإجمالي» = مجموع وسيط التفاعل على إنستجرام + فيسبوك + تيك توك (بيكافئ الحسابات النشطة على أكتر من منصّة). × تفاعلنا مقارنة بوسيطنا على إنستجرام (${bizMed}).</span>`;
        }
      };

      const initPlat = (els.benchmarkPlatform && els.benchmarkPlatform.value) || "overall";
      renderPeers(initPlat);
      if (els.benchmarkPlatform && !els.benchmarkPlatform.dataset.bound) {
        els.benchmarkPlatform.dataset.bound = "1";
        els.benchmarkPlatform.addEventListener("change", (e) => renderPeers(e.target.value));
      }
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
      els.postsCount.textContent = `(${formatNumber(posts.length)})`;
    }
    if (!posts.length) {
      els.postsList.innerHTML = `<div class="post-card">مفيش نتائج مطابقة للبحث ده.</div>`;
      return;
    }
    els.postsList.innerHTML = posts.map((p) => {
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

  // Make any table's columns click-sortable (asc/desc) with an arrow indicator.
  function makeSortable(table) {
    if (!table) return;
    const ths = Array.from(table.querySelectorAll("thead th"));
    ths.forEach((th, idx) => {
      if (th.dataset.noSort === "1") return;
      if (!th.querySelector(".sort-arrow")) {
        th.classList.add("th-sortable");
        const s = document.createElement("span");
        s.className = "sort-arrow";
        s.textContent = " ⇅";
        th.appendChild(s);
      }
      th.onclick = () => {
        const tbody = table.querySelector("tbody");
        if (!tbody) return;
        const dir = th.dataset.dir === "desc" ? "asc" : "desc";
        ths.forEach((o) => { if (o !== th) { o.dataset.dir = ""; const a = o.querySelector(".sort-arrow"); if (a) a.textContent = " ⇅"; } });
        th.dataset.dir = dir;
        const arrow = th.querySelector(".sort-arrow");
        if (arrow) arrow.textContent = dir === "desc" ? " ▼" : " ▲";
        const rows = Array.from(tbody.querySelectorAll("tr"));
        const cellVal = (tr) => {
          const cell = tr.children[idx];
          const txt = (cell ? cell.textContent : "").trim();
          const num = parseFloat(txt.replace(/[,،\s]/g, "").replace(/[^\d.\-]/g, ""));
          const isNum = /\d/.test(txt) && !isNaN(num);
          return { num, txt, isNum };
        };
        rows.sort((r1, r2) => {
          const A = cellVal(r1), B = cellVal(r2);
          const c = (A.isNum && B.isNum) ? (A.num - B.num) : A.txt.localeCompare(B.txt, "ar");
          return dir === "asc" ? c : -c;
        });
        rows.forEach((r) => tbody.appendChild(r));
      };
    });
  }

  // Evergreen page: older (>90d) + pinned posts merged into one sortable table,
  // with a "النوع" column flagging whether each post was pinned.
  function renderPinnedPosts() {
    if (!els.evergreenTable) return;
    const older = (DATA.olderPosts || []).map((p) => ({ ...p, pinned: false }));
    const pinned = (DATA.pinnedPosts || []).map((p) => ({ ...p, pinned: true }));
    const all = [...older, ...pinned].sort((a, b) => (b.engagement || 0) - (a.engagement || 0));
    if (els.evergreenCount) els.evergreenCount.textContent = `(${formatNumber(all.length)})`;
    els.evergreenTable.innerHTML = all.length
      ? all.map((p, i) => {
          const lab = (p.topicSource === "audio" && p.topicAudio && p.topicAudio !== "—")
            ? p.topicAudio
            : (p.topicCaption && p.topicCaption !== "Unclassified" ? p.topicCaption : "غير مصنف");
          const link = p.postUrl
            ? `<a href="${escapeHtml(p.postUrl)}" target="_blank" rel="noopener noreferrer">فتح ↗</a>`
            : `<span class="muted">—</span>`;
          const type = p.pinned ? `<span class="chip chip--pin">مثبّت 📌</span>` : `قديم`;
          return `<tr><td>${escapeHtml(p.account)}</td><td>${escapeHtml(p.platform || "—")}</td><td>${viewsLabel(p.views)}</td><td>${formatNumber(p.engagement)}</td><td>${i + 1}</td><td>${escapeHtml(p.date || "")}</td><td>${escapeHtml(lab)}</td><td>${type}</td><td>${link}</td></tr>`;
        }).join("")
      : `<tr><td colspan="9" class="muted">مفيش منشورات.</td></tr>`;
    makeSortable(els.evergreenTableEl);
  }

  function renderTopics() {
    if (!els.topicsList) return;
    if (!DATA.topicRecommendations.length) {
      els.topicsList.innerHTML = emptyState("مفيش توصيات مواضيع لسه — هتظهر هنا أول ما نخلص جمع البيانات وتحليلها.");
    } else {
      const effTopic = (p) => (p.topicSource === "audio" && p.topicAudio && p.topicAudio !== "—")
        ? p.topicAudio
        : (p.topicCaption || "");
      els.topicsList.innerHTML = DATA.topicRecommendations.map((t) => {
        const evidence = [...DATA.posts, ...(DATA.olderPosts || [])]
          .filter((p) => effTopic(p) === t.topic && p.postUrl)
          .sort((a, b) => b.engagement - a.engagement)
          .slice(0, 4)
          .map((p) => `<li><a href="${escapeHtml(p.postUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.account)}</a> <span class="muted">(${formatNumber(p.engagement)} تفاعل${p.views ? " • " + formatNumber(p.views) + " مشاهدة" : ""})</span> — <a href="${escapeHtml(p.postUrl)}" target="_blank" rel="noopener noreferrer">فتح المنشور ↗</a></li>`)
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
      const allVaultPosts = [...DATA.posts, ...(DATA.olderPosts || []), ...(DATA.pinnedPosts || [])];
      els.vaultPostsTable.innerHTML = allVaultPosts
        .filter((p) => rowMatchesVault(`${p.account} ${p.platform} ${p.topicAudio} ${p.topicCaption} ${p.caption} ${p.transcript?.text || ""} ${p.postUrl || ""}`))
        .map((p, i) => {
          const link = p.postUrl
            ? `<a href="${escapeHtml(p.postUrl)}" target="_blank" rel="noopener noreferrer">فتح ↗</a>`
            : `<span class="muted">—</span>`;
          return `<tr>
          <td>${i + 1}</td><td>${escapeHtml(p.account)}</td><td>${escapeHtml(p.platform)}</td>
          <td>${escapeHtml(p.date)}</td><td>${escapeHtml(p.topicAudio)}</td>
          <td>${formatNumber(p.engagement)}</td><td>${viewsLabel(p.views)}</td>
          <td>${p.transcript ? "✓" : "—"}</td><td>${link}</td></tr>`;
        })
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
    if (page === "posts") renderPosts();
    if (page === "evergreen") renderPinnedPosts();
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
