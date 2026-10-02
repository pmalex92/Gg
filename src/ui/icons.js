/**
 * Original inline SVG icons (24x24, currentColor). Inline SVG keeps the game
 * to zero image requests and lets icons inherit button colours.
 */
(function (GR) {
  'use strict';

  const P = {
    play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/>',
    pause: '<rect x="6" y="5" width="4.2" height="14" rx="1.2" fill="currentColor"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2" fill="currentColor"/>',
    home: '<path d="M3.5 11.2 12 4l8.5 7.2V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z" fill="currentColor"/>',
    restart: '<path d="M12 4a8 8 0 1 1-7.6 5.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M3 4.5v5.6h5.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    gear: '<path d="M10.3 2.5h3.4l.5 2.6 1.7.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.7 2.6.5v3.4l-2.6.5-.8 1.7 1.5 2.2-2.4 2.4-2.2-1.5-1.7.8-.5 2.6h-3.4l-.5-2.6-1.7-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.7-2.6-.5v-3.4l2.6-.5.8-1.7-1.5-2.2 2.4-2.4 2.2 1.5 1.7-.8z" fill="currentColor"/><circle cx="12" cy="12" r="3.4" fill="#1a1410"/>',
    shop: '<path d="M5 8h14l-1.2 12.1a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9z" fill="currentColor"/><path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    upgrade: '<path d="M12 3 4 11h5v4h6v-4h5z" fill="currentColor"/><rect x="9" y="17" width="6" height="2.6" rx="1" fill="currentColor"/>',
    trophy: '<path d="M7 3h10v5a5 5 0 0 1-10 0z" fill="currentColor"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10.5 13h3v4h-3z" fill="currentColor"/><rect x="7" y="17.5" width="10" height="3.5" rx="1" fill="currentColor"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M3.5 9.5h17" stroke="currentColor" stroke-width="2.2"/><path d="M8 3v4M16 3v4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="7" y="12.5" width="4" height="4" rx=".8" fill="currentColor"/>',
    podium: '<rect x="9" y="5" width="6" height="15" rx="1" fill="currentColor"/><rect x="2.5" y="10" width="6" height="10" rx="1" fill="currentColor" opacity=".75"/><rect x="15.5" y="13" width="6" height="7" rx="1" fill="currentColor" opacity=".55"/>',
    share: '<circle cx="18" cy="5.5" r="2.8" fill="currentColor"/><circle cx="6" cy="12" r="2.8" fill="currentColor"/><circle cx="18" cy="18.5" r="2.8" fill="currentColor"/><path d="M8.3 10.8l7.4-4M8.3 13.2l7.4 4" stroke="currentColor" stroke-width="2.2"/>',
    tv: '<rect x="2.5" y="5" width="19" height="13" rx="2.2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M10 8.8v5.4l4.6-2.7z" fill="currentColor"/><path d="M8 21h8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4"/>',
    check: '<path d="M4.5 12.5 9.5 17.5 19.5 6.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    close: '<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
    back: '<path d="M15 4.5 7.5 12l7.5 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    coin: '<circle cx="12" cy="12" r="9.5" fill="#ffc531" stroke="#9a6510" stroke-width="1.6"/><circle cx="12" cy="12" r="6" fill="none" stroke="#c98613" stroke-width="1.6"/><path d="M10.6 9.4h2.8v5.2" stroke="#9a6510" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
    token: '<path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z" fill="#a77bff" stroke="#4b2a99" stroke-width="1.6"/><path d="M12 6.5l4.8 2.8v5.4L12 17.5l-4.8-2.8V9.3z" fill="#d6c2ff"/>',
    flame: '<path d="M12 2.5c1 3.2 5.5 5.7 5.5 11a5.5 5.5 0 0 1-11 0c0-2.5 1.2-4.2 2.5-5.3.2 1.7 1 2.8 2 3.1C10.6 8.2 11 5 12 2.5z" fill="currentColor"/>',
    star: '<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="currentColor"/>',
    magnet: '<path d="M5 4h4.5v8a2.5 2.5 0 0 0 5 0V4H19v8a7 7 0 0 1-14 0z" fill="currentColor"/><path d="M5 4h4.5v3.2H5zM14.5 4H19v3.2h-4.5z" fill="#fff" opacity=".85"/>',
    bolt: '<path d="M13.5 2 4.5 13.5h6l-1.5 8.5 9-11.5h-6z" fill="currentColor"/>',
    snow: '<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    x2: '<text x="12" y="17" text-anchor="middle" font-family="Lilita One, Arial Black, sans-serif" font-size="15" fill="currentColor">×2</text>',
    clock: '<circle cx="12" cy="12.5" r="8.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 8v5l3.2 2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M9.5 2.5h5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    muscle: '<path d="M4 15c0-4 3-6.5 6-6.5l1-3.5 3 .5-.5 3.5c3 .5 6.5 2.5 6.5 6.5 0 3-2.5 4.5-5 4.5H8c-2.5 0-4-2-4-5z" fill="currentColor"/>',
    coins: '<ellipse cx="9" cy="16" rx="6" ry="3" fill="currentColor"/><ellipse cx="9" cy="12.5" rx="6" ry="3" fill="currentColor" opacity=".8"/><ellipse cx="15" cy="9" rx="6" ry="3" fill="currentColor"/><ellipse cx="15" cy="5.5" rx="6" ry="3" fill="currentColor" opacity=".8"/>',
    sound: '<path d="M4 9h3.5L12 5v14l-4.5-4H4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    music: '<path d="M9 17.5V5.5l11-2v12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><circle cx="6.5" cy="17.5" r="3" fill="currentColor"/><circle cx="17.5" cy="15.5" r="3" fill="currentColor"/>',
    motion: '<circle cx="15" cy="12" r="5" fill="currentColor"/><path d="M3 8h6M2 12h6M3 16h6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    vibrate: '<rect x="7.5" y="3" width="9" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M4 8v8M20 8v8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    claw: '<path d="M12 2v6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="10" r="3" fill="currentColor"/><path d="M10 12 6 16l2.5 4.5M14 12l4 4-2.5 4.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    gem: '<path d="M6.5 4h11l4 5-9.5 11.5L2.5 9z" fill="currentColor"/><path d="M2.5 9h19M9 4l3 16.5L15 4" stroke="#1a1410" stroke-width="1.2" fill="none" opacity=".5"/>',
    gift: '<rect x="3.5" y="9" width="17" height="5" rx="1" fill="currentColor"/><rect x="5" y="14" width="14" height="7" rx="1" fill="currentColor" opacity=".85"/><path d="M12 9v12" stroke="#1a1410" stroke-width="2"/><path d="M12 9c-1.5-4-6-4.5-6-2s3.5 2 6 2c2.5 0 6 .5 6-2s-4.5-2-6 2z" fill="none" stroke="currentColor" stroke-width="2"/>',
  };

  GR.icon = function (name, cls) {
    return '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (P[name] || '') + '</svg>';
  };
})((window.GR = window.GR || {}));
