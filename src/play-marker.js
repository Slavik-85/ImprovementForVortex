(function () {
    const m = location.pathname.match(/^\/games\/(\d+)\/play\/?$/);
    if (!m) return;
    chrome.storage.local.set({ vx_pending_session: { gameId: Number(m[1]), startedAt: Date.now() } });
})();
