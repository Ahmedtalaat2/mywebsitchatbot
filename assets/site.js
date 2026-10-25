/* =====================================================
   Ahmed Al Gamal | site scripts
   Each block runs only if its section exists on the page.
   ===================================================== */
(function () {
  "use strict";
  var CFG = window.SITE_CONFIG || {};
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { var d = document.createElement("div"); d.textContent = String(s == null ? "" : s); return d.innerHTML; };
  var later = function (ms) { return reduce ? Math.min(ms, 120) : ms; };
  var store = {
    get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  };
  var waLink = function (msg) {
    return "https://wa.me/" + (CFG.whatsapp || "") + (msg ? "?text=" + encodeURIComponent(msg) : "");
  };
  var fmtAED = function (n) { return "AED " + Math.round(n).toLocaleString("en-US"); };

  /* ---------- 1. Tracking (GA4 + Meta Pixel, only if IDs are set) ---------- */
  if (CFG.ga4Id) {
    var g = document.createElement("script");
    g.async = true; g.src = "https://www.googletagmanager.com/gtag/js?id=" + CFG.ga4Id;
    document.head.appendChild(g);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date()); window.gtag("config", CFG.ga4Id);
  }
  if (CFG.metaPixelId) {
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", CFG.metaPixelId); window.fbq("track", "PageView");
  }
  function track(name, params) {
    params = params || {};
    try { if (window.gtag) window.gtag("event", name, params); } catch (e) {}
    try {
      if (window.fbq) {
        if (name === "whatsapp_click" || name === "generate_lead") window.fbq("track", name === "generate_lead" ? "Lead" : "Contact", params);
        else window.fbq("trackCustom", name, params);
      }
    } catch (e) {}
  }

  /* ---------- 2. Nav ---------- */
  var menuBtn = $(".menu-btn"), menu = $(".nav-menu");
  if (menuBtn && menu) {
    menuBtn.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      menuBtn.textContent = open ? "Close" : "Menu";
    });
  }

  /* ---------- 3. WhatsApp links ---------- */
  $$("[data-wa]").forEach(function (a) {
    a.href = waLink(a.getAttribute("data-msg") || document.body.getAttribute("data-wa-msg") || "Hi Ahmed, I found your website and I'd like to talk.");
    a.target = "_blank"; a.rel = "noopener";
    a.addEventListener("click", function () { track("whatsapp_click", { page: location.pathname, place: a.getAttribute("data-place") || "button" }); });
  });
  var yr = $("#year"); if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- 4. AI chatbot (your n8n webhook) ---------- */
  function openChat() {
    var t = document.querySelector(".chat-window-toggle");
    if (t) t.click();
  }
  if (CFG.chatWebhook) {
    var css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "https://cdn.jsdelivr.net/npm/@n8n/chat@1.42.0/dist/style.css";
    document.head.insertBefore(css, document.head.querySelector('link[href*="site.css"]'));
    import("https://cdn.jsdelivr.net/npm/@n8n/chat@1.42.0/dist/chat.bundle.es.js").then(function (mod) {
      mod.createChat({
        webhookUrl: CFG.chatWebhook,
        mode: "window",
        showWelcomeScreen: false,
        initialMessages: [
          "Hi! I'm Ahmed's AI assistant.",
          "Ask me about ads, WhatsApp AI, Jisrix or pricing. I can also connect you with Ahmed."
        ],
        i18n: { en: { title: "Ask Ahmed's AI assistant", subtitle: "Replies in seconds, 24/7", footer: "", getStarted: "New conversation", inputPlaceholder: "Type your question..." } }
      });
      document.addEventListener("click", function (e) {
        if (e.target.closest && e.target.closest(".chat-window-toggle")) track("chat_open", { page: location.pathname });
      });
      // Gentle nudge once per visit
      if (!store.get("teaserShown")) {
        setTimeout(function () {
          if (store.get("teaserShown") || document.querySelector(".chat-window")?.offsetParent) return;
          store.set("teaserShown", "1");
          var tz = document.createElement("div");
          tz.className = "chat-teaser"; tz.setAttribute("role", "status");
          tz.innerHTML = 'Have a question about getting more leads? Ask my AI assistant. <button type="button" aria-label="Close">×</button>';
          tz.addEventListener("click", function (e) {
            tz.remove();
            if (!e.target.closest("button")) openChat();
          });
          document.body.appendChild(tz);
          setTimeout(function () { tz.remove(); }, 15000);
        }, later(14000));
      }
    }).catch(function () { /* chat failed to load; WhatsApp stays available */ });
  }
  $$("[data-open-chat]").forEach(function (b) { b.addEventListener("click", function (e) { e.preventDefault(); openChat(); }); });

  /* ---------- 4b. Live hero screen (home) ---------- */
  var live = $("#liveScreen");
  if (live) {
    var feeds = { chat: $('[data-feed="chat"]', live), leads: $('[data-feed="leads"]', live), act: $('[data-feed="act"]', live) };
    var DATA = {
      chat: [["in", "Is the 2BR in JVC still available?"], ["out", "Yes! What's your budget?"], ["in", "مرحبا، عندكم كود FB-2041؟"], ["out", "متوفر 640 متر، 38 درهم للمتر"],
             ["in", "Do you deliver to Abu Dhabi?"], ["out", "Yes, tomorrow. Want the order link?"], ["in", "Can I see a villa this weekend?"], ["out", "Saturday 10:00 AM works?"]],
      leads: [["Omar", "Marina, AED 1.4M", "hot"], ["Elena", "JVC, AED 900K", "warm"], ["Raj", "Business Bay", "hot"], ["Lina", "Dubai Hills", "cold"],
              ["Khalid", "FB-2041, 120 m", "hot"], ["Sara", "Downtown, AED 2.1M", "hot"], ["Maria", "Online order", "warm"]],
      act: ["Viewing booked, Sat 11:00 AM", "Telegram alert sent to agent", "Lead scored Hot", "Follow-up set for 24 h", "LPO received, waiting approval", "Reminder sent", "Order link sent"]
    };
    var idx = { chat: 0, leads: 0, act: 0 }, MAX = 7;
    var make = function (k) {
      var d = DATA[k][idx[k]++ % DATA[k].length], el = document.createElement("div");
      if (k === "chat") { el.className = "lsi " + d[0]; el.textContent = d[1]; if (/[\u0600-\u06FF]/.test(d[1])) el.dir = "rtl"; }
      else if (k === "leads") { el.className = "lsi row"; el.innerHTML = "<span>" + esc(d[0]) + " <small style=\"color:var(--muted)\">" + esc(d[1]) + '</small></span><span class="pill ' + d[2] + '">' + d[2].charAt(0).toUpperCase() + d[2].slice(1) + "</span>"; }
      else { el.className = "lsi act"; el.textContent = d; }
      var f = feeds[k]; f.appendChild(el); while (f.children.length > MAX) f.removeChild(f.firstChild);
    };
    ["chat", "leads", "act"].forEach(function (k) { for (var i = 0; i < 4; i++) make(k); });
    var TOAST = ["New lead from Meta Ads, replied in 6 seconds", "Viewing booked for Saturday 11:00 AM", "Hot lead sent to an agent on Telegram", "Trader asked for FB-2041, stock sent in 4 seconds", "Quiet lead followed up after 24 hours"];
    var toastText = $("#liveToastText"), t = 0, tick = 0, order = ["chat", "chat", "leads", "act"], timer = null;
    var step = function () {
      make(order[tick++ % order.length]);
      if (tick % 3 === 0 && toastText) {
        toastText.style.opacity = 0;
        setTimeout(function () { toastText.textContent = TOAST[++t % TOAST.length]; toastText.style.opacity = 1; }, 300);
      }
    };
    var run = function (on) { if (on && !timer && !reduce) timer = setInterval(step, 1300); if (!on && timer) { clearInterval(timer); timer = null; } };
    if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { run(en[0].isIntersecting && !document.hidden); }).observe(live.parentNode);
    else run(true);
    document.addEventListener("visibilitychange", function () { run(!document.hidden); });
    // Gentle tilt that follows the pointer on desktop
    var heroEl = live.parentNode;
    if (!reduce && window.matchMedia("(pointer: fine)").matches) {
      heroEl.addEventListener("pointermove", function (e) {
        var r = heroEl.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5;
        live.style.setProperty("--ry", (x * 6).toFixed(2) + "deg");
      });
      heroEl.addEventListener("pointerleave", function () { live.style.setProperty("--ry", "0deg"); });
    }
  }

  /* ---------- 5. Chat simulations ---------- */
  var SETS = {
    home: [
      { key: "re", label: "Jisrix Real Estate", dir: "ltr", bot: "Jisrix Real Estate",
        fields: ["Source", "Looking for", "Budget", "Next step"], first: { Source: "Meta lead form" },
        steps: [
          { who: "in", text: "Hi, is the 2BR in JVC still available?" },
          { who: "out", text: "Hi! Yes, it is. What's your budget, and is it to live in or to invest?", set: { "Looking for": "2BR, JVC" } },
          { who: "in", text: "Around 1.2M. To live in." },
          { who: "out", text: "Great fit. Is Saturday 11:00 AM or Sunday 5:00 PM better for a viewing?", set: { Budget: "AED 1.2M" }, score: "hot" },
          { who: "in", text: "Saturday works." },
          { who: "out", text: "Booked for Saturday 11:00 AM. You'll get a reminder the day before.", set: { "Next step": "Viewing, Sat 11:00 AM" } },
          { who: "sys", text: "Agent notified on Telegram" }
        ] },
      { key: "ws", label: "Jisrix Textiles", dir: "rtl", bot: "Jisrix Textiles",
        fields: ["Source", "Product", "Quantity", "Next step"], first: { Source: "WhatsApp" },
        steps: [
          { who: "in", text: "مرحبا، عندكم كود FB-2041؟ أبي 120 متر" },
          { who: "out", text: "هلا! متوفر 640 متر من FB-2041 مخمل زمردي، السعر 38 درهم للمتر.", set: { Product: "FB-2041 velvet", Quantity: "120 m" } },
          { who: "in", text: "تمام، أرسل لكم LPO الحين" },
          { who: "in", text: "LPO-0937.pdf", media: true },
          { who: "out", text: "وصلني الطلب. أرسلته للمبيعات للتأكيد، وبنرد عليك خلال دقائق.", set: { "Next step": "Order waiting approval" }, score: "hot" },
          { who: "sys", text: "Order sent to Telegram for approval" }
        ] },
      { key: "st", label: "Online store", dir: "ltr", bot: "Store assistant",
        fields: ["Source", "Question", "Order", "Next step"], first: { Source: "Instagram ad" },
        steps: [
          { who: "in", text: "Do you deliver to Abu Dhabi? And is the black hoodie in size L?" },
          { who: "out", text: "Yes, we deliver to Abu Dhabi. The black hoodie in L is in stock. Want me to send the order link?", set: { Question: "Delivery + size" } },
          { who: "in", text: "Yes please" },
          { who: "out", text: "Here you go. Cash on delivery is available too.", set: { Order: "Black hoodie, L" }, score: "warm" },
          { who: "sys", text: "Reminder set if the cart isn't completed in 24 h" }
        ] },
      { key: "lc", label: "Local business", dir: "rtl", bot: "Booking assistant",
        fields: ["Source", "Service", "When", "Next step"], first: { Source: "Google Maps" },
        steps: [
          { who: "in", text: "السلام عليكم، عندكم موعد بكرة العصر؟" },
          { who: "out", text: "وعليكم السلام! أي خدمة تحتاج؟ وعندنا مواعيد 4:00 و 6:30 بكرة.", set: { Service: "Asking" } },
          { who: "in", text: "تنظيف بشرة، الساعة 6:30" },
          { who: "out", text: "تم الحجز بكرة الساعة 6:30. بنرسل لك تذكير قبلها بساعتين.", set: { Service: "Facial", When: "Tomorrow 6:30 PM", "Next step": "Booked" }, score: "hot" },
          { who: "sys", text: "Added to the calendar" }
        ] }
    ],
    re: [
      { key: "en", label: "English lead", dir: "ltr", bot: "Jisrix Assistant",
        fields: ["Source", "Language", "Looking for", "Budget", "Viewing"], first: { Source: "Meta lead form", Language: "English" },
        steps: [
          { who: "in", text: "Hi, I saw your ad for Dubai Hills villas. Anything under 5M?" },
          { who: "out", text: "Hi! Yes, there are 3 options under 5M right now. Is it for your family or as an investment?", set: { "Looking for": "Villa, Dubai Hills" } },
          { who: "in", text: "Family. We need 4 bedrooms." },
          { who: "out", text: "Got it. I can show you two 4BR villas this week. Thursday 6 PM or Saturday 10 AM?", set: { Budget: "Up to AED 5M" }, score: "hot" },
          { who: "in", text: "Saturday 10" },
          { who: "out", text: "Booked for Saturday 10:00 AM. An agent will meet you at the community gate.", set: { Viewing: "Sat 10:00 AM" } },
          { who: "sys", text: "Agent notified on Telegram" }
        ] },
      { key: "ar", label: "Arabic lead", dir: "rtl", bot: "Jisrix Assistant",
        fields: ["Source", "Language", "Looking for", "Budget", "Viewing"], first: { Source: "Click-to-WhatsApp ad", Language: "Arabic" },
        steps: [
          { who: "in", text: "السلام عليكم، عندكم شقق غرفة وصالة في دبي مارينا؟" },
          { who: "out", text: "وعليكم السلام! أكيد. كم الميزانية تقريباً، وتبي تسكن ولا استثمار؟", set: { "Looking for": "1BR, Dubai Marina" } },
          { who: "in", text: "حوالي 900 ألف، استثمار" },
          { who: "out", text: "ممتاز. يناسبك الأحد 4 العصر ولا الاثنين 6 المساء للمعاينة؟", set: { Budget: "AED 900K" }, score: "warm" },
          { who: "in", text: "الاثنين" },
          { who: "out", text: "تم الحجز يوم الاثنين الساعة 6 المساء. بنرسل لك تذكير قبلها بيوم.", set: { Viewing: "Mon 6:00 PM" } },
          { who: "sys", text: "Agent notified on Telegram" }
        ] },
      { key: "ru", label: "Russian lead", dir: "ltr", bot: "Jisrix Assistant",
        fields: ["Source", "Language", "Looking for", "Budget", "Viewing"], first: { Source: "Meta lead form", Language: "Russian" },
        steps: [
          { who: "in", text: "Здравствуйте! Есть студии в Business Bay?" },
          { who: "out", text: "Здравствуйте! Да, есть. Какой у вас бюджет и когда планируете покупку?", set: { "Looking for": "Studio, Business Bay" } },
          { who: "in", text: "До 600 тысяч, примерно через полгода." },
          { who: "out", text: "Спасибо! Пришлю подборку вариантов сегодня и напомню о новых предложениях.", set: { Budget: "AED 600K" }, score: "cold" },
          { who: "sys", text: "Saved to nurture list, follow-up in 24 h" }
        ], last: { Viewing: "Not yet, follow-up set" } }
    ]
  };
  SETS.ws = [SETS.home[1]];
  var SCORE = { hot: "Hot", warm: "Warm", cold: "Cold", "new": "New" };

  $$("[data-sim]").forEach(function (root) {
    var set = SETS[root.getAttribute("data-sim")]; if (!set) return;
    var tabs = $(".sim-tabs", root), chat = $(".chat", root), status = $(".status", root), botName = $(".bot-name", root);
    var dl = $(".rec dl", root), badge = $(".rec .badge", root);
    var run = 0, minute = 0, started = false;
    if (set.length < 2) tabs.classList.add("single");
    tabs.innerHTML = set.map(function (s, i) {
      return '<button type="button" role="tab" aria-selected="' + (i === 0) + '" data-k="' + s.key + '">' + esc(s.label) + "</button>";
    }).join("");
    function wait(ms, id) { return new Promise(function (res, rej) { setTimeout(function () { id === run ? res() : rej("stop"); }, later(ms)); }); }
    function setBadge(l) { badge.dataset.level = l; badge.textContent = SCORE[l]; }
    function setField(k, v) {
      var dd = dl.querySelector('[data-f="' + k + '"]'); if (!dd) return;
      dd.textContent = v; dd.classList.add("flash"); setTimeout(function () { dd.classList.remove("flash"); }, 900);
    }
    function typing(on) {
      var t = $(".typing", chat);
      if (on && !t) { t = document.createElement("div"); t.className = "typing"; t.innerHTML = "<span></span><span></span><span></span>"; chat.appendChild(t); }
      else if (!on && t) t.remove();
      status.textContent = on ? "typing…" : "online";
      chat.scrollTop = chat.scrollHeight;
    }
    function add(step, sc) {
      var el = document.createElement("div");
      el.className = "msg " + step.who + (step.media ? " media" : "");
      if (sc.dir === "rtl" && /[؀-ۿ]/.test(step.text)) el.dir = "rtl";
      minute += 1;
      el.innerHTML = esc(step.text) + (step.who === "sys" ? "" : '<span class="t">11:' + String(40 + minute).padStart(2, "0") + " PM</span>");
      chat.appendChild(el); chat.scrollTop = chat.scrollHeight;
    }
    function play(key) {
      var sc = set.filter(function (s) { return s.key === key; })[0], id = ++run;
      minute = 0; chat.innerHTML = ""; typing(false); setBadge("new");
      if (botName) botName.textContent = sc.bot;
      dl.innerHTML = sc.fields.map(function (f) { return "<div><dt>" + esc(f) + '</dt><dd data-f="' + esc(f) + '">' + esc((sc.first && sc.first[f]) || "–") + "</dd></div>"; }).join("");
      var chain = wait(500, id);
      sc.steps.forEach(function (st) {
        chain = chain.then(function () {
          if (st.who === "out") { typing(true); return wait(1300, id).then(function () { typing(false); }); }
          return wait(st.who === "sys" ? 700 : 1400, id);
        }).then(function () {
          add(st, sc);
          if (st.set) Object.keys(st.set).forEach(function (k) { setField(k, st.set[k]); });
          if (st.score) setBadge(st.score);
        });
      });
      chain.then(function () {
        if (sc.last) Object.keys(sc.last).forEach(function (k) { setField(k, sc.last[k]); });
        return wait(700, id);
      }).then(function () {
        var b = document.createElement("button"); b.type = "button"; b.className = "msg sys"; b.textContent = "Replay conversation";
        b.onclick = function () { play(key); }; chat.appendChild(b); chat.scrollTop = chat.scrollHeight;
      }).catch(function () {});
    }
    tabs.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      $$("button", tabs).forEach(function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false"); });
      play(b.dataset.k); track("demo_run", { demo: "chat_" + b.dataset.k });
    });
    // Start when visible, so the person actually sees it play
    function start() { if (!started) { started = true; play(set[0].key); } }
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { start(); io.disconnect(); } }, { threshold: .3 });
      io.observe(root);
    } else start();
  });

  /* ---------- 6. Lead pipeline simulation ---------- */
  var runBtn = $("#runPipe");
  if (runBtn) {
    var pipeRun = 0, logEl = $("#log"), logClock = $("#logClock");
    var mmss = function (s) { return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
    var money = function (v) { return v >= 1e6 ? "AED " + (v / 1e6).toFixed(1).replace(".0", "") + "M" : "AED " + Math.round(v / 1000) + "K"; };
    runBtn.addEventListener("click", function () {
      var id = ++pipeRun;
      var name = ($("#leadName").value || "Lead").trim().slice(0, 20);
      var area = $("#leadArea").value, budget = +$("#leadBudget").value;
      var score = budget >= 1e6 ? "Hot" : budget >= 8e5 ? "Warm" : "Cold", booked = score !== "Cold";
      var ev = [
        { t: 0, s: 0, x: "<b>New lead</b> from Meta lead form: " + esc(name) + ", " + esc(area) + ", " + money(budget) },
        { t: 6, s: 1, x: "<b>WhatsApp reply sent</b> to " + esc(name) },
        { t: 95, s: 2, x: "<b>Qualified:</b> budget " + money(budget) + ", " + esc(area) + ", buying within 3 months" },
        { t: 96, s: 3, x: "<b>Scored " + score + "</b>, saved to Google Sheets" },
        booked ? { t: 140, s: 4, x: "<b>Viewing booked</b> Saturday 11:00 AM in Google Calendar" } : { t: 140, s: 4, x: "<b>No viewing yet.</b> Sent 3 matching listings" },
        booked ? { t: 141, s: 5, x: "<b>Telegram alert</b> to the agent with " + esc(name) + "'s summary" } : { t: 141, s: 5, x: "<b>Added to nurture list.</b> No agent call needed yet" },
        booked ? { t: 142, s: 6, x: "<b>Reminder set</b> for Friday, follow-up 24 h after the viewing" } : { t: 142, s: 6, x: "<b>Follow-up scheduled</b> in 24 hours" }
      ];
      var lis = $$("#steps li");
      lis.forEach(function (li) { li.className = ""; });
      logEl.innerHTML = ""; logClock.textContent = "00:00";
      runBtn.disabled = true; runBtn.textContent = "Running…";
      track("demo_run", { demo: "pipeline" });
      if (window.innerWidth < 720) $("#steps").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      var i = 0;
      (function next() {
        if (id !== pipeRun) return;
        if (i >= ev.length) { runBtn.disabled = false; runBtn.textContent = "Send another lead"; return; }
        var e = ev[i];
        lis.forEach(function (li, n) { li.className = n < e.s ? "done" : n === e.s ? "active" : ""; });
        setTimeout(function () {
          if (id !== pipeRun) return;
          lis[e.s].className = "done";
          var li = document.createElement("li");
          li.innerHTML = "<time>" + mmss(e.t) + "</time><span>" + e.x + "</span>";
          logEl.appendChild(li); logClock.textContent = mmss(e.t);
          i++; next();
        }, later(1000));
      })();
    });
  }

  /* ---------- 7. Lead leak calculator (real estate) ---------- */
  var leak = $("#leak");
  if (leak) {
    var calcLeak = function () {
      var v = function (id) { return Math.max(0, parseFloat($("#" + id).value) || 0); };
      var leads = v("lkLeads"), slow = v("lkSlow") / 100, close = v("lkClose") / 100, comm = v("lkComm"), win = v("lkWin") / 100;
      var slowLeads = leads * slow, wonBack = slowLeads * win, dealsYear = wonBack * close * 12;
      $("#lkSlowOut").textContent = Math.round(slowLeads);
      $("#lkDealsOut").textContent = Math.round(wonBack);
      $("#lkMoneyOut").textContent = fmtAED(dealsYear * comm);
      $("#lkDealsYr").textContent = dealsYear.toFixed(1);
      $("#lkWinLbl").textContent = Math.round(win * 100) + "%";
      var msg = "Hi Ahmed, I used your lead calculator. We get about " + leads + " leads a month and around " + Math.round(slow * 100) + "% wait too long for a reply. Can we talk?";
      $("#lkWa").href = waLink(msg);
    };
    $$("input", leak).forEach(function (i) { i.addEventListener("input", calcLeak); });
    calcLeak();
  }

  /* ---------- 8. Stock lookup (Jisrix Textiles demo) ---------- */
  var lookupForm = $("#lookup");
  if (lookupForm) {
    var CAT = {
      "FB-2041": { n: "Velvet upholstery fabric, emerald", s: "640 m", ok: true, p: "AED 38 per metre" },
      "CP-118": { n: "Wool blend carpet, 3 x 4 m", s: "12 pieces", ok: true, p: "AED 1,450 each" },
      "WP-560": { n: "Vinyl wallpaper, linen texture", s: "Out of stock", ok: false, p: "Back in about 10 days" }
    };
    var out = $("#lookupOut"), codeIn = $("#code");
    var look = function (code) {
      code = String(code || "").trim().toUpperCase();
      if (!code) { out.innerHTML = '<div class="result">Type a product code first.</div>'; return; }
      out.innerHTML = '<div class="result muted">Checking stock for ' + esc(code) + "…</div>";
      track("demo_run", { demo: "stock_lookup" });
      setTimeout(function () {
        var p = CAT[code];
        out.innerHTML = p
          ? '<div class="result"><strong>' + esc(code) + ", " + esc(p.n) + '</strong><div class="kv"><span>Stock</span><span class="' + (p.ok ? "ok" : "low") + '">' + p.s + '</span></div><div class="kv"><span>' + (p.ok ? "Price" : "Note") + "</span><span>" + p.p + "</span></div></div>"
          : '<div class="result">No product found for ' + esc(code) + ". Check the code, or send a photo of the sample and the team will match it.</div>";
      }, later(700));
    };
    lookupForm.addEventListener("submit", function (e) { e.preventDefault(); look(codeIn.value); });
    $$(".code-chip", lookupForm).forEach(function (c) { c.addEventListener("click", function () { codeIn.value = c.textContent; look(c.textContent); }); });
  }

  /* ---------- 9. Furnishing calculator (CRM module preview) ---------- */
  var fc = $("#fcalc");
  if (fc) {
    var mode = "wallpaper";
    var panes = $$("[data-pane]", fc);
    var calc = function () {
      var n = function (id) { return Math.max(0, parseFloat($("#" + id).value) || 0); };
      var res = $("#fcOut"), lines = [], summary = "";
      if (mode === "wallpaper") {
        var w = n("wpWidth"), h = n("wpHeight"), rw = n("wpRollW") || .53, rl = n("wpRollL") || 10.05;
        var strips = Math.ceil(w / rw), perRoll = Math.max(1, Math.floor(rl / (h + .1)));
        var rolls = h > 0 ? Math.ceil(strips / perRoll) : 0, extra = Math.ceil(rolls * 1.1);
        lines = [["Strips needed", strips], ["Strips per roll", perRoll], ["Rolls needed", rolls]];
        summary = extra + " rolls"; res.dataset.note = "Includes about 10% extra for pattern matching and cuts.";
        lines.push(["Suggested order", extra + " rolls"]);
      } else if (mode === "curtains") {
        var ww = n("cuWidth"), full = n("cuFull") || 2, pr = n("cuPrice");
        var metres = Math.ceil((ww * full + .3) * 10) / 10;
        lines = [["Fabric width needed", (ww * full).toFixed(2) + " m"], ["Fabric to order", metres + " m"]];
        if (pr) lines.push(["Fabric cost", fmtAED(metres * pr)]);
        summary = metres + " m of fabric"; res.dataset.note = "Assumes 280 cm wide fabric used sideways, plus 30 cm for side hems.";
      } else {
        var L = n("flLen"), W = n("flWid"), box = n("flBox") || 2.2, waste = n("flWaste") / 100;
        var area = L * W, need = area * (1 + waste), boxes = Math.ceil(need / box);
        lines = [["Room area", area.toFixed(2) + " m²"], ["With waste", need.toFixed(2) + " m²"], ["Boxes to order", boxes]];
        summary = boxes + " boxes"; res.dataset.note = "Box coverage varies by product. Check the label.";
      }
      res.innerHTML = '<div class="result">' + lines.map(function (l) { return '<div class="kv"><span>' + l[0] + "</span><span>" + l[1] + "</span></div>"; }).join("") +
        '<p class="hint" style="margin:6px 0 0">' + esc(res.dataset.note) + "</p></div>";
      $("#fcWa").href = waLink("Hi Ahmed, I tried the " + mode + " calculator on your website (" + summary + "). I'd like a system like this for my business.");
    };
    $$(".seg button", fc).forEach(function (b) {
      b.addEventListener("click", function () {
        mode = b.dataset.mode;
        $$(".seg button", fc).forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        panes.forEach(function (p) { p.hidden = p.dataset.pane !== mode; });
        calc(); track("demo_run", { demo: "calc_" + mode });
      });
    });
    $$("input", fc).forEach(function (i) { i.addEventListener("input", calc); });
    calc();
  }

  /* ---------- 10. Automation builder ---------- */
  var builder = $("#builder");
  if (builder) {
    var flow = $("#flow"), bWa = $("#builderWa");
    var build = function () {
      var picked = $$("input:checked", builder).map(function (i) { return { k: i.value, t: i.dataset.flow, s: i.dataset.short }; });
      if (!picked.length) {
        flow.innerHTML = '<div class="empty">Pick at least one task on the left. Your automation will appear here.</div>';
        bWa.href = waLink("Hi Ahmed, I'd like to automate parts of my business. Can we talk?");
        return;
      }
      var nodes = [{ i: "IN", t: "Customer messages you on WhatsApp, Instagram or your website" }]
        .concat(picked.map(function (p, n) { return { i: String(n + 1), t: p.t }; }))
        .concat([{ i: "YOU", t: "You get a short summary on Telegram and only step in when needed" }]);
      flow.innerHTML = nodes.map(function (nd, n) {
        return (n ? '<div class="flow-link"></div>' : "") + '<div class="flow-node"><i>' + nd.i + "</i><span>" + esc(nd.t) + "</span></div>";
      }).join("");
      var biz = ($("#bizType") || {}).value || "my business";
      bWa.href = waLink("Hi Ahmed, I run " + biz + ". I'd like to automate: " + picked.map(function (p) { return p.s; }).join(", ") + ". Can you build this?");
    };
    builder.addEventListener("change", build);
    build();
  }

  /* ---------- 11. Contact form (your Google Apps Script, unchanged payload) ---------- */
  var form = $("#contactForm");
  if (form) {
    var msgBox = $("#formMsg");
    var show = function (cls, text) { msgBox.className = "form-msg " + cls; msgBox.textContent = text; msgBox.hidden = false; };
    var cleanUAEPhone = function (p) {
      p = String(p || "").replace(/\D/g, "");
      if (p.indexOf("00971") === 0) p = p.substring(2);
      if (p.indexOf("0") === 0) p = p.substring(1);
      if (p.indexOf("971") !== 0) p = "971" + p;
      return /^9715\d{8}$/.test(p) ? p : null;
    };
    var pre = new URLSearchParams(location.search).get("s");
    if (pre) { var opt = form.querySelector('#service option[data-key="' + pre + '"]'); if (opt) opt.selected = true; }
    form.addEventListener("submit", function (e) {
      e.preventDefault(); msgBox.hidden = true;
      var f = function (id) { return $("#" + id).value.trim(); };
      var name = f("name"), phone = cleanUAEPhone(f("phone")), email = f("email"), service = f("service"), message = f("message");
      if (!name) { show("err", "Please enter your name."); $("#name").focus(); return; }
      if (!phone) { show("err", "Please enter a valid UAE mobile number, for example 050 776 1628."); $("#phone").focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { show("err", "Please enter a valid email address."); $("#email").focus(); return; }
      if (!service) { show("err", "Please choose what you need help with."); $("#service").focus(); return; }
      if (!message) { show("err", "Please tell me a little about your business."); $("#message").focus(); return; }
      var btn = form.querySelector('button[type="submit"]'), label = btn.textContent;
      btn.disabled = true; btn.textContent = "Sending…";
      fetch(CFG.formEndpoint, {
        method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ name: name, phone: phone, email: email, service: service, message: message })
      }).then(function () {
        show("ok", "Thanks, " + name + ". Your request is in. I'll reply on WhatsApp within 24 hours.");
        form.reset(); track("generate_lead", { service: service });
      }).catch(function () {
        show("err", "The form couldn't send. Check your connection and try again, or message me on WhatsApp.");
      }).then(function () { btn.disabled = false; btn.textContent = label; });
    });
  }

  /* ---------- 12. Blog (Blogger feed) ---------- */
  var posts = $("#posts");
  if (posts) {
    var base = (CFG.bloggerUrl || "").replace(/\/+$/, "");
    var empty = function (html) { posts.innerHTML = '<div class="empty">' + html + "</div>"; };
    if (!base) { empty("Articles are on the way."); }
    else {
      var done = false;
      window.__blogFeed = function (data) {
        done = true;
        var entries = ((data && data.feed && data.feed.entry) || []).filter(function (e) { return !/^\s*test\b/i.test(e.title && e.title.$t || ""); })
          .slice(0, CFG.postsToShow || 3);
        if (!entries.length) { empty('New articles are coming soon. <a href="' + esc(base) + '" target="_blank" rel="noopener">Visit the blog</a>.'); return; }
        posts.innerHTML = entries.map(function (e) {
          var link = (e.link || []).filter(function (l) { return l.rel === "alternate"; })[0];
          var title = e.title ? e.title.$t : "Untitled";
          var rtl = /[؀-ۿ]/.test(title);
          var date = new Date(e.published.$t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
          var sum = e.summary ? e.summary.$t.replace(/<[^>]+>/g, "").trim() : "";
          var img = e.media$thumbnail ? e.media$thumbnail.url.replace(/\/s72(-c)?\//, "/w640-h360-c/").replace(/=s72(-c)?$/, "=w640-h360-c") : "";
          return '<a class="post" href="' + esc(link ? link.href : base) + '" target="_blank" rel="noopener">' +
            (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : "") +
            '<div class="post-body"' + (rtl ? ' dir="rtl"' : "") + "><time>" + date + "</time><h3>" + esc(title) + "</h3><p>" + esc(sum) + "</p></div></a>";
        }).join("");
      };
      var s = document.createElement("script");
      s.src = base + "/feeds/posts/summary?alt=json-in-script&max-results=" + ((CFG.postsToShow || 3) + 2) + "&callback=__blogFeed";
      s.onerror = function () { empty('Couldn\'t load articles right now. <a href="' + esc(base) + '" target="_blank" rel="noopener">Open the blog</a>.'); };
      document.body.appendChild(s);
      setTimeout(function () { if (!done) s.onerror(); }, 8000);
    }
  }
})();
