# OmniLink AI - Chrome Companion Extension (Manifest V3)

A Chrome Extension for OmniLink AI that provides 1-click bookmarking, right-click context menu saving, Omnibox address bar search (`ol <query>`), and a native Side Panel dashboard.

---

## 🚀 Quick Setup (Load Unpacked)

1. Open Google Chrome (or Brave / Edge / Arc / Chromium).
2. In the URL bar, go to:
   ```
   chrome://extensions
   ```
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select this `extension` folder:
   ```
   /Users/vivek/antigravity/OmniLink-AI---Smart-Link-Repository/extension
   ```
6. The **OmniLink AI** icon will now appear in your browser extensions bar!

---

## ⚡ Features & Capabilities

- **1-Click Save Popup**: Click the toolbar icon on any page to review detected tags, category, and save with Gemini AI extraction.
- **Omnibox Address Bar Search**: Type `ol <keyword>` into Chrome's address bar (e.g. `ol sqlite` or `ol rag`) &rarr; suggestions appear with live hybrid rankings &rarr; press `Enter` to jump directly to the link.
- **Native Side Panel Companion**: Open the side panel from the popup or right-click context menu to search your repository and save tabs without leaving your current workspace.
- **Right-Click Context Menu**:
  - *"Save Page to OmniLink AI"*
  - *"Save Link to OmniLink AI"*
  - *"Save Selection to OmniLink as Key Note"*
  - *"Open OmniLink Side Panel"*
- **Customizable Host URL**: Works with `http://localhost:3000` by default or any remote OmniLink deployment.
