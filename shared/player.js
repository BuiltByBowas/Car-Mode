// Plays clips cut from the bundled recordings, with short fades so cuts never click.
(function (root) {
  const { CLIPS, IDLE } = root.CAR;
  let ctx = null;
  let out = null;
  const buffers = new Map();
  let idle = null;

  function context() {
    if (!ctx) {
      ctx = new AudioContext();
      out = ctx.createGain();
      out.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  async function buffer(file) {
    if (!buffers.has(file)) {
      buffers.set(file, fetch(chrome.runtime.getURL(`assets/sounds/${file}`))
        .then(r => r.arrayBuffer())
        .then(b => context().decodeAudioData(b)));
    }
    return buffers.get(file);
  }

  async function play(id, volume = 0.6) {
    const clip = CLIPS[id];
    if (!clip?.file) return;
    const c = context();
    const buf = await buffer(clip.file);
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    const t = c.currentTime;
    const fadeOut = Math.min(0.6, clip.dur / 3);
    volume *= clip.gain ?? 1;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.03);
    g.gain.setValueAtTime(volume, t + clip.dur - fadeOut);
    g.gain.linearRampToValueAtTime(0, t + clip.dur);
    src.connect(g).connect(out);
    src.start(t, clip.start, clip.dur);
  }

  async function setIdle(level) {
    const c = context();
    if (level <= 0) {
      if (idle) {
        const old = idle;
        idle = null;
        old.gain.gain.setTargetAtTime(0, c.currentTime, 0.3);
        setTimeout(() => old.src.stop(), 1500);
      }
      return;
    }
    if (!idle) {
      const src = c.createBufferSource();
      src.buffer = await buffer(IDLE.file);
      src.loop = true;
      src.loopStart = IDLE.start;
      src.loopEnd = IDLE.end;
      const gain = c.createGain();
      gain.gain.value = 0;
      src.connect(gain).connect(out);
      src.start(0, IDLE.start);
      idle = { src, gain };
    }
    idle.gain.gain.setTargetAtTime(level * 0.5, c.currentTime, 0.3);
  }

  root.CarPlayer = { play, setIdle };
})(typeof self !== 'undefined' ? self : this);
