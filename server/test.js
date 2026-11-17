"use strict";
// Smoke test: node server/test.js
const os = require("os"), fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "site-"));
process.env.ADMIN_PASSWORD = "test-pass"; process.env.LEAD_API_TOKEN = "tok";
const db = require("./db"); db.load();
const { handle } = require("./server");
const srv = http.createServer((q, r) => handle(q, r).catch((e) => { r.statusCode = e.code || 500; r.end(); }));
let cookie = "";
const call = (method, url, body, headers = {}) => new Promise((res, rej) => {
  const data = body ? JSON.stringify(body) : null;
  const rq = http.request({ port: srv.address().port, method, path: url, headers: Object.assign({ cookie }, data ? { "Content-Type": "application/json" } : {}, headers) }, (r) => {
    let t = ""; r.on("data", (c) => (t += c)); r.on("end", () => res({ status: r.statusCode, text: t, headers: r.headers, json: () => JSON.parse(t) }));
  });
  rq.on("error", rej); if (data) rq.write(data); rq.end();
});
srv.listen(0, async () => {
  try {
    // seed is exported via main only; add one article directly through the API
    assert.strictEqual((await call("GET", "/")).status, 200);
    assert.strictEqual((await call("GET", "/about.html")).status, 200);
    assert.strictEqual((await call("GET", "/nope.html")).status, 404);
    for (const p of ["/server/server.js", "/data/db.json", "/blogger/posts/posts.json", "/package.json", "/Dockerfile", "/.git/config", "/%2e%2e/etc/passwd"]) assert.strictEqual((await call("GET", p)).status, 404, p);
    assert.strictEqual((await call("GET", "/api/admin/articles")).status, 401);
    assert.strictEqual((await call("POST", "/api/admin/login", { password: "bad" })).status, 401);
    const l = await call("POST", "/api/admin/login", { password: "test-pass" });
    assert.strictEqual(l.status, 200); cookie = l.headers["set-cookie"][0].split(";")[0];
    assert.strictEqual((await call("GET", "/api/admin/me")).status, 200);
    // article
    let a = await call("POST", "/api/admin/articles", { title: "Hello World", body: "## Hi\n\n**bold** [x](javascript:alert(1)) <script>", format: "md", published: true, description: "d" });
    assert.strictEqual(a.status, 200); a = a.json();
    assert.strictEqual(a.slug, "hello-world");
    assert.strictEqual((await call("POST", "/api/admin/articles", { title: "Hello World", body: "x" })).status, 400);
    const page = await call("GET", "/blog/hello-world");
    assert.strictEqual(page.status, 200); assert(page.text.includes("<h2>Hi</h2>")); assert(!page.text.includes("<script>")); assert(!page.text.includes('href="javascript'));
    assert(page.text.includes('rel="canonical" href="https://ahmedalgamal.tech/blog/hello-world"'));
    assert((await call("GET", "/blog")).text.includes("Hello World"));
    assert((await call("GET", "/sitemap.xml")).text.includes("/blog/hello-world"));
    assert.strictEqual((await call("GET", "/api/posts")).json().length, 1);
    await call("PUT", "/api/admin/articles/" + a.id, { published: false });
    assert.strictEqual((await call("GET", "/blog/hello-world")).status, 404);
    // lead
    assert.strictEqual((await call("POST", "/api/lead", { name: "Sam", phone: "971501234567", message: "hi" })).status, 200);
    assert.strictEqual((await call("POST", "/api/lead", { name: "Bot", website: "spam" })).status, 200);
    assert.strictEqual((await call("POST", "/api/lead", {})).status, 400);
    const leads = (await call("GET", "/api/admin/leads")).json();
    assert.strictEqual(leads.length, 1); assert.strictEqual(leads[0].status, "new");
    await call("PUT", "/api/admin/leads/" + leads[0].id, { status: "won", notes: "closed" });
    assert((await call("GET", "/api/admin/leads.csv")).text.includes("won"));
    // project
    await call("POST", "/api/admin/projects", { title: "Test <b>Project</b>", description: "d", tags: "A, B", published: true, url: "https://x.com" });
    const w = (await call("GET", "/work.html")).text;
    assert(w.includes("Test &lt;b&gt;Project&lt;/b&gt;") && !w.includes("ADMIN_PROJECTS"));
    // admin page + wrong cookie
    assert.strictEqual((await call("GET", "/admin")).status, 200);
    cookie = "sid=1.bad"; assert.strictEqual((await call("GET", "/api/admin/leads")).status, 401);
    console.log("All checks passed"); process.exit(0);
  } catch (e) { console.error(e); process.exit(1); }
});
