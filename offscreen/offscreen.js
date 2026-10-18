// Hidden page that owns Car Mode's audio, so sounds play whichever tab is open (or just closed).
let volume = 0.6;

function configure(cfg) {
  volume = cfg.volume ?? volume;
  CarPlayer.setIdle((cfg.idle || 0) * volume);
}

chrome.runtime.onMessage.addListener(msg => {
  if (msg?.target !== 'offscreen') return;
  if (msg.type === 'config') configure(msg);
  if (msg.type === 'play') CarPlayer.play(msg.id, msg.volume ?? volume);
});

chrome.runtime.sendMessage({ type: 'offscreen-ready' }).then(res => {
  if (!res) return;
  configure(res);
  if (res.play) CarPlayer.play(res.play, res.volume);
});
