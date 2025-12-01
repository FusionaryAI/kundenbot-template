(function () {
  var script = document.currentScript;
  var slug = script?.dataset?.slug;
  var origin = script?.dataset?.origin || window.location.origin;
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
  btn.className = "pa-btn";
  btn.setAttribute("aria-label","Chat");
  btn.textContent = "💬";
  wrap.appendChild(btn);
  document.body.appendChild(wrap);

  var frame = document.createElement("iframe");
  frame.className = "pa-panel";
  frame.src = origin.replace(/\/$/,"") + "/embed/" + encodeURIComponent(slug);
  frame.allow = "clipboard-read; clipboard-write";
  frame.style.background = "transparent";
  document.body.appendChild(frame);

  var open = false;
  btn.onclick = function(){
    open = !open;
    frame.style.display = open ? "block" : "none";
  };

  window.addEventListener("message", function(ev){
    var data = ev.data || {};
    if (data.type === "__widget_height__") {
      var h = Math.min(640, Math.max(420, data.height || 500));
      frame.style.height = h + "px";
    }
  });
})();
