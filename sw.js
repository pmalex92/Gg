/**
 * Offline support: precache the whole game on first visit, then serve it
 * cache-first. Bump CACHE when shipping a new version so clients update.
 * (Only active over http/https — file:// pages skip registration.)
 */
const CACHE = 'goldrush-v1.0.0';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'styles/font.css',
  'styles/main.css',
  'assets/icon.svg',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'src/core/util.js',
  'src/core/rng.js',
  'src/core/events.js',
  'src/config.js',
  'src/data/objects.js',
  'src/data/upgrades.js',
  'src/data/boosters.js',
  'src/data/cosmetics.js',
  'src/data/achievements.js',
  'src/data/products.js',
  'src/systems/save.js',
  'src/systems/economy.js',
  'src/systems/achievements.js',
  'src/systems/daily.js',
  'src/systems/leaderboard.js',
  'src/systems/ads.js',
  'src/systems/purchases.js',
  'src/systems/share.js',
  'src/audio/audio.js',
  'src/game/levelgen.js',
  'src/game/claw.js',
  'src/game/session.js',
  'src/game/autopilot.js',
  'src/game/sprites.js',
  'src/game/particles.js',
  'src/game/renderer.js',
  'src/game/fx.js',
  'src/game/input.js',
  'src/ui/icons.js',
  'src/ui/dom.js',
  'src/ui/hud.js',
  'src/ui/screens.js',
  'src/ui/overlays.js',
  'src/main.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});
