/**
 * 共用資料模組 — 模擬「遊戲包資料庫」匯出的內容(雙語)
 * 階層：店家 STORE → 場域 FIELD (格子盤,如 480 / 225 / 64 格)
 *
 * 之後接雲端 API 時,只需把 current/capture/updateTeam 內部換成
 * fetch(...) 或 WebSocket,輸出格式(Payload/Row/RegionInfo)維持不變。
 */

// ==================== 型別定義 ====================

export type Lang = 'zh' | 'en';

export interface VenueInfo {
  id: string;
  zh: string;
  en: string;
}

export interface RegionInfo {
  id: string;
  zh: string;
  en: string;
  venues: VenueInfo[];
}

export interface Row {
  _id: string;
  teamZh: string;
  teamEn: string;
  stage: string;
  time: string;
  score: string;
}

export interface Payload {
  region: { zh: string; en: string };
  venue: { zh: string; en: string };
  rows: Row[];
  updated: number;
  /** 供跨頁比對「這份 cast 是不是我剛剛改的店家/場域」用 */
  _storeId?: string;
  _venueId?: string;
  /** 廣播畫面用,決定顯示直式或橫式 */
  orientation?: 'portrait' | 'landscape';
  /** 人數版本(2-3 人…) */
  version?: { id?: string; zh: string; en: string };
  /** 期間:即時 / 季度 / 年度 */
  period?: Period;
  /** 期間短標籤(徽章用) */
  periodTag?: { zh: string; en: string };
  /** 期別文字(2026 第 3 季 / 2026 年度) */
  periodTitle?: { zh: string; en: string };
  _versionId?: string;
  /** 多榜輪播:投播畫面依此陣列每 rotateMs 切換一張 */
  boards?: Payload[];
  rotateMs?: number;
}

export type Period = 'live' | 'quarter' | 'annual';

export interface VersionInfo {
  id: string;
  zh: string;
  en: string;
}

// ==================== 內部工具 ====================

function rng(seed: number): () => number {
  return function () {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function shuffle<T>(a: T[], r: () => number): T[] {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 動態關卡：9-5 → 1-1 共 45 階,超過則回 1-1
function stageFor(i: number): string {
  if (i < 45) {
    const chapter = 9 - Math.floor(i / 5);
    const sub = 5 - (i % 5);
    return `${chapter}-${sub}`;
  }
  return '1-1';
}

function fmtScore(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.floor((s * 100) % 100);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

interface StateEntry {
  _id: string;
  zh: string;
  en: string;
  score: number;
  secs: number;
}

function buildState(teams: [string, string][], seed: number): StateEntry[] {
  const r = rng(seed);
  const t = shuffle(teams, r);
  return t.map((tm, i) => ({
    _id: `t_${seed}_${i}`,
    zh: tm[0],
    en: tm[1],
    score: Math.max(50000, 9990000 - i * 150000 - Math.floor(r() * 80000)),
    secs: 380 + i * 18 + Math.floor(r() * 40)
  }));
}

function format(state: StateEntry[]): Row[] {
  const rows = state.slice().sort((a, b) => b.score - a.score);
  return rows.map((row, i) => ({
    _id: row._id,
    teamZh: row.zh,
    teamEn: row.en,
    stage: stageFor(i),
    time: fmtTime(row.secs),
    score: fmtScore(row.score)
  }));
}

// ==================== 假資料池 ====================

// 賽博龐克 / 西式科技(台北旗艦店)
const POOL_A: [string, string][] = [
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
const POOL_B: [string, string][] = [
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
const POOL_C: [string, string][] = [
  ['熱帶風暴', 'TROPIC STORM'], ['霓虹叢林', 'NEON JUNGLE'], ['數位猛虎', 'DIGITAL TIGER'], ['賽博象神', 'CYBER GANESHA'],
  ['像素榴槤', 'PIXEL DURIAN'], ['暗影海灣', 'SHADOW BAY'], ['電弧椰林', 'ARC PALMS'], ['故障季風', 'GLITCH MONSOON'],
  ['合成蘭花', 'SYNTH ORCHID'], ['終端群島', 'TERMINAL ISLES'], ['量子珊瑚', 'QUANTUM CORAL'], ['鉻金鱷魚', 'CHROME CROCODILE'],
  ['霓虹芒果', 'NEON MANGO'], ['像素鳳梨', 'PIXEL PINEAPPLE'], ['暗黑火山', 'DARK VOLCANO'], ['電光浪潮', 'VOLT WAVE'],
  ['數據颱風', 'DATA TYPHOON'], ['故障雷鳴', 'GLITCH THUNDER'], ['合成棕櫚', 'SYNTH PALM'], ['鋼鐵海龜', 'STEEL TURTLE'],
  ['終端潛艇', 'TERMINAL SUBMARINE'], ['霓虹海星', 'NEON STARFISH'], ['鉻金海豚', 'CHROME DOLPHIN'], ['暗影鯊魚', 'SHADOW SHARK'],
  ['像素珍珠', 'PIXEL PEARL'], ['量子海流', 'QUANTUM CURRENT'], ['電弧暴雨', 'ARC RAIN'], ['故障烈日', 'GLITCH SUN'],
  ['合成熱浪', 'SYNTH HEATWAVE'], ['終端極光', 'TERMINAL AURORA']
];

const FIELDS: VenueInfo[] = [
  { id: 'f480', zh: '480 格', en: '480-CELL' },
  { id: 'f225', zh: '225 格', en: '225-CELL' },
  { id: 'f64',  zh: '64 格',  en: '64-CELL' }
];

interface StoreMeta {
  id: string;
  zh: string;
  en: string;
  pool: [string, string][];
  base: number;
}

const STORES: StoreMeta[] = [
  { id: 'tpe', zh: '台北旗艦店', en: 'TAIPEI FLAGSHIP', pool: POOL_A, base: 1000 },
  { id: 'khh', zh: '高雄電競店', en: 'KAOHSIUNG STORE', pool: POOL_B, base: 2000 },
  { id: 'tc',  zh: '台中電競店', en: 'TAICHUNG STORE', pool: POOL_C, base: 3000 }
];

interface MetaEntry {
  id: string;
  zh: string;
  en: string;
  venues: (VenueInfo & { _seed: number })[];
  _pool: [string, string][];
}

const META: MetaEntry[] = STORES.map((s) => ({
  id: s.id,
  zh: s.zh,
  en: s.en,
  venues: FIELDS.map((f, fi) => ({ ...f, _seed: s.base + fi * 11 + 1 })),
  _pool: s.pool
}));

// 各店家 × 各場域的分數狀態(可變動,capture 每次呼叫會微幅隨機更新)
const STORE: Record<string, StateEntry[]> = {};
META.forEach((s) => {
  s.venues.forEach((v) => {
    STORE[`${s.id}/${v.id}`] = buildState(s._pool, v._seed);
  });
});

function find(rid: string, vid: string) {
  const s = META.find((r) => r.id === rid);
  const v = s?.venues.find((x) => x.id === vid);
  return { rg: s, v };
}

function pack(rg: MetaEntry, v: VenueInfo, rows: Row[]): Payload {
  return {
    region: { zh: rg.zh, en: rg.en },
    venue: { zh: v.zh, en: v.en },
    rows,
    updated: Date.now()
  };
}

// ==================== 人數版本 + 期間榜 ====================

const VERSIONS: VersionInfo[] = [
  { id: 'v23', zh: '2-3 人', en: '2-3P' },
  { id: 'v45', zh: '4-5 人', en: '4-5P' },
  { id: 'v6',  zh: '6 人以上', en: '6P+' }
];
function verIndex(vid: string): number {
  const i = VERSIONS.findIndex((v) => v.id === vid);
  return i >= 0 ? i : 0;
}

const PERIOD_TAG: Record<Period, { zh: string; en: string }> = {
  live:    { zh: '即時', en: 'LIVE' },
  quarter: { zh: '季度', en: 'QUARTER' },
  annual:  { zh: '年度', en: 'ANNUAL' }
};

function periodTitle(period: Period): { zh: string; en: string } {
  const now = new Date();
  const y = now.getFullYear();
  if (period === 'quarter') {
    const q = Math.floor(now.getMonth() / 3) + 1;
    return { zh: `${y} 第 ${q} 季`, en: `${y} Q${q}` };
  }
  if (period === 'annual') return { zh: `${y} 年度總榜`, en: `${y} SEASON` };
  return { zh: '即時更新', en: 'LIVE' };
}

// ==================== 對外 API ====================

/** 拿全部店家 + 場域清單(給下拉選單用) */
export function regions(): RegionInfo[] {
  return META.map((s) => ({
    id: s.id,
    zh: s.zh,
    en: s.en,
    venues: s.venues.map((v) => ({ id: v.id, zh: v.zh, en: v.en }))
  }));
}

/** 拿目前的排行榜(不變動資料,純讀) */
export function current(rid: string, vid: string): Payload | null {
  const f = find(rid, vid);
  if (!f.rg || !f.v) return null;
  return pack(f.rg, f.v, format(STORE[`${rid}/${vid}`]));
}

/** 模擬「定期擷取」一次,分數會微幅隨機增加 */
export function capture(rid: string, vid: string): Payload | null {
  const key = `${rid}/${vid}`;
  const st = STORE[key];
  if (!st) return null;
  st.forEach((row) => {
    if (Math.random() < 0.6) row.score += Math.floor(Math.random() * 45000);
  });
  const f = find(rid, vid);
  if (!f.rg || !f.v) return null;
  return pack(f.rg, f.v, format(st));
}

/**
 * 修改隊伍名稱(雙語同步)
 * teamId 來自 row._id;newName 限 20 字以內;成功回 true,失敗回 false
 *
 * 之後接雲端時,在這裡加 fetch('/api/team', { method:'PATCH', ... })
 * 樂觀更新策略：本機先改(下方 return true)+ 背景 PATCH,失敗再回滾。
 */
export function updateTeam(rid: string, vid: string, teamId: string, newName: string): boolean {
  const key = `${rid}/${vid}`;
  const st = STORE[key];
  if (!st) return false;
  const entry = st.find((e) => e._id === teamId);
  if (!entry) return false;
  const name = String(newName ?? '').trim().slice(0, 20);
  if (!name) return false;
  entry.zh = name;
  entry.en = name;
  // TODO 雲端同步:
  // fetch('/api/leaderboard/team', {
  //   method: 'PATCH',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ rid, vid, teamId, name })
  // }).catch(() => { entry.zh = oldName; entry.en = oldName; });
  return true;
}

/** 回傳人數版本清單 */
export function versions(): VersionInfo[] {
  return VERSIONS.map((v) => ({ id: v.id, zh: v.zh, en: v.en }));
}

/**
 * 取某店家 × 場域 × 人數版本 × 期間 的排行榜
 * period: 'live' | 'quarter' | 'annual'(預設 live)
 * 輸出沿用 Payload 格式,另附 version / period / periodTag / periodTitle 供投播畫面顯示。
 * live 直接用即時資料;quarter / annual 以版本+期間各自的種子產生不同名次,
 * 年度分數較高(全年累積感)、季度略低。真接資料時把這裡換成讀 DB 即可。
 */
export function board(rid: string, vid: string, verId: string, period: Period = 'live'): Payload | null {
  const f = find(rid, vid);
  if (!f.rg || !f.v) return null;
  const vi = verIndex(verId);
  const ver = VERSIONS[vi];
  let rows: Row[];
  if (period === 'live') {
    rows = format(STORE[`${rid}/${vid}`]);
  } else {
    const offset = (period === 'quarter' ? 700 : 1300) + vi * 37;
    const scale = period === 'annual' ? 1.18 : 0.86;
    const st = buildState(f.rg._pool, f.v._seed + offset).map((r) => ({
      ...r,
      score: Math.max(50000, Math.round(r.score * scale))
    }));
    rows = format(st);
  }
  return {
    region: { zh: f.rg.zh, en: f.rg.en },
    venue: { zh: f.v.zh, en: f.v.en },
    version: { id: ver.id, zh: ver.zh, en: ver.en },
    period,
    periodTag: PERIOD_TAG[period],
    periodTitle: periodTitle(period),
    rows,
    updated: Date.now()
  };
}

/** 一次匯出所有可用 API,方便 Composable 引用 */
export const LB = { regions, current, capture, updateTeam, versions, board };
