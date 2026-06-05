window.VERTICAL_CONFIG = {
  id: "nutrition",
  title: "التغذية",
  pages: {
    dashboard: { title: "نظرة عامة — التغذية", shortTitle: "التغذية" },
    doctors: { title: "الأطباء والحسابات — التغذية", shortTitle: "الأطباء" },
    posts: { title: "المنشورات الفيروسية — التغذية", shortTitle: "المنشورات" },
    topics: { title: "المواضيع المقترحة — التغذية", shortTitle: "المواضيع" },
    vault: { title: "مخزن البيانات — التغذية", shortTitle: "مخزن البيانات" },
  },
  dashboardHtml: `
<section class="hero card">
  <h2>نظرة سريعة: قطاع التغذية العلاجية وإنقاص الوزن</h2>
  <p>مؤشرات البحث وتغطية البيانات في مكان واحد — كل صف مجمّع سيُحفظ بالكامل في «مخزن البيانات». لما تجهز ملفات المصدر، شغّل <code>python3 build_data.py</code> داخل مجلد nutrition.</p>
  <div class="kpi-grid" id="kpiGrid"></div>
</section>

<section class="card methodology-card">
  <h2>خطة جمع البيانات (نفس منهجية الجهاز الهضمي)</h2>
  <div class="methodology-step">
    <h3>1. التحقق من الحسابات</h3>
    <p>أطباء وعيادات التغذية العلاجية وإنقاص الوزن في مصر — فيسبوك وإنستجرام، بحث عربي + إنجليزي، ثقة HIGH فقط.</p>
  </div>
  <div class="methodology-step">
    <h3>2. كشط آخر 90 يوم</h3>
    <p>Apify: caption، تاريخ، likes، comments، shares، views، followers، post URL.</p>
  </div>
  <div class="methodology-step">
    <h3>3. تصنيف المواضيع</h3>
    <p>من الكابشن ثم من تفريغ الصوت للفيديوهات — مواضيع زي: مقاومة الأنسولين، الكبد الدهني، PCOS، القولون، السكري، الصيام، ما بعد التكميم، إلخ.</p>
  </div>
  <div class="methodology-highlight">
    <h3>الحالة الحالية</h3>
    <p>البيانات <strong>قيد الجمع</strong>. الصفحات جاهزة وستُعبّأ تلقائياً عند إضافة ملفات المصدر.</p>
  </div>
</section>`,
};
