/* Shared page markup for all verticals (doctors, posts, topics, vault).
   Embedded as strings so the site works from file:// without a server.
   The dashboard page is provided per-vertical via VERTICAL_CONFIG.dashboardHtml. */
window.MRPageTemplates = {
  doctors: `
<section class="card" aria-labelledby="doctorsHeading">
  <div class="section-head">
    <h3 id="doctorsHeading">الأطباء والحسابات المتاحة</h3>
    <p>المصادر: ملف الكيانات + تقرير الفيروسية</p>
  </div>
  <div id="doctorsGrid" class="doctors-grid"></div>
</section>`,

  posts: `
<section class="card" aria-labelledby="postsHeading">
  <div class="section-head">
    <h3 id="postsHeading">المنشورات الفيروسية</h3>
    <p>رتّب حسب أي مؤشر لقراءة الأنماط الأفضل أداءً</p>
  </div>
  <div class="toolbar">
    <label>
      ترتيب حسب
      <select id="sortMetric">
        <option value="engagement">التفاعل الكلي</option>
        <option value="views">المشاهدات</option>
        <option value="likes">الإعجابات</option>
        <option value="comments">التعليقات</option>
        <option value="shares">المشاركات</option>
      </select>
    </label>
    <label>
      بحث
      <input id="searchInput" type="search" placeholder="اسم طبيب، موضوع، منصة، أو نص التفريغ..." />
    </label>
  </div>
  <p class="results-count" id="postsCount"></p>
  <div id="postsList" class="posts-list"></div>
</section>`,

  topics: `
<section class="card" aria-labelledby="topicsHeading">
  <div class="section-head">
    <h3 id="topicsHeading">مواضيع مقترحة لإعادة الإنتاج</h3>
    <p>دي المواضيع <strong>الطبية القابلة لإعادة الإنتاج</strong> فقط، مرتبة حسب قوة النتائج (تفاعل + مشاهدات). استبعدنا الصفوف اللي مش مواضيع طبية (موسيقى/بدون كلام، صور بدون صوت، فيديوهات مش متفرّغة، ومحتوى تحفيزي/شخصي) عشان التوصية تبقى مبنية على محتوى ينفع تكرّره.</p>
  </div>
  <div id="topicsList" class="topics-list"></div>
</section>

<section class="card" aria-labelledby="topicAuditHeading">
  <details class="audit-details">
    <summary>
      <span id="topicAuditHeading">التدقيق الكامل للمواضيع (كل صفوف «By audio topic»)</span>
    </summary>
    <div class="details-content">
      <p class="results-count">عرض كل صفوف ملخص المواضيع من المصدر بدون استبعاد، عشان مفيش بيانات تضيع.</p>
      <div class="table-wrap">
        <table class="data-table" id="topicAuditTable">
          <thead><tr><th>الموضوع</th><th>عدد المنشورات</th><th>التفاعل</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  </details>
</section>`,

  vault: `
<section class="card">
  <div class="section-head">
    <h3>مخزن البيانات الكامل</h3>
    <p>كل البيانات الخام زي ما اتجمعت من المصادر، بدون أي حذف. استخدم البحث للوصول السريع.</p>
  </div>
  <div class="coverage-strip" id="vaultCoverageStrip"></div>
  <label class="vault-search-label">
    بحث في كل البيانات الخام
    <input id="vaultSearch" type="search" placeholder="ابحث في المنشورات، الحسابات، المواضيع، التفريغ..." />
  </label>
</section>

<section class="card">
  <details class="audit-details" open>
    <summary><span>المنشورات الخام (<span id="vaultPostsCount"></span>)</span></summary>
    <div class="details-content">
      <div class="table-wrap">
        <table class="data-table" id="vaultPostsTable">
          <thead><tr><th>#</th><th>الحساب</th><th>المنصة</th><th>التاريخ</th><th>موضوع الصوت</th><th>التفاعل</th><th>المشاهدات</th><th>تفريغ؟</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  </details>
</section>

<section class="card">
  <details class="audit-details">
    <summary><span>الحسابات/الكيانات الخام (<span id="vaultEntitiesCount"></span>)</span></summary>
    <div class="details-content">
      <div class="table-wrap">
        <table class="data-table" id="vaultEntitiesTable">
          <thead><tr><th>الاسم</th><th>التخصص</th><th>المنصة</th><th>الثقة</th><th>الرابط</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  </details>
</section>

<section class="card">
  <details class="audit-details">
    <summary><span>صفوف ملخص المواضيع الخام (<span id="vaultTopicsCount"></span>)</span></summary>
    <div class="details-content">
      <div class="table-wrap">
        <table class="data-table" id="vaultTopicsTable">
          <thead><tr><th>الموضوع</th><th>عدد المنشورات</th><th>التفاعل</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  </details>
</section>

<section class="card">
  <details class="audit-details">
    <summary><span>التفريغات الصوتية الكاملة (<span id="vaultTranscriptsCount"></span>)</span></summary>
    <div class="details-content" id="vaultTranscriptsList"></div>
  </details>
</section>`,
};
