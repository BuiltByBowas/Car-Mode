// Car Mode page car. Two modes:
//   roam — the car drives around the inside edges of the page, wheels on the edge like a stunt track
//          (bottom → up the right → upside-down across the top → down the left), drifting in the corners.
//   tab  — the car parks above the active tab and drives forward/backward when you switch tabs.
// Click (or Alt+Shift+C) the car for a quick menu: screenshot, reload, navigation, zoom, media and accessibility tools.
(async () => {
  if (window.top !== window || window.__carModeCar) return;
  window.__carModeCar = true;

  let s = await CAR.load();
  // Every image the car needs, as data URLs from the background (some sites block chrome-extension:// loads).
  const ICONS = ['x', 'steering-wheel', 'book', 'camera', 'refresh', 'arrow-left', 'arrow-right', 'plus', 'copy', 'volume', 'pin',
    'zoom-in', 'zoom-out', 'zoom-reset', 'maximize', 'arrow-bar-to-up', 'arrow-bar-to-down', 'picture-in-picture', 'headphones',
    'contrast', 'moon', 'link', 'language', 'printer', 'speakerphone', 'parking'];
  const SMOKE = [0, 1, 2, 3].map(i => `assets/fx/smoke-${i}.png`);
  const PATHS = ['assets/car/ferrari-side-240.png', ...SMOKE, ...ICONS.map(n => `assets/icons/${n}.svg`)];
  const assets = (await chrome.runtime.sendMessage({ type: 'car-assets', paths: PATHS }).catch(() => null)) || {};
  const url = p => assets[p] || chrome.runtime.getURL(p);
  CarSmoke.useSprites(SMOKE.map(url));
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // After an extension update, the previous copy of this script is orphaned; remove its car first.
  document.querySelectorAll('[data-carmode-host]').forEach(el => el.remove());
  const host = document.createElement('div');
  host.dataset.carmodeHost = '';
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;contain:strict;';
  const shadow = host.attachShadow({ mode: 'closed' });
  const ic = name => `<span class="ic" style="--src:url('${url(`assets/icons/${name}.svg`)}')"></span>`;
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; }
      canvas { position: fixed; inset: 0; width: 100vw; height: 100vh; }
      .car { position: fixed; left: 0; top: 0; width: 84px; height: auto; transform-origin: 0 0; pointer-events: auto; cursor: pointer;
        filter: drop-shadow(0 3px 3px rgba(0,0,0,.45)); will-change: transform; transition: opacity .35s; outline: none; }
      .car:focus-visible { filter: drop-shadow(0 0 0 #fff) drop-shadow(0 0 4px #e10600); }
      .car.hidden { opacity: 0; pointer-events: none; }
      @media (max-width: 600px) { .car { width: 64px; } }
      .ic { display: inline-block; width: 20px; height: 20px; background: currentColor; -webkit-mask: var(--src) center / contain no-repeat; mask: var(--src) center / contain no-repeat; }

      .menu { position: fixed; width: min(340px, calc(100vw - 16px)); padding: 12px; border-radius: 18px; pointer-events: auto;
        font: 13px/1.3 "Segoe UI", system-ui, -apple-system, sans-serif; color: #f4f4f5;
        background: rgba(18,18,21,.94); border: 1px solid rgba(255,255,255,.1);
        box-shadow: 0 24px 60px rgba(0,0,0,.55); backdrop-filter: blur(16px); animation: pop .22s cubic-bezier(.2,.9,.3,1.2); }
      @keyframes pop { from { opacity: 0; transform: scale(.94); } }
      .menu[hidden] { display: none; }
      .head { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; font-weight: 600; }
      .head img { width: 34px; }
      .head span { flex: 1; }
      .head button { display: grid; place-items: center; width: 30px; height: 30px; padding: 0; border: 0; border-radius: 50%; background: rgba(255,255,255,.08); color: inherit; cursor: pointer; }
      .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
      .grid button { display: flex; flex-direction: column; align-items: center; gap: 5px; min-height: 64px; padding: 9px 2px 7px; border: 0; border-radius: 12px;
        background: rgba(255,255,255,.06); color: inherit; font: inherit; font-size: 11px; cursor: pointer; transition: background .15s, transform .1s; }
      .grid button:hover { background: rgba(255,255,255,.14); }
      .grid button:active { transform: scale(.95); }
      .grid button:focus-visible, .head button:focus-visible { outline: 2px solid #fff; outline-offset: 1px; }
      .grid button.on { background: var(--accent-grad, #e10600); color: var(--on-accent, #fff); }
      .grid button.danger:hover { background: rgba(225,6,0,.35); }
      .toast { position: fixed; left: 50%; bottom: 24px; padding: 9px 16px; transform: translate(-50%, 160%); border-radius: 20px; opacity: 0; visibility: hidden;
        background: #fff; color: #18181b; font: 600 13px "Segoe UI", system-ui, sans-serif; box-shadow: 0 8px 30px rgba(0,0,0,.3); transition: transform .3s, opacity .3s, visibility .3s; }
      .toast.show { transform: translate(-50%, 0); opacity: 1; visibility: visible; }
      @media (prefers-reduced-motion: reduce) { .menu { animation: none; } }
    </style>
    <canvas></canvas>
    <img class="car hidden" alt="Car Mode car — click for quick menu" role="button" tabindex="0" aria-haspopup="true" src="${url('assets/car/ferrari-side-240.png')}">
    <div class="menu" role="dialog" aria-label="Car Mode quick menu" hidden>
      <div class="head"><img alt="" src="${url('assets/car/ferrari-side-240.png')}"><span>Quick menu</span><button data-a="dismiss" aria-label="Close menu">${ic('x')}</button></div>
      <div class="grid"></div>
    </div>
    <div class="toast" role="status"></div>`;
  const car = shadow.querySelector('.car');
  // The paint shop stores the repainted car as a small image; use it when present.
  let painted = {};
  const setCarImage = () => {
    const src = painted.carImage || url('assets/car/ferrari-side-240.png');
    car.src = src;
    shadow.querySelector('.head img').src = src;
  };
  chrome.storage.local.get('carImage').then(r => { painted = r; setCarImage(); });
  const menu = shadow.querySelector('.menu');
  const toastEl = shadow.querySelector('.toast');
  const smoke = new CarSmoke(shadow.querySelector('canvas'), { max: 200 });
  const mount = () => { if (!host.isConnected) document.documentElement.appendChild(host); };
  mount();
  const keeper = new MutationObserver(mount);
  keeper.observe(document.documentElement, { childList: true });

  // Darker smoke on light pages so it stays visible.
  const bg = getComputedStyle(document.body || document.documentElement).backgroundColor.match(/\d+/g);
  if (bg && bg.slice(0, 3).reduce((a, b) => a + Number(b), 0) > 600) smoke.tint = 0.55;

  let toastTimer = 0;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1900);
  }

  const send = msg => chrome.runtime.sendMessage(msg).catch(() => null);
  const size = () => ({ w: car.offsetWidth || 84, h: car.offsetHeight || 27 });
  const smokeOn = () => s.smoke !== 'off';
  const heavy = () => s.smoke === 'full';

  // Put the car's wheels (bottom-center) on point (x, y), facing heading `phi` (radians, 0 = right).
  function pose(x, y, phi, yaw = 0) {
    const { w, h } = size();
    car.style.transform = `translate(${x}px, ${y}px) rotate(${phi + yaw}rad) translate(${-w / 2}px, ${-h}px)`;
    const rx = -w / 2 + 3;
    const ry = -h * 0.3;
    const a = phi + yaw;
    return { x: x + rx * Math.cos(a) - ry * Math.sin(a), y: y + rx * Math.sin(a) + ry * Math.cos(a), dx: Math.cos(a), dy: Math.sin(a) };
  }

  function exhaust(p, speed, strong) {
    if (!smokeOn()) return;
    smoke.puff(p.x, p.y, { vx: -p.dx * 70 * speed, vy: -p.dy * 70 * speed - 6, size: strong ? 26 : 12, grow: strong ? 120 : 45, life: strong ? 1.8 : 1.2, alpha: strong ? 0.42 : 0.24 });
  }

  // =================== ROAM: stunt-track loop around the page ===================
  const M = 6; // inset from the edges
  function track() {
    const W = innerWidth;
    const H = innerHeight;
    const r = Math.max(30, Math.min(90, W / 6, H / 6));
    const sx = Math.max(0, W - 2 * M - 2 * r);
    const sy = Math.max(0, H - 2 * M - 2 * r);
    const arc = (Math.PI / 2) * r;
    return { W, H, r, sx, sy, arc, P: 2 * sx + 2 * sy + 4 * arc };
  }

  // Ground point + heading at distance d along the loop.
  function along(d, t) {
    const { W, H, r, sx, sy, arc, P } = t;
    d = ((d % P) + P) % P;
    const seg = [
      ['line', sx, () => [M + r + d, H - M, 0]],
      ['arc', arc, k => [W - M - r, H - M - r, Math.PI / 2 - k]],
      ['line', sy, () => [W - M, H - M - r - d, -Math.PI / 2]],
      ['arc', arc, k => [W - M - r, M + r, -k]],
      ['line', sx, () => [W - M - r - d, M, Math.PI]],
      ['arc', arc, k => [M + r, M + r, -Math.PI / 2 - k]],
      ['line', sy, () => [M, M + r + d, Math.PI / 2]],
      ['arc', arc, k => [M + r, H - M - r, Math.PI - k]]
    ];
    for (const [kind, len, f] of seg) {
      if (d <= len) {
        if (kind === 'line') {
          const [x, y, phi] = f();
          return { x, y, phi, corner: 0 };
        }
        const k = (d / len) * (Math.PI / 2);
        const [cx, cy, alpha] = f(k);
        return { x: cx + r * Math.cos(alpha), y: cy + r * Math.sin(alpha), phi: alpha - Math.PI / 2, corner: Math.sin((d / len) * Math.PI) };
      }
      d -= len;
    }
    return { x: M + r, y: H - M, phi: 0, corner: 0 };
  }

  let roamD = 0;
  let roamRaf = 0;
  let last = 0;
  let lastPuff = 0;
  let paused = false;  // hover / menu open
  let parked = false;  // user parked the car on this page

  function roamFrame(now) {
    roamRaf = requestAnimationFrame(roamFrame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    if (document.hidden || document.fullscreenElement) { car.classList.add('hidden'); return; }
    car.classList.remove('hidden');
    const t = track();
    if (!paused && !parked) roamD += dt * 150 * (s.carSpeed || 1);
    const p = along(roamD, t);
    const drift = p.corner * 0.35; // tail swings out through the corners
    const e = pose(p.x, p.y, p.phi, drift);
    if (paused || parked) return;
    const gap = p.corner > 0.2 ? (heavy() ? 35 : 80) : 260;
    if (now - lastPuff > gap) {
      lastPuff = now;
      exhaust(e, 1 + p.corner, p.corner > 0.2);
    }
  }

  function startRoam() {
    cancelAnimationFrame(roamRaf);
    // every tab shares the same clock, so the car keeps its place when you switch tabs
    roamD = ((Date.now() / 1000) * 150 * (s.carSpeed || 1)) % track().P;
    last = 0;
    roamRaf = requestAnimationFrame(roamFrame);
  }

  // =================== TAB: park above the active tab, drive to the new one ===================
  const xFor = f => 12 + Math.max(0, Math.min(1, f)) * Math.max(0, innerWidth - size().w - 24);
  const TOP = () => size().h + 6;
  let tabPos = null;
  let tabRaf = 0;

  function drive(from, to, kind = 'switch') {
    cancelAnimationFrame(tabRaf);
    car.classList.remove('hidden');
    const dir = to >= from ? 1 : -1;
    const dist = Math.abs(xFor(to) - xFor(from));
    const dur = Math.max(650, Math.min(1700, dist * 1.6 + (kind === 'new' ? 300 : 0)));
    const t0 = performance.now();
    let lp = 0;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur);
      const ease = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      const speed = Math.sin(Math.PI * k);
      tabPos = from + (to - from) * ease;
      const e = pose(xFor(tabPos) + size().w / 2, TOP(), 0, (dir * -0.05 * speed));
      if (now - lp > (heavy() ? 28 : 60)) { lp = now; exhaust({ ...e, dx: dir, dy: 0 }, 0.6 + speed, true); }
      if (k < 1) { tabRaf = requestAnimationFrame(step); return; }
      tabRaf = 0;
      if (heavy() && (dist > 40 || kind !== 'switch')) {
        const r = car.getBoundingClientRect();
        smoke.billow(r.left + r.width / 2, r.bottom, { width: Math.min(innerWidth, 900), density: kind === 'new' ? 1.2 : 0.8, drift: -dir, alpha: 0.3, life: 2.4 });
      }
    };
    tabRaf = requestAnimationFrame(step);
  }

  function park(f) {
    tabPos = f;
    pose(xFor(f) + size().w / 2, TOP(), 0);
    car.classList.remove('hidden');
  }

  // =================== GAME: drive the car anywhere on the page ===================
  // W/↑ throttle · S/↓ brake & reverse · A/D/←/→ steer · Space nitro · Shift handbrake (drift) · H horn · Esc stop.
  const hud = document.createElement('div');
  hud.className = 'hud';
  hud.hidden = true;
  hud.innerHTML = `
    <div class="speed"><b id="hudSpeed">0</b><small>km/h</small></div>
    <div class="nitro"><span>NITRO</span><i><em id="hudNitro"></em></i></div>
    <div class="keys"><kbd>W A S D</kbd> drive <kbd>Space</kbd> nitro <kbd>Shift</kbd> drift <kbd>Esc</kbd> stop</div>`;
  shadow.appendChild(hud);
  const style = document.createElement('style');
  style.textContent = `
    .hud { position: fixed; left: 16px; bottom: 16px; display: flex; align-items: center; gap: 14px; padding: 10px 14px; border-radius: 14px; pointer-events: none;
      font: 12px "Segoe UI", system-ui, sans-serif; color: #f4f4f5; background: rgba(14,14,16,.82); border: 1px solid rgba(255,255,255,.1); backdrop-filter: blur(10px); }
    .hud[hidden] { display: none; }
    .speed b { display: inline-block; min-width: 3ch; font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; }
    .speed small { margin-left: 4px; color: #a1a1aa; }
    .nitro { display: flex; flex-direction: column; gap: 4px; font-size: 9px; font-weight: 700; letter-spacing: .14em; color: #a1a1aa; }
    .nitro i { display: block; width: 90px; height: 6px; border-radius: 3px; background: rgba(255,255,255,.12); overflow: hidden; }
    .nitro em { display: block; height: 100%; width: 100%; background: linear-gradient(90deg, #38bdf8, #a78bfa); transition: width .1s linear; }
    .hud.boost .nitro em { background: linear-gradient(90deg, #f97316, #facc15); }
    .keys { color: #a1a1aa; }
    .keys kbd { padding: 1px 6px; border-radius: 4px; background: rgba(255,255,255,.12); color: #fff; font: 11px Consolas, monospace; }
    @media (max-width: 700px) { .keys { display: none; } }`;
  shadow.appendChild(style);

  const keys = new Set();
  const GAME_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift', 'h', 'escape'];
  let gaming = false;
  let gameRaf = 0;
  const g = { x: 0, y: 0, h: 0, vx: 0, vy: 0, nitro: 1, boosting: false, last: 0, puff: 0 };

  const editable = el => !!el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName));

  function onKey(e) {
    if (!gaming || editable(document.activeElement)) return;
    const k = e.key.toLowerCase();
    if (!GAME_KEYS.includes(k)) return;
    // the game owns these keys while driving (so Space doesn't pause YouTube or scroll the page)
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type === 'keydown') {
      if (k === 'escape') return stopGame();
      if (k === 'h' && !e.repeat) send({ type: 'car-action', action: 'horn' });
      keys.add(k);
    } else {
      keys.delete(k);
    }
  }

  function startGame() {
    if (gaming) return;
    gaming = true;
    scroller = null;
    closeMenu();
    cancelAnimationFrame(roamRaf);
    cancelAnimationFrame(tabRaf);
    tabRaf = 0;
    // start where the car is, but pulled away from the walls and facing into open space
    const r = car.getBoundingClientRect();
    const cx = r.width ? r.left + r.width / 2 : innerWidth / 2;
    const cy = r.height ? r.top + r.height / 2 : innerHeight / 2;
    const x = Math.max(160, Math.min(innerWidth - 160, cx));
    Object.assign(g, { x, y: Math.max(140, Math.min(innerHeight - 140, cy)), h: x > innerWidth / 2 ? Math.PI : 0, vx: 0, vy: 0, last: 0 });
    car.classList.remove('hidden');
    hud.hidden = false;
    addEventListener('keydown', onKey, true);
    addEventListener('keyup', onKey, true);
    send({ type: 'car-action', action: 'sound', clip: 'start' });
    toast('Game mode: W A S D to drive, Space for nitro, Esc to stop');
    gameRaf = requestAnimationFrame(gameFrame);
  }

  function stopGame() {
    if (!gaming) return;
    gaming = false;
    keys.clear();
    cancelAnimationFrame(gameRaf);
    hud.hidden = true;
    removeEventListener('keydown', onKey, true);
    removeEventListener('keyup', onKey, true);
    apply();
  }

  function gameFrame(now) {
    gameRaf = requestAnimationFrame(gameFrame);
    const dt = Math.min(0.033, (now - (g.last || now)) / 1000);
    g.last = now;
    const up = keys.has('w') || keys.has('arrowup');
    const down = keys.has('s') || keys.has('arrowdown');
    const left = keys.has('a') || keys.has('arrowleft');
    const right = keys.has('d') || keys.has('arrowright');
    const hand = keys.has('shift');
    const fx = Math.cos(g.h);
    const fy = Math.sin(g.h);
    let v = g.vx * fx + g.vy * fy; // speed along the car's nose

    // nitro: drains while held, refills slowly
    const wantBoost = keys.has(' ') && up && g.nitro > 0.02;
    if (wantBoost && !g.boosting) send({ type: 'car-action', action: 'sound', clip: 'nitro' });
    g.boosting = wantBoost;
    g.nitro = Math.max(0, Math.min(1, g.nitro + (g.boosting ? -0.45 : 0.12) * dt));
    hud.classList.toggle('boost', g.boosting);

    const max = g.boosting ? 980 : 560;
    if (up) v += (g.boosting ? 1500 : 620) * dt;
    else if (down) v -= (v > 0 ? 1100 : 380) * dt;
    else v -= v * 1.4 * dt;
    v = Math.max(-240, Math.min(max, v));

    // steering bites harder with speed; reversing steers the other way
    const steer = (right ? 1 : 0) - (left ? 1 : 0);
    g.h += steer * 3.3 * dt * Math.min(1, Math.abs(v) / 180) * Math.sign(v || 1);

    // grip pulls velocity toward the nose; less grip with the handbrake = drift
    const grip = hand ? 1.6 : 7.5;
    const tx = Math.cos(g.h) * v;
    const ty = Math.sin(g.h) * v;
    g.vx += (tx - g.vx) * Math.min(1, grip * dt);
    g.vy += (ty - g.vy) * Math.min(1, grip * dt);
    g.x += g.vx * dt;
    g.y += g.vy * dt;

    // walls: bounce off the sides; push into the top/bottom edge to scroll the page
    const { w, h } = size();
    const m = Math.max(w, h) / 2;
    // side walls stop the sideways motion but let the car slide along them
    if (g.x < m) { g.x = m; g.vx = Math.max(0, g.vx); }
    if (g.x > innerWidth - m) { g.x = innerWidth - m; g.vx = Math.min(0, g.vx); }
    // camera follow: keep the car in the middle band of the screen by scrolling the page with it
    const bandTop = innerHeight * 0.32;
    const bandBottom = innerHeight * 0.68;
    if (g.y > bandBottom && g.vy > 0) g.y -= scrollPage(g.y - bandBottom);
    if (g.y < bandTop && g.vy < 0) g.y -= scrollPage(g.y - bandTop);
    // at the very top/bottom of the page the car can drive on to the screen edge
    if (g.y > innerHeight - m) { g.y = innerHeight - m; g.vy = Math.min(0, g.vy); }
    if (g.y < m) { g.y = m; g.vy = Math.max(0, g.vy); }

    // draw: rotate to the heading; flip when facing left so the wheels stay down
    const flip = Math.cos(g.h) < 0 ? ' scaleY(-1)' : '';
    car.style.transform = `translate(${g.x}px, ${g.y}px) rotate(${g.h}rad)${flip} translate(${-w / 2}px, ${-h / 2}px)`;

    // smoke: tire smoke when sliding, exhaust when boosting
    const speed = Math.hypot(g.vx, g.vy);
    const slip = speed > 40 ? Math.abs(Math.sin(Math.atan2(g.vy, g.vx) - g.h)) : 0;
    if (smokeOn() && now - g.puff > (g.boosting ? 22 : 45) && (slip > 0.25 || g.boosting || (up && speed < 120))) {
      g.puff = now;
      const rx = g.x - Math.cos(g.h) * w * 0.45;
      const ry = g.y - Math.sin(g.h) * w * 0.45;
      exhaust({ x: rx, y: ry, dx: Math.cos(g.h), dy: Math.sin(g.h) }, 1 + slip + (g.boosting ? 1 : 0), slip > 0.25 || g.boosting);
    }
    hudSpeed.textContent = Math.round(Math.abs(v) * 0.36);
    hudNitro.style.width = `${Math.round(g.nitro * 100)}%`;
  }
  // Scroll whatever actually scrolls here: the window, or (on app-like sites) the panel under the car.
  // Returns how far it moved, so the car can stay put on screen while the page slides under it.
  let scroller = null;
  function scrollPage(dy) {
    const target = scroller && scroller.isConnected ? scroller : null;
    if (!target) {
      const before = scrollY;
      scrollBy(0, dy);
      if (scrollY !== before) return scrollY - before;
      // look under the car, skipping Car Mode's own overlay
      let el = document.elementsFromPoint(g.x, g.y).find(e => e !== host && e !== document.documentElement);
      while (el && el !== document.documentElement) {
        const st = getComputedStyle(el);
        if (/(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 4) { scroller = el; break; }
        el = el.parentElement;
      }
      if (!scroller) return 0;
    }
    const before = scroller.scrollTop;
    scroller.scrollTop += dy;
    return scroller.scrollTop - before;
  }
  const hudSpeed = hud.querySelector('#hudSpeed');
  const hudNitro = hud.querySelector('#hudNitro');

  // =================== Quick menu ===================
  let reading = false;
  let contrastStyle = null;
  let darkStyle = null;
  const ACTIONS = [
    ['drive', 'steering-wheel', 'Drive it'],
    ['guide', 'book', 'User guide'],
    ['screenshot', 'camera', 'Screenshot'],
    ['reload', 'refresh', 'Reload'],
    ['back', 'arrow-left', 'Back'],
    ['forward', 'arrow-right', 'Forward'],
    ['new', 'plus', 'New tab'],
    ['duplicate', 'copy', 'Duplicate'],
    ['mute', 'volume', 'Mute tab'],
    ['pin', 'pin', 'Pin tab'],
    ['zoom-in', 'zoom-in', 'Zoom in'],
    ['zoom-out', 'zoom-out', 'Zoom out'],
    ['zoom-reset', 'zoom-reset', 'Reset zoom'],
    ['fullscreen', 'maximize', 'Full screen'],
    ['top', 'arrow-bar-to-up', 'To top'],
    ['bottom', 'arrow-bar-to-down', 'To bottom'],
    ['pip', 'picture-in-picture', 'Mini player'],
    ['read', 'headphones', 'Read aloud'],
    ['contrast', 'contrast', 'High contrast'],
    ['dark', 'moon', 'Dark page'],
    ['copy', 'link', 'Copy link'],
    ['translate', 'language', 'Translate'],
    ['print', 'printer', 'Print'],
    ['horn', 'speakerphone', 'Horn'],
    ['park', 'parking', 'Park car'],
    ['close', 'x', 'Close tab']
  ];
  shadow.querySelector('.grid').innerHTML = ACTIONS.map(([a, i, l]) => `<button data-a="${a}" ${a === 'close' ? 'class="danger"' : ''}>${ic(i)}<span>${l}</span></button>`).join('');

  function openMenu() {
    paused = true;
    menu.hidden = false;
    const r = car.getBoundingClientRect();
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    const x = Math.min(innerWidth - mw - 8, Math.max(8, r.left + r.width / 2 - mw / 2));
    const y = r.top > innerHeight / 2 ? Math.max(8, r.top - mh - 10) : Math.min(innerHeight - mh - 8, r.bottom + 10);
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.querySelector('[data-a="park"]').classList.toggle('on', parked);
    const d = menu.querySelector('[data-a="drive"]');
    d.classList.toggle('on', gaming);
    d.querySelector('span:last-child').textContent = gaming ? 'Stop driving' : 'Drive it';
    menu.querySelector('[data-a="read"]').classList.toggle('on', reading);
    menu.querySelector('[data-a="contrast"]').classList.toggle('on', !!contrastStyle);
    menu.querySelector('[data-a="dark"]').classList.toggle('on', !!darkStyle);
    menu.querySelector('.grid button').focus();
    send({ type: 'car-action', action: 'state' }).then(st => {
      if (!st) return;
      const m = menu.querySelector('[data-a="mute"]');
      m.classList.toggle('on', !!st.muted);
      m.querySelector('span:last-child').textContent = st.muted ? 'Unmute' : 'Mute tab';
      menu.querySelector('[data-a="pin"]').classList.toggle('on', !!st.pinned);
    });
  }

  function closeMenu() {
    menu.hidden = true;
    paused = false;
  }

  async function run(a) {
    switch (a) {
      case 'dismiss': return closeMenu();
      case 'screenshot': {
        closeMenu();
        host.style.visibility = 'hidden'; // keep the car and menu out of the picture
        await sleep(120);
        const res = await send({ type: 'car-action', action: 'screenshot' });
        host.style.visibility = '';
        toast(res?.ok ? 'Screenshot saved to Downloads › Car Mode' : 'Chrome blocked the screenshot on this page');
        return;
      }
      case 'reload': return location.reload();
      case 'back': closeMenu(); return history.back();
      case 'forward': closeMenu(); return history.forward();
      case 'top': closeMenu(); return scrollTo({ top: 0, behavior: 'smooth' });
      case 'bottom': closeMenu(); return scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
      case 'fullscreen':
        closeMenu();
        if (document.fullscreenElement) return document.exitFullscreen();
        return document.documentElement.requestFullscreen().catch(() => toast('Full screen not allowed here'));
      case 'pip': {
        closeMenu();
        if (document.pictureInPictureElement) return document.exitPictureInPicture();
        const vids = [...document.querySelectorAll('video')].filter(v => v.readyState > 0);
        const v = vids.sort((x, y) => y.clientWidth * y.clientHeight - x.clientWidth * x.clientHeight)[0];
        if (!v) return toast('No video on this page');
        return v.requestPictureInPicture().catch(() => toast('This video does not allow mini player'));
      }
      case 'read': {
        if (reading) {
          speechSynthesis.cancel();
          reading = false;
          return openMenu();
        }
        const text = String(getSelection() || '').trim() || (document.querySelector('article, main') || document.body).innerText.slice(0, 4000);
        const u = new SpeechSynthesisUtterance(text);
        u.onend = () => { reading = false; };
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
        reading = true;
        toast(getSelection().toString().trim() ? 'Reading your selection' : 'Reading this page — tap again to stop');
        return closeMenu();
      }
      case 'contrast':
        if (contrastStyle) {
          contrastStyle.remove();
          contrastStyle = null;
        } else {
          contrastStyle = document.createElement('style');
          contrastStyle.textContent = 'html { filter: contrast(1.35) saturate(1.1) !important; } a { text-decoration: underline !important; }';
          document.documentElement.appendChild(contrastStyle);
        }
        return closeMenu();
      case 'dark':
        // invert the page but flip media back, so photos and videos keep their real colors
        if (darkStyle) {
          darkStyle.remove();
          darkStyle = null;
        } else {
          darkStyle = document.createElement('style');
          darkStyle.textContent = 'html { filter: invert(.92) hue-rotate(180deg) !important; background: #fff; } img, video, picture, canvas, iframe, svg image, [style*="background-image"] { filter: invert(1) hue-rotate(180deg) !important; }';
          document.documentElement.appendChild(darkStyle);
        }
        return closeMenu();
      case 'copy':
        closeMenu();
        try {
          await navigator.clipboard.writeText(location.href);
          toast('Link copied');
        } catch (e) {
          toast('Copy blocked on this page');
        }
        return;
      case 'translate':
        closeMenu();
        return window.open(`https://translate.google.com/translate?sl=auto&tl=${encodeURIComponent((navigator.language || 'en').split('-')[0])}&u=${encodeURIComponent(location.href)}`, '_blank', 'noopener');
      case 'print':
        closeMenu();
        await sleep(150);
        return print();
      case 'drive':
        closeMenu();
        return gaming ? stopGame() : startGame();
      case 'guide':
        closeMenu();
        return send({ type: 'car-action', action: 'guide' });
      case 'park':
        parked = !parked;
        toast(parked ? 'Car parked on this page' : 'Back on the road');
        return closeMenu();
      default: {
        // tab-level actions run in the background
        if (a !== 'horn' && a !== 'zoom-in' && a !== 'zoom-out' && a !== 'zoom-reset') closeMenu();
        const res = await send({ type: 'car-action', action: a });
        if (a === 'mute' && res) toast(res.muted ? 'Tab muted' : 'Tab unmuted');
        if (a === 'pin' && res) toast(res.pinned ? 'Tab pinned' : 'Tab unpinned');
        if (a.startsWith('zoom') && res) toast(`Zoom ${Math.round(res.zoom * 100)}%`);
      }
    }
  }

  shadow.addEventListener('click', e => {
    const b = e.target.closest('[data-a]');
    if (b) run(b.dataset.a);
  });
  car.addEventListener('click', e => {
    e.stopPropagation();
    if (menu.hidden) openMenu(); else closeMenu();
  });
  car.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMenu(); }
  });
  car.addEventListener('pointerenter', () => { paused = true; });
  car.addEventListener('pointerleave', () => { if (menu.hidden) paused = false; });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) closeMenu(); }, true);
  document.addEventListener('pointerdown', e => { if (!menu.hidden && !e.composedPath().includes(host)) closeMenu(); }, true);

  function accentMenu() {
    const a = { c1: '#e10600', c2: '#ff7a00', gradient: false, ...(s.accent || {}) };
    menu.style.setProperty('--accent-grad', `linear-gradient(135deg, ${a.c1}, ${a.gradient ? a.c2 : a.c1})`);
  }
  accentMenu();

  // =================== Wiring ===================
  let waitingForStart = false;
  function apply() {
    if (gaming || waitingForStart) return; // game mode owns the car until Esc; the start screen keeps it parked
    cancelAnimationFrame(roamRaf);
    if (!s.topCar) {
      cancelAnimationFrame(tabRaf);
      car.classList.add('hidden');
      closeMenu();
      return;
    }
    if (s.carMode === 'tab') {
      // leave a running drive animation alone; otherwise settle into the parked spot
      if (tabPos !== null && !tabRaf) park(tabPos);
    } else {
      cancelAnimationFrame(tabRaf);
      tabRaf = 0;
      startRoam();
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'car-menu') {
      if (s.topCar) openMenu();
      sendResponse({ ok: true });
    }
    if (msg?.type === 'car-drive') {
      if (gaming) stopGame(); else startGame();
      sendResponse({ ok: true });
    }
    if (msg?.type === 'car-move') {
      if (s.topCar && s.carMode === 'tab') drive(msg.from, msg.to, msg.kind);
      sendResponse({ ok: true }); // tells the background this move was handled
    }
  });

  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') return;
    if (changes.carImage) {
      painted = await chrome.storage.local.get('carImage');
      setCarImage();
    }
    if (!changes.settings) return;
    s = await CAR.load();
    setCarImage();
    accentMenu();
    apply();
  });

  addEventListener('resize', () => { if (s.carMode === 'tab' && tabPos !== null && !tabRaf) park(tabPos); }, { passive: true });

  // If the extension is updated or removed, this copy is orphaned: stop everything and take the car away.
  const orphanCheck = setInterval(() => {
    if (chrome.runtime?.id) return;
    clearInterval(orphanCheck);
    cancelAnimationFrame(roamRaf);
    cancelAnimationFrame(tabRaf);
    cancelAnimationFrame(gameRaf);
    removeEventListener('keydown', onKey, true);
    removeEventListener('keyup', onKey, true);
    keeper.disconnect();
    host.remove();
  }, 2000);

  // On the new tab, stay out of the way while the start screen is showing.
  addEventListener('carmode:game', () => startGame());
  if (window.CarStart && (await window.CarStart)) {
    waitingForStart = true;
    await new Promise(r => addEventListener('carmode:drive', r, { once: true }));
    await sleep(600);
    waitingForStart = false;
  }

  // Tab mode: play a move that happened before this script was ready, or just park.
  if (s.carMode === 'tab') {
    try {
      const res = await send({ type: 'car-hello' });
      if (res?.move) drive(res.move.from, res.move.to, res.move.kind);
      else if (res?.park !== undefined) park(res.park);
    } catch (e) { /* extension reloaded */ }
  } else {
    send({ type: 'car-hello' }); // clears any pending move for this tab
  }
  apply();
})();
