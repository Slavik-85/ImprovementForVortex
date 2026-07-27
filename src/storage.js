const IFV_DEFAULTS = {
  vx_pins: [],
  vx_playtime: {},
  vx_theme: { mode: 'dark', accent: '#7c3aed', bg: '#0b0b12', surface: '#171020', text: '#e5e5ea' },
  vx_settings: { quickPlay: true, prefetch: true, liveStats: true },
  vx_games_cache: {},
  vx_pending_session: null
};

function ifvContextValid() {
  try {
    return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
  } catch (e) {
    return false;
  }
}

function ifvGetState() {
  return new Promise((resolve) => {
    try {
      if (!ifvContextValid()) { resolve({ ...IFV_DEFAULTS }); return; }
      chrome.storage.local.get(IFV_DEFAULTS, (items) => resolve(items));
    } catch (e) {
      resolve({ ...IFV_DEFAULTS });
    }
  });
}

function ifvSetState(patch) {
  return new Promise((resolve) => {
    try {
      if (!ifvContextValid()) { resolve(); return; }
      chrome.storage.local.set(patch, resolve);
    } catch (e) {
      resolve();
    }
  });
}

function ifvOnChange(callback) {
  try {
    if (!ifvContextValid()) return;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') callback(changes);
    });
  } catch (e) {
  }
}
