function formatDuration(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return '<1m';
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function renderPinned(state) {
    const list = document.getElementById('ifv-pinned-list');
    if (!state.vx_pins.length) {
        list.innerHTML = '<div class="ifv-empty">No games pinned yet — hover a game card on Vortex and click the pin icon.</div>';
        return;
    }
    list.innerHTML = state.vx_pins.map((id) => {
        const meta = state.vx_games_cache[id];
        const name = meta ? escapeHtml(meta.name) : `Game #${id}`;
        const thumb = meta
            ? `https://playvortex.io/assets/thumbnails/${id}.png?v=${meta.thumbnail_version}`
            : '';
        const seconds = state.vx_playtime[id] || 0;
        return `<div class="ifv-pinned-item">
            <a href="https://playvortex.io/games/${id}" target="_blank" style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;text-decoration:none;color:inherit;">
                ${thumb ? `<img src="${thumb}" alt="">` : '<div style="width:36px;height:36px;border-radius:4px;background:var(--ifv-surface-2);flex-shrink:0;"></div>'}
                <div class="ifv-pinned-info">
                    <div class="ifv-pinned-name">${name}</div>
                    <div class="ifv-pinned-time">${seconds ? formatDuration(seconds) + ' played' : 'No playtime yet'}</div>
                </div>
            </a>
            <button class="ifv-unpin" data-id="${id}" title="Unpin"><i class="fa-solid fa-xmark"></i></button>
        </div>`;
    }).join('');

    list.querySelectorAll('.ifv-unpin').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const id = Number(btn.dataset.id);
            const fresh = await ifvGetState();
            const pins = fresh.vx_pins.filter((p) => p !== id);
            await ifvSetState({ vx_pins: pins });
            renderPinned(await ifvGetState());
        });
    });
}

function setModeUI(mode) {
    document.querySelectorAll('#ifv-theme-mode button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    document.getElementById('ifv-custom-colors').hidden = mode !== 'custom';
}

async function init() {
    const state = await ifvGetState();

    document.getElementById('ifv-set-quickplay').checked = state.vx_settings.quickPlay;
    document.getElementById('ifv-set-prefetch').checked = state.vx_settings.prefetch;
    document.getElementById('ifv-set-livestats').checked = state.vx_settings.liveStats;

    ['quickplay', 'prefetch', 'livestats'].forEach((key) => {
        const map = { quickplay: 'quickPlay', prefetch: 'prefetch', livestats: 'liveStats' };
        document.getElementById(`ifv-set-${key}`).addEventListener('change', async (e) => {
            const fresh = await ifvGetState();
            fresh.vx_settings[map[key]] = e.target.checked;
            await ifvSetState({ vx_settings: fresh.vx_settings });
        });
    });

    setModeUI(state.vx_theme.mode);
    document.getElementById('ifv-color-accent').value = state.vx_theme.accent;
    document.getElementById('ifv-color-bg').value = state.vx_theme.bg;
    document.getElementById('ifv-color-surface').value = state.vx_theme.surface;
    document.getElementById('ifv-color-text').value = state.vx_theme.text;

    document.querySelectorAll('#ifv-theme-mode button').forEach((b) => {
        b.addEventListener('click', async () => {
            setModeUI(b.dataset.mode);
            const fresh = await ifvGetState();
            fresh.vx_theme.mode = b.dataset.mode;
            await ifvSetState({ vx_theme: fresh.vx_theme });
        });
    });

    [['ifv-color-accent', 'accent'], ['ifv-color-bg', 'bg'], ['ifv-color-surface', 'surface'], ['ifv-color-text', 'text']].forEach(([elId, key]) => {
        document.getElementById(elId).addEventListener('input', async (e) => {
            const fresh = await ifvGetState();
            fresh.vx_theme[key] = e.target.value;
            fresh.vx_theme.mode = 'custom';
            setModeUI('custom');
            await ifvSetState({ vx_theme: fresh.vx_theme });
        });
    });

    renderPinned(state);

    document.getElementById('ifv-surprise').addEventListener('click', async () => {
        const fresh = await ifvGetState();
        const ids = Object.keys(fresh.vx_games_cache);
        const targetUrl = ids.length
            ? `https://playvortex.io/games/${ids[Math.floor(Math.random() * ids.length)]}`
            : 'https://playvortex.io/home';
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url && tab.url.startsWith('https://playvortex.io/')) {
            chrome.tabs.update(tab.id, { url: targetUrl });
        } else {
            chrome.tabs.create({ url: targetUrl });
        }
        window.close();
    });
}

init();
