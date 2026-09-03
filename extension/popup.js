// OmniLink AI - Popup Controller
const DEFAULT_APP_URL = 'http://localhost:3000';
const SERVICE_TOKEN_STORAGE_KEY = 'omnilink_service_token';

// Service tokens are deliberately kept in chrome.storage.local (never sync
// storage) and are only sent in an Authorization header. Browser sessions for
// the web app continue to use HttpOnly cookies instead.
async function getApiHeaders(base = {}) {
  const data = await chrome.storage.local.get([SERVICE_TOKEN_STORAGE_KEY]);
  const token = typeof data[SERVICE_TOKEN_STORAGE_KEY] === 'string'
    ? data[SERVICE_TOKEN_STORAGE_KEY].trim()
    : '';
  return token ? { ...base, Authorization: `Bearer ${token}` } : { ...base };
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
  const hostBadge = document.getElementById('hostBadge');
  const settingsToggle = document.getElementById('settingsToggle');
  const settingsBody = document.getElementById('settingsBody');
  const customAppUrlInput = document.getElementById('customAppUrl');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const serviceTokenInput = document.getElementById('serviceToken');
  const saveTokenBtn = document.getElementById('saveTokenBtn');
  const clearTokenBtn = document.getElementById('clearTokenBtn');

  // Load configured host
  const storage = await chrome.storage.sync.get(['omnilink_app_url']);
  let appUrl = (storage.omnilink_app_url || DEFAULT_APP_URL).replace(/\/$/, '');
  
  try {
    const parsed = new URL(appUrl);
    hostBadge.textContent = parsed.host;
  } catch (e) {
    hostBadge.textContent = appUrl;
  }
  customAppUrlInput.value = appUrl;
  const localCredentials = await chrome.storage.local.get([SERVICE_TOKEN_STORAGE_KEY]);
  serviceTokenInput.value = typeof localCredentials[SERVICE_TOKEN_STORAGE_KEY] === 'string'
    ? localCredentials[SERVICE_TOKEN_STORAGE_KEY]
    : '';

  // Settings toggle
  settingsToggle.addEventListener('click', () => {
    const isHidden = settingsBody.style.display === 'none' || !settingsBody.style.display;
    settingsBody.style.display = isHidden ? 'block' : 'none';
    document.getElementById('settingsArrow').textContent = isHidden ? '▾' : '▸';
  });

  saveSettingsBtn.addEventListener('click', async () => {
    const newHost = customAppUrlInput.value.trim().replace(/\/$/, '');
    if (newHost) {
      await chrome.storage.sync.set({ omnilink_app_url: newHost });
      appUrl = newHost;
      try {
        hostBadge.textContent = new URL(newHost).host;
      } catch (e) {
        hostBadge.textContent = newHost;
      }
      statusSuccess.textContent = '✓ Saved new host: ' + hostBadge.textContent;
      statusSuccess.style.display = 'block';
      setTimeout(() => { statusSuccess.style.display = 'none'; }, 2000);
    }
  });

  saveTokenBtn.addEventListener('click', async () => {
    const token = serviceTokenInput.value.trim();
    if (!token.startsWith('olst_') || token.length < 40) {
      statusError.textContent = 'Enter a valid OmniLink service token.';
      statusError.style.display = 'block';
      return;
    }
    await chrome.storage.local.set({ [SERVICE_TOKEN_STORAGE_KEY]: token });
    statusError.style.display = 'none';
    statusSuccess.textContent = '✓ Service token saved to this browser profile.';
    statusSuccess.style.display = 'block';
  });

  clearTokenBtn.addEventListener('click', async () => {
    await chrome.storage.local.remove([SERVICE_TOKEN_STORAGE_KEY]);
    serviceTokenInput.value = '';
    statusSuccess.textContent = '✓ Service token removed.';
    statusSuccess.style.display = 'block';
  });

  // Open side panel
  sidePanelBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId && chrome.sidePanel?.open) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
      window.close();
    }
  });

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
      loading.textContent = 'Open a web page to save into OmniLink.';
      return;
    }

    urlInput.value = tab.url;
    titleInput.value = tab.title || '';

    // Heuristic categorization & tag suggestions
    const updateSuggestions = () => {
      const fullText = (titleInput.value + ' ' + urlInput.value).toLowerCase();
      const detectedTags = new Set();

      if (/react|nextjs|vue|svelte|angular|tailwind|typescript|javascript|frontend/.test(fullText)) {
        detectedTags.add('frontend');
      }
      if (/sqlite|postgres|database|sql|redis|db|vector/.test(fullText)) {
        detectedTags.add('database');
      }
      if (/llm|gemini|openai|gpt|claude|agent|rag|embeddings|ai|deep learning|machine learning/.test(fullText)) {
        detectedTags.add('ai');
        categorySelect.value = 'AI & Machine Learning';
      }
      if (/design|ui|ux|css|figma|typography/.test(fullText)) {
        detectedTags.add('design');
        categorySelect.value = 'Design & UI';
      }
      if (tab.url.includes('github.com')) {
        categorySelect.value = 'Dev & Tech';
        detectedTags.add('github');
        detectedTags.add('open-source');
      } else if (tab.url.includes('reddit.com')) {
        categorySelect.value = 'Reddit Discussions';
        detectedTags.add('reddit');
      } else if (tab.url.includes('instagram.com')) {
        categorySelect.value = 'Instagram & Social';
        detectedTags.add('instagram');
        detectedTags.add('reels');
      } else if (tab.url.includes('youtube.com') || tab.url.includes('youtu.be')) {
        categorySelect.value = 'Tutorials & Guides';
        detectedTags.add('youtube');
      } else if (tab.url.includes('arxiv.org') || tab.url.includes('.pdf')) {
        categorySelect.value = 'Research & Papers';
        detectedTags.add('research-paper');
      }

      if (detectedTags.size > 0) {
        const existing = tagsInput.value ? tagsInput.value.split(',').map((t) => t.trim().toLowerCase()) : [];
        const merged = Array.from(new Set([...existing, ...detectedTags])).filter(Boolean);
        tagsInput.value = merged.join(', ');

        tagPills.innerHTML = '';
        merged.forEach((tag) => {
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
      saveBtn.innerHTML = '<div class="spinner"></div> Saving & Extracting AI Insights...';
      statusSuccess.style.display = 'none';
      statusError.style.display = 'none';

      const payload = {
        url: urlInput.value,
        title: titleInput.value,
        category: categorySelect.value,
        tags: tagsInput.value.split(',').map((t) => t.trim()).filter(Boolean),
        notes: notesInput.value,
        autoAiExtract: true,
        source: 'chrome-extension',
      };

      try {
        const res = await fetch(`${appUrl}/api/links`, {
          method: 'POST',
          headers: await getApiHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (res.ok) {
          statusSuccess.textContent = data.message || '✓ Saved to OmniLink & AI indexed!';
          statusSuccess.style.display = 'block';
          saveBtn.innerHTML = '✓ Saved Successfully';
          setTimeout(() => window.close(), 1200);
        } else {
          throw new Error(data.error || 'Server returned status ' + res.status);
        }
      } catch (err) {
        console.error('Failed to save to OmniLink:', err);
        statusError.textContent = `Error: Could not save. Make sure OmniLink is running at ${appUrl}.`;
        statusError.style.display = 'block';
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span>Try Again</span>';
      }
    });
  } catch (err) {
    loading.textContent = 'Error loading tab: ' + err.message;
  }
});
