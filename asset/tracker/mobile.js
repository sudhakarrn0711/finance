/* =====================================================
   📱 MOBILE.JS (FINAL WORKING + ENHANCED)
   Based on your ORIGINAL working version
   Added:
   ✅ Hamburger always visible
   ✅ Screen fit fix
   ✅ Login center perfect
   ✅ Finance tracker mobile optimize
   ✅ todo.html optimize
   ✅ Better resize support
   ✅ No desktop effect
===================================================== */

(function () {
  "use strict";

  let initialized = false;

  /* =====================================
     INIT
  ===================================== */
  document.addEventListener("DOMContentLoaded", boot);
  window.addEventListener("resize", debounce(boot, 250));
  window.addEventListener("orientationchange", boot);

  function boot() {
    if (window.innerWidth > 768) return;
    initMobileUI();
  }

  /* =====================================
     MAIN
  ===================================== */
  function initMobileUI() {
    injectCSS();
    fixBody();
    fixTopbar();
    fixIframe();
    fixLockScreen();
    createMobileToggle();
    createMobileSidebar();
    syncButtons();
    optimizeFinanceTracker();
    optimizeTodo();

    initialized = true;
  }

  /* =====================================
     CSS
  ===================================== */
  function injectCSS() {
    if (document.getElementById("mobileFixCSS")) return;

    const style = document.createElement("style");
    style.id = "mobileFixCSS";

    style.innerHTML = `
    @media(max-width:768px){

      html,body{
        margin:0 !important;
        padding:0 !important;
        width:100% !important;
        height:100% !important;
        overflow:hidden !important;
      }

      *{
        box-sizing:border-box !important;
      }

      /* iframe pages */
      iframe{
        width:100% !important;
        height:100% !important;
      }

      /* finance tracker */
      .grid,
      .summary-grid,
      .summary-cards{
        grid-template-columns:1fr !important;
      }

      table{
        min-width:720px !important;
      }

      .glass-card,
      .overflow-x-auto{
        overflow-x:auto !important;
        -webkit-overflow-scrolling:touch;
      }

      input,select,textarea,button{
        font-size:16px !important;
        min-height:44px !important;
      }

      /* todo page */
      main{
        padding:10px !important;
      }

      aside{
        margin-bottom:12px !important;
      }

      #modalContent{
        width:95% !important;
        max-height:90vh !important;
      }

      canvas{
        max-width:100% !important;
        height:auto !important;
      }

    }`;

    document.head.appendChild(style);
  }

  /* =====================================
     BODY FIX
  ===================================== */
  function fixBody() {
    document.body.style.margin = "0";
    document.body.style.height = "100vh";
    document.body.style.overflow = "hidden";
  }

  /* =====================================
     TOPBAR FIX
  ===================================== */
  function fixTopbar() {
    const topbar = document.querySelector(".topbar");
    if (!topbar) return;

    topbar.style.position = "fixed";
    topbar.style.top = "0";
    topbar.style.left = "0";
    topbar.style.right = "0";
    topbar.style.height = "56px";
    topbar.style.zIndex = "999";
    topbar.style.padding = "0";

    const inner = document.querySelector(".bar-inner");
    if (inner) {
      inner.style.height = "56px";
      inner.style.display = "flex";
      inner.style.alignItems = "center";
      inner.style.padding = "0 12px";
    }

    const navWrap = document.querySelector(".nav-wrap");
    const more = document.querySelector(".more");

    if (navWrap) navWrap.style.display = "none";
    if (more) more.style.display = "none";

    const user = document.getElementById("welcomeUser");
    if (user) {
      user.style.marginLeft = "46px";
      user.style.maxWidth = "140px";
      user.style.fontSize = "13px";
      user.style.whiteSpace = "nowrap";
      user.style.overflow = "hidden";
      user.style.textOverflow = "ellipsis";
    }
  }

  /* =====================================
     IFRAME FIX
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
      stage.style.width = "100%";
      stage.style.overflow = "hidden";
    }

    if (frame) {
      frame.style.width = "100%";
      frame.style.height = "100%";
      frame.style.border = "0";
    }
  }

  /* =====================================
     LOGIN CENTER
  ===================================== */
  function fixLockScreen() {
    const lock = document.getElementById("lockScreen");
    if (!lock) return;

    const apply = () => {
      const visible =
        lock.style.display === "flex" ||
        getComputedStyle(lock).display === "flex";

      if (!visible) return;

      lock.style.position = "fixed";
      lock.style.inset = "0";
      lock.style.display = "flex";
      lock.style.justifyContent = "center";
      lock.style.alignItems = "center";
      lock.style.padding = "16px";
      lock.style.zIndex = "9999";

      const box = lock.firstElementChild;
      if (box) {
        box.style.width = "100%";
        box.style.maxWidth = "340px";
        box.style.margin = "0 auto";
      }
    };

    apply();

    new MutationObserver(apply).observe(lock, {
      attributes: true,
      attributeFilter: ["style", "class"]
    });
  }

  /* =====================================
     HAMBURGER
  ===================================== */
  function createMobileToggle() {
    if (document.getElementById("mobileMenuBtn")) return;

    const btn = document.createElement("button");
    btn.id = "mobileMenuBtn";
    btn.innerHTML = "☰";

    Object.assign(btn.style, {
      position: "fixed",
      top: "10px",
      left: "10px",
      width: "36px",
      height: "36px",
      border: "0",
      borderRadius: "10px",
      background: "rgba(255,255,255,.12)",
      color: "#fff",
      fontSize: "18px",
      zIndex: "2001",
      cursor: "pointer",
      backdropFilter: "blur(10px)"
    });

    btn.onclick = toggleSidebar;
    document.body.appendChild(btn);
  }

  /* =====================================
     SIDEBAR
  ===================================== */
  function createMobileSidebar() {
    if (document.getElementById("mobileSidebar")) return;

    const side = document.createElement("div");
    side.id = "mobileSidebar";

    Object.assign(side.style, {
      position: "fixed",
      top: "0",
      left: "-280px",
      width: "260px",
      height: "100vh",
      background: "#0f172a",
      zIndex: "2002",
      transition: ".3s",
      padding: "16px",
      overflowY: "auto",
      boxShadow: "0 0 25px rgba(0,0,0,.4)"
    });

    side.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <div style="font-size:18px;font-weight:700;color:#fff;">📊 Menu</div>
        <button onclick="toggleSidebar()" style="background:none;border:0;color:#fff;font-size:22px;">✕</button>
      </div>
      <div id="mobileMenuList"></div>
    `;

    document.body.appendChild(side);

    const ov = document.createElement("div");
    ov.id = "mobileOverlay";

    Object.assign(ov.style, {
      position: "fixed",
      inset: "0",
      background: "rgba(0,0,0,.45)",
      display: "none",
      zIndex: "2001"
    });

    ov.onclick = toggleSidebar;
    document.body.appendChild(ov);
  }

  /* =====================================
     MENU BUTTONS
  ===================================== */
  function syncButtons() {
    const box = document.getElementById("mobileMenuList");
    if (!box) return;

    box.innerHTML = "";

    const items = [
      ...document.querySelectorAll(".btn"),
      ...document.querySelectorAll(".menu-item")
    ];

    items.forEach(btn => {
      const txt = btn.innerText.trim();
      if (!txt) return;

      const clone = document.createElement("button");
      clone.innerText = txt;

      Object.assign(clone.style, {
        width: "100%",
        padding: "12px",
        marginBottom: "10px",
        border: "0",
        borderRadius: "12px",
        background: "rgba(255,255,255,.06)",
        color: "#fff",
        textAlign: "left",
        fontSize: "15px"
      });

      clone.onclick = function () {
        btn.click();
        toggleSidebar();
      };

      box.appendChild(clone);
    });
  }

  /* =====================================
     FINANCE TRACKER
  ===================================== */
  function optimizeFinanceTracker() {
    document.querySelectorAll("canvas").forEach(c => {
      c.style.maxWidth = "100%";
      c.style.height = "auto";
    });
  }

  /* =====================================
     TODO PAGE
  ===================================== */
  function optimizeTodo() {
    const task = document.getElementById("taskList");
    if (task) task.style.paddingBottom = "80px";
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
      syncButtons();
      side.style.left = "0";
      ov.style.display = "block";
    }
  };

  /* =====================================
     DEBOUNCE
  ===================================== */
  function debounce(fn, ms) {
    let t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

})();
