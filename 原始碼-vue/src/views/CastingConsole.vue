<script setup lang="ts">
/**
 * 投播控制台 CastingConsole.vue — 選店家/場域/方向,推送資料給投播畫面
 * 對應舊版 投播控制台.dc.html。功能:
 *  - 8 秒輪詢 LB.capture 更新排行榜
 *  - 資料寫入 localStorage(leaderboard_preview / _cast) + postMessage 給預覽 iframe / cast window
 *  - 中英切換(共用 useLanguage,切了會 postMessage 通知投播畫面)
 *  - CAST 開新視窗到 broadcast.html#src=cast
 *  - 完整名次按鈕:開新分頁到 full-ranking.html
 *  - 監聽子視窗的 'ready' 訊息,把當下資料推過去
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useLanguage } from '@/composables/useLanguage';
import { LB, type RegionInfo, type Payload } from '@/data/leaderboard-data';

const { lang, en, setLang } = useLanguage();

// ---- 中央狀態 ----
type CastMode = 'individual' | 'rotation';
const regions = ref<RegionInfo[]>([]);
const regionId = ref('');
const venueId = ref('');
const orientation = ref<'portrait' | 'landscape'>('portrait');
const updated = ref(0);
const casting = ref(false);
const castWin = ref<Window | null>(null);
const iframeEl = ref<HTMLIFrameElement | null>(null);

// 投播模式:individual = 選單指定單一場域 / rotation = 挑選的場域自動輪播
const mode = ref<CastMode>('individual');
const rotationIndex = ref(0);
// 使用者勾選要進輪播的場域 ID 清單(預設全選)
const rotationVenueIds = ref<string[]>([]);
// 輪播秒數(可調),預設 12,範圍 3-120,存到 localStorage 讓下次開啟保留
const rotationSeconds = ref(12);
const ROT_MIN = 3;
const ROT_MAX = 120;

const iframeSrc = './broadcast.html#src=preview';

// ---- 生命週期 ----
let poller: number | undefined;
let rotationTimer: number | undefined;

const startRotation = () => {
  stopRotation();
  rotationTimer = window.setInterval(() => {
    const vs = effectiveRotationVenues.value;
    if (vs.length === 0) return;  // 沒勾任何場域就停留在原畫面
    rotationIndex.value = (rotationIndex.value + 1) % vs.length;
    pushPreview(false);
  }, rotationSeconds.value * 1000);
};
const stopRotation = () => {
  if (rotationTimer) { clearInterval(rotationTimer); rotationTimer = undefined; }
};

onMounted(() => {
  regions.value = LB.regions();
  const r0 = regions.value[0];
  if (r0) {
    regionId.value = r0.id;
    const v0 = r0.venues[0];
    if (v0) venueId.value = v0.id;
    // 輪播預設把該店家所有場域都勾起來(等於「全部」)
    rotationVenueIds.value = r0.venues.map((v) => v.id);
  }
  // 讀取上次保留的輪播秒數
  try {
    const stored = localStorage.getItem('leaderboard_rotation_seconds');
    if (stored) {
      const n = parseInt(stored, 10);
      if (!isNaN(n) && n >= ROT_MIN && n <= ROT_MAX) rotationSeconds.value = n;
    }
  } catch {}
  pushPreview(false);

  poller = window.setInterval(() => pushPreview(true), 8000);
  window.addEventListener('message', onMsg);
});

onUnmounted(() => {
  if (poller) clearInterval(poller);
  stopRotation();
  window.removeEventListener('message', onMsg);
});

// 語言變動時,通知 iframe / cast window
watch(lang, (l) => postLang(l));

// 模式切換:進入輪播就啟動計時器,回到各別就停掉
watch(mode, (m) => {
  if (m === 'rotation') {
    rotationIndex.value = 0;
    startRotation();
  } else {
    stopRotation();
  }
  pushPreview(false);
});

// 店家改變:重置輪播勾選(預設全勾)+ 回到第一個
watch(regionId, () => {
  rotationVenueIds.value = venuesOfCurrent.value.map((v) => v.id);
  if (mode.value === 'rotation') rotationIndex.value = 0;
});

// 輪播秒數變動:存 localStorage,若正在輪播就用新間隔重啟計時器
watch(rotationSeconds, (n) => {
  try { localStorage.setItem('leaderboard_rotation_seconds', String(n)); } catch {}
  if (mode.value === 'rotation') startRotation();
});

// 使用者輸入秒數,自動夾在 3-120 之間
const onSecondsInput = (e: Event) => {
  const raw = (e.target as HTMLInputElement).value;
  const n = parseInt(raw, 10);
  if (isNaN(n)) return;
  rotationSeconds.value = Math.max(ROT_MIN, Math.min(ROT_MAX, n));
};

// ---- 場域勾選(輪播模式) ----
const allSelected = computed(() =>
  venuesOfCurrent.value.length > 0 &&
  rotationVenueIds.value.length === venuesOfCurrent.value.length
);
const noneSelected = computed(() => rotationVenueIds.value.length === 0);

// 「全部」checkbox 的三態
type CheckState = 'checked' | 'unchecked' | 'indeterminate';
const allCheckState = computed<CheckState>(() => {
  if (allSelected.value) return 'checked';
  if (noneSelected.value) return 'unchecked';
  return 'indeterminate';
});

const toggleAll = () => {
  if (allSelected.value) {
    rotationVenueIds.value = [];
  } else {
    rotationVenueIds.value = venuesOfCurrent.value.map((v) => v.id);
  }
  rotationIndex.value = 0;
  if (mode.value === 'rotation') pushPreview(false);
};

const isVenueChecked = (id: string) => rotationVenueIds.value.includes(id);

const toggleVenue = (id: string) => {
  if (isVenueChecked(id)) {
    rotationVenueIds.value = rotationVenueIds.value.filter((x) => x !== id);
  } else {
    rotationVenueIds.value = [...rotationVenueIds.value, id];
  }
  rotationIndex.value = 0;
  if (mode.value === 'rotation') pushPreview(false);
};

// ---- 內部工具 ----
const venuesOfCurrent = computed(() => regions.value.find((r) => r.id === regionId.value)?.venues ?? []);

// 輪播模式下「有效可播」的場域(依 venuesOfCurrent 順序保留有勾選的)
const effectiveRotationVenues = computed(() =>
  venuesOfCurrent.value.filter((v) => rotationVenueIds.value.includes(v.id))
);

// 依模式決定「當下要投播哪個場域」:
//   individual → 使用者選單指定的 venueId
//   rotation   → 勾選的場域清單裡的第 rotationIndex 個
//                若沒勾任何場域則退回 venueId(避免畫面空白)
const currentVenueId = computed(() => {
  if (mode.value === 'rotation') {
    const vs = effectiveRotationVenues.value;
    if (vs.length === 0) return venueId.value;
    return vs[rotationIndex.value % vs.length].id;
  }
  return venueId.value;
});

function buildPayload(fresh: boolean): Payload | null {
  const vid = currentVenueId.value;
  if (!regionId.value || !vid) return null;
  const d = fresh ? LB.capture(regionId.value, vid) : LB.current(regionId.value, vid);
  if (!d) return null;
  return {
    ...d,
    orientation: orientation.value,
    updated: Date.now(),
    _storeId: regionId.value,
    _venueId: vid
  };
}

function postAll(p: Payload) {
  try {
    const ifr = iframeEl.value;
    if (ifr && ifr.contentWindow) ifr.contentWindow.postMessage({ type: 'cast', payload: p }, '*');
  } catch {}
  try {
    if (castWin.value && !castWin.value.closed) castWin.value.postMessage({ type: 'cast', payload: p }, '*');
  } catch {}
}
function postLang(l: 'zh' | 'en') {
  try {
    const ifr = iframeEl.value;
    if (ifr && ifr.contentWindow) ifr.contentWindow.postMessage({ type: 'lang', lang: l }, '*');
  } catch {}
  try {
    if (castWin.value && !castWin.value.closed) castWin.value.postMessage({ type: 'lang', lang: l }, '*');
  } catch {}
}

function write(p: Payload) {
  try {
    localStorage.setItem('leaderboard_preview', JSON.stringify(p));
    if (casting.value) localStorage.setItem('leaderboard_cast', JSON.stringify(p));
  } catch {}
  updated.value = p.updated;
  postAll(p);
}

function pushPreview(fresh: boolean) {
  const p = buildPayload(fresh);
  if (p) write(p);
}

// 子視窗 'ready' → 推現況給它
function onMsg(e: MessageEvent) {
  const d = e.data;
  if (!d || typeof d !== 'object') return;
  if (d.type === 'ready' && e.source) {
    const p = buildPayload(false);
    if (p) (e.source as Window).postMessage({ type: 'cast', payload: p }, '*');
    (e.source as Window).postMessage({ type: 'lang', lang: lang.value }, '*');
  }
}

// ---- 使用者操作 ----
function onRegionChange(e: Event) {
  const id = (e.target as HTMLSelectElement).value;
  regionId.value = id;
  const vs = regions.value.find((r) => r.id === id)?.venues ?? [];
  venueId.value = vs[0]?.id ?? '';
  pushPreview(false);
}
function onVenueChange(e: Event) {
  venueId.value = (e.target as HTMLSelectElement).value;
  pushPreview(false);
}
function setOrientP() { orientation.value = 'portrait';  pushPreview(false); }
function setOrientL() { orientation.value = 'landscape'; pushPreview(false); }
function refresh() { pushPreview(true); }
function cast() {
  const p = buildPayload(false);
  if (!p) return;
  try { localStorage.setItem('leaderboard_cast', JSON.stringify(p)); } catch {}
  casting.value = true;
  castWin.value = window.open('./broadcast.html#src=cast', 'neonCastWindow');
  setTimeout(() => {
    const q = buildPayload(false);
    if (q) postAll(q);
    postLang(lang.value);
  }, 600);
}
function onIframeLoad() { pushPreview(false); }
function openFull() {
  try { window.open('./full-ranking.html', '_blank'); } catch {}
}

// ---- 顯示 computed ----
const isP = computed(() => orientation.value !== 'landscape');

const p2 = (n: number) => String(n).padStart(2, '0');
const updatedText = computed(() => {
  if (!updated.value) return '— —';
  const d = new Date(updated.value);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
});

const regionOpts = computed(() => regions.value.map((r) => ({ id: r.id, label: en.value ? r.en : r.zh })));
const venueOpts  = computed(() => venuesOfCurrent.value.map((v) => ({ id: v.id, label: en.value ? v.en : `${v.zh} · ${v.en}` })));

// ---- 樣式(動態 style binding) ----
const previewBoxStyle = computed(() => isP.value
  ? { aspectRatio: '9 / 16', height: 'min(676px, 68vh)', maxWidth: '100%', background: '#000', border: '1px solid rgba(0,229,255,.25)', overflow: 'hidden' } as Record<string, string>
  : { aspectRatio: '16 / 9', width: 'min(760px, 100%)', maxHeight: '68vh', background: '#000', border: '1px solid rgba(0,229,255,.25)', overflow: 'hidden' } as Record<string, string>);

const cTitleMain = computed(() => en.value ? 'CASTING CONSOLE' : '投播控制台');
const cTitleSub  = computed(() => en.value ? 'OPERATIONS' : 'CASTING CONSOLE');
const cTitleMainStyle = computed(() => en.value
  ? { fontFamily: 'Orbitron,sans-serif',      fontWeight: '900', fontSize: 'clamp(20px,3.5vh,30px)', letterSpacing: 'clamp(2px,0.4vw,4px)', lineHeight: '1', color: '#eafdff', textShadow: '0 0 20px rgba(0,229,255,.5)' } as Record<string, string>
  : { fontFamily: "'Noto Sans TC',sans-serif", fontWeight: '900', fontSize: 'clamp(26px,4.5vh,42px)', lineHeight: '1', color: '#eafdff', textShadow: '0 0 20px rgba(0,229,255,.5)' } as Record<string, string>);
const cTitleSubStyle: Record<string, string> = { fontFamily: 'Orbitron,sans-serif', fontWeight: '700', fontSize: 'clamp(13px,2vh,18px)', letterSpacing: 'clamp(3px,0.6vw,5px)', color: '#ff2d95' };

// 語言/方向按鈕樣式
const langFs  = 'clamp(11px,1.4vh,14px)';
const langPad = 'clamp(5px,0.8vh,7px) clamp(10px,1.4vw,16px)';
const langBase: Record<string, string> = { fontFamily: 'Rajdhani,sans-serif', fontWeight: '700', fontSize: langFs, letterSpacing: '2px', padding: langPad, cursor: 'pointer', border: '1px solid rgba(0,229,255,.3)', background: 'rgba(0,0,0,.4)', color: '#5f93a8' };
const langOn:   Record<string, string> = { ...langBase, border: '1px solid #34c8e8', background: 'rgba(0,229,255,.16)', color: '#eafdff' };

const segFs  = 'clamp(12px,1.6vh,15px)';
const segPad = 'clamp(10px,1.5vh,14px) 0';
const segBase:   Record<string, string> = { padding: segPad, fontFamily: 'Rajdhani,sans-serif', fontWeight: '700', fontSize: segFs, letterSpacing: '2px', cursor: 'pointer', border: '1px solid rgba(0,229,255,.3)', background: 'transparent', color: '#5f93a8' };
const segActive: Record<string, string> = { padding: segPad, fontFamily: 'Rajdhani,sans-serif', fontWeight: '700', fontSize: segFs, letterSpacing: '2px', cursor: 'pointer', border: '1px solid #34c8e8', background: 'rgba(0,229,255,.14)', color: '#eafdff', boxShadow: '0 0 16px rgba(0,229,255,.25) inset' };

const pBtnStyle = computed(() => isP.value ? segActive : segBase);
const lBtnStyle = computed(() => isP.value ? segBase : segActive);

// ---- 模式切換按鈕樣式(仿 STEP 2 方向按鈕視覺) ----
const setModeIndividual = () => { mode.value = 'individual'; };
const setModeRotation   = () => { mode.value = 'rotation'; };

const modeIndividualBtn = computed(() => mode.value === 'individual' ? segActive : segBase);
const modeRotationBtn   = computed(() => mode.value === 'rotation'   ? segActive : segBase);

// 目前輪播到的場域名稱(顯示用)
const currentVenueName = computed(() => {
  const v = venuesOfCurrent.value.find((x) => x.id === currentVenueId.value);
  if (!v) return '';
  return en.value ? v.en : `${v.zh} · ${v.en}`;
});

// ---- 標籤文字 ----
const tSource     = computed(() => en.value ? 'SOURCE: Game DB (sample)' : '資料來源:遊戲包資料庫(內建範例)');
const tStep0      = computed(() => en.value ? '① CAST MODE' : '① 投播模式');
const tModeInd    = computed(() => en.value ? 'INDIVIDUAL'   : '各別投播');
const tModeRot    = computed(() => en.value ? 'ROTATE'       : '輪播模式');
// 拆兩段:前後包住秒數輸入框
const tRotHintBefore = computed(() => en.value ? 'Every'  : '每');
const tRotHintAfter  = computed(() => en.value ? 'seconds' : '秒切換');
const tAll           = computed(() => en.value ? 'ALL FIELDS' : '全部');
const tRotEmpty      = computed(() => en.value
  ? '⚠ Pick at least one field'
  : '⚠ 至少勾選一個場域');
const tRotOnAir      = computed(() => en.value
  ? `ROTATING · ${currentVenueName.value}`
  : `輪播中 · ${currentVenueName.value}`);
const tSourceSub  = computed(() => en.value ? '// swap to file / path / API later' : '// 之後可換接檔案 / 路徑 / API');
const tStep1      = computed(() => en.value ? '① SELECT STORE · FIELD' : '① 選擇店家 · 場域');
const tRegion     = computed(() => en.value ? 'STORE' : '店家 STORE');
const tVenue      = computed(() => en.value ? 'FIELD' : '場域 FIELD');
const tStep2      = computed(() => en.value ? '② CAST ORIENTATION' : '② 投播方向');
const tPortrait   = computed(() => en.value ? 'PORTRAIT 1080×1920' : '直式 1080×1920');
const tLandscape  = computed(() => en.value ? 'LANDSCAPE 1920×1080' : '橫式 1920×1080');
const tAutoSync   = computed(() => en.value ? 'AUTO-SYNC · every 8s from game DB' : '自動擷取中 · 每 8 秒從遊戲包讀取');
const tLastSync   = computed(() => en.value ? 'LAST SYNC' : '最後更新 LAST SYNC');
const tOnAir      = computed(() => en.value ? 'ON AIR' : '投播中 · ON AIR');
const tRefresh    = computed(() => en.value ? '⟳ REFRESH' : '⟳ 重新整理');
const tCast       = computed(() => en.value ? '▶ CAST' : '▶ 投播畫面 CAST');
const tPreview    = computed(() => en.value ? 'LIVE PREVIEW' : '即時預覽 LIVE PREVIEW');
const tFullRank   = computed(() => en.value ? '⊞ FULL RANKING (new tab)' : '⊞ 完整名次（新分頁）');
const orientTag   = computed(() => isP.value ? (en.value ? 'PORTRAIT' : '直式 PORTRAIT') : (en.value ? 'LANDSCAPE' : '橫式 LANDSCAPE'));
</script>

<template>
  <div class="console-root">
    <!-- 頂部標題列 -->
    <div class="header">
      <div>
        <div class="kicker">◢ NEON CLASH · OPERATIONS</div>
        <div class="title-row">
          <span :style="cTitleMainStyle">{{ cTitleMain }}</span>
          <span :style="cTitleSubStyle">{{ cTitleSub }}</span>
        </div>
      </div>
      <div class="header-right">
        <div class="lang-btns">
          <button @click="setLang('zh')" :style="en ? langBase : langOn">中文</button>
          <button @click="setLang('en')" :style="en ? langOn : langBase">EN</button>
        </div>
        <div class="source-info">
          <div>{{ tSource }}</div>
          <div class="source-sub">{{ tSourceSub }}</div>
        </div>
      </div>
    </div>

    <!-- 主體:左欄操作 / 右欄預覽 -->
    <div class="body">
      <div class="left-column">
        <!-- STEP 0:投播模式 -->
        <div class="section">
          <div class="section-header">{{ tStep0 }}</div>
          <div class="mode-btns">
            <button @click="setModeIndividual" :style="modeIndividualBtn">{{ tModeInd }}</button>
            <button @click="setModeRotation"   :style="modeRotationBtn">{{ tModeRot }}</button>
          </div>
          <div v-if="mode === 'rotation'" class="mode-hint">
            ▸ <span>{{ tRotHintBefore }}</span>
            <input
              type="number"
              class="sec-input"
              :value="rotationSeconds"
              @input="onSecondsInput"
              :min="ROT_MIN"
              :max="ROT_MAX"
            />
            <span>{{ tRotHintAfter }}</span>
          </div>
        </div>

        <!-- STEP 1:店家 + 場域 -->
        <div class="section">
          <div class="section-header">{{ tStep1 }}</div>
          <label class="label">{{ tRegion }}</label>
          <div class="select-wrap select-wrap-cyan">
            <select :value="regionId" @change="onRegionChange" class="select-input">
              <option v-for="o in regionOpts" :key="o.id" :value="o.id">{{ o.label }}</option>
            </select>
            <span class="select-arrow arrow-cyan">▼</span>
          </div>
          <label class="label">{{ tVenue }}</label>
          <!-- 各別模式:下拉選單 -->
          <div v-if="mode === 'individual'" class="select-wrap select-wrap-pink">
            <select :value="venueId" @change="onVenueChange" class="select-input">
              <option v-for="o in venueOpts" :key="o.id" :value="o.id">{{ o.label }}</option>
            </select>
            <span class="select-arrow arrow-pink">▼</span>
          </div>
          <!-- 輪播模式:場域列表(可複選 + 全部) -->
          <div v-else class="venue-list">
            <!-- 「全部」快捷 -->
            <div class="venue-item venue-item-all" @click="toggleAll">
              <span :class="['checkbox', 'checkbox-' + allCheckState]">
                <span v-if="allCheckState === 'checked'">✓</span>
                <span v-else-if="allCheckState === 'indeterminate'">─</span>
              </span>
              <span class="venue-text venue-text-all">{{ tAll }}</span>
            </div>

            <!-- 個別場域 -->
            <div v-for="v in venuesOfCurrent" :key="v.id"
                 :class="['venue-item', {
                   'venue-item-active':   isVenueChecked(v.id) && v.id === currentVenueId,
                   'venue-item-inactive': !isVenueChecked(v.id)
                 }]"
                 @click="toggleVenue(v.id)">
              <span :class="['checkbox', isVenueChecked(v.id) ? 'checkbox-checked' : 'checkbox-unchecked']">
                <span v-if="isVenueChecked(v.id)">✓</span>
              </span>
              <span class="venue-text">{{ en ? v.en : `${v.zh} · ${v.en}` }}</span>
            </div>

            <div v-if="noneSelected" class="venue-empty">{{ tRotEmpty }}</div>
          </div>
        </div>

        <!-- STEP 2 -->
        <div class="section">
          <div class="section-header">{{ tStep2 }}</div>
          <div class="orient-btns">
            <button @click="setOrientP" :style="pBtnStyle">{{ tPortrait }}</button>
            <button @click="setOrientL" :style="lBtnStyle">{{ tLandscape }}</button>
          </div>
        </div>

        <!-- 狀態 -->
        <div class="status-section">
          <div class="status-row status-active"><span class="dot dot-cyan"></span>{{ tAutoSync }}</div>
          <div>{{ tLastSync }} <span class="updated-value">{{ updatedText }}</span></div>
          <div v-if="mode === 'rotation'" class="rot-row"><span class="dot dot-purple"></span>{{ tRotOnAir }}</div>
          <div v-if="casting" class="on-air-row"><span class="dot dot-pink"></span>{{ tOnAir }}</div>
        </div>

        <!-- 動作按鈕 -->
        <div class="action-row">
          <button @click="refresh" class="btn-refresh">{{ tRefresh }}</button>
          <button @click="cast" class="btn-cast">{{ tCast }}</button>
        </div>
        <button @click="openFull" class="btn-fullrank">{{ tFullRank }}</button>
      </div>

      <!-- 右欄:預覽 -->
      <div class="right-column">
        <div class="preview-header">
          <div class="preview-label">{{ tPreview }}</div>
          <div class="orient-tag">{{ orientTag }}</div>
        </div>
        <div :style="previewBoxStyle">
          <iframe ref="iframeEl" :src="iframeSrc" @load="onIframeLoad" class="preview-iframe"></iframe>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===== 容器 ===== */
.console-root {
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(ellipse 80% 60% at 20% 0%, rgba(0, 229, 255, 0.08), transparent 60%),
    radial-gradient(ellipse 70% 60% at 100% 100%, rgba(255, 45, 149, 0.08), transparent 60%),
    #05070f;
  font-family: 'Noto Sans TC', sans-serif;
  padding: clamp(14px, 2.5vh, 36px) clamp(18px, 3vw, 44px);
  display: flex;
  flex-direction: column;
  gap: clamp(14px, 2.2vh, 28px);
  color: #eafdff;
}

/* ===== 頂部標題列 ===== */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(0, 229, 255, 0.2);
  padding-bottom: clamp(12px, 1.8vh, 22px);
  flex-shrink: 0;
}
.kicker {
  font-family: Rajdhani, sans-serif;
  font-weight: 700;
  font-size: clamp(11px, 1.5vh, 15px);
  letter-spacing: clamp(4px, 0.8vw, 7px);
  color: #34c8e8;
}
.title-row {
  display: flex;
  align-items: baseline;
  gap: clamp(10px, 1.5vw, 18px);
  margin-top: 6px;
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
.source-info {
  font-family: 'Share Tech Mono', monospace;
  font-size: clamp(11px, 1.4vh, 14px);
  letter-spacing: 2px;
  color: #5fb6cf;
  text-align: right;
  line-height: 1.7;
}
.source-sub { color: #3f7f93; }

/* ===== 主體雙欄 ===== */
.body {
  display: grid;
  grid-template-columns: clamp(300px, 30vw, 440px) 1fr;
  gap: clamp(16px, 2vw, 32px);
  align-items: start;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ===== 左欄 ===== */
.left-column {
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 1.2vh, 16px);
  min-height: 0;
  overflow-y: auto;
  max-height: 100%;
}
.section {
  border: 1px solid rgba(0, 229, 255, 0.18);
  background: linear-gradient(160deg, rgba(0, 229, 255, 0.04), rgba(0, 229, 255, 0.01));
  padding: clamp(10px, 1.6vh, 22px) clamp(14px, 1.8vw, 24px) clamp(12px, 1.8vh, 24px);
}
.section-header {
  font-family: Rajdhani, sans-serif;
  font-weight: 700;
  font-size: clamp(11px, 1.4vh, 14px);
  letter-spacing: clamp(3px, 0.6vw, 5px);
  color: #4f8aa0;
  margin-bottom: clamp(8px, 1.2vh, 14px);
}
.label {
  font-family: 'Noto Sans TC', sans-serif;
  font-size: clamp(11px, 1.4vh, 14px);
  color: #7fb6c8;
  letter-spacing: 1px;
}

/* ===== 下拉選單 ===== */
.select-wrap {
  position: relative;
  margin: clamp(5px, 0.8vh, 8px) 0 clamp(12px, 1.8vh, 18px);
}
.select-wrap:last-child { margin-bottom: 4px; }
.select-input {
  width: 100%;
  margin: 0;
  padding: clamp(10px, 1.5vh, 14px) 46px clamp(10px, 1.5vh, 14px) 16px;
  font-family: 'Noto Sans TC', sans-serif;
  font-size: clamp(14px, 1.9vh, 18px);
  font-weight: 700;
  color: #eafdff;
  background: #0a1018;
  outline: none;
  cursor: pointer;
}
.select-wrap-cyan .select-input { border: 1px solid rgba(0, 229, 255, 0.4); }
.select-wrap-pink .select-input { border: 1px solid rgba(255, 45, 149, 0.4); }
.select-input option {
  background: #0a1018;
  color: #eafdff;
}
.select-arrow {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  font-size: 12px;
}
.arrow-cyan {
  border-left: 1px solid rgba(0, 229, 255, 0.3);
  color: #34c8e8;
}
.arrow-pink {
  border-left: 1px solid rgba(255, 45, 149, 0.3);
  color: #ff6bb0;
}

/* ===== 方向按鈕 / 模式按鈕 ===== */
.orient-btns,
.mode-btns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.mode-hint {
  margin-top: 8px;
  font-family: 'Share Tech Mono', monospace;
  font-size: clamp(9px, 1.2vh, 11px);
  letter-spacing: 1px;
  color: #ff8fc4;
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}
.sec-input {
  width: 46px;
  padding: 2px 6px;
  font-family: 'Share Tech Mono', monospace;
  font-size: clamp(10px, 1.3vh, 12px);
  font-weight: 700;
  color: #eafdff;
  background: #0a1018;
  border: 1px solid rgba(255, 45, 149, 0.5);
  outline: none;
  text-align: center;
  letter-spacing: 1px;
  -moz-appearance: textfield;
}
.sec-input::-webkit-inner-spin-button,
.sec-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.sec-input:focus { border-color: #ff2d95; box-shadow: 0 0 10px rgba(255, 45, 149, 0.35); }

/* ===== 場域列表(輪播模式) ===== */
.venue-list {
  margin-top: clamp(4px, 0.6vh, 6px);
  display: flex;
  flex-direction: column;
  gap: 1px;
  border: 1px solid rgba(255, 45, 149, 0.25);
  background: rgba(0, 0, 0, 0.25);
  padding: clamp(4px, 0.8vh, 8px) clamp(8px, 1.2vw, 12px);
}
.venue-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: clamp(3px, 0.6vh, 6px) 4px;
  font-family: 'Noto Sans TC', sans-serif;
  font-size: clamp(11px, 1.4vh, 14px);
  color: #9fc0d0;
  letter-spacing: 1px;
  transition: color 0.3s, background 0.3s;
  cursor: pointer;
  user-select: none;
}
.venue-item:hover { background: rgba(0, 229, 255, 0.05); }
.venue-item-inactive { color: #5a7580; opacity: 0.7; }
.venue-item-active {
  color: #eafdff;
  background: linear-gradient(90deg, rgba(255, 45, 149, 0.15), rgba(0, 229, 255, 0.05));
  text-shadow: 0 0 12px rgba(0, 229, 255, 0.5);
  font-weight: 700;
}
.venue-text { flex: 1; }

/* 全部快捷:視覺跟其他項目做區隔 */
.venue-item-all {
  border-bottom: 1px dashed rgba(255, 45, 149, 0.25);
  padding-bottom: clamp(5px, 0.9vh, 8px);
  margin-bottom: 2px;
}
.venue-text-all {
  font-family: Rajdhani, sans-serif;
  font-weight: 700;
  letter-spacing: 3px;
  color: #ff6bb0;
}

/* Checkbox 三態視覺 */
.checkbox {
  width: 14px;
  height: 14px;
  border: 1px solid #ff6bb0;
  background: rgba(0, 0, 0, 0.4);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-family: 'Share Tech Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
}
.checkbox-checked {
  background: rgba(255, 45, 149, 0.6);
  border-color: #ff2d95;
  color: #fff;
  box-shadow: 0 0 8px rgba(255, 45, 149, 0.5);
}
.checkbox-indeterminate {
  background: rgba(255, 45, 149, 0.2);
  border-color: #ff6bb0;
  color: #ff8fc4;
}
.checkbox-unchecked {
  background: rgba(0, 0, 0, 0.4);
  border-color: rgba(255, 45, 149, 0.4);
}

/* 沒勾任何場域的警告 */
.venue-empty {
  margin-top: 4px;
  padding: 5px 6px;
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px;
  letter-spacing: 1px;
  color: #ff8fc4;
  text-align: center;
  border: 1px dashed rgba(255, 45, 149, 0.3);
}

/* 紫色狀態點(給輪播用) */
.dot-purple {
  background: #b18fff;
  box-shadow: 0 0 10px #b18fff;
  animation: pulse 1.4s ease-in-out infinite;
}
.rot-row {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #d0b8ff;
}

/* ===== 狀態區塊 ===== */
.status-section {
  border: 1px solid rgba(0, 229, 255, 0.18);
  background: rgba(0, 229, 255, 0.02);
  padding: clamp(12px, 1.8vh, 22px) clamp(14px, 2vw, 26px);
  font-family: 'Share Tech Mono', monospace;
  font-size: clamp(12px, 1.6vh, 15px);
  letter-spacing: 1px;
  color: #5fb6cf;
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 1vh, 10px);
}
.status-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.status-active { color: #7fe6f8; }
.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-cyan {
  background: #34c8e8;
  box-shadow: 0 0 10px #34c8e8;
  animation: pulse 1.6s ease-in-out infinite;
}
.dot-pink {
  background: #ff2d95;
  box-shadow: 0 0 10px #ff2d95;
  animation: pulse 1.2s ease-in-out infinite;
}
.updated-value { color: #9fe9ff; }
.on-air-row {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #ff8fc4;
}

/* ===== 動作按鈕列 ===== */
.action-row {
  display: grid;
  grid-template-columns: clamp(110px, 12vw, 150px) 1fr;
  gap: clamp(10px, 1.2vw, 14px);
}
.btn-refresh {
  padding: clamp(12px, 1.8vh, 18px) 0;
  font-family: Rajdhani, sans-serif;
  font-weight: 700;
  font-size: clamp(13px, 1.7vh, 17px);
  letter-spacing: 3px;
  color: #7fe6f8;
  background: rgba(0, 229, 255, 0.08);
  border: 1px solid rgba(0, 229, 255, 0.45);
  cursor: pointer;
}
.btn-cast {
  padding: clamp(12px, 1.8vh, 18px) 0;
  font-family: Rajdhani, sans-serif;
  font-weight: 700;
  font-size: clamp(14px, 1.9vh, 19px);
  letter-spacing: clamp(2px, 0.5vw, 4px);
  color: #fff;
  background: linear-gradient(90deg, rgba(255, 45, 149, 0.9), rgba(0, 229, 255, 0.7));
  border: none;
  box-shadow: 0 0 24px rgba(255, 45, 149, 0.4);
  cursor: pointer;
}
.btn-fullrank {
  padding: clamp(10px, 1.6vh, 14px) 0;
  font-family: Rajdhani, sans-serif;
  font-weight: 700;
  font-size: clamp(12px, 1.6vh, 15px);
  letter-spacing: clamp(2px, 0.5vw, 4px);
  color: #aef4ff;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(0, 229, 255, 0.3);
  cursor: pointer;
}

/* ===== 右欄:預覽 ===== */
.right-column {
  border: 1px solid rgba(0, 229, 255, 0.18);
  background: rgba(0, 0, 0, 0.25);
  padding: clamp(14px, 2vh, 24px);
  display: flex;
  flex-direction: column;
  gap: clamp(10px, 1.5vh, 16px);
  align-items: center;
  max-height: 100%;
  min-height: 0;
  overflow: hidden;
}
.preview-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}
.preview-label {
  font-family: Rajdhani, sans-serif;
  font-weight: 700;
  font-size: clamp(11px, 1.4vh, 14px);
  letter-spacing: clamp(3px, 0.6vw, 5px);
  color: #4f8aa0;
}
.orient-tag {
  font-family: 'Share Tech Mono', monospace;
  font-size: clamp(10px, 1.3vh, 13px);
  letter-spacing: 2px;
  color: #7fe6f8;
  border: 1px solid rgba(0, 229, 255, 0.3);
  padding: 5px 12px;
}
.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: #000;
  display: block;
}

/* 讓 select 用系統箭頭消失 */
.select-input {
  appearance: none;
  -webkit-appearance: none;
}
</style>
