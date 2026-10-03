/**
 * Procedural art. All visuals are drawn with canvas paths (no image files),
 * then cached into offscreen canvases at the current screen resolution so
 * gameplay frames are mostly cheap drawImage() calls.
 *
 * Painters draw centred on (0, 0) in world units. Silhouettes are distinct on
 * purpose (round nugget, ingot, kite-shaped diamond, octagonal ruby, angular
 * rock, sack, barrel, chalice) so objects never rely on colour alone.
 */
(function (GR) {
  'use strict';

  const TAU = Math.PI * 2;
  const GLYPH_FONT = '900 {px}px "Lilita One", "Arial Black", Impact, sans-serif';

  function blobPath(ctx, pts) {
    const n = pts.length;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const p = pts[i % n];
      const q = pts[(i + 1) % n];
      const mx = (p[0] + q[0]) / 2;
      const my = (p[1] + q[1]) / 2;
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.quadraticCurveTo(p[0], p[1], mx, my);
    }
    ctx.closePath();
  }

  function polyPath(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  function shadow(ctx, r, yOff, alpha) {
    ctx.fillStyle = 'rgba(0,0,0,' + (alpha || 0.32) + ')';
    ctx.beginPath();
    ctx.ellipse(r * 0.08, yOff, r * 0.92, r * 0.26, 0, 0, TAU);
    ctx.fill();
  }

  function circle(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  // ---- Object painters -------------------------------------------------------

  function nugget(ctx, r, variant) {
    const rng = new GR.RNG(variant * 7919 + 101);
    const pts = [];
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rng.range(-0.12, 0.12);
      const rad = r * rng.range(0.8, 1);
      pts.push([Math.cos(a) * rad, Math.sin(a) * rad * 0.86]);
    }
    shadow(ctx, r, r * 0.74);
    blobPath(ctx, pts);
    ctx.fillStyle = '#f2b52c';
    ctx.fill();
    ctx.save();
    blobPath(ctx, pts);
    ctx.clip();
    circle(ctx, r * 0.42, r * 0.5, r * 0.95, '#c98613');
    circle(ctx, -r * 0.22, -r * 0.26, r * 0.55, '#ffd458');
    circle(ctx, -r * 0.32, -r * 0.36, r * 0.24, '#ffe999');
    for (let i = 0; i < 4; i++) {
      ctx.globalAlpha = 0.55;
      circle(ctx, rng.range(-0.5, 0.6) * r, rng.range(-0.2, 0.6) * r, r * rng.range(0.07, 0.13), '#a86a0a');
    }
    ctx.globalAlpha = 1;
    circle(ctx, -r * 0.42, -r * 0.42, Math.max(1.2, r * 0.09), '#fffbe6');
    circle(ctx, r * 0.2, -r * 0.5, Math.max(1, r * 0.05), '#fffbe6');
    ctx.restore();
    blobPath(ctx, pts);
    ctx.lineWidth = Math.max(2, r * 0.08);
    ctx.strokeStyle = '#6e4205';
    ctx.stroke();
  }

  function bar(ctx, r) {
    const w = r * 1.95;
    const h = r * 1.15;
    shadow(ctx, r, h * 0.5, 0.35);
    const top = [[-w * 0.34, -h * 0.5], [w * 0.34, -h * 0.5], [w * 0.5, -h * 0.02], [-w * 0.5, -h * 0.02]];
    const front = [[-w * 0.5, -h * 0.02], [w * 0.5, -h * 0.02], [w * 0.5, h * 0.42], [-w * 0.5, h * 0.42]];
    polyPath(ctx, front);
    ctx.fillStyle = '#e09b1b';
    ctx.fill();
    ctx.fillStyle = '#b97a0c';
    ctx.fillRect(w * 0.18, -h * 0.02, w * 0.32, h * 0.44);
    polyPath(ctx, top);
    ctx.fillStyle = '#ffd35a';
    ctx.fill();
    // inset stamp + shine
    ctx.save();
    polyPath(ctx, top);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,248,214,0.75)';
    ctx.beginPath();
    ctx.moveTo(-w * 0.2, -h * 0.5);
    ctx.lineTo(-w * 0.06, -h * 0.5);
    ctx.lineTo(-w * 0.26, 0);
    ctx.lineTo(-w * 0.4, 0);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(150,95,10,0.8)';
    ctx.lineWidth = Math.max(1.5, r * 0.05);
    ctx.strokeRect(w * 0.0, -h * 0.38, w * 0.22, h * 0.24);
    ctx.lineWidth = Math.max(2, r * 0.07);
    ctx.strokeStyle = '#6e4205';
    ctx.beginPath();
    ctx.moveTo(-w * 0.34, -h * 0.5);
    ctx.lineTo(w * 0.34, -h * 0.5);
    ctx.lineTo(w * 0.5, -h * 0.02);
    ctx.lineTo(w * 0.5, h * 0.42);
    ctx.lineTo(-w * 0.5, h * 0.42);
    ctx.lineTo(-w * 0.5, -h * 0.02);
    ctx.closePath();
    ctx.moveTo(-w * 0.5, -h * 0.02);
    ctx.lineTo(w * 0.5, -h * 0.02);
    ctx.stroke();
  }

  function diamond(ctx, r) {
    shadow(ctx, r, r * 1.02, 0.3);
    const g = [[-r, -0.18 * r], [-0.55 * r, -0.66 * r], [0.55 * r, -0.66 * r], [r, -0.18 * r], [0, r]];
    polyPath(ctx, g);
    ctx.fillStyle = '#9fe6fb';
    ctx.fill();
    // crown facets
    const facet = (pts, c) => {
      polyPath(ctx, pts);
      ctx.fillStyle = c;
      ctx.fill();
    };
    facet([[-r, -0.18 * r], [-0.55 * r, -0.66 * r], [-0.3 * r, -0.18 * r]], '#d9f7ff');
    facet([[-0.55 * r, -0.66 * r], [0, -0.66 * r], [-0.3 * r, -0.18 * r]], '#f4fdff');
    facet([[0, -0.66 * r], [0.3 * r, -0.18 * r], [-0.3 * r, -0.18 * r]], '#bdf0ff');
    facet([[0, -0.66 * r], [0.55 * r, -0.66 * r], [0.3 * r, -0.18 * r]], '#e3fbff');
    facet([[0.55 * r, -0.66 * r], [r, -0.18 * r], [0.3 * r, -0.18 * r]], '#8fdcf4');
    // pavilion facets
    facet([[-r, -0.18 * r], [-0.3 * r, -0.18 * r], [0, r]], '#7dd3f0');
    facet([[-0.3 * r, -0.18 * r], [0.3 * r, -0.18 * r], [0, r]], '#b4ecfc');
    facet([[0.3 * r, -0.18 * r], [r, -0.18 * r], [0, r]], '#56bde4');
    polyPath(ctx, g);
    ctx.lineWidth = Math.max(1.8, r * 0.1);
    ctx.strokeStyle = '#1d6a8f';
    ctx.stroke();
    star(ctx, -0.42 * r, -0.42 * r, r * 0.42, '#ffffff');
  }

  function ruby(ctx, r) {
    shadow(ctx, r, r * 0.98, 0.3);
    const outer = [];
    const inner = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + TAU / 16;
      outer.push([Math.cos(a) * r, Math.sin(a) * r]);
      inner.push([Math.cos(a) * r * 0.52, Math.sin(a) * r * 0.52]);
    }
    polyPath(ctx, outer);
    ctx.fillStyle = '#c4153d';
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      polyPath(ctx, [outer[i], outer[j], inner[j], inner[i]]);
      ctx.fillStyle = i % 2 ? '#e8294f' : i < 4 ? '#9c0d2f' : '#ff4a6e';
      ctx.fill();
    }
    polyPath(ctx, inner);
    ctx.fillStyle = '#ff6f8c';
    ctx.fill();
    polyPath(ctx, outer);
    ctx.lineWidth = Math.max(1.8, r * 0.1);
    ctx.strokeStyle = '#55001a';
    ctx.stroke();
    star(ctx, -0.3 * r, -0.35 * r, r * 0.4, '#ffffff');
  }

  function rockShape(r, variant, n) {
    const rng = new GR.RNG(variant * 104729 + n);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rng.range(-0.18, 0.18);
      const rad = r * rng.range(0.8, 1);
      pts.push([Math.cos(a) * rad, Math.sin(a) * rad * 0.84]);
    }
    return { pts, rng };
  }

  function rock(ctx, r, variant, big) {
    const { pts, rng } = rockShape(r, variant, big ? 9 : 7);
    shadow(ctx, r, r * 0.72, 0.38);
    polyPath(ctx, pts);
    ctx.fillStyle = big ? '#6b6f77' : '#848991';
    ctx.fill();
    ctx.save();
    polyPath(ctx, pts);
    ctx.clip();
    ctx.fillStyle = big ? '#4f5259' : '#62666d';
    ctx.beginPath();
    ctx.moveTo(-r, r * 0.25);
    ctx.lineTo(r, -r * 0.15);
    ctx.lineTo(r, r);
    ctx.lineTo(-r, r);
    ctx.fill();
    ctx.fillStyle = big ? '#868a92' : '#a2a7af';
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, -r * 0.7);
    ctx.lineTo(r * 0.15, -r * 0.8);
    ctx.lineTo(-r * 0.1, -r * 0.25);
    ctx.lineTo(-r * 0.75, -r * 0.05);
    ctx.fill();
    for (let i = 0; i < (big ? 9 : 5); i++) {
      ctx.globalAlpha = 0.35;
      circle(ctx, rng.range(-0.7, 0.7) * r, rng.range(-0.5, 0.6) * r, r * rng.range(0.03, 0.07), '#2f3237');
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.strokeStyle = '#2f3136';
    ctx.lineWidth = Math.max(2, r * (big ? 0.06 : 0.08));
    polyPath(ctx, pts);
    ctx.stroke();
    // cracks
    ctx.lineWidth = Math.max(1.4, r * 0.04);
    ctx.beginPath();
    ctx.moveTo(r * 0.1, -r * 0.5);
    ctx.lineTo(r * 0.25, -r * 0.1);
    ctx.lineTo(r * 0.12, r * 0.18);
    if (big) {
      ctx.moveTo(-r * 0.55, r * 0.15);
      ctx.lineTo(-r * 0.2, r * 0.32);
      ctx.lineTo(-r * 0.25, r * 0.55);
    }
    ctx.stroke();
  }

  function bag(ctx, r) {
    shadow(ctx, r, r * 0.9, 0.34);
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(-0.3 * r, -0.5 * r);
      ctx.bezierCurveTo(-1.05 * r, 0.0, -1.0 * r, 0.95 * r, 0, 0.92 * r);
      ctx.bezierCurveTo(1.0 * r, 0.95 * r, 1.05 * r, 0.0, 0.3 * r, -0.5 * r);
      ctx.closePath();
    };
    body();
    ctx.fillStyle = '#d4a86c';
    ctx.fill();
    ctx.save();
    ctx.clip();
    circle(ctx, 0.55 * r, 0.6 * r, 0.75 * r, '#b2864d');
    ctx.restore();
    body();
    ctx.lineWidth = Math.max(2, r * 0.08);
    ctx.strokeStyle = '#5a3b19';
    ctx.stroke();
    // flared top
    ctx.beginPath();
    ctx.moveTo(-0.32 * r, -0.52 * r);
    ctx.lineTo(-0.5 * r, -0.9 * r);
    ctx.lineTo(-0.2 * r, -0.74 * r);
    ctx.lineTo(0, -0.96 * r);
    ctx.lineTo(0.2 * r, -0.74 * r);
    ctx.lineTo(0.5 * r, -0.9 * r);
    ctx.lineTo(0.32 * r, -0.52 * r);
    ctx.closePath();
    ctx.fillStyle = '#d9b07a';
    ctx.fill();
    ctx.stroke();
    // rope
    ctx.fillStyle = '#7a4b22';
    ctx.fillRect(-0.4 * r, -0.6 * r, 0.8 * r, 0.16 * r);
    ctx.strokeRect(-0.4 * r, -0.6 * r, 0.8 * r, 0.16 * r);
    // question mark
    ctx.font = GLYPH_FONT.replace('{px}', Math.round(r * 1.15));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.strokeStyle = '#fff1d6';
    ctx.strokeText('?', 0, 0.3 * r);
    ctx.fillStyle = '#4a2e10';
    ctx.fillText('?', 0, 0.3 * r);
  }

  function tnt(ctx, r) {
    const w = r * 1.45;
    const h = r * 1.8;
    shadow(ctx, r, h * 0.5, 0.36);
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, -h * 0.42);
    ctx.quadraticCurveTo(-w * 0.62, 0, -w * 0.5, h * 0.42);
    ctx.quadraticCurveTo(0, h * 0.52, w * 0.5, h * 0.42);
    ctx.quadraticCurveTo(w * 0.62, 0, w * 0.5, -h * 0.42);
    ctx.quadraticCurveTo(0, -h * 0.52, -w * 0.5, -h * 0.42);
    ctx.closePath();
    ctx.fillStyle = '#d93a2b';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#a5241a';
    ctx.fillRect(w * 0.18, -h, w, h * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(-w * 0.38, -h, w * 0.12, h * 2);
    ctx.fillStyle = '#26221f';
    ctx.fillRect(-w, -h * 0.36, w * 2, h * 0.12);
    ctx.fillRect(-w, h * 0.26, w * 2, h * 0.12);
    ctx.restore();
    ctx.lineWidth = Math.max(2, r * 0.08);
    ctx.strokeStyle = '#4d0f0a';
    ctx.stroke();
    ctx.fillStyle = '#fff4e0';
    ctx.font = GLYPH_FONT.replace('{px}', Math.round(r * 0.62));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TNT', 0, h * 0.0);
    // fuse
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = Math.max(2, r * 0.09);
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.47);
    ctx.quadraticCurveTo(r * 0.1, -h * 0.72, r * 0.42, -h * 0.66);
    ctx.stroke();
  }

  function relic(ctx, r) {
    shadow(ctx, r, r * 1.0, 0.34);
    ctx.fillStyle = '#f5bf32';
    ctx.strokeStyle = '#6e4205';
    ctx.lineWidth = Math.max(2, r * 0.08);
    // base
    ctx.beginPath();
    ctx.ellipse(0, r * 0.82, r * 0.62, r * 0.2, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // stem
    ctx.beginPath();
    ctx.moveTo(-r * 0.14, r * 0.05);
    ctx.lineTo(-r * 0.2, r * 0.72);
    ctx.lineTo(r * 0.2, r * 0.72);
    ctx.lineTo(r * 0.14, r * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // cup
    const cup = () => {
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, -r * 0.72);
      ctx.quadraticCurveTo(-r * 0.9, r * 0.25, 0, r * 0.22);
      ctx.quadraticCurveTo(r * 0.9, r * 0.25, r * 0.9, -r * 0.72);
      ctx.closePath();
    };
    cup();
    ctx.fill();
    ctx.save();
    ctx.clip();
    circle(ctx, r * 0.55, r * 0.1, r * 0.7, '#c98613');
    ctx.fillStyle = 'rgba(255,240,180,0.8)';
    ctx.fillRect(-r * 0.66, -r * 0.7, r * 0.16, r * 0.8);
    ctx.restore();
    cup();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.72, r * 0.9, r * 0.18, 0, 0, TAU);
    ctx.fillStyle = '#ffe08a';
    ctx.fill();
    ctx.stroke();
    // gem
    ctx.save();
    ctx.translate(0, -r * 0.22);
    ruby(ctx, r * 0.26);
    ctx.restore();
  }

  function star(ctx, x, y, s, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.quadraticCurveTo(x, y, x + s, y);
    ctx.quadraticCurveTo(x, y, x, y + s);
    ctx.quadraticCurveTo(x, y, x - s, y);
    ctx.quadraticCurveTo(x, y, x, y - s);
    ctx.fill();
  }

  /** Cave crab — drawn live each frame because its legs animate. */
  function crab(ctx, o, t) {
    const r = o.r;
    const dir = o.vx >= 0 ? 1 : -1;
    const walk = o.held ? t * 22 : t * 14 + o.uid;
    shadow(ctx, r, r * 0.62, 0.3);
    ctx.strokeStyle = '#6e1f0e';
    ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.lineCap = 'round';
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 3; i++) {
        const ph = Math.sin(walk + i * 1.7 + (side > 0 ? 0 : Math.PI)) * 0.22;
        const bx = side * r * (0.35 + i * 0.18);
        ctx.beginPath();
        ctx.moveTo(bx, r * 0.1);
        ctx.lineTo(bx + side * r * 0.35, r * (0.25 + ph));
        ctx.lineTo(bx + side * r * 0.5, r * (0.62 + ph));
        ctx.stroke();
      }
    }
    // pincers
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.6, -r * 0.05);
      ctx.lineTo(side * r * 0.95, -r * 0.4);
      ctx.stroke();
      // Pac-man shaped pincer opening upwards, snapping as it walks.
      const cx = side * r * 1.0;
      const cy = -r * 0.52;
      const open = 0.3 + Math.abs(Math.sin(walk * 0.5)) * 0.35;
      const up = -Math.PI / 2;
      ctx.fillStyle = '#ef6a3e';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r * 0.28, up + open, up - open + TAU);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // body
    ctx.beginPath();
    ctx.ellipse(0, r * 0.05, r * 0.82, r * 0.55, 0, Math.PI, 0);
    ctx.quadraticCurveTo(r * 0.82, r * 0.4, 0, r * 0.4);
    ctx.quadraticCurveTo(-r * 0.82, r * 0.4, -r * 0.82, r * 0.05);
    ctx.fillStyle = '#e8572f';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff9168';
    ctx.beginPath();
    ctx.ellipse(-r * 0.15, -r * 0.18, r * 0.4, r * 0.16, -0.2, 0, TAU);
    ctx.fill();
    // eyes
    for (let side = -1; side <= 1; side += 2) {
      const ex = side * r * 0.28 + dir * r * 0.08;
      ctx.beginPath();
      ctx.moveTo(side * r * 0.22, -r * 0.4);
      ctx.lineTo(ex, -r * 0.72);
      ctx.stroke();
      circle(ctx, ex, -r * 0.78, r * 0.17, '#ffffff');
      circle(ctx, ex + dir * r * 0.06, -r * 0.78, r * 0.08, '#1a1a1a');
    }
    if (o.gem) {
      ctx.save();
      ctx.translate(dir * r * 0.95, -r * 0.92);
      diamond(ctx, r * 0.42);
      ctx.restore();
    }
  }

  /** A gem held above a critter (shared by every species). */
  function heldGem(ctx, o, x, y) {
    if (!o.gem) return;
    ctx.save();
    ctx.translate(x, y);
    diamond(ctx, o.r * 0.42);
    ctx.restore();
  }

  function outlined(ctx, fill, width) {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = width;
    ctx.stroke();
  }

  /** Frozen Caves: a waddling penguin. */
  function penguin(ctx, o, t) {
    const r = o.r;
    const dir = o.vx >= 0 ? 1 : -1;
    const walk = (o.held ? t * 20 : t * 9) + o.uid;
    shadow(ctx, r, r * 0.9, 0.3);
    ctx.save();
    ctx.rotate(Math.sin(walk) * 0.12);
    ctx.strokeStyle = '#0d1018';
    const lw = Math.max(1.6, r * 0.08);
    // feet
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.ellipse(side * r * 0.3, r * (0.88 - (Math.sin(walk) * side > 0 ? 0.06 : 0)), r * 0.24, r * 0.1, 0, 0, TAU);
      outlined(ctx, '#ff9f2a', lw * 0.8);
    });
    // body + white belly
    ctx.beginPath();
    ctx.ellipse(0, r * 0.05, r * 0.68, r * 0.88, 0, 0, TAU);
    outlined(ctx, '#232a3a', lw);
    ctx.beginPath();
    ctx.ellipse(dir * r * 0.06, r * 0.18, r * 0.44, r * 0.66, 0, 0, TAU);
    ctx.fillStyle = '#f4f7fb';
    ctx.fill();
    // flippers
    [-1, 1].forEach((side) => {
      ctx.save();
      ctx.translate(side * r * 0.62, r * 0.05);
      ctx.rotate(side * (0.35 + Math.sin(walk * 2) * 0.2));
      ctx.beginPath();
      ctx.ellipse(0, r * 0.22, r * 0.12, r * 0.34, 0, 0, TAU);
      outlined(ctx, '#232a3a', lw * 0.8);
      ctx.restore();
    });
    // eyes + beak
    [-1, 1].forEach((side) => {
      circle(ctx, dir * r * 0.06 + side * r * 0.2, -r * 0.42, r * 0.11, '#ffffff');
      circle(ctx, dir * r * 0.1 + side * r * 0.2, -r * 0.42, r * 0.055, '#111111');
    });
    ctx.beginPath();
    ctx.moveTo(dir * r * 0.0, -r * 0.3);
    ctx.lineTo(dir * r * 0.32, -r * 0.24);
    ctx.lineTo(dir * r * 0.0, -r * 0.16);
    ctx.closePath();
    outlined(ctx, '#ff9f2a', lw * 0.6);
    ctx.restore();
    heldGem(ctx, o, dir * r * 0.75, -r * 0.95);
  }

  /** Lava Depths: a spotted fire salamander. */
  function salamander(ctx, o, t) {
    const r = o.r;
    const dir = o.vx >= 0 ? 1 : -1;
    const walk = (o.held ? t * 22 : t * 12) + o.uid;
    shadow(ctx, r, r * 0.5, 0.3);
    ctx.save();
    ctx.scale(dir, 1);
    ctx.strokeStyle = '#4a0f05';
    const lw = Math.max(1.6, r * 0.08);
    // tail
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, r * 0.05);
    ctx.quadraticCurveTo(-r * 1.15, -r * 0.05 + Math.sin(walk) * r * 0.15, -r * 1.3, r * 0.3);
    ctx.lineWidth = r * 0.26;
    ctx.strokeStyle = '#4a0f05';
    ctx.stroke();
    ctx.lineWidth = r * 0.17;
    ctx.strokeStyle = '#ff6a2a';
    ctx.stroke();
    ctx.strokeStyle = '#4a0f05';
    // legs
    [[-0.35, 1], [0.35, -1]].forEach(([x, ph]) => {
      [-1, 1].forEach((k) => {
        const swing = Math.sin(walk + ph * k) * r * 0.12;
        ctx.beginPath();
        ctx.moveTo(x * r, r * 0.1);
        ctx.lineTo(x * r + swing, r * 0.42);
        ctx.lineWidth = lw * 1.4;
        ctx.stroke();
      });
    });
    // body + head
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.75, r * 0.36, 0, 0, TAU);
    outlined(ctx, '#ff6a2a', lw);
    ctx.beginPath();
    ctx.ellipse(r * 0.78, -r * 0.08, r * 0.34, r * 0.28, 0, 0, TAU);
    outlined(ctx, '#ff6a2a', lw);
    // yellow spots
    [[-0.4, -0.08], [-0.05, 0.08], [0.3, -0.12], [0.8, -0.2]].forEach(([x, y]) => circle(ctx, x * r, y * r, r * 0.09, '#ffd23f'));
    circle(ctx, r * 0.9, -r * 0.2, r * 0.08, '#111111');
    circle(ctx, r * 0.92, -r * 0.23, r * 0.03, '#ffffff');
    ctx.restore();
    heldGem(ctx, o, dir * r * 0.75, -r * 0.65);
  }

  /** Jungle Ruins: a hopping treasure frog. */
  function frog(ctx, o, t) {
    const r = o.r;
    const dir = o.vx >= 0 ? 1 : -1;
    const hop = Math.abs(Math.sin((o.held ? t * 8 : t * 4.5) + o.uid)) * r * 0.35;
    shadow(ctx, r, r * 0.6, 0.3 - hop / r * 0.2);
    ctx.save();
    ctx.translate(0, -hop);
    ctx.strokeStyle = '#1b3d12';
    const lw = Math.max(1.6, r * 0.08);
    // back legs
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.ellipse(side * r * 0.62, r * 0.32, r * 0.32, r * 0.2, side * 0.3, 0, TAU);
      outlined(ctx, '#4fae3e', lw);
    });
    // body
    ctx.beginPath();
    ctx.ellipse(0, r * 0.1, r * 0.8, r * 0.55, 0, 0, TAU);
    outlined(ctx, '#5fbf4a', lw);
    ctx.beginPath();
    ctx.ellipse(0, r * 0.3, r * 0.5, r * 0.28, 0, 0, TAU);
    ctx.fillStyle = '#d9f0b0';
    ctx.fill();
    // eyes on top
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.arc(side * r * 0.36, -r * 0.38, r * 0.24, 0, TAU);
      outlined(ctx, '#5fbf4a', lw);
      circle(ctx, side * r * 0.36, -r * 0.4, r * 0.15, '#ffffff');
      circle(ctx, side * r * 0.36 + dir * r * 0.05, -r * 0.4, r * 0.08, '#111111');
    });
    // smile
    ctx.beginPath();
    ctx.arc(0, -r * 0.02, r * 0.32, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.lineWidth = lw * 0.8;
    ctx.stroke();
    ctx.restore();
    heldGem(ctx, o, dir * r * 0.8, -r * 0.9 - hop);
  }

  /** Desert Tomb: a scuttling scorpion. */
  function scorpion(ctx, o, t) {
    const r = o.r;
    const dir = o.vx >= 0 ? 1 : -1;
    const walk = (o.held ? t * 22 : t * 13) + o.uid;
    shadow(ctx, r, r * 0.5, 0.3);
    ctx.save();
    ctx.scale(dir, 1);
    ctx.strokeStyle = '#3a1d0a';
    ctx.lineCap = 'round';
    const lw = Math.max(1.6, r * 0.08);
    // legs
    for (let i = 0; i < 3; i++) {
      [-1, 1].forEach((side) => {
        const ph = Math.sin(walk + i * 1.6 + (side > 0 ? 0 : Math.PI)) * r * 0.08;
        ctx.beginPath();
        ctx.moveTo(-r * 0.2 + i * r * 0.22, r * 0.1);
        ctx.lineTo(-r * 0.3 + i * r * 0.22 + ph, r * 0.42);
        ctx.lineWidth = lw;
        ctx.stroke();
      });
    }
    // tail arcing over the back with a stinger
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, 0);
    ctx.quadraticCurveTo(-r * 1.15, -r * 0.4, -r * 0.65, -r * 0.95);
    ctx.lineWidth = r * 0.24;
    ctx.stroke();
    ctx.lineWidth = r * 0.15;
    ctx.strokeStyle = '#c9782f';
    ctx.stroke();
    ctx.strokeStyle = '#3a1d0a';
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, -r * 0.98);
    ctx.lineTo(-r * 0.42, -r * 0.9);
    ctx.lineTo(-r * 0.6, -r * 0.78);
    ctx.closePath();
    outlined(ctx, '#7a3a14', lw * 0.7);
    // body
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.62, r * 0.32, 0, 0, TAU);
    outlined(ctx, '#c9782f', lw);
    // claws
    const snap = Math.abs(Math.sin(walk * 0.5)) * 0.4;
    ctx.beginPath();
    ctx.moveTo(r * 0.5, 0);
    ctx.lineTo(r * 0.85, -r * 0.18);
    ctx.lineWidth = lw * 1.4;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 0.95, -r * 0.2);
    ctx.arc(r * 0.95, -r * 0.2, r * 0.2, 0.3 + snap, TAU - 0.3 - snap);
    ctx.closePath();
    outlined(ctx, '#c9782f', lw);
    circle(ctx, r * 0.3, -r * 0.12, r * 0.06, '#111111');
    ctx.restore();
    heldGem(ctx, o, dir * r * 0.4, -r * 0.75);
  }

  /** Cosmic Rift: a floating one-eyed space blob. */
  function alien(ctx, o, t) {
    const r = o.r;
    const dir = o.vx >= 0 ? 1 : -1;
    const bob = Math.sin(t * 3 + o.uid) * r * 0.12;
    shadow(ctx, r, r * 0.75, 0.22);
    ctx.save();
    ctx.translate(0, bob - r * 0.1);
    ctx.strokeStyle = '#1d3a4a';
    const lw = Math.max(1.6, r * 0.08);
    // antennae
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.25, -r * 0.55);
      ctx.quadraticCurveTo(side * r * 0.45, -r * 0.95, side * r * 0.3, -r * 1.05);
      ctx.lineWidth = lw;
      ctx.stroke();
      circle(ctx, side * r * 0.3, -r * 1.07, r * 0.11, Math.sin(t * 6 + side) > 0 ? '#ffe08a' : '#ff9fd0');
    });
    // wobbly blob body
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * TAU;
      const wob = 1 + Math.sin(a * 3 + t * 4) * 0.05;
      const x = Math.cos(a) * r * 0.8 * wob;
      const y = Math.sin(a) * r * 0.65 * wob * (Math.sin(a) > 0 ? 0.85 : 1);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    outlined(ctx, '#6fe0c8', lw);
    ctx.beginPath();
    ctx.ellipse(-r * 0.25, -r * 0.25, r * 0.22, r * 0.12, -0.4, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fill();
    // one big eye looking where it goes
    circle(ctx, 0, -r * 0.05, r * 0.3, '#ffffff');
    circle(ctx, dir * r * 0.1, -r * 0.05, r * 0.15, '#2a1450');
    circle(ctx, dir * r * 0.05, -r * 0.1, r * 0.05, '#ffffff');
    ctx.restore();
    heldGem(ctx, o, dir * r * 0.8, -r * 0.8 + bob);
  }

  const CRITTERS = { crab, penguin, salamander, frog, scorpion, alien };

  /** Draw a moving critter in the style of its world. */
  function critter(ctx, o, t) {
    (CRITTERS[o.species] || crab)(ctx, o, t);
  }

  // ---- Claw ------------------------------------------------------------------

  /** Claw pointing down (+y) from its hub at (0,0). grip: 0 open .. 1 closed. */
  function drawClaw(ctx, skin, grip) {
    const spread = 0.95 - grip * 0.78;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let side = -1; side <= 1; side += 2) {
      const ax = side * Math.sin(spread) * 17;
      const ay = 6 + Math.cos(spread) * 15;
      const tx = ax - side * (6 + grip * 6);
      const ty = ay + 15;
      ctx.beginPath();
      ctx.moveTo(side * 4, 4);
      ctx.lineTo(ax, ay);
      ctx.lineTo(tx, ty);
      ctx.strokeStyle = skin.dark;
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.strokeStyle = skin.metal;
      ctx.lineWidth = 5;
      ctx.stroke();
      if (skin.style === 'mech') {
        ctx.strokeStyle = skin.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(side * 6, 7);
        ctx.lineTo(ax * 0.8, ay * 0.8);
        ctx.stroke();
      }
      circle(ctx, tx, ty, 3.2, skin.style === 'crystal' ? skin.accent : skin.dark);
    }
    // hub
    if (skin.style === 'crystal') {
      polyPath(ctx, [[0, -13], [11, -2], [7, 10], [-7, 10], [-11, -2]]);
      ctx.fillStyle = skin.metal;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = skin.dark;
      ctx.stroke();
      star(ctx, -3, -3, 5, '#ffffff');
      return;
    }
    circle(ctx, 0, 0, 12, skin.dark);
    circle(ctx, 0, 0, 9.5, skin.metal);
    if (skin.style === 'royal') {
      ctx.fillStyle = skin.accent;
      polyPath(ctx, [[-9, -6], [-6, -16], [-2, -8], [0, -18], [2, -8], [6, -16], [9, -6]]);
      ctx.fill();
      ctx.strokeStyle = skin.dark;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (skin.style === 'mech') {
      ctx.fillStyle = skin.accent;
      ctx.fillRect(-9, -2, 18, 4);
    }
    circle(ctx, 0, 0, 4, skin.accent);
    circle(ctx, -1.2, -1.2, 1.4, 'rgba(255,255,255,0.8)');
  }

  // ---- Sprite cache ----------------------------------------------------------

  const PAINTERS = {
    nugget: (ctx, o) => nugget(ctx, o.r, o.variant),
    bar: (ctx, o) => bar(ctx, o.r),
    diamond: (ctx, o) => diamond(ctx, o.r),
    ruby: (ctx, o) => ruby(ctx, o.r),
    rock: (ctx, o) => rock(ctx, o.r, o.variant, false),
    boulder: (ctx, o) => rock(ctx, o.r, o.variant, true),
    bag: (ctx, o) => bag(ctx, o.r),
    tnt: (ctx, o) => tnt(ctx, o.r),
    relic: (ctx, o) => relic(ctx, o.r),
  };

  const Sprites = {
    cache: new Map(),
    res: 1,

    setResolution(res) {
      if (Math.abs(res - this.res) > 0.001) {
        this.res = res;
        this.cache.clear();
      }
    },

    clear() {
      this.cache.clear();
    },

    /**
     * Returns { canvas, size } for an object, painting it on first use.
     * The object's tilt is baked in (quantised to 0.1 rad) so gameplay frames
     * only ever do axis-aligned blits — rotated drawImage is slow on weak GPUs.
     */
    get(o, ignoreRot) {
      const def = GR.OBJECTS[o.type];
      const rKey = Math.round(o.r * 2) / 2;
      const rotStep = ignoreRot ? 0 : Math.round((o.rot || 0) * 10);
      const key = def.sprite + '|' + rKey + '|' + o.variant + '|' + rotStep;
      let spr = this.cache.get(key);
      if (spr) return spr;
      if (this.cache.size > 200) this.cache.clear(); // keep memory bounded on long sessions
      const half = rKey * 1.45 + 6;
      const px = Math.ceil(half * 2 * this.res);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = Math.max(4, px);
      const ctx = canvas.getContext('2d');
      ctx.scale(this.res, this.res);
      ctx.translate(half, half);
      if (rotStep) ctx.rotate(rotStep / 10);
      PAINTERS[def.sprite](ctx, { r: rKey, variant: o.variant });
      spr = { canvas, size: half * 2 };
      this.cache.set(key, spr);
      return spr;
    },

    painters: { nugget, bar, diamond, ruby, rock, bag, tnt, relic, crab, penguin, salamander, frog, scorpion, alien, star },
    critter,
    drawClaw,
    circle,
    star,
    polyPath,
  };

  GR.Sprites = Sprites;
})((window.GR = window.GR || {}));
