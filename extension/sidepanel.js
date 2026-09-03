// OmniLink AI - Side Panel Controller
const DEFAULT_APP_URL = 'http://localhost:3000';
const SERVICE_TOKEN_STORAGE_KEY = 'omnilink_service_token';

// Keep service credentials local to this extension profile and out of sync
// storage. Tokens are sent only in Authorization headers, never in URLs.
async function getApiHeaders(base = {}) {
  const data = await chrome.storage.local.get([SERVICE_TOKEN_STORAGE_KEY]);
  const token = typeof data[SERVICE_TOKEN_STORAGE_KEY] === 'string'
    ? data[SERVICE_TOKEN_STORAGE_KEY].trim()
    : '';
  return token ? { ...base, Authorization: `Bearer ${token}` } : { ...base };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeLinkHref(value) {
  try {
    const parsed = new URL(String(value ?? ''));
    return /^https?:$/.test(parsed.protocol) ? parsed.href : '#';
  } catch {
    return '#';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const saveCurrentTabBtn = document.getElementById('saveCurrentTabBtn');
  const openAppBtn = document.getElementById('openAppBtn');
  const searchInput = document.getElementById('searchInput');
  const linksList = document.getElementById('linksList');
  const listTitle = document.getElementById('listTitle');
  const itemCount = document.getElementById('itemCount');
  const statusToast = document.getElementById('statusToast');

  const storage = await chrome.storage.sync.get(['omnilink_app_url']);
  const appUrl = (storage.omnilink_app_url || DEFAULT_APP_URL).replace(/\/$/, '');
  openAppBtn.href = appUrl;

  const showToast = (message, isSuccess = true) => {
    statusToast.textContent = message;
    statusToast.className = `status-toast ${isSuccess ? 'success' : 'error'}`;
    statusToast.style.display = 'block';
    setTimeout(() => { statusToast.style.display = 'none'; }, 3000);
  };

  const renderLinks = (items) => {
    linksList.innerHTML = '';
    if (!items || items.length === 0) {
      linksList.innerHTML = '<div class="empty-state">No links found.</div>';
      itemCount.textContent = '0 items';
      return;
    }

    itemCount.textContent = `${items.length} items`;
    items.forEach((item) => {
      const link = item.link || item;
      const card = document.createElement('div');
      card.className = 'link-item';

      const tagsHtml = (link.tags || []).slice(0, 3)
        .map((t) => `<span class="tag-chip">#${escapeHtml(t)}</span>`)
        .join(' ');
      const href = escapeHtml(safeLinkHref(link.url));
      const title = escapeHtml(link.title || link.url);
      const category = escapeHtml(link.category || 'General');
      const platform = escapeHtml(link.platform || 'web');

      card.innerHTML = `
        <a href="${href}" target="_blank" rel="noopener noreferrer" class="link-title">${title}</a>
        <div class="link-meta">
          <span>${category}</span>
          <span>•</span>
          <span>${platform}</span>
          ${tagsHtml ? `<span>•</span> ${tagsHtml}` : ''}
        </div>
      `;
      linksList.appendChild(card);
    });
  };

  const loadRecent = async () => {
    try {
      const res = await fetch(`${appUrl}/api/links`, {
        headers: await getApiHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        renderLinks((data.links || []).slice(0, 20));
      } else {
        linksList.innerHTML = `<div class="empty-state">Failed to connect to ${appUrl}</div>`;
      }
    } catch (e) {
      linksList.innerHTML = `<div class="empty-state">Cannot reach OmniLink backend (${appUrl}).</div>`;
    }
  };

  // Search input debounced
  let searchTimeout = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const query = searchInput.value.trim();

    if (!query) {
      listTitle.textContent = 'Recent Bookmarks';
      loadRecent();
      return;
    }

    listTitle.textContent = 'Search Results';
    searchTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`${appUrl}/api/ai/search/hybrid`, {
          method: 'POST',
          headers: await getApiHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ query, limit: 15 }),
        });
        if (res.ok) {
          const data = await res.json();
          renderLinks(data.results || []);
        }
      } catch (e) {
        showToast('Search error: ' + e.message, false);
      }
    }, 250);
  });

  // Save current tab
  saveCurrentTabBtn.addEventListener('click', async () => {
    saveCurrentTabBtn.disabled = true;
    saveCurrentTabBtn.textContent = 'Saving...';
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) {
        showToast('No active web tab found', false);
        return;
      }

      const res = await fetch(`${appUrl}/api/share/quick`, {
        method: 'POST',
        headers: await getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          url: tab.url,
          title: tab.title || tab.url,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`✓ ${data.message || 'Saved to OmniLink!'}`);
        loadRecent();
      } else {
        showToast(data.error || 'Failed to save tab', false);
      }
    } catch (e) {
      showToast('Error saving: ' + e.message, false);
    } finally {
      saveCurrentTabBtn.disabled = false;
      saveCurrentTabBtn.textContent = '+ Save Current Tab';
    }
  });

  loadRecent();
});
