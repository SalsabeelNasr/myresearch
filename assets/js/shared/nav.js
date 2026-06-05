window.MRNav = (function () {
  function setupMobileSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    const menuToggle = document.getElementById("menuToggle");
    const closeSidebar = document.getElementById("closeSidebar");

    function close() {
      sidebar?.classList.remove("is-open");
      overlay?.classList.remove("is-open");
    }

    menuToggle?.addEventListener("click", () => {
      sidebar?.classList.add("is-open");
      overlay?.classList.add("is-open");
    });
    closeSidebar?.addEventListener("click", close);
    overlay?.addEventListener("click", close);

    return { closeMobileSidebar: close };
  }

  return { setupMobileSidebar };
})();
