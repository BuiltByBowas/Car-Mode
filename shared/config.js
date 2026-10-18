// Car Mode shared config — loaded by the service worker, offscreen audio page, pages and side panel.
(function (root) {
  const DEFAULTS = {
    wallpaper: 'drift-smoke.webm', // a photo (.jpg) or a video (.webm) from assets
    shuffle: false,       // new car photo on every new tab
    entrance: true,       // "drive-in" zoom when a new tab opens
    topCar: true,         // the page car on/off
    carMode: 'roam',      // 'roam' = drives around the page edges | 'tab' = parks above the active tab
    carSpeed: 1,          // roam speed multiplier
    carPaint: { type: 'original', c1: '#e10600', c2: '#ff7a00' }, // 'original' | 'solid' | 'gradient'
    accent: { c1: '#e10600', c2: '#ff7a00', gradient: false },   // Car Mode's own highlight color
    smoke: 'full',        // 'off' | 'light' | 'full' — tire smoke when the car moves / drifts
    startScreen: true,    // "Let's Drive the Full Chrome" on the first new tab after Chrome starts
    sound: true,
    volume: 0.6,
    sounds: { startup: 'start', tabOpen: 'nitro', tabClose: 'drive-away', tabSwitch: 'none' },
    idle: 0               // background engine idle level, 0 = off
  };

  // Clips cut from real recordings in assets/sounds (see credits.json). Times in seconds;
  // `gain` scales the clip against the master volume.
  const CLIPS = {
    'start':      { label: 'Engine start',   file: 'corsa-start.ogg', start: 0,    dur: 3.96 },
    'nitro':      { label: 'Nitro burst',    file: 'ferrari-f60.ogg', start: 4.6,  dur: 1.9, gain: 0.45 },
    'launch':     { label: 'F1 launch',      file: 'ferrari-f60.ogg', start: 4.0,  dur: 3.2, gain: 0.7 },
    'drive-away': { label: 'Drive away',     file: 'maserati.ogg',    start: 3.8,  dur: 3.2, gain: 0.8 },
    'rev':        { label: 'Quick rev',      file: 'five-cyl.ogg',    start: 7.8,  dur: 1.3, gain: 0.6 },
    'rev-long':   { label: 'Engine rev',     file: 'five-cyl.ogg',    start: 9.1,  dur: 2.6 },
    'flyby':      { label: 'Bugatti fly-by', file: 'bugatti.ogg',     start: 17.5, dur: 4.5 },
    'door-start': { label: 'Door and start', file: 'parkhaus.ogg',    start: 2.8,  dur: 4.0 },
    'horn':       { label: 'Horn',           file: 'horn.wav',        start: 0.4,  dur: 0.6, gain: 0.5 },
    'none':       { label: 'Silent' }
  };

  // Steady part of the 5-cylinder recording, looped for the idle engine.
  const IDLE = { file: 'five-cyl.ogg', start: 2.75, end: 4.75 };

  const EVENTS = [
    ['startup', 'Chrome starts'],
    ['tabOpen', 'New tab'],
    ['tabClose', 'Close tab'],
    ['tabSwitch', 'Switch tab']
  ];

  const isVideo = file => /\.webm$/i.test(file || '');

  async function load() {
    const { settings } = await chrome.storage.local.get('settings');
    return { ...DEFAULTS, ...(settings || {}), sounds: { ...DEFAULTS.sounds, ...(settings?.sounds || {}) } };
  }

  async function save(patch) {
    const s = { ...(await load()), ...patch };
    await chrome.storage.local.set({ settings: s });
    return s;
  }

  // Photos and videos in one list: [{ file, thumb, name, author, license, ..., video }]
  async function wallpapers(base = '../') {
    const [photos, videos] = await Promise.all([
      fetch(`${base}assets/wallpapers/credits.json`).then(r => r.json()),
      fetch(`${base}assets/videos/credits.json`).then(r => r.json())
    ]);
    return [
      ...videos.map(v => ({ ...v, thumb: v.file.replace('.webm', '-thumb.jpg'), dir: 'videos', video: true })),
      ...photos.map(p => ({ ...p, dir: 'wallpapers', video: false }))
    ];
  }

  root.CAR = { DEFAULTS, CLIPS, IDLE, EVENTS, isVideo, load, save, wallpapers };
})(typeof self !== 'undefined' ? self : this);
