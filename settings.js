/* ── Settings ── */

const FAVICON_PRESETS = {
    google:    { url: 'https://www.google.com/favicon.ico',           name: 'Google' },
    classroom: { url: 'https://ssl.gstatic.com/classroom/favicon.png', name: 'Google Classroom' },
    docs:      { url: 'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico', name: 'Google Docs' },
    khan:      { url: 'https://www.khanacademy.org/favicon.ico',      name: 'Khan Academy' },
};

function getOrCreateFaviconEl() {
    let el = document.querySelector("link[rel~='icon']");
    if (!el) {
        el = document.createElement('link');
        el.rel = 'icon';
        document.head.appendChild(el);
    }
    return el;
}

function applyCloak(name, faviconUrl) {
    if (name) document.title = name;
    if (faviconUrl) {
        const el = getOrCreateFaviconEl();
        el.href = faviconUrl;
    }
    updateTabPreview(name, faviconUrl);
}

function updateTabPreview(name, faviconUrl) {
    const nameEl = document.getElementById('tabPreviewName');
    const imgEl  = document.getElementById('tabPreviewFavicon');
    if (!nameEl) return;
    nameEl.textContent = name || 'AuroraZ';
    if (faviconUrl) {
        imgEl.src = faviconUrl;
        imgEl.style.display = 'inline-block';
    } else {
        imgEl.style.display = 'none';
    }
}

function saveCloakName() {
    const val = document.getElementById('cloakName').value.trim();
    if (val) {
        localStorage.setItem('cloak_name', val);
        document.title = val;
    } else {
        localStorage.removeItem('cloak_name');
        document.title = 'AuroraZ';
    }
    updateTabPreview(val || 'AuroraZ', localStorage.getItem('cloak_favicon'));
}

function saveCloakFavicon() {
    const val = document.getElementById('cloakFavicon').value.trim();
    if (val) {
        localStorage.setItem('cloak_favicon', val);
        const el = getOrCreateFaviconEl();
        el.href = val;
    } else {
        localStorage.removeItem('cloak_favicon');
    }
    updateTabPreview(document.getElementById('cloakName').value.trim() || localStorage.getItem('cloak_name') || 'AuroraZ', val);
}

function resetCloakName() {
    localStorage.removeItem('cloak_name');
    document.getElementById('cloakName').value = '';
    document.title = 'AuroraZ';
    updateTabPreview('AuroraZ', localStorage.getItem('cloak_favicon'));
}

function resetCloakFavicon() {
    localStorage.removeItem('cloak_favicon');
    document.getElementById('cloakFavicon').value = '';
    getOrCreateFaviconEl().removeAttribute('href');
    updateTabPreview(document.getElementById('cloakName').value.trim() || 'AuroraZ', '');
}

function applyFaviconPreset(key) {
    const p = FAVICON_PRESETS[key];
    if (!p) return;
    document.getElementById('cloakFavicon').value = p.url;
    if (!document.getElementById('cloakName').value.trim()) {
        document.getElementById('cloakName').value = p.name;
    }
    saveCloakFavicon();
    saveCloakName();
}

/* ── about:blank stealth ── */
function openAboutBlank() {
    const w = window.open('about:blank', '_blank');
    if (!w) { alert('Allow pop-ups for this site to use this feature.'); return; }
    const doc = w.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head>
<title>${document.title}</title>
<style>html,body{margin:0;padding:0;height:100%;overflow:hidden;}</style>
</head><body>
<iframe src="${location.href}" style="width:100%;height:100%;border:none;"></iframe>
</body></html>`);
    doc.close();
}

/* ── Panic key ── */
let listeningForKey = false;

function savePanicSettings() {
    const enabled = document.getElementById('panicEnabled').checked;
    const key     = document.getElementById('panicKey').value;
    const url     = document.getElementById('panicUrl').value.trim();
    localStorage.setItem('panic_enabled', enabled ? '1' : '0');
    localStorage.setItem('panic_key', key);
    localStorage.setItem('panic_url', url);
}

function clearPanicKey() {
    document.getElementById('panicKey').value = '';
    savePanicSettings();
}

function setPanicUrl(url) {
    document.getElementById('panicUrl').value = url;
    savePanicSettings();
}

function loadPanicSettings() {
    const enabled = localStorage.getItem('panic_enabled') === '1';
    const key     = localStorage.getItem('panic_key') || '';
    const url     = localStorage.getItem('panic_url') || '';
    const box     = document.getElementById('panicEnabled');
    if (box) box.checked = enabled;
    const ki = document.getElementById('panicKey');
    if (ki) ki.value = key;
    const ui = document.getElementById('panicUrl');
    if (ui) ui.value = url;
}

document.addEventListener('keydown', function(e) {
    const enabled = localStorage.getItem('panic_enabled') === '1';
    const key     = localStorage.getItem('panic_key');
    if (!enabled || !key) return;
    if (e.key === key) {
        const url = localStorage.getItem('panic_url') || 'https://www.google.com';
        location.replace(url);
    }
});

/* ── Panic key capture ── */
function initPanicKeyInput() {
    const input = document.getElementById('panicKey');
    if (!input) return;
    input.addEventListener('focus', () => { listeningForKey = true; input.placeholder = 'Press any key…'; });
    input.addEventListener('blur',  () => { listeningForKey = false; input.placeholder = 'Click and press a key…'; });
    input.addEventListener('keydown', function(e) {
        if (!listeningForKey) return;
        e.preventDefault();
        const label = e.key === ' ' ? 'Space' : e.key;
        input.value = label;
        savePanicSettings();
        input.blur();
    });
}

/* ── Theme (dark / light) ── */
function applyThemeToggle() {
    const isDark = document.getElementById('darkModeToggle').checked;
    document.body.classList.toggle('dark', isDark);
    document.body.classList.toggle('light', !isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function initDarkModeToggle() {
    const toggle = document.getElementById('darkModeToggle');
    if (!toggle) return;
    const stored = localStorage.getItem('theme');
    toggle.checked = stored !== 'light';
}

/* ── Restore on load ── */
function initSettings() {
    const storedName    = localStorage.getItem('cloak_name');
    const storedFavicon = localStorage.getItem('cloak_favicon');

    if (storedName) {
        document.getElementById('cloakName').value = storedName;
        document.title = storedName;
    }
    if (storedFavicon) {
        document.getElementById('cloakFavicon').value = storedFavicon;
        getOrCreateFaviconEl().href = storedFavicon;
    }
    updateTabPreview(storedName || 'AuroraZ', storedFavicon || '');

    loadPanicSettings();
    initPanicKeyInput();
    initDarkModeToggle();

    document.getElementById('cloakName').addEventListener('input', saveCloakName);
    document.getElementById('cloakFavicon').addEventListener('input', saveCloakFavicon);
    document.getElementById('panicUrl').addEventListener('input', savePanicSettings);
}

document.addEventListener('DOMContentLoaded', () => {
    const storedName    = localStorage.getItem('cloak_name');
    const storedFavicon = localStorage.getItem('cloak_favicon');
    if (storedName)    document.title = storedName;
    if (storedFavicon) getOrCreateFaviconEl().href = storedFavicon;

    if (document.getElementById('cloakName')) initSettings();
});

window._initSettings = initSettings;
