// Car Mode service worker: plays engine sounds for browser events through an offscreen audio page.
importScripts('shared/config.js');

const { DEFAULTS, load } = self.CAR;
const OFFSCREEN_URL = 'offscreen/offscreen.html';

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  // first install: open the user guide
  if (reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('guide/guide.html') });
  const { settings } = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({ settings: { ...DEFAULTS, ...(settings || {}) } });
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  syncAudio();
});

// With the ignition screen on, the engine only starts once the user turns the key (on the new tab).
chrome.runtime.onStartup.addListener(async () => {
  const s = await load();
  if (!s.ignition) playEvent('startup');
});

// ---------- Offscreen audio page ----------
let pending = null; // clip waiting for a freshly created offscreen page to say it's ready
let busy = Promise.resolve();

async function hasOffscreen() {
  return (await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })).length > 0;
}

// Opens or closes the offscreen page to match settings, and pushes the current volume/idle level.
function syncAudio() {
  busy = busy.then(async () => {
    const s = await load();
    const exists = await hasOffscreen();
    if (s.sound && !exists) {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Plays the engine sounds Car Mode uses for browser events.'
      });
      return; // the page asks for its config when it's ready
    }
    if (!s.sound && exists) {
      await chrome.offscreen.closeDocument();
      return;
    }
    if (exists) chrome.runtime.sendMessage({ target: 'offscreen', type: 'config', volume: s.volume, idle: s.idle }).catch(() => {});
  }).catch(err => console.warn('[Car Mode] audio', err));
  return busy;
}

async function playEvent(key) {
  const s = await load();
  return playClip(s.sounds[key], s);
}

async function playClip(id, s) {
  if (!s.sound || !id || id === 'none') return;
  if (!(await hasOffscreen())) {
    pending = id;
    await syncAudio();
    return;
  }
  chrome.runtime.sendMessage({ target: 'offscreen', type: 'play', id, volume: s.volume }).catch(() => {});
}

// ---------- Browser events ----------
let lastCreated = 0;
let lastClosed = 0;
chrome.tabs.onCreated.addListener(() => {
  lastCreated = Date.now();
  playEvent('tabOpen');
});
chrome.tabs.onRemoved.addListener((tabId, info) => {
  if (info.isWindowClosing) return;
  lastClosed = Date.now();
  playEvent('tabClose');
});
chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  // a new tab activates itself; don't stack the switch sound on the open sound
  if (Date.now() - lastCreated > 700) playEvent('tabSwitch');
  moveCar(tabId, windowId);
});

// ---------- Top car: where the active tab sits across the window (0 = first tab, 1 = last) ----------
async function fractionOf(tabId, windowId) {
  const tabs = await chrome.tabs.query({ windowId });
  const i = tabs.findIndex(t => t.id === tabId);
  return tabs.length > 1 ? Math.max(0, i) / (tabs.length - 1) : 0;
}

async function moveCar(tabId, windowId) {
  const to = await fractionOf(tabId, windowId);
  const { carPos = {}, carMoves = {} } = await chrome.storage.session.get(['carPos', 'carMoves']);
  const from = carPos[windowId] ?? to;
  const now = Date.now();
  const kind = now - lastCreated < 800 ? 'new' : now - lastClosed < 800 ? 'close' : 'switch';
  const move = { from, to, kind, at: now };
  carPos[windowId] = to;
  carMoves[tabId] = move;
  await chrome.storage.session.set({ carPos, carMoves });
  // If the page's script is running it plays now; otherwise it asks via 'car-hello' when it loads.
  chrome.tabs.sendMessage(tabId, { type: 'car-move', ...move }).then(async () => {
    const { carMoves: m = {} } = await chrome.storage.session.get('carMoves');
    delete m[tabId];
    chrome.storage.session.set({ carMoves: m });
  }).catch(() => {});
}

chrome.tabs.onRemoved.addListener(async tabId => {
  const { carMoves = {} } = await chrome.storage.session.get('carMoves');
  if (carMoves[tabId]) {
    delete carMoves[tabId];
    chrome.storage.session.set({ carMoves });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'car-hello' && sender.tab) {
    (async () => {
      const { carMoves = {}, carPos = {} } = await chrome.storage.session.get(['carMoves', 'carPos']);
      const move = carMoves[sender.tab.id];
      if (move && Date.now() - move.at < 5000) {
        delete carMoves[sender.tab.id];
        await chrome.storage.session.set({ carMoves });
        sendResponse({ move });
      } else {
        sendResponse({ park: carPos[sender.tab.windowId] ?? (await fractionOf(sender.tab.id, sender.tab.windowId)) });
      }
    })();
    return true;
  }
  if (msg?.type === 'car-action' && sender.tab) {
    carAction(msg.action, sender.tab, msg).then(sendResponse, err => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  if (msg?.type === 'offscreen-ready') {
    load().then(s => {
      sendResponse({ volume: s.volume, idle: s.idle, play: pending });
      pending = null;
    });
    return true;
  }
});

// ---------- Quick menu actions (from the page car) ----------
async function carAction(action, tab, msg = {}) {
  switch (action) {
    case 'state':
      return { muted: !!tab.mutedInfo?.muted, pinned: tab.pinned };
    case 'screenshot': {
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      await chrome.downloads.download({ url: dataUrl, filename: `Car Mode/screenshot-${stamp}.png` });
      return { ok: true };
    }
    case 'new': await chrome.tabs.create({ index: tab.index + 1 }); return { ok: true };
    case 'duplicate': await chrome.tabs.duplicate(tab.id); return { ok: true };
    case 'close': await chrome.tabs.remove(tab.id); return { ok: true };
    case 'mute': {
      const t = await chrome.tabs.update(tab.id, { muted: !tab.mutedInfo?.muted });
      return { muted: t.mutedInfo.muted };
    }
    case 'pin': {
      const t = await chrome.tabs.update(tab.id, { pinned: !tab.pinned });
      return { pinned: t.pinned };
    }
    case 'zoom-in':
    case 'zoom-out':
    case 'zoom-reset': {
      const z = await chrome.tabs.getZoom(tab.id);
      const next = action === 'zoom-reset' ? 1 : Math.min(3, Math.max(0.3, Math.round((z + (action === 'zoom-in' ? 0.1 : -0.1)) * 10) / 10));
      await chrome.tabs.setZoom(tab.id, next);
      return { zoom: next };
    }
    case 'horn':
      await playClip('horn', { ...(await load()), sound: true });
      return { ok: true };
    case 'sound':
      await playClip(msg.clip, await load());
      return { ok: true };
    case 'guide':
      await chrome.tabs.create({ url: chrome.runtime.getURL('guide/guide.html'), index: tab.index + 1 });
      return { ok: true };
  }
  throw new Error(`Unknown action ${action}`);
}

chrome.commands.onCommand.addListener(async command => {
  const type = { 'car-menu': 'car-menu', 'car-drive': 'car-drive' }[command];
  if (!type) return;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab) chrome.tabs.sendMessage(tab.id, { type }).catch(() => {});
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) syncAudio();
});
