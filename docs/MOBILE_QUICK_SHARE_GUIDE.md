# OmniLink AI - Mobile Quick Share & Ingress Guide

OmniLink AI provides cross-platform mobile capture capabilities so you can bookmark links directly from Reddit, Instagram, YouTube, X/Twitter, and Safari/Chrome on your phone in $< 2$ seconds.

---

## 📱 Method 1: Native Share Sheet (PWA Web Share Target)

The W3C Web Share Target API allows OmniLink to register directly with iOS and Android operating systems as a native share destination.

### Setup on iOS (Safari):
1. Open your OmniLink instance in Safari (e.g. `http://<your-lan-ip>:3000` or your hosted domain).
2. Tap the Safari **Share** icon at the bottom of the screen.
3. Select **Add to Home Screen**.
4. Name the app **OmniLink AI** and tap **Add**.

### Setup on Android (Chrome):
1. Open OmniLink in Google Chrome on your Android device.
2. Tap the three-dot menu (**⋮**) in the top-right.
3. Tap **Install app** or **Add to Home screen**.

### How to Use:
When browsing Reddit, Instagram Reels, Twitter/X, or YouTube on your phone:
1. Tap your phone's native **Share** button.
2. Choose **OmniLink AI** from your app list.
3. OmniLink automatically opens, pre-fills the URL and title, runs Gemini AI categorization in the background, and saves it to your inbox!

---

## ⚡ Method 2: Apple Shortcuts Automation (iOS / iPadOS / macOS)

For instant 1-tap capture without opening the browser interface:

### 3-Step Shortcut Configuration:

1. **Step 1 — Input Configuration**:
   - Open the **Shortcuts** app on your iPhone, iPad, or Mac.
   - Tap **+** to create a new shortcut.
   - Tap the shortcut details (or `(i)`) and enable **Show in Share Sheet**.
   - Under *Receive*, select **URLs**, **Web pages**, and **Text**.

2. **Step 2 — Get Contents of URL (POST)**:
   - Add the **Get Contents of URL** action.
   - **URL**: `http://<your-host>:3000/api/share/quick`
   - **Method**: `POST`
   - **Headers**: `Content-Type: application/json`
   - **Request Body**: `JSON`
     - Add field `url` (Type: `Text`) &rarr; value: **Shortcut Input**

3. **Step 3 — Confirmation Notification**:
   - Add action **Show Notification**.
   - Set text to: `Saved to OmniLink & AI Extracted` (with Subtitle: *Shortcut Input*).

---

## 🤖 Method 3: Webhook Ingress (cURL, Raycast, Telegram, Discord)

OmniLink exposes a fast headless ingress endpoint: `POST /api/share/quick`.

### cURL Example:
```bash
curl -X POST "http://localhost:3000/api/share/quick" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://github.com/astral-sh/uv",
    "title": "Astral UV",
    "notes": "Saved from mobile terminal"
  }'
```

### JSON Response:
```json
{
  "success": true,
  "message": "Saved: \"Astral UV\"",
  "link": {
    "id": "link-1723730000000-abc12",
    "url": "https://github.com/astral-sh/uv",
    "title": "Astral UV",
    "category": "Dev & Tech",
    "tags": ["mobile-share", "inbox"],
    "readStatus": "unread"
  }
}
```

### Raycast Script Command:
Create a Raycast script command to quickly bookmark the active browser tab:
```bash
#!/bin/bash
# @raycast.schemaVersion 1
# @raycast.title Save Active Tab to OmniLink
# @raycast.mode silent

FRONT_URL=$(osascript -e 'tell application "Google Chrome" to get URL of active tab of front window')
FRONT_TITLE=$(osascript -e 'tell application "Google Chrome" to get title of active tab of front window')

curl -s -X POST "http://localhost:3000/api/share/quick" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$FRONT_URL\", \"title\": \"$FRONT_TITLE\"}"

echo "Saved to OmniLink!"
```
