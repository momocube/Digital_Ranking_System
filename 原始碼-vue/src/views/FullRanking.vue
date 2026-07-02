<script setup lang="ts">
/**
 * 完整名次 FullRanking.vue — 跨店家 / 場域檢視 + 篩選 + 搜尋 + 排序 + 雙擊編輯
 * 對應舊版 完整名次.dc.html。功能:
 *  - 篩選:店家 / 場域 / 關鍵字搜尋
 *  - 排序:欄位表頭點擊 或 右側「排名 / 時間」快捷按鈕(共用 state)
 *  - 排名數字永遠依「真實分數遞減」計算(金/銀/銅色跟著排名走,不受顯示順序影響)
 *  - 雙擊隊名進入編輯,Enter 儲存 / Esc 取消 / 失焦儲存
 *  - 20 字硬擋(maxlength + 即時 slice)
 *  - 編輯後即時同步:若目前 cast / preview 是這場,重寫 localStorage 觸發 storage event
 *  - 每 8 秒自動重新讀資料
 */
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useLanguage } from '@/composables/useLanguage';
import { LB, type RegionInfo, type Payload } from '@/data/leaderboard-data';

const { lang, en, setLang } = useLanguage();

// ---- 篩選 / 排序 / 編輯 state ----
const regions = ref<RegionInfo[]>([]);
const storeFilter = ref('all');
const venueFilter = ref('all');
const search = ref('');
type SortBy = 'rank' | 'store' | 'venue' | 'team' | 'stage' | 'time' | 'score';
type SortDir = 'asc' | 'desc';
const sortBy = ref<SortBy>('score');
const sortDir = ref<SortDir>('desc');
const tick = ref(0);

interface EditInfo { id: string; storeId: string; venueId: string; current: string; }
const editing = ref<EditInfo | null>(null);
const editValue = ref('');

// ---- 時間顯示(每秒更新) ----
const now = ref(new Date());
let clockTimer: number | undefined;
let dataTimer: number | undefined;

onMounted(() => {
  regions.value = LB.regions();
  clockTimer = window.setInterval(() => { now.value = new Date(); }, 1000);
  // 每 8 秒重新拉資料(跟控制台的擷取節奏對齊)
  dataTimer = window.setInterval(() => { tick.value = Date.now(); }, 8000);

  // 編輯狀態變化時自動 focus + select input
  watch(editing, async (info) => {
    if (info) {
      await nextTick();
      const el = document.querySelector<HTMLInputElement>('.team-edit');
      if (el) { el.focus(); el.select(); }
    }
  });
});

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer);
  if (dataTimer) clearInterval(dataTimer);
});

// ---- 篩選 / 排序 handlers ----
const onStore  = (e: Event) => { storeFilter.value = (e.target as HTMLSelectElement).value; venueFilter.value = 'all'; };
const onVenue  = (e: Event) => { venueFilter.value = (e.target as HTMLSelectElement).value; };
const onSearch = (e: Event) => { search.value = (e.target as HTMLInputElement).value; };
const reset    = () => { storeFilter.value = 'all'; venueFilter.value = 'all'; search.value = ''; sortBy.value = 'score'; sortDir.value = 'desc'; };

function toggleSort(col: SortBy) {
  if (sortBy.value === col) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    const def: Record<SortBy, SortDir> = { rank: 'asc', store: 'asc', venue: 'asc', team: 'asc', stage: 'desc', time: 'asc', score: 'desc' };
    sortBy.value = col;
    sortDir.value = def[col];
  }
}
const setSortRank = () => { sortBy.value = 'score'; sortDir.value = 'desc'; };
const setSortTime = () => { sortBy.value = 'time';  sortDir.value = 'asc'; };

// ---- 編輯流程 ----
const startEdit = (info: EditInfo) => {
  editing.value = info;
  editValue.value = String(info.current || '').slice(0, 20);
};
const cancelEdit = () => { editing.value = null; editValue.value = ''; };
const onEditChange = (e: Event) => {
  const raw = String((e.target as HTMLInputElement).value ?? '');
  const clipped = raw.slice(0, 20);
  if (clipped !== raw) { try { (e.target as HTMLInputElement).value = clipped; } catch {} }
  editValue.value = clipped;
};
const commitEdit = () => {
  const ed = editing.value; if (!ed) return;
  const name = editValue.value.trim().slice(0, 20);
  if (!name) { cancelEdit(); return; }
  if (name !== ed.current) {
    LB.updateTeam(ed.storeId, ed.venueId, ed.id, name);
    syncToCastPreview(ed.storeId, ed.venueId);
  }
  editing.value = null;
  editValue.value = '';
  tick.value = Date.now();  // 觸發表格重算
};
const onEditKey = (e: KeyboardEvent) => {
  if (e.key === 'Enter')       { e.preventDefault(); commitEdit(); }
  else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
};

// 若目前 cast / preview 是這個 store/venue,重寫 localStorage → 投播畫面即時更新
function syncToCastPreview(storeId: string, venueId: string) {
  const refresh = (key: string) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const cur = JSON.parse(raw) as Payload;
      if (cur && cur._storeId === storeId && cur._venueId === venueId) {
        const fresh = LB.current(storeId, venueId);
        if (fresh) {
          const next: Payload = {
            ...fresh,
            _storeId: storeId,
            _venueId: venueId,
            orientation: cur.orientation || 'portrait',
            updated: Date.now()
          };
          localStorage.setItem(key, JSON.stringify(next));
        }
      }
    } catch {}
  };
  refresh('leaderboard_cast');
  refresh('leaderboard_preview');
}

// ==================== 顯示 computed ====================

const sid = computed(() => storeFilter.value);
const vid = computed(() => venueFilter.value);

// ---- 篩選下拉選項 ----
const storeOpts = computed(() => [
  { id: 'all', label: en.value ? 'ALL STORES' : '全部店家' },
  ...regions.value.map((r) => ({ id: r.id, label: en.value ? r.en : `${r.zh} · ${r.en}` }))
]);

const baseStore = computed<RegionInfo | undefined>(() => {
  if (sid.value !== 'all') return regions.value.find((r) => r.id === sid.value);
  return regions.value[0];
});
const venueSrc = computed(() => baseStore.value?.venues ?? []);
const venueOpts = computed(() => [
  { id: 'all', label: en.value ? 'ALL FIELDS' : '全部場域' },
  ...venueSrc.value.map((v) => ({ id: v.id, label: en.value ? v.en : `${v.zh} · ${v.en}` }))
]);

// ---- 資料聚合 → 篩選 → 排名 → 排序 ----
interface AllRow {
  id: string; storeId: string; venueId: string;
  storeZh: string; storeEn: string;
  venueZh: string; venueEn: string;
  teamZh: string; teamEn: string;
  stage: string; time: string; score: string;
  scoreNum: number;
  rankNum: number;
}
const buildAll = computed<AllRow[]>(() => {
  // 用 tick 強制 recompute(即使 LB 內部狀態沒改也重新算)
  void tick.value;
  const all: AllRow[] = [];
  for (const r of regions.value) {
    if (sid.value !== 'all' && r.id !== sid.value) continue;
    for (const v of r.venues) {
      if (vid.value !== 'all' && v.id !== vid.value) continue;
      const data = LB.current(r.id, v.id);
      if (!data) continue;
      for (const row of data.rows) {
        all.push({
          id: row._id, storeId: r.id, venueId: v.id,
          storeZh: r.zh, storeEn: r.en,
          venueZh: v.zh, venueEn: v.en,
          teamZh: row.teamZh, teamEn: row.teamEn,
          stage: row.stage, time: row.time, score: row.score,
          scoreNum: parseInt(String(row.score).replace(/,/g, ''), 10),
          rankNum: 0
        });
      }
    }
  }

  // 關鍵字篩選
  const q = search.value.trim().toLowerCase();
  const filtered = q
    ? all.filter((x) =>
        x.teamZh.toLowerCase().includes(q) ||
        x.teamEn.toLowerCase().includes(q) ||
        x.storeZh.toLowerCase().includes(q) ||
        x.storeEn.toLowerCase().includes(q) ||
        x.venueZh.toLowerCase().includes(q) ||
        x.venueEn.toLowerCase().includes(q)
      )
    : all;

  // 先依分數遞減決定「真實排名」(rankNum 給金/銀/銅色用,不受顯示排序影響)
  filtered.sort((a, b) => b.scoreNum - a.scoreNum);
  filtered.forEach((x, i) => { x.rankNum = i + 1; });

  // 再依當前 sortBy / sortDir 排出顯示順序
  const sign = sortDir.value === 'asc' ? 1 : -1;
  const stageNum = (s: string): number => {
    const m = s.match(/(\d+)-(\d+)/);
    return m ? parseInt(m[1], 10) * 10 + parseInt(m[2], 10) : 0;
  };
  const cmp = (a: AllRow, b: AllRow): number => {
    let av: string | number, bv: string | number;
    switch (sortBy.value) {
      case 'rank':  av = a.rankNum; bv = b.rankNum; break;
      case 'store': av = en.value ? a.storeEn : a.storeZh; bv = en.value ? b.storeEn : b.storeZh; break;
      case 'venue': av = en.value ? a.venueEn : a.venueZh; bv = en.value ? b.venueEn : b.venueZh; break;
      case 'team':  av = (en.value ? a.teamEn : a.teamZh) || ''; bv = (en.value ? b.teamEn : b.teamZh) || ''; break;
      case 'stage': av = stageNum(a.stage); bv = stageNum(b.stage); break;
      case 'time':  av = a.time; bv = b.time; break;
      case 'score':
      default:      av = a.scoreNum; bv = b.scoreNum;
    }
    if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * sign;
    if (av < bv) return -1 * sign;
    if (av > bv) return 1 * sign;
    return 0;
  };
  filtered.sort(cmp);
  return filtered;
});

// ---- 顯示用 row 物件 ----
const truncate = (s: string): string => s.length <= 20 ? s : s.slice(0, 19) + '…';

interface TierColor { r: string; t: string; }
const tierColors: TierColor[] = [
  { r: '#ffe27a', t: '#ffffff' },
  { r: '#aef4ff', t: '#eafdff' },
  { r: '#ff8fd0', t: '#ffeaf6' }
];

const rows = computed(() => buildAll.value.map((x) => {
  const rk = x.rankNum;
  const top = rk <= 3;
  const c: TierColor = top ? tierColors[rk - 1] : { r: '#5f93a8', t: '#dff6ff' };
  const rawName = en.value ? (x.teamEn || x.teamZh) : (x.teamZh || x.teamEn);
  return {
    id: x.id,
    storeId: x.storeId, venueId: x.venueId,
    rank: String(rk).padStart(2, '0'),
    store: en.value ? x.storeEn : x.storeZh,
    venue: en.value ? x.venueEn : x.venueZh,
    rawName,
    team: truncate(rawName),
    stage: x.stage, time: x.time, score: x.score,
    rankStyle:  { fontFamily: 'Orbitron,sans-serif', fontWeight: '700', fontSize: 'clamp(14px,1.9vh,17px)', color: c.r, textAlign: 'center', textShadow: top ? `0 0 10px ${c.r}` : 'none' } as Record<string, string>,
    teamStyle:  { fontFamily: en.value ? 'Rajdhani,sans-serif' : "'Noto Sans TC',sans-serif", fontWeight: '700', fontSize: 'clamp(13px,1.8vh,16px)', color: c.t, letterSpacing: en.value ? '1px' : '0' } as Record<string, string>,
    stageStyle: { fontFamily: 'Orbitron,sans-serif', fontWeight: '700', fontSize: 'clamp(12px,1.6vh,15px)', color: c.r, textAlign: 'center' } as Record<string, string>,
    scoreStyle: { fontFamily: 'Orbitron,sans-serif', fontWeight: '700', fontSize: 'clamp(13px,1.8vh,16px)', color: '#ff5db4', textAlign: 'right', textShadow: '0 0 10px rgba(255,45,149,.3)' } as Record<string, string>
  };
}));

const isEditingRow = (id: string) => editing.value?.id === id;
const onStartEdit = (r: { id: string; storeId: string; venueId: string; rawName: string; }) => {
  startEdit({ id: r.id, storeId: r.storeId, venueId: r.venueId, current: r.rawName });
};

// ---- 標題 ----
const titleZh = computed(() => {
  if (sid.value !== 'all') {
    const s = regions.value.find((r) => r.id === sid.value);
    if (s) {
      if (vid.value !== 'all') {
        const v = s.venues.find((x) => x.id === vid.value);
        if (v) return `${s.zh} · ${v.zh}`;
      }
      return s.zh;
    }
  } else if (vid.value !== 'all') {
    const v = venueSrc.value.find((x) => x.id === vid.value);
    if (v) return `全部店家 · ${v.zh}`;
  }
  return '全部店家 · 全部場域';
});
const titleEn = computed(() => {
  if (sid.value !== 'all') {
    const s = regions.value.find((r) => r.id === sid.value);
    if (s) {
      if (vid.value !== 'all') {
        const v = s.venues.find((x) => x.id === vid.value);
        if (v) return `${s.en} · ${v.en}`;
      }
      return s.en;
    }
  } else if (vid.value !== 'all') {
    const v = venueSrc.value.find((x) => x.id === vid.value);
    if (v) return `ALL STORES · ${v.en}`;
  }
  return 'ALL STORES · ALL FIELDS';
});
const titleZhStyle: Record<string, string> = {
  fontFamily: "'Noto Sans TC',sans-serif", fontWeight: '900',
  fontSize: 'clamp(22px,3.6vh,36px)', lineHeight: '1',
  color: '#eafdff', textShadow: '0 0 20px rgba(0,229,255,.5)'
};

// ---- 語言切換 / 排序按鈕樣式 ----
const langBase: Record<string, string> = { fontFamily: 'Rajdhani,sans-serif', fontWeight: '700', fontSize: 'clamp(11px,1.4vh,14px)', letterSpacing: '2px', padding: 'clamp(5px,0.8vh,7px) clamp(10px,1.4vw,16px)', cursor: 'pointer', border: '1px solid rgba(0,229,255,.3)', background: 'rgba(0,0,0,.4)', color: '#5f93a8' };
const langOn:   Record<string, string> = { ...langBase, border: '1px solid #34c8e8', background: 'rgba(0,229,255,.16)', color: '#eafdff' };

const sortRankBtn = computed<Record<string, string>>(() => sortBy.value === 'score'
  ? { flex: '1', padding: 'clamp(10px,1.5vh,14px) 0', fontFamily: 'Rajdhani,sans-serif', fontWeight: '700', fontSize: 'clamp(11px,1.5vh,14px)', letterSpacing: '3px', color: '#eafdff', background: 'rgba(0,229,255,.18)', border: '1px solid #34c8e8', boxShadow: '0 0 14px rgba(0,229,255,.25) inset', cursor: 'pointer' }
  : { flex: '1', padding: 'clamp(10px,1.5vh,14px) 0', fontFamily: 'Rajdhani,sans-serif', fontWeight: '700', fontSize: 'clamp(11px,1.5vh,14px)', letterSpacing: '3px', color: '#5f93a8', background: 'rgba(0,0,0,.3)', border: '1px solid rgba(0,229,255,.25)', cursor: 'pointer' });

const sortTimeBtn = computed<Record<string, string>>(() => sortBy.value === 'time'
  ? { flex: '1', padding: 'clamp(10px,1.5vh,14px) 0', fontFamily: 'Rajdhani,sans-serif', fontWeight: '700', fontSize: 'clamp(11px,1.5vh,14px)', letterSpacing: '3px', color: '#eafdff', background: 'rgba(255,45,149,.18)', border: '1px solid #ff6bb0', boxShadow: '0 0 14px rgba(255,45,149,.25) inset', cursor: 'pointer' }
  : { flex: '1', padding: 'clamp(10px,1.5vh,14px) 0', fontFamily: 'Rajdhani,sans-serif', fontWeight: '700', fontSize: 'clamp(11px,1.5vh,14px)', letterSpacing: '3px', color: '#5f93a8', background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,45,149,.25)', cursor: 'pointer' });

// ---- 欄位表頭箭頭 ----
const arrowFor = (col: SortBy) => sortBy.value === col ? (sortDir.value === 'asc' ? ' ▲' : ' ▼') : '';
const arrRank  = computed(() => arrowFor('rank'));
const arrStore = computed(() => arrowFor('store'));
const arrVenue = computed(() => arrowFor('venue'));
const arrTeam  = computed(() => arrowFor('team'));
const arrStage = computed(() => arrowFor('stage'));
const arrTime  = computed(() => arrowFor('time'));
const arrScore = computed(() => arrowFor('score'));

// ---- 標籤文字 ----
const p2 = (n: number) => String(n).padStart(2, '0');
const updatedText = computed(() => `${p2(now.value.getHours())}:${p2(now.value.getMinutes())}:${p2(now.value.getSeconds())}`);

const tStore = computed(() => en.value ? 'STORE' : '店家');
const tVenue = computed(() => en.value ? 'FIELD' : '場域');
const tSearch = computed(() => en.value ? 'SEARCH' : '搜尋');
const tSearchPh = computed(() => en.value ? 'team / store / field...' : '輸入隊伍 / 店家 / 場域關鍵字…');
const tReset = computed(() => en.value ? 'RESET' : '清除');
const tSortLabel = computed(() => en.value ? 'SORT BY' : '排序方式');
const tSortRank = computed(() => en.value ? 'RANK' : '排名');
const tSortTime = computed(() => en.value ? 'TIME' : '時間');
const tAutoSync = computed(() => en.value ? '● AUTO-SYNC · every 8s' : '● 自動同步 · 每 8 秒');
const tUpdated  = computed(() => (en.value ? '// LAST CHECK ' : '// 最後檢查 ') + updatedText.value);
const tLblRank  = computed(() => en.value ? 'RANK'  : '排名');
const tLblStore = computed(() => en.value ? 'STORE' : '店家');
const tLblVenue = computed(() => en.value ? 'FIELD' : '場域');
const tLblTeam  = computed(() => en.value ? 'TEAM'  : '隊伍');
const tLblStage = computed(() => en.value ? 'STAGE' : '關卡');
const tLblTime  = computed(() => en.value ? 'TIME'  : '破關時間');
const tLblScore = computed(() => en.value ? 'SCORE' : '分數');
const tFooterCount = computed(() => en.value ? `SHOWING ${rows.value.length} ROWS` : `共 ${rows.value.length} 筆`);
const tFooterRight = computed(() => en.value
  ? '// 5 SUB-STAGES PER TIER · NEON CLASH'
  : '// 每 5 小關晉升一大關 · NEON CLASH');
const tEmpty     = computed(() => en.value ? 'NO MATCHING RANKS' : '查無符合條件的名次');
const tEmptyHint = computed(() => en.value ? 'Try clearing filters or change keywords.' : '試試清除篩選或更換關鍵字。');
const dblclickHint = computed(() => en.value ? '✎ Double-click' : '✎ 雙擊編輯');
</script>

<template>
  <div class="fullrank-root">
    <div class="bg-grid"></div>

    <!-- 標題列 -->
    <div class="title-bar">
      <div>
        <div class="kicker">◢ NEON CLASH · FULL RANKING</div>
        <div class="title-row">
          <span :style="titleZhStyle">{{ titleZh }}</span>
          <span class="title-en">{{ titleEn }}</span>
        </div>
      </div>
      <div class="header-right">
        <div class="lang-btns">
          <button @click="setLang('zh')" :style="en ? langBase : langOn">中文</button>
          <button @click="setLang('en')" :style="en ? langOn : langBase">EN</button>
        </div>
        <div class="auto-sync">
          <div>{{ tAutoSync }}</div>
          <div class="check-time">{{ tUpdated }}</div>
        </div>
      </div>
    </div>

    <!-- 篩選列 -->
    <div class="filter-row">
      <div class="input-wrap">
        <label class="input-label">{{ tStore }}</label>
        <select :value="storeFilter" @change="onStore" class="select-cyan">
          <option v-for="o in storeOpts" :key="o.id" :value="o.id">{{ o.label }}</option>
        </select>
        <span class="select-arrow arrow-cyan">▼</span>
      </div>
      <div class="input-wrap">
        <label class="input-label">{{ tVenue }}</label>
        <select :value="venueFilter" @change="onVenue" class="select-pink">
          <option v-for="o in venueOpts" :key="o.id" :value="o.id">{{ o.label }}</option>
        </select>
        <span class="select-arrow arrow-pink">▼</span>
      </div>
      <div class="input-wrap">
        <label class="input-label">{{ tSearch }}</label>
        <input :value="search" @input="onSearch" :placeholder="tSearchPh" class="search-input" />
        <span class="search-icon">⌕</span>
      </div>
      <button @click="reset" class="btn-reset">{{ tReset }}</button>
      <div class="sort-group">
        <label class="input-label">{{ tSortLabel }}</label>
        <button @click="setSortRank" :style="sortRankBtn">{{ tSortRank }}</button>
        <button @click="setSortTime" :style="sortTimeBtn">{{ tSortTime }}</button>
      </div>
    </div>

    <!-- 表頭(可點擊排序) -->
    <div class="col-header">
      <div @click="toggleSort('rank')"  class="th th-center">{{ tLblRank }}{{ arrRank }}</div>
      <div @click="toggleSort('store')" class="th">{{ tLblStore }}{{ arrStore }}</div>
      <div @click="toggleSort('venue')" class="th">{{ tLblVenue }}{{ arrVenue }}</div>
      <div @click="toggleSort('team')"  class="th">{{ tLblTeam }}{{ arrTeam }}</div>
      <div @click="toggleSort('stage')" class="th th-center">{{ tLblStage }}{{ arrStage }}</div>
      <div @click="toggleSort('time')"  class="th th-right">{{ tLblTime }}{{ arrTime }}</div>
      <div @click="toggleSort('score')" class="th th-right">{{ tLblScore }}{{ arrScore }}</div>
    </div>

    <!-- 內容(可滾動) -->
    <div class="content">
      <template v-if="rows.length > 0">
        <div v-for="r in rows" :key="r.id" class="row row-hover">
          <div :style="r.rankStyle">{{ r.rank }}</div>
          <div class="cell-store">{{ r.store }}</div>
          <div class="cell-venue">{{ r.venue }}</div>
          <template v-if="!isEditingRow(r.id)">
            <div @dblclick="onStartEdit(r)" class="team-cell" :style="r.teamStyle" :data-hint="dblclickHint">{{ r.team }}</div>
          </template>
          <template v-else>
            <input
              class="team-edit"
              :value="editValue"
              @input="onEditChange"
              @keydown="onEditKey"
              @blur="commitEdit"
              maxlength="20"
            />
          </template>
          <div :style="r.stageStyle">{{ r.stage }}</div>
          <div class="cell-time">{{ r.time }}</div>
          <div :style="r.scoreStyle">{{ r.score }}</div>
        </div>
      </template>
      <div v-else class="empty-state">
        <div class="empty-icon">⌕</div>
        <div class="empty-main">{{ tEmpty }}</div>
        <div class="empty-hint">{{ tEmptyHint }}</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <span>&gt; {{ tFooterCount }}<span class="cursor">_</span></span>
      <span class="footer-right">{{ tFooterRight }}</span>
    </div>
  </div>
</template>

<style scoped>
/* ===== 容器 ===== */
.fullrank-root {
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(ellipse 80% 60% at 20% 0%, rgba(0, 229, 255, 0.08), transparent 60%),
    radial-gradient(ellipse 70% 60% at 100% 100%, rgba(255, 45, 149, 0.08), transparent 60%),
    #05070f;
  font-family: 'Noto Sans TC', sans-serif;
  padding: clamp(14px, 2.5vh, 32px) clamp(18px, 3vw, 40px);
  display: flex;
  flex-direction: column;
  gap: clamp(12px, 1.8vh, 20px);
  position: relative;
  color: #eafdff;
}
.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(0, 229, 255, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 229, 255, 0.04) 1px, transparent 1px);
  background-size: 48px 48px;
  animation: gridPan 20s linear infinite;
  pointer-events: none;
}

/* ===== 標題列 ===== */
.title-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid rgba(0, 229, 255, 0.2);
  padding-bottom: clamp(10px, 1.5vh, 18px);
  position: relative;
  z-index: 2;
  flex-shrink: 0;
}
.kicker {
  font-family: Rajdhani, sans-serif;
  font-weight: 700;
  font-size: clamp(11px, 1.4vh, 14px);
  letter-spacing: clamp(4px, 0.8vw, 7px);
  color: #34c8e8;
}
.title-row {
  display: flex;
  align-items: baseline;
  gap: clamp(10px, 1.5vw, 18px);
  margin-top: 6px;
}
.title-en {
  font-family: Orbitron, sans-serif;
  font-weight: 700;
  font-size: clamp(13px, 1.9vh, 18px);
  letter-spacing: 5px;
  color: #ff2d95;
}
.header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: clamp(8px, 1.2vh, 12px);
}
.lang-btns {
  display: flex;
  gap: 8px;
}
.auto-sync {
  font-family: 'Share Tech Mono', monospace;
  font-size: clamp(10px, 1.3vh, 13px);
  letter-spacing: 2px;
  color: #5fb6cf;
  text-align: right;
  line-height: 1.7;
}
.check-time { color: #3f7f93; }

/* ===== 篩選列 ===== */
.filter-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1.8fr clamp(90px, 11vw, 130px) clamp(150px, 15vw, 190px);
  gap: clamp(8px, 1vw, 14px);
  position: relative;
  z-index: 2;
  flex-shrink: 0;
}
.input-wrap {
  position: relative;
}
.input-label {
  position: absolute;
  top: -9px;
  left: 12px;
  background: #05070f;
  padding: 0 8px;
  font-family: Rajdhani, sans-serif;
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 3px;
  color: #4f8aa0;
  z-index: 3;
}
.select-cyan, .select-pink {
  width: 100%;
  padding: clamp(10px, 1.5vh, 14px) 38px clamp(10px, 1.5vh, 14px) 16px;
  font-family: 'Noto Sans TC', sans-serif;
  font-size: clamp(13px, 1.7vh, 16px);
  font-weight: 700;
  color: #eafdff;
  background: #0a1018;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
}
.select-cyan { border: 1px solid rgba(0, 229, 255, 0.35); }
.select-pink { border: 1px solid rgba(255, 45, 149, 0.35); }
.select-cyan option, .select-pink option {
  background: #0a1018;
  color: #eafdff;
}
.select-arrow {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  font-size: 11px;
}
.arrow-cyan { border-left: 1px solid rgba(0, 229, 255, 0.2); color: #34c8e8; }
.arrow-pink { border-left: 1px solid rgba(255, 45, 149, 0.2); color: #ff6bb0; }

.search-input {
  width: 100%;
  padding: clamp(10px, 1.5vh, 14px) 16px clamp(10px, 1.5vh, 14px) 42px;
  font-family: 'Noto Sans TC', sans-serif;
  font-size: clamp(13px, 1.7vh, 16px);
  color: #eafdff;
  background: #0a1018;
  border: 1px solid rgba(0, 229, 255, 0.35);
}
.search-input:focus {
  outline: none;
  border-color: #34c8e8;
}
.search-input::placeholder { color: #3f7f93; }
.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #34c8e8;
  font-size: 16px;
  pointer-events: none;
}

.btn-reset {
  padding: clamp(10px, 1.5vh, 14px) 0;
  font-family: Rajdhani, sans-serif;
  font-weight: 700;
  font-size: clamp(11px, 1.5vh, 14px);
  letter-spacing: 3px;
  color: #7fe6f8;
  background: rgba(0, 229, 255, 0.08);
  border: 1px solid rgba(0, 229, 255, 0.45);
  cursor: pointer;
}

.sort-group {
  position: relative;
  display: flex;
  gap: 6px;
  align-items: stretch;
}

/* ===== 表頭 ===== */
.col-header {
  display: grid;
  grid-template-columns: 60px 1.1fr 0.7fr 1.6fr 0.55fr 0.9fr 1fr;
  gap: clamp(8px, 1.2vw, 16px);
  padding: clamp(8px, 1.2vh, 12px) clamp(14px, 2vw, 22px);
  border: 1px solid rgba(0, 229, 255, 0.18);
  background: rgba(0, 229, 255, 0.04);
  font-family: Rajdhani, sans-serif;
  font-weight: 700;
  font-size: clamp(10px, 1.3vh, 12px);
  letter-spacing: 3px;
  color: #4f8aa0;
  position: relative;
  z-index: 2;
  flex-shrink: 0;
}
.th {
  cursor: pointer;
  user-select: none;
}
.th-center { text-align: center; }
.th-right  { text-align: right; }

/* ===== 內容區 ===== */
.content {
  flex: 1;
  overflow-y: auto;
  border: 1px solid rgba(0, 229, 255, 0.12);
  background: rgba(0, 0, 0, 0.2);
  position: relative;
  z-index: 2;
  min-height: 0;
}
.row {
  display: grid;
  grid-template-columns: 60px 1.1fr 0.7fr 1.6fr 0.55fr 0.9fr 1fr;
  gap: clamp(8px, 1.2vw, 16px);
  padding: clamp(10px, 1.4vh, 13px) clamp(14px, 2vw, 22px);
  align-items: center;
  border-bottom: 1px solid rgba(0, 229, 255, 0.06);
  transition: background 0.15s;
}
.row-hover:hover { background: rgba(0, 229, 255, 0.04); }

.cell-store {
  font-family: 'Noto Sans TC', sans-serif;
  font-size: clamp(12px, 1.6vh, 14px);
  color: #9fe9ff;
}
.cell-venue {
  font-family: 'Share Tech Mono', monospace;
  font-size: clamp(11px, 1.5vh, 13px);
  color: #ff8fc4;
  letter-spacing: 1px;
}
.cell-time {
  font-family: 'Share Tech Mono', monospace;
  font-size: clamp(11px, 1.5vh, 14px);
  color: #9fe9ff;
  text-align: right;
}

/* ===== 隊名 hover 提示 + 編輯 input ===== */
.team-cell {
  cursor: pointer;
  padding: 3px 6px;
  margin: -3px -6px;
  border-radius: 3px;
  transition: background 0.15s, box-shadow 0.15s;
  position: relative;
}
.team-cell:hover {
  background: rgba(0, 229, 255, 0.1);
  box-shadow: inset 0 0 0 1px rgba(0, 229, 255, 0.25);
}
.team-cell:hover::after {
  content: attr(data-hint);
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px;
  letter-spacing: 1px;
  color: #34c8e8;
  opacity: 0.7;
  pointer-events: none;
}
.team-edit {
  width: 100%;
  padding: 6px 10px;
  font-family: 'Noto Sans TC', sans-serif;
  font-weight: 700;
  color: #eafdff;
  background: #0a1018;
  border: 1px solid #34c8e8;
  outline: none;
  box-shadow: 0 0 12px rgba(0, 229, 255, 0.4);
}
.team-edit:focus { border-color: #7fe6f8; }

/* ===== 空狀態 ===== */
.empty-state {
  padding: clamp(40px, 8vh, 80px) 20px;
  text-align: center;
  font-family: 'Noto Sans TC', sans-serif;
  color: #5f93a8;
}
.empty-icon {
  font-size: clamp(36px, 5vh, 52px);
  margin-bottom: 14px;
  opacity: 0.5;
}
.empty-main {
  font-size: clamp(14px, 1.8vh, 17px);
  font-weight: 700;
  color: #7fb6c8;
}
.empty-hint {
  font-size: clamp(11px, 1.4vh, 13px);
  margin-top: 6px;
  color: #4f8aa0;
}

/* ===== Footer ===== */
.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: 'Share Tech Mono', monospace;
  font-size: clamp(10px, 1.3vh, 12px);
  letter-spacing: 2px;
  color: #3f7f93;
  position: relative;
  z-index: 2;
  flex-shrink: 0;
}
.cursor { color: #34c8e8; }
.footer-right { color: #ff6bb0; }
</style>
