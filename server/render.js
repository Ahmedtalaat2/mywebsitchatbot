"use strict";
// Server-side HTML for blog pages and admin-added projects.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE = "https://ahmedalgamal.tech";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isRtl = (s) => /[؀-ۿ]/.test(String(s || ""));
const safeUrl = (u) => (/^(https?:\/\/|\/|#|mailto:)/i.test(u) ? u : "#");

function slugify(s) {
  return String(s || "").toLowerCase().trim().replace(/[^a-z0-9؀-ۿ]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

// Minimal Markdown: headings, bold, italic, links, images, lists, quotes, paragraphs.
function markdown(src) {
  const inline = (s) => esc(s)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, a, u) => '<img alt="' + a + '" src="' + safeUrl(u.replace(/&amp;/g, "&")) + '" loading="lazy">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => '<a href="' + safeUrl(u.replace(/&amp;/g, "&")) + '">' + t + "</a>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
  return String(src || "").replace(/\r/g, "").split(/\n{2,}/).map((b) => {
    b = b.trim();
    if (!b) return "";
    const h = b.match(/^(#{1,3})\s+(.+)$/);
    if (h) { const n = h[1].length === 3 ? 3 : 2; return "<h" + n + ">" + inline(h[2]) + "</h" + n + ">"; }
    const lines = b.split("\n");
    if (lines.every((l) => /^[-*]\s+/.test(l))) return "<ul>" + lines.map((l) => "<li>" + inline(l.replace(/^[-*]\s+/, "")) + "</li>").join("") + "</ul>";
    if (lines.every((l) => /^\d+\.\s+/.test(l))) return "<ol>" + lines.map((l) => "<li>" + inline(l.replace(/^\d+\.\s+/, "")) + "</li>").join("") + "</ol>";
    if (lines.every((l) => /^>\s?/.test(l))) return "<blockquote>" + inline(lines.map((l) => l.replace(/^>\s?/, "")).join(" ")) + "</blockquote>";
    return "<p>" + lines.map(inline).join("<br>") + "</p>";
  }).join("\n");
}

const articleHtml = (a) => (a.format === "md" ? markdown(a.body) : String(a.body || ""));
const imgUrl = (u) => (!u ? "" : /^https?:/i.test(u) ? u : "/" + String(u).replace(/^\/+/, "").replace(/^assets\/blog\//, "assets/blog/"));
const fmtDate = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

// Header and footer are taken from about.html, so the blog always matches the site.
let shell = null;
function getShell() {
  if (shell) return shell;
  const src = fs.readFileSync(path.join(ROOT, "about.html"), "utf8");
  const pick = (a, b) => src.slice(src.indexOf(a), src.indexOf(b) + b.length);
  shell = {
    header: pick('<header class="nav">', "</header>").replace(/ aria-current="page"/g, ""),
    footer: pick('<footer class="foot">', "</footer>"),
  };
  return shell;
}

function page({ title, description, path: p, body, lang = "en", image, jsonld, type = "website" }) {
  const s = getShell();
  const url = SITE + p;
  const og = image ? (/^https?:/i.test(image) ? image : SITE + image) : SITE + "/assets/img/og-image.jpg";
  const header = s.header.replace('<a href="/blog"', '<a aria-current="page" href="/blog"');
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<base href="/">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<meta name="author" content="Ahmed Al Gamal">
<meta name="theme-color" content="#1C2232">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="Ahmed Al Gamal">
<meta property="og:url" content="${esc(url)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(og)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Onest:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/site.css?v=11">
<style>
.blog-list{display:grid;gap:20px;grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}
.blog-list .post img{width:100%;aspect-ratio:16/9;object-fit:cover}
.article{max-width:760px;margin:0 auto}
.article .meta{color:var(--muted,#6b7280);font-size:.9rem;margin:0 0 12px}
.article .cover{width:100%;height:auto;border-radius:12px;margin:0 0 24px}
.article-body{font-size:1.08rem;line-height:1.8}
.article-body p,.article-body ul,.article-body ol{margin:0 0 1.1em}.article-body h2{margin:2em 0 .5em}.article-body h3{margin:1.6em 0 .4em}
.article-body img{max-width:100%;height:auto;border-radius:10px}
.article-body blockquote{margin:1.2em 0;padding:.2em 1em;border-inline-start:3px solid currentColor;opacity:.85}
.article-body table{border-collapse:collapse;width:100%}.article-body td,.article-body th{border:1px solid #8883;padding:8px}
</style>
${jsonld ? '<script type="application/ld+json">' + JSON.stringify(jsonld).replace(/</g, "\\u003c") + "</script>" : ""}
</head>
<body>
<a class="skip" href="${esc(p)}#main">Skip to content</a>
${header}
<main id="main">
${body}
</main>
${s.footer}
<script src="config.js?v=12"></script>
<script src="assets/site.js?v=12"></script>
</body>
</html>`;
}

function card(a) {
  const img = imgUrl(a.image);
  return `<a class="post" href="/blog/${esc(a.slug)}">${img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : ""}<div class="post-body"${a.lang === "ar" ? ' dir="rtl"' : ""}><time>${fmtDate(a.date)}</time><h3>${esc(a.title)}</h3><p>${esc(a.description)}</p></div></a>`;
}

function blogIndex(articles) {
  const body = `<section class="page-hero"><div class="wrap">
<p class="crumb"><a href="index.html">Home</a> / Blog</p>
<h1>Blog</h1>
<p class="lede">Practical notes on getting more leads and answering every one of them, fast. In English and Arabic.</p>
</div></section>
<section class="section"><div class="wrap">${articles.length ? '<div class="blog-list posts">' + articles.map(card).join("") + "</div>" : '<div class="empty">New articles are coming soon.</div>'}</div></section>`;
  return page({
    title: "Blog | Ahmed Al Gamal",
    description: "Articles on WhatsApp AI, lead generation and ads for UAE real estate brokers and traders, by Ahmed Al Gamal.",
    path: "/blog", body,
  });
}

function blogPost(a) {
  const img = imgUrl(a.image);
  const rtl = a.lang === "ar";
  const body = `<section class="section"><div class="wrap"><article class="article"${rtl ? ' dir="rtl"' : ""}>
<p class="crumb"><a href="index.html">Home</a> / <a href="/blog">Blog</a></p>
<h1>${esc(a.title)}</h1>
<p class="meta"><time datetime="${esc(String(a.date).slice(0, 10))}">${fmtDate(a.date)}</time> · Ahmed Al Gamal</p>
${img && !String(a.body).includes(img.split('/').pop()) ? '<img class="cover" src="' + esc(img) + '" alt="" width="1200" height="675">' : ""}
<div class="article-body">${articleHtml(a)}</div>
</article></div></section>`;
  return page({
    title: a.title + " | Ahmed Al Gamal",
    description: a.description,
    path: "/blog/" + a.slug, body, lang: rtl ? "ar" : "en", image: img, type: "article",
    jsonld: {
      "@context": "https://schema.org", "@type": "BlogPosting", headline: a.title, description: a.description,
      image: img ? (/^https?:/i.test(img) ? img : SITE + img) : undefined,
      datePublished: a.date, dateModified: a.updated || a.date, inLanguage: a.lang,
      mainEntityOfPage: SITE + "/blog/" + a.slug,
      author: { "@type": "Person", name: "Ahmed Al Gamal", url: SITE + "/" },
      publisher: { "@type": "Person", name: "Ahmed Al Gamal" },
    },
  });
}

const PILL = { live: ["hot", "Live"], current: ["hot", "Current"], dev: ["dev", "In development"], done: ["cold", "Completed"] };
function projectCard(p) {
  const pill = PILL[p.status] || PILL.live;
  const tags = (p.tags || []).map((t) => "<li>" + esc(t) + "</li>").join("");
  return `<article class="project">
      <div class="project-top"><ul class="tags">${tags}</ul><span class="pill ${pill[0]}">${pill[1]}</span></div>
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.description)}</p>
      ${p.url ? '<div class="actions"><a class="btn btn-ghost" href="' + esc(safeUrl(p.url)) + '"' + (/^https?:/i.test(p.url) ? ' target="_blank" rel="noopener"' : "") + ">" + esc(p.urlLabel || "Open") + "</a></div>" : ""}
    </article>`;
}

module.exports = { esc, slugify, markdown, blogIndex, blogPost, projectCard, SITE };
