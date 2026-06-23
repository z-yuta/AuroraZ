const IMG_BASE  = 'https://image.tmdb.org/t/p/w342';
const VIDLINK   = 'https://vidlink.pro';
const TMDB_BASE = 'https://api.themoviedb.org/3';

function tmdbUrl(path, params = {}) {
    const cfg = window.AURORA_CONFIG || {};
    if (cfg.staticMode && cfg.tmdbKey) {
        const u = new URL(TMDB_BASE + path);
        u.searchParams.set('api_key', cfg.tmdbKey);
        for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
        return u.toString();
    }
    const base = path.startsWith('/tv') ? '/api/tv' : '/api/movies';
    const route = path.replace(/^\/(movie|tv)\//, '').replace(/\/season\/.*/, '');
    const qs = new URLSearchParams(params).toString();
    return `${base}${path}${qs ? '?' + qs : ''}`;
}

function apiUrl(localPath, params = {}) {
    const cfg = window.AURORA_CONFIG || {};
    if (cfg.staticMode && cfg.tmdbKey) {
        const map = {
            '/api/movies/popular':  '/movie/popular',
            '/api/movies/trending': '/trending/movie/week',
            '/api/movies/top':      '/movie/top_rated',
            '/api/movies/search':   '/search/multi',
            '/api/tv/popular':      '/tv/popular',
            '/api/tv/trending':     '/trending/tv/week',
            '/api/tv/top':          '/tv/top_rated',
        };
        const tmdbPath = map[localPath];
        if (tmdbPath) {
            const u = new URL(TMDB_BASE + tmdbPath);
            u.searchParams.set('api_key', cfg.tmdbKey);
            for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
            return u.toString();
        }
    }
    const qs = new URLSearchParams(params).toString();
    return localPath + (qs ? '?' + qs : '');
}

function tvDetailUrl(id) {
    const cfg = window.AURORA_CONFIG || {};
    if (cfg.staticMode && cfg.tmdbKey) {
        return `${TMDB_BASE}/tv/${id}?api_key=${cfg.tmdbKey}`;
    }
    return `/api/tv/seasons?id=${id}`;
}

function tvEpisodeUrl(id, season) {
    const cfg = window.AURORA_CONFIG || {};
    if (cfg.staticMode && cfg.tmdbKey) {
        return `${TMDB_BASE}/tv/${id}/season/${season}?api_key=${cfg.tmdbKey}`;
    }
    return `/api/tv/episodes?id=${id}&season=${season}`;
}

let mediaMode   = 'movies'; // 'movies' | 'tv'
let mediaFilter = 'popular';
let mediaPage   = 1;
let mediaSearch = '';
let searchDebounce = null;
let currentTV   = null; // { id, name, seasons }

// ── Switch movie/tv tabs ───────────────────────────────────────────────────────
function switchMediaTab(btn, tab) {
    document.querySelectorAll('.media-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    mediaMode = tab.startsWith('tv') ? 'tv' : 'movies';
    mediaPage = 1;
    mediaSearch = '';
    document.getElementById('movieSearch').value = '';
    document.getElementById('movieGrid').innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading…</p></div>';
    document.getElementById('loadMoreBtn').classList.add('hidden');
    loadMedia();
}

// ── Sub-filter (popular/trending/top) ─────────────────────────────────────────
function setMovieFilter(filter, btn) {
    document.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    mediaFilter = filter;
    mediaPage = 1;
    mediaSearch = '';
    document.getElementById('movieSearch').value = '';
    document.getElementById('movieGrid').innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading…</p></div>';
    document.getElementById('loadMoreBtn').classList.add('hidden');
    loadMedia();
}

// ── Load media ─────────────────────────────────────────────────────────────────
async function loadMedia(append = false) {
    const grid = document.getElementById('movieGrid');
    if (!append) grid.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading…</p></div>';

    try {
        let endpoint;
        if (mediaSearch.trim()) {
            endpoint = apiUrl('/api/movies/search', { q: mediaSearch, page: mediaPage });
        } else if (mediaMode === 'tv') {
            endpoint = apiUrl(`/api/tv/${mediaFilter}`, { page: mediaPage });
        } else {
            endpoint = apiUrl(`/api/movies/${mediaFilter}`, { page: mediaPage });
        }

        const res  = await fetch(endpoint);
        const data = await res.json();
        const results = (data.results || []).filter(item => item.poster_path);

        if (!append) grid.innerHTML = '';

        if (results.length === 0 && !append) {
            grid.innerHTML = '<div class="empty-state">Nothing found. Try a different search.</div>';
            document.getElementById('loadMoreBtn').classList.add('hidden');
            return;
        }

        results.forEach(item => grid.appendChild(createMovieCard(item)));
        requestAnimationFrame(() => typeof observeCards === 'function' && observeCards(document.getElementById('page-movies')));

        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (data.total_pages && mediaPage < data.total_pages) {
            loadMoreBtn.classList.remove('hidden');
        } else {
            loadMoreBtn.classList.add('hidden');
        }
    } catch (err) {
        if (!append) grid.innerHTML = `<div class="empty-state">⚠️ Failed to load: ${err.message}</div>`;
    }
}

async function loadMoreMedia() {
    mediaPage++;
    await loadMedia(true);
}

// ── Create card ────────────────────────────────────────────────────────────────
function createMovieCard(item) {
    const isTV   = item.media_type === 'tv' || (mediaMode === 'tv' && !mediaSearch);
    const title  = item.title || item.name || 'Unknown';
    const year   = (item.release_date || item.first_air_date || '').slice(0, 4);
    const rating = item.vote_average ? item.vote_average.toFixed(1) : null;
    const poster = item.poster_path ? IMG_BASE + item.poster_path : null;

    const card = document.createElement('div');
    card.className = 'movie-card';
    card.onclick = () => isTV ? openTV(item) : openMovie(item);

    const wrap = document.createElement('div');
    wrap.className = 'movie-poster-wrap';

    const img = document.createElement('img');
    img.className = 'movie-poster'; img.alt = title; img.loading = 'lazy';
    img.src = poster || '';
    img.onerror = () => { img.style.opacity = '0.2'; };

    const overlay = document.createElement('div');
    overlay.className = 'movie-play-overlay';
    overlay.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;

    wrap.appendChild(img);
    wrap.appendChild(overlay);

    if (rating) {
        const rat = document.createElement('div');
        rat.className = 'movie-rating';
        rat.textContent = '★ ' + rating;
        wrap.appendChild(rat);
    }

    if (item.media_type === 'tv' || (mediaMode === 'tv' && !mediaSearch)) {
        const badge = document.createElement('div');
        badge.className = 'movie-type-badge';
        badge.textContent = 'TV';
        wrap.appendChild(badge);
    }

    if (typeof makeFavBtn === 'function') {
        const heart = makeFavBtn('m' + item.id, typeof isMovieFav === 'function' && isMovieFav(item.id), (e) => {
            e.stopPropagation();
            const enriched = Object.assign({}, item, { media_type: isTV ? 'tv' : (item.media_type || 'movie') });
            if (typeof toggleMovieFav === 'function') toggleMovieFav(enriched, e);
        });
        heart.className += ' card-fav-btn movie-card-fav-btn';
        wrap.appendChild(heart);
    }

    const info = document.createElement('div');
    info.className = 'movie-info';
    info.innerHTML = `<div class="movie-title">${title}</div>${year ? `<div class="movie-year">${year}</div>` : ''}`;

    card.appendChild(wrap);
    card.appendChild(info);
    return card;
}

// ── Open movie ─────────────────────────────────────────────────────────────────
function openMovie(item) {
    const title = item.title || item.name || 'Movie';
    const year  = (item.release_date || '').slice(0, 4);
    document.getElementById('movieViewerTitle').textContent = title;
    document.getElementById('movieViewerMeta').textContent  = year ? `${year} · Movie` : 'Movie';
    document.getElementById('tvEpisodeControls').style.display = 'none';
    document.getElementById('movieFrame').src = `${VIDLINK}/movie/${item.id}`;
    document.getElementById('movieViewer').classList.remove('hidden');

    window._currentMovieItem = Object.assign({}, item, { media_type: item.media_type || 'movie' });
    if (typeof addMovieHistory === 'function') addMovieHistory(item, false);
    const favBtn = document.getElementById('movieViewerFavBtn');
    if (favBtn && typeof isMovieFav === 'function') {
        const faved = isMovieFav(item.id);
        favBtn.classList.toggle('faved', faved);
        favBtn.textContent = faved ? '♥ Favorited' : '♥ Favorite';
    }
}

// ── Open TV show ───────────────────────────────────────────────────────────────
async function openTV(item) {
    const title = item.name || item.title || 'TV Show';
    document.getElementById('movieViewerTitle').textContent = title;
    document.getElementById('movieViewerMeta').textContent  = 'Loading seasons…';
    document.getElementById('tvEpisodeControls').style.display = 'flex';
    document.getElementById('movieViewer').classList.remove('hidden');

    window._currentMovieItem = Object.assign({}, item, { media_type: 'tv' });
    if (typeof addMovieHistory === 'function') addMovieHistory(item, true);
    const favBtn = document.getElementById('movieViewerFavBtn');
    if (favBtn && typeof isMovieFav === 'function') {
        const faved = isMovieFav(item.id);
        favBtn.classList.toggle('faved', faved);
        favBtn.textContent = faved ? '♥ Favorited' : '♥ Favorite';
    }

    try {
        const res  = await fetch(tvDetailUrl(item.id));
        const data = await res.json();
        const seasons = (data.seasons || []).filter(s => s.season_number > 0);
        currentTV = { id: item.id, name: title, seasons };

        const seasonSel = document.getElementById('seasonSelect');
        seasonSel.innerHTML = seasons.map(s =>
            `<option value="${s.season_number}">Season ${s.season_number}</option>`
        ).join('');

        document.getElementById('movieViewerMeta').textContent = `TV Series · ${seasons.length} season${seasons.length !== 1 ? 's' : ''}`;
        await loadSeason();
    } catch (err) {
        document.getElementById('movieViewerMeta').textContent = 'Error loading seasons';
    }
}

async function loadSeason() {
    if (!currentTV) return;
    const season = document.getElementById('seasonSelect').value;
    try {
        const res  = await fetch(tvEpisodeUrl(currentTV.id, season));
        const data = await res.json();
        const eps  = data.episodes || [];

        const epSel = document.getElementById('episodeSelect');
        epSel.innerHTML = eps.map(e =>
            `<option value="${e.episode_number}">Ep ${e.episode_number}${e.name ? ': ' + e.name.slice(0, 28) : ''}</option>`
        ).join('');

        loadEpisode();
    } catch (_) {}
}

function loadEpisode() {
    if (!currentTV) return;
    const season  = document.getElementById('seasonSelect').value;
    const episode = document.getElementById('episodeSelect').value;
    document.getElementById('movieFrame').src = `${VIDLINK}/tv/${currentTV.id}/${season}/${episode}`;
}

function closeMovie() {
    document.getElementById('movieViewer').classList.add('hidden');
    document.getElementById('movieFrame').src = 'about:blank';
    currentTV = null;
}

function fullscreenMovie() {
    const el = document.getElementById('movieFrame');
    (el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen).call(el);
}

// ── Home trending row ──────────────────────────────────────────────────────────
async function renderHomeTrending() {
    const el = document.getElementById('homeTrendingMovies');
    try {
        const res  = await fetch(apiUrl('/api/movies/trending'));
        const data = await res.json();
        const items = (data.results || []).filter(i => i.poster_path).slice(0, 14);
        el.innerHTML = '';
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'home-movie-card';
            card.onclick = () => { navigate('movies'); setTimeout(() => openMovie(item), 100); };
            const img = document.createElement('img');
            img.src = IMG_BASE + item.poster_path; img.alt = item.title || item.name; img.loading = 'lazy';
            img.onerror = () => { img.style.opacity = '0.2'; };
            const title = document.createElement('div');
            title.className = 'home-movie-card-title';
            title.textContent = item.title || item.name || '';
            card.appendChild(img); card.appendChild(title);
            el.appendChild(card);
        });
    } catch (_) {
        el.innerHTML = '<div class="row-loading"><p style="color:var(--text-muted)">Could not load movies.</p></div>';
    }
}

// ── Search ────────────────────────────────────────────────────────────────────
document.getElementById('movieSearch').addEventListener('input', e => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
        mediaSearch = e.target.value.trim();
        mediaPage = 1;
        document.getElementById('movieGrid').innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Searching…</p></div>';
        loadMedia();
    }, 400);
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.getElementById('movieViewer').classList.contains('hidden')) closeMovie();
});

// ── Init ──────────────────────────────────────────────────────────────────────
loadMedia();
renderHomeTrending();
