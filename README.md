# ahmedalgamal.tech

Personal website of Ahmed Al Gamal: performance marketing and AI automation in Dubai.

Static pages plus a small Node server (no dependencies) for the blog, the admin and the CRM.

## Edit settings
All settings live in `config.js`: WhatsApp number, contact form endpoint (Google Apps Script),
n8n chat webhook, Blogger URL, and GA4 / Meta Pixel IDs.

## Pages
- `index.html` Home
- `real-estate.html` Jisrix Real Estate and brokerage services
- `trading.html` Jisrix Textiles, wholesale and furnishing
- `business.html` Online stores and local businesses
- `work.html` Projects
- `about.html` About
- `contact.html` Contact form
- `404.html` Not found page

Shared styles and scripts are in `assets/`.

## Admin, blog and CRM
- `/admin` is the admin page (password login). Tabs: Leads (CRM), Articles, Projects.
- `/blog` and `/blog/<slug>` are server-rendered from the admin articles (good for SEO). The 4 Blogger articles are copied in on first start.
- Contact form leads go to the CRM (and still to the Google Apps Script). n8n or any tool can add leads with
  `POST /api/lead` and header `X-Api-Key: <LEAD_API_TOKEN>`, JSON body `name, phone, email, service, message, source`.
- Projects added in the admin appear at the end of `work.html` (the marker `<!--ADMIN_PROJECTS-->`).
- Code: `server/` (server.js, db.js, render.js, admin.html). Data: JSON file in `DATA_DIR` (default `/app/data`). Run `npm test` for a smoke test.

### Coolify setup (needed before merging)
1. Build pack: **Dockerfile**, port **3000**.
2. Persistent storage: mount a volume at `/app/data` (keeps leads and articles between deploys).
3. Environment variables: `ADMIN_PASSWORD` (long password), optional `LEAD_API_TOKEN`. `SESSION_SECRET` optional.
4. Back up the volume sometimes (`db.json` plus `uploads/`).
