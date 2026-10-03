/**
 * Procedural level generator.
 *
 *   LevelGen.campaign(levelNumber, runSeed)
 *   LevelGen.daily(dateKey)
 *   LevelGen.demo(seed)
 *
 * Output is plain data: { mode, level, seed, target, time, swingSpeed,
 * objects[], fieldValue, modifier }. Generation is fully deterministic for a
 * given seed (only GR.RNG is used), which is what makes the Daily Challenge
 * identical for everyone.
 *
 * Difficulty curve (n = level):
 *  - L1-3: big nuggets close to the surface, slow swing, generous target.
 *  - L5+:  smaller objects, heavier rock mix, rocks start shielding treasure.
 *  - L7+:  cave crabs (moving targets, some carry a gem).
 *  - L10+: more TNT, rolling boulders (moving obstacles), faster swing.
 *  - L12+: rare ancient relics.
 */
(function (GR) {
  'use strict';

  const C = GR.CONFIG;
  const OBJ = GR.OBJECTS;

  const round = (v, step) => Math.max(step, Math.round(v / step) * step);

  function targetFor(n) {
    let t;
    if (n <= 10) t = 500 + (n - 1) * 205;
    else if (n <= 30) t = 2345 + (n - 10) * 140;
    else t = 5145 + (n - 30) * 90;
    return round(t, 50);
  }

  function valuableWeights(n) {
    return {
      small_gold: Math.max(1.6, 5 - n * 0.22),
      large_gold: Math.max(1.4, 3.6 - n * 0.12),
      gold_bar: n < 2 ? 0.35 : Math.min(2.6, 0.7 + n * 0.12),
      diamond: Math.min(2.6, 0.45 + n * 0.13),
      red_gem: n < 4 ? 0 : Math.min(2.0, 0.3 + (n - 4) * 0.12),
      crab: n < 7 ? 0 : Math.min(1.8, 0.7 + (n - 7) * 0.08),
      relic: n < 12 ? 0 : Math.min(0.9, 0.25 + (n - 12) * 0.04),
    };
  }

  /** Composition knobs for a given difficulty, optionally bent by a daily modifier. */
  function recipe(n, mode, modifier) {
    const r = {
      weights: valuableWeights(n),
      budget: targetFor(n) / Math.min(0.58, 0.38 + 0.013 * n),
      maxValuables: Math.min(24, 8 + Math.floor(n * 0.9)),
      rocks: Math.min(12, 2 + Math.floor(n * 0.5)),
      // (from L10 one or two of these become rolling boulders)
      largeRockShare: Math.min(0.55, 0.2 + n * 0.025),
      tnt: n < 3 ? 0 : n < 10 ? 1 : n < 18 ? 2 : 3,
      bags: 1,
      shieldChance: n < 5 ? 0 : Math.min(0.65, 0.12 * (n - 4)),
      depthReach: Math.min(1, 0.68 + n * 0.065), // how deep treasure may sit (fraction of field)
      gemDepthBias: Math.min(1.6, 0.2 + n * 0.07),
      scaleLo: Math.max(0.74, 1.02 - n * 0.013),
      scaleHi: Math.max(0.95, 1.2 - n * 0.011),
      crabGemChance: OBJ.crab.gemCarrierChance,
      targetCap: 0.62,
    };
    if (mode === 'training') {
      // Gentle practice field: chunky gold close to the surface, one gem,
      // one rock to learn what "heavy" means, no TNT or critters.
      r.weights = { small_gold: 4, large_gold: 3, diamond: 0.6 };
      r.budget = 1300;
      r.maxValuables = 9;
      r.rocks = 1;
      r.largeRockShare = 0;
      r.tnt = 0;
      r.depthReach = 0.62;
      r.scaleLo = 1;
      r.scaleHi = 1.15;
    }
    if (mode === 'daily') {
      r.budget = 10500;
      r.maxValuables = 24;
      r.targetCap = 0.45;
      const w = r.weights;
      switch (modifier) {
        case 'gem_rush':
          w.diamond *= 2.4; w.red_gem = 2.4; w.small_gold *= 0.5; w.large_gold *= 0.6;
          break;
        case 'tnt_party':
          r.tnt = 6;
          break;
        case 'rock_garden':
          r.rocks += 5; r.shieldChance = 0.9; r.targetCap = 0.38;
          break;
        case 'gold_fever':
          w.gold_bar *= 2.2; w.large_gold *= 1.8; w.diamond *= 0.6; w.red_gem *= 0.6;
          break;
        case 'crab_parade':
          w.crab = 3.2; r.crabGemChance = 0.6;
          break;
        default:
          break;
      }
    }
    return r;
  }

  let uid = 1;

  function makeObject(type, rng, rec) {
    const def = OBJ[type];
    const s = def.scalable ? rng.range(rec.scaleLo, rec.scaleHi) : 1;
    const o = {
      uid: uid++,
      type,
      kind: def.kind,
      x: 0,
      y: 0,
      r: def.radius * s,
      scale: s,
      value: def.scalable ? round(def.value * s * s, 5) : def.value,
      weight: def.scalable ? def.weight * s * s : def.weight,
      variant: rng.int(0, 3),
      rot: def.kind === 'gem' || type === 'gold_bar' || type === 'tnt' ? 0 : rng.range(-0.35, 0.35),
      alive: true,
    };
    if (type === 'crab') {
      o.gem = rng.chance(rec.crabGemChance);
      if (o.gem) o.value += def.gemBonus;
      o.speed = rng.range(42, 72);
      o.vx = rng.chance(0.5) ? o.speed : -o.speed;
      o.species = rec.species || 'crab'; // drawn as the current world's animal
    }
    return o;
  }

  /** Simple spatial bookkeeping: placed circles + crab lanes (rectangles). */
  class Field {
    constructor() {
      this.circles = [];
      this.lanes = [];
    }

    fits(x, y, r, gap) {
      const F = C.FIELD;
      if (x - r < F.x0 || x + r > F.x1 || y - r < F.y0 || y + r > F.y1) return false;
      for (let i = 0; i < this.circles.length; i++) {
        const c = this.circles[i];
        const min = c.r + r + gap;
        const dx = c.x - x;
        const dy = c.y - y;
        if (dx * dx + dy * dy < min * min) return false;
      }
      for (let i = 0; i < this.lanes.length; i++) {
        const l = this.lanes[i];
        const cx = Math.max(l.x0, Math.min(x, l.x1));
        const cy = Math.max(l.y0, Math.min(y, l.y1));
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy < (r + gap) * (r + gap)) return false;
      }
      return true;
    }

    add(o) {
      this.circles.push(o);
    }
  }

  function depthY(rng, reach, bias) {
    const F = C.FIELD;
    const t = Math.pow(rng.next(), 1 / (1 + Math.max(0, bias)));
    return F.y0 + (F.y1 - F.y0) * reach * t;
  }

  function placeCircle(field, o, rng, reach, bias) {
    const F = C.FIELD;
    for (let attempt = 0; attempt < 120; attempt++) {
      const gap = attempt < 80 ? 10 : 3;
      const x = rng.range(F.x0 + o.r, F.x1 - o.r);
      const y = Math.max(F.y0 + o.r, depthY(rng, attempt < 60 ? reach : 1, bias));
      if (field.fits(x, y, o.r, gap)) {
        o.x = x;
        o.y = y;
        field.add(o);
        return true;
      }
    }
    return false;
  }

  /** Movers (crabs, rolling boulders) patrol a private horizontal lane. */
  function placeMover(field, o, rng) {
    const F = C.FIELD;
    for (let attempt = 0; attempt < 80; attempt++) {
      const half = rng.range(70, 170);
      const cx = rng.range(F.x0 + half + o.r, F.x1 - half - o.r);
      const y = rng.range(F.y0 + (F.y1 - F.y0) * 0.35, F.y1 - o.r - 10);
      const lane = { x0: cx - half - o.r, x1: cx + half + o.r, y0: y - o.r - 8, y1: y + o.r + 8 };
      const clash = field.lanes.some((l) => !(lane.x1 < l.x0 || lane.x0 > l.x1 || lane.y1 < l.y0 || lane.y0 > l.y1));
      if (clash) continue;
      const blocked = field.circles.some(
        (c) => c.x + c.r > lane.x0 && c.x - c.r < lane.x1 && c.y + c.r > lane.y0 && c.y - c.r < lane.y1
      );
      if (blocked) continue;
      field.lanes.push(lane);
      o.x = cx + rng.range(-half, half);
      o.y = y;
      o.minX = cx - half;
      o.maxX = cx + half;
      return true;
    }
    return false;
  }

  /** Put a rock on the line between the claw pivot and a treasure. */
  function placeShield(field, rock, target, rng) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const f = rng.range(0.55, 0.82);
      const x = C.PIVOT.x + (target.x - C.PIVOT.x) * f + rng.range(-12, 12);
      const y = C.PIVOT.y + (target.y - C.PIVOT.y) * f + rng.range(-12, 12);
      if (y - rock.r < C.FIELD.y0) continue;
      if (field.fits(x, y, rock.r, 4)) {
        rock.x = x;
        rock.y = y;
        field.add(rock);
        return true;
      }
    }
    return false;
  }

  function generate(opts) {
    const n = Math.max(1, opts.level);
    const mode = opts.mode || 'campaign';
    const rng = GR.RNG.fromString(opts.seed + '|' + n);
    const rec = recipe(n, mode, opts.modifier);
    rec.species = opts.species;
    const field = new Field();
    const objects = [];

    // 1. Choose treasure until the value budget is met.
    const valuables = [];
    let value = 0;
    while (value < rec.budget && valuables.length < rec.maxValuables) {
      const type = rng.weighted(rec.weights);
      const o = makeObject(type, rng, rec);
      valuables.push(o);
      value += o.value;
    }
    // Early levels: guarantee a couple of chunky nuggets for a satisfying start.
    if ((n <= 2 && mode === 'campaign') || mode === 'training') {
      for (let i = 0; i < 2; i++) valuables.push(makeObject('large_gold', rng, rec));
    }

    // 2. Crabs first (they need a clear horizontal lane).
    valuables.filter((o) => o.type === 'crab').forEach((o) => {
      if (placeMover(field, o, rng)) objects.push(o);
    });

    // 3. Rocks, TNT and bags.
    const rocks = [];
    for (let i = 0; i < rec.rocks; i++) {
      rocks.push(makeObject(rng.chance(rec.largeRockShare) ? 'large_rock' : 'small_rock', rng, rec));
    }
    // Rolling boulders from level 10: moving obstacles that block lanes.
    const rollers = mode === 'campaign' && n >= 10 ? (n >= 16 ? 2 : 1) : 0;
    for (let i = 0; i < rollers && rocks.length; i++) {
      const rock = rocks.pop();
      rock.rolling = true;
      rock.rot = 0;
      rock.speed = rng.range(28, 48);
      rock.vx = rng.chance(0.5) ? rock.speed : -rock.speed;
      if (placeMover(field, rock, rng)) objects.push(rock);
    }
    const extras = [];
    for (let i = 0; i < rec.tnt; i++) extras.push(makeObject('tnt', rng, rec));
    const bags = mode === 'training' ? 1 : rec.bags + (n >= 5 && rng.chance(0.5) ? 1 : 0);
    for (let i = 0; i < bags; i++) extras.push(makeObject('mystery_bag', rng, rec));

    // 4. Place treasure, largest first, deeper for high-value items.
    const statics = valuables.filter((o) => o.type !== 'crab').sort((a, b) => b.r - a.r);
    statics.forEach((o) => {
      const precious = o.kind === 'gem' || o.kind === 'relic' || o.type === 'gold_bar';
      const bias = precious ? rec.gemDepthBias : o.type === 'large_gold' ? n * 0.04 : 0;
      if (placeCircle(field, o, rng, rec.depthReach, bias)) objects.push(o);
    });

    // 5. Shield rocks guard some of the precious items.
    if (rec.shieldChance > 0) {
      objects
        .filter((o) => o.kind === 'gem' || o.kind === 'relic' || o.type === 'gold_bar')
        .forEach((t) => {
          if (!rocks.length || !rng.chance(rec.shieldChance)) return;
          const rock = rocks.pop();
          if (placeShield(field, rock, t, rng)) objects.push(rock);
          else rocks.push(rock);
        });
    }

    // 6. Remaining rocks + extras anywhere.
    rocks.concat(extras).sort((a, b) => b.r - a.r).forEach((o) => {
      if (placeCircle(field, o, rng, 1, o.type === 'tnt' ? 0.4 : 0.1)) objects.push(o);
    });

    const fieldValue = objects.reduce(
      (sum, o) => sum + (o.kind === 'rock' || o.kind === 'tnt' ? 0 : o.kind === 'mystery' ? 250 : o.value),
      0
    );
    let target;
    if (mode === 'daily') target = round(fieldValue * rec.targetCap, 250);
    else if (mode === 'training') target = 300;
    else target = Math.min(targetFor(n), round(fieldValue * rec.targetCap, 50));

    return {
      mode,
      level: n,
      seed: opts.seed,
      modifier: opts.modifier || null,
      target,
      time: C.LEVEL_TIME,
      swingSpeed: C.CLAW.swingSpeed * (1 + Math.min(0.45, (n - 1) * 0.03)),
      objects,
      fieldValue,
    };
  }

  GR.LevelGen = {
    targetFor,
    generate,

    campaign(level, runSeed) {
      const world = GR.Worlds ? GR.Worlds.forLevel(level) : null;
      return generate({ level, seed: 'run-' + runSeed, mode: 'campaign', species: world ? world.critter : 'crab' });
    },

    /** The one-off practice level before Level 1 (same layout every time). */
    training() {
      return generate({ level: 1, seed: 'training', mode: 'training' });
    },

    daily(dateKey) {
      const mod = GR.Daily.modifierFor(dateKey);
      return generate({ level: 9, seed: 'daily-' + dateKey, mode: 'daily', modifier: mod.id });
    },

    demo(seed) {
      return generate({ level: 6, seed: 'demo-' + seed, mode: 'demo' });
    },

    isCheckpoint(level) {
      return (level - 1) % C.CHECKPOINT_EVERY === 0;
    },
  };
})((window.GR = window.GR || {}));
