(function () {
  var script = document.currentScript;
  if (!script) return;

  var room = script.getAttribute("data-room") || "town-square";
  var theme = script.getAttribute("data-theme") || "dark";
  var compact = script.getAttribute("data-compact") || "false";
  var header = script.getAttribute("data-header") || "true";
  var limit = script.getAttribute("data-limit") || "50";
  var width = script.getAttribute("data-width") || "100%";
  var height = script.getAttribute("data-height") || "600";

  var base = script.src.replace(/\/embed\.js.*$/, "");
  var url = base + "/embed/" + encodeURIComponent(room) +
    "?theme=" + theme +
    "&compact=" + compact +
    "&header=" + header +
    "&limit=" + limit;

  var container = document.createElement("div");
  container.style.width = width;
  container.style.maxWidth = "100%";

  var iframe = document.createElement("iframe");
  iframe.src = url;
  iframe.style.width = "100%";
  iframe.style.height = /^\d+$/.test(height) ? height + "px" : height;
  iframe.style.border = "none";
  iframe.style.borderRadius = "8px";
  iframe.setAttribute("frameborder", "0");
  iframe.setAttribute("allowtransparency", "true");

  container.appendChild(iframe);
  script.parentNode.insertBefore(container, script.nextSibling);
})();
