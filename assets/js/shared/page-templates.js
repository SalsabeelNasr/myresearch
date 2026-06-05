/* Shared page markup for all verticals (doctors, posts, topics, vault).
   Embedded as strings so the site works from file:// without a server.
   The dashboard page is provided per-vertical via VERTICAL_CONFIG.dashboardHtml. */
window.MRPageTemplates = {
  doctors: `
<section class="card" aria-labelledby="doctorsHeading">
  <div class="section-head">
    <h3 id="doctorsHeading">الأطباء والحسابات اللي تم تحليلها</h3>
    <p>المصادر: ملف البيانات + تقرير الانتشار</p>
  </div>
  <div class="toolbar">
    <label>
      رتب حسب
      <select id="doctorSortMetric">
        <option value="overall">وسيط التفاعل — الإجمالي (كل المنصّات)</option>
        <option value="ig">وسيط التفاعل — إنستجرام</option>
        <option value="fb">وسيط التفاعل — فيسبوك</option>
        <option value="tt">وسيط التفاعل — تيك توك</option>
        <option value="followers">عدد المتابعين (إنستجرام)</option>
        <option value="postCount">المنشورات الأكثر انتشاراً</option>
      </select>
    </label>
  </div>
  <div id="doctorsGrid" class="doctors-grid"></div>
</section>

<section class="card" aria-labelledby="competitorsHeading" id="competitorsSection">
  <div class="section-head">
    <h3 id="competitorsHeading">منافسون محتملون — لم يُحلّلوا بعد (<span id="competitorsCount"></span>)</h3>
    <p>حسابات أضفتها كمنافسين محتملين بس لسه متعملّهمش تحليل عميق (ماصرفناش رصيد Apify على كشط محتواهم). معروضين هنا منفصلين عشان أرقام التحليل تفضل دقيقة. كل حساب وروابطه على المنصّات المختلفة تحت بعض.</p>
  </div>
  <div id="competitorsGrid" class="doctors-grid"></div>
</section>

<section class="card" aria-labelledby="excludedHeading" id="excludedSection">
  <div class="section-head">
    <h3 id="excludedHeading">مستبعدون من التحليل (<span id="excludedCount"></span>)</h3>
    <p>حسابات موجودة في القائمة الأصلية بس استبعدناها من التحليل عشان <strong>خارج تخصص التغذية/التخسيس</strong> (تجميل، جلدية، جهاز هضمي) أو <strong>خارج السوق المصري</strong>. بنعرضها هنا للشفافية (التقرير = مصدر واحد للحقيقة) بس أرقامها مش داخلة في أي ترتيب أو مقارنة.</p>
  </div>
  <div id="excludedGrid" class="doctors-grid"></div>
</section>`,

  posts: `
<section class="card" aria-labelledby="postsHeading">
  <div class="section-head section-head--stacked">
    <h3 id="postsHeading">الأكثر انتشاراً — آخر 90 يوم <span class="posts-title-count" id="postsCount"></span></h3>
  </div>
  <div class="toolbar">
    <select id="sortMetric" aria-label="رتب حسب">
      <option value="engagement">إجمالي التفاعل</option>
      <option value="views">المشاهدات</option>
      <option value="likes">الإعجابات</option>
      <option value="comments">التعليقات</option>
    </select>
  </div>
  <div id="postsList" class="posts-list"></div>
</section>`,

  evergreen: `
<section class="card">
  <div class="section-head">
    <h3>فيروسي بشكل عام — أقدم من 90 يوم (كل المنصّات) 🏆 <span class="posts-title-count" id="evergreenCount"></span></h3>
    <p style="color:var(--muted);font-size:0.85rem;margin-top:0.3rem">أقوى المنشورات <strong>الأقدم من 90 يوم</strong> على إنستجرام + فيسبوك + تيك توك (الأحدث موجود في صفحة «آخر 90 يوم»). مرتّبة بـ<strong>نقاط الوصول</strong> = إعجابات + تعليقات×2 + مشاركات×3 + مشاهدات×0.05، وكل منشور بمقاييسه التفصيلية.</p>
  </div>
  <div class="table-wrap">
    <table class="data-table sortable" id="evergreenTable">
      <thead><tr><th>#</th><th>الحساب</th><th>المنصة</th><th>نقاط الوصول</th><th>التفاعل</th><th>❤ إعجابات</th><th>💬 تعليقات</th><th>🔁 مشاركات</th><th>👁 مشاهدات</th><th>التاريخ</th><th>الموضوع</th><th>النوع</th><th data-no-sort="1">الرابط</th></tr></thead>
      <tbody></tbody>
    </table>
  </div>
</section>`,

  topics: `
<section class="card" aria-labelledby="topicsHeading">
  <div class="section-head">
    <h3 id="topicsHeading">مواضيع مقترحة لصناعة المحتوى</h3>
    <p>المواضيع الطبية اللي نقدر ننتج زيها، مرتّبة بحيث <strong>المواضيع المثبتة الأول</strong>. علامة <strong>✅ مثبت بـ N حساب</strong> معناها إن الموضوع ده اتعملّه فيرال من <strong>N حساب مستقل</strong> عبر إنستجرام وتيك توك — كل ما العدد أكبر، الموضوع أضمن (مش مجرد ضربة حظ لحساب واحد). كل موضوع معاه <strong>أقوى مثال حقيقي</strong> (بالرابط) و<strong>عدد المنشورات الفيرالية</strong> فيه.</p>
  </div>
  <div id="topicsList" class="topics-list"></div>
</section>

<section class="card" aria-labelledby="pinnedTopicsHeading">
  <div class="section-head">
    <h3 id="pinnedTopicsHeading">مواضيع دايمة (Evergreen) فرصة نجاحها كبيرة</h3>
    <p>دي مواضيع المنشورات المثبتة، وهي اختيار أصحاب الحسابات لأفضل محتوى عندهم، وبتعتبر مرشحات قوية لمحتوى بيفضل جذاب للجمهور لفترة طويلة.</p>
  </div>
  <div id="pinnedTopicsList" class="topics-list"></div>
</section>

<section class="card" aria-labelledby="topicAuditHeading">
  <details class="audit-details">
    <summary>
      <span id="topicAuditHeading">مراجعة كاملة للمواضيع (بناءً على موضوع الصوت)</span>
    </summary>
    <div class="details-content">
      <p class="results-count">عرض كل البيانات الخاصة بملخص المواضيع بدون استثناء، عشان نضمن إن مفيش معلومة تضيع.</p>
      <div class="table-wrap">
        <table class="data-table" id="topicAuditTable">
          <thead><tr><th>الموضوع</th><th>عدد المنشورات</th><th>التفاعل</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  </details>
</section>`,

  benchmark: `
<section class="card benchmark-intro">
  <div class="section-head">
    <h3>ترتيبنا مقابل السوق 🎯</h3>
  </div>
  <div id="benchmarkBusiness"></div>
</section>

<section class="card">
  <div class="section-head">
    <h3>ترتيب كل الحسابات المُحلَّلة + موقعنا 🎯</h3>
    <p>نفس حجمنا = (8–45 ألف متابع). اختر المنصّة للترتيب حسب وسيط التفاعل عليها.</p>
  </div>
  <div class="toolbar">
    <label>
      المنصّة
      <select id="benchmarkPlatform">
        <option value="overall">الإجمالي (إنستجرام + فيسبوك + تيك توك)</option>
        <option value="ig">إنستجرام</option>
        <option value="fb">فيسبوك</option>
        <option value="tt">تيك توك</option>
      </select>
    </label>
  </div>
  <div class="table-wrap">
    <table class="data-table sortable" id="benchmarkPeersTable">
      <thead><tr><th>#</th><th>الحساب</th><th>الطبقة</th><th>متابعين</th><th>وسيط التفاعل</th><th>متوسط ⚠️</th><th>نشر/شهر</th><th>× تفاعلنا</th><th>ملاحظة</th></tr></thead>
      <tbody></tbody>
    </table>
  </div>
  <p class="peers-foot" id="benchmarkPeersFoot"></p>
</section>

<section class="card">
  <div class="section-head">
    <h3>قوالب محتوى مثبتة نقدر نكرّرها ✅</h3>
    <p>دي منشورات <strong>تعليمية</strong> من كل المنصّات (إنستجرام + تيك توك) مرتّبة بـ<strong>الفيرالية النسبية</strong> = تفاعل المنشور ÷ متوسط صاحب الحساب. منشور تجاوز متوسط صاحبه بـ <strong>×3 أو أكتر</strong> معناه إن <em>المحتوى نفسه</em> هو اللي اشتغل (مش حجم الحساب) — يعني قابل للتكرار عندنا. موضوع لكل قالب عشان تشكيلة متنوّعة في صميم تخصص العيادة (سكر/محليات، مقاومة الأنسولين، PCOS، إبر GLP-1…).</p>
  </div>
  <div id="benchmarkReachable" class="reach-grid"></div>
</section>

<section class="card benchmark-strategy">
  <div class="section-head"><h3>الخلاصة وخطة الوصول 🧭</h3></div>
  <div class="methodology-conclusion">
    <blockquote>
      الفجوة الحالية مش بسبب قلة المتابعين — هي بسبب <strong>نوع المحتوى</strong>. حسابنا حالياً شبه كله إعلانات وعروض للعيادة، والجمهور بيتفاعل مع <strong>المحتوى التعليمي</strong> اللي بيشرح معلومة بتهمّه. كل الحسابات اللي فوقنا بتعمل ريلز تعليمية بهوك فضول في أول 3 ثواني.
    </blockquote>
  </div>
  <div class="methodology-step">
    <h3>الخطوات العملية:</h3>
    <ul>
      <li><strong>حوّل النسبة:</strong> بدل ٩٠٪ إعلانات، اعمل ٨٠٪ محتوى تعليمي (ريلز) + ٢٠٪ عروض. التعليمي هو اللي بيوصل وبيبني ثقة قبل ما يحجز.</li>
      <li><strong>كرّر القوالب الواقعية اللي فوق:</strong> ابدأ بمواضيع طبقتي «ناشئ ومتوسّط» (إبر التخسيس، مقاومة الأنسولين، PCOS، مقارنة النشويات) — دي أهداف قابلة للوصول خلال شهور، مش حسابات المليون متابع.</li>
      <li><strong>الشكل:</strong> ريلز رأسي، هوك فضول في أول جملة، شرح بنقاط، وخاتمة آمنة «تحت إشراف طبي» (التزام كامل بحائط الامتثال — من غير وعود بنتائج مضمونة).</li>
      <li><strong>اللهجة:</strong> عامية مصرية بسيطة وودودة (زي كل الحسابات الناجحة في القايمة — الجمهور مصري) — المشكلة مش في اللهجة، المشكلة في الأسلوب الإعلاني. حوّل النبرة من «إعلان عيادة» لـ«دكتور بيشرح معلومة بتهمّك».</li>
      <li><strong>الهدف الأول:</strong> الخروج من «تحت خط المنافسة» للطبقة «ناشئ» (٢٠٠+ تفاعل/منشور) — ده يحتاج تقريباً ×٤٠ من المتوسط الحالي، وبيتحقق بتغيير نوع المحتوى مش بالإعلانات.</li>
    </ul>
  </div>
</section>`,

  vault: `
<section class="card">
  <div class="section-head">
    <h3>مخزن البيانات الشامل</h3>
    <p>كل البيانات زي ما اتجمعت من المصادر بدون أي تعديل أو حذف. تقدر تستخدم البحث عشان توصل للي محتاجه بسرعة.</p>
  </div>
  <div class="coverage-strip" id="vaultCoverageStrip"></div>
  <label class="vault-search-label">
    ابحث في كل البيانات
    <input id="vaultSearch" type="search" placeholder="ابحث في المنشورات، الحسابات، المواضيع، أو النصوص..." />
  </label>
</section>

<section class="card">
  <details class="audit-details" open>
    <summary><span>المنشورات الخام (<span id="vaultPostsCount"></span>)</span></summary>
    <div class="details-content">
      <div class="table-wrap">
        <table class="data-table" id="vaultPostsTable">
          <thead><tr><th>#</th><th>الحساب</th><th>المنصة</th><th>التاريخ</th><th>موضوع الصوت</th><th>التفاعل</th><th>المشاهدات</th><th>فيه نص؟</th><th>الرابط</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  </details>
</section>

<section class="card">
  <details class="audit-details">
    <summary><span>الحسابات والكيانات الخام (<span id="vaultEntitiesCount"></span>)</span></summary>
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
