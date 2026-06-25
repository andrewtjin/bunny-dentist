/* Warren Wellness — "THE HACK" countdown + lockout overlay.
   ---------------------------------------------------------------------------
   Story: the moment the player cracks the access code, the Institute begins
   TRACING them. A red breach-countdown rides over every page (navigation still
   works — the overlay is pointer-events:none). When the trace completes, a
   full-screen lockout takes over ("SYSTEM HACKED…"), then a part-2 teaser rises.

   State lives in sessionStorage so it survives page-to-page navigation:
     wwi_hack_end   ms timestamp when the trace finishes (set once, on first hack)
     wwi_hack_done  "1" after the lockout has fired (stays locked on every page)

   Duration comes from window.__WWI_OPTS__.countdownSeconds (config.json), default 120.

   OPERATOR: to re-arm for the next player, open the console and run:
        __WWI_HACK__.reset()
   (clears the countdown + the unlock, returns to the login gate).
   --------------------------------------------------------------------------- */
(function () {
  "use strict";
  var SS = window.sessionStorage;
  var K_END = "wwi_hack_end";
  var K_DONE = "wwi_hack_done";
  var K_SESSION = "wwi_session_key"; // set by crypto-boot once unlocked
  var DURATION = (((window.__WWI_OPTS__ || {}).countdownSeconds) || 120) * 1000;
  var tick = null;

  /* ---------- SVG: evil, corrupted version of the WWI bunny mark ---------- */
  var EVIL_LOGO =
    '<svg viewBox="0 0 64 64" aria-hidden="true">' +
    '<defs><filter id="wwiEvilGlow" x="-50%" y="-50%" width="200%" height="200%">' +
    '<feDropShadow dx="0" dy="0" stdDeviation="1.7" flood-color="#ff1330" flood-opacity="0.95"/></filter></defs>' +
    '<g filter="url(#wwiEvilGlow)">' +
    '<ellipse cx="22" cy="12" rx="5.5" ry="12" fill="#2a0708" stroke="#ff2138" stroke-width="2.4"/>' +
    '<ellipse cx="42" cy="12" rx="5.5" ry="12" fill="#2a0708" stroke="#ff2138" stroke-width="2.4"/>' +
    '<ellipse cx="22" cy="13" rx="2.2" ry="7" fill="#7c0f20"/><ellipse cx="42" cy="13" rx="2.2" ry="7" fill="#7c0f20"/>' +
    '<path d="M32 24c-10 0-16 7-16 18 0 9 5 16 9 16 3 0 4-3 7-3s4 3 7 3c4 0 9-7 9-16 0-11-6-18-16-18z" fill="#170406" stroke="#ff2138" stroke-width="2.4"/>' +
    '<path d="M20 36 L31 41 L21 44 Z" fill="#ff2a3e"/><path d="M44 36 L33 41 L43 44 Z" fill="#ff2a3e"/>' +
    '<path d="M24 49 L27 54 L30 49 L33 54 L36 49 L39 54 L41 49" fill="none" stroke="#ff2a3e" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<path d="M33 25 L30 31 L34 35 L31 40" fill="none" stroke="#ff2138" stroke-width="1" opacity="0.75"/>' +
    '</g></svg>';

  /* ---------- SVG: the big red bunny skull (skull + crossbones) ---------- */
  var SKULL =
    '<svg viewBox="0 0 240 268" aria-hidden="true">' +
    '<defs>' +
    '<radialGradient id="wwiSkull" cx="50%" cy="34%" r="74%">' +
    '<stop offset="0%" stop-color="#ff5a6e"/><stop offset="50%" stop-color="#dc1430"/><stop offset="100%" stop-color="#7a091b"/></radialGradient>' +
    '<filter id="wwiSkullGlow" x="-45%" y="-45%" width="190%" height="190%">' +
    '<feDropShadow dx="0" dy="0" stdDeviation="6.5" flood-color="#ff0a2a" flood-opacity="0.92"/></filter>' +
    '</defs>' +
    '<g filter="url(#wwiSkullGlow)" stroke="#43060f" stroke-width="2">' +
    // crossed bones behind (long, so the ends clearly poke past the skull)
    '<g fill="#cf1430">' +
    '<g transform="rotate(43 120 150)"><rect x="6" y="141" width="228" height="17" rx="8.5"/>' +
    '<circle cx="13" cy="141" r="10"/><circle cx="13" cy="158" r="10"/><circle cx="227" cy="141" r="10"/><circle cx="227" cy="158" r="10"/></g>' +
    '<g transform="rotate(-43 120 150)"><rect x="6" y="141" width="228" height="17" rx="8.5"/>' +
    '<circle cx="13" cy="141" r="10"/><circle cx="13" cy="158" r="10"/><circle cx="227" cy="141" r="10"/><circle cx="227" cy="158" r="10"/></g>' +
    '</g>' +
    // skeletal ears
    '<g fill="url(#wwiSkull)">' +
    '<path d="M99 96 C86 62 86 26 98 10 C104 2 113 5 114 20 L114 96 Z"/>' +
    '<path d="M141 96 C154 62 154 26 142 10 C136 2 127 5 126 20 L126 96 Z"/></g>' +
    '<g fill="#5c0817" stroke="none">' +
    '<path d="M104 84 C95 58 95 32 102 20 C105 15 108 17 108 25 L108 84 Z"/>' +
    '<path d="M136 84 C145 58 145 32 138 20 C135 15 132 17 132 25 L132 84 Z"/></g>' +
    // cranium + cheeks + tapered jaw
    '<path fill="url(#wwiSkull)" d="M120 76 C166 76 186 112 181 152 C179 174 165 188 152 196 ' +
    'C152 208 147 217 138 217 C132 217 129 212 129 205 C123 207 117 207 111 205 ' +
    'C111 212 108 217 102 217 C93 217 88 208 88 196 C75 188 61 174 59 152 C54 112 74 76 120 76 Z"/>' +
    // big hollow eye sockets (with a faint red glint)
    '<g fill="#0b0207">' +
    '<path d="M92 112 C106 112 110 130 102 142 C96 150 82 150 78 138 C74 124 80 112 92 112 Z"/>' +
    '<path d="M148 112 C134 112 130 130 138 142 C144 150 158 150 162 138 C166 124 160 112 148 112 Z"/></g>' +
    '<circle cx="92" cy="135" r="4.3" fill="#ff2a40" stroke="none"/><circle cx="148" cy="135" r="4.3" fill="#ff2a40" stroke="none"/>' +
    // nasal cavity (inverted notch)
    '<path fill="#0b0207" d="M120 150 C116 158 112 162 113 168 C114 173 118 174 120 171 C122 174 126 173 127 168 C128 162 124 158 120 150 Z"/>' +
    // teeth: two big bunny incisors + small side teeth
    '<g fill="#ffd9df" stroke="#43060f" stroke-width="1.5">' +
    '<rect x="110" y="196" width="9" height="25" rx="3"/><rect x="121" y="196" width="9" height="25" rx="3"/>' +
    '<rect x="96" y="198" width="7" height="13" rx="2"/><rect x="137" y="198" width="7" height="13" rx="2"/></g>' +
    '</g></svg>';

  /* ---------- styles (injected once) ---------- */
  var CSS = [
    '.wwi-alert{position:fixed;inset:0;z-index:9000;pointer-events:none}',
    '.wwi-alert::before{content:"";position:absolute;inset:0;',
    'box-shadow:inset 0 0 0 5px #e60023, inset 0 0 80px 10px rgba(230,0,35,.42);',
    'background:radial-gradient(120% 85% at 50% 50%, transparent 56%, rgba(150,0,18,.30) 100%);',
    'animation:wwiPulse 1.5s ease-in-out infinite}',
    '.wwi-alert__bar{position:absolute;top:0;left:50%;transform:translateX(-50%);display:flex;flex-wrap:wrap;gap:6px 12px;',
    'align-items:center;justify-content:center;text-align:center;',
    'font-family:"Cascadia Mono","Consolas","Courier New",monospace;font-weight:700;letter-spacing:1.4px;',
    'color:#fff;background:linear-gradient(180deg,rgba(150,0,18,.97),rgba(112,0,14,.85));',
    'padding:6px 16px 7px;font-size:12.5px;text-transform:uppercase;border:1px solid rgba(255,60,80,.5);border-top:none;',
    'border-radius:0 0 8px 8px;box-shadow:0 0 20px rgba(230,0,35,.7);animation:wwiPulse 1.5s ease-in-out infinite;max-width:96vw}',
    '.wwi-alert__dot{width:10px;height:10px;border-radius:50%;background:#ff2a40;box-shadow:0 0 10px #ff2a40;flex:0 0 auto;animation:wwiBlink 1s steps(2) infinite}',
    '.wwi-alert__msg{white-space:nowrap}',
    '.wwi-alert__time{font-size:14px;background:#11020a;color:#ff5566;padding:1px 8px;border:1px solid #ff2a40;border-radius:3px;flex:0 0 auto}',
    '.wwi-alert.is-critical .wwi-alert__bar{animation:wwiBlink .5s steps(2) infinite}',
    '.wwi-alert.is-critical .wwi-alert__time{color:#fff;background:#c20f28}',
    '@keyframes wwiPulse{0%,100%{opacity:.55}50%{opacity:1}}',
    '@keyframes wwiBlink{0%,100%{opacity:1}50%{opacity:.25}}',

    '.wwi-lock{position:fixed;inset:0;z-index:9999;pointer-events:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;',
    'text-align:center;padding:24px 18px;overflow:hidden;',
    'background:radial-gradient(circle at 50% 38%, #2c0208 0%, #11000a 58%, #000 100%);',
    'font-family:"Cascadia Mono","Consolas","Courier New",monospace;color:#ff3146;animation:wwiLockIn .3s ease-out}',
    '.wwi-lock::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.16;',
    'background:repeating-linear-gradient(0deg,transparent 0 2px,rgba(255,40,60,.55) 2px 3px);animation:wwiScan 7s linear infinite}',
    '.wwi-lock__logos{display:flex;flex-direction:column;align-items:center;gap:0;z-index:1}',
    '.wwi-lock__evil{width:78px;height:78px;display:block;filter:drop-shadow(0 0 9px rgba(255,20,40,.85));animation:wwiThrob 2.2s ease-in-out infinite}',
    '.wwi-lock__skull{width:min(54vw,300px);height:auto;display:block;margin-top:2px;animation:wwiThrob 2.5s ease-in-out infinite}',
    '.wwi-lock__title{font-size:clamp(24px,5.5vw,50px);font-weight:800;letter-spacing:4px;color:#ff2336;margin:8px 0 4px;z-index:1;',
    'text-shadow:0 0 20px rgba(255,20,40,.85),2px 0 #00e5ff,-2px 0 #ff0044;animation:wwiGlitch 2.4s steps(2) infinite}',
    '.wwi-lock__sub{font-size:clamp(13px,2.5vw,21px);letter-spacing:2px;line-height:1.75;color:#ff6b79;max-width:780px;z-index:1;',
    'text-shadow:0 0 11px rgba(255,20,40,.6)}',
    '.wwi-lock__sub b{color:#fff;text-shadow:0 0 14px rgba(255,255,255,.5)}',
    '.wwi-lock__congrats{position:absolute;left:0;right:0;bottom:0;z-index:2;transform:translateY(115%);',
    'transition:transform 1.15s cubic-bezier(.18,.85,.25,1);padding:20px 16px 26px;',
    'background:linear-gradient(0deg,#0a1712 60%,rgba(10,23,18,0))}',
    '.wwi-lock__congrats.is-revealed{transform:translateY(0)}',
    '.wwi-lock__congrats .c1{font-family:Georgia,"Times New Roman",serif;font-size:clamp(17px,3.2vw,28px);color:#ffe6a6;',
    'text-shadow:0 0 14px rgba(255,205,95,.6)}',
    '.wwi-lock__congrats .c2{font-size:clamp(11px,2.1vw,15px);color:#bdeede;letter-spacing:1px;margin-top:7px}',
    '@keyframes wwiLockIn{from{opacity:0}to{opacity:1}}',
    '@keyframes wwiThrob{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}',
    '@keyframes wwiScan{from{background-position:0 0}to{background-position:0 100%}}',
    '@keyframes wwiGlitch{0%,100%{text-shadow:0 0 20px rgba(255,20,40,.85),2px 0 #00e5ff,-2px 0 #ff0044}50%{text-shadow:0 0 20px rgba(255,20,40,.85),-2px 0 #00e5ff,2px 0 #ff0044}}',
    '@media (prefers-reduced-motion:reduce){.wwi-alert::before,.wwi-alert__bar,.wwi-alert__dot,.wwi-lock,.wwi-lock::before,.wwi-lock__evil,.wwi-lock__skull,.wwi-lock__title{animation:none!important}}'
  ].join("");

  function injectCSS() {
    if (document.getElementById("wwi-hack-css")) return;
    var s = document.createElement("style");
    s.id = "wwi-hack-css";
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ---------- helpers ---------- */
  function getEnd() { var v = parseInt(SS.getItem(K_END), 10); return isNaN(v) ? 0 : v; }
  function isDone() { return SS.getItem(K_DONE) === "1"; }
  function hacked() { return !!SS.getItem(K_SESSION) || !!getEnd(); }
  function arm() { if (!getEnd() && !isDone()) { try { SS.setItem(K_END, String(Date.now() + DURATION)); } catch (e) {} } }
  function fmt(ms) {
    var t = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(t / 60), s = t % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  /* ---------- the non-blocking breach overlay ---------- */
  function overlayEl() {
    var el = document.getElementById("wwi-alert");
    if (el) return el;
    el = document.createElement("div");
    el.id = "wwi-alert";
    el.className = "wwi-alert";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML =
      '<div class="wwi-alert__bar">' +
      '<span class="wwi-alert__dot"></span>' +
      '<span class="wwi-alert__msg">SECURITY BREACH · TRACE ACTIVE</span>' +
      '<span class="wwi-alert__msg">LOCKDOWN IN</span>' +
      '<span class="wwi-alert__time">--:--</span></div>';
    document.body.appendChild(el);
    return el;
  }
  function paint() {
    var rem = getEnd() - Date.now();
    if (rem <= 0) { lockout(); return; }
    var el = overlayEl();
    var t = el.querySelector(".wwi-alert__time");
    if (t) t.textContent = fmt(rem);
    el.classList.toggle("is-critical", rem <= 15000);
  }
  function startTick() {
    if (tick) clearInterval(tick);
    paint();
    tick = setInterval(paint, 250);
  }

  /* ---------- the terminal lockout screen ---------- */
  function lockout(opts) {
    opts = opts || {};
    if (tick) { clearInterval(tick); tick = null; }
    try { SS.setItem(K_DONE, "1"); } catch (e) {}
    var alert = document.getElementById("wwi-alert");
    if (alert) alert.parentNode.removeChild(alert);
    if (document.getElementById("wwi-lock")) return;
    injectCSS();
    var lock = document.createElement("div");
    lock.id = "wwi-lock";
    lock.className = "wwi-lock";
    lock.setAttribute("role", "alertdialog");
    lock.setAttribute("aria-live", "assertive");
    lock.innerHTML =
      '<div class="wwi-lock__logos">' +
      '<span class="wwi-lock__evil">' + EVIL_LOGO + '</span>' +
      '<span class="wwi-lock__skull">' + SKULL + '</span></div>' +
      '<div class="wwi-lock__title">SYSTEM HACKED</div>' +
      '<div class="wwi-lock__sub">THE DOCTOR HAS BEEN ALERTED.<br>YOU WILL BE FOUND.<br><b>RESISTANCE IS FUTILE.</b></div>' +
      '<div class="wwi-lock__congrats" id="wwi-congrats">' +
      '<div class="c1">Congrats on finishing part 1!</div>' +
      '<div class="c2">Come back at 8 months for part 2!!</div></div>';
    document.body.appendChild(lock);
    try { window.scrollTo(0, 0); } catch (e) {}
    var delay = opts.now ? 200 : 2000;
    setTimeout(function () {
      var c = document.getElementById("wwi-congrats");
      if (c) c.classList.add("is-revealed");
    }, delay);
  }

  /* ---------- wiring ---------- */
  function refresh() {
    injectCSS();
    if (isDone()) { lockout({ now: true }); return; }
    if (hacked()) { arm(); startTick(); }
  }
  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }
  // appears the instant the code is cracked (same page, no navigation)
  document.addEventListener("wwi:revealed", function () { arm(); refresh(); });
  // and re-attaches on every page load while a hack is in progress
  onReady(refresh);

  /* ---------- operator / test API ---------- */
  window.__WWI_HACK__ = {
    start: function (sec) { try { SS.setItem(K_END, String(Date.now() + (sec || 120) * 1000)); SS.removeItem(K_DONE); } catch (e) {} startTick(); },
    lockout: function () { lockout({ now: true }); },
    reset: function () {
      try { SS.removeItem(K_END); SS.removeItem(K_DONE); SS.removeItem(K_SESSION); } catch (e) {}
      var a = document.getElementById("wwi-alert"); if (a) a.remove();
      var l = document.getElementById("wwi-lock"); if (l) l.remove();
      location.href = "index.html";
    },
    state: function () { return { end: getEnd(), remaining: Math.max(0, getEnd() - Date.now()), done: isDone(), hacked: hacked() }; }
  };
})();
