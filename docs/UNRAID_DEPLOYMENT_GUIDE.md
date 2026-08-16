# OmniLink AI — Unraid Server Deployment & Update Guide

This guide details how to deploy **OmniLink AI** on your **Unraid Server** with persistent storage and configure it so that applying future updates is effortless (either with **1-click in the Unraid GUI** or **fully automated via Watchtower/CA Auto Update**).

---

## Architecture Overview on Unraid

```
┌────────────────────────────────────────────────────────────────────────┐
│                              UNRAID SERVER                             │
│                                                                        │
│   ┌────────────────────────┐         ┌──────────────────────────────┐  │
│   │   Unraid WebUI / CA    │         │  Nginx Proxy Manager /       │  │
│   │   (Docker Dashboard)   │         │  Cloudflare Tunnel (HTTPS)   │  │
│   └───────────┬────────────┘         └──────────────┬───────────────┘  │
│               │                                     │                  │
│               ▼                                     ▼                  │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │             OmniLink AI Container (Port 3000)                  │   │
│   │    - Express & SQLite WAL Engine                               │   │
│   │    - Gemini 3.7 Flash Link Extractor                           │   │
│   │    - Built-in MCP Server (STDIO) & Offline Reader              │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │ Persistent Mount                   │
│                                   ▼                                    │
│        /mnt/user/appdata/omnilink/data (Cache Pool / Array)            │
│        ├── omnilink.db         (SQLite Database & Vector BLOBs)        │
│        ├── omnilink.db-wal     (WAL Journal)                           │
│        └── backups/            (Automated Backups)                     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Method 1: Unraid Docker Template (Recommended — 1-Click GUI Updates)

Using a custom Unraid template connected to a pre-built container registry (such as **GitHub Container Registry `ghcr.io`**) gives you native integration with Unraid's Docker page. When an update is published, Unraid will automatically show **"update ready"** next to OmniLink AI.

### Step 1: Automated Image Publishing via GitHub

This repository includes a pre-configured GitHub Actions workflow ([`.github/workflows/docker-publish.yml`](file:///Users/vivek/antigravity/OmniLink-AI---Smart-Link-Repository/.github/workflows/docker-publish.yml)).

1. Push this repository to your GitHub account (public or private).
2. GitHub Actions will automatically compile the multi-arch container image and push it to:
   ```text
   ghcr.io/<your-github-username>/omnilink-ai:latest
   ```
3. In GitHub, go to your repository **Packages** $\rightarrow$ **omnilink-ai** $\rightarrow$ **Package settings** and set the visibility to **Public** (or create a Personal Access Token with `read:packages` if keeping it private).

### Step 2: Add the Template in Unraid

1. Open your **Unraid WebGUI** and navigate to the **Docker** tab.
2. Scroll to the bottom and click **Add Container**.
3. Fill in the template fields (or import the XML from [`unraid/omnilink-ai.xml`](file:///Users/vivek/antigravity/OmniLink-AI---Smart-Link-Repository/unraid/omnilink-ai.xml)):

| Field | Value | Notes |
| :--- | :--- | :--- |
| **Name** | `omnilink-ai` | Container name in Unraid |
| **Repository** | `ghcr.io/<your-username>/omnilink-ai:latest` | Your GitHub container image |
| **Network Type** | `bridge` | Standard Unraid bridge |
| **WebUI** | `http://[IP]:[PORT:3000]/` | Enables clicking WebUI in Unraid |
| **Port Mapping** | Host: `3000` $\rightarrow$ Container: `3000` | Change host port if 3000 is occupied |
| **Path: /app/data** | `/mnt/user/appdata/omnilink/data` | Stores SQLite DB and indices on cache pool |
| **Variable: GEMINI_API_KEY** | `AIzaSy...` | Get free key at [aistudio.google.com](https://aistudio.google.com) |
| **Variable: APP_URL** | `http://<unraid-ip>:3000` (or `https://links.yourdomain.com`) | Public URL for PWA/Shortcuts |
| **Extra Parameters** | `--restart unless-stopped` | Auto-restarts on server reboot |

4. Click **Apply**. Unraid will pull the image and launch the container.

---

## How to Apply Updates in the Future

### 1-Click Update from Unraid WebUI (Manual)
Whenever you commit code to your GitHub repo:
1. GitHub Actions builds and pushes the updated image to `ghcr.io` within 1-2 minutes.
2. In Unraid, go to the **Docker** tab.
3. Unraid will display **`apply update`** next to `omnilink-ai`.
4. Click **Apply Update**. Unraid will pull the new image and restart the container seamlessly. All bookmarks, vectors, and configurations remain untouched in `/mnt/user/appdata/omnilink/data`.

---

### Automated Updates (Hands-Off)

#### Option A: Unraid CA Auto Update Applications Plugin (Recommended)
1. In Unraid, go to **Apps** and search for **CA Auto Update Applications**.
2. Install the plugin and go to **Settings** $\rightarrow$ **Auto Update Applications**.
3. Toggle `omnilink-ai` to **Auto Update: Yes**.
4. Set your preferred update schedule (e.g. daily at 04:00 AM).

#### Option B: Watchtower Docker Container
If you already run Watchtower on Unraid, simply add the label to enable automatic updates:
```bash
docker run -d \
  --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower --interval 86400
```

---

## Method 2: Unraid Docker Compose (Docker Compose Manager Plugin)

If you prefer managing stacks with Docker Compose:

1. Install the **Docker Compose Manager** plugin from the Unraid **Apps** tab.
2. Go to **Docker** $\rightarrow$ **Compose Stacks** $\rightarrow$ **Add New Stack**.
3. Name it `omnilink`.
4. Edit the `docker-compose.yml` and paste the contents of [`unraid/docker-compose.yml`](file:///Users/vivek/antigravity/OmniLink-AI---Smart-Link-Repository/unraid/docker-compose.yml):

```yaml
services:
  omnilink-ai:
    image: ghcr.io/YOUR_GITHUB_USERNAME/omnilink-ai:latest
    container_name: omnilink-ai
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - GEMINI_API_KEY=YOUR_GEMINI_API_KEY
      - APP_URL=http://YOUR_UNRAID_IP:3000
      - AUTO_BACKUP_DAYS=7
    volumes:
      - /mnt/user/appdata/omnilink/data:/app/data
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
```

5. Click **Compose Up**.
6. **To update**: Click **Pull & Update** in the Compose Manager UI or run:
   ```bash
   cd /boot/config/plugins/dockerMan/compose/omnilink && docker compose pull && docker compose up -d
   ```

---

## Method 3: Local Git Clone on Unraid (Build Directly on Server)

If you do not want to use GitHub Container Registry and want to build directly on your Unraid server:

1. SSH into your Unraid server:
   ```bash
   ssh root@<unraid-ip>
   ```
2. Clone the repository into your appdata or custom directory:
   ```bash
   mkdir -p /mnt/user/appdata/omnilink-src
   git clone https://github.com/<your-username>/omnilink-ai.git /mnt/user/appdata/omnilink-src
   cd /mnt/user/appdata/omnilink-src
   ```
3. Create your `.env` file:
   ```bash
   echo "GEMINI_API_KEY=your_key_here" > .env
   echo "PORT=3000" >> .env
   ```
4. Build and start via Docker Compose:
   ```bash
   docker compose -f unraid/docker-compose.yml up -d --build
   ```
5. **To update in the future**:
   ```bash
   cd /mnt/user/appdata/omnilink-src
   git pull
   docker compose -f unraid/docker-compose.yml up -d --build
   ```
   *(You can also automate this via Unraid's **User Scripts** plugin to run on a weekly cron schedule!)*

---

## Remote Access & Reverse Proxy (HTTPS)

To use the **Chrome Extension**, **iOS/Android Share Target**, and access OmniLink from outside your home network:

### Nginx Proxy Manager (NPM) on Unraid
1. Create a Proxy Host in NPM:
   - **Domain Names**: `links.yourdomain.com`
   - **Scheme**: `http`
   - **Forward Hostname / IP**: `<unraid-server-ip>`
   - **Forward Port**: `3000`
   - **Websockets Support**: `Enabled` (for real-time sync)
   - **SSL**: Request a Let's Encrypt Certificate (Force SSL `ON`, HTTP/2 `ON`).
2. Update the `APP_URL` environment variable in your Unraid container settings:
   ```text
   APP_URL=https://links.yourdomain.com
   ```

### Cloudflare Tunnel (Zero Trust)
1. Add a Public Hostname in your Cloudflare Zero Trust Dashboard:
   - **Subdomain**: `links`
   - **Domain**: `yourdomain.com`
   - **Service**: `HTTP` $\rightarrow$ `<unraid-server-ip>:3000`
2. Set `APP_URL=https://links.yourdomain.com`.

---

## Backup & Data Safety on Unraid

All SQLite databases, WAL files, and vector indices reside in `/mnt/user/appdata/omnilink/data`.

1. **Unraid CA Appdata Backup Plugin**:
   - Install **Appdata Backup** from Unraid Community Applications.
   - Include `/mnt/user/appdata/omnilink` in your scheduled backup routine.
2. **In-App Encrypted Backups**:
   - Use OmniLink's built-in **Encrypted Vault Export** (`⌘B`) anytime to download an AES-GCM encrypted `.omnilink` snapshot.

---

## Troubleshooting & Verification

| Issue | Resolution |
| :--- | :--- |
| **Container shows unhealthy** | Check container logs in Unraid: `docker logs omnilink-ai`. Verify `/mnt/user/appdata/omnilink/data` has write permissions. |
| **Port 3000 is already in use** | Change the **Host Port** in Unraid template settings to `3080` or `4000` (leave container port as `3000`). |
| **Gemini AI not extracting** | Verify `GEMINI_API_KEY` is set without quotes and that your Unraid server has outbound internet access. |
| **Database locked error** | SQLite WAL mode is enabled by default. Ensure your appdata share is on an XFS or BTRFS Cache pool (avoid NFS/SMB remote mounts). |
