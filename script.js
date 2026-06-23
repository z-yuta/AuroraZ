const COVER_URL  = "https://cdn.jsdelivr.net/gh/freebuisness/covers@main";
const HTML_URL   = "https://cdn.jsdelivr.net/gh/freebuisness/html@main";
const TRUFFLED   = "https://truffled.lol";
const ZONES_URLS = [
    "https://cdn.jsdelivr.net/gh/freebuisness/assets@main/zones.json",
    "https://cdn.jsdelivr.net/gh/freebuisness/assets@latest/zones.json",
    "https://cdn.jsdelivr.net/gh/freebuisness/assets/zones.json"
];

let allGames      = [];
let gnmathRaw     = [];
let truffledRaw   = [];
let wasmRaw       = [];
let ugsRaw        = [];
let popularityMap = {};
let currentGame   = null;

const allGrid      = document.getElementById('allGrid');
const featuredGrid = document.getElementById('featuredGrid');
const searchBar    = document.getElementById('searchBar');
const sortSelect   = document.getElementById('sortSelect');
const tagSelect    = document.getElementById('tagSelect');
const gameViewer   = document.getElementById('gameViewer');
const gameFrame    = document.getElementById('gameFrame');
const gameCount    = document.getElementById('gameCount');

// ── Navigation ────────────────────────────────────────────────────────────────
function navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const el = document.getElementById('page-' + page);
    el.classList.add('active');
    document.querySelector(`.nav-btn[data-page="${page}"]`).classList.add('active');
    window.scrollTo(0, 0);
    // re-observe cards on the newly shown page so they animate in
    requestAnimationFrame(() => observeCards(el));
}

// ── Nav ripple ────────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
        const r = document.createElement('span');
        r.className = 'nav-ripple';
        const rect = this.getBoundingClientRect();
        r.style.left = (e.clientX - rect.left) + 'px';
        r.style.top  = (e.clientY - rect.top)  + 'px';
        this.appendChild(r);
        setTimeout(() => r.remove(), 520);
    });
});

// ── Sources state ─────────────────────────────────────────────────────────────
const sources = {
    gnmath:   JSON.parse(localStorage.getItem('src_gnmath')   ?? 'true'),
    truffled: JSON.parse(localStorage.getItem('src_truffled') ?? 'true'),
    wasm:     JSON.parse(localStorage.getItem('src_wasm')     ?? 'true'),
    ugs:      JSON.parse(localStorage.getItem('src_ugs')      ?? 'true'),
};
function saveSources() {
    localStorage.setItem('src_gnmath',   sources.gnmath);
    localStorage.setItem('src_truffled', sources.truffled);
    localStorage.setItem('src_wasm',     sources.wasm);
    localStorage.setItem('src_ugs',      sources.ugs);
}

// ── Fetch ─────────────────────────────────────────────────────────────────────
function resolvePlaceholders(url) {
    return url.replace('{COVER_URL}', COVER_URL).replace('{HTML_URL}', HTML_URL);
}

async function fetchGnmath() {
    for (const url of ZONES_URLS) {
        try {
            const res = await fetch(url + '?t=' + Date.now());
            if (res.ok) {
                const data = await res.json();
                return data.map(z => ({
                    id:       'gn_' + z.id,
                    rawId:    z.id,
                    name:     z.name,
                    cover:    resolvePlaceholders(z.cover),
                    url:      z.url,
                    author:   z.author || '',
                    featured: !!z.featured,
                    special:  z.special || [],
                    source:   'gnmath',
                    openType: z.url && z.url.startsWith('http') ? 'external' : 'inject',
                }));
            }
        } catch (_) {}
    }
    return [];
}

async function fetchTruffled() {
    try {
        const res = await fetch('/api/truffled-games');
        if (!res.ok) return [];
        const data = await res.json();
        return (data.games || []).map((g, i) => ({
            id:       'tr_' + i,
            rawId:    null,
            name:     g.name,
            cover:    TRUFFLED + '/' + g.thumbnail.replace(/^\//, ''),
            url:      g.url,
            author:   '',
            featured: false,
            special:  [],
            source:   'truffled',
            openType: 'iframe',
        }));
    } catch (_) { return []; }
}

async function fetchWasm() {
    try {
        const res = await fetch('/api/wasm-games');
        if (!res.ok) return [];
        const data = await res.json();
        return (data || []).map(g => ({
            id:       'wasm_' + g.id,
            rawId:    null,
            name:     g.name,
            cover:    'https://wasm.rip/' + g.imageUrl,
            url:      'https://wasm.rip/' + g.gameUrl,
            author:   g.porter || '',
            featured: !!g.featured,
            special:  [],
            source:   'wasm',
            openType: 'iframe',
        }));
    } catch (_) { return []; }
}

function ugsDisplayName(filename) {
    const raw = filename.startsWith('cl') ? filename.slice(2) : filename;
    if (!raw) return filename;
    return raw.charAt(0).toUpperCase() + raw.slice(1);
}

async function fetchUGS() {
    try {
        const res = await fetch('/api/ugs-games');
        if (!res.ok) return [];
        const files = await res.json();
        return (files || []).map((f, i) => ({
            id:       'ugs_' + i,
            rawId:    null,
            name:     ugsDisplayName(f),
            cover:    '',
            url:      '/api/ugs-proxy?file=' + encodeURIComponent(f),
            author:   'UGS',
            featured: false,
            special:  [],
            source:   'ugs',
            openType: 'iframe',
            _ugsFile: f,
        }));
    } catch (_) { return []; }
}

async function fetchPopularity() {
    try {
        const res = await fetch('https://data.jsdelivr.com/v1/stats/packages/gh/freebuisness/html@main/files?period=year');
        if (!res.ok) return;
        const data = await res.json();
        data.forEach(f => {
            const m = f.name.match(/\/(\d+)\.html$/);
            if (m) popularityMap[parseInt(m[1])] = f.hits?.total ?? 0;
        });
    } catch (_) {}
}

// ── Merge & dedup ─────────────────────────────────────────────────────────────
// Priority: gnmath > wasm > truffled > ugs
const SOURCE_PRIORITY = { gnmath: 3, wasm: 2, truffled: 1, ugs: 0 };

function mergeGames() {
    const active = [];
    if (sources.gnmath)   active.push(...gnmathRaw);
    if (sources.wasm)     active.push(...wasmRaw);
    if (sources.truffled) active.push(...truffledRaw);
    if (sources.ugs)      active.push(...ugsRaw);
    const seen = new Map();
    for (const g of active) {
        const key = g.name.toLowerCase().trim();
        if (!seen.has(key)) {
            seen.set(key, g);
        } else {
            const existing = seen.get(key);
            if ((SOURCE_PRIORITY[g.source] ?? 0) > (SOURCE_PRIORITY[existing.source] ?? 0)) {
                seen.set(key, g);
            }
        }
    }
    allGames = [...seen.values()];
}

// ── Tags ──────────────────────────────────────────────────────────────────────
function rebuildTagOptions() {
    const cur = tagSelect.value;
    while (tagSelect.options.length > 1) tagSelect.remove(1);
    const tags = new Set();
    allGames.forEach(z => (z.special || []).forEach(t => tags.add(t)));
    [...tags].sort().forEach(tag => {
        const opt = document.createElement('option');
        opt.value = tag;
        opt.textContent = tag.charAt(0).toUpperCase() + tag.slice(1);
        tagSelect.appendChild(opt);
    });
    tagSelect.value = cur;
}

// ── Sort / filter ─────────────────────────────────────────────────────────────
function getPopularity(g) { return g.rawId != null ? (popularityMap[g.rawId] ?? 0) : 0; }

function sortedList(list) {
    const mode = sortSelect.value;
    const copy = [...list];
    if (mode === 'name') copy.sort((a, b) => a.name.localeCompare(b.name));
    else if (mode === 'popular' || mode === 'trending') copy.sort((a, b) => getPopularity(b) - getPopularity(a));
    else if (mode === 'newest') copy.sort((a, b) => (b.rawId ?? -1) - (a.rawId ?? -1));
    return copy;
}

function filteredList() {
    const q   = searchBar.value.toLowerCase().trim();
    const tag = tagSelect.value;
    return allGames.filter(g => {
        return (!q || g.name.toLowerCase().includes(q)) &&
               (!tag || (g.special || []).includes(tag));
    });
}

// ── Cards ─────────────────────────────────────────────────────────────────────
function createCard(game, featured = false) {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.onclick = () => openGame(game);

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'thumb-wrap';

    const img = document.createElement('img');
    img.className = 'game-card-thumb';
    img.alt = game.name; img.loading = 'lazy'; img.src = game.cover;
    img.onerror = () => { img.style.opacity = '0.25'; };

    const overlay = document.createElement('div');
    overlay.className = 'play-overlay';
    overlay.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;

    thumbWrap.appendChild(img);
    thumbWrap.appendChild(overlay);

    if (featured) {
        const badge = document.createElement('span');
        badge.className = 'featured-badge';
        badge.textContent = '⭐ Featured';
        thumbWrap.appendChild(badge);
    }

    const pip = document.createElement('span');
    pip.className = 'source-pip ' + game.source + '-pip';
    const SOURCE_LABELS = { gnmath: 'GN-Math', truffled: 'Truffled', wasm: 'wasm.rip', ugs: 'UGS' };
    pip.title = SOURCE_LABELS[game.source] || game.source;
    thumbWrap.appendChild(pip);

    const name = document.createElement('div');
    name.className = 'game-card-name';
    name.textContent = game.name;

    card.appendChild(thumbWrap);
    card.appendChild(name);
    return card;
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderFeatured(list) {
    const featured = list.filter(g => g.featured);
    featuredGrid.innerHTML = '';
    if (featured.length === 0) { document.getElementById('featuredSection').style.display = 'none'; return; }
    document.getElementById('featuredSection').style.display = '';
    featured.forEach(g => featuredGrid.appendChild(createCard(g, true)));
}

function renderAll(list) {
    allGrid.innerHTML = '';
    const sorted = sortedList(list);
    if (sorted.length === 0) {
        allGrid.innerHTML = '<div class="empty-state">No games found. Try a different search!</div>';
        gameCount.textContent = '';
        return;
    }
    gameCount.textContent = `${sorted.length.toLocaleString()} game${sorted.length !== 1 ? 's' : ''}`;
    sorted.forEach(g => allGrid.appendChild(createCard(g)));
}

function render() {
    const list = filteredList();
    renderFeatured(list);
    renderAll(list);
    requestAnimationFrame(() => observeCards(document.getElementById('page-games')));
}

// ── Home featured row ─────────────────────────────────────────────────────────
function renderHomeFeatured() {
    const el = document.getElementById('homeFeaturedGames');
    const featured = allGames.filter(g => g.featured).slice(0, 12);
    el.innerHTML = '';
    if (!featured.length) { el.innerHTML = '<div class="row-loading"><p style="color:var(--text-muted)">No featured games yet.</p></div>'; return; }
    featured.forEach(g => {
        const card = document.createElement('div');
        card.className = 'home-game-card';
        card.onclick = () => { navigate('games'); setTimeout(() => openGame(g), 100); };
        const img = document.createElement('img');
        img.src = g.cover; img.alt = g.name; img.loading = 'lazy';
        img.onerror = () => { img.style.opacity = '0.25'; };
        const nm = document.createElement('div');
        nm.className = 'home-game-card-name'; nm.textContent = g.name;
        card.appendChild(img); card.appendChild(nm);
        el.appendChild(card);
    });
}

// ── Open game ─────────────────────────────────────────────────────────────────
async function openGame(game) {
    currentGame = game;
    document.getElementById('viewerTitle').textContent  = game.name;
    document.getElementById('viewerAuthor').textContent = game.author ? 'by ' + game.author : (game.source === 'truffled' ? 'via Truffled' : '');

    if (game.openType === 'external') { window.open(game.url, '_blank'); currentGame = null; return; }

    gameViewer.classList.remove('hidden');

    if (game.openType === 'iframe') {
        const fullUrl = game.url.startsWith('http') ? game.url : TRUFFLED + game.url;
        gameFrame.src = fullUrl;
    } else {
        gameFrame.src = 'about:blank';
        const url = resolvePlaceholders(game.url) + '?t=' + Date.now();
        try {
            const res  = await fetch(url);
            const html = await res.text();
            gameFrame.contentDocument.open();
            gameFrame.contentDocument.write(html);
            gameFrame.contentDocument.close();
        } catch (err) {
            gameViewer.classList.add('hidden');
            alert('Failed to load game: ' + err.message);
            currentGame = null;
        }
    }
    history.pushState(null, '', '?id=' + encodeURIComponent(game.id));
}

function closeGame() {
    gameViewer.classList.add('hidden');
    gameFrame.src = 'about:blank';
    try { gameFrame.contentDocument.write(''); } catch (_) {}
    currentGame = null;
    history.pushState(null, '', window.location.pathname);
}

function fullscreenGame() {
    const el = gameFrame;
    (el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen).call(el);
}

function newTabGame() {
    if (!currentGame) return;
    if (currentGame.openType === 'iframe') {
        const u = currentGame.url.startsWith('http') ? currentGame.url : TRUFFLED + currentGame.url;
        window.open(u, '_blank'); return;
    }
    const url = resolvePlaceholders(currentGame.url) + '?t=' + Date.now();
    fetch(url).then(r => r.text()).then(html => {
        const w = window.open('about:blank', '_blank');
        if (w) { w.document.open(); w.document.write(html); w.document.close(); }
    });
}

// ── Sources panel ─────────────────────────────────────────────────────────────
const sourcesBtn   = document.getElementById('sourcesBtn');
const sourcesPanel = document.getElementById('sourcesPanel');
const chkGnmath    = document.getElementById('chkGnmath');
const chkTruffled  = document.getElementById('chkTruffled');
const chkWasm      = document.getElementById('chkWasm');
const chkUgs       = document.getElementById('chkUgs');
chkGnmath.checked   = sources.gnmath;
chkTruffled.checked = sources.truffled;
chkWasm.checked     = sources.wasm;
chkUgs.checked      = sources.ugs;

sourcesBtn.addEventListener('click', e => { e.stopPropagation(); sourcesPanel.classList.toggle('hidden'); });
document.addEventListener('click', e => {
    if (!sourcesPanel.contains(e.target) && e.target !== sourcesBtn) sourcesPanel.classList.add('hidden');
});

function onSourceChange() {
    sources.gnmath   = chkGnmath.checked;
    sources.truffled = chkTruffled.checked;
    sources.wasm     = chkWasm.checked;
    sources.ugs      = chkUgs.checked;
    saveSources();
    mergeGames();
    rebuildTagOptions();
    render();
    renderHomeFeatured();
}
chkGnmath.addEventListener('change',   onSourceChange);
chkTruffled.addEventListener('change', onSourceChange);
chkWasm.addEventListener('change',     onSourceChange);
chkUgs.addEventListener('change',      onSourceChange);

// ── Theme (restored on load; toggled via Settings page) ──────────────────────
(function() {
    const t = localStorage.getItem('theme');
    if (t === 'light') { document.body.classList.remove('dark'); document.body.classList.add('light'); }
    else               { document.body.classList.add('dark');    document.body.classList.remove('light'); }
})();

searchBar.addEventListener('input',  render);
sortSelect.addEventListener('change', render);
tagSelect.addEventListener('change',  render);
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !gameViewer.classList.contains('hidden')) closeGame();
});

// ── Card scroll-reveal (IntersectionObserver) ─────────────────────────────────
const _cardObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
            const el = entry.target;
            el.style.transitionDelay = (i * 35) + 'ms';
            el.classList.add('card-visible');
            el.classList.remove('card-hidden');
            _cardObserver.unobserve(el);
        }
    });
}, { threshold: 0.07 });

function observeCards(root) {
    const cards = (root || document).querySelectorAll(
        '.game-card, .movie-card, .home-game-card, .home-movie-card'
    );
    cards.forEach(c => {
        if (!c.classList.contains('card-visible')) {
            c.classList.add('card-hidden');
            _cardObserver.observe(c);
        }
    });
}

// ── Boot ──────────────────────────────────────────────────────────────────────
(async () => {
    try {
        [gnmathRaw, truffledRaw, wasmRaw, ugsRaw] = await Promise.all([
            fetchGnmath(), fetchTruffled(), fetchWasm(), fetchUGS(), fetchPopularity()
        ]);
        document.getElementById('badgeGnmath').textContent   = gnmathRaw.length;
        document.getElementById('badgeTruffled').textContent = truffledRaw.length;
        document.getElementById('badgeWasm').textContent     = wasmRaw.length;
        document.getElementById('badgeUgs').textContent      = ugsRaw.length;
        mergeGames();
        rebuildTagOptions();
        render();
        renderHomeFeatured();
        requestAnimationFrame(() => observeCards(document.getElementById('page-home')));

        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        if (id) {
            const game = allGames.find(g => g.id === id);
            if (game) openGame(game);
        }
    } catch (err) {
        allGrid.innerHTML = `<div class="empty-state">⚠️ ${err.message}</div>`;
    }
})();
