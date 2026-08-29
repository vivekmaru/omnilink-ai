# OmniLink AI - Production Deployment Guide

This guide covers production deployment strategies for OmniLink AI across **Unraid Server**, **Docker & Docker Compose**, **Fly.io**, **Railway / Render**, and **Cloudflare Tunnels**.

### Runtime safety (P1.1)

The server defaults to `OMNILINK_MODE=local` and listens on `127.0.0.1`. Remote bind hosts (including `0.0.0.0`) are refused until real application authentication middleware is implemented. Keep the default for single-user local testing. The temporary `OMNILINK_UNSAFE_ALLOW_REMOTE_NO_AUTH=true` override is intended only for trusted development networks and must not be used for public hosting. `OMNILINK_MODE=multi-user` does not by itself enable remote access or authentication.

> [!TIP]
> **Running Unraid Server?**
> See our dedicated [**Unraid Server Deployment & 1-Click Update Guide**](file:///Users/vivek/antigravity/OmniLink-AI---Smart-Link-Repository/docs/UNRAID_DEPLOYMENT_GUIDE.md) featuring native XML templates and automated GHCR workflows.

---

## 🎯 Architecture Requirement: Persistent Disk
OmniLink AI uses native **SQLite WAL** (`data/omnilink.db`) for high-speed lexical (FTS5) and dense vector search. Therefore, any deployment target must provide a **persistent directory/volume** mounted at `/app/data`.

---

## 🐳 Strategy 1: Docker & Docker Compose (VPS / HomeLab / Server) *(Recommended)*

### 1. Prerequisites
- Docker Engine & Docker Compose installed on your host (Ubuntu, Debian, macOS, Raspberry Pi, etc.).

### 2. Deployment Steps

```bash
# 1. Clone your repository
git clone https://github.com/your-username/omnilink-ai.git
cd omnilink-ai

# 2. Configure environment
cp .env.example .env
# Edit .env and set your GEMINI_API_KEY (optional, heuristic mode works without it)

# 3. Build and launch container in background
docker compose up -d --build

# 4. Check container status & logs
docker compose ps
docker compose logs -f
```

Your OmniLink AI instance will now be running at `http://localhost:3000` with the SQLite database safely persisted in `./data/`.

### 5. Reverse Proxy with Caddy (Automatic HTTPS)
If deploying on a VPS with a custom domain (`omnilink.yourdomain.com`), use Caddy for automatic SSL:

```caddy
# /etc/caddy/Caddyfile
omnilink.yourdomain.com {
    reverse_proxy localhost:3000
}
```

---

## ☁️ Strategy 2: Fly.io Deployment

Fly.io provides global container hosting with low-latency NVMe persistent volumes.

### 1. Install Flyctl & Login
```bash
brew install flyctl
fly auth login
```

### 2. Initialize Fly App
```bash
fly launch --no-deploy
```

### 3. Create a Persistent Disk Volume
```bash
# Create a 3GB persistent disk named 'omnilink_data'
fly volumes create omnilink_data --size 3
```

### 4. Configure `fly.toml`
Update your `fly.toml` to attach the volume to `/app/data`:

```toml
app = "omnilink-ai"
primary_region = "ord"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "3000"

[mounts]
  source = "omnilink_data"
  destination = "/app/data"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[[http_service.checks]]
  grace_period = "10s"
  interval = "30s"
  method = "GET"
  timeout = "5s"
  path = "/health"
```

### 5. Set Secrets & Deploy
```bash
fly secrets set GEMINI_API_KEY="your-gemini-api-key"
fly deploy
```

---

## 🔒 Strategy 3: Local Server + Cloudflare Tunnel (Free HTTPS for Mobile)

Run OmniLink locally on your Mac, HomeLab, or mini-PC and expose it securely to your mobile phone via Cloudflare Tunnels (no open firewall ports required).

### 1. Install Cloudflared
```bash
brew install cloudflared
```

### 2. Login to Cloudflare
```bash
cloudflared tunnel login
```

### 3. Create a Tunnel
```bash
cloudflared tunnel create omnilink-tunnel
```

### 4. Route DNS
```bash
cloudflared tunnel route dns omnilink-tunnel omnilink.yourdomain.com
```

### 5. Run the Tunnel
```bash
cloudflared tunnel run --url http://localhost:3000 omnilink-tunnel
```

Now you can open `https://omnilink.yourdomain.com` in Safari on your iPhone, tap **Add to Home Screen**, and use the native mobile Share Sheet from anywhere in the world!

---

## 🛡️ Backup & Disaster Recovery

### 1. Automatic Database Backups
All bookmarks and vector embeddings are stored in `data/omnilink.db`. To take an instant atomic backup while the server is running:

```bash
# Using SQLite backup API
sqlite3 data/omnilink.db ".backup 'data/omnilink-backup-$(date +%Y%m%d).db'"
```

### 2. Client-Side Zero-Knowledge Vault Export
In the web UI, press `⌘B` &rarr; Enter a passphrase &rarr; Click **Download Encrypted Vault (`.omnilink.enc`)**. This creates a 256-bit AES-GCM encrypted portable backup file.
