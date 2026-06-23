const MAX_HISTORY = 30;

// ── Storage helpers ───────────────────────────────────────────────────────────
function getFavGames()     { try { return JSON.parse(localStorage.getItem('fav_games')    || '[]'); } catch(_) { return []; } }
function getFavMovies()    { try { return JSON.parse(localStorage.getItem('fav_movies')   || '[]'); } catch(_) { return []; } }
function getHistGames()    { try { return JSON.parse(localStorage.getItem('hist_games')   || '[]'); } catch(_) { return []; } }
function getHistMovies()   { try { return JSON.parse(localStorage.getItem('hist_movies')  || '[]'); } catch(_) { return []; } }
function saveFavGames(a)   { localStorage.setItem('fav_games',   JSON.stringify(a)); }
function saveFavMovies(a)  { localStorage.setItem('fav_movies',  JSON.stringify(a)); }
function saveHistGames(a)  { localStorage.setItem('hist_games',  JSON.stringify(a)); }
function saveHistMovies(a) { localStorage.setItem('hist_movies', JSON.stringify(a)); }

// ── Game favorites ────────────────────────────────────────────────────────────
function isGameFav(id) { return getFavGames().includes(id); }

function toggleGameFav(game, e) {
    if (e) e.stopPropagation();
    let favs = getFavGames();
    if (favs.includes(game.id)) {
        favs = favs.filter(x => x !== game.id);
    } else {
        favs.unshift(game.id);
    }
    saveFavGames(favs);
    const faved = favs.includes(game.id);
    document.querySelectorAll(`.fav-btn[data-id="${game.id}"]`).forEach(btn => applyFavState(btn, faved));
    refreshFavsPage();
    updateViewerFavBtn('game', faved);
}

// ── Movie favorites ───────────────────────────────────────────────────────────
function isMovieFav(id) { return getFavMovies().some(m => m.id === id); }

function toggleMovieFav(item, e) {
    if (e) e.stopPropagation();
    let favs = getFavMovies();
    const existing = favs.some(m => m.id === item.id);
    if (existing) {
        favs = favs.filter(m => m.id !== item.id);
    } else {
        favs.unshift({
            id:          item.id,
            title:       item.title || item.name || 'Unknown',
            poster_path: item.poster_path || null,
            release_date: item.release_date || item.first_air_date || '',
            media_type:  item.media_type || (item._isTV ? 'tv' : 'movie'),
        });
    }
    saveFavMovies(favs);
    const faved = favs.some(m => m.id === item.id);
    document.querySelectorAll(`.fav-btn[data-id="m${item.id}"]`).forEach(btn => applyFavState(btn, faved));
    refreshFavsPage();
    updateViewerFavBtn('movie', faved);
}

function applyFavState(btn, faved) {
    btn.classList.toggle('faved', faved);
    btn.title = faved ? 'Remove from favorites' : 'Add to favorites';
    const path = btn.querySelector('path');
    if (path) path.setAttribute('fill', faved ? 'currentColor' : 'none');
}

function updateViewerFavBtn(type, faved) {
    const btn = document.getElementById(type === 'game' ? 'viewerFavBtn' : 'movieViewerFavBtn');
    if (btn) applyFavState(btn, faved);
}

// ── History ───────────────────────────────────────────────────────────────────
function addGameHistory(game) {
    let hist = getHistGames().filter(h => h.id !== game.id);
    hist.unshift({ id: game.id, name: game.name, cover: game.cover, source: game.source, ts: Date.now() });
    if (hist.length > MAX_HISTORY) hist = hist.slice(0, MAX_HISTORY);
    saveHistGames(hist);
    renderHomeRecentGames();
    const el = document.getElementById('histGameGrid');
    if (el && document.getElementById('page-favorites').classList.contains('active')) renderHistGames();
}

function addMovieHistory(item, isTV) {
    let hist = getHistMovies().filter(h => h.id !== item.id);
    hist.unshift({
        id:          item.id,
        title:       item.title || item.name || 'Unknown',
        poster_path: item.poster_path || null,
        media_type:  isTV ? 'tv' : (item.media_type || 'movie'),
        ts:          Date.now(),
    });
    if (hist.length > MAX_HISTORY) hist = hist.slice(0, MAX_HISTORY);
    saveHistMovies(hist);
    renderHomeRecentMovies();
    const el = document.getElementById('histMovieGrid');
    if (el && document.getElementById('page-favorites').classList.contains('active')) renderHistMovies();
}

// ── Fav button factory ────────────────────────────────────────────────────────
function makeFavBtn(dataId, faved, onClick) {
    const btn = document.createElement('button');
    btn.className = 'fav-btn' + (faved ? ' faved' : '');
    btn.dataset.id = dataId;
    btn.title = faved ? 'Remove from favorites' : 'Add to favorites';
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="${faved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
    btn.addEventListener('click', onClick);
    return btn;
}

// ── Favorites page rendering ──────────────────────────────────────────────────
function refreshFavsPage() {
    if (!document.getElementById('page-favorites').classList.contains('active')) return;
    renderFavGames();
    renderFavMovies();
    renderHistGames();
    renderHistMovies();
}

function renderFavGames() {
    const el = document.getElementById('favGameGrid');
    if (!el) return;
    const favIds = getFavGames();
    const games = favIds.map(id => (typeof allGames !== 'undefined' ? allGames.find(g => g.id === id) : null)).filter(Boolean);
    if (!games.length) {
        el.innerHTML = '<div class="empty-state">No favorite games yet.<br><span style="opacity:.6">Click ♥ on any game to save it here.</span></div>';
        return;
    }
    el.innerHTML = '';
    games.forEach(g => el.appendChild(buildFavGameCard(g)));
    requestAnimationFrame(() => typeof observeCards === 'function' && observeCards(document.getElementById('page-favorites')));
}

function renderFavMovies() {
    const el = document.getElementById('favMovieGrid');
    if (!el) return;
    const favs = getFavMovies();
    if (!favs.length) {
        el.innerHTML = '<div class="empty-state">No favorite movies yet.<br><span style="opacity:.6">Click ♥ on any movie to save it here.</span></div>';
        return;
    }
    el.innerHTML = '';
    favs.forEach(item => el.appendChild(buildFavMovieCard(item)));
    requestAnimationFrame(() => typeof observeCards === 'function' && observeCards(document.getElementById('page-favorites')));
}

function renderHistGames() {
    const el = document.getElementById('histGameGrid');
    if (!el) return;
    const hist = getHistGames();
    if (!hist.length) {
        el.innerHTML = '<div class="empty-state">No recently played games.</div>';
        return;
    }
    el.innerHTML = '';
    hist.forEach(h => {
        const game = (typeof allGames !== 'undefined' && allGames.find(g => g.id === h.id)) || h;
        el.appendChild(buildFavGameCard(game, timeAgo(h.ts)));
    });
    requestAnimationFrame(() => typeof observeCards === 'function' && observeCards(document.getElementById('page-favorites')));
}

function renderHistMovies() {
    const el = document.getElementById('histMovieGrid');
    if (!el) return;
    const hist = getHistMovies();
    if (!hist.length) {
        el.innerHTML = '<div class="empty-state">No recently watched movies or shows.</div>';
        return;
    }
    el.innerHTML = '';
    hist.forEach(h => el.appendChild(buildFavMovieCard(h, timeAgo(h.ts))));
    requestAnimationFrame(() => typeof observeCards === 'function' && observeCards(document.getElementById('page-favorites')));
}

function buildFavGameCard(game, timeLabel) {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.onclick = () => { navigate('games'); setTimeout(() => typeof openGame === 'function' && openGame(game), 100); };

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'thumb-wrap';

    const img = document.createElement('img');
    img.className = 'game-card-thumb';
    img.alt = game.name; img.loading = 'lazy'; img.src = game.cover || '';
    img.onerror = () => { img.style.opacity = '0.25'; };

    const overlay = document.createElement('div');
    overlay.className = 'play-overlay';
    overlay.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;

    thumbWrap.appendChild(img);
    thumbWrap.appendChild(overlay);

    const name = document.createElement('div');
    name.className = 'game-card-name';
    name.textContent = game.name;

    card.appendChild(thumbWrap);
    card.appendChild(name);

    if (timeLabel) {
        const tl = document.createElement('div');
        tl.className = 'card-time-label';
        tl.textContent = timeLabel;
        card.appendChild(tl);
    }
    return card;
}

function buildFavMovieCard(item, timeLabel) {
    const isTV  = item.media_type === 'tv';
    const title = item.title || item.name || 'Unknown';
    const poster = item.poster_path ? 'https://image.tmdb.org/t/p/w342' + item.poster_path : null;

    const card = document.createElement('div');
    card.className = 'movie-card';
    card.onclick = () => {
        navigate('movies');
        setTimeout(() => {
            if (isTV) { if (typeof openTV === 'function') openTV(item); }
            else      { if (typeof openMovie === 'function') openMovie(item); }
        }, 100);
    };

    const wrap = document.createElement('div');
    wrap.className = 'movie-poster-wrap';

    const img = document.createElement('img');
    img.className = 'movie-poster'; img.alt = title; img.loading = 'lazy';
    img.src = poster || ''; img.onerror = () => { img.style.opacity = '0.2'; };

    const overlay = document.createElement('div');
    overlay.className = 'movie-play-overlay';
    overlay.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;

    wrap.appendChild(img);
    wrap.appendChild(overlay);

    if (isTV) {
        const badge = document.createElement('div');
        badge.className = 'movie-type-badge'; badge.textContent = 'TV';
        wrap.appendChild(badge);
    }

    const year = (item.release_date || '').slice(0, 4);
    const info = document.createElement('div');
    info.className = 'movie-info';
    info.innerHTML = `<div class="movie-title">${title}</div>${timeLabel ? `<div class="movie-year">${timeLabel}</div>` : (year ? `<div class="movie-year">${year}</div>` : '')}`;

    card.appendChild(wrap);
    card.appendChild(info);
    return card;
}

// ── Home history rows ─────────────────────────────────────────────────────────
function renderHomeRecentGames() {
    const section = document.getElementById('homeRecentGamesSection');
    const el      = document.getElementById('homeRecentGames');
    if (!el) return;
    const hist = getHistGames().slice(0, 12);
    if (!hist.length) { if (section) section.style.display = 'none'; return; }
    if (section) section.style.display = '';
    el.innerHTML = '';
    hist.forEach(h => {
        const game = (typeof allGames !== 'undefined' && allGames.find(g => g.id === h.id)) || h;
        const card = document.createElement('div');
        card.className = 'home-game-card';
        card.onclick = () => { navigate('games'); setTimeout(() => typeof openGame === 'function' && openGame(game), 100); };
        const img = document.createElement('img');
        img.src = game.cover || h.cover || ''; img.alt = game.name; img.loading = 'lazy';
        img.onerror = () => { img.style.opacity = '0.25'; };
        const nm = document.createElement('div');
        nm.className = 'home-game-card-name'; nm.textContent = game.name;
        card.appendChild(img); card.appendChild(nm);
        el.appendChild(card);
    });
    requestAnimationFrame(() => typeof observeCards === 'function' && observeCards(document.getElementById('page-home')));
}

function renderHomeRecentMovies() {
    const section = document.getElementById('homeRecentMoviesSection');
    const el      = document.getElementById('homeRecentMovies');
    if (!el) return;
    const hist = getHistMovies().slice(0, 12);
    if (!hist.length) { if (section) section.style.display = 'none'; return; }
    if (section) section.style.display = '';
    el.innerHTML = '';
    hist.forEach(h => {
        const card = document.createElement('div');
        card.className = 'home-movie-card';
        card.onclick = () => {
            navigate('movies');
            setTimeout(() => {
                if (h.media_type === 'tv') { if (typeof openTV === 'function') openTV(h); }
                else { if (typeof openMovie === 'function') openMovie(h); }
            }, 100);
        };
        const img = document.createElement('img');
        img.src = h.poster_path ? 'https://image.tmdb.org/t/p/w342' + h.poster_path : '';
        img.alt = h.title; img.loading = 'lazy';
        img.onerror = () => { img.style.opacity = '0.2'; };
        const title = document.createElement('div');
        title.className = 'home-movie-card-title'; title.textContent = h.title;
        card.appendChild(img); card.appendChild(title);
        el.appendChild(card);
    });
    requestAnimationFrame(() => typeof observeCards === 'function' && observeCards(document.getElementById('page-home')));
}

// ── Favorites page tab switching ──────────────────────────────────────────────
function switchFavTab(tab) {
    document.querySelectorAll('.fav-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.fav-tab-section').forEach(s => s.classList.remove('active'));
    document.querySelector(`.fav-tab-btn[data-tab="${tab}"]`).classList.add('active');
    document.getElementById('favTab-' + tab).classList.add('active');
}

// ── Utility ───────────────────────────────────────────────────────────────────
function timeAgo(ts) {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'just now';
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    const d = Math.floor(h / 24);
    if (d < 7)  return d + 'd ago';
    return Math.floor(d / 7) + 'w ago';
}

// ── Hook navigate to refresh Library page when opened ────────────────────────
(function() {
    const _orig = window.navigate;
    if (typeof _orig === 'function') {
        window.navigate = function(page) {
            _orig(page);
            if (page === 'favorites') {
                renderFavGames();
                renderFavMovies();
                renderHistGames();
                renderHistMovies();
            }
        };
    }
})();

// ── Init: restore home history on page load ───────────────────────────────────
renderHomeRecentGames();
renderHomeRecentMovies();
