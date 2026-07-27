let ifvState = null;
const ifvPrefetched = new Set();

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function gameIdFromHref(href) {
    const m = (href || '').match(/\/games\/(\d+)/);
    return m ? Number(m[1]) : null;
}

function formatDuration(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return '<1m';
}

async function fetchJSON(url) {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    return res.json();
}

async function fetchGames() {
    const games = await fetchJSON('/api/games');
    const cache = {};
    games.forEach((g) => { cache[g.id] = { name: g.name, thumbnail_version: g.thumbnail_version }; });
    ifvSetState({ vx_games_cache: cache });
    return games;
}

function findSectionHeading(text) {
    const leaf = Array.from(document.querySelectorAll('body *')).find(
        (el) => el.children.length === 0 && el.textContent.trim() === text
    );
    if (!leaf) return null;
    return leaf.closest('.section-header') || leaf.parentElement;
}

function applyTheme(theme) {
    const root = document.documentElement;
    root.classList.toggle('ifv-light', theme.mode === 'light');
    root.classList.toggle('ifv-custom', theme.mode === 'custom');
    if (theme.mode === 'custom') {
        root.style.setProperty('--ifv-bg', theme.bg);
        root.style.setProperty('--ifv-surface', theme.surface);
        root.style.setProperty('--ifv-text', theme.text);
        root.style.setProperty('--ifv-accent', theme.accent);
    } else {
        ['--ifv-bg', '--ifv-surface', '--ifv-text', '--ifv-accent'].forEach((v) => root.style.removeProperty(v));
    }
}

async function surpriseMe() {
    try {
        const games = await fetchGames();
        if (!games.length) return;
        const pick = games[Math.floor(Math.random() * games.length)];
        window.location.href = `/games/${pick.id}`;
    } catch (e) {
    }
}

function addSurpriseButton() {
    const nav = document.querySelector('.navbar-pill');
    if (!nav || document.getElementById('ifv-surprise-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'ifv-surprise-btn';
    btn.className = 'navbar-pill-btn';
    btn.title = 'Surprise Me';
    btn.innerHTML = '<i class="fa-solid fa-shuffle"></i>';
    btn.addEventListener('click', surpriseMe);
    nav.appendChild(btn);
}

function togglePin(id) {
    const pins = new Set(ifvState.vx_pins);
    if (pins.has(id)) pins.delete(id); else pins.add(id);
    ifvState.vx_pins = [...pins];
    ifvSetState({ vx_pins: ifvState.vx_pins });
    return pins.has(id);
}

function prefetchGame(id) {
    if (!ifvState.vx_settings.prefetch || ifvPrefetched.has(id)) return;
    ifvPrefetched.add(id);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = `/games/${id}`;
    document.head.appendChild(link);
}

function gameCardHTML(g) {
    return `<a class="game-card" href="/games/${g.id}">
        <div class="game-card-thumb"><img src="/assets/thumbnails/${g.id}.png?v=${g.thumbnail_version}" alt="${escapeHtml(g.name)}"></div>
        <div class="game-card-body">
            <div class="game-card-title">${escapeHtml(g.name)}</div>
            <div class="game-card-meta"><span class="game-card-stat"><i class="fa-solid fa-users"></i> ${g.player_count}</span></div>
        </div>
    </a>`;
}

function enhanceGameCards(scope) {
    const cards = scope.querySelectorAll('a.game-card');
    cards.forEach((card) => {
        const id = gameIdFromHref(card.getAttribute('href'));
        if (id == null) return;
        card.dataset.ifvGameId = String(id);

        const thumb = card.querySelector('.game-card-thumb');
        if (thumb && !thumb.querySelector('.ifv-pin-btn')) {
            thumb.style.position = 'relative';

            const pinBtn = document.createElement('button');
            pinBtn.className = 'ifv-icon-btn ifv-pin-btn' + (ifvState.vx_pins.includes(id) ? ' ifv-pinned' : '');
            pinBtn.title = 'Pin game';
            pinBtn.style.cssText = 'position:absolute;top:8px;right:8px;z-index:3;';
            pinBtn.innerHTML = '<i class="fa-solid fa-thumbtack"></i>';
            pinBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const pinned = togglePin(id);
                pinBtn.classList.toggle('ifv-pinned', pinned);
            });
            thumb.appendChild(pinBtn);

            if (ifvState.vx_settings.quickPlay) {
                const quickPlay = document.createElement('button');
                quickPlay.className = 'ifv-quick-play';
                quickPlay.title = 'Quick play';
                quickPlay.innerHTML = '<i class="fa-solid fa-play"></i> Play';
                quickPlay.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.location.href = `/games/${id}/play`;
                });
                thumb.appendChild(quickPlay);
            }
        }

        const meta = card.querySelector('.game-card-meta');
        if (meta) {
            const playedSeconds = ifvState.vx_playtime[id];
            let badge = meta.querySelector('.ifv-playtime-badge');
            if (playedSeconds) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'game-card-stat ifv-playtime-badge';
                    meta.appendChild(badge);
                }
                badge.innerHTML = `<i class="fa-solid fa-clock"></i> ${formatDuration(playedSeconds)}`;
            } else if (badge) {
                badge.remove();
            }
        }

        if (!card.dataset.ifvPrefetchBound) {
            card.dataset.ifvPrefetchBound = '1';
            card.addEventListener('mouseenter', () => prefetchGame(id), { once: true });
        }
    });
}

let pinnedRenderInFlight = false;
let pinnedRenderQueued = false;

async function renderPinnedSection() {
    if (pinnedRenderInFlight) {
        pinnedRenderQueued = true;
        return;
    }
    pinnedRenderInFlight = true;
    try {
        await renderPinnedSectionInner();
    } finally {
        pinnedRenderInFlight = false;
        if (pinnedRenderQueued) {
            pinnedRenderQueued = false;
            renderPinnedSection();
        }
    }
}

async function renderPinnedSectionInner() {
    const pins = ifvState.vx_pins;
    const existing = document.getElementById('ifv-pinned-section');
    if (!pins.length) {
        if (existing) existing.remove();
        return;
    }
    const snapshot = pins.slice().sort((a, b) => a - b).join(',');
    if (existing && existing.dataset.ifvPinsSnapshot === snapshot) return;

    let games;
    try {
        games = await fetchGames();
    } catch (e) {
        return;
    }
    const pinnedGames = games.filter((g) => pins.includes(g.id));
    const anchor = existing || findSectionHeading('Games');
    if (!anchor) return;

    let section = existing;
    if (!section) {
        section = document.createElement('div');
        section.id = 'ifv-pinned-section';
        anchor.parentElement.insertBefore(section, anchor);
    }
    if (!pinnedGames.length) {
        section.remove();
        return;
    }
    section.dataset.ifvPinsSnapshot = snapshot;
    section.innerHTML = `
        <div class="section-title" style="display:block;margin-bottom:0.75rem;">Pinned</div>
        <div class="games-grid" style="margin-bottom:1.5rem;">
            ${pinnedGames.map(gameCardHTML).join('')}
        </div>`;
    enhanceGameCards(section);
}

function watchAndReapply(applyFn) {
    applyFn();
    let scheduled = false;
    const observer = new MutationObserver(() => {
        if (!ifvContextValid()) {
            observer.disconnect();
            return;
        }
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            applyFn();
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function updateCardStat(card, count) {
    const stat = card.querySelector('.game-card-stat');
    if (!stat) return;
    const icon = stat.querySelector('i');
    stat.textContent = '';
    if (icon) stat.appendChild(icon);
    stat.appendChild(document.createTextNode(' ' + count));
}

async function findFriendGame(uid) {
    try {
        const games = await fetchGames();
        for (const g of games) {
            const inst = (g.instances || []).find((i) => i.user_ids.includes(uid));
            if (inst) return { gameId: g.id, instanceId: inst.instance_id };
        }
    } catch (e) {
    }
    return null;
}

function enhanceFriendCards(scope) {
    scope.querySelectorAll('a.friend-card').forEach((card) => {
        const wrap = card.querySelector('.friend-avatar-wrap');
        const statusEl = card.querySelector('.friend-status');
        if (!wrap || !statusEl) return;
        const isInGame = statusEl.classList.contains('in-game');
        let joinBtn = wrap.querySelector('.ifv-friend-join');

        if (!isInGame) {
            if (joinBtn) joinBtn.remove();
            return;
        }
        if (joinBtn) return;

        const avatarImg = card.querySelector('.friend-avatar');
        const uid = avatarImg ? Number(avatarImg.dataset.uid) : null;
        if (uid == null) return;

        joinBtn = document.createElement('button');
        joinBtn.className = 'ifv-friend-join';
        joinBtn.title = 'Join';
        joinBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        joinBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            joinBtn.disabled = true;
            const target = await findFriendGame(uid);
            joinBtn.disabled = false;
            if (target) {
                window.location.href = `/games/${target.gameId}/play?instance=${target.instanceId}`;
            } else {
                joinBtn.title = "Couldn't find their server";
            }
        });
        wrap.appendChild(joinBtn);
    });
}

function applyGreeting() {
    const el = document.getElementById('home-greeting');
    if (!el) return;
    const match = el.textContent.match(/Hello,\s*(.+?)!?\s*$/);
    const name = match ? match[1] : el.textContent.trim();
    const hour = new Date().getHours();
    let phrases;
    if (hour >= 5 && hour < 12) phrases = [`Morning, ${name}!`, `Rise and shine, ${name}!`];
    else if (hour >= 12 && hour < 17) phrases = [`Good afternoon, ${name}!`, `Hey, ${name}!`];
    else if (hour >= 17 && hour < 22) phrases = [`Evening, ${name}!`, `Good evening, ${name}!`];
    else phrases = [`Hello, Night Owl ${name}!`, `Still up, ${name}?`];
    el.textContent = phrases[Math.floor(Math.random() * phrases.length)];
}

function startLiveStats(homeMode, gameId) {
    if (!ifvState.vx_settings.liveStats) return;
    const intervalId = setInterval(tick, 10000);
    async function tick() {
        if (!ifvContextValid()) {
            clearInterval(intervalId);
            return;
        }
        try {
            const games = await fetchGames();
            if (homeMode) {
                games.forEach((g) => {
                    document.querySelectorAll(`a.game-card[data-ifv-game-id="${g.id}"]`).forEach((card) => {
                        updateCardStat(card, g.player_count);
                    });
                });
            } else {
                const game = games.find((g) => g.id === gameId);
                const statActive = document.getElementById('stat-active');
                if (game && statActive) {
                    const icon = statActive.querySelector('i');
                    statActive.textContent = '';
                    if (icon) statActive.appendChild(icon);
                    statActive.appendChild(document.createTextNode(String(game.player_count)));
                }
            }
        } catch (e) {
        }
    }
}

function initHome() {
    applyGreeting();
    watchAndReapply(() => {
        enhanceGameCards(document);
        enhanceFriendCards(document);
        renderPinnedSection();
    });
    startLiveStats(true, null);
}

function clearHighlights(box) {
    box.querySelectorAll('.ifv-highlight').forEach((el) => el.classList.remove('ifv-highlight'));
}

function applyHideFull(box, hide) {
    box.querySelectorAll('.server-card').forEach((card) => {
        const m = card.textContent.match(/(\d+)\s*\/\s*(\d+)/);
        if (!m) return;
        const full = parseInt(m[1], 10) >= parseInt(m[2], 10);
        card.style.display = hide && full ? 'none' : '';
    });
}

function getInstanceCapacities(box) {
    return Array.from(box.querySelectorAll('.server-card')).map((card) => {
        const m = card.textContent.match(/(\d+)\s*\/\s*(\d+)/);
        return m ? parseInt(m[2], 10) : null;
    });
}

async function joinBestInstance(gameId, box, pickFn) {
    try {
        const games = await fetchGames();
        const game = games.find((g) => g.id === gameId);
        if (!game || !game.instances.length) return;
        const caps = getInstanceCapacities(box);
        const withCaps = game.instances.map((inst, i) => ({ ...inst, max: caps[i] ?? null }));
        const best = pickFn(withCaps);
        if (!best) return;
        window.location.href = `/games/${gameId}/play?instance=${best.instance_id}`;
    } catch (e) {
    }
}

async function searchPlayer(query, gameId, box, resultEl) {
    resultEl.textContent = 'Searching...';
    try {
        const matches = await fetchJSON(`/api/users/search?q=${encodeURIComponent(query)}`);
        if (!matches.length) {
            resultEl.textContent = 'No player found.';
            return;
        }
        const ids = new Set(matches.map((m) => m.id));
        const games = await fetchGames();
        for (const g of games) {
            const idx = (g.instances || []).findIndex((inst) => inst.user_ids.some((uid) => ids.has(uid)));
            if (idx === -1) continue;
            if (g.id === gameId) {
                const cards = box.querySelectorAll('.server-card');
                const card = cards[idx];
                if (card) {
                    card.classList.add('ifv-highlight');
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                resultEl.textContent = 'Found in this server!';
            } else {
                resultEl.innerHTML = `Found in <a href="/games/${g.id}" style="color:var(--ifv-accent)">${escapeHtml(g.name)}</a>`;
            }
            return;
        }
        resultEl.textContent = 'Player is not in any active server.';
    } catch (e) {
        resultEl.textContent = 'Search failed.';
    }
}

function setupServerBrowser(gameId) {
    const box = document.getElementById('server-list');
    if (!box || document.getElementById('ifv-server-toolbar')) return;

    const toolbar = document.createElement('div');
    toolbar.id = 'ifv-server-toolbar';
    toolbar.className = 'ifv-server-toolbar';
    toolbar.innerHTML = `
        <input class="ifv-input" id="ifv-server-search" placeholder="Find player by nickname...">
        <label><input type="checkbox" id="ifv-hide-full"> Hide full</label>
        <button class="ifv-btn ifv-btn-ghost" id="ifv-join-least-full"><i class="fa-solid fa-bolt"></i> Join least full</button>
        <button class="ifv-btn ifv-btn-ghost" id="ifv-join-most-full"><i class="fa-solid fa-fire"></i> Join most full</button>
        <span id="ifv-search-result" class="ifv-badge"></span>`;
    box.parentElement.insertBefore(toolbar, box);

    toolbar.querySelector('#ifv-hide-full').addEventListener('change', (e) => applyHideFull(box, e.target.checked));

    toolbar.querySelector('#ifv-join-least-full').addEventListener('click', () => {
        joinBestInstance(gameId, box, (instances) => [...instances].sort((a, b) => a.players - b.players)[0]);
    });

    toolbar.querySelector('#ifv-join-most-full').addEventListener('click', () => {
        joinBestInstance(gameId, box, (instances) => {
            const notFull = instances.filter((i) => i.max == null || i.players < i.max);
            if (!notFull.length) return null;
            return [...notFull].sort((a, b) => b.players - a.players)[0];
        });
    });

    let debounceTimer;
    const searchInput = toolbar.querySelector('#ifv-server-search');
    const resultEl = toolbar.querySelector('#ifv-search-result');
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const q = searchInput.value.trim();
        resultEl.textContent = '';
        clearHighlights(box);
        if (q.length < 2) return;
        debounceTimer = setTimeout(() => searchPlayer(q, gameId, box, resultEl), 300);
    });
}

function renderPlaytimeStat(gameId) {
    const statsRow = document.querySelector('.game-detail-stats');
    if (!statsRow) return;
    let el = document.getElementById('ifv-playtime-stat');
    if (!el) {
        el = document.createElement('div');
        el.id = 'ifv-playtime-stat';
        el.className = 'game-stat';
        statsRow.appendChild(el);
    }
    const seconds = ifvState.vx_playtime[gameId] || 0;
    el.innerHTML = `<span class="game-stat-value"><i class="fa-solid fa-clock"></i>${seconds ? formatDuration(seconds) : '0m'}</span><span class="game-stat-label">Played</span>`;
}

function initGameDetail(gameId) {
    watchAndReapply(() => {
        setupServerBrowser(gameId);
        renderPlaytimeStat(gameId);
    });
    startLiveStats(false, gameId);
}

async function initProfile(userId) {
    let target = null;
    try {
        const user = await fetchJSON(`/api/users/${userId}`);
        if (user.friendship_status === 'friends' && user.online_status === 'in_game') {
            target = await findFriendGame(userId);
        }
    } catch (e) {
        return;
    }
    if (!target) return;

    watchAndReapply(() => {
        const actions = document.getElementById('profile-actions');
        if (!actions || actions.querySelector('.ifv-join-game-btn')) return;
        const wrap = document.createElement('div');
        const btn = document.createElement('button');
        btn.className = 'btn-secondary ifv-join-game-btn';
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Join Game';
        btn.addEventListener('click', () => {
            window.location.href = `/games/${target.gameId}/play?instance=${target.instanceId}`;
        });
        wrap.appendChild(btn);
        actions.appendChild(wrap);
    });
}

async function finalizePendingSession(session) {
    await ifvSetState({ vx_pending_session: null });
    const elapsedSeconds = Math.round((Date.now() - session.startedAt) / 1000);
    if (elapsedSeconds < 10 || elapsedSeconds > 6 * 3600) return;
    const state = await ifvGetState();
    const playtime = { ...state.vx_playtime };
    playtime[session.gameId] = (playtime[session.gameId] || 0) + elapsedSeconds;
    await ifvSetState({ vx_playtime: playtime });
}

function checkPendingSession() {
    if (/^\/games\/\d+\/play\/?$/.test(window.location.pathname)) return;
    const session = ifvState.vx_pending_session;
    if (!session) return;
    if (document.hasFocus()) {
        finalizePendingSession(session);
    } else {
        window.addEventListener('focus', () => finalizePendingSession(session), { once: true });
    }
}

let currentDetailGameId = null;

function route() {
    const path = window.location.pathname;
    let m;
    if (path === '/home' || path === '/') {
        initHome();
    } else if ((m = path.match(/^\/games\/(\d+)\/?$/))) {
        currentDetailGameId = Number(m[1]);
        initGameDetail(currentDetailGameId);
    } else if ((m = path.match(/^\/users\/(\d+)\/profile\/?$/))) {
        initProfile(Number(m[1]));
    }
}

async function ifvInit() {
    ifvState = await ifvGetState();
    applyTheme(ifvState.vx_theme);
    ifvOnChange((changes) => {
        if (changes.vx_theme) {
            ifvState.vx_theme = changes.vx_theme.newValue;
            applyTheme(ifvState.vx_theme);
        }
        if (changes.vx_settings) ifvState.vx_settings = changes.vx_settings.newValue;
        if (changes.vx_pins) {
            ifvState.vx_pins = changes.vx_pins.newValue;
            renderPinnedSection();
        }
        if (changes.vx_playtime) {
            ifvState.vx_playtime = changes.vx_playtime.newValue;
            if (currentDetailGameId != null) renderPlaytimeStat(currentDetailGameId);
        }
        if (changes.vx_pending_session) ifvState.vx_pending_session = changes.vx_pending_session.newValue;
    });
    addSurpriseButton();
    checkPendingSession();
    route();
}

window.addEventListener('pageshow', (e) => {
    if (e.persisted) checkPendingSession();
});

ifvInit();
