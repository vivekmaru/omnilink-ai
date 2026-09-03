import JSZip from 'jszip';

export interface ExtensionConfig {
  appUrl: string;
  defaultCategory?: string;
}

export function generateExtensionZip(config: ExtensionConfig): Promise<Blob> {
  const zip = new JSZip();
  const appUrl = (config.appUrl || 'http://localhost:3000').replace(/\/$/, '');

  const manifest = {
    manifest_version: 3,
    name: 'OmniLink AI - Quick Link Saver & Companion',
    version: '1.1.0',
    description: 'Save and organize articles, GitHub repos, Reddit discussions, papers, and videos with Gemini AI extraction directly into OmniLink.',
    permissions: [
      'activeTab',
      'storage',
      'contextMenus',
      'tabs',
      'sidePanel',
    ],
    host_permissions: [
      'http://localhost/*',
      'http://127.0.0.1/*',
      'https://*/*',
    ],
    action: {
      default_popup: 'popup.html',
      default_title: 'Save to OmniLink AI',
      default_icon: {
        '16': 'icons/icon-16.png',
        '48': 'icons/icon-48.png',
        '128': 'icons/icon-128.png',
      },
    },
    background: {
      service_worker: 'background.js',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
    omnibox: {
      keyword: 'ol',
    },
    icons: {
      '16': 'icons/icon-16.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
  };

  const popupHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>OmniLink AI</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { width: 360px; background: #151413; color: #f7f6f3; padding: 14px; font-size: 12px; }
    .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 12px; }
    .brand { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; color: #f08866; }
    .brand svg { color: #d97757; }
    .badge { font-size: 10px; font-family: monospace; padding: 2px 7px; border-radius: 999px; background: rgba(217, 119, 87, 0.15); color: #f08866; border: 1px solid rgba(217, 119, 87, 0.3); }
    .field { margin-bottom: 10px; }
    label { display: block; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #9c9a95; margin-bottom: 4px; font-family: monospace; }
    input, select, textarea { width: 100%; background: #22201e; border: 1px solid rgba(255,255,255,0.1); border-radius: 7px; padding: 7px 9px; color: #f7f6f3; font-size: 12px; outline: none; transition: border-color 0.15s; }
    input:focus, select:focus, textarea:focus { border-color: #d97757; }
    textarea { resize: vertical; min-height: 48px; }
    .tag-pills { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
    .tag-pill { font-size: 10px; font-family: monospace; background: rgba(255,255,255,0.05); color: #d1cfc7; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.08); }
    .btn-primary { width: 100%; background: #d97757; color: #fff; border: none; border-radius: 7px; padding: 9px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: background 0.15s; margin-top: 4px; }
    .btn-primary:hover { background: #c66a4d; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { width: 100%; background: transparent; color: #9c9a95; border: 1px solid rgba(255,255,255,0.1); border-radius: 7px; padding: 6px; font-size: 11px; cursor: pointer; margin-top: 6px; display: flex; align-items: center; justify-content: center; gap: 4px; }
    .btn-secondary:hover { color: #f7f6f3; border-color: rgba(255,255,255,0.2); }
    .status-box { display: none; padding: 8px; border-radius: 6px; font-size: 11px; text-align: center; margin-top: 8px; }
    .status-success { background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #6ee7b7; }
    .status-error { background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5; }
    .spinner { border: 2px solid rgba(255,255,255,0.2); border-left-color: #fff; border-radius: 50%; width: 12px; height: 12px; animation: spin 0.8s linear infinite; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
      OmniLink AI
    </div>
    <span class="badge" id="hostBadge">localhost:3000</span>
  </div>
  <div id="loading" style="text-align: center; padding: 20px; color: #9c9a95;">Detecting active tab...</div>
  <div id="mainForm" style="display: none;">
    <div class="field">
      <label>URL</label>
      <input type="text" id="url" readonly style="opacity: 0.85; font-size: 11px; font-family: monospace;">
    </div>
    <div class="field">
      <label>Title</label>
      <input type="text" id="title" placeholder="Page title...">
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
      <input type="text" id="tags" placeholder="e.g. react, tutorial, llm">
      <div class="tag-pills" id="tagPills"></div>
    </div>
    <div class="field">
      <label>Personal Notes & Takeaways</label>
      <textarea id="notes" placeholder="Key takeaways, thoughts, or highlights..."></textarea>
    </div>
    <button id="saveBtn" class="btn-primary"><span>Save to OmniLink</span></button>
    <button id="sidePanelBtn" class="btn-secondary"><span>Open OmniLink Side Panel</span></button>
    <div id="statusSuccess" class="status-box status-success"></div>
    <div id="statusError" class="status-box status-error"></div>
  </div>
  <script src="popup.js"></script>
</body>
</html>`;

  const popupJs = `const APP_URL = "${appUrl}";
const SERVICE_TOKEN_STORAGE_KEY = 'omnilink_service_token';
async function getApiHeaders(base = {}) {
  const data = await chrome.storage.local.get([SERVICE_TOKEN_STORAGE_KEY]);
  const token = typeof data[SERVICE_TOKEN_STORAGE_KEY] === 'string' ? data[SERVICE_TOKEN_STORAGE_KEY].trim() : '';
  return token ? { ...base, Authorization: 'Bearer ' + token } : { ...base };
}

document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('loading');
  const mainForm = document.getElementById('mainForm');
  const urlInput = document.getElementById('url');
  const titleInput = document.getElementById('title');
  const categorySelect = document.getElementById('category');
  const tagsInput = document.getElementById('tags');
  const tagPills = document.getElementById('tagPills');
  const notesInput = document.getElementById('notes');
  const saveBtn = document.getElementById('saveBtn');
  const sidePanelBtn = document.getElementById('sidePanelBtn');
  const statusSuccess = document.getElementById('statusSuccess');
  const statusError = document.getElementById('statusError');

  sidePanelBtn?.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId && chrome.sidePanel?.open) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
      window.close();
    }
  });

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || tab.url.startsWith('chrome://')) {
      loading.textContent = 'Open a web page to save into OmniLink.';
      return;
    }

    urlInput.value = tab.url;
    titleInput.value = tab.title || '';

    const updateSuggestions = () => {
      const fullText = (titleInput.value + ' ' + urlInput.value).toLowerCase();
      const detected = new Set();
      if (/react|vue|svelte|angular|typescript|javascript|frontend/.test(fullText)) detected.add('frontend');
      if (/sqlite|postgres|database|sql|redis|db/.test(fullText)) detected.add('database');
      if (/llm|gemini|openai|gpt|claude|agent|rag|ai/.test(fullText)) {
        detected.add('ai');
        categorySelect.value = 'AI & Machine Learning';
      }
      if (/design|ui|ux|css|figma/.test(fullText)) {
        detected.add('design');
        categorySelect.value = 'Design & UI';
      }
      if (tab.url.includes('github.com')) {
        categorySelect.value = 'Dev & Tech';
        detected.add('github');
        detected.add('open-source');
      } else if (tab.url.includes('reddit.com')) {
        categorySelect.value = 'Reddit Discussions';
        detected.add('reddit');
      } else if (tab.url.includes('instagram.com')) {
        categorySelect.value = 'Instagram & Social';
        detected.add('instagram');
      } else if (tab.url.includes('youtube.com') || tab.url.includes('youtu.be')) {
        categorySelect.value = 'Tutorials & Guides';
        detected.add('youtube');
      } else if (tab.url.includes('arxiv.org')) {
        categorySelect.value = 'Research & Papers';
        detected.add('research-paper');
      }

      if (detected.size > 0) {
        const existing = tagsInput.value ? tagsInput.value.split(',').map(t => t.trim().toLowerCase()) : [];
        const merged = Array.from(new Set([...existing, ...detected])).filter(Boolean);
        tagsInput.value = merged.join(', ');
        tagPills.innerHTML = '';
        merged.forEach(tag => {
          const pill = document.createElement('span');
          pill.className = 'tag-pill';
          pill.textContent = '#' + tag;
          tagPills.appendChild(pill);
        });
      }
    };

    updateSuggestions();
    titleInput.addEventListener('input', updateSuggestions);

    loading.style.display = 'none';
    mainForm.style.display = 'block';

    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<div class="spinner"></div> Saving to OmniLink...';
      statusSuccess.style.display = 'none';
      statusError.style.display = 'none';

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
          headers: await getApiHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
          statusSuccess.textContent = data.message || '✓ Saved to OmniLink & AI indexed!';
          statusSuccess.style.display = 'block';
          saveBtn.innerHTML = '✓ Saved Successfully';
          setTimeout(() => window.close(), 1200);
        } else {
          throw new Error(data.error || 'Server error ' + res.status);
        }
      } catch (err) {
        statusError.textContent = 'Could not save to ' + APP_URL;
        statusError.style.display = 'block';
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span>Try Again</span>';
      }
    });
  } catch (e) {
    loading.textContent = 'Error: ' + e.message;
  }
});`;

  const sidepanelHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>OmniLink Companion</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #151413; color: #f7f6f3; padding: 16px; height: 100vh; display: flex; flex-direction: column; overflow: hidden; font-size: 12px; }
    .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .brand { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; color: #f08866; }
    .quick-actions { display: flex; gap: 8px; margin-top: 12px; }
    .btn-save-tab { flex: 1; background: #d97757; color: #fff; border: none; border-radius: 8px; padding: 9px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .btn-open-app { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #d1cfc7; border-radius: 8px; padding: 9px 12px; font-size: 12px; text-decoration: none; }
    .search-box { margin-top: 12px; }
    .search-input { width: 100%; background: #22201e; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 9px 12px; color: #f7f6f3; font-size: 12px; outline: none; }
    .search-input:focus { border-color: #d97757; }
    .links-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
    .link-item { background: #22201e; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 4px; }
    .link-title { font-size: 13px; font-weight: 600; color: #f7f6f3; text-decoration: none; }
    .link-title:hover { color: #f08866; }
    .link-meta { font-size: 10px; font-family: monospace; color: #9c9a95; }
    .status-toast { display: none; padding: 8px; border-radius: 6px; font-size: 11px; text-align: center; margin-top: 8px; background: rgba(16,185,129,0.15); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.3); }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">OmniLink Companion</div>
  </div>
  <div class="quick-actions">
    <button id="saveCurrentTabBtn" class="btn-save-tab">+ Save Current Tab</button>
    <a id="openAppBtn" href="${appUrl}" target="_blank" class="btn-open-app">Open App ↗</a>
  </div>
  <div id="statusToast" class="status-toast"></div>
  <div class="search-box">
    <input type="text" id="searchInput" class="search-input" placeholder="Search with Hybrid AI (FTS5 + Vectors)...">
  </div>
  <div class="links-list" id="linksList"></div>
  <script src="sidepanel.js"></script>
</body>
</html>`;

  const sidepanelJs = `const APP_URL = "${appUrl}";
const SERVICE_TOKEN_STORAGE_KEY = 'omnilink_service_token';
async function getApiHeaders(base = {}) {
  const data = await chrome.storage.local.get([SERVICE_TOKEN_STORAGE_KEY]);
  const token = typeof data[SERVICE_TOKEN_STORAGE_KEY] === 'string' ? data[SERVICE_TOKEN_STORAGE_KEY].trim() : '';
  return token ? { ...base, Authorization: 'Bearer ' + token } : { ...base };
}

document.addEventListener('DOMContentLoaded', async () => {
  const saveCurrentTabBtn = document.getElementById('saveCurrentTabBtn');
  const searchInput = document.getElementById('searchInput');
  const linksList = document.getElementById('linksList');
  const statusToast = document.getElementById('statusToast');

  const showToast = (msg) => {
    statusToast.textContent = msg;
    statusToast.style.display = 'block';
    setTimeout(() => { statusToast.style.display = 'none'; }, 3000);
  };

  const renderLinks = (items) => {
    linksList.innerHTML = '';
    if (!items || items.length === 0) {
      linksList.innerHTML = '<div style="text-align:center;padding:20px;color:#9c9a95">No bookmarks found</div>';
      return;
    }
    items.forEach((item) => {
      const link = item.link || item;
      const card = document.createElement('div');
      card.className = 'link-item';
      card.innerHTML = \`
        <a href="\${link.url}" target="_blank" class="link-title">\${link.title || link.url}</a>
        <div class="link-meta">\${link.category || 'General'} • \${link.platform || 'web'}</div>
      \`;
      linksList.appendChild(card);
    });
  };

  const loadRecent = async () => {
    try {
      const res = await fetch(\`\${APP_URL}/api/links\`, { headers: await getApiHeaders() });
      if (res.ok) {
        const data = await res.json();
        renderLinks((data.links || []).slice(0, 20));
      }
    } catch (e) {}
  };

  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    if (!q) { loadRecent(); return; }
    searchTimer = setTimeout(async () => {
      try {
        const res = await fetch(\`\${APP_URL}/api/ai/search/hybrid\`, {
          method: 'POST',
          headers: await getApiHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ query: q, limit: 15 })
        });
        if (res.ok) {
          const data = await res.json();
          renderLinks(data.results || []);
        }
      } catch (e) {}
    }, 250);
  });

  saveCurrentTabBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) return;
      const res = await fetch(\`\${APP_URL}/api/share/quick\`, {
        method: 'POST',
        headers: await getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ url: tab.url, title: tab.title || tab.url })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('✓ ' + (data.message || 'Saved to OmniLink!'));
        loadRecent();
      }
    } catch (e) {
      showToast('Save failed: ' + e.message);
    }
  });

  loadRecent();
});`;

  const backgroundJs = `const APP_URL = "${appUrl}";
const SERVICE_TOKEN_STORAGE_KEY = 'omnilink_service_token';
async function getApiHeaders(base = {}) {
  const data = await chrome.storage.local.get([SERVICE_TOKEN_STORAGE_KEY]);
  const token = typeof data[SERVICE_TOKEN_STORAGE_KEY] === 'string' ? data[SERVICE_TOKEN_STORAGE_KEY].trim() : '';
  return token ? { ...base, Authorization: 'Bearer ' + token } : { ...base };
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'omnilink-save-page', title: 'Save Page to OmniLink AI', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'omnilink-save-link', title: 'Save Link to OmniLink AI', contexts: ['link'] });
    chrome.contextMenus.create({ id: 'omnilink-save-selection', title: 'Save Selection to OmniLink as Key Note', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'omnilink-open-sidepanel', title: 'Open OmniLink Side Panel', contexts: ['action', 'page'] });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'omnilink-open-sidepanel' && tab?.windowId && chrome.sidePanel?.open) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    return;
  }
  const targetUrl = info.linkUrl || info.pageUrl || tab?.url;
  if (!targetUrl) return;
  const title = tab ? tab.title : '';
  const notes = info.selectionText ? 'Excerpt: "' + info.selectionText.trim() + '"' : '';

  try {
    const res = await fetch(\`\${APP_URL}/api/share/quick\`, {
      method: 'POST',
      headers: await getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ url: targetUrl, title: title || targetUrl, notes })
    });
    if (res.ok && tab?.id) {
      chrome.action.setBadgeText({ text: '✓', tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#d97757', tabId: tab.id });
      setTimeout(() => { chrome.action.setBadgeText({ text: '', tabId: tab.id }); }, 2500);
    }
  } catch (err) {}
});

function escapeXml(unsafe) {
  return String(unsafe || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const query = text.trim();
  if (!query) return;
  try {
    const res = await fetch(\`\${APP_URL}/api/ai/search/hybrid\`, {
      method: 'POST',
      headers: await getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ query, limit: 5 })
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.results)) {
        suggest(data.results.map((r) => ({
          content: r.link.url,
          description: \`<match>\${escapeXml(r.link.title || r.link.url)}</match> <dim>(\${escapeXml(r.link.category || 'Dev')} • \${escapeXml(r.link.platform || 'web')})</dim>\`
        })));
      }
    }
  } catch (err) {}
});

chrome.omnibox.onInputEntered.addListener((text, disposition) => {
  const targetUrl = text.startsWith('http') ? text : \`\${APP_URL}/?search=\${encodeURIComponent(text)}\`;
  if (disposition === 'currentTab') chrome.tabs.update({ url: targetUrl });
  else chrome.tabs.create({ url: targetUrl });
});`;

  const readme = `OmniLink AI - Chrome Extension Installation Guide
=================================================

1. Unzip this downloaded archive into a folder.
2. Open Google Chrome (or Brave / Edge / Arc) and navigate to: chrome://extensions
3. Enable "Developer mode" in the top-right corner.
4. Click "Load unpacked" in the top-left corner.
5. Select this unzipped folder containing manifest.json.
6. The OmniLink AI icon will appear in your browser toolbar!

Features:
- Omnibox Search: Type 'ol <keyword>' in Chrome's address bar to hybrid-search your bookmarks.
- Side Panel: Open OmniLink in Chrome's native side panel.
- Right-click Menu: Save links, full pages, or highlighted excerpts.
- Connected instance: ${appUrl}
`;

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('popup.html', popupHtml);
  zip.file('popup.js', popupJs);
  zip.file('sidepanel.html', sidepanelHtml);
  zip.file('sidepanel.js', sidepanelJs);
  zip.file('background.js', backgroundJs);
  zip.file('README.txt', readme);

  // Distinct terracotta PNG icons
  const icon16Base64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGO4WR5OEmIY1TCqYfhqAABjCKcQmrQkCAAAAABJRU5ErkJggg==';
  const icon48Base64 = 'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAAAQklEQVR4nO3OQQ0AIAwAsblEClpxgwuOR5MK6Jy9vjL5QEhISKgeCAkJCdUDISEhoXogJCQkVA+EhISE6oGQkNBjF+5p39Pu3R8uAAAAAElFTkSuQmCC';
  const icon128Base64 = 'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAIAAABMXPacAAAA+UlEQVR4nO3RQQ0AIAzAwLlEClpxg4w9ekkFNLl592ixWT+IBwBAOwAA2gEA0A4AgHYAALQDAKAdAADtAABoBwBAOwAA2gEA0A4AgHYAALQDAKAdAADtAABoBwBAOwAA2gEA0A4AgHYAALQDAKAdAADtAABoBwBAOwAA2gEA0A4AgHYAALQDAKAdAADtAABoBwBAOwAA2gEA0A4AgHYAALQDAKAdAADtAABoBwBAOwAA2gEA0A4AgHYAALQDAKAdAADtAABoBwBAOwAA2gEA0A4AgHYAALQDAKAdAADtAABoBwBAOwAA2gEA0A4AgHYAALQDAKAdAADtPsnrxijNORL4AAAAAElFTkSuQmCC';

  const iconsFolder = zip.folder('icons');
  if (iconsFolder) {
    iconsFolder.file('icon-16.png', icon16Base64, { base64: true });
    iconsFolder.file('icon-48.png', icon48Base64, { base64: true });
    iconsFolder.file('icon-128.png', icon128Base64, { base64: true });
  }

  return zip.generateAsync({ type: 'blob' });
}

export function generateBookmarkletCode(appUrl: string): string {
  const cleanUrl = appUrl.replace(/\/$/, '');
  return `javascript:(function(){var u=encodeURIComponent(window.location.href);var t=encodeURIComponent(document.title);var s=encodeURIComponent(window.getSelection().toString());window.open('${cleanUrl}/?url='+u+'&title='+t+'&text='+s,'_blank');})();`;
}
