window.MRDeepLinks = (function () {
  const { showToast } = window.MRUtils;

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

  function bindOpenAppButtons(root) {
    (root || document).querySelectorAll(".open-app").forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => {
        const wrapper = btn.closest(".link-actions") || btn;
        const webUrl = wrapper.dataset.url;
        if (!webUrl) return;
        const platform = wrapper.dataset.platform || "";
        const type = wrapper.dataset.type || "post";
        const appUrl = type === "profile"
          ? getProfileDeepLink(webUrl, platform)
          : getPostDeepLink(webUrl, platform);
        attemptOpenApp({ appUrl, webUrl });
      });
    });
  }

  return { bindOpenAppButtons, getProfileDeepLink, getPostDeepLink, attemptOpenApp };
})();
