/* =====================================================
   📱 MOBILE.JS (FULL FIXED VERSION)
   Works with your existing index.html
   Fixes:
   ✅ Login / Lock screen centered
   ✅ Full iframe mobile height
   ✅ Mobile hamburger toggle
   ✅ Sidebar menu for reports
   ✅ Better topbar mobile UX
   ✅ No effect on desktop
===================================================== */

(function () {

  /* =====================================
     INIT
  ===================================== */
  document.addEventListener("DOMContentLoaded", () => {
    if (window.innerWidth <= 768) {
      initMobileUI();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth <= 768) {
      initMobileUI();
    }
  });

  /* =====================================
     MAIN INIT
  ===================================== */
  function initMobileUI() {

    fixBody();
    fixTopbar();
    fixIframe();
    fixLockScreen();
    createMobileToggle();
    createMobileSidebar();
    syncButtons();
  }

  /* =====================================
     BODY FIX
  ===================================== */
  function fixBody() {
    document.body.style.overflow = "hidden";
    document.body.style.height = "100vh";
  }

  /* =====================================
     TOPBAR FIX
  ===================================== */
  function fixTopbar() {

    const topbar = document.querySelector(".topbar");
    const navWrap = document.querySelector(".nav-wrap");
    const more = document.querySelector(".more");

    if (!topbar) return;

    topbar.style.height = "56px";
    topbar.style.padding = "0";
    topbar.style.position = "fixed";
    topbar.style.top = "0";
    topbar.style.left = "0";
    topbar.style.right = "0";
    topbar.style.zIndex = "999";

    const inner = document.querySelector(".bar-inner");

    if (inner) {
      inner.style.height = "56px";
      inner.style.padding = "0 12px";
      inner.style.display = "flex";
      inner.style.alignItems = "center";
    }

    if (navWrap) navWrap.style.display = "none";
    if (more) more.style.display = "none";

    const user = document.getElementById("welcomeUser");
    if (user) {
      user.style.fontSize = "13px";
      user.style.marginLeft = "45px";
      user.style.whiteSpace = "nowrap";
      user.style.overflow = "hidden";
      user.style.textOverflow = "ellipsis";
      user.style.maxWidth = "130px";
    }
  }

  /* =====================================
     IFRAME FULL HEIGHT
  ===================================== */
  function fixIframe() {

    const stage = document.querySelector(".stage");
    const frame = document.getElementById("frame");

    if (stage) {
      stage.style.position = "fixed";
      stage.style.top = "56px";
      stage.style.left = "0";
      stage.style.right = "0";
      stage.style.bottom = "0";
      stage.style.height = "calc(100vh - 56px)";
      stage.style.overflow = "hidden";
    }

    if (frame) {
      frame.style.width = "100%";
      frame.style.height = "100%";
      frame.style.border = "0";
    }
  }

  /* =====================================
     LOCK SCREEN CENTER FIX
  ===================================== */
  function fixLockScreen() {

    const lock = document.getElementById("lockScreen");
    if (!lock) return;

    lock.style.display = "none";

    const observer = new MutationObserver(() => {

      if (lock.style.display === "flex") {

        lock.style.justifyContent = "center";
        lock.style.alignItems = "center";
        lock.style.padding = "18px";

        const box = lock.children[0];

        if (box) {
          box.style.width = "100%";
          box.style.maxWidth = "340px";
          box.style.margin = "0 auto";
        }
      }
    });

    observer.observe(lock, {
      attributes: true,
      attributeFilter: ["style"]
    });
  }

  /* =====================================
     MOBILE TOGGLE BUTTON
  ===================================== */
  function createMobileToggle() {

    if (document.getElementById("mobileMenuBtn")) return;

    const btn = document.createElement("button");

    btn.id = "mobileMenuBtn";
    btn.innerHTML = "☰";

    btn.style.position = "fixed";
    btn.style.top = "10px";
    btn.style.left = "10px";
    btn.style.zIndex = "1001";
    btn.style.width = "36px";
    btn.style.height = "36px";
    btn.style.border = "0";
    btn.style.borderRadius = "10px";
    btn.style.background = "rgba(255,255,255,.08)";
    btn.style.color = "white";
    btn.style.fontSize = "18px";
    btn.style.backdropFilter = "blur(10px)";

    btn.onclick = toggleSidebar;

    document.body.appendChild(btn);
  }

  /* =====================================
     SIDEBAR MENU
  ===================================== */
  function createMobileSidebar() {

    if (document.getElementById("mobileSidebar")) return;

    const side = document.createElement("div");
    side.id = "mobileSidebar";

    side.style.position = "fixed";
    side.style.top = "0";
    side.style.left = "-280px";
    side.style.width = "260px";
    side.style.height = "100vh";
    side.style.background = "#0f172a";
    side.style.zIndex = "1002";
    side.style.transition = "0.3s";
    side.style.padding = "16px";
    side.style.overflowY = "auto";
    side.style.boxShadow = "0 0 25px rgba(0,0,0,.4)";

    side.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <div style="font-size:18px;font-weight:700;color:white;">
          📊 Reports
        </div>
        <button onclick="toggleSidebar()"
          style="background:none;border:0;color:white;font-size:22px;">✕</button>
      </div>

      <div id="mobileMenuList"></div>
    `;

    document.body.appendChild(side);

    /* Overlay */
    const ov = document.createElement("div");
    ov.id = "mobileOverlay";

    ov.style.position = "fixed";
    ov.style.inset = "0";
    ov.style.background = "rgba(0,0,0,.45)";
    ov.style.zIndex = "1001";
    ov.style.display = "none";

    ov.onclick = toggleSidebar;

    document.body.appendChild(ov);
  }

  /* =====================================
     SYNC REPORT BUTTONS
  ===================================== */
  function syncButtons() {

    const box = document.getElementById("mobileMenuList");
    if (!box) return;

    box.innerHTML = "";

    const buttons = [
      ...document.querySelectorAll(".btn"),
      ...document.querySelectorAll(".menu-item")
    ];

    buttons.forEach(btn => {

      const clone = document.createElement("button");

      clone.innerHTML = btn.innerHTML;
      clone.style.width = "100%";
      clone.style.padding = "12px";
      clone.style.marginBottom = "10px";
      clone.style.border = "0";
      clone.style.borderRadius = "12px";
      clone.style.background = "rgba(255,255,255,.06)";
      clone.style.color = "white";
      clone.style.textAlign = "left";
      clone.style.fontSize = "15px";

      clone.onclick = () => {
        btn.click();
        toggleSidebar();
      };

      box.appendChild(clone);
    });
  }

  /* =====================================
     TOGGLE
  ===================================== */
  window.toggleSidebar = function () {

    const side = document.getElementById("mobileSidebar");
    const ov = document.getElementById("mobileOverlay");

    if (!side) return;

    const open = side.style.left === "0px";

    if (open) {
      side.style.left = "-280px";
      ov.style.display = "none";
    } else {
      side.style.left = "0";
      ov.style.display = "block";
    }
  };

})();
