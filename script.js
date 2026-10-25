(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };

  // Small helper: build an element with attributes and children.
  function el(tag, props, kids) {
    var n = document.createElement(tag), k;
    for (k in props || {}) {
      if (k === "text") n.textContent = props[k];
      else if (k === "class") n.className = props[k];
      else n.setAttribute(k, props[k]);
    }
    (kids || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }

  /* ---------- Task 1: sensor metrics -> alert table (map / filter / reduce) ---------- */
  var LIMITS = {
    "soil moisture": { warn: 70, crit: 85, unit: "%" },
    "air temperature": { warn: 34, crit: 40, unit: "°C" },
    "soil salinity": { warn: 2.5, crit: 4, unit: "dS/m" }
  };
  var PLOTS = ["Wheat plot A", "Rice paddy", "Orchard row 3", "Greenhouse 1"];

  function makeBatch() {
    var types = Object.keys(LIMITS);
    return Array.from({ length: 14 }, function (_, i) {
      var t = types[Math.floor(Math.random() * types.length)], L = LIMITS[t];
      return { id: "F-" + (100 + i), type: t, plot: PLOTS[i % PLOTS.length], value: +(L.warn * (0.6 + Math.random() * 0.6)).toFixed(1) };
    });
  }

  function processMetrics(readings) {
    var alerts = readings
      .filter(function (r) { return r.value >= LIMITS[r.type].warn; })
      .map(function (r) {
        var L = LIMITS[r.type];
        return {
          id: r.id, plot: r.plot, type: r.type,
          text: r.value + " " + L.unit, limit: L.warn + " " + L.unit,
          severity: r.value >= L.crit ? "critical" : "warning",
          over: +(r.value - L.warn).toFixed(1)
        };
      })
      .sort(function (a, b) { return b.over - a.over; });
    var totals = alerts.reduce(function (acc, a) { acc[a.severity] += 1; return acc; }, { critical: 0, warning: 0 });
    return { alerts: alerts, totals: totals, scanned: readings.length };
  }

  function renderAlerts(res) {
    var out = $("t1-out"), sum = $("t1-sum");
    out.textContent = ""; sum.textContent = "";
    if (!res.alerts.length) {
      out.appendChild(el("p", { text: "No readings above their limits." }));
    } else {
      var head = el("tr", {}, ["Sensor", "Plot", "Metric", "Reading", "Limit", "Severity"].map(function (h) {
        return el("th", { scope: "col", text: h });
      }));
      var body = el("tbody");
      res.alerts.forEach(function (a) {
        var cells = [a.id, a.plot, a.type, a.text, a.limit].map(function (v) { return el("td", { text: v }); });
        cells.push(el("td", { class: "sev-" + a.severity, text: a.severity }));
        body.appendChild(el("tr", {}, cells));
      });
      out.appendChild(el("table", {}, [el("thead", {}, [head]), body]));
    }
    [["Scanned", res.scanned], ["Critical", res.totals.critical], ["Warning", res.totals.warning]].forEach(function (p) {
      sum.appendChild(el("span", { class: "chip", text: p[0] + ": " + p[1] }));
    });
  }

  $("t1-run").addEventListener("click", function () { renderAlerts(processMetrics(makeBatch())); });
  renderAlerts(processMetrics(makeBatch()));

  /* ---------- Task 2: NodeIterator + TreeWalker over the field-node dashboard ---------- */
  var ZONES = {
    "North field": ["N-01", "N-02", "N-03"],
    "Irrigation": ["I-11", "I-12", "I-13"],
    "Grain store": ["G-21", "G-22"]
  };

  function buildDash() {
    var d = $("dash"); d.textContent = "";
    Object.keys(ZONES).forEach(function (z) {
      var zone = el("div", { class: "zone" }, [el("h3", { text: z })]);
      ZONES[z].forEach(function (id) {
        var off = id === "I-12" || id === "G-22";
        zone.appendChild(el("div", { class: "node", "data-status": off ? "offline" : "online" }, [
          el("div", { class: "meta" }, [el("strong", { text: id }), el("span", { class: "node-label", text: off ? "offline" : "online" })])
        ]));
      });
      d.appendChild(zone);
    });
  }

  function scanOffline() {
    var found = [];
    var it = document.createNodeIterator($("dash"), NodeFilter.SHOW_ELEMENT, {
      acceptNode: function (n) {
        return n.getAttribute("data-status") === "offline" ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    var n;
    while ((n = it.nextNode())) {
      n.style.background = "var(--red-bg)";
      n.style.borderColor = "var(--red)";
      n.classList.add("is-warning");
      n.setAttribute("aria-label", "Offline node");
      found.push(n);
    }
    found.forEach(function (node) {
      var tw = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT, {
        acceptNode: function (x) { return x.classList.contains("node-label") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP; }
      });
      while (tw.nextNode()) {
        tw.currentNode.textContent = "OFFLINE – check power and link";
        tw.currentNode.style.color = "var(--red)";
        tw.currentNode.style.fontWeight = "700";
      }
    });
    $("t2-msg").textContent = found.length + " offline node" + (found.length === 1 ? "" : "s") + " flagged.";
  }

  $("t2-scan").addEventListener("click", scanOffline);
  $("t2-reset").addEventListener("click", function () { buildDash(); $("t2-msg").textContent = ""; });
  $("t2-flip").addEventListener("click", function () {
    var online = $("dash").querySelectorAll('[data-status="online"]');
    if (!online.length) { $("t2-msg").textContent = "Every node is already offline."; return; }
    online[Math.floor(Math.random() * online.length)].setAttribute("data-status", "offline");
    $("t2-msg").textContent = "A node went offline. Run the scan to flag it.";
  });
  buildDash(); scanOffline();

  /* ---------- Task 3: event flow (capture / bubble) with cross-browser helpers ---------- */
  function on(node, type, fn, capture) {
    if (node.addEventListener) node.addEventListener(type, fn, !!capture);
    else if (node.attachEvent && !capture) node.attachEvent("on" + type, function (e) { fn.call(node, e); });
  }
  function norm(e) {
    e = e || window.event;
    return {
      raw: e,
      target: e.target || e.srcElement,
      stop: function () { if (e.stopPropagation) e.stopPropagation(); else e.cancelBubble = true; },
      prevent: function () { if (e.preventDefault) e.preventDefault(); else e.returnValue = false; }
    };
  }
  function nameOf(n) { return n.getAttribute ? (n.getAttribute("data-name") || n.tagName.toLowerCase()) : "document"; }
  function logLine(cls, phase, name) {
    var li = el("li", {}, [el("span", { class: cls, text: phase + " " }), el("span", { text: "on " }), el("span", { class: "tgt", text: name })]);
    var log = $("t3-log"); log.insertBefore(li, log.firstChild);
  }

  var YIELDS = [["Wheat", 72], ["Rice", 90], ["Maize", 55], ["Cotton", 40], ["Sugarcane", 83]];
  var bars = $("bars");
  YIELDS.forEach(function (d) {
    var link = el("a", { href: "https://example.com/crops/" + d[0].toLowerCase(), text: d[0], "data-name": "link" });
    bars.appendChild(el("div", { class: "bar", "data-name": "bar", "data-crop": d[0], "data-value": d[1], style: "height:" + d[1] + "%" }, [link]));
  });

  ["chart", "bars"].forEach(function (id) {
    var node = $(id);
    on(node, "click", function () { logLine("cap", "capture ↓", nameOf(node)); }, true);
    on(node, "click", function () { logLine("bub", "bubble ↑", nameOf(node)); }, false);
  });

  // Delegated handler: block link navigation, read the targeted bar's data.
  on(bars, "click", function (e) {
    var ev = norm(e), t = ev.target;
    if (t.tagName && t.tagName.toLowerCase() === "a") ev.prevent();
    var bar = t.closest ? t.closest("[data-crop]") : t.parentNode;
    if (!bar) return;
    var r = ev.raw;
    $("t3-read").textContent = "Target: " + nameOf(t) + " | crop " + bar.getAttribute("data-crop") +
      ", yield index " + bar.getAttribute("data-value") + " | x " + r.clientX + ", y " + r.clientY +
      " | default prevented: " + !!(r.defaultPrevented || r.returnValue === false);
  }, false);

  Array.prototype.forEach.call(bars.children, function (bar) {
    on(bar, "click", function (e) {
      var ev = norm(e);
      logLine("bub", "bubble ↑ (bar)", bar.getAttribute("data-crop"));
      if ($("t3-stop").checked) { ev.stop(); logLine("cap", "propagation stopped", bar.getAttribute("data-crop")); }
    }, false);
  });
  $("t3-clear").addEventListener("click", function () { $("t3-log").textContent = ""; });

  /* ---------- Task 4: collapsible + tooltip plugin (createElement / appendChild / insertBefore) ---------- */
  function createCollapsible(title, nodes, opts) {
    opts = opts || {};
    var caret = el("span", { class: "coll-caret", "aria-hidden": "true", text: "▸" });
    var label = el("span", { text: title });
    var head = el("button", { class: "coll-head", type: "button", "aria-expanded": "false" });
    head.appendChild(caret);
    head.appendChild(label);
    if (opts.badge) head.insertBefore(el("span", { class: "coll-badge", text: opts.badge }), label);
    var body = el("div", { class: "coll-body", hidden: "hidden" });
    nodes.forEach(function (n) { body.appendChild(n); });
    var wrap = el("div", { class: "coll" });
    wrap.appendChild(head);
    wrap.appendChild(body);
    head.addEventListener("click", function () {
      var open = head.getAttribute("aria-expanded") === "true";
      head.setAttribute("aria-expanded", String(!open));
      if (open) { body.setAttribute("hidden", "hidden"); wrap.classList.remove("open"); }
      else { body.removeAttribute("hidden"); wrap.classList.add("open"); }
    });
    return wrap;
  }

  function tipPlugin(root) {
    var tip = el("div", { class: "tooltip", role: "tooltip", hidden: "hidden" });
    document.body.appendChild(tip);
    function place(e) {
      var gap = 14, w = tip.offsetWidth, h = tip.offsetHeight;
      var vw = window.innerWidth || document.documentElement.clientWidth;   // BOM viewport size
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var x = e.clientX + gap, y = e.clientY + gap;
      if (x + w > vw - 4) x = e.clientX - w - gap;   // flip left near the right edge
      if (y + h > vh - 4) y = e.clientY - h - gap;   // flip up near the bottom edge
      tip.style.left = Math.max(4, x) + "px";
      tip.style.top = Math.max(4, y) + "px";
    }
    function target(e) { var t = e.target; return t.closest ? t.closest("[data-tip]") : null; }
    root.addEventListener("mouseover", function (e) {
      var t = target(e); if (!t) return;
      tip.textContent = t.getAttribute("data-tip");
      tip.removeAttribute("hidden");
      place(e);
    });
    root.addEventListener("mousemove", function (e) { if (!tip.hasAttribute("hidden")) place(e); });
    root.addEventListener("mouseout", function (e) { if (target(e)) tip.setAttribute("hidden", "hidden"); });
    root.addEventListener("focusin", function (e) {
      var t = target(e); if (!t) return;
      var r = t.getBoundingClientRect();
      tip.textContent = t.getAttribute("data-tip");
      tip.removeAttribute("hidden");
      place({ clientX: r.left, clientY: r.bottom });
    });
    root.addEventListener("focusout", function () { tip.setAttribute("hidden", "hidden"); });
  }

  function term(word, tip) { return el("span", { "data-tip": tip, tabindex: "0", text: word }); }
  var host = $("coll-host");
  host.appendChild(createCollapsible("Irrigation basics", [
    el("p", {}, [
      document.createTextNode("Check "), term("soil moisture", "Share of water held in the root zone. Most field crops stress below 30% and waterlog above 85%."),
      document.createTextNode(" before opening valves. Drip lines lose less water to "), term("evaporation", "Water lost to the air from soil and leaves, highest in hot, windy afternoons."),
      document.createTextNode(" than sprinklers.")
    ])
  ], { badge: "3 tips" }));
  host.appendChild(createCollapsible("Soil health", [
    el("p", {}, [
      document.createTextNode("High "), term("salinity", "Dissolved salt in the soil, measured in dS/m. Above 4 dS/m many crops lose yield."),
      document.createTextNode(" slows germination. Rotate crops and add organic matter to keep "), term("soil pH", "Acidity scale from 0 to 14. Most crops grow best between 6.0 and 7.0."),
      document.createTextNode(" in range.")
    ])
  ], { badge: "2 tips" }));
  tipPlugin(host);
  host.firstChild.querySelector("button").click();

  /* ---------- Task 5: simulated async HTTP + JSON handling ---------- */
  function mockFetch(kind) {
    return new Promise(function (resolve) {
      var delay = kind === "timeout" ? 99999 : 500 + Math.random() * 700;
      setTimeout(function () {
        var packet = {
          station: "farm-gateway-02",
          ts: new Date().toISOString(),
          forecast: { rain_chance: "65%", high: "31 °C", wind: "12 km/h" },
          advice: [
            { field: "Wheat plot A", action: "Delay irrigation 24 hours", priority: "medium" },
            { field: "Rice paddy", action: "Raise water level 3 cm", priority: "high" },
            { field: "Orchard row 3", action: "Scout for aphids", priority: "low" }
          ]
        };
        var res = { ok: true, status: 200, text: function () { return Promise.resolve(JSON.stringify(packet)); } };
        if (kind === "bad-json") res.text = function () { return Promise.resolve('{"station": "farm-gateway-02", "advice": [ {'); };
        if (kind === "server") res = { ok: false, status: 503, text: function () { return Promise.resolve("Service Unavailable"); } };
        resolve(res);
      }, delay);
    });
  }
  function withTimeout(p, ms) {
    return Promise.race([p, new Promise(function (_, rej) {
      setTimeout(function () { rej(new Error("The request took longer than " + ms / 1000 + " seconds.")); }, ms);
    })]);
  }
  function setStatus(msg, isErr) {
    var s = $("t5-status");
    s.textContent = "";
    s.className = isErr ? "" : "busy";
    s.appendChild(el("div", { class: isErr ? "err" : "", text: msg }));
  }
  function renderAdvisory(p) {
    if (!p || !p.forecast || !Array.isArray(p.advice)) throw new Error("The advisory is missing its forecast or advice list.");
    var d = $("t5-data"); d.className = ""; d.textContent = "";
    var dl = el("dl");
    [["Station", p.station], ["Received", new Date(p.ts).toLocaleTimeString()],
     ["Rain chance", p.forecast.rain_chance], ["High", p.forecast.high], ["Wind", p.forecast.wind]].forEach(function (r) {
      dl.appendChild(el("dt", { text: r[0] }));
      dl.appendChild(el("dd", { text: r[1] }));
    });
    p.advice.forEach(function (a) {
      dl.appendChild(el("dt", { text: a.field }));
      dl.appendChild(el("dd", { text: a.action + " (" + a.priority + ")" }));
    });
    d.appendChild(dl);
  }
  async function loadAdvisory(kind) {
    setStatus("Loading…", false);
    try {
      var res = await withTimeout(mockFetch(kind), 3000);
      if (!res.ok) throw new Error("Server answered " + res.status + ". Try again in a moment.");
      var raw = await res.text(), packet;
      try { packet = JSON.parse(raw); }
      catch (e) { throw new Error("The response was not valid JSON, so it was discarded."); }
      renderAdvisory(packet);
      setStatus("Advisory received and shown.", false);
    } catch (err) {
      setStatus(err.message, true);
    }
  }
  Array.prototype.forEach.call(document.querySelectorAll("[data-case]"), function (b) {
    b.addEventListener("click", function () { loadAdvisory(b.getAttribute("data-case")); });
  });
})();
