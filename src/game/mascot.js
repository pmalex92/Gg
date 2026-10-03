/**
 * Nugget — the mascot. A little white Chihuahua with a black head mask, a
 * white blaze down the forehead, tan eyebrow dots, big upright ears, a black
 * patch on the back and a curled tail, in a chibi cartoon style (big head,
 * big shiny eyes). He sits by the rig, watches the claw and reacts to what
 * happens. Drawn live with canvas paths, no image files.
 *
 *   mascot.react('happy' | 'excited' | 'scared' | 'meh')   one-shot reaction
 *   mascot.setMood('idle' | 'cheer' | 'sad')                 lasting mood
 */
(function (GR) {
  'use strict';

  const TAU = Math.PI * 2;
  const C = {
    white: '#f7f3ec',
    shade: '#ddd5c9',
    black: '#1d1916',
    line: '#c9bfb2',
    eyeRim: '#6b5444',
    tan: '#c9a06a',
    earIn: '#e3a99b',
    nose: '#151110',
    eye: '#140c08',
    tongue: '#ef7f8e',
    helmet: '#ffc531',
    helmetDark: '#b37a0e',
    outline: '#2a2018',
  };
  const REACTIONS = { happy: 0.8, excited: 1.2, scared: 1.0, meh: 0.7 };

  class Mascot {
    constructor(x, y) {
      this.x = x;
      this.y = y; // ground level under his paws
      this.scale = 1.12;
      this.t = 0;
      this.mood = 'idle';
      this.anim = null;
      this.blinkIn = 2.5;
      this.blink = 0;
      this.look = 0;
      this.reduced = false;
    }

    react(type) {
      if (!REACTIONS[type]) return;
      // A scare or a big find always wins over a small reaction already playing.
      if (this.anim && this.anim.t < this.anim.dur * 0.5 && rank(this.anim.type) > rank(type)) return;
      this.anim = { type, t: 0, dur: REACTIONS[type] };
    }

    setMood(mood) {
      this.mood = mood;
      this.anim = null;
    }

    update(dt, claw) {
      this.t += dt;
      if (this.anim) {
        this.anim.t += dt;
        if (this.anim.t >= this.anim.dur) this.anim = null;
      }
      this.blinkIn -= dt;
      if (this.blinkIn <= 0) {
        this.blink = 0.14;
        this.blinkIn = 2.2 + Math.random() * 3;
      }
      this.blink = Math.max(0, this.blink - dt);
      // Head follows the claw a little.
      const target = claw ? GR.util.clamp((claw.x - this.x) / 300, -1, 1) : 0;
      this.look += (target - this.look) * GR.util.damp(5, dt);
    }

    /** Current pose from mood + active reaction. */
    pose() {
      const t = this.t;
      const p = {
        hop: 0, crouch: 0, shake: 0, ears: 0, headDrop: 0, tilt: 0,
        tail: Math.sin(t * 3) * 0.22, mouth: 'closed', sparkle: false,
      };
      // Idle breathing
      p.crouch = Math.sin(t * 2.2) * 0.6;
      if (this.mood === 'cheer') {
        p.hop = Math.abs(Math.sin(t * 4.5)) * 12;
        p.tail = Math.sin(t * 20) * 0.5;
        p.mouth = 'open';
      } else if (this.mood === 'sad') {
        p.ears = 0.65;
        p.headDrop = 3;
        p.tail = -0.5;
        p.mouth = 'sad';
      }
      const a = this.anim;
      if (a) {
        const k = a.t / a.dur;
        switch (a.type) {
          case 'happy':
            p.hop = Math.sin(Math.min(1, k * 1.6) * Math.PI) * 9;
            p.tail = Math.sin(t * 22) * 0.55;
            p.mouth = 'open';
            break;
          case 'excited':
            p.hop = Math.abs(Math.sin(k * Math.PI * 2)) * 16 * (1 - k * 0.4);
            p.tail = Math.sin(t * 26) * 0.6;
            p.mouth = 'open';
            p.sparkle = true;
            p.tilt = Math.sin(k * Math.PI * 2) * 0.12;
            break;
          case 'scared':
            p.crouch = 6 * (1 - k * 0.5);
            p.shake = (1 - k) * 1.8;
            p.ears = 1;
            p.tail = -0.7;
            break;
          case 'meh':
            p.tilt = Math.sin(Math.min(1, k * 2) * Math.PI) * 0.22;
            p.ears = 0.35;
            break;
          default:
            break;
        }
      }
      if (this.reduced) {
        p.hop *= 0.35;
        p.shake = 0;
      }
      return p;
    }

    /**
     * Cartoon "sticker" rendering: every body part is first stroked with a
     * thick outline, then all parts are filled on top. The inner seams vanish,
     * so Nugget reads as one soft, continuous shape with a single outline.
     */
    draw(ctx) {
      const p = this.pose();
      const s = this.scale;
      ctx.save();
      ctx.translate(this.x + (p.shake ? (Math.random() - 0.5) * p.shake * 2 : 0), this.y);

      // Warm helmet-lamp glow so the dark mask reads against the night sky.
      const glow = ctx.createRadialGradient(0, -48 * s, 4, 0, -48 * s, 50 * s);
      glow.addColorStop(0, 'rgba(255,214,140,0.3)');
      glow.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(-50 * s, -100 * s, 100 * s, 104 * s);

      // Ground shadow shrinks while he is in the air.
      const air = Math.min(1, p.hop / 16);
      ctx.fillStyle = 'rgba(0,0,0,' + (0.32 - air * 0.16).toFixed(3) + ')';
      ctx.beginPath();
      ctx.ellipse(0, -1, 20 * s * (1 - air * 0.3), 4 * s, 0, 0, TAU);
      ctx.fill();

      // Squash & stretch: stretch while rising, squash when crouching/landing.
      const stretch = 1 + Math.min(0.1, p.hop * 0.006) - Math.max(0, p.crouch) * 0.012;
      ctx.scale(s / Math.sqrt(stretch), s * stretch);
      ctx.translate(0, -p.hop / stretch + Math.max(0, p.crouch) * 0.6);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      const head = { x: 0, y: -45 + p.headDrop, rot: p.tilt + this.look * 0.07 };
      const parts = this.parts(p, head);

      // Pass 1: one thick outline behind everything.
      ctx.strokeStyle = C.outline;
      parts.forEach((part) => {
        ctx.save();
        if (part.tf) part.tf(ctx);
        part.path(ctx);
        ctx.lineWidth = part.line || 5;
        ctx.stroke();
        ctx.restore();
      });
      // Pass 2: fills on top, so the parts merge into one shape.
      parts.forEach((part) => {
        ctx.save();
        if (part.tf) part.tf(ctx);
        part.path(ctx);
        ctx.fillStyle = part.fill;
        ctx.fill();
        if (part.detail) part.detail(ctx);
        ctx.restore();
      });

      ctx.save();
      ctx.translate(head.x, head.y);
      ctx.rotate(head.rot);
      this.drawFace(ctx, p);
      ctx.restore();

      if (p.sparkle) {
        const k = (this.t * 3) % 1;
        GR.Sprites.star(ctx, 24, -74 - k * 10, 4.5 * (1 - k) + 1, '#ffffff');
        GR.Sprites.star(ctx, -24, -66 - k * 6, 3.5 * (1 - k) + 1, '#ffe08a');
      }
      ctx.restore();
    }

    /** Silhouette parts, back to front. Each: path, fill, optional transform/detail. */
    parts(p, head) {
      const ell = (x, y, rx, ry, rot) => (ctx) => {
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
      };
      const headTf = (ctx) => {
        ctx.translate(head.x, head.y);
        ctx.rotate(head.rot);
      };
      const ear = (side) => ({
        tf: (ctx) => {
          headTf(ctx);
          ctx.translate(side * 11, -9);
          ctx.rotate(side * (0.38 + p.ears * 0.95 + Math.min(0.15, p.hop * 0.01)));
        },
        path: (ctx) => {
          ctx.beginPath();
          ctx.moveTo(-7.5, 4);
          ctx.bezierCurveTo(-8, -10, -3, -22, side * 1, -25);
          ctx.bezierCurveTo(5, -21, 8.5, -9, 7.5, 4);
          ctx.closePath();
        },
        fill: C.black,
        detail: (ctx) => {
          ctx.beginPath();
          ctx.moveTo(-4, 2);
          ctx.bezierCurveTo(-4.5, -8, -1.5, -16, side * 0.8, -18.5);
          ctx.bezierCurveTo(3, -15, 4.8, -7, 4, 2);
          ctx.closePath();
          ctx.fillStyle = C.earIn;
          ctx.fill();
        },
      });
      return [
        {
          // curled tail, wagging from its base
          tf: (ctx) => {
            ctx.translate(11, -12);
            ctx.rotate(0.2 + p.tail);
          },
          path: (ctx) => {
            ctx.beginPath();
            ctx.moveTo(-2, 2);
            ctx.bezierCurveTo(8, 2, 14, -8, 11, -16);
            ctx.bezierCurveTo(9, -21, 3, -20, 4, -15);
            ctx.bezierCurveTo(6, -12, 9, -14, 8, -10);
            ctx.bezierCurveTo(5, -4, 0, -4, -3, -4);
            ctx.closePath();
          },
          fill: C.white,
        },
        { path: ell(-11, -7, 7.5, 6.5), fill: C.white }, // hind legs peeking out
        { path: ell(11, -7, 7.5, 6.5), fill: C.white },
        {
          // round little body
          path: ell(0, -17, 14.5, 15),
          fill: C.white,
          detail: (ctx) => {
            ctx.save();
            ell(0, -17, 14.5, 15)(ctx);
            ctx.clip();
            // black patch on his side/back + a couple of freckles
            ctx.fillStyle = C.black;
            ctx.beginPath();
            ctx.ellipse(-11, -20, 7, 6, -0.5, 0, TAU);
            ctx.fill();
            ctx.fillStyle = 'rgba(60,50,44,0.45)';
            [[5, -12], [8, -18], [-3, -8]].forEach((d) => {
              ctx.beginPath();
              ctx.arc(d[0], d[1], 0.9, 0, TAU);
              ctx.fill();
            });
            // soft shading along the right side
            ctx.fillStyle = 'rgba(120,100,80,0.12)';
            ctx.beginPath();
            ctx.ellipse(13, -13, 6, 14, 0.2, 0, TAU);
            ctx.fill();
            ctx.restore();
          },
        },
        {
          // front paws
          path: (ctx) => {
            ctx.beginPath();
            ctx.ellipse(-5.5, -2.5, 4.8, 3.6, 0, 0, TAU);
            ctx.moveTo(10.3, -2.5);
            ctx.ellipse(5.5, -2.5, 4.8, 3.6, 0, 0, TAU);
          },
          fill: C.white,
          line: 4,
          detail: (ctx) => {
            ctx.strokeStyle = C.line;
            ctx.lineWidth = 1;
            [-5.5, 5.5].forEach((x) => {
              ctx.beginPath();
              ctx.moveTo(x - 1.2, -1.4);
              ctx.lineTo(x - 1.2, 0.2);
              ctx.moveTo(x + 1.2, -1.4);
              ctx.lineTo(x + 1.2, 0.2);
              ctx.stroke();
            });
          },
        },
        ear(-1),
        ear(1),
        {
          // big apple-shaped head with the black mask, white blaze and cheeks
          tf: headTf,
          path: (ctx) => {
            ctx.beginPath();
            ctx.moveTo(0, -16);
            ctx.bezierCurveTo(13, -16, 19.5, -8, 19.5, 1);
            ctx.bezierCurveTo(19.5, 10, 11, 14.5, 0, 14.5);
            ctx.bezierCurveTo(-11, 14.5, -19.5, 10, -19.5, 1);
            ctx.bezierCurveTo(-19.5, -8, -13, -16, 0, -16);
            ctx.closePath();
          },
          fill: C.white,
          detail: (ctx) => {
            ctx.save();
            ctx.clip();
            ctx.fillStyle = C.black;
            // mask: dark around the eyes and over the top, white blaze between
            [-1, 1].forEach((side) => {
              ctx.beginPath();
              ctx.moveTo(side * 2.5, -17);
              ctx.bezierCurveTo(side * 12, -18, side * 22, -10, side * 21, 3);
              ctx.bezierCurveTo(side * 18, 6, side * 11, 5, side * 6.5, 2);
              ctx.bezierCurveTo(side * 3.5, -2, side * 3, -9, side * 2.5, -17);
              ctx.closePath();
              ctx.fill();
            });
            ctx.restore();
          },
        },
      ];
    }

    /** Eyes, nose, mouth, blush and the little helmet (drawn in head space). */
    drawFace(ctx, p) {
      // tan eyebrow dots
      ctx.fillStyle = C.tan;
      [-1, 1].forEach((side) => {
        ctx.beginPath();
        ctx.ellipse(side * 9.5, -7.5, 2.2, 1.6, side * -0.2, 0, TAU);
        ctx.fill();
      });

      // big shiny cartoon eyes that glance towards the claw
      const lx = this.look * 1.3;
      const open = this.blink > 0 ? 0 : p.mouth === 'sad' ? 0.78 : 1;
      [-1, 1].forEach((side) => {
        const ex = side * 9.5;
        if (open === 0) {
          ctx.strokeStyle = C.eyeRim;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(ex, 0, 4, 0.15 * Math.PI, 0.85 * Math.PI);
          ctx.stroke();
          return;
        }
        ctx.fillStyle = C.eyeRim;
        ctx.beginPath();
        ctx.ellipse(ex, 0.5, 6, 6.6 * open, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = C.eye;
        ctx.beginPath();
        ctx.ellipse(ex + lx * 0.4, 0.8, 5, 5.6 * open, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(ex + lx - 1.6, -1.6 * open, 2.1, 2.4 * open, 0, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex + lx + 1.8, 2.8 * open, 0.9, 0, TAU);
        ctx.fill();
      });

      // rosy cheeks
      ctx.fillStyle = 'rgba(255,140,150,0.45)';
      [-1, 1].forEach((side) => {
        ctx.beginPath();
        ctx.ellipse(side * 12.5, 8, 3.4, 2, 0, 0, TAU);
        ctx.fill();
      });

      // tiny button nose
      ctx.fillStyle = C.nose;
      ctx.beginPath();
      ctx.moveTo(-3, 4.6);
      ctx.quadraticCurveTo(0, 3.2, 3, 4.6);
      ctx.quadraticCurveTo(2.6, 7.6, 0, 8);
      ctx.quadraticCurveTo(-2.6, 7.6, -3, 4.6);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.ellipse(-1, 4.9, 1, 0.6, 0, 0, TAU);
      ctx.fill();

      // mouth: little "w" smile, open with tongue when happy, wobbly when sad
      ctx.strokeStyle = C.outline;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      if (p.mouth === 'open') {
        ctx.moveTo(-3.6, 9.4);
        ctx.quadraticCurveTo(0, 15.5, 3.6, 9.4);
        ctx.closePath();
        ctx.fillStyle = '#7a2a2a';
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = C.tongue;
        ctx.beginPath();
        ctx.ellipse(0, 12.3, 2, 1.7, 0, 0, TAU);
        ctx.fill();
      } else if (p.mouth === 'sad') {
        ctx.moveTo(-2.6, 11);
        ctx.quadraticCurveTo(0, 9, 2.6, 11);
        ctx.stroke();
      } else {
        ctx.moveTo(-3.4, 9.2);
        ctx.quadraticCurveTo(-1.7, 11.2, 0, 9.4);
        ctx.quadraticCurveTo(1.7, 11.2, 3.4, 9.2);
        ctx.stroke();
      }

      // little miner's helmet, slightly tilted, with a glowing lamp
      ctx.save();
      ctx.translate(1, -15.5);
      ctx.rotate(-0.12);
      ctx.strokeStyle = C.outline;
      ctx.lineWidth = 1.4;
      ctx.fillStyle = C.helmetDark;
      ctx.beginPath();
      ctx.ellipse(0, 0.8, 12.5, 2.4, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.helmet;
      ctx.beginPath();
      ctx.ellipse(0, 0, 10.5, 9, 0, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.ellipse(-4.5, -5, 3, 1.4, -0.6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff4c2';
      ctx.beginPath();
      ctx.arc(1, -4.6, 2.4, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function rank(type) {
    return { meh: 0, happy: 1, excited: 2, scared: 3 }[type] || 0;
  }

  GR.Mascot = Mascot;
})((window.GR = window.GR || {}));
