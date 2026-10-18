// Color helpers, accent theming, the car paint shop and the Chrome theme generator.
(function (root) {
  const hexToRgb = h => {
    const n = parseInt(h.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgbToHex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const lum = ([r, g, b]) => {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const textOn = rgb => (lum(rgb) > 0.4 ? [24, 24, 27] : [250, 250, 250]);

  // ---------- Accent: one color or a gradient, applied as CSS variables ----------
  function applyAccent(el, accent) {
    const a = { c1: '#e10600', c2: '#ff7a00', gradient: false, ...(accent || {}) };
    const c2 = a.gradient ? a.c2 : a.c1;
    el.style.setProperty('--accent', a.c1);
    el.style.setProperty('--accent-2', c2);
    el.style.setProperty('--accent-grad', `linear-gradient(135deg, ${a.c1}, ${c2})`);
    el.style.setProperty('--accent-glow', `${a.c1}88`);
    el.style.setProperty('--on-accent', rgbToHex(textOn(hexToRgb(a.c1))));
  }

  // ---------- Paint shop: recolor the car's body paint, keeping its shading and reflections ----------
  // Side view = red Ferrari: "paint" = strongly red, saturated pixels.
  // Top view = silver S2000 (mask 'silver'): "paint" = bright, unsaturated body pixels (not glass or tyres).
  async function paintCar(src, paint, width = 480, mask = 'red') {
    const img = new Image();
    img.src = src;
    await img.decode();
    const h = Math.round((img.naturalHeight / img.naturalWidth) * width);
    const c = new OffscreenCanvas(width, h);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, width, h);
    if (!paint || paint.type === 'original') return c.convertToBlob({ type: 'image/png' });
    const d = g.getImageData(0, 0, width, h);
    const px = d.data;
    const c1 = hexToRgb(paint.c1);
    const c2 = hexToRgb(paint.type === 'gradient' ? paint.c2 : paint.c1);
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 10) continue;
      const r = px[i], gg = px[i + 1], b = px[i + 2];
      const max = Math.max(r, gg, b);
      const min = Math.min(r, gg, b);
      const sat = max ? (max - min) / max : 0;
      // red paint: red channel dominates, decent saturation
      const redness = mask === 'silver'
        ? (max > 95 && sat < 0.22 ? Math.min(1, (max - 95) / 50) * (1 - sat / 0.22) : 0)
        : (r > 50 && r > gg * 1.45 && r > b * 1.45 ? Math.min(1, (sat - 0.3) / 0.3) : 0);
      if (redness <= 0) continue;
      const x = ((i / 4) % width) / width;
      const target = mix(c1, c2, x);
      // keep the original light: shade = brightness of this pixel relative to a mid-tone of that paint
      const shade = max / (mask === 'silver' ? 200 : 175);
      const out = target.map(v => v * shade + Math.max(0, shade - 1) * 90);
      for (let k = 0; k < 3; k++) px[i + k] = px[i + k] + (out[k] - px[i + k]) * redness;
    }
    g.putImageData(d, 0, 0);
    return c.convertToBlob({ type: 'image/png' });
  }

  const blobToDataUrl = blob => new Promise(r => {
    const fr = new FileReader();
    fr.onload = () => r(fr.result);
    fr.readAsDataURL(blob);
  });

  // ---------- Chrome theme generator ----------
  // frame = the tab strip behind inactive tabs; tab = the active tab + toolbar.
  function themeColors({ style, c1, c2, tab }) {
    const f1 = hexToRgb(c1);
    const f2 = hexToRgb(style === 'gradient' ? c2 : c1);
    const frame = mix(f1, f2, 0.5);
    const active = hexToRgb(tab);
    const onTab = textOn(active);
    // judge inactive-tab text against the brighter end of a gradient, so it stays readable everywhere
    const onFrame = textOn(lum(f1) > lum(f2) ? f1 : f2);
    const dark = lum(active) < 0.4;
    return {
      frame, frame_inactive: mix(frame, [0, 0, 0], 0.18), toolbar: active,
      tab_text: onTab, tab_background_text: mix(onFrame, frame, 0.3), tab_background_text_inactive: mix(onFrame, frame, 0.45),
      bookmark_text: onTab, toolbar_text: onTab, toolbar_button_icon: mix(onTab, active, 0.1),
      omnibox_background: mix(active, [0, 0, 0], dark ? 0.28 : 0.07), omnibox_text: onTab,
      ntp_background: [11, 11, 12], ntp_text: [244, 244, 245]
    };
  }

  // Frame image painted on a canvas: solid, horizontal gradient, or carbon fiber over a tint.
  async function themeFrame({ style, c1, c2 }, carbonUrl) {
    const W = 2600;
    const H = 180;
    const c = new OffscreenCanvas(W, H);
    const g = c.getContext('2d');
    if (style === 'gradient') {
      const gr = g.createLinearGradient(0, 0, W, 0);
      gr.addColorStop(0, c1);
      gr.addColorStop(1, c2);
      g.fillStyle = gr;
    } else {
      g.fillStyle = c1;
    }
    g.fillRect(0, 0, W, H);
    if (style === 'carbon') {
      const tile = new Image();
      tile.src = carbonUrl;
      await tile.decode();
      g.globalCompositeOperation = 'overlay';
      g.globalAlpha = 0.85;
      g.fillStyle = g.createPattern(tile, 'repeat');
      g.fillRect(0, 0, W, H);
    }
    return c.convertToBlob({ type: 'image/png' });
  }

  function themeManifest(name, colors) {
    const out = {};
    for (const [k, v] of Object.entries(colors)) out[k] = v.map(Math.round);
    return {
      manifest_version: 3,
      name: `Car Mode Theme — ${name}`,
      version: '1.0.0',
      description: 'Chrome theme made with the Car Mode theme builder.',
      theme: { images: { theme_frame: 'images/frame.png', theme_frame_inactive: 'images/frame.png' }, colors: out }
    };
  }

  root.CarPaint = { hexToRgb, rgbToHex, mix, lum, textOn, applyAccent, paintCar, blobToDataUrl, themeColors, themeFrame, themeManifest };
})(typeof self !== 'undefined' ? self : this);
