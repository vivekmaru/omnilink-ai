# OmniLink AI - Chrome Extension & Omnibox Companion Guide

The OmniLink AI Chrome Extension (Manifest V3) connects your desktop browser directly to your local or hosted OmniLink repository, enabling 1-click tab saving, Omnibox address bar search (`ol <query>`), a native Side Panel dashboard, and right-click context menu capture.

---

## 📦 Installation (Load Unpacked)

1. Open Google Chrome (or Brave, Edge, Arc, Chromium).
2. In the URL bar, navigate to:
   ```
   chrome://extensions
   ```
3. In the top-right corner, toggle **Developer mode** to **ON**.
4. In the top-left corner, click **Load unpacked**.
5. Select the `extension` folder in your OmniLink project:
   ```
   /Users/vivek/antigravity/OmniLink-AI---Smart-Link-Repository/extension
   ```
6. The **OmniLink AI** icon will appear in your browser toolbar! Click the puzzle icon in Chrome to pin it to your toolbar.

---

## ⚡ Core Features

### 1. Omnibox Address Bar Search (`ol <keyword>`)
You can search your OmniLink bookmarks directly from Chrome's URL bar without opening the app:

1. Click Chrome's URL address bar (or press `Cmd + L` / `Ctrl + L`).
2. Type `ol` followed by a space.
3. Type your search query (e.g. `ol sqlite`, `ol rag`, `ol design`).
4. OmniLink will run real-time hybrid search and populate Chrome's suggestion list.
5. Use arrow keys to select a result and hit `Enter` to navigate directly!

---

### 2. Native Chrome Side Panel Companion
Open a permanent companion sidebar while browsing documentation or research:

1. Click the OmniLink toolbar icon &rarr; click **"Open OmniLink Side Panel"** (or right-click anywhere on a webpage &rarr; **"Open OmniLink Side Panel"**).
2. The side panel displays:
   - Live hybrid search bar across your bookmarks.
   - Recent bookmarks list with tags and categories.
   - **"+ Save Current Tab"** button for 1-click archiving while browsing.
   - Direct link to open full OmniLink web app.

---

### 3. 1-Click Popup Saver
Click the toolbar icon on any active tab:
- Automatically pre-fills current URL and Page Title.
- Real-time heuristic tagger automatically detects categories (e.g. GitHub repos, ArXiv papers, Reddit threads, React/Rust/AI topics).
- Add personal notes, takeaways, or quotes.
- Click **"Save to OmniLink"** &rarr; instantly queued for Gemini Flash extraction and vector indexing.

---

### 4. Right-Click Context Menus
Highlight any text or right-click any link on the web:
- **Save Page to OmniLink AI**: Saves the active webpage.
- **Save Link to OmniLink AI**: Saves the hyperlinked destination directly.
- **Save Selection to OmniLink as Key Note**: Saves the page with the highlighted text captured as an excerpt.
- **Open OmniLink Side Panel**: Launches the side panel dashboard.

---

### 5. Connecting to a Remote or Custom OmniLink Server
By default, the extension connects to `http://localhost:3000`. To point to a custom domain or LAN address:
1. Click the OmniLink toolbar icon.
2. Click **⚙️ Connection Settings** at the bottom of the popup.
3. Enter your custom server URL (e.g. `https://omnilink.my-domain.com`).
4. Click **Save Host**.
