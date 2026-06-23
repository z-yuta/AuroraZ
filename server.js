const express = require('express');
const path = require('path');
const app = express();

const TMDB_KEY = process.env.TMDB_API_KEY;
const TMDB = 'https://api.themoviedb.org/3';

app.use(express.static(path.join(__dirname)));

// ── wasm.rip proxy ────────────────────────────────────────────────────────────
app.get('/api/wasm-games', async (req, res) => {
    try {
        const r = await fetch('https://wasm.rip/games.json', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!r.ok) throw new Error('upstream ' + r.status);
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.json(await r.json());
    } catch (err) { res.status(502).json({ error: err.message }); }
});

// ── UGS games list ────────────────────────────────────────────────────────────
app.get('/api/ugs-games', async (req, res) => {
    try {
        const r = await fetch('https://cdn.jsdelivr.net/gh/bubbls/ugs-singlefile@main/games.js', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!r.ok) throw new Error('upstream ' + r.status);
        const text = await r.text();
        const match = text.match(/let files\s*=\s*(\[[\s\S]*?\]);/);
        if (!match) throw new Error('parse failed');
        res.setHeader('Cache-Control', 'public, max-age=600');
        res.json(JSON.parse(match[1]));
    } catch (err) { res.status(502).json({ error: err.message }); }
});

// ── UGS game proxy (strips X-Frame-Options so games load in iframe) ───────────
app.get('/api/ugs-proxy', async (req, res) => {
    try {
        const file = req.query.file || '';
        if (!file || !/^[a-zA-Z0-9 ._\-()']+$/.test(file)) return res.status(400).send('Bad file');
        const normalized = file.includes('.') ? file : file + '.html';
        const url = `https://cdn.jsdelivr.net/gh/bubbls/ugs-singlefile/UGS-Files/${encodeURIComponent(normalized)}`;
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!r.ok) throw new Error('upstream ' + r.status);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(await r.text());
    } catch (err) { res.status(502).send('Error: ' + err.message); }
});

// ── Truffled proxy ────────────────────────────────────────────────────────────
app.get('/api/truffled-games', async (req, res) => {
    try {
        const response = await fetch('https://truffled.lol/js/json/g.json', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (!response.ok) throw new Error('upstream ' + response.status);
        const data = await response.json();
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.json(data);
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});

// ── TMDB proxy helpers ────────────────────────────────────────────────────────
async function tmdb(path, params = {}) {
    const url = new URL(TMDB + path);
    url.searchParams.set('api_key', TMDB_KEY);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('TMDB ' + res.status);
    return res.json();
}

app.get('/api/movies/popular',  async (req, res) => { try { res.json(await tmdb('/movie/popular',  { page: req.query.page || 1 })); } catch(e) { res.status(502).json({ error: e.message }); }});
app.get('/api/movies/trending', async (req, res) => { try { res.json(await tmdb('/trending/movie/week')); } catch(e) { res.status(502).json({ error: e.message }); }});
app.get('/api/movies/top',      async (req, res) => { try { res.json(await tmdb('/movie/top_rated',  { page: req.query.page || 1 })); } catch(e) { res.status(502).json({ error: e.message }); }});
app.get('/api/movies/search',   async (req, res) => { try { res.json(await tmdb('/search/multi',    { query: req.query.q || '', page: req.query.page || 1 })); } catch(e) { res.status(502).json({ error: e.message }); }});
app.get('/api/movies/genres',   async (req, res) => { try { res.json(await tmdb('/genre/movie/list')); } catch(e) { res.status(502).json({ error: e.message }); }});

app.get('/api/tv/popular',   async (req, res) => { try { res.json(await tmdb('/tv/popular',   { page: req.query.page || 1 })); } catch(e) { res.status(502).json({ error: e.message }); }});
app.get('/api/tv/trending',  async (req, res) => { try { res.json(await tmdb('/trending/tv/week')); } catch(e) { res.status(502).json({ error: e.message }); }});
app.get('/api/tv/top',       async (req, res) => { try { res.json(await tmdb('/tv/top_rated',  { page: req.query.page || 1 })); } catch(e) { res.status(502).json({ error: e.message }); }});

app.get('/api/tv/seasons', async (req, res) => {
    try { res.json(await tmdb('/tv/' + req.query.id)); } catch(e) { res.status(502).json({ error: e.message }); }
});
app.get('/api/tv/episodes', async (req, res) => {
    try { res.json(await tmdb('/tv/' + req.query.id + '/season/' + req.query.season)); } catch(e) { res.status(502).json({ error: e.message }); }
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => console.log('AuroraZ on port ' + PORT));
