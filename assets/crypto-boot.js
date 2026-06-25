/* Warren Wellness — client-side decryptor.
   This file is PUBLIC. Knowing how it works does not help without the password.
   Content is AES-GCM-256; key derived from the password via PBKDF2-SHA256 (200k). */
(function () {
  "use strict";
  var B = window.__WWI__ || {};
  var SS_KEY = "wwi_session_key";
  function b64dec(s){ return Uint8Array.from(atob(s), function (c){ return c.charCodeAt(0); }); }
  function b64enc(u8){ var s=""; for (var i=0;i<u8.length;i++) s+=String.fromCharCode(u8[i]); return btoa(s); }
  function $(id){ return document.getElementById(id); }

  function wireSignout(){
    var b = document.querySelector(".signout");
    if (b) b.addEventListener("click", function () {
      try { sessionStorage.removeItem(SS_KEY); } catch (e) {}
      location.href = "index.html";
    });
  }
  function reveal(html){
    var c = $("content");
    c.innerHTML = html;
    $("gate").hidden = true;
    c.hidden = false;
    document.body.classList.remove("locked");
    document.body.classList.add("unlocked");
    window.scrollTo(0, 0);
    wireSignout();
  }
  async function decryptWith(key){
    var pt = await crypto.subtle.decrypt({ name:"AES-GCM", iv:b64dec(B.iv) }, key, b64dec(B.ct));
    return new TextDecoder().decode(pt);
  }
  async function keyFromPassword(pw){
    var base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name:"PBKDF2", salt:b64dec(B.salt), iterations:200000, hash:"SHA-256" },
      base, { name:"AES-GCM", length:256 }, true, ["decrypt"]);
  }
  async function keyFromStored(raw64){
    return crypto.subtle.importKey("raw", b64dec(raw64), { name:"AES-GCM" }, true, ["decrypt"]);
  }

  async function boot(){
    if (!window.crypto || !crypto.subtle) {
      $("gate").hidden = false;
      $("gate-error").textContent = "This browser blocks secure decryption. Open over https (GitHub Pages) or http://localhost.";
      return;
    }
    var stored = null; try { stored = sessionStorage.getItem(SS_KEY); } catch (e) {}
    if (stored) {
      try { var k = await keyFromStored(stored); reveal(await decryptWith(k)); return; } catch (e) {}
    }
    $("gate").hidden = false;
    var form = $("gate-form");
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var errEl = $("gate-error"); errEl.textContent = "";
      var btn = form.querySelector("button"); var old = btn.textContent;
      btn.textContent = "Checking…"; btn.disabled = true;
      try {
        var key = await keyFromPassword($("gate-pw").value);
        var html = await decryptWith(key);               // throws if the password is wrong (GCM auth fails)
        var raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
        try { sessionStorage.setItem(SS_KEY, b64enc(raw)); } catch (e) {}
        reveal(html);
      } catch (err) {
        errEl.textContent = "ACCESS DENIED — invalid code.";
        $("gate-pw").value = ""; $("gate-pw").focus();
      } finally {
        btn.textContent = old; btn.disabled = false;
      }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
