/**
 * Nugget — the mascot. A little white Chihuahua with a black head mask, a
 * white blaze down the forehead, tan eyebrow dots, big upright ears, a black
 * patch on the back and a curled tail. He sits by the rig, watches the claw
 * and reacts to what happens (drawn live with canvas paths, no image files).
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
    rim: '#5e5146',
    tan: '#c9a06a',
    earIn: '#e3a99b',
    nose: '#151110',
    eye: '#21140d',
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
      this.scale = 1.32;
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

    draw(ctx) {
      const p = this.pose();
      const s = this.scale;
      ctx.save();
      ctx.translate(this.x + (p.shake ? (Math.random() - 0.5) * p.shake * 2 : 0), this.y);

      // Warm helmet-lamp glow so his dark mask reads against the night sky.
      const glow = ctx.createRadialGradient(4 * s, -46 * s, 4, 4 * s, -46 * s, 46 * s);
      glow.addColorStop(0, 'rgba(255,214,140,0.28)');
      glow.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(-46 * s, -96 * s, 100 * s, 100 * s);

      // Ground shadow shrinks while he is in the air.
      const air = Math.min(1, p.hop / 16);
      ctx.fillStyle = 'rgba(0,0,0,' + (0.35 - air * 0.18).toFixed(3) + ')';
      ctx.beginPath();
      ctx.ellipse(0, -1, 21 * s * (1 - air * 0.3), 4 * s, 0, 0, TAU);
      ctx.fill();

      ctx.scale(s, s);
      ctx.translate(0, -p.hop + p.crouch);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = C.outline;

      this.drawTail(ctx, p);
      this.drawBody(ctx, p);
      ctx.save();
      ctx.translate(6, -44 + p.headDrop);
      ctx.rotate(p.tilt + this.look * 0.08);
      this.drawHead(ctx, p);
      ctx.restore();

      if (p.sparkle) {
        const k = (this.t * 3) % 1;
        GR.Sprites.star(ctx, 26, -70 - k * 10, 4 * (1 - k) + 1, '#ffffff');
        GR.Sprites.star(ctx, -16, -62 - k * 6, 3 * (1 - k) + 1, '#ffe08a');
      }
      ctx.restore();
    }

    drawTail(ctx, p) {
      ctx.save();
      ctx.translate(-17, -17);
      ctx.rotate(-0.35 + p.tail);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-9, -10, -5, -22);
      ctx.quadraticCurveTo(-2, -28, 3, -24);
      ctx.lineWidth = 7;
      ctx.strokeStyle = C.outline;
      ctx.stroke();
      ctx.lineWidth = 4.4;
      ctx.strokeStyle = C.white;
      ctx.stroke();
      ctx.restore();
    }

    drawBody(ctx) {
      const ellipse = (x, y, rx, ry, rot, fill) => {
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.stroke();
      };
      // hind haunch + paw
      ellipse(-11, -11, 11, 9.5, 0, C.white);
      ellipse(-3, -1.5, 6, 2.6, 0, C.white);
      // body
      ctx.beginPath();
      ctx.ellipse(-3, -20, 16, 13.5, -0.35, 0, TAU);
      ctx.fillStyle = C.white;
      ctx.fill();
      ctx.stroke();
      // black patch on the back + a few specks (clipped to the body)
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(-3, -20, 16, 13.5, -0.35, 0, TAU);
      ctx.clip();
      ctx.fillStyle = C.black;
      ctx.beginPath();
      ctx.ellipse(-12, -29, 8, 6.5, -0.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(40,35,30,0.45)';
      [[-4, -15], [2, -22], [-8, -12]].forEach((d) => {
        ctx.beginPath();
        ctx.arc(d[0], d[1], 0.9, 0, TAU);
        ctx.fill();
      });
      ctx.fillStyle = C.shade;
      ctx.beginPath();
      ctx.ellipse(-6, -10, 12, 4, -0.2, 0, TAU);
      ctx.fill();
      ctx.restore();
      // front legs (far one slightly shaded) + paws
      [[4, C.shade], [9, C.white]].forEach((leg) => {
        ctx.beginPath();
        ctx.moveTo(leg[0] - 2.4, -22);
        ctx.lineTo(leg[0] - 2.2, -1.5);
        ctx.lineTo(leg[0] + 2.6, -1.5);
        ctx.lineTo(leg[0] + 2.4, -22);
        ctx.closePath();
        ctx.fillStyle = leg[1];
        ctx.fill();
        ctx.stroke();
        ellipse(leg[0] + 0.8, -1.5, 3.4, 1.8, 0, leg[1]);
      });
      // chest
      ellipse(5, -27, 8, 9.5, 0.15, C.white);
    }

    drawHead(ctx, p) {
      // Ears: big upright triangles (fold back when scared or sad).
      [-1, 1].forEach((side) => {
        ctx.save();
        ctx.translate(side * 7, -6);
        ctx.rotate(side * (0.32 + p.ears * 0.9));
        ctx.beginPath();
        ctx.moveTo(-5.5, 2);
        ctx.quadraticCurveTo(-3, -16, side * 1.5, -22);
        ctx.quadraticCurveTo(5, -12, 6, 3);
        ctx.closePath();
        ctx.fillStyle = C.black;
        ctx.fill();
        ctx.strokeStyle = C.rim;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-2.8, 0);
        ctx.quadraticCurveTo(-1.4, -11, side * 1.2, -16);
        ctx.quadraticCurveTo(3, -9, 3.4, 1);
        ctx.closePath();
        ctx.fillStyle = C.earIn;
        ctx.fill();
        ctx.restore();
      });

      // Head shape with the black mask
      ctx.beginPath();
      ctx.ellipse(0, 0, 13.5, 11.5, 0, 0, TAU);
      ctx.fillStyle = C.black;
      ctx.fill();
      ctx.strokeStyle = C.rim;
      ctx.stroke();
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, 13.5, 11.5, 0, 0, TAU);
      ctx.clip();
      // white blaze down the middle of the forehead
      ctx.fillStyle = C.white;
      ctx.beginPath();
      ctx.moveTo(-1.6, -12);
      ctx.lineTo(1.6, -12);
      ctx.lineTo(3.6, 2);
      ctx.lineTo(-3.6, 2);
      ctx.closePath();
      ctx.fill();
      // white cheeks / chin
      ctx.beginPath();
      ctx.ellipse(0, 8.5, 10, 6, 0, 0, TAU);
      ctx.fill();
      ctx.restore();

      // muzzle + nose
      ctx.beginPath();
      ctx.ellipse(0, 4.5, 6.6, 5, 0, 0, TAU);
      ctx.fillStyle = C.white;
      ctx.fill();
      ctx.strokeStyle = C.outline;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = C.nose;
      ctx.beginPath();
      ctx.ellipse(0, 2, 2.8, 2, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(-0.8, 1.4, 0.7, 0, TAU);
      ctx.fill();

      // mouth
      ctx.strokeStyle = C.outline;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (p.mouth === 'open') {
        ctx.moveTo(-2.6, 5.6);
        ctx.quadraticCurveTo(0, 9.6, 2.6, 5.6);
        ctx.closePath();
        ctx.fillStyle = C.tongue;
        ctx.fill();
        ctx.stroke();
      } else if (p.mouth === 'sad') {
        ctx.moveTo(-2.2, 7.4);
        ctx.quadraticCurveTo(0, 5.6, 2.2, 7.4);
        ctx.stroke();
      } else {
        ctx.moveTo(0, 4);
        ctx.lineTo(0, 5.6);
        ctx.moveTo(-2.2, 6.4);
        ctx.quadraticCurveTo(0, 7.2, 0, 5.6);
        ctx.quadraticCurveTo(0, 7.2, 2.2, 6.4);
        ctx.stroke();
      }

      // tan eyebrow dots + big eyes (they glance towards the claw)
      const lx = this.look * 1.1;
      [-1, 1].forEach((side) => {
        const ex = side * 6;
        ctx.fillStyle = C.tan;
        ctx.beginPath();
        ctx.ellipse(ex, -6.6, 1.9, 1.4, 0, 0, TAU);
        ctx.fill();
        const open = this.blink > 0 ? 0.15 : p.mouth === 'sad' ? 0.75 : 1;
        ctx.fillStyle = C.eye;
        ctx.beginPath();
        ctx.ellipse(ex + lx * 0.4, -1.6, 3.3, 3.5 * open, 0, 0, TAU);
        ctx.fill();
        if (open > 0.5) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(ex + lx - 1, -2.8, 1.1, 0, TAU);
          ctx.fill();
        }
      });

      // Little miner's helmet with a lamp, perched between the ears
      ctx.save();
      ctx.translate(0, -10.5);
      ctx.fillStyle = C.helmet;
      ctx.strokeStyle = C.outline;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.ellipse(0, 0, 7.5, 5.5, 0, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.helmetDark;
      ctx.fillRect(-9, -0.6, 18, 2.2);
      ctx.strokeRect(-9, -0.6, 18, 2.2);
      ctx.fillStyle = '#fff4c2';
      ctx.beginPath();
      ctx.arc(0, -3, 2, 0, TAU);
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
