"use strict";
// ahmedalgamal.tech: serves the static site, the blog, the admin and the lead API. No dependencies.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const db = require("./db");
const R = require("./render");

const ROOT = path.join(__dirname, "..");
const PORT = +process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const SECRET = process.env.SESSION_SECRET || crypto.createHash("sha256").update("s:" + ADMIN_PASSWORD).digest("hex");
const LEAD_TOKEN = process.env.LEAD_API_TOKEN || "";
const DAY = 86400000;

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml", ".woff2": "font/woff2", ".pdf": "application/pdf",
};
const DENY = new Set(["server", "data", "blogger", "node_modules", "dockerfile", "package.json", "readme.md"]);

/* ---------- helpers ---------- */
const send = (res, code, body, headers = {}) => {
  res.writeHead(code, Object.assign({ "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin" }, headers));
  res.end(body);
};
const json = (res, code, obj) => send(res, code, JSON.stringify(obj), { "Content-Type": "application/json", "Cache-Control": "no-store" });
const clientIp = (req) => String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();

function readBody(req, limit = 100 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(Object.assign(new Error("too large"), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
async function readJson(req, limit) {
  const t = await readBody(req, limit);
  try { return t ? JSON.parse(t) : {}; } catch (e) { throw Object.assign(new Error("bad json"), { code: 400 }); }
}

const hits = new Map();
function limited(key, max, windowMs) {
  const t = Date.now();
  const arr = (hits.get(key) || []).filter((x) => t - x < windowMs);
  arr.push(t); hits.set(key, arr);
  return arr.length > max;
}
setInterval(() => { const t = Date.now(); for (const [k, v] of hits) if (!v.some((x) => t - x < 3600000)) hits.delete(k); }, 600000).unref();

/* ---------- auth ---------- */
const sign = (v) => crypto.createHmac("sha256", SECRET).update(v).digest("hex");
const eq = (a, b) => { const x = crypto.createHash("sha256").update(String(a)).digest(), y = crypto.createHash("sha256").update(String(b)).digest(); return crypto.timingSafeEqual(x, y); };
function makeSession() { const exp = String(Date.now() + 7 * DAY); return exp + "." + sign(exp); }
function isAdmin(req) {
  if (!ADMIN_PASSWORD) return false;
  const m = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie || "");
  if (!m) return false;
  const [exp, sig] = m[1].split(".");
  return !!sig && +exp > Date.now() && eq(sig, sign(exp));
}
const cookie = (req, v, maxAge) => "sid=" + v + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" + maxAge + (req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "");

/* ---------- collections ---------- */
const str = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
const COLL = {
  leads: {
    pick: (b) => ({ name: str(b.name, 120), phone: str(b.phone, 40), email: str(b.email, 160), company: str(b.company, 160), service: str(b.service, 160), message: str(b.message, 4000), source: str(b.source, 200), status: ["new", "contacted", "qualified", "won", "lost"].includes(b.status) ? b.status : "new", notes: str(b.notes, 8000), followUp: /^\d{4}-\d{2}-\d{2}$/.test(b.followUp || "") ? b.followUp : "" }),
    valid: (o) => (o.name || o.phone || o.email ? null : "Name, phone or email is required"),
  },
  articles: {
    pick: (b) => ({ title: str(b.title, 200), slug: R.slugify(b.slug || b.title), lang: b.lang === "ar" ? "ar" : "en", description: str(b.description, 400), image: str(b.image, 400), format: b.format === "md" ? "md" : "html", body: String(b.body || "").slice(0, 400000), published: !!b.published, date: /^\d{4}-\d{2}-\d{2}/.test(b.date || "") ? String(b.date).slice(0, 10) : new Date().toISOString().slice(0, 10) }),
    valid: (o, all, id) => !o.title ? "Title is required" : !o.slug ? "Slug is required" : !o.body ? "Body is required" : all.some((x) => x.slug === o.slug && x.id !== id) ? "This slug is already used" : null,
  },
  projects: {
    pick: (b) => ({ title: str(b.title, 160), description: str(b.description, 1500), tags: (Array.isArray(b.tags) ? b.tags : String(b.tags || "").split(",")).map((t) => str(t, 40)).filter(Boolean).slice(0, 6), status: ["live", "current", "dev", "done"].includes(b.status) ? b.status : "live", url: str(b.url, 400), urlLabel: str(b.urlLabel, 60), order: Math.round(+b.order) || 0, published: !!b.published }),
    valid: (o) => (o.title ? null : "Title is required"),
  },
};

function createLead(body, source) {
  const o = COLL.leads.pick(Object.assign({}, body, { status: "new", source: source || body.source }));
  const err = COLL.leads.valid(o);
  if (err) return { err };
  const lead = Object.assign({ id: db.id(), created: db.now(), updated: db.now() }, o);
  db.get("leads").unshift(lead); db.save();
  return { lead };
}

/* ---------- admin API ---------- */
async function adminApi(req, res, u) {
  const p = u.pathname;
  if (p === "/api/admin/login" && req.method === "POST") {
    if (!ADMIN_PASSWORD) return json(res, 503, { error: "Admin is off. Set ADMIN_PASSWORD." });
    if (limited("login:" + clientIp(req), 8, 600000)) return json(res, 429, { error: "Too many tries. Wait 10 minutes." });
    const b = await readJson(req, 4096);
    if (!b.password || !eq(b.password, ADMIN_PASSWORD)) return json(res, 401, { error: "Wrong password" });
    res.setHeader("Set-Cookie", cookie(req, makeSession(), 7 * 86400));
    return json(res, 200, { ok: true });
  }
  if (p === "/api/admin/logout" && req.method === "POST") { res.setHeader("Set-Cookie", cookie(req, "", 0)); return json(res, 200, { ok: true }); }
  if (!isAdmin(req)) return json(res, 401, { error: "Not logged in" });
  if (p === "/api/admin/me") return json(res, 200, { ok: true });

  if (p === "/api/admin/leads.csv" && req.method === "GET") {
    const cols = ["created", "name", "phone", "email", "company", "service", "status", "source", "followUp", "message", "notes"];
    const cell = (v) => { v = String(v == null ? "" : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
    const csv = "﻿" + cols.join(",") + "\n" + db.get("leads").map((l) => cols.map((c) => cell(l[c])).join(",")).join("\n");
    return send(res, 200, csv, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="leads.csv"', "Cache-Control": "no-store" });
  }

  if (p === "/api/admin/upload" && req.method === "POST") {
    const b = await readJson(req, 8 * 1024 * 1024);
    const ext = (/\.(png|jpe?g|webp|gif)$/i.exec(b.name || "") || [])[1];
    if (!ext || !b.data) return json(res, 400, { error: "Send a png, jpg, webp or gif image" });
    const buf = Buffer.from(String(b.data).replace(/^data:[^,]+,/, ""), "base64");
    if (!buf.length || buf.length > 5 * 1024 * 1024) return json(res, 400, { error: "Image must be under 5 MB" });
    const name = Date.now() + "-" + R.slugify(path.basename(b.name, path.extname(b.name))).slice(0, 40) + "." + ext.toLowerCase();
    fs.writeFileSync(path.join(db.DIR, "uploads", name), buf);
    return json(res, 200, { url: "/uploads/" + name });
  }

  const m = /^\/api\/admin\/(leads|articles|projects)(?:\/([\w-]+))?$/.exec(p);
  if (!m) return json(res, 404, { error: "Not found" });
  const c = COLL[m[1]], all = db.get(m[1]), id = m[2];
  if (req.method === "GET" && !id) return json(res, 200, all);
  if (req.method === "POST" && !id) {
    const o = c.pick(await readJson(req, 500 * 1024)); const err = c.valid(o, all, null);
    if (err) return json(res, 400, { error: err });
    const row = Object.assign({ id: db.id(), created: db.now(), updated: db.now() }, o);
    all.unshift(row); db.save(); return json(res, 200, row);
  }
  const row = all.find((x) => x.id === id);
  if (!row) return json(res, 404, { error: "Not found" });
  if (req.method === "PUT") {
    const o = c.pick(Object.assign({}, row, await readJson(req, 500 * 1024))); const err = c.valid(o, all, id);
    if (err) return json(res, 400, { error: err });
    Object.assign(row, o, { updated: db.now() }); db.save(); return json(res, 200, row);
  }
  if (req.method === "DELETE") { all.splice(all.indexOf(row), 1); db.save(); return json(res, 200, { ok: true }); }
  return json(res, 405, { error: "Method not allowed" });
}

/* ---------- public pages ---------- */
const published = () => db.get("articles").filter((a) => a.published).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.created).localeCompare(String(a.created)));

function serveFile(req, res, file, code = 200, extra = {}) {
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, "Not found", { "Content-Type": "text/plain" });
    const ext = path.extname(file).toLowerCase();
    const h = Object.assign({ "Content-Type": TYPES[ext] || "application/octet-stream", "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600" }, extra);
    send(res, code, req.method === "HEAD" ? "" : buf, h);
  });
}

function serveWork(req, res) {
  fs.readFile(path.join(ROOT, "work.html"), "utf8", (err, html) => {
    if (err) return send(res, 500, "error");
    const cards = db.get("projects").filter((p) => p.published).sort((a, b) => a.order - b.order).map(R.projectCard).join("\n");
    send(res, 200, html.replace("<!--ADMIN_PROJECTS-->", cards), { "Content-Type": TYPES[".html"], "Cache-Control": "no-cache" });
  });
}

function serveSitemap(req, res) {
  fs.readFile(path.join(ROOT, "sitemap.xml"), "utf8", (err, xml) => {
    if (err) return send(res, 404, "Not found");
    const posts = published().map((a) => `  <url><loc>${R.SITE}/blog/${R.esc(a.slug)}</loc><lastmod>${String(a.updated || a.date).slice(0, 10)}</lastmod></url>\n`).join("");
    const extra = `  <url><loc>${R.SITE}/blog</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>\n` + posts;
    send(res, 200, xml.replace("</urlset>", extra + "</urlset>"), { "Content-Type": TYPES[".xml"], "Cache-Control": "no-cache" });
  });
}

function serveStatic(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch (e) { return send(res, 400, "Bad request"); }
  if (rel === "/") rel = "/index.html";
  const parts = rel.split("/").filter(Boolean);
  const file = path.join(ROOT, ...parts);
  const ext = path.extname(file).toLowerCase();
  const bad = rel.includes("\0") || parts.some((x) => x.startsWith(".") || x === ".." ) || DENY.has((parts[0] || "").toLowerCase()) || !TYPES[ext] || !file.startsWith(ROOT + path.sep);
  if (bad) return serveFile(req, res, path.join(ROOT, "404.html"), 404);
  fs.stat(file, (err, st) => (err || !st.isFile() ? serveFile(req, res, path.join(ROOT, "404.html"), 404) : serveFile(req, res, file)));
}

async function handle(req, res) {
  const u = new URL(req.url, "http://x");
  const p = u.pathname.replace(/\/{2,}/g, "/");

  if (p === "/healthz") return send(res, 200, "ok", { "Content-Type": "text/plain" });

  if (p.startsWith("/api/admin/")) return adminApi(req, res, u);

  if (p === "/api/lead" && req.method === "POST") {
    const viaToken = LEAD_TOKEN && eq(req.headers["x-api-key"] || "", LEAD_TOKEN);
    if (!viaToken && limited("lead:" + clientIp(req), 10, 3600000)) return json(res, 429, { error: "Too many requests" });
    const b = await readJson(req, 20 * 1024);
    if (b.website) return json(res, 200, { ok: true }); // honeypot
    const r = createLead(b, b.source || (viaToken ? "api" : "website form"));
    return r.err ? json(res, 400, { error: r.err }) : json(res, 200, { ok: true });
  }
  if (p === "/api/posts" && req.method === "GET") {
    const n = Math.min(+u.searchParams.get("limit") || 10, 50);
    return json(res, 200, published().slice(0, n).map((a) => ({ title: a.title, slug: a.slug, date: a.date, description: a.description, image: a.image, lang: a.lang })));
  }

  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed", { Allow: "GET, HEAD" });

  if (p === "/admin" || p === "/admin/") return serveFile(req, res, path.join(__dirname, "admin.html"), 200, { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "X-Frame-Options": "DENY" });
  if (p === "/blog" || p === "/blog/") return send(res, 200, R.blogIndex(published()), { "Content-Type": TYPES[".html"], "Cache-Control": "no-cache" });
  let m = /^\/blog\/([^/]+)\/?$/.exec(p);
  if (m) {
    const slug = decodeURIComponent(m[1]);
    const a = published().find((x) => x.slug === slug);
    if (!a) return serveFile(req, res, path.join(ROOT, "404.html"), 404);
    return send(res, 200, R.blogPost(a), { "Content-Type": TYPES[".html"], "Cache-Control": "no-cache" });
  }
  if (p === "/work.html") return serveWork(req, res);
  if (p === "/sitemap.xml") return serveSitemap(req, res);
  m = /^\/uploads\/([\w.-]+)$/.exec(p);
  if (m) return serveFile(req, res, path.join(db.DIR, "uploads", m[1]));
  return serveStatic(req, res, p);
}

/* ---------- first start: copy the 4 Blogger articles ---------- */
function seed() {
  if (db.get("articles").length) return;
  try {
    const dir = path.join(ROOT, "blogger", "posts");
    const list = JSON.parse(fs.readFileSync(path.join(dir, "posts.json"), "utf8"));
    list.forEach((p) => {
      db.get("articles").push({
        id: db.id(), created: db.now(), updated: db.now(), title: p.title, slug: p.permalink, lang: (p.labels || []).includes("العربية") ? "ar" : "en",
        description: p.description, image: p.image ? "/assets/blog/" + p.image : "", format: "html", published: true,
        date: "2026-10-26", body: fs.readFileSync(path.join(dir, p.file), "utf8"),
      });
    });
    db.save();
    console.log("Seeded " + list.length + " articles from blogger/posts");
  } catch (e) { console.error("Seed skipped:", e.message); }
}

if (require.main === module) {
  db.load(); seed();
  http.createServer((req, res) => handle(req, res).catch((e) => { if (!res.headersSent) json(res, e.code === 413 || e.code === 400 ? e.code : 500, { error: e.code ? e.message : "Server error" }); if (!e.code) console.error(e); }))
    .listen(PORT, () => console.log("Site on :" + PORT + (ADMIN_PASSWORD ? "" : " (admin OFF: set ADMIN_PASSWORD)")));
}
module.exports = { handle };
