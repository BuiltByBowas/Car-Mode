// User guide: accent colors, painted car, quick-menu reference, buttons and TOC highlighting.
(async () => {
  const $ = id => document.getElementById(id);
  const s = await CAR.load();
  CarPaint.applyAccent(document.documentElement, s.accent);
  const { carImage } = await chrome.storage.local.get('carImage');
  if (carImage) $('heroCar').src = carImage;

  // Quick-menu reference (same order as the in-page menu)
  const MENU = [
    ['steering-wheel', 'Drive it — game mode'], ['book', 'User guide'], ['camera', 'Screenshot'], ['refresh', 'Reload'],
    ['arrow-left', 'Back'], ['arrow-right', 'Forward'], ['plus', 'New tab'], ['copy', 'Duplicate tab'],
    ['volume', 'Mute / unmute tab'], ['pin', 'Pin tab'], ['zoom-in', 'Zoom in'], ['zoom-out', 'Zoom out'],
    ['zoom-reset', 'Reset zoom'], ['maximize', 'Full screen'], ['arrow-bar-to-up', 'Scroll to top'], ['arrow-bar-to-down', 'Scroll to bottom'],
    ['picture-in-picture', 'Mini player (videos)'], ['headphones', 'Read aloud'], ['contrast', 'High contrast'], ['moon', 'Dark page'],
    ['link', 'Copy link'], ['language', 'Translate page'], ['printer', 'Print'], ['speakerphone', 'Horn'],
    ['parking', 'Park the car'], ['x', 'Close tab']
  ];
  $('menuGrid').innerHTML = MENU.map(([icon, label]) => `<div><span class="ic" style="--src:url('../assets/icons/${icon}.svg')"></span>${label}</div>`).join('');

  $('startEngine').addEventListener('click', async () => {
    await chrome.storage.session.remove('started');
    chrome.tabs.create({ url: chrome.runtime.getURL('newtab/newtab.html#start') });
  });
  $('openControls').addEventListener('click', async () => {
    const win = await chrome.windows.getCurrent();
    chrome.sidePanel.open({ windowId: win.id });
  });
  $('savePdf').addEventListener('click', () => print());

  // Highlight the section you're reading in the table of contents.
  const links = [...document.querySelectorAll('.toc a')];
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === `#${e.target.id}`));
    }
  }, { rootMargin: '-30% 0px -60% 0px' });
  document.querySelectorAll('main section').forEach(sec => io.observe(sec));
})();
