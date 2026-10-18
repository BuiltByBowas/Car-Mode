// Start screen: on the first new tab after Chrome starts, "Let's Drive the Full Chrome".
// Clicking (or a key) starts the engine with the real recording and rolls into the new tab;
// "Start & drive" also drops you straight into game mode.
window.CarStart = (async () => {
  const $ = id => document.getElementById(id);
  const s = await CAR.load();
  const { started } = await chrome.storage.session.get('started').catch(() => ({}));
  const forced = location.hash === '#start';
  if (!forced && (!s.startScreen || started)) return false;

  const el = $('start');
  el.hidden = false;
  const { carImage } = await chrome.storage.local.get('carImage');
  if (carImage) $('startCar').src = carImage;
  $('startGo').focus();

  let gone = false;
  function go(drive = false) {
    if (gone) return;
    gone = true;
    chrome.storage.session.set({ started: true }).catch(() => {});
    if (s.sound) CarPlayer.play('start', s.volume);
    el.classList.add('leaving');
    window.CarNewTab?.show();
    dispatchEvent(new Event('carmode:drive'));
    if (drive) setTimeout(() => dispatchEvent(new Event('carmode:game')), 1100);
    setTimeout(() => { el.hidden = true; }, 900);
  }

  $('startGo').addEventListener('click', e => { e.stopPropagation(); go(false); });
  $('startDrive').addEventListener('click', e => { e.stopPropagation(); go(true); });
  el.addEventListener('click', () => go(false));
  addEventListener('keydown', e => {
    if (el.hidden || gone) return;
    if (e.key === 'Tab') return; // let keyboard users move between the two buttons
    e.preventDefault();
    go(false);
  }, true);
  return true;
})();
