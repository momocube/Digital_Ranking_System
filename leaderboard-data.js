/* 共用資料模組 — 模擬「遊戲包資料庫」匯出的內容(雙語)。
   階層:店家 STORE → 場域 FIELD(格子盤,如 480 / 225 / 64 格)。
   之後要接真實資料時,只需把 capture()/current() 內部換成
   讀取檔案 / fetch(API) / 解析 DB,輸出格式維持不變即可。
   (輸出仍沿用 region = 店家、venue = 場域 兩個鍵名) */
(function () {
  function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
  function shuffle(a, r) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // 動態關卡:9-5 → 1-1 共 45 階(每 5 小關晉升一大關),超過則回 1-1
  function stageFor(i) {
    if (i < 45) {
      var chapter = 9 - Math.floor(i / 5);
      var sub = 5 - (i % 5);
      return chapter + '-' + sub;
    }
    return '1-1';
  }

  function fmtScore(n) { return Math.round(n).toLocaleString('en-US'); }
  function fmtTime(s) {
    var m = Math.floor(s / 60), sec = Math.floor(s % 60), cs = Math.floor((s * 100) % 100);
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0') + '.' + String(cs).padStart(2, '0');
  }

  // teams: [[zh, en], ...]
  function buildState(teams, seed) {
    var r = rng(seed);
    var t = shuffle(teams, r);
    return t.map(function (tm, i) {
      return {
        _id: 't_' + seed + '_' + i,  // 穩定識別碼,排序/重新整理後仍可用來找回同一筆
        zh: tm[0], en: tm[1],
        score: Math.max(50000, 9990000 - i * 150000 - Math.floor(r() * 80000)),
        secs: 380 + i * 18 + Math.floor(r() * 40)
      };
    });
  }
  function format(state) {
    var rows = state.slice().sort(function (a, b) { return b.score - a.score; });
    return rows.map(function (row, i) {
      return { _id: row._id, teamZh: row.zh, teamEn: row.en, stage: stageFor(i), time: fmtTime(row.secs), score: fmtScore(row.score) };
    });
  }

  // 賽博龐克 / 西式科技(台北旗艦店)
  var POOL_A = [
    ['霓虹幽靈', 'NEON GHOST'], ['數據風暴', 'DATA STORM'], ['鈦合金狼', 'TITAN WOLF'], ['像素獵手', 'PIXEL HUNTER'],
    ['暗影協議', 'SHADOW PROTOCOL'], ['電弧核心', 'ARC CORE'], ['故障矩陣', 'GLITCH MATRIX'], ['鉻合金蛇', 'CHROME VIPER'],
    ['零號終端', 'ZERO TERMINAL'], ['合成之心', 'SYNTH HEART'], ['霓虹脈衝', 'NEON PULSE'], ['量子幻影', 'QUANTUM PHANTOM'],
    ['數位暴風', 'DIGITAL TEMPEST'], ['鋼鐵獵犬', 'STEEL HOUND'], ['像素惡魔', 'PIXEL DEMON'], ['暗夜協定', 'NIGHT PROTOCOL'],
    ['電漿核子', 'PLASMA NUCLEUS'], ['故障訊號', 'GLITCH SIGNAL'], ['鈦金毒蛇', 'TITAN COBRA'], ['終結迴路', 'END CIRCUIT'],
    ['合成神經', 'SYNTH NEURAL'], ['霓虹斬擊', 'NEON SLASH'], ['數據鬼魂', 'DATA SPECTER'], ['鉻金獵殺', 'CHROME PURGE'],
    ['像素風暴', 'PIXEL STORM'], ['暗黑符文', 'DARK RUNE'], ['電弧炸彈', 'ARC BOMB'], ['故障代碼', 'GLITCH CODE'],
    ['鋼鐵堡壘', 'STEEL FORTRESS'], ['終端代理', 'TERMINAL AGENT']
  ];
  // 日式賽博(高雄電競店)
  var POOL_B = [
    ['量子武士', 'QUANTUM SAMURAI'], ['霓虹櫻花', 'NEON SAKURA'], ['鋼鐵浪人', 'STEEL RONIN'], ['電光忍者', 'VOLT NINJA'],
    ['故障神社', 'GLITCH SHRINE'], ['像素幕府', 'PIXEL SHOGUN'], ['暗黑壽司', 'DARK SUSHI'], ['合成富士', 'SYNTH FUJI'],
    ['終端銀座', 'TERMINAL GINZA'], ['核心秋葉', 'CORE AKIBA'], ['數位天皇', 'DIGITAL EMPEROR'], ['鉻金武藏', 'CHROME MUSASHI'],
    ['霓虹和服', 'NEON KIMONO'], ['電弧太郎', 'ARC TARO'], ['像素忍刀', 'PIXEL TANTO'], ['暗影忍法', 'SHADOW NINJUTSU'],
    ['量子歌舞伎', 'QUANTUM KABUKI'], ['故障結界', 'GLITCH KEKKAI'], ['鋼鐵鎧甲', 'STEEL YOROI'], ['合成靈魂', 'SYNTH SOUL'],
    ['終端京都', 'TERMINAL KYOTO'], ['數據道場', 'DATA DOJO'], ['霓虹鈴鐺', 'NEON BELL'], ['像素紅葉', 'PIXEL MOMIJI'],
    ['暗黑武田', 'DARK TAKEDA'], ['鉻金劍豪', 'CHROME SWORDMASTER'], ['電光神風', 'VOLT KAMIKAZE'], ['故障將軍', 'GLITCH SHOGUN'],
    ['量子真田', 'QUANTUM SANADA'], ['合成幽靈', 'SYNTH SPIRIT']
  ];
  // 熱帶賽博(台中電競店)
  var POOL_C = [
    ['熱帶風暴', 'TROPIC STORM'], ['霓虹叢林', 'NEON JUNGLE'], ['數位猛虎', 'DIGITAL TIGER'], ['賽博象神', 'CYBER GANESHA'],
    ['像素榴槤', 'PIXEL DURIAN'], ['暗影海灣', 'SHADOW BAY'], ['電弧椰林', 'ARC PALMS'], ['故障季風', 'GLITCH MONSOON'],
    ['合成蘭花', 'SYNTH ORCHID'], ['終端群島', 'TERMINAL ISLES'], ['量子珊瑚', 'QUANTUM CORAL'], ['鉻金鱷魚', 'CHROME CROCODILE'],
    ['霓虹芒果', 'NEON MANGO'], ['像素鳳梨', 'PIXEL PINEAPPLE'], ['暗黑火山', 'DARK VOLCANO'], ['電光浪潮', 'VOLT WAVE'],
    ['數據颱風', 'DATA TYPHOON'], ['故障雷鳴', 'GLITCH THUNDER'], ['合成棕櫚', 'SYNTH PALM'], ['鋼鐵海龜', 'STEEL TURTLE'],
    ['終端潛艇', 'TERMINAL SUBMARINE'], ['霓虹海星', 'NEON STARFISH'], ['鉻金海豚', 'CHROME DOLPHIN'], ['暗影鯊魚', 'SHADOW SHARK'],
    ['像素珍珠', 'PIXEL PEARL'], ['量子海流', 'QUANTUM CURRENT'], ['電弧暴雨', 'ARC RAIN'], ['故障烈日', 'GLITCH SUN'],
    ['合成熱浪', 'SYNTH HEATWAVE'], ['終端極光', 'TERMINAL AURORA']
  ];

  // 每家店都有的場域(格子盤)規格
  var FIELDS = [
    { id: 'f480', zh: '480 格', en: '480-CELL' },
    { id: 'f225', zh: '225 格', en: '225-CELL' },
    { id: 'f64', zh: '64 格', en: '64-CELL' }
  ];

  // 店家 STORE(原本的「地區」)
  var STORES = [
    { id: 'tpe', zh: '台北旗艦店', en: 'TAIPEI FLAGSHIP', pool: POOL_A, base: 1000 },
    { id: 'khh', zh: '高雄電競店', en: 'KAOHSIUNG STORE', pool: POOL_B, base: 2000 },
    { id: 'tc', zh: '台中電競店', en: 'TAICHUNG STORE', pool: POOL_C, base: 3000 }
  ];

  // 組出 META(每家店 × 每個場域)
  var META = STORES.map(function (s) {
    return {
      id: s.id, zh: s.zh, en: s.en,
      venues: FIELDS.map(function (f, fi) {
        return { id: f.id, zh: f.zh, en: f.en, _seed: s.base + fi * 11 + 1 };
      }),
      _pool: s.pool
    };
  });

  var STORE = {};
  META.forEach(function (s) {
    s.venues.forEach(function (v) { STORE[s.id + '/' + v.id] = buildState(s._pool, v._seed); });
  });

  function find(rid, vid) {
    var s = META.filter(function (r) { return r.id === rid; })[0];
    var v = s && s.venues.filter(function (x) { return x.id === vid; })[0];
    return { rg: s, v: v };
  }
  function pack(f, rows) {
    return { region: { zh: f.rg.zh, en: f.rg.en }, venue: { zh: f.v.zh, en: f.v.en }, rows: rows, updated: Date.now() };
  }

  // ---- 人數版本 + 期間榜(季度/年度)擴充 ----
  var VERSIONS = [
    { id: 'v23', zh: '2-3 人', en: '2-3P' },
    { id: 'v45', zh: '4-5 人', en: '4-5P' },
    { id: 'v6',  zh: '6 人以上', en: '6P+' }
  ];
  function verIndex(vid) { for (var i = 0; i < VERSIONS.length; i++) { if (VERSIONS[i].id === vid) return i; } return 0; }
  // 期間短標籤(給投播畫面徽章用)
  var PERIOD_TAG = {
    live:    { zh: '即時', en: 'LIVE' },
    quarter: { zh: '季度', en: 'QUARTER' },
    annual:  { zh: '年度', en: 'ANNUAL' }
  };
  // 期別文字(2026 第 3 季 / 2026 年度)
  function periodTitle(period) {
    var now = new Date(), y = now.getFullYear();
    if (period === 'quarter') { var q = Math.floor(now.getMonth() / 3) + 1; return { zh: y + ' 第 ' + q + ' 季', en: y + ' Q' + q }; }
    if (period === 'annual') { return { zh: y + ' 年度總榜', en: y + ' SEASON' }; }
    return { zh: '即時更新', en: 'LIVE' };
  }

  window.LB = {
    regions: function () {
      return META.map(function (s) {
        return { id: s.id, zh: s.zh, en: s.en, venues: s.venues.map(function (v) { return { id: v.id, zh: v.zh, en: v.en }; }) };
      });
    },
    current: function (rid, vid) {
      var f = find(rid, vid); if (!f.v) return null;
      return pack(f, format(STORE[rid + '/' + vid]));
    },
    capture: function (rid, vid) {
      var key = rid + '/' + vid, st = STORE[key]; if (!st) return null;
      st.forEach(function (row) { if (Math.random() < 0.6) row.score += Math.floor(Math.random() * 45000); });
      return pack(find(rid, vid), format(st));
    },

    /* updateTeam — 修改隊伍名稱(雙語同步)。
       teamId 來自 row._id;newName 限 20 字以內;成功回 true,失敗回 false。
       現在只更動本機記憶體;未來接雲端時,在這裡加 fetch('https://cloud/api/team', { method:'PATCH', ... })
       本機改 + 雲端 PATCH 可以同步進行(樂觀更新),失敗時再回滾。 */
    updateTeam: function (rid, vid, teamId, newName) {
      var key = rid + '/' + vid, st = STORE[key]; if (!st) return false;
      var entry = null;
      for (var i = 0; i < st.length; i++) { if (st[i]._id === teamId) { entry = st[i]; break; } }
      if (!entry) return false;
      var name = String(newName == null ? '' : newName).trim().slice(0, 20);
      if (!name) return false;
      entry.zh = name;
      entry.en = name;
      // TODO 雲端同步占位:
      // fetch('/api/leaderboard/team', { method:'PATCH', body: JSON.stringify({ rid:rid, vid:vid, teamId:teamId, name:name }) });
      return true;
    },

    // 回傳人數版本清單
    versions: function () {
      return VERSIONS.map(function (v) { return { id: v.id, zh: v.zh, en: v.en }; });
    },

    /* board — 取某店家 × 場域 × 人數版本 × 期間 的排行榜。
       period: 'live' | 'quarter' | 'annual'(預設 live)。
       輸出沿用即時榜格式,另附 version / period / periodTag / periodTitle 供投播畫面顯示。
       live 直接用目前即時資料;quarter / annual 以版本+期間各自的種子產生不同名次,
       年度分數較高(全年累積感)、季度略低。真接資料時把這裡換成讀 DB 即可。 */
    board: function (rid, vid, verId, period) {
      period = period || 'live';
      var f = find(rid, vid); if (!f.v) return null;
      var vi = verIndex(verId), ver = VERSIONS[vi];
      var rows;
      if (period === 'live') {
        rows = format(STORE[rid + '/' + vid]);
      } else {
        var offset = (period === 'quarter' ? 700 : 1300) + vi * 37;
        var scale = period === 'annual' ? 1.18 : 0.86;
        var st = buildState(f.rg._pool, f.v._seed + offset);
        st.forEach(function (r) { r.score = Math.max(50000, Math.round(r.score * scale)); });
        rows = format(st);
      }
      return {
        region: { zh: f.rg.zh, en: f.rg.en },
        venue: { zh: f.v.zh, en: f.v.en },
        version: { id: ver.id, zh: ver.zh, en: ver.en },
        period: period,
        periodTag: PERIOD_TAG[period] || PERIOD_TAG.live,
        periodTitle: periodTitle(period),
        rows: rows,
        updated: Date.now()
      };
    }
  };
})();