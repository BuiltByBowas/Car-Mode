// Side panel: the Car Mode control center opened from the toolbar icon.
(async () => {
  const $ = id => document.getElementById(id);
  const esc = str => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const { CLIPS, EVENTS } = CAR;
  const P = CarPaint;

  const [items, sounds, carCredit] = await Promise.all([
    CAR.wallpapers('../'),
    fetch('../assets/sounds/credits.json').then(r => r.json()),
    fetch('../assets/car/credits.json').then(r => r.json())
  ]);
  let s = await CAR.load();

  function toast(text) {
    let t = document.querySelector('.toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'toast';
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(t.timer);
    t.timer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  // ---------- Tabs ----------
  function showView(name) {
    document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === name)));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.dataset.view === name));
    try { localStorage.setItem('carmode-view', name); } catch (e) { /* storage blocked */ }
  }
  document.querySelector('.tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-view]');
    if (b) showView(b.dataset.view);
  });
  let startView = 'wall';
  try { startView = localStorage.getItem('carmode-view') || startView; } catch (e) { /* storage blocked */ }
  showView(startView);

  // ---------- Wallpapers ----------
  function renderCars() {
    $('cars').innerHTML = items.map(c => `
      <button class="car ${c.file === s.wallpaper ? 'on' : ''}" data-file="${esc(c.file)}" title="${esc(c.name)}">
        <img alt="" src="../assets/${c.dir}/${esc(c.thumb)}">${c.video ? '<span class="badge">VIDEO</span>' : ''}<span>${esc(c.name)}</span>
      </button>`).join('');
  }
  $('cars').addEventListener('click', async e => {
    const b = e.target.closest('[data-file]');
    if (!b) return;
    s = await CAR.save({ wallpaper: b.dataset.file, shuffle: false });
    render();
  });

  const segs = { smoke: 'smoke', carMode: 'carMode' };
  for (const [id, key] of Object.entries(segs)) {
    $(id).addEventListener('click', async e => {
      const b = e.target.closest('[data-v]');
      if (b) s = await CAR.save({ [key]: b.dataset.v });
      render();
    });
  }
  $('carSpeed').addEventListener('change', async () => { s = await CAR.save({ carSpeed: Number($('carSpeed').value) }); });

  // ---------- Paint shop ----------
  const CAR_SRC = '../assets/car/ferrari-side-480.png';
  const PAINTS = [
    ['Rosso', 'solid', '#d40000'], ['Giallo', 'solid', '#ffcc00'], ['Lambo green', 'solid', '#5ad400'], ['Racing green', 'solid', '#0b5d3b'],
    ['Electric blue', 'solid', '#1f5fff'], ['Nardo grey', 'solid', '#7d8186'], ['Pearl white', 'solid', '#e9e9ec'], ['Matte black', 'solid', '#1d1d20'],
    ['Gulf', 'gradient', '#6ec6e6', '#ff8200'], ['Sunset', 'gradient', '#ff3d6e', '#ffb800'], ['Galaxy', 'gradient', '#4f46e5', '#ec4899'], ['Toxic', 'gradient', '#00e5a0', '#c6ff00']
  ];
  $('paintSwatches').innerHTML = PAINTS.map(([n, t, a, b]) =>
    `<button class="sw" title="${n}" aria-label="${n} paint" data-p="${t}|${a}|${b || a}" style="background:${t === 'gradient' ? `linear-gradient(135deg, ${a}, ${b})` : a}"></button>`).join('');

  let paintTimer = 0;
  async function applyPaint(paint, save = true) {
    const blob = await P.paintCar(CAR_SRC, paint, 480);
    $('paintPreview').src = URL.createObjectURL(blob);
    if (!save) return;
    clearTimeout(paintTimer);
    paintTimer = setTimeout(async () => {
      s = await CAR.save({ carPaint: paint });
      if (paint.type === 'original') return chrome.storage.local.remove('carImage');
      await chrome.storage.local.set({ carImage: await P.blobToDataUrl(await P.paintCar(CAR_SRC, paint, 240)) });
    }, 150);
  }

  $('paintSwatches').addEventListener('click', e => {
    const b = e.target.closest('[data-p]');
    if (!b) return;
    const [type, c1, c2] = b.dataset.p.split('|');
    applyPaint({ type, c1, c2 });
    renderPaintControls({ type, c1, c2 });
  });
  $('paintType').addEventListener('click', e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    const paint = { ...s.carPaint, type: b.dataset.v };
    applyPaint(paint);
    renderPaintControls(paint);
  });
  for (const id of ['paint1', 'paint2']) {
    $(id).addEventListener('input', () => {
      const paint = { type: s.carPaint.type === 'original' ? 'solid' : s.carPaint.type, c1: $('paint1').value, c2: $('paint2').value };
      s.carPaint = paint;
      applyPaint(paint);
      renderPaintControls(paint);
    });
  }

  function renderPaintControls(p) {
    [...$('paintType').children].forEach(b => b.classList.toggle('on', b.dataset.v === p.type));
    $('paint1').value = p.c1;
    $('paint2').value = p.c2;
    document.querySelector('#paintPickers .c2').hidden = p.type !== 'gradient';
    document.querySelectorAll('#paintSwatches .sw').forEach(b => b.classList.toggle('on', b.dataset.p === `${p.type}|${p.c1}|${p.c2}` || (p.type === 'solid' && b.dataset.p === `solid|${p.c1}|${p.c1}`)));
  }

  // ---------- Accent ----------
  const ACCENTS = [
    ['#e10600'], ['#ff7a00'], ['#ffcc00'], ['#22c55e'], ['#06b6d4'], ['#3b82f6'], ['#8b5cf6'], ['#ec4899'],
    ['#6ec6e6', '#ff8200'], ['#ff3d6e', '#ffb800'], ['#4f46e5', '#ec4899'], ['#00e5a0', '#3b82f6']
  ];
  $('accentSwatches').innerHTML = ACCENTS.map(([a, b]) =>
    `<button class="sw" aria-label="Accent ${a}${b ? ` to ${b}` : ''}" data-a="${a}|${b || ''}" style="background:${b ? `linear-gradient(135deg, ${a}, ${b})` : a}"></button>`).join('');
  $('accentSwatches').addEventListener('click', async e => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const [c1, c2] = b.dataset.a.split('|');
    s = await CAR.save({ accent: { c1, c2: c2 || s.accent.c2, gradient: !!c2 } });
    render();
  });
  $('accentGradient').addEventListener('change', async () => { s = await CAR.save({ accent: { ...s.accent, gradient: $('accentGradient').checked } }); render(); });
  for (const [id, key] of [['accent1', 'c1'], ['accent2', 'c2']]) {
    $(id).addEventListener('input', () => {
      s.accent = { ...s.accent, [key]: $(id).value };
      P.applyAccent(document.documentElement, s.accent);
    });
    $(id).addEventListener('change', async () => { s = await CAR.save({ accent: s.accent }); });
  }

  // ---------- Themes: one click restyles Car Mode (accent colors) ----------
  const THEMES = [
    ['Carbon red', '#e10600'], ['Midnight', '#3b82f6'], ['Gulf', '#6ec6e6', '#ff8200'], ['Racing green', '#22c55e'],
    ['Lambo', '#ff7a00', '#ffcc00'], ['Pearl', '#64748b'], ['Sunset', '#ff3d6e', '#ffb800'], ['Nardo', '#9ca3af']
  ];
  $('themeSwatches').innerHTML = THEMES.map(([n, a, b]) =>
    `<button class="theme-card" data-a="${a}|${b || ''}" style="--t:${b ? `linear-gradient(135deg, ${a}, ${b})` : a}"><i></i>${n}</button>`).join('');
  $('themeSwatches').addEventListener('click', async e => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const [c1, c2] = b.dataset.a.split('|');
    s = await CAR.save({ accent: { c1, c2: c2 || s.accent.c2, gradient: !!c2 } });
    render();
    toast(`${b.textContent.trim()} theme on`);
  });
  function renderThemes() {
    const a = s.accent;
    document.querySelectorAll('.theme-card').forEach(b => {
      const [c1, c2] = b.dataset.a.split('|');
      b.classList.toggle('on', c1 === a.c1 && (c2 ? a.gradient && c2 === a.c2 : !a.gradient));
    });
  }

  // ---------- Start screen ----------
  $('replay').addEventListener('click', async () => {
    await chrome.storage.session.remove('started');
    chrome.tabs.create({ url: chrome.runtime.getURL('newtab/newtab.html#start') });
  });

  // ---------- Sounds ----------
  function renderEvents() {
    const options = Object.entries(CLIPS).map(([id, c]) => [id, c.label]);
    $('events').innerHTML = EVENTS.map(([key, label]) => `
      <div class="event">
        <span>${label}</span>
        <select data-event="${key}" aria-label="${label} sound">${options.map(([id, l]) => `<option value="${id}" ${s.sounds[key] === id ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <button class="icon-btn" data-preview="${key}" title="Preview" aria-label="Preview ${label} sound"><span class="i i-play"></span></button>
      </div>`).join('');
  }
  $('events').addEventListener('change', async e => {
    const sel = e.target.closest('[data-event]');
    if (!sel) return;
    s = await CAR.save({ sounds: { ...s.sounds, [sel.dataset.event]: sel.value } });
    CarPlayer.play(sel.value, s.volume);
  });
  $('events').addEventListener('click', e => {
    const b = e.target.closest('[data-preview]');
    if (b) CarPlayer.play(s.sounds[b.dataset.preview], s.volume);
  });

  for (const id of ['shuffle', 'entrance', 'sound', 'topCar', 'startScreen']) {
    $(id).addEventListener('change', async () => { s = await CAR.save({ [id]: $(id).checked }); });
  }
  $('volume').addEventListener('change', async () => {
    s = await CAR.save({ volume: Number($('volume').value) });
    CarPlayer.play('rev', s.volume);
  });
  $('idle').addEventListener('change', async () => { s = await CAR.save({ idle: Number($('idle').value) }); });

  // ---------- Chrome ----------
  $('openExt').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions' }));
  $('openGuide').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('guide/guide.html') }));
  $('openAppearance').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://settings/appearance' }));

  // ---------- Credits ----------
  const credit = c => `<p><b>${esc(c.name || c.title)}</b> — ${esc(c.author)}, <a href="${esc(c.licenseUrl || c.source)}" target="_blank" rel="noopener">${esc(c.license)}</a>, <a href="${esc(c.source)}" target="_blank" rel="noopener">source</a></p>`;
  $('credits').innerHTML = `<p>Photos, videos and recordings from Wikimedia Commons, used under their licenses:</p>
    ${[...items, ...carCredit, ...sounds].map(credit).join('')}
    <p>Icons: <a href="https://tabler.io/icons" target="_blank" rel="noopener">Tabler Icons</a> (MIT). Smoke textures are generated. Car Mode code is MIT licensed.</p>`;

  function render() {
    P.applyAccent(document.documentElement, s.accent);
    renderCars();
    renderEvents();
    for (const id of ['shuffle', 'entrance', 'sound', 'topCar', 'startScreen']) $(id).checked = !!s[id];
    $('volume').value = s.volume;
    $('idle').value = s.idle;
    $('carSpeed').value = s.carSpeed;
    [...$('smoke').children].forEach(b => b.classList.toggle('on', b.dataset.v === s.smoke));
    [...$('carMode').children].forEach(b => b.classList.toggle('on', b.dataset.v === s.carMode));
    $('accentGradient').checked = !!s.accent.gradient;
    $('accent1').value = s.accent.c1;
    $('accent2').value = s.accent.c2;
    $('accent2Wrap').hidden = !s.accent.gradient;
    renderPaintControls(s.carPaint);
    renderThemes();
  }
  render();
  applyPaint(s.carPaint, false);

  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local' || !changes.settings) return;
    s = await CAR.load();
    render();
  });
})();
