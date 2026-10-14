(function () {
  var script = document.currentScript;
  var slug = script?.dataset?.slug;
  var origin = (script?.dataset?.origin || window.location.origin).replace(/\/$/, "");
  if (!slug) { console.warn("widget: missing data-slug"); return; }

  var style = document.createElement("style");
  style.textContent = `
  .pa-bubble{position:fixed; right:20px; bottom:20px; z-index:2147483000}
  .pa-btn{width:56px;height:56px;border-radius:50%;background:#2563eb;color:#fff;border:none;box-shadow:0 10px 25px rgba(0,0,0,.2);cursor:pointer;font:600 16px system-ui}
  .pa-panel{position:fixed; right:20px; bottom:90px; width:360px; max-width:calc(100vw - 40px); height:auto; border:0; box-shadow:0 10px 30px rgba(0,0,0,.2); border-radius:20px; overflow:hidden; display:none; z-index:2147483001}
  `;
  document.head.appendChild(style);

  var wrap = document.createElement("div");
  wrap.className = "pa-bubble";
  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pa-btn";
  // KI-VO Art. 50 Abs. 5: Der Hinweis auf den KI-Charakter muss auch
  // barrierefrei zugänglich sein — Screenreader-Nutzer erfahren ihn hier
  // bereits vor dem Öffnen des Chats.
  btn.setAttribute("aria-label", "Chat mit KI-Assistent öffnen");
  btn.setAttribute("aria-expanded", "false");
  btn.textContent = "💬";
  wrap.appendChild(btn);
  document.body.appendChild(wrap);

  // Datenschutz (DSGVO, § 25 TDDDG): Das Chat-Fenster wird erst nach dem Klick
  // geladen. Vorher baut die Seite keine Verbindung zum Chat-Server auf — außer
  // für dieses Skript selbst, wenn es nicht von der Kundendomain ausgeliefert wird.
  var frame = null;
  function createFrame() {
    frame = document.createElement("iframe");
    frame.className = "pa-panel";
    frame.title = "Chat mit KI-Assistent";
    frame.src = origin + "/embed/" + encodeURIComponent(slug);
    frame.allow = "clipboard-read; clipboard-write";
    frame.style.background = "transparent";
    document.body.appendChild(frame);
  }

  var open = false;
  btn.onclick = function () {
    if (!frame) createFrame();
    open = !open;
    frame.style.display = open ? "block" : "none";
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  };

  window.addEventListener("message", function (ev) {
    // Nur Nachrichten des eigenen Chat-Fensters auswerten.
    if (!frame || ev.source !== frame.contentWindow || ev.origin !== origin) return;
    var data = ev.data || {};
    if (data.type === "__widget_height__") {
      var h = Math.min(640, Math.max(420, data.height || 500));
      frame.style.height = h + "px";
    }
  });
})();
