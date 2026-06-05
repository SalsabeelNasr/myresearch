/* Unified cross-vertical sidebar used on every page.
   Call MRSidebar.init({ current, root }) where:
     current = "home" | "gastro" | "nutrition" | "libyan-clinic"
     root    = "" for the home page, "../" for pages inside a vertical folder
   It renders #sidebar, wires the mobile drawer, and exposes
   setActivePage(page) + closeMobileSidebar(). */
window.MRSidebar = (function () {
  const VERTICALS = [
    {
      id: "gastro",
      title: "الجهاز الهضمي",
      badge: { text: "متاح", cls: "badge-live" },
      available: true,
      pages: [
        ["dashboard", "نظرة عامة"],
        ["doctors", "الأطباء والحسابات"],
        ["posts", "المنشورات الأكثر انتشاراً"],
        ["topics", "المواضيع المقترحة"],
        ["vault", "مخزن البيانات"],
      ],
    },
    {
      id: "nutrition",
      title: "التغذية",
      badge: { text: "لسه بنجمعها", cls: "badge-soon" },
      available: true,
      pages: [
        ["dashboard", "نظرة عامة"],
        ["doctors", "الأطباء والحسابات"],
        ["posts", "المنشورات الأكثر انتشاراً"],
        ["topics", "المواضيع المقترحة"],
        ["benchmark", "ترتيبنا مقابل السوق"],
        ["vault", "مخزن البيانات"],
      ],
    },
    {
      id: "libyan-clinic",
      title: "العيادة الليبية",
      badge: { text: "قريباً", cls: "badge-soon" },
      available: false,
      pages: [["", "الصفحة الرئيسية"]],
    },
  ];

  let ctx = { current: "home", root: "" };
  let navHandle = null;

  function hrefFor(v, page) {
    if (v.id === ctx.current) {
      return v.available && page ? `#${page}` : `#`;
    }
    const base = `${ctx.root}${v.id}/index.html`;
    return page ? `${base}#${page}` : base;
  }

  function groupHtml(v) {
    const isCurrent = v.id === ctx.current;
    const open = isCurrent || (ctx.current === "home" && v.id === "gastro");
    const links = v.pages
      .map(([page, label]) => `<a class="nav-sub" data-page="${page}" data-vertical="${v.id}" href="${hrefFor(v, page)}">${label}</a>`)
      .join("");
    return `
      <details class="nav-group${isCurrent ? " is-current" : ""}"${open ? " open" : ""}>
        <summary class="nav-group-title">
          <span>${v.title}</span>
          <span class="nav-group-meta"><span class="badge ${v.badge.cls}">${v.badge.text}</span></span>
        </summary>
        <div class="nav-sub-list">${links}</div>
      </details>`;
  }

  function render() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    const homeLink = ctx.current === "home"
      ? ""
      : `<a class="back-home" href="${ctx.root}index.html">← الصفحة الرئيسية</a>`;
    sidebar.innerHTML = `
      <button class="close-sidebar" id="closeSidebar" aria-label="إغلاق القائمة">✕</button>
      <div class="sidebar-header">
        ${homeLink}
        <p class="eyebrow">Market Research</p>
        <a class="sidebar-home-title" href="${ctx.root}index.html">نتائج بحث السوق</a>
      </div>
      <nav class="side-nav" aria-label="Main menu">
        ${VERTICALS.map(groupHtml).join("")}
      </nav>`;

    sidebar.querySelectorAll(".nav-sub").forEach((a) => {
      a.addEventListener("click", () => closeMobileSidebar());
    });
  }

  function setActivePage(page) {
    document.querySelectorAll(".nav-sub").forEach((a) => {
      const active = a.dataset.vertical === ctx.current && a.dataset.page === page;
      a.classList.toggle("is-active", active);
    });
  }

  function closeMobileSidebar() {
    navHandle?.closeMobileSidebar?.();
  }

  function init(options) {
    ctx = Object.assign({ current: "home", root: "" }, options || {});
    render();
    navHandle = window.MRNav.setupMobileSidebar();
    return { setActivePage, closeMobileSidebar };
  }

  return { init, render, setActivePage, closeMobileSidebar };
})();
