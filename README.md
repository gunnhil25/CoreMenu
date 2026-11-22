# 🍽️ CoreMenu — Self-Hosted Recipe Book, Meal Prep & Smart Grocery Engine

> Self-hosted household **Recipe Book**, **Hands-Free Cook Mode**, **Weekly Meal Prep Planner**, **Pantry & Leftover Stash**, and **Smart Aisle-Grouped Grocery List** built as part of the **Core** homelab suite alongside **CoreNest** and **CoreCapital**.

Built with **Next.js 15 (Node.js 22 standalone)**, **PostgreSQL 16**, and **Drizzle ORM**, fully containerized with **Docker** and automatically tested & published to GitHub Container Registry (`ghcr.io/gunnhil25/coremenu:latest`) via GitHub Actions.

---

## 🚀 Quick Start (Prebuilt Image via GHCR)

```bash
# 1. Clone this repository
git clone https://github.com/gunnhil25/CoreMenu.git
cd CoreMenu

# 2. Customize PostgreSQL passwords, AUTH_SECRET, or PORT (defaults to 3002)
cp .env.example .env

# 3. Pull the latest images and start the stack
docker compose pull
docker compose up -d
```

Once running:
* **Web Application:** `http://<YOUR_SERVER_IP>:3002/` — On first launch, PostgreSQL migrations run automatically (`src/db/migrations`) and redirect to **`/setup`** (First-Run Wizard) to create your household admin account and choose **Load Demo Recipes & Plan** or **Start Clean**.
* **Health Check:** `http://<YOUR_SERVER_IP>:3002/api/health`

> **Port Assignment Across the Core Suite:** CoreCapital defaults to `3000`, CoreNest defaults to `8000`, and CoreMenu defaults to `3002` (override `PORT=` in `.env` anytime).

### Building Locally from Source
```bash
docker compose up -d --build
```

### Updating to the Latest Release
```bash
docker compose pull
docker compose up -d
```

---

## 📦 Proxmox LXC Deployment Guide

1. **Enable LXC features for Docker:**
   - In the Proxmox VE Web UI, select your LXC container → **Options** → **Features**.
   - Enable **`nesting=1`** and **`keyctl=1`**, then reboot the LXC if prompted.
2. **Install Docker & Docker Compose plugin inside the LXC:**
   ```bash
   apt-get update && apt-get install -y curl git
   curl -fsSL https://get.docker.com | sh
   ```
3. **Clone and configure CoreMenu:**
   ```bash
   git clone https://github.com/gunnhil25/CoreMenu.git /opt/coremenu
   cd /opt/coremenu
   cp .env.example .env
   nano .env
   ```
4. **Launch stack & verify health:**
   ```bash
   docker compose pull
   docker compose up -d
   curl -s http://localhost:3002/api/health
   ```
   You should see `"status":"ok"` and `"database":"connected"`.

### Optional: Exposing via Cloudflare Tunnel (`cloudflared`)
```bash
cloudflared tunnel route dns coremenu menu.yourdomain.com
cloudflared tunnel run coremenu --url http://localhost:3002
```
CoreMenu inspects `X-Forwarded-Proto` automatically for `HttpOnly` session cookies, so plain HTTP on your LAN works out of the box while HTTPS reverse proxies automatically enforce `Secure` cookies (or override with `COOKIE_SECURE=true|false`).

---

## 📦 Core Feature Modules

### 1. Recipe Book & Structured Editor
* **Rich Recipe Cards & Filtering**: Search by title, ingredient, cuisine, or tag; filter by meal type, favorites, high protein (`30g+`), or cook time (`<30m`); sort by rating, quickest, least recently cooked, or lowest cost per serving.
* **Dynamic Serving Scaler & Unit Converter**: Scale recipes up/down on the fly (e.g. `2` → `6` meal-prep containers) and convert ingredients + step temperatures between **Metric** (`g`, `ml`, `°C`) and **Imperial** (`oz`, `lb`, `cup`, `°F`).
* **Recipe URL & Plain Text Importer**: Paste a recipe URL to parse `schema.org/Recipe` JSON-LD metadata (title, photo, ISO-8601 times, yield, nutrition, ingredients, steps, auto-detected timers) with SSRF protection, or paste plain text offline.
* **Local Photo Uploads**: Store dish photos directly on the `coremenu_uploads` Docker volume (`/app/data/uploads`) — no external image hosts required.

### 2. Hands-Free Cook Mode
* Distraction-free step-by-step Kitchen View with keyboard `←` / `→` navigation, Screen **Wake Lock** support, collapsible scaled ingredient checklist, and floating multi-timers initialized directly from step durations with audio completion chimes.

### 3. Weekly Meal Prep Planner & Templates
* 7-day Monday–Sunday calendar supporting **Breakfast**, **Lunch**, **Dinner**, **Snack**, and **Batch Prep** slots, plus **Leftover Stash** slots.
* Live daily calorie & protein totals compared against your personal nutrition goals.
* Save and reapply reusable weekly rotation templates in one click.

### 4. Smart Grocery List Generator
* Aggregates ingredients across any meal-plan date range, **automatically scaling and merging duplicate ingredients** (e.g. `400g` + `180g` + `240g` jasmine rice → `820g`).
* Groups items by **Supermarket Aisle** or **Store** (`Woolworths`, `Coles`, `Aldi`, `Butcher`, `Asian Grocer`, etc.) with 1-tap **Quick Staples**, mobile tap-to-check rows, and offline `localStorage` caching.
* **CoreCapital / CoreNest Synergy**: Tracks estimated basket spend vs weekly budget, records actual receipt totals on completion, and exports **CSV / JSON** ready for financial tracking.

### 5. Pantry Inventory, "What Can I Cook?" & Leftover Stash
* Track pantry, fridge, freezer, and spice quantities with expiry warnings and **Always-Stocked Staple** flags so the grocery generator can flag, subtract, or skip on-hand items.
* **"What Can I Cook?"** ranks your recipes by pantry ingredient match percentage.
* **Batch-Cook & Leftover Stash** tracks prepped fridge/freezer containers and lets you decrement portions (`-1 Eaten`) or slot leftovers onto the weekly planner.

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgres://coremenu_user:...@db:5432/coremenu` | PostgreSQL 16 connection URL |
| `UPLOAD_DIR` | `/app/data/uploads` | Local directory for uploaded recipe photos |
| `AUTH_SECRET` | `change_me_auth_secret_key` | HMAC-SHA256 session cookie signing key |
| `COOKIE_SECURE` | *(auto)* | Set `true` or `false` to override `X-Forwarded-Proto` auto-detection |
| `PORT` | `3002` | Host port mapped to container port `3000` |
| `COREMENU_USE_IN_MEMORY` | *(unset)* | Set `true` to run with an in-memory store (used for standalone E2E) |

---

## 🗄️ Database Management & Backups

### PostgreSQL Backup & Restore
```bash
# Backup
docker exec -t coremenu-db pg_dump -U coremenu_user coremenu > coremenu_backup_$(date +%F).sql

# Restore
cat coremenu_backup_YYYY-MM-DD.sql | docker exec -i coremenu-db psql -U coremenu_user coremenu
```

### In-App Portable Exports
* **JSON Full Backup**: **Settings → Backups & Export → Export Full JSON Backup** (`coremenu-v1` schema).
* **Markdown Cookbook**: Export any single recipe or your entire cookbook as portable `.md` files with YAML frontmatter.
* **Grocery CSV / JSON**: Export any grocery list as CSV or JSON from **Grocery Lists → Export CSV**.

---

## 🧪 Development & Verification

```bash
npm install
npx tsc --noEmit
npm test
npm run build
npm run test:e2e
```
