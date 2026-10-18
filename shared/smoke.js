// Tire-smoke renderer: layered, rotating, growing puffs drawn from noise textures (assets/fx/smoke-*.png).
// Runs only while there is smoke on screen, so an idle page costs nothing.
(function (root) {
  const SPRITES = [0, 1, 2, 3].map(i => {
    const img = new Image();
    img.src = chrome.runtime.getURL(`assets/fx/smoke-${i}.png`);
    return img;
  });
  const rand = (a, b) => a + Math.random() * (b - a);

  class Smoke {
    constructor(canvas, { max = 260 } = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.parts = [];
      this.max = max;
      this.running = false;
      this.tint = 1; // < 1 darkens smoke so it stays visible on white pages
      this.resize();
      addEventListener('resize', () => this.resize(), { passive: true });
    }

    resize() {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      this.w = innerWidth;
      this.h = innerHeight;
      this.canvas.width = Math.round(this.w * dpr);
      this.canvas.height = Math.round(this.h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // One puff. Sizes in px, velocities in px/s, life in s.
    puff(x, y, { vx = 0, vy = 0, size = 40, grow = 60, life = 1.6, alpha = 0.5 } = {}) {
      if (this.parts.length >= this.max) this.parts.shift();
      this.parts.push({
        x, y, vx: vx + rand(-12, 12), vy: vy + rand(-10, 6), size: size * rand(0.8, 1.2), grow: grow * rand(0.7, 1.3),
        rot: rand(0, Math.PI * 2), vr: rand(-0.6, 0.6), t: 0, life: life * rand(0.8, 1.2), alpha,
        img: SPRITES[(Math.random() * SPRITES.length) | 0]
      });
      this.start();
    }

    // Exhaust puffs streaming out behind a moving car. dir = +1 car moving right, -1 moving left.
    exhaust(x, y, dir, speed = 1) {
      this.puff(x, y, { vx: -dir * rand(30, 90) * speed, vy: rand(-8, 4), size: 18 + 14 * speed, grow: 70 + 60 * speed, life: 1.3 + speed * 0.6, alpha: 0.42 });
    }

    // A tire-smoke cloud rolling across the screen from one point (drift / burnout).
    billow(x, y, { width = this.w, density = 1, alpha = 0.32, life = 2.6, drift = 0 } = {}) {
      const n = Math.round(40 * density);
      for (let i = 0; i < n; i++) {
        const px = x + rand(-width / 2, width / 2);
        this.puff(px, y + rand(-30, 60), {
          vx: drift * rand(20, 80) + rand(-30, 30), vy: rand(10, 70), size: rand(80, 160), grow: rand(90, 200), life: life, alpha
        });
      }
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      requestAnimationFrame(t => this.frame(t));
    }

    frame(now) {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      const { ctx } = this;
      ctx.clearRect(0, 0, this.w, this.h);
      if (this.tint < 1) ctx.filter = `brightness(${this.tint})`;
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.t += dt;
        if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.985;
        p.vy = p.vy * 0.985 - 6 * dt; // smoke slowly rises
        p.rot += p.vr * dt;
        const k = p.t / p.life;
        const s = p.size + p.grow * p.t;
        ctx.globalAlpha = p.alpha * Math.min(1, k * 6) * (1 - k) ** 1.4;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.drawImage(p.img, -s / 2, -s / 2, s, s);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.filter = 'none';
      if (this.parts.length) requestAnimationFrame(t => this.frame(t));
      else this.running = false;
    }
  }

  root.CarSmoke = Smoke;
})(typeof self !== 'undefined' ? self : this);
