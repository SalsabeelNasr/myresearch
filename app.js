/* DATA is loaded from data.js (full source-backed dataset). */

const nf = new Intl.NumberFormat("ar-EG");
const state = {
  sortMetric: "engagement",
  platform: "all",
  doctor: "all",
  topic: "all",
  transcript: "all",
  search: "",
  vaultSearch: "",
};

const els = {
  kpiGrid: document.getElementById("kpiGrid"),
  coverageStrip: document.getElementById("coverageStrip"),
  doctorsGrid: document.getElementById("doctorsGrid"),
  postsList: document.getElementById("postsList"),
  postsCount: document.getElementById("postsCount"),
  topicsList: document.getElementById("topicsList"),
  topicAuditTable: document.querySelector("#topicAuditTable tbody"),
  sortMetric: document.getElementById("sortMetric"),
  platformFilter: document.getElementById("platformFilter"),
  doctorFilter: document.getElementById("doctorFilter"),
  topicFilter: document.getElementById("topicFilter"),
  transcriptFilter: document.getElementById("transcriptFilter"),
  searchInput: document.getElementById("searchInput"),
  navBtns: document.querySelectorAll(".nav-btn"),
  menuToggle: document.getElementById("menuToggle"),
  closeSidebar: document.getElementById("closeSidebar"),
  sidebarOverlay: document.getElementById("sidebarOverlay"),
  sidebar: document.getElementById("sidebar"),
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
  pages: {
    dashboard: document.getElementById("dashboard-page"),
    doctors: document.getElementById("doctors-page"),
    posts: document.getElementById("posts-page"),
    topics: document.getElementById("topics-page"),
    vault: document.getElementById("vault-page"),
  },
};

function formatNumber(value) {
  return nf.format(Number(value || 0));
}

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function initials(name) {
  return (name || "?")
    .replace("Dr.", "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

function formatTime(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}

/* ---------- Deep links ---------- */
function getProfileDeepLink(url, platform) {
  if (!url) return "";
  if (platform.toLowerCase() === "instagram") {
    const m = url.match(/instagram\.com\/([^/?#]+)/i);
    const username = m && m[1] && !["p", "reel", "tv"].includes(m[1].toLowerCase()) ? m[1] : "";
    return username ? `instagram://user?username=${username}` : "instagram://app";
  }
  if (platform.toLowerCase() === "facebook") {
    return `fb://facewebmodal/f?href=${encodeURIComponent(url)}`;
  }
  return "";
}

function getPostDeepLink(url, platform) {
  if (!url) return "";
  if (platform.toLowerCase() === "instagram") {
    const shortcode = (url.match(/instagram\.com\/(?:p|reel)\/([^/?#]+)/i) || [])[1];
    if (shortcode) return `instagram://p/${shortcode}`;
    return "instagram://app";
  }
  if (platform.toLowerCase() === "facebook") {
    return `fb://facewebmodal/f?href=${encodeURIComponent(url)}`;
  }
  return "";
}

function attemptOpenApp({ appUrl, webUrl }) {
  if (!appUrl) {
    window.open(webUrl, "_blank", "noopener");
    return;
  }
  const start = Date.now();
  window.location.href = appUrl;
  setTimeout(() => {
    if (document.visibilityState === "visible" && Date.now() - start > 1100) {
      window.open(webUrl, "_blank", "noopener");
      showToast("تم فتح رابط الويب كخطة بديلة. إذا كان التطبيق متاحًا غالبًا سيفتح مباشرة.");
    }
  }, 1200);
}

/* ---------- Overview ---------- */
function buildKpis() {
  const totalEngagement = DATA.posts.reduce((sum, p) => sum + p.engagement, 0);
  const topDoctor = [...DATA.doctors].sort((a, b) => b.totalEngagement - a.totalEngagement)[0];
  const topTopic = [...DATA.topicRecommendations].sort((a, b) => b.score - a.score)[0];

  const kpis = [
    { label: "إجمالي الأطباء", value: formatNumber(DATA.meta.totalDoctors) },
    { label: "إجمالي المنشورات", value: formatNumber(DATA.meta.totalPosts) },
    { label: "إجمالي التفاعل", value: formatNumber(totalEngagement) },
    { label: "أعلى موضوع طبي", value: topTopic ? topTopic.topic : "-" },
    { label: "أقوى حساب", value: topDoctor ? topDoctor.name : "-" },
  ];

  els.kpiGrid.innerHTML = kpis
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
    { label: "تفريغات غير مرتبطة", value: c.transcriptsUnmatched },
  ];
}

function renderCoverage() {
  const html = coverageItems()
    .map((i) => `<div class="coverage-item"><span class="coverage-value">${formatNumber(i.value)}</span><span class="coverage-label">${i.label}</span></div>`)
    .join("");
  if (els.coverageStrip) els.coverageStrip.innerHTML = html;
  if (els.vaultCoverageStrip) els.vaultCoverageStrip.innerHTML = html;
}

/* ---------- Doctors ---------- */
function renderDoctors() {
  const cards = DATA.doctors.map((doctor) => {
    const metaChips = [
      `<span class="chip">منشورات: ${formatNumber(doctor.postCount)}</span>`,
      `<span class="chip">تفاعل: ${formatNumber(doctor.totalEngagement)}</span>`,
    ];
    if (doctor.followers) metaChips.push(`<span class="chip">متابعون: ${formatNumber(doctor.followers)}</span>`);
    if (doctor.transcriptCount) metaChips.push(`<span class="chip">تفريغات: ${formatNumber(doctor.transcriptCount)}</span>`);

    const accounts = doctor.accounts.length
      ? doctor.accounts
          .map((acc) => `
        <div class="account-row">
          <div class="account-head">
            <span class="account-platform">${escapeHtml(acc.platform)}</span>
            <span class="account-confidence">${escapeHtml(acc.confidence)}</span>
          </div>
          <div class="link-actions" data-url="${escapeHtml(acc.url)}" data-platform="${escapeHtml(acc.platform)}" data-type="profile">
            <button class="ghost-btn open-app" type="button">Open app</button>
            <a class="ghost-btn open-web" href="${escapeHtml(acc.url)}" target="_blank" rel="noopener noreferrer">Open web</a>
          </div>
        </div>
      `)
          .join("")
      : `<div class="account-row"><span class="account-confidence">لا توجد روابط حسابات مؤكدة لهذا الطبيب في ملف الكيانات.</span></div>`;

    const linkedPosts = DATA.posts
      .filter((p) => p.account === doctor.name)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 8)
      .map((p) => `<li>#${p.rank} • <span class="chip">${escapeHtml(p.platform)}</span> ${escapeHtml(p.topicAudio)} <span class="muted">(${formatNumber(p.engagement)} تفاعل)</span></li>`)
      .join("");

    const linkedBlock = doctor.postCount
      ? `<details class="sub-details"><summary>أفضل المنشورات المرتبطة (${formatNumber(doctor.postCount)})</summary><ul class="linked-posts">${linkedPosts}</ul></details>`
      : `<p class="muted">لا توجد منشورات فيروسية لهذا الحساب ضمن فترة الرصد.</p>`;

    const photo = doctor.image
      ? `<img class="doctor-photo" src="${escapeHtml(doctor.image)}" alt="${escapeHtml(doctor.name)}" loading="lazy" referrerpolicy="no-referrer" />`
      : `<div class="doctor-avatar" aria-hidden="true">${initials(doctor.name)}</div>`;

    return `
      <article class="doctor-card">
        <div class="doctor-head">
          ${photo}
          <div class="doctor-info">
            <div class="doctor-name">${escapeHtml(doctor.name)}</div>
            <div class="doctor-spec">${escapeHtml(doctor.specializations.join(" • "))}</div>
          </div>
        </div>
        <div class="meta-row doctor-summary-metrics">${metaChips.join("")}</div>
        <details class="doctor-details">
          <summary>عرض الحسابات والتفاصيل (${doctor.accounts.length})</summary>
          <div class="details-content">
            ${accounts}
            ${linkedBlock}
          </div>
        </details>
      </article>
    `;
  });

  els.doctorsGrid.innerHTML = cards.join("");
}

/* ---------- Posts ---------- */
function postMatchesFilters(post) {
  if (state.platform !== "all" && post.platform !== state.platform) return false;
  if (state.doctor !== "all" && post.account !== state.doctor) return false;
  if (state.topic !== "all" && post.topicAudio !== state.topic) return false;
  if (state.transcript === "yes" && !post.transcript) return false;
  if (state.transcript === "no" && post.transcript) return false;
  if (!state.search) return true;
  const q = state.search.toLowerCase();
  return (
    post.account.toLowerCase().includes(q) ||
    (post.topicAudio || "").toLowerCase().includes(q) ||
    (post.topicCaption || "").toLowerCase().includes(q) ||
    (post.caption || "").toLowerCase().includes(q) ||
    (post.transcript && post.transcript.text ? post.transcript.text.toLowerCase().includes(q) : false)
  );
}

function comparePosts(a, b) {
  const key = state.sortMetric;
  const primary = (b[key] || 0) - (a[key] || 0);
  if (primary !== 0) return primary;
  return a.rank - b.rank;
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
    </details>
  `;
}

function renderPosts() {
  const posts = DATA.posts.filter(postMatchesFilters).sort(comparePosts);

  if (els.postsCount) {
    els.postsCount.textContent = `عرض ${formatNumber(posts.length)} من ${formatNumber(DATA.posts.length)} منشور`;
  }

  if (!posts.length) {
    els.postsList.innerHTML = `<div class="post-card">لا توجد نتائج مطابقة للفلاتر الحالية.</div>`;
    return;
  }

  els.postsList.innerHTML = posts
    .map((p) => {
      const tThumb = p.transcript && p.transcript.thumbnail
        ? `<img class="post-thumb" src="${escapeHtml(p.transcript.thumbnail)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
        : "";
      const tBadge = p.transcript ? `<span class="chip chip-accent">تفريغ متاح</span>` : "";
      return `
    <article class="post-card">
      <div class="post-top">
        <div>
          <div class="post-title">${escapeHtml(p.account)} <span class="chip">${escapeHtml(p.platform)}</span> ${tBadge}</div>
          <div class="post-subtitle">${escapeHtml(p.date)} • الموضوع: ${escapeHtml(p.topicAudio)}</div>
        </div>
        <span class="rank-badge">#${p.rank}</span>
      </div>

      <div class="post-body">
        ${tThumb}
        <div class="post-summary-metrics">
          <span class="chip">التفاعل: ${formatNumber(p.engagement)}</span>
          <span class="chip">المشاهدات: ${formatNumber(p.views)}</span>
        </div>
      </div>

      <details class="post-details">
        <summary>عرض التفاصيل</summary>
        <div class="details-content">
          <div class="metrics">
            <div class="metric"><div class="m-label">الإعجابات</div><div class="m-value">${formatNumber(p.likes)}</div></div>
            <div class="metric"><div class="m-label">التعليقات</div><div class="m-value">${formatNumber(p.comments)}</div></div>
            <div class="metric"><div class="m-label">المشاركات</div><div class="m-value">${formatNumber(p.shares)}</div></div>
            <div class="metric"><div class="m-label">المتابعون</div><div class="m-value">${formatNumber(p.followers)}</div></div>
          </div>
          <div class="topic-tags">
            ${p.topicSource === "caption"
              ? `<span class="chip">الموضوع (من الكابشن): ${escapeHtml(p.topicCaption)}</span>`
              : `<span class="chip">موضوع الصوت: ${escapeHtml(p.topicAudio)}</span><span class="chip">موضوع الكابشن: ${escapeHtml(p.topicCaption)}</span>`}
          </div>
          <p class="caption">${escapeHtml(p.caption) || "(لا يوجد نص متاح)"}</p>
          ${transcriptBlock(p)}
          <div class="link-actions" data-url="${escapeHtml(p.postUrl)}" data-platform="${escapeHtml(p.platform)}" data-type="post">
            <button class="ghost-btn open-app" type="button">Open app</button>
            <a class="ghost-btn open-web" href="${escapeHtml(p.postUrl)}" target="_blank" rel="noopener noreferrer">Open web</a>
          </div>
        </div>
      </details>
    </article>
  `;
    })
    .join("");
}

/* ---------- Topics ---------- */
function renderTopics() {
  els.topicsList.innerHTML = DATA.topicRecommendations
    .map((t) => {
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
        <p class="topic-note">${escapeHtml(t.suggestion)}</p>
        ${(t.examples || []).map((ex) => `<p class="topic-note">مثال: ${escapeHtml(ex)}</p>`).join("")}
        ${evidence ? `<details class="sub-details"><summary>المنشورات الداعمة لهذا الموضوع</summary><ul class="linked-posts">${evidence}</ul></details>` : ""}
      </article>
    `;
    })
    .join("");

  if (els.topicAuditTable) {
    els.topicAuditTable.innerHTML = DATA.topicAudit
      .map((t) => `<tr><td>${escapeHtml(t.topic)}</td><td>${formatNumber(t.posts)}</td><td>${formatNumber(t.engagement)}</td></tr>`)
      .join("");
  }
}

/* ---------- Data Vault ---------- */
function rowMatchesVault(text) {
  if (!state.vaultSearch) return true;
  return text.toLowerCase().includes(state.vaultSearch.toLowerCase());
}

function renderVault() {
  const posts = DATA.raw.posts;
  const entities = DATA.raw.entities;
  const topics = DATA.raw.topics;
  const transcripts = DATA.raw.transcripts;

  if (els.vaultPostsCount) els.vaultPostsCount.textContent = formatNumber(posts.length);
  if (els.vaultEntitiesCount) els.vaultEntitiesCount.textContent = formatNumber(entities.length);
  if (els.vaultTopicsCount) els.vaultTopicsCount.textContent = formatNumber(topics.length);
  if (els.vaultTranscriptsCount) els.vaultTranscriptsCount.textContent = formatNumber(transcripts.length);

  if (els.vaultPostsTable) {
    els.vaultPostsTable.innerHTML = DATA.posts
      .filter((p) => rowMatchesVault(`${p.account} ${p.platform} ${p.topicAudio} ${p.topicCaption} ${p.caption} ${p.transcript ? p.transcript.text : ""}`))
      .map((p) => `<tr>
        <td>${p.rank}</td>
        <td>${escapeHtml(p.account)}</td>
        <td>${escapeHtml(p.platform)}</td>
        <td>${escapeHtml(p.date)}</td>
        <td>${escapeHtml(p.topicAudio)}</td>
        <td>${formatNumber(p.engagement)}</td>
        <td>${formatNumber(p.views)}</td>
        <td>${p.transcript ? "✓" : "—"}</td>
      </tr>`)
      .join("");
  }

  if (els.vaultEntitiesTable) {
    els.vaultEntitiesTable.innerHTML = entities
      .filter((e) => rowMatchesVault(Object.values(e).join(" ")))
      .map((e) => `<tr>
        <td>${escapeHtml(e.Name)}</td>
        <td>${escapeHtml(e.Specialization)}</td>
        <td>${escapeHtml(e.Platform)}</td>
        <td>${escapeHtml(e.Confidence)}</td>
        <td><a href="${escapeHtml(e.URL)}" target="_blank" rel="noopener noreferrer">رابط</a></td>
      </tr>`)
      .join("");
  }

  if (els.vaultTopicsTable) {
    els.vaultTopicsTable.innerHTML = topics
      .filter((t) => rowMatchesVault(t.topic))
      .map((t) => `<tr><td>${escapeHtml(t.topic)}</td><td>${formatNumber(t.posts)}</td><td>${formatNumber(t.engagement)}</td></tr>`)
      .join("");
  }

  if (els.vaultTranscriptsList) {
    els.vaultTranscriptsList.innerHTML = transcripts
      .filter((t) => rowMatchesVault(`${t.title} ${t.description} ${t.text} ${t.videoUrl}`))
      .map((t) => {
        const segs = (t.segments || [])
          .map((s) => `<div class="seg"><span class="seg-time">${formatTime(s.start)}</span><span class="seg-text">${escapeHtml(s.text)}</span></div>`)
          .join("");
        const thumb = t.thumbnail
          ? `<img class="post-thumb" src="${escapeHtml(t.thumbnail)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
          : "";
        return `
        <article class="vault-transcript">
          <div class="post-body">
            ${thumb}
            <div>
              <div class="post-title">${escapeHtml(t.title) || "(بدون عنوان)"}</div>
              <div class="post-subtitle">${formatTime(t.duration)} دقيقة • <a href="${escapeHtml(t.videoUrl)}" target="_blank" rel="noopener noreferrer">المصدر</a></div>
            </div>
          </div>
          <details class="transcript-block">
            <summary>عرض التفريغ (${(t.segments || []).length} مقطع)</summary>
            <p class="transcript-full">${escapeHtml(t.text)}</p>
            <div class="segments">${segs}</div>
          </details>
        </article>`;
      })
      .join("");
  }
}

/* ---------- Filter option population ---------- */
function populateFilters() {
  const doctors = [...new Set(DATA.posts.map((p) => p.account))].sort();
  doctors.forEach((d) => {
    const o = document.createElement("option");
    o.value = d;
    o.textContent = d;
    els.doctorFilter.appendChild(o);
  });

  const topics = [...new Set(DATA.posts.map((p) => p.topicAudio))].sort();
  topics.forEach((t) => {
    const o = document.createElement("option");
    o.value = t;
    o.textContent = t;
    els.topicFilter.appendChild(o);
  });
}

/* ---------- Events ---------- */
function setupEvents() {
  els.sortMetric.addEventListener("change", (e) => {
    state.sortMetric = e.target.value;
    renderPosts();
  });
  els.platformFilter.addEventListener("change", (e) => {
    state.platform = e.target.value;
    renderPosts();
  });
  els.doctorFilter.addEventListener("change", (e) => {
    state.doctor = e.target.value;
    renderPosts();
  });
  els.topicFilter.addEventListener("change", (e) => {
    state.topic = e.target.value;
    renderPosts();
  });
  els.transcriptFilter.addEventListener("change", (e) => {
    state.transcript = e.target.value;
    renderPosts();
  });
  els.searchInput.addEventListener("input", (e) => {
    state.search = e.target.value.trim();
    renderPosts();
  });

  if (els.vaultSearch) {
    els.vaultSearch.addEventListener("input", (e) => {
      state.vaultSearch = e.target.value.trim();
      renderVault();
    });
  }

  function closeMobileSidebar() {
    if (els.sidebar) els.sidebar.classList.remove("is-open");
    if (els.sidebarOverlay) els.sidebarOverlay.classList.remove("is-open");
  }

  els.navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = btn.dataset.page;
      els.navBtns.forEach((b) => b.classList.toggle("is-active", b === btn));
      Object.entries(els.pages).forEach(([key, panel]) => {
        if (panel) panel.classList.toggle("is-active", key === page);
      });
      closeMobileSidebar();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  if (els.menuToggle) {
    els.menuToggle.addEventListener("click", () => {
      els.sidebar.classList.add("is-open");
      els.sidebarOverlay.classList.add("is-open");
    });
  }
  if (els.closeSidebar) els.closeSidebar.addEventListener("click", closeMobileSidebar);
  if (els.sidebarOverlay) els.sidebarOverlay.addEventListener("click", closeMobileSidebar);

  document.body.addEventListener("click", (event) => {
    const btn = event.target.closest(".open-app");
    if (!btn) return;
    const wrapper = btn.closest(".link-actions");
    if (!wrapper) return;
    const webUrl = wrapper.dataset.url;
    const platform = wrapper.dataset.platform || "";
    const type = wrapper.dataset.type || "post";
    const appUrl = type === "profile" ? getProfileDeepLink(webUrl, platform) : getPostDeepLink(webUrl, platform);
    attemptOpenApp({ appUrl, webUrl });
  });
}

function init() {
  buildKpis();
  renderCoverage();
  renderDoctors();
  populateFilters();
  renderPosts();
  renderTopics();
  renderVault();
  setupEvents();
}

init();
