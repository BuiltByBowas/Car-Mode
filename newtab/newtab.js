// New tab: real sports-car photo or drift video, smoke, clock, search and most-visited shortcuts.
(async () => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let settings = await CAR.load();
  CarPaint.applyAccent(document.documentElement, settings.accent);
  const items = await CAR.wallpapers();
  const smoke = new CarSmoke($('smoke'), { max: 320 });

  // ---------- Wallpaper ----------
  let index = Math.max(0, items.findIndex(c => c.file === settings.wallpaper));
  if (settings.shuffle && items.length > 1) {
    const { lastCar } = await chrome.storage.session.get('lastCar').catch(() => ({}));
    do index = Math.floor(Math.random() * items.length); while (items[index].file === lastCar);
  }

  // Moments in each clip where the car is mid-drift; smoke rolls across the whole page there.
  const DRIFT_MARKS = { 'drift-smoke.webm': [0.6, 3.6, 6.4, 8.8], 'night-drift.webm': [2.0, 7.0, 11.5] };
  let marks = [];
  let lastT = 0;

  function smokeAmount() {
    return settings.smoke === 'full' ? 1 : settings.smoke === 'light' ? 0.45 : 0;
  }

  function rollSmoke(strength = 1) {
    const a = smokeAmount() * strength;
    if (!a) return;
    smoke.billow(innerWidth * (0.3 + Math.random() * 0.4), innerHeight * 0.92, { width: innerWidth * 1.2, density: 1.3 * a, drift: Math.random() < 0.5 ? -1 : 1, alpha: 0.36, life: 3.2 });
  }

  const video = $('video');
  video.addEventListener('timeupdate', () => {
    const t = video.currentTime;
    if (t < lastT) rollSmoke(1.2); // hide the loop seam in smoke
    for (const m of marks) if (lastT < m && t >= m) rollSmoke(0.9);
    lastT = t;
  });

  async function show(i, { entering = false } = {}) {
    index = (i + items.length) % items.length;
    const item = items[index];
    const url = `../assets/${item.dir}/${item.file}`;
    const photo = $('photo');
    if (item.video) {
      photo.classList.remove('ready');
      video.classList.remove('ready');
      // the drift clip is letterboxed inside its frame; zoom past the bars
      video.style.setProperty('--crop', item.file === 'drift-smoke.webm' ? 1.4 : 1.03);
      video.src = url;
      marks = DRIFT_MARKS[item.file] || [];
      lastT = 0;
      await video.play().catch(() => {});
      video.classList.add('ready');
    } else {
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.classList.remove('ready');
      marks = [];
      const img = new Image();
      img.src = url;
      await img.decode().catch(() => {});
      photo.classList.remove('ready');
      void photo.offsetWidth;
      photo.style.backgroundImage = `url("${url}")`;
      photo.classList.add('ready');
    }
    document.body.classList.toggle('entering', entering);
    if (entering) setTimeout(() => rollSmoke(0.8), 150);
    $('tag').textContent = item.video ? 'VIDEO' : 'PHOTO';
    $('tag').classList.toggle('video', item.video);
    $('carName').textContent = item.name;
    $('credit').innerHTML = `${item.video ? 'Video' : 'Photo'}: ${esc(item.author)} · <a href="${esc(item.source)}" target="_blank" rel="noopener">${esc(item.license)}</a> via Wikimedia Commons`;
    chrome.storage.session.set({ lastCar: item.file }).catch(() => {});
  }

  // The ignition screen (if it shows) plays the entrance when the user drives off.
  window.CarNewTab = { show: () => show(index, { entering: settings.entrance }), smoke: rollSmoke };
  // ignition.js sets this promise synchronously while this script is awaiting storage
  if (!(await window.CarIgnition)) show(index, { entering: settings.entrance });

  const step = async dir => {
    await show(index + dir);
    CAR.save({ wallpaper: items[index].file });
  };
  $('prev').addEventListener('click', () => step(-1));
  $('next').addEventListener('click', () => step(1));
  addEventListener('keydown', e => {
    if (e.target.closest('input') || !$('ign').hidden) return;
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
  document.addEventListener('visibilitychange', () => {
    if (!items[index].video) return;
    if (document.hidden) video.pause(); else video.play().catch(() => {});
  });

  // ---------- Clock ----------
  function tick() {
    const d = new Date();
    $('clock').textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    $('date').textContent = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  }
  tick();
  setInterval(tick, 1000);

  // ---------- Search ----------
  $('search').addEventListener('submit', e => {
    e.preventDefault();
    const q = $('q').value.trim();
    if (!q) return;
    if (!q.includes(' ') && /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(q)) {
      location.href = /^https?:/.test(q) ? q : `https://${q}`;
    } else {
      chrome.search.query({ text: q, disposition: 'CURRENT_TAB' });
    }
  });

  // ---------- Shortcuts ----------
  const sites = (await chrome.topSites.get()).slice(0, 8);
  $('shortcuts').innerHTML = sites.map(s => {
    const host = (() => { try { return new URL(s.url).hostname.replace(/^www\./, ''); } catch (e) { return s.url; } })();
    return `<a class="shortcut" href="${esc(s.url)}" title="${esc(s.title)}">
      <span class="fav"><img alt="" src="/_favicon/?pageUrl=${encodeURIComponent(s.url)}&size=32"></span>
      <span>${esc(s.title || host)}</span></a>`;
  }).join('');

  // ---------- Sound + controls ----------
  function renderSound(on) {
    $('sound').innerHTML = `<span class="i ${on ? 'i-volume' : 'i-mute'}"></span>`;
    $('sound').title = on ? 'Sound on' : 'Sound off';
  }
  renderSound(settings.sound);
  $('sound').addEventListener('click', async () => {
    const s = await CAR.load();
    renderSound(!s.sound);
    CAR.save({ sound: !s.sound });
  });
  $('settings').addEventListener('click', async () => {
    const win = await chrome.windows.getCurrent();
    chrome.sidePanel.open({ windowId: win.id });
  });
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local' || !changes.settings) return;
    const before = settings;
    settings = await CAR.load();
    CarPaint.applyAccent(document.documentElement, settings.accent);
    renderSound(settings.sound);
    if (before.wallpaper !== settings.wallpaper && !settings.shuffle) {
      const i = items.findIndex(c => c.file === settings.wallpaper);
      if (i >= 0 && i !== index) show(i);
    }
  });
})();
