/**
 * Canvas renderer for the gameplay scene.
 *
 * Coordinate system: world units (720 wide). The canvas height adapts to the
 * screen; extra height becomes sky above the world (offsetY), so the playfield
 * itself is identical everywhere.
 *
 * The static background (sky, strata, decor, vignette) is painted once per
 * theme/resize into an offscreen canvas.
 */
(function (GR) {
  'use strict';

  const C = GR.CONFIG;
  const W = C.WORLD_W;
  const H = C.WORLD_H;
  const G = C.GROUND_Y;
  const P = C.PIVOT;
  const TAU = Math.PI * 2;
  const TOP_EXTRA_MAX = 140; // extra sky on tall screens; the rest goes below the field
  const FONT = '"Lilita One", "Arial Black", Impact, sans-serif';

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.bg = document.createElement('canvas');
      this.theme = GR.MINE_SKINS_BY_ID.classic;
      this.claw = GR.CLAW_SKINS_BY_ID.classic;
      this.scale = 1;
      this.dpr = 1;
      this.viewH = H;
      this.offsetY = 0;
      this.drumAngle = 0;
      this.lastClawLen = C.CLAW.restLength;
      this.cartFill = 0;
      this.time = 0;
    }

    resize(cssW, cssH, dpr) {
      this.dpr = dpr;
      this.canvas.width = Math.round(cssW * dpr);
      this.canvas.height = Math.round(cssH * dpr);
      this.canvas.style.width = cssW + 'px';
      this.canvas.style.height = cssH + 'px';
      this.cssW = cssW;
      this.cssH = cssH;
      this.scale = this.canvas.width / W; // device pixels per world unit
      this.viewH = this.canvas.height / this.scale;
      const extra = Math.max(0, this.viewH - H);
      this.offsetY = Math.min(extra, TOP_EXTRA_MAX);
      this.bottomExtra = extra - this.offsetY;
      GR.Sprites.setResolution(this.scale);
      this.paintBackground();
    }

    setTheme(id) {
      const t = GR.MINE_SKINS_BY_ID[id] || GR.MINE_SKINS_BY_ID.classic;
      if (t !== this.theme) {
        this.theme = t;
        this.paintBackground();
      }
    }

    setClawSkin(id) {
      this.claw = GR.CLAW_SKINS_BY_ID[id] || GR.CLAW_SKINS_BY_ID.classic;
    }

    /** World point -> CSS pixel position inside the stage. */
    toCss(x, y) {
      const k = this.cssW / W;
      return { x: x * k, y: (y + this.offsetY) * k };
    }

    /** CSS pixel position inside the stage -> world point. */
    toWorld(x, y) {
      const k = W / this.cssW;
      return { x: x * k, y: y * k - this.offsetY };
    }

    // ---- Background -------------------------------------------------------

    paintBackground() {
      if (!this.canvas.width) return;
      this.bg.width = this.canvas.width;
      this.bg.height = this.canvas.height;
      const ctx = this.bg.getContext('2d');
      ctx.setTransform(this.scale, 0, 0, this.scale, 0, this.offsetY * this.scale);
      Renderer.paintScene(ctx, this.theme, -this.offsetY, H + this.bottomExtra);
    }

    /** Paints sky, ground strata and decor for a theme. Also used for shop previews. */
    static paintScene(ctx, theme, top, bottom) {
      bottom = bottom || H;
      const rng = GR.RNG.fromString('bg-' + theme.id);
      // Sky
      const sky = ctx.createLinearGradient(0, top, 0, G);
      sky.addColorStop(0, theme.sky[0]);
      sky.addColorStop(1, theme.sky[1]);
      ctx.fillStyle = sky;
      ctx.fillRect(0, top, W, G - top + 4);
      if (theme.stars) {
        for (let i = 0; i < 80; i++) {
          ctx.globalAlpha = rng.range(0.25, 0.9);
          ctx.fillStyle = '#ffffff';
          const s = rng.range(0.8, 2.2);
          ctx.fillRect(rng.range(0, W), rng.range(top, G - 70), s, s);
        }
        ctx.globalAlpha = 1;
        if (theme.id !== 'galaxy' && theme.id !== 'cyber') {
          // crescent moon
          const mx = 612;
          const my = Math.max(top + 60, G - 105);
          GR.Sprites.circle(ctx, mx, my, 22, 'rgba(255,244,214,0.9)');
          GR.Sprites.circle(ctx, mx + 9, my - 6, 19, theme.sky[1]);
        }
      } else {
        const sun = ctx.createRadialGradient(540, G - 60, 10, 540, G - 60, 150);
        sun.addColorStop(0, theme.id === 'lava' ? 'rgba(255,120,40,0.65)' : 'rgba(255,214,140,0.95)');
        sun.addColorStop(1, 'rgba(255,160,80,0)');
        ctx.fillStyle = sun;
        ctx.fillRect(380, G - 220, 320, 220);
      }
      // Hills (two layers)
      for (let layer = 0; layer < 2; layer++) {
        ctx.fillStyle = theme.hills;
        ctx.globalAlpha = layer === 0 ? 0.55 : 1;
        ctx.beginPath();
        ctx.moveTo(0, G);
        const base = layer === 0 ? 95 : 48;
        for (let x = 0; x <= W + 40; x += 40) {
          ctx.lineTo(x, G - base * rng.range(0.45, 1) - (layer === 0 ? 10 : 0));
        }
        ctx.lineTo(W, G);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Strata
      const depth = bottom + 20 - G;
      for (let i = 0; i < theme.strata.length; i++) {
        const y0 = G + 10 + (i * depth) / theme.strata.length;
        ctx.fillStyle = theme.strata[i];
        ctx.beginPath();
        ctx.moveTo(0, bottom + 40);
        const ph = rng.range(0, TAU);
        for (let x = 0; x <= W; x += 24) {
          const wave = i === 0 ? 0 : Math.sin(x * 0.012 + ph) * 14 + Math.sin(x * 0.031 + ph * 2) * 6;
          ctx.lineTo(x, y0 + wave);
        }
        ctx.lineTo(W, bottom + 40);
        ctx.closePath();
        ctx.fill();
      }
      // Pebbles
      for (let i = 0; i < 230; i++) {
        const x = rng.range(0, W);
        const y = rng.range(G + 24, bottom + 10);
        const r = rng.range(1.2, 4.2);
        ctx.globalAlpha = rng.range(0.35, 0.8);
        ctx.fillStyle = theme.speck;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.3, r, rng.range(0, 3), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      Renderer.paintDecor(ctx, theme, rng, bottom);

      // Surface lip + grass
      ctx.fillStyle = theme.surface;
      ctx.fillRect(0, G - 4, W, 18);
      ctx.fillStyle = theme.lip;
      ctx.fillRect(0, G - 6, W, 5);
      ctx.fillStyle = theme.grass;
      for (let x = 4; x < W; x += rng.range(10, 22)) {
        const h = rng.range(5, 11);
        ctx.beginPath();
        ctx.moveTo(x - 4, G - 4);
        ctx.lineTo(x + rng.range(-2, 2), G - 4 - h);
        ctx.lineTo(x + 4, G - 4);
        ctx.fill();
      }
      // Shaft opening under the rig
      const pit = ctx.createRadialGradient(P.x, G + 4, 6, P.x, G + 4, 90);
      pit.addColorStop(0, 'rgba(0,0,0,0.55)');
      pit.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = pit;
      ctx.fillRect(P.x - 100, G - 10, 200, 100);

      // Vignette + bottom fade (keeps the booster bar readable)
      const vig = ctx.createRadialGradient(W / 2, 640, 260, W / 2, 640, 820);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, G, W, bottom - G + 40);
      const fade = ctx.createLinearGradient(0, 1060, 0, bottom);
      fade.addColorStop(0, 'rgba(0,0,0,0)');
      fade.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, 1060, W, bottom - 1060 + 40);
    }

    static paintDecor(ctx, theme, rng, bottom) {
      ctx.save();
      const accent = theme.accent;
      switch (theme.decor) {
        case 'roots':
          ctx.strokeStyle = 'rgba(30,18,8,0.55)';
          ctx.lineCap = 'round';
          for (let i = 0; i < 12; i++) {
            let x = rng.range(10, W - 10);
            let y = G + 12;
            ctx.lineWidth = rng.range(1.5, 3);
            ctx.beginPath();
            ctx.moveTo(x, y);
            const len = rng.int(3, 6);
            for (let k = 0; k < len; k++) {
              x += rng.range(-14, 14);
              y += rng.range(10, 22);
              ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
          break;
        case 'crystals':
          for (let i = 0; i < 14; i++) {
            const cx = rng.range(20, W - 20);
            const cy = rng.range(G + 90, bottom - 30);
            ctx.globalAlpha = rng.range(0.14, 0.26);
            ctx.fillStyle = accent;
            const n = rng.int(2, 4);
            for (let k = 0; k < n; k++) {
              const a = rng.range(-0.7, 0.7);
              const len = rng.range(10, 24);
              const w = len * 0.28;
              ctx.save();
              ctx.translate(cx + k * 5, cy);
              ctx.rotate(a);
              ctx.beginPath();
              ctx.moveTo(-w, 0);
              ctx.lineTo(-w, -len * 0.7);
              ctx.lineTo(0, -len);
              ctx.lineTo(w, -len * 0.7);
              ctx.lineTo(w, 0);
              ctx.fill();
              ctx.restore();
            }
          }
          break;
        case 'veins':
          ctx.strokeStyle = accent;
          ctx.lineCap = 'round';
          for (let i = 0; i < 9; i++) {
            ctx.globalAlpha = rng.range(0.15, 0.28);
            ctx.lineWidth = rng.range(1.5, 3);
            let x = rng.range(0, W);
            let y = rng.range(G + 60, bottom - 40);
            ctx.beginPath();
            ctx.moveTo(x, y);
            for (let k = 0; k < 6; k++) {
              x += rng.range(15, 40) * (rng.chance(0.5) ? 1 : -1);
              y += rng.range(-18, 18);
              ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
          break;
        case 'cracks':
          ctx.strokeStyle = accent;
          ctx.shadowColor = accent;
          ctx.shadowBlur = 14;
          ctx.lineCap = 'round';
          for (let i = 0; i < 10; i++) {
            ctx.globalAlpha = rng.range(0.4, 0.7);
            ctx.lineWidth = rng.range(1.5, 3.2);
            let x = rng.range(0, W);
            let y = rng.range(G + 60, bottom);
            ctx.beginPath();
            ctx.moveTo(x, y);
            for (let k = 0; k < 5; k++) {
              x += rng.range(-30, 30);
              y += rng.range(-30, 10);
              ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
          ctx.shadowBlur = 0;
          break;
        case 'grid':
          ctx.strokeStyle = accent;
          ctx.globalAlpha = 0.08;
          ctx.lineWidth = 1.5;
          for (let y = G + 40; y < bottom + 20; y += 56) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
          }
          for (let x = 0; x <= W; x += 60) {
            ctx.beginPath();
            ctx.moveTo(x, G + 20);
            ctx.lineTo(x + (x - W / 2) * 0.25, bottom + 20);
            ctx.stroke();
          }
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = theme.grass;
          ctx.fillRect(0, G - 7, W, 2);
          break;
        case 'stars':
          for (let i = 0; i < 2; i++) {
            const nx = rng.range(120, W - 120);
            const ny = rng.range(G + 200, bottom - 200);
            const neb = ctx.createRadialGradient(nx, ny, 10, nx, ny, 220);
            neb.addColorStop(0, i ? 'rgba(255,110,200,0.16)' : 'rgba(140,110,255,0.18)');
            neb.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = neb;
            ctx.fillRect(nx - 220, ny - 220, 440, 440);
          }
          ctx.fillStyle = '#ffffff';
          for (let i = 0; i < 140; i++) {
            ctx.globalAlpha = rng.range(0.15, 0.6);
            const s = rng.range(0.8, 2);
            ctx.fillRect(rng.range(0, W), rng.range(G + 20, bottom), s, s);
          }
          break;
        default:
          break;
      }
      ctx.restore();
    }

    // ---- Frame ------------------------------------------------------------

    /**
     * @param {GameSession} session
     * @param {Particles} fx
     * @param {object} opts { dt, aimGuide, reduced }
     */
    render(session, fx, opts) {
      const ctx = this.ctx;
      const dt = opts.dt || 0;
      this.time += dt;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.bg, 0, 0);

      let sx = 0;
      let sy = 0;
      if (fx.shake > 0) {
        sx = (Math.random() - 0.5) * fx.shake;
        sy = (Math.random() - 0.5) * fx.shake;
      }
      const s = this.scale;
      ctx.setTransform(s, 0, 0, s, sx * s, (this.offsetY + sy) * s);

      if (session) {
        const claw = session.claw;
        this.drumAngle += (this.lastClawLen - claw.length) * 0.05;
        this.lastClawLen = claw.length;
        const goal = session.level.target ? Math.min(1, session.money / session.level.target) : 0;
        this.cartFill += (goal - this.cartFill) * GR.util.damp(4, dt);

        this.drawRig(ctx);
        this.drawObjects(ctx, session);
        if (opts.aimGuide && claw.state === 'swing') this.drawAimGuide(ctx, claw);
        this.drawBoosterFx(ctx, session);
        if (claw.grabbed) this.drawHeld(ctx, claw);
        this.drawCable(ctx, claw);
      } else {
        this.drawRig(ctx);
      }

      fx.draw(ctx);
      fx.drawTexts(ctx, FONT);

      if (fx.flash > 0) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = 'rgba(255,240,210,' + fx.flash.toFixed(3) + ')';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }

    drawRig(ctx) {
      const wood = '#7a5230';
      const woodDark = '#3b2614';
      const t = this.time;
      // Rails + mine cart (fills up as you approach the target)
      ctx.fillStyle = '#2a2d33';
      ctx.fillRect(452, G - 6, 120, 4);
      const cx = 508;
      if (this.cartFill > 0.02) {
        const h = 6 + this.cartFill * 26;
        ctx.fillStyle = '#c98613';
        ctx.beginPath();
        ctx.ellipse(cx, G - 40, 38, h, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#f2b52c';
        ctx.beginPath();
        ctx.ellipse(cx - 4, G - 40, 32, h * 0.85, 0, Math.PI, 0);
        ctx.fill();
        GR.Sprites.circle(ctx, cx - 14, G - 40 - h * 0.55, 4, '#ffe08a');
        GR.Sprites.circle(ctx, cx + 10, G - 40 - h * 0.35, 3, '#ffe08a');
        if (this.cartFill >= 1) GR.Sprites.star(ctx, cx + 6, G - 46 - h, 7 + Math.sin(t * 6) * 2, '#ffffff');
      }
      ctx.fillStyle = '#5d6470';
      ctx.strokeStyle = '#25282e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(466, G - 42);
      ctx.lineTo(550, G - 42);
      ctx.lineTo(542, G - 14);
      ctx.lineTo(474, G - 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#7b8494';
      ctx.fillRect(470, G - 40, 76, 6);
      ctx.fillStyle = '#25282e';
      for (let i = 0; i < 4; i++) GR.Sprites.circle(ctx, 482 + i * 17, G - 26, 2.2, '#25282e');
      GR.Sprites.circle(ctx, 488, G - 11, 8, '#25282e');
      GR.Sprites.circle(ctx, 528, G - 11, 8, '#25282e');
      GR.Sprites.circle(ctx, 488, G - 11, 3, '#7b8494');
      GR.Sprites.circle(ctx, 528, G - 11, 3, '#7b8494');

      // Deck
      ctx.fillStyle = woodDark;
      ctx.fillRect(272, G - 22, 9, 26);
      ctx.fillRect(408, G - 22, 9, 26);
      ctx.fillStyle = wood;
      ctx.fillRect(256, G - 26, 176, 11);
      ctx.fillStyle = '#9a6c40';
      ctx.fillRect(256, G - 26, 176, 3);
      ctx.fillStyle = woodDark;
      for (let x = 278; x < 430; x += 26) ctx.fillRect(x, G - 26, 2, 11);

      // Mast + boom
      ctx.fillStyle = '#5a3a1f';
      ctx.fillRect(292, P.y - 30, 11, G - 26 - (P.y - 30));
      ctx.fillStyle = wood;
      ctx.fillRect(284, P.y - 34, 112, 10);
      ctx.strokeStyle = woodDark;
      ctx.lineWidth = 2;
      ctx.strokeRect(284, P.y - 34, 112, 10);
      // diagonal brace
      ctx.strokeStyle = '#5a3a1f';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(300, P.y + 2);
      ctx.lineTo(332, P.y - 26);
      ctx.stroke();

      // Winch drum
      const dx = 298;
      const dy = G - 44;
      const cable = this.claw.cable;
      ctx.strokeStyle = cable;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(dx, dy - 14);
      ctx.lineTo(P.x - 9, P.y - 10);
      ctx.stroke();
      GR.Sprites.circle(ctx, dx, dy, 17, woodDark);
      GR.Sprites.circle(ctx, dx, dy, 14, '#8a5a30');
      GR.Sprites.circle(ctx, dx, dy, 10, cable);
      ctx.strokeStyle = woodDark;
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 4; i++) {
        const a = this.drumAngle + (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.lineTo(dx + Math.cos(a) * 15, dy + Math.sin(a) * 15);
        ctx.stroke();
      }
      GR.Sprites.circle(ctx, dx, dy, 4, '#ffc531');
      // crank handle
      const ca = this.drumAngle * 0.5;
      ctx.strokeStyle = '#25282e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.lineTo(dx + Math.cos(ca) * 22, dy + Math.sin(ca) * 22);
      ctx.stroke();
      GR.Sprites.circle(ctx, dx + Math.cos(ca) * 22, dy + Math.sin(ca) * 22, 4, '#c0392b');

      // Pulley at the pivot
      ctx.fillStyle = '#25282e';
      ctx.fillRect(P.x - 2, P.y - 26, 4, 14);
      GR.Sprites.circle(ctx, P.x, P.y - 10, 10, '#25282e');
      GR.Sprites.circle(ctx, P.x, P.y - 10, 7, '#9aa0a8');
      GR.Sprites.circle(ctx, P.x, P.y - 10, 2.5, '#25282e');

      // Lantern with flicker glow
      const lx = 388;
      const ly = P.y - 8;
      const flick = 0.85 + Math.sin(t * 9) * 0.05 + Math.sin(t * 23) * 0.04;
      const glow = ctx.createRadialGradient(lx, ly, 2, lx, ly, 70);
      glow.addColorStop(0, 'rgba(255,200,100,' + (0.35 * flick).toFixed(3) + ')');
      glow.addColorStop(1, 'rgba(255,180,80,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(lx - 70, ly - 70, 140, 140);
      ctx.strokeStyle = '#25282e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx, P.y - 24);
      ctx.lineTo(lx, ly - 9);
      ctx.stroke();
      ctx.fillStyle = '#25282e';
      ctx.fillRect(lx - 7, ly - 10, 14, 4);
      ctx.fillRect(lx - 7, ly + 8, 14, 4);
      ctx.fillStyle = 'rgba(255,214,120,' + flick.toFixed(3) + ')';
      ctx.fillRect(lx - 5, ly - 6, 10, 14);
    }

    drawObjects(ctx, session) {
      const objs = session.objects;
      const t = this.time;
      for (let i = 0; i < objs.length; i++) {
        const o = objs[i];
        if (!o.alive) continue;
        if (o.kind === 'critter') {
          ctx.save();
          ctx.translate(o.x, o.y);
          GR.Sprites.painters.crab(ctx, o, t);
          ctx.restore();
        } else if (o.rolling) {
          // Rolling boulder: spins with distance travelled (the only rotated blit).
          const spr = GR.Sprites.get(o, true);
          ctx.save();
          ctx.translate(o.x, o.y);
          ctx.rotate(o.x / o.r);
          ctx.drawImage(spr.canvas, -spr.size / 2, -spr.size / 2, spr.size, spr.size);
          ctx.restore();
        } else {
          const spr = GR.Sprites.get(o);
          ctx.drawImage(spr.canvas, o.x - spr.size / 2, o.y - spr.size / 2, spr.size, spr.size);
          if (o.kind === 'tnt') {
            const fl = 4 + Math.random() * 4;
            GR.Sprites.star(ctx, o.x + o.r * 0.42, o.y - o.r * 1.2, fl, Math.random() < 0.5 ? '#ffd23f' : '#ff7a2a');
          } else if (o.kind === 'gem' && Math.sin(t * 2 + o.uid * 1.7) > 0.93) {
            GR.Sprites.star(ctx, o.x + o.r * 0.3, o.y - o.r * 0.5, 7, '#ffffff');
          }
        }
        if (o.magnetized > 0) {
          o.magnetized -= 1 / 60;
          ctx.strokeStyle = 'rgba(90,180,255,0.8)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(o.x, o.y, o.r + 6, 0, TAU);
          ctx.stroke();
        }
      }
    }

    drawHeld(ctx, claw) {
      const o = claw.grabbed;
      const sway = Math.sin(this.time * 7) * 0.06 * Math.min(1, o.weight / 4);
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(-claw.angle * 0.8 + sway);
      if (o.kind === 'critter') GR.Sprites.painters.crab(ctx, o, this.time);
      else {
        const spr = GR.Sprites.get(o);
        ctx.drawImage(spr.canvas, -spr.size / 2, -spr.size / 2, spr.size, spr.size);
      }
      ctx.restore();
    }

    drawCable(ctx, claw) {
      const skin = this.claw;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(P.x, P.y);
      ctx.lineTo(claw.x, claw.y);
      ctx.stroke();
      ctx.strokeStyle = skin.cable;
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.save();
      ctx.translate(claw.x, claw.y);
      ctx.rotate(-claw.angle);
      if (claw.debris) {
        GR.Sprites.circle(ctx, -6, 24, 5, '#3a2a1a');
        GR.Sprites.circle(ctx, 5, 26, 4, '#5a3a1f');
      }
      ctx.scale(1.2, 1.2);
      GR.Sprites.drawClaw(ctx, skin, claw.grip);
      ctx.restore();
    }

    drawAimGuide(ctx, claw) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,230,160,0.35)';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 12]);
      ctx.lineDashOffset = -this.time * 40;
      ctx.beginPath();
      ctx.moveTo(claw.x + claw.dx * 30, claw.y + claw.dy * 30);
      ctx.lineTo(P.x + claw.dx * 1100, P.y + claw.dy * 1100);
      ctx.stroke();
      ctx.restore();
    }

    /** Magnet field rings around the claw. Screen tints are a CSS layer (HUD). */
    drawBoosterFx(ctx, session) {
      if (session.boosters.magnet <= 0 || session.claw.state !== 'extend') return;
      ctx.strokeStyle = 'rgba(90,180,255,0.5)';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        const r = 40 + ((this.time * 120 + i * 33) % 100);
        ctx.globalAlpha = 1 - (r - 40) / 100;
        ctx.beginPath();
        ctx.arc(session.claw.x, session.claw.y, r, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // ---- Shop previews ------------------------------------------------------

    static previewTheme(canvas, theme) {
      const ctx = canvas.getContext('2d');
      const k = canvas.width / W;
      ctx.setTransform(k, 0, 0, k, 0, -(G - 120) * k);
      Renderer.paintScene(ctx, theme, G - 120);
      const sample = [
        { type: 'large_gold', x: 200, y: G + 170, r: 40, variant: 1, rot: 0 },
        { type: 'diamond', x: 470, y: G + 120, r: 17, variant: 0, rot: 0 },
        { type: 'small_rock', x: 560, y: G + 230, r: 27, variant: 2, rot: 0 },
      ];
      sample.forEach((o) => {
        ctx.save();
        ctx.translate(o.x, o.y);
        GR.Sprites.painters[GR.OBJECTS[o.type].sprite](ctx, o.r, o.variant, false);
        ctx.restore();
      });
    }

    static previewClaw(canvas, skin) {
      const ctx = canvas.getContext('2d');
      const k = canvas.width / 80;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.clearRect(0, 0, 80, 80);
      ctx.strokeStyle = skin.cable;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(40, 0);
      ctx.lineTo(40, 26);
      ctx.stroke();
      ctx.translate(40, 30);
      ctx.scale(1.25, 1.25);
      GR.Sprites.drawClaw(ctx, skin, 0.25);
    }
  }

  Renderer.FONT = FONT;
  GR.Renderer = Renderer;
})((window.GR = window.GR || {}));
