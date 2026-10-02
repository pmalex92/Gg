/**
 * Leaderboards.
 *
 * LeaderboardService talks to a provider with a tiny async interface:
 *
 *   provider.submit(boardId, { name, score })      -> Promise<void>
 *   provider.fetchTop(boardId, { limit })          -> Promise<Array<{ name, score, isPlayer }>>
 *
 * Board ids: 'global' (best run), 'daily:YYYY-MM-DD', 'week:YYYY-Www'.
 *
 * The MVP ships with LocalPreviewProvider: deterministic mock rivals plus the
 * player's own local best, clearly labelled as an offline preview. Swapping in
 * RestProvider (or a Firebase / Supabase adapter with the same two methods) is
 * a one-line change in CONFIG.LEADERBOARD.provider.
 */
(function (GR) {
  'use strict';

  const NAMES = [
    'GOLDENMINER', 'CLAWMASTER', 'DIGGER99', 'NUGGETQUEEN', 'ROCKBOTTOM', 'PICKAXE_PETE',
    'GEMHUNTER', 'DEEPCORE', 'MOTHERLODE', 'SHAFTY', 'ORE_KING', 'TNT_TOM', 'CAVECRAB',
    'BEDROCK', 'GRITTY', 'LUCKYSTRIKE', 'DUSTDEVIL', 'VEINSEEKER', 'IRONCLAW', 'BIGHAUL',
  ];

  /** Offline preview: seeded fake rivals so the board looks stable per day/week. */
  class LocalPreviewProvider {
    constructor(saveManager) {
      this.saveManager = saveManager;
      this.isOnline = false;
    }

    submit() {
      return Promise.resolve(); // scores already live in the local save
    }

    fetchTop(boardId, opts) {
      const limit = (opts && opts.limit) || 10;
      const rng = GR.RNG.fromString('lb-' + boardId);
      const scale = boardId === 'global' ? 14000 : boardId.indexOf('week') === 0 ? 11000 : 8000;
      const names = rng.shuffle(NAMES.slice());
      const rows = [];
      let score = scale * rng.range(0.85, 1.15);
      for (let i = 0; i < limit + 2; i++) {
        rows.push({ name: names[i % names.length], score: Math.round(score / 10) * 10, isPlayer: false });
        score *= rng.range(0.86, 0.96);
      }
      const player = this.playerScore(boardId);
      if (player > 0) {
        rows.push({ name: this.saveManager.data.player.name || 'PLAYER', score: player, isPlayer: true });
      }
      rows.sort((a, b) => b.score - a.score);
      const out = rows.slice(0, limit);
      // Always show the player's row, even when outside the top N.
      if (player > 0 && !out.some((r) => r.isPlayer)) {
        const rank = rows.findIndex((r) => r.isPlayer) + 1;
        out.push(Object.assign({ rank }, rows[rank - 1]));
      }
      return Promise.resolve(out.map((r, i) => Object.assign({ rank: r.rank || i + 1 }, r)));
    }

    playerScore(boardId) {
      const d = this.saveManager.data;
      if (boardId === 'global') return d.stats.bestRun;
      if (boardId.indexOf('daily:') === 0) return d.daily.best[boardId.slice(6)] || 0;
      if (boardId.indexOf('week:') === 0) return d.stats.weekKey === boardId.slice(5) ? d.stats.weekBest : 0;
      return 0;
    }
  }

  /**
   * Generic REST adapter (not enabled by default). Expected API:
   *   POST {base}/scores            body: { board, name, score }
   *   GET  {base}/leaderboards/{board}?limit=10  -> [{ name, score }]
   * A Firebase or Supabase adapter would implement the same two methods.
   */
  class RestProvider {
    constructor(baseUrl) {
      this.baseUrl = baseUrl.replace(/\/$/, '');
      this.isOnline = true;
    }

    submit(boardId, entry) {
      return fetch(this.baseUrl + '/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board: boardId, name: entry.name, score: entry.score }),
      }).then(() => undefined);
    }

    fetchTop(boardId, opts) {
      const limit = (opts && opts.limit) || 10;
      return fetch(this.baseUrl + '/leaderboards/' + encodeURIComponent(boardId) + '?limit=' + limit)
        .then((r) => r.json())
        .then((rows) => rows.map((r, i) => ({ rank: i + 1, name: r.name, score: r.score, isPlayer: false })));
    }
  }

  class LeaderboardService {
    constructor(saveManager, config) {
      this.saveManager = saveManager;
      this.provider = config.provider === 'rest' && config.restBaseUrl
        ? new RestProvider(config.restBaseUrl)
        : new LocalPreviewProvider(saveManager);
    }

    get isOnline() {
      return this.provider.isOnline;
    }

    boardId(tab) {
      if (tab === 'today') return 'daily:' + GR.util.dateKey();
      if (tab === 'week') return 'week:' + GR.util.weekKey(new Date());
      return 'global';
    }

    fetch(tab, limit) {
      return this.provider.fetchTop(this.boardId(tab), { limit: limit || 10 }).catch((e) => {
        console.warn('[leaderboard] fetch failed', e);
        return [];
      });
    }

    submit(tab, score) {
      const name = this.saveManager.data.player.name || 'PLAYER';
      return this.provider.submit(this.boardId(tab), { name, score }).catch((e) => {
        console.warn('[leaderboard] submit failed', e);
      });
    }
  }

  GR.LeaderboardService = LeaderboardService;
  GR.LeaderboardProviders = { LocalPreviewProvider, RestProvider };
})((window.GR = window.GR || {}));
