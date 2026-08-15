import JSZip from 'jszip';

export interface ExtensionConfig {
  appUrl: string;
  defaultCategory?: string;
}

export function generateExtensionZip(config: ExtensionConfig): Promise<Blob> {
  const zip = new JSZip();

  const manifest = {
    manifest_version: 3,
    name: 'OmniLink AI - Quick Link Saver',
    version: '1.0.0',
    description: 'Instantly save and organize Instagram shorts, Reddit posts/comments, GitHub repos, articles & videos with AI extraction directly into your OmniLink repository.',
    permissions: ['activeTab', 'storage', 'contextMenus'],
    action: {
      default_popup: 'popup.html',
      default_icon: {
        '16': 'icon16.png',
        '48': 'icon48.png',
        '128': 'icon128.png',
      },
    },
    background: {
      service_worker: 'background.js',
    },
    icons: {
      '16': 'icon16.png',
      '48': 'icon48.png',
      '128': 'icon128.png',
    },
  };

  const popupHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { width: 340px; background: #090a0f; color: #f1f5f9; padding: 16px; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid #1e293b; padding-bottom: 10px; }
    .logo { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; color: #38bdf8; }
    .status { font-size: 11px; color: #10b981; background: rgba(16, 185, 129, 0.1); padding: 2px 8px; border-radius: 999px; }
    .field { margin-bottom: 10px; }
    label { display: block; font-size: 11px; color: #94a3b8; margin-bottom: 4px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
    input, select, textarea { width: 100%; background: #131722; border: 1px solid #334155; border-radius: 6px; padding: 8px 10px; color: #f8fafc; font-size: 12px; }
    input:focus, select:focus, textarea:focus { outline: none; border-color: #38bdf8; ring: 1px solid #38bdf8; }
    .btn { width: 100%; background: #0284c7; hover: background: #0369a1; color: #fff; border: none; border-radius: 6px; padding: 9px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: background 0.15s; }
    .btn:hover { background: #0369a1; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .tags-container { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
    .tag { background: #1e293b; color: #93c5fd; font-size: 10px; padding: 2px 6px; border-radius: 4px; }
    .badge { display: inline-block; font-size: 10px; padding: 2px 6px; border-radius: 4px; background: #334155; color: #cbd5e1; margin-bottom: 8px; }
    .success-msg { display: none; background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #6ee7b7; padding: 8px; border-radius: 6px; font-size: 12px; text-align: center; margin-top: 10px; }
    .error-msg { display: none; background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #fca5a5; padding: 8px; border-radius: 6px; font-size: 12px; text-align: center; margin-top: 10px; }
    .spinner { border: 2px solid rgba(255,255,255,0.2); border-left-color: #fff; border-radius: 50%; width: 12px; height: 12px; animation: spin 1s linear infinite; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
      OmniLink AI
    </div>
    <span class="status">Connected</span>
  </div>

  <div id="loading" style="text-align: center; padding: 20px; font-size: 12px; color: #94a3b8;">
    Detecting active tab...
  </div>

  <div id="form" style="display: none;">
    <div class="field">
      <label>URL</label>
      <input type="text" id="url" readonly style="opacity: 0.8; font-size: 11px;">
    </div>
    <div class="field">
      <label>Title</label>
      <input type="text" id="title" placeholder="Page title">
    </div>
    <div class="field">
      <label>Category</label>
      <select id="category">
        <option value="Dev & Tech">Dev & Tech</option>
        <option value="AI & Machine Learning">AI & Machine Learning</option>
        <option value="Design & UI">Design & UI</option>
        <option value="Reddit Discussions">Reddit Discussions</option>
        <option value="Instagram & Social">Instagram & Social</option>
        <option value="Tutorials & Guides">Tutorials & Guides</option>
        <option value="Research & Papers">Research & Papers</option>
        <option value="Productivity">Productivity</option>
        <option value="Other">Other</option>
      </select>
    </div>
    <div class="field">
      <label>Tags (comma separated)</label>
      <input type="text" id="tags" placeholder="e.g. react, tutorial, tools">
    </div>
    <div class="field">
      <label>Personal Notes (optional)</label>
      <textarea id="notes" rows="2" placeholder="Why is this interesting?"></textarea>
    </div>

    <button id="saveBtn" class="btn">
      <span>Save with AI Extraction</span>
    </button>

    <div id="successMsg" class="success-msg">✓ Link saved & AI queued!</div>
    <div id="errorMsg" class="error-msg">Failed to save link. Check connection.</div>
  </div>

  <script src="popup.js"></script>
</body>
</html>`;

  const popupJs = `const APP_URL = "${config.appUrl || 'http://localhost:3000'}";

document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('loading');
  const form = document.getElementById('form');
  const urlInput = document.getElementById('url');
  const titleInput = document.getElementById('title');
  const categorySelect = document.getElementById('category');
  const tagsInput = document.getElementById('tags');
  const notesInput = document.getElementById('notes');
  const saveBtn = document.getElementById('saveBtn');
  const successMsg = document.getElementById('successMsg');
  const errorMsg = document.getElementById('errorMsg');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      loading.textContent = 'No active webpage found.';
      return;
    }

    urlInput.value = tab.url;
    titleInput.value = tab.title || '';

    // Real-time title/URL keyword auto-tagging for extension popup
    const updateSuggestions = () => {
      const fullText = (titleInput.value + ' ' + urlInput.value).toLowerCase();
      const detectedTags = [];
      if (/react|nextjs|vue|svelte|angular/.test(fullText)) detectedTags.push('frontend');
      if (/sqlite|postgres|database|sql|redis|db/.test(fullText)) detectedTags.push('database');
      if (/llm|gemini|openai|gpt|claude|agent|rag|ai/.test(fullText)) {
        detectedTags.push('ai');
        categorySelect.value = 'AI & Machine Learning';
      }
      if (/design|ui|ux|css|tailwind|figma/.test(fullText)) {
        detectedTags.push('design');
        categorySelect.value = 'Design & UI';
      }
      if (/tutorial|guide|walkthrough|how to|course/.test(fullText)) {
        detectedTags.push('tutorial');
        categorySelect.value = 'Tutorials & Guides';
      }
      if (url.includes('github.com')) {
        categorySelect.value = 'Dev & Tech';
        detectedTags.push('github', 'open-source');
      } else if (url.includes('reddit.com')) {
        categorySelect.value = 'Reddit Discussions';
        detectedTags.push('reddit');
      } else if (url.includes('instagram.com')) {
        categorySelect.value = 'Instagram & Social';
        detectedTags.push('instagram', 'reels');
      } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
        categorySelect.value = 'Tutorials & Guides';
        detectedTags.push('youtube');
      } else if (url.includes('arxiv.org')) {
        categorySelect.value = 'Research & Papers';
        detectedTags.push('research-paper');
      }

      if (detectedTags.length > 0) {
        const existing = tagsInput.value ? tagsInput.value.split(',').map(t => t.trim().toLowerCase()) : [];
        const merged = Array.from(new Set([...existing, ...detectedTags])).filter(Boolean);
        tagsInput.value = merged.join(', ');
      }
    };

    updateSuggestions();
    titleInput.addEventListener('input', updateSuggestions);

    loading.style.display = 'none';
    form.style.display = 'block';

    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<div class="spinner"></div> Saving & Analyzing...';
      successMsg.style.display = 'none';
      errorMsg.style.display = 'none';

      const payload = {
        url: urlInput.value,
        title: titleInput.value,
        category: categorySelect.value,
        tags: tagsInput.value.split(',').map(t => t.trim()).filter(Boolean),
        notes: notesInput.value,
        autoAiExtract: true,
        source: 'chrome-extension'
      };

      try {
        const res = await fetch(\`\${APP_URL}/api/links\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          successMsg.style.display = 'block';
          saveBtn.innerHTML = '✓ Saved to OmniLink';
          setTimeout(() => window.close(), 1200);
        } else {
          throw new Error('Server returned ' + res.status);
        }
      } catch (err) {
        console.error('Failed to save to OmniLink:', err);
        errorMsg.textContent = 'Could not save. Is OmniLink running at ' + APP_URL + '?';
        errorMsg.style.display = 'block';
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span>Try Again</span>';
      }
    });
  } catch (e) {
    loading.textContent = 'Error loading tab info: ' + e.message;
  }
});`;

  const backgroundJs = `const APP_URL = "${config.appUrl || 'http://localhost:3000'}";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "omnilink-save-link",
    title: "Save to OmniLink AI",
    contexts: ["link", "page", "selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const targetUrl = info.linkUrl || info.pageUrl;
  if (!targetUrl) return;

  const title = tab ? tab.title : '';
  const notes = info.selectionText ? 'Excerpt: ' + info.selectionText : '';

  try {
    await fetch(\`\${APP_URL}/api/links\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: targetUrl,
        title: title || targetUrl,
        notes: notes,
        autoAiExtract: true,
        source: 'context-menu'
      })
    });
  } catch (e) {
    console.error('Context menu save failed:', e);
  }
});`;

  const readme = `OmniLink AI - Chrome Extension Installation Guide
=================================================

How to install this extension in Google Chrome, Brave, or Edge:

1. Unzip this downloaded archive into a folder on your computer.
2. Open Google Chrome and navigate to:
   chrome://extensions
3. In the top right corner, enable "Developer mode" (toggle switch ON).
4. Click the "Load unpacked" button in the top left.
5. Select the unzipped folder containing manifest.json.
6. The OmniLink AI icon will now appear in your browser toolbar!

Usage:
- Click the OmniLink AI icon on any webpage (GitHub repo, Reddit post, Instagram reel, article) to 1-click save with AI summary!
- Right-click any hyperlink on the web and select "Save to OmniLink AI".
- Connected instance: ${config.appUrl || 'http://localhost:3000'}
`;

  // Create a minimal SVG-based PNG placeholder for icons
  const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="background:#090a0f;border-radius:24px"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('popup.html', popupHtml);
  zip.file('popup.js', popupJs);
  zip.file('background.js', backgroundJs);
  zip.file('README.txt', readme);
  zip.file('icon.svg', svgIcon);
  // Generate lightweight 1x1 transparent png for standard icon sizes
  const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkWPjfDwAE3wH3jkvqNAAAAABJRU5ErkJggg==';
  zip.file('icon16.png', base64Png, { base64: true });
  zip.file('icon48.png', base64Png, { base64: true });
  zip.file('icon128.png', base64Png, { base64: true });

  return zip.generateAsync({ type: 'blob' });
}

export function generateBookmarkletCode(appUrl: string): string {
  const cleanUrl = appUrl.replace(/\/$/, '');
  return `javascript:(function(){var u=encodeURIComponent(window.location.href);var t=encodeURIComponent(document.title);var s=encodeURIComponent(window.getSelection().toString());window.open('${cleanUrl}/?share_url='+u+'&title='+t+'&text='+s,'_blank');})();`;
}
