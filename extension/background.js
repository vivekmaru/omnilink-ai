// OmniLink AI - Background Service Worker (Manifest V3)
const DEFAULT_APP_URL = 'http://localhost:3000';
const SERVICE_TOKEN_STORAGE_KEY = 'omnilink_service_token';

async function getAppUrl() {
  const data = await chrome.storage.sync.get(['omnilink_app_url']);
  return (data.omnilink_app_url || DEFAULT_APP_URL).replace(/\/$/, '');
}

// Keep service credentials local to this extension profile and out of sync
// storage. Tokens are sent only in Authorization headers, never in URLs or
// diagnostic output.
async function getApiHeaders(base = {}) {
  const data = await chrome.storage.local.get([SERVICE_TOKEN_STORAGE_KEY]);
  const token = typeof data[SERVICE_TOKEN_STORAGE_KEY] === 'string'
    ? data[SERVICE_TOKEN_STORAGE_KEY].trim()
    : '';
  return token ? { ...base, Authorization: `Bearer ${token}` } : { ...base };
}

// 1. Initialize Context Menus
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'omnilink-save-page',
      title: 'Save Page to OmniLink AI',
      contexts: ['page'],
    });

    chrome.contextMenus.create({
      id: 'omnilink-save-link',
      title: 'Save Link to OmniLink AI',
      contexts: ['link'],
    });

    chrome.contextMenus.create({
      id: 'omnilink-save-selection',
      title: 'Save Selection to OmniLink as Key Note',
      contexts: ['selection'],
    });

    chrome.contextMenus.create({
      id: 'omnilink-open-sidepanel',
      title: 'Open OmniLink Side Panel',
      contexts: ['action', 'page'],
    });
  });
});

// 2. Handle Context Menu Actions
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'omnilink-open-sidepanel' && tab?.windowId) {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
    return;
  }

  const appUrl = await getAppUrl();
  const targetUrl = info.linkUrl || info.pageUrl || tab?.url;
  if (!targetUrl) return;

  const title = tab ? tab.title : '';
  const notes = info.selectionText ? `Excerpt: "${info.selectionText.trim()}"` : '';

  try {
    const res = await fetch(`${appUrl}/api/share/quick`, {
      method: 'POST',
      headers: await getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        url: targetUrl,
        title: title || targetUrl,
        notes: notes,
      }),
    });

    if (res.ok && tab?.id) {
      chrome.action.setBadgeText({ text: '✓', tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#d97757', tabId: tab.id });
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '', tabId: tab.id });
      }, 2500);
    }
  } catch (err) {
    console.error('[OmniLink Extension] Context menu save error:', err);
  }
});

// 3. Omnibox Integration (Keyword: "ol <query>")
function escapeXml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const query = text.trim();
  if (!query) return;

  try {
    const appUrl = await getAppUrl();
    const res = await fetch(`${appUrl}/api/ai/search/hybrid`, {
      method: 'POST',
      headers: await getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ query, limit: 5 }),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.results) && data.results.length > 0) {
        const suggestions = data.results.map((r) => {
          const title = escapeXml(r.link.title || r.link.url);
          const category = escapeXml(r.link.category || 'Bookmark');
          const platform = escapeXml(r.link.platform || 'web');
          return {
            content: r.link.url,
            description: `<match>${title}</match> <dim>(${category} • ${platform})</dim>`,
          };
        });
        suggest(suggestions);
      }
    }
  } catch (err) {
    console.warn('[OmniLink Omnibox] Search error:', err);
  }
});

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  const appUrl = await getAppUrl();
  const targetUrl = text.startsWith('http') ? text : `${appUrl}/?search=${encodeURIComponent(text)}`;

  if (disposition === 'currentTab') {
    chrome.tabs.update({ url: targetUrl });
  } else {
    chrome.tabs.create({ url: targetUrl });
  }
});
