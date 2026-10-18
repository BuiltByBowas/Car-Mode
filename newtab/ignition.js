// Ignition: on the first new tab after Chrome starts, the pointer becomes a key. Insert it, enter the
// PIN (demo 1234), and the real engine-start recording plays while the tach sweeps. Mouse steers the wheel.
window.CarIgnition = (async () => {
  const $ = id => document.getElementById(id);
  const s = await CAR.load();
  const { ignited } = await chrome.storage.session.get('ignited').catch(() => ({}));
  const forced = location.hash === '#ignition';
  if (!forced && (!s.ignition || ignited)) return false;

  const ign = $('ign');
  ign.hidden = false;
  ign.classList.add('key-cursor');

  // Cockpit photo + credit
  const cockpit = (await fetch('../assets/cockpit/credits.json').then(r => r.json()))[0];
  $('ignBg').style.backgroundImage = `url("../assets/cockpit/${cockpit.file}")`;
  $('ignCredit').innerHTML = `Cockpit: ${cockpit.author} · <a href="${cockpit.source}" target="_blank" rel="noopener">${cockpit.license}</a>`;

  // ---------- Tachometer ----------
  const A0 = -135;
  const A1 = 135;
  const MAX = 8;
  const ang = v => A0 + (A1 - A0) * (v / MAX);
  const pt = (deg, r) => [100 + r * Math.sin((deg * Math.PI) / 180), 100 - r * Math.cos((deg * Math.PI) / 180)];
  let ticks = '';
  for (let v = 0; v <= MAX; v += 0.5) {
    const major = v % 1 === 0;
    const [x1, y1] = pt(ang(v), 88);
    const [x2, y2] = pt(ang(v), major ? 76 : 81);
    ticks += `<line class="tick ${major ? 'major' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    if (major) {
      const [tx, ty] = pt(ang(v), 64);
      ticks += `<text class="num" x="${tx}" y="${ty}">${v}</text>`;
    }
  }
  $('ticks').innerHTML = ticks;
  const [rx1, ry1] = pt(ang(6.5), 90);
  const [rx2, ry2] = pt(ang(8), 90);
  $('redzone').setAttribute('d', `M${rx1} ${ry1} A90 90 0 0 1 ${rx2} ${ry2}`);

  let rpm = 0;
  let target = 0;
  const needle = $('needle');
  setInterval(() => {
    rpm += (target - rpm) * 0.18;
    needle.style.transform = `rotate(${ang(Math.max(0, Math.min(MAX, rpm)))}deg)`;
  }, 30);

  // ---------- Steering: mouse X turns the wheel, the cockpit leans the other way ----------
  addEventListener('pointermove', e => {
    if (ign.hidden) return;
    const k = e.clientX / innerWidth - 0.5;
    ign.style.setProperty('--steer', `${k * 240}deg`);
    $('ignBg').style.setProperty('--sway', `${-k * 4}%`);
    $('ignBg').style.setProperty('--roll', `${k * 2.5}deg`);
  });

  // ---------- Key → PIN → start ----------
  let stage = 'key';
  let entry = '';
  const status = t => { $('status').textContent = t; };

  $('slot').addEventListener('click', () => {
    if (stage !== 'key') return;
    stage = 'pin';
    ign.classList.remove('key-cursor');
    ign.classList.add('key-in');
    status('Enter PIN');
    $('pinpad').hidden = false;
    $('pinHint').textContent = s.pin === '1234' ? 'Demo PIN: 1234 · change it in Car Mode controls' : '';
    CarPlayer.play('horn', s.volume * 0.25); // the key "clicks" in — quiet chirp
  });

  $('keys').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'skip', 0, 'del']
    .map(k => (k === 'skip' ? '<span></span>' : k === 'del'
      ? '<button data-k="del" aria-label="Delete"><span class="i i-back"></span></button>'
      : `<button data-k="${k}">${k}</button>`)).join('');

  function renderDots() {
    [...$('pinDots').children].forEach((d, i) => d.classList.toggle('on', i < entry.length));
  }

  function press(k) {
    if (stage !== 'pin') return;
    $('pinpad').classList.remove('bad');
    if (k === 'del') entry = entry.slice(0, -1);
    else if (entry.length < 4) entry += k;
    renderDots();
    if (entry.length === 4) setTimeout(check, 120);
  }

  function check() {
    if (entry === String(s.pin)) return start();
    const pad = $('pinpad');
    pad.classList.add('bad', 'shake');
    setTimeout(() => pad.classList.remove('shake'), 420);
    status('Wrong PIN');
    entry = '';
    setTimeout(renderDots, 350);
  }

  $('keys').addEventListener('click', e => {
    const b = e.target.closest('[data-k]');
    if (b) press(b.dataset.k);
  });
  addEventListener('keydown', e => {
    if (ign.hidden) return;
    if (/^[0-9]$/.test(e.key)) press(e.key);
    if (e.key === 'Backspace') press('del');
    if (e.key === 'Enter' && stage === 'run') drive();
  });

  function start() {
    stage = 'run';
    $('pinpad').hidden = true;
    ign.classList.add('on');
    status('Engine on');
    $('gear').textContent = 'N';
    if (s.sound) CarPlayer.play('start', s.volume);
    // crank, catch, flare, settle to idle
    target = 0.4;
    setTimeout(() => { target = 3.2; }, 650);
    setTimeout(() => { target = 1.0; }, 1500);
    setTimeout(() => { $('gear').textContent = 'D'; status('Ready'); $('drive').hidden = false; }, 2000);
    chrome.storage.session.set({ ignited: true }).catch(() => {});
    setTimeout(() => { if (!ign.hidden && stage === 'run') drive(); }, 9000);
  }

  // Hold the mouse to blip the throttle once the engine is running.
  addEventListener('pointerdown', e => {
    if (stage !== 'run' || e.target.closest('button')) return;
    target = 5.5;
    if (s.sound) CarPlayer.play('rev', s.volume);
  });
  addEventListener('pointerup', () => { if (stage === 'run') target = 1.0; });

  function drive() {
    if (stage === 'gone') return;
    stage = 'gone';
    target = 6;
    if (s.sound) CarPlayer.play('nitro', s.volume);
    ign.classList.add('leaving');
    window.CarNewTab?.show();
    dispatchEvent(new Event('carmode:drive'));
    setTimeout(() => { ign.hidden = true; }, 1000);
  }

  $('drive').addEventListener('click', drive);
  $('skip').addEventListener('click', () => {
    chrome.storage.session.set({ ignited: true }).catch(() => {});
    stage = 'run';
    drive();
  });
  return true;
})();
