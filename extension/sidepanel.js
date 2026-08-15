// OmniLink AI - Side Panel Controller
const DEFAULT_APP_URL = 'http://localhost:3000';

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

      const tagsHtml = (link.tags || []).slice(0, 3).map((t) => `<span class="tag-chip">#${t}</span>`).join(' ');

      card.innerHTML = `
        <a href="${link.url}" target="_blank" class="link-title">${link.title || link.url}</a>
        <div class="link-meta">
          <span>${link.category || 'General'}</span>
          <span>•</span>
          <span>${link.platform || 'web'}</span>
          ${tagsHtml ? `<span>•</span> ${tagsHtml}` : ''}
        </div>
      `;
      linksList.appendChild(card);
    });
  };

  const loadRecent = async () => {
    try {
      const res = await fetch(`${appUrl}/api/links`);
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
          headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
