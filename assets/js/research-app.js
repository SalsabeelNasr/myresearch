/* Generic research vertical app — expects window.DATA and window.VERTICAL_CONFIG */
window.MRResearchApp = (function () {
  const { formatNumber, escapeHtml, formatTime } = window.MRUtils;
  const { bindOpenAppButtons } = window.MRDeepLinks;

  let state = {
    sortMetric: "engagement",
    search: "",
    vaultSearch: "",
    currentPage: "dashboard",
  };

  let els = {};

  function cacheElements() {
    els = {
      kpiGrid: document.getElementById("kpiGrid"),
      doctorsGrid: document.getElementById("doctorsGrid"),
      postsList: document.getElementById("postsList"),
      postsCount: document.getElementById("postsCount"),
      topicsList: document.getElementById("topicsList"),
      topicAuditTable: document.querySelector("#topicAuditTable tbody"),
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

  function dashboardKpis() {
    const c = DATA.coverage || {};
    const totalEngagement = DATA.posts.reduce((sum, p) => sum + p.engagement, 0);
    const topDoctor = [...DATA.doctors].sort((a, b) => b.totalEngagement - a.totalEngagement)[0];
    const topTopic = [...DATA.topicRecommendations].sort((a, b) => b.score - a.score)[0];
    return [
      { label: "أطباء مؤكدون", value: formatNumber(DATA.meta.totalDoctors) },
      { label: "منشورات فيروسية", value: formatNumber(c.totalPosts ?? DATA.meta.totalPosts) },
      { label: "إجمالي التفاعل", value: formatNumber(totalEngagement) },
      { label: "أقوى حساب", value: topDoctor ? topDoctor.name : "-" },
      { label: "أعلى موضوع طبي", value: topTopic ? topTopic.topic : "-" },
      { label: "صفوف مواضيع", value: formatNumber(c.totalTopicAudit) },
      { label: "تفريغات صوتية", value: formatNumber(c.totalTranscripts) },
      { label: "منشورات مرتبطة بتفريغ", value: formatNumber(c.postsWithTranscript) },
    ];
  }

  function buildKpis() {
    if (!els.kpiGrid) return;
    if (!DATA.posts.length) {
      els.kpiGrid.innerHTML = emptyState("لا توجد بيانات بعد — سيتم عرض المؤشرات عند اكتمال جمع البيانات.");
      return;
    }
    els.kpiGrid.innerHTML = dashboardKpis()
      .map((k) => `<article class="kpi"><div class="label">${k.label}</div><div class="value">${escapeHtml(k.value)}</div></article>`)
      .join("");
  }

  function coverageItems() {
    const c = DATA.coverage || {};
    return [
      { label: "منشورات فيروسية", value: c.totalPosts },
      { label: "حسابات/كيانات", value: c.totalEntities },
      { label: "صفوف مواضيع", value: c.totalTopicAudit },
      { label: "تفريغات صوتية", value: c.totalTranscripts },
      { label: "منشورات مرتبطة بتفريغ", value: c.postsWithTranscript },
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
    const label = platform === "Instagram" ? "إنستجرام" : platform === "Facebook" ? "فيسبوك" : platform;
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
    const label = platform === "Instagram" ? "إنستجرام" : platform === "Facebook" ? "فيسبوك" : platform;
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

  function renderDoctors() {
    if (!els.doctorsGrid) return;
    if (!DATA.doctors.length) {
      els.doctorsGrid.innerHTML = emptyState("لا توجد حسابات بعد. سيتم عرض الأطباء والحسابات عند اكتمال جمع البيانات.");
      return;
    }
    els.doctorsGrid.innerHTML = DATA.doctors.map((doctor) => {
      const metaChips = [
        `<span class="chip">منشورات فيروسية: ${formatNumber(doctor.postCount)}</span>`,
        `<span class="chip">تفاعل: ${formatNumber(doctor.totalEngagement)}</span>`,
      ];

      const socialLinks = doctor.accounts.length
        ? doctor.accounts.map((acc) => socialLinkButton(acc, doctor)).join("")
        : `<span class="muted">لا توجد روابط حسابات مؤكدة.</span>`;

      return `
      <article class="doctor-card">
        <div class="doctor-head">
          <div class="doctor-info">
            <div class="doctor-name">${escapeHtml(doctor.name)}</div>
            <div class="doctor-spec">${escapeHtml(doctor.specializations.join(" • "))}</div>
          </div>
        </div>
        <div class="meta-row doctor-summary-metrics">${metaChips.join("")}</div>
        <div class="doctor-social-row">${socialLinks}</div>
      </article>`;
    }).join("");
    bindOpenAppButtons(els.doctorsGrid);
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
        ? "التصنيف مبني على الكابشن المفصّل لهذا الحساب، فلا يحتاج تفريغ صوتي."
        : "لا يوجد تفريغ صوتي مرتبط بهذا المنشور (منشور صورة أو غير متوفر في مجموعة التفريغ).";
      return `<div class="transcript-block muted">${msg}</div>`;
    }
    const t = p.transcript;
    const segs = (t.segments || [])
      .map((s) => `<div class="seg"><span class="seg-time">${formatTime(s.start)}</span><span class="seg-text">${escapeHtml(s.text)}</span></div>`)
      .join("");
    const matchLabel = t.matchedBy === "caption-twin" ? "مطابقة عبر التوأم (Reel نفسه على إنستجرام)" : "مطابقة عبر رابط الفيديو";
    return `
    <details class="transcript-block">
      <summary>التفريغ الصوتي الكامل (${(t.segments || []).length} مقطع) — ${matchLabel}</summary>
      <p class="transcript-full">${escapeHtml(t.text)}</p>
      <div class="segments">${segs}</div>
    </details>`;
  }

  function renderPosts() {
    if (!els.postsList) return;
    if (!DATA.posts.length) {
      els.postsList.innerHTML = emptyState("لا توجد منشورات بعد.");
      if (els.postsCount) els.postsCount.textContent = "";
      return;
    }
    const posts = DATA.posts.filter(postMatchesFilters).sort(comparePosts);
    if (els.postsCount) {
      els.postsCount.textContent = `عرض ${formatNumber(posts.length)} من ${formatNumber(DATA.posts.length)} منشور`;
    }
    if (!posts.length) {
      els.postsList.innerHTML = `<div class="post-card">لا توجد نتائج مطابقة للبحث الحالي.</div>`;
      return;
    }
    els.postsList.innerHTML = posts.map((p) => {
      const tThumb = p.transcript?.thumbnail
        ? `<a href="${escapeHtml(p.postUrl)}" target="_blank" rel="noopener noreferrer" class="post-thumb-link">
             <img class="post-thumb" src="${escapeHtml(p.transcript.thumbnail)}" alt="" loading="lazy" referrerpolicy="no-referrer" />
           </a>`
        : `<div class="post-thumb-placeholder">${PLATFORM_ICONS[p.platform] || ""}</div>`;
      
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
          <h3 class="post-title">${escapeHtml(p.topicAudio)}</h3>
          <div class="post-account-name">${escapeHtml(p.account)}</div>
          
          <div class="post-stats-grid">
            <div class="stat-item" title="إعجابات">
              <span class="stat-icon">${METRIC_ICONS.likes}</span>
              <span class="stat-value">${formatNumber(p.likes)}</span>
            </div>
            <div class="stat-item" title="مشاهدات">
              <span class="stat-icon">${METRIC_ICONS.views}</span>
              <span class="stat-value">${formatNumber(p.views)}</span>
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
          <p class="post-caption-text">${escapeHtml(p.caption) || "(لا يوجد نص متاح)"}</p>
          ${transcriptBlock(p)}
        </div>
      </details>
    </article>`;
    }).join("");
    bindOpenAppButtons(els.postsList);
  }

  function renderTopics() {
    if (!els.topicsList) return;
    if (!DATA.topicRecommendations.length) {
      els.topicsList.innerHTML = emptyState("لا توجد توصيات مواضيع بعد — ستظهر هنا بعد جمع البيانات وتحليلها.");
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
        ${evidence ? `<details class="sub-details"><summary>المنشورات الداعمة لهذا الموضوع</summary><ul class="linked-posts">${evidence}</ul></details>` : ""}
      </article>`;
      }).join("");
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
          <td>${formatNumber(p.engagement)}</td><td>${formatNumber(p.views)}</td>
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
            <summary>عرض التفريغ (${(t.segments || []).length} مقطع)</summary>
            <p class="transcript-full">${escapeHtml(t.text)}</p>
            <div class="segments">${segs}</div>
          </details>
        </article>`;
          }).join("")
        : emptyState("لا توجد تفريغات صوتية بعد.");
    }
  }

  function bindPageEvents() {
    els.sortMetric?.addEventListener("change", (e) => { state.sortMetric = e.target.value; renderPosts(); });
    els.searchInput?.addEventListener("input", (e) => { state.search = e.target.value.trim(); renderPosts(); });
    els.vaultSearch?.addEventListener("input", (e) => { state.vaultSearch = e.target.value.trim(); renderVault(); });
  }

  function renderPage(page) {
    cacheElements();
    bindPageEvents();
    if (page === "dashboard") buildKpis();
    if (page === "doctors") renderDoctors();
    if (page === "posts") { renderPosts(); }
    if (page === "topics") renderTopics();
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
