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
  // Each view has its own car photo and paint mask; paint is applied to both so switching views keeps it.
  const CARS = {
    side: { src: '../assets/car/ferrari-side-480.png', mask: 'red', key: 'carImage' },
    top: { src: '../assets/car/s2000-top-480.png', mask: 'silver', key: 'carImageTop' }
  };
  const PAINTS = [
    ['Rosso', 'solid', '#d40000'], ['Giallo', 'solid', '#ffcc00'], ['Lambo green', 'solid', '#5ad400'], ['Racing green', 'solid', '#0b5d3b'],
    ['Electric blue', 'solid', '#1f5fff'], ['Nardo grey', 'solid', '#7d8186'], ['Pearl white', 'solid', '#e9e9ec'], ['Matte black', 'solid', '#1d1d20'],
    ['Gulf', 'gradient', '#6ec6e6', '#ff8200'], ['Sunset', 'gradient', '#ff3d6e', '#ffb800'], ['Galaxy', 'gradient', '#4f46e5', '#ec4899'], ['Toxic', 'gradient', '#00e5a0', '#c6ff00']
  ];
  $('paintSwatches').innerHTML = PAINTS.map(([n, t, a, b]) =>
    `<button class="sw" title="${n}" aria-label="${n} paint" data-p="${t}|${a}|${b || a}" style="background:${t === 'gradient' ? `linear-gradient(135deg, ${a}, ${b})` : a}"></button>`).join('');

  let paintTimer = 0;
  async function applyPaint(paint, save = true) {
    const view = CARS[s.carView] || CARS.side;
    const blob = await P.paintCar(view.src, paint, 480, view.mask);
    $('paintPreview').src = URL.createObjectURL(blob);
    if (!save) return;
    clearTimeout(paintTimer);
    paintTimer = setTimeout(async () => {
      s = await CAR.save({ carPaint: paint });
      if (paint.type === 'original') return chrome.storage.local.remove(['carImage', 'carImageTop']);
      const out = {};
      for (const c of Object.values(CARS)) out[c.key] = await P.blobToDataUrl(await P.paintCar(c.src, paint, 240, c.mask));
      await chrome.storage.local.set(out);
    }, 150);
  }

  $('carView').addEventListener('click', async e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    s = await CAR.save({ carView: b.dataset.v });
    render();
    applyPaint(s.carPaint, false);
  });

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

  // ---------- Chrome theme builder ----------
  // [name, style, bar color, bar end, active tab, Car Mode accent (c1, c2 for gradients)]
  const THEMES = [
    ['Carbon red', 'carbon', '#141416', '#141416', '#3b1214', '#e10600'],
    ['Midnight', 'solid', '#0b1020', '#0b1020', '#27324d', '#3b82f6'],
    ['Gulf', 'gradient', '#6ec6e6', '#ff8200', '#f4f7fa', '#6ec6e6', '#ff8200'],
    ['Racing green', 'carbon', '#0b3d2a', '#0b3d2a', '#e8f2ec', '#22c55e'],
    ['Lambo', 'gradient', '#ff7a00', '#ffcc00', '#1b1b1d', '#ff7a00', '#ffcc00'],
    ['Pearl', 'solid', '#d9dbe0', '#d9dbe0', '#ffffff', '#64748b'],
    ['Sunset', 'gradient', '#3b0a45', '#ff3d6e', '#2a0f33', '#ff3d6e', '#ffb800'],
    ['Nardo', 'carbon', '#4b4e53', '#4b4e53', '#d6d8dc', '#9ca3af']
  ];
  let theme = { style: 'carbon', c1: '#141416', c2: '#141416', tab: '#3a3b42' };
  try { theme = { ...theme, ...JSON.parse(localStorage.getItem('carmode-theme') || '{}') }; } catch (e) { /* ignore */ }
  $('themeSwatches').innerHTML = THEMES.map(([n, st, a, b, t, x1, x2]) =>
    `<button class="sw theme" data-t="${st}|${a}|${b}|${t}" data-accent="${x1}|${x2 || ''}" style="background:${st === 'gradient' ? `linear-gradient(90deg, ${a}, ${b})` : a}; box-shadow: inset -14px 0 0 ${t}, inset 0 0 0 1px rgba(255,255,255,.15)">${n}</button>`).join('');

  async function renderTheme() {
    try { localStorage.setItem('carmode-theme', JSON.stringify(theme)); } catch (e) { /* ignore */ }
    [...$('themeStyle').children].forEach(b => b.classList.toggle('on', b.dataset.v === theme.style));
    $('frame1').value = theme.c1;
    $('frame2').value = theme.c2;
    $('tabColor').value = theme.tab;
    $('frame2Wrap').hidden = theme.style !== 'gradient';
    const col = P.themeColors(theme);
    const hex = rgb => P.rgbToHex(rgb);
    const frame = await P.themeFrame(theme, '../assets/fx/carbon.png');
    $('mockStrip').style.backgroundImage = `url(${URL.createObjectURL(frame)})`;
    $('mockActive').style.background = hex(col.toolbar);
    $('mockActive').style.color = hex(col.tab_text);
    for (const id of ['mockT1', 'mockT2']) $(id).style.color = hex(col.tab_background_text);
    $('mockBar').style.background = hex(col.toolbar);
    $('mockOmni').style.background = hex(col.omnibox_background);
    $('mockOmni').style.color = hex(col.omnibox_text);
  }

  $('themeSwatches').addEventListener('click', e => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    const [style, c1, c2, tab] = b.dataset.t.split('|');
    theme = { style, c1, c2, tab };
    $('themeName').value = b.textContent.trim();
    renderTheme();
    // Applies instantly to everything Car Mode draws (new tab, start screen, panel, car menu).
    const [a1, a2] = b.dataset.accent.split('|');
    CAR.save({ accent: { c1: a1, c2: a2 || s.accent.c2, gradient: !!a2 } }).then(v => { s = v; render(); });
    toast(`${b.textContent.trim()} applied to Car Mode`);
  });
  $('themeStyle').addEventListener('click', e => {
    const b = e.target.closest('[data-v]');
    if (b) { theme.style = b.dataset.v; renderTheme(); }
  });
  for (const [id, key] of [['frame1', 'c1'], ['frame2', 'c2'], ['tabColor', 'tab']]) {
    $(id).addEventListener('input', () => { theme[key] = $(id).value; renderTheme(); });
  }

  let lastDownload = null;
  $('makeTheme').addEventListener('click', async () => {
    const name = ($('themeName').value.trim() || 'My Car').slice(0, 24);
    const folder = name.replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '-') || 'My-Car';
    const manifest = P.themeManifest(name, P.themeColors(theme));
    const frame = await P.themeFrame(theme, '../assets/fx/carbon.png');
    const base = `Car Mode Theme/${folder}`;
    const opts = { conflictAction: 'overwrite', saveAs: false };
    await chrome.downloads.download({ ...opts, url: URL.createObjectURL(frame), filename: `${base}/images/frame.png` });
    lastDownload = await chrome.downloads.download({ ...opts, url: URL.createObjectURL(new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' })), filename: `${base}/manifest.json` });
    $('themeFolder').textContent = folder;
    $('themeSteps').hidden = false;
    toast('Theme created');
  });
  $('showTheme').addEventListener('click', () => lastDownload ? chrome.downloads.show(lastDownload) : chrome.downloads.showDefaultFolder());

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
  for (const id of ['openExt', 'openExt2']) $(id).addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions' }));
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
    [...$('carView').children].forEach(b => b.classList.toggle('on', b.dataset.v === s.carView));
    $('accentGradient').checked = !!s.accent.gradient;
    $('accent1').value = s.accent.c1;
    $('accent2').value = s.accent.c2;
    $('accent2Wrap').hidden = !s.accent.gradient;
    renderPaintControls(s.carPaint);
  }
  render();
  applyPaint(s.carPaint, false);
  renderTheme();

  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local' || !changes.settings) return;
    s = await CAR.load();
    render();
  });
})();
