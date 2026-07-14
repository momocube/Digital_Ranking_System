<script setup lang="ts">
/**
 * 投播控制台 CastingConsole.vue — 選店家/場域/方向 + 期間輪播(即時/季度/年度),推送給投播畫面
 * 對應舊版 投播控制台.dc.html(對話調整版):
 *  - 8 秒輪詢 LB.capture 更新即時榜
 *  - 期間輪播:勾選季度 / 年度後,投播畫面會在「即時 + 勾選期間」之間每 N 秒自動輪播(N 可調)
 *  - 自動發布:不需按鈕,設定會持續寫入 leaderboard_cast(供投播畫面接收)
 *  - 資料寫入 localStorage(leaderboard_preview / _cast)+ postMessage 給預覽 iframe / 開啟的投播視窗
 *  - 中英切換、完整名次(新分頁)
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useLanguage } from '@/composables/useLanguage';
import { LB, type RegionInfo, type Payload } from '@/data/leaderboard-data';

const { lang, en, setLang } = useLanguage();

// 人數版本固定 2-3 人(不提供下拉)
const FIXED_VERSION = 'v23';

const regions = ref<RegionInfo[]>([]);
const regionId = ref('');
const venueId = ref('');
const orientation = ref<'portrait' | 'landscape'>('portrait');
const updated = ref(0);
const casting = ref(true);              // 自動發布:一律推送到投播頻道
const castWin = ref<Window | null>(null);
const iframeEl = ref<HTMLIFrameElement | null>(null);

// 期間輪播設定
const incQuarter = ref(false);
const incAnnual = ref(false);
const rotationSeconds = ref(8);
const ROT_MIN = 2;
const ROT_MAX = 120;

const iframeSrc = './broadcast.html#src=preview';

let poller: number | undefined;

onMounted(() => {
  regions.value = LB.regions();
  const r0 = regions.value[0];
  if (r0) {
    regionId.value = r0.id;
    const v0 = r0.venues[0];
    if (v0) venueId.value = v0.id;
  }
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
  window.removeEventListener('message', onMsg);
});

watch(lang, (l) => postLang(l));
watch(rotationSeconds, (n) => {
  try { localStorage.setItem('leaderboard_rotation_seconds', String(n)); } catch {}
  pushPreview(false);
});

// 使用者輸入秒數,自動夾在 2-120
const onSecondsInput = (e: Event) => {
  const raw = (e.target as HTMLInputElement).value;
  const n = parseInt(raw, 10);
  if (isNaN(n)) return;
  rotationSeconds.value = Math.max(ROT_MIN, Math.min(ROT_MAX, n));
};

const toggleQuarter = () => { incQuarter.value = !incQuarter.value; pushPreview(false); };
const toggleAnnual  = () => { incAnnual.value  = !incAnnual.value;  pushPreview(false); };

const venuesOfCurrent = computed(() => regions.value.find((r) => r.id === regionId.value)?.venues ?? []);

// ---- payload:含 boards 輪播(即時一定在,勾了才加季度/年度) ----
function buildPayload(fresh: boolean): Payload | null {
  const rid = regionId.value, vid = venueId.value;
  if (!rid || !vid) return null;
  if (fresh) LB.capture(rid, vid);                     // 更新即時榜分數
  const live = LB.board(rid, vid, FIXED_VERSION, 'live');
  if (!live) return null;
  const boards: Payload[] = [live];
  if (incQuarter.value) { const q = LB.board(rid, vid, FIXED_VERSION, 'quarter'); if (q) boards.push(q); }
  if (incAnnual.value)  { const a = LB.board(rid, vid, FIXED_VERSION, 'annual');  if (a) boards.push(a); }
  const sec = Math.max(ROT_MIN, Math.min(ROT_MAX, rotationSeconds.value || 8));
  return {
    ...live,
    boards,
    rotateMs: sec * 1000,
    orientation: orientation.value,
    updated: Date.now(),
    _storeId: rid, _venueId: vid, _versionId: FIXED_VERSION
  };
}

function postAll(p: Payload) {
  try { const ifr = iframeEl.value; if (ifr && ifr.contentWindow) ifr.contentWindow.postMessage({ type: 'cast', payload: p }, '*'); } catch {}
  try { if (castWin.value && !castWin.value.closed) castWin.value.postMessage({ type: 'cast', payload: p }, '*'); } catch {}
}
function postLang(l: 'zh' | 'en') {
  try { const ifr = iframeEl.value; if (ifr && ifr.contentWindow) ifr.contentWindow.postMessage({ type: 'lang', lang: l }, '*'); } catch {}
  try { if (castWin.value && !castWin.value.closed) castWin.value.postMessage({ type: 'lang', lang: l }, '*'); } catch {}
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

function onMsg(e: MessageEvent) {
  const d = e.data;
  if (!d || typeof d !== 'object') return;
  if (d.type === 'ready' && e.source) {
    const p = buildPayload(false);
    if (p) (e.source as Window).postMessage({ type: 'cast', payload: p }, '*');
    (e.source as Window).postMessage({ type: 'lang', lang: lang.value }, '*');
  }
}

function onRegionChange(e: Event) {
  const id = (e.target as HTMLSelectElement).value;
  regionId.value = id;
  const vs = regions.value.find((r) => r.id === id)?.venues ?? [];
  venueId.value = vs[0]?.id ?? '';
  pushPreview(false);
}
function onVenueChange(e: Event) { venueId.value = (e.target as HTMLSelectElement).value; pushPreview(false); }
function setOrientP() { orientation.value = 'portrait';  pushPreview(false); }
function setOrientL() { orientation.value = 'landscape'; pushPreview(false); }
function refresh() { pushPreview(true); }
function onIframeLoad() { pushPreview(false); }
function openFull() { try { window.open('./full-ranking.html', '_blank'); } catch {} }

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

const previewBoxStyle = computed(() => isP.value
  ? { aspectRatio: '9 / 16', height: 'min(676px, 68vh)', maxWidth: '100%', background: '#000', border: '1px solid rgba(0,229,255,.25)', overflow: 'hidden' } as Record<string, string>
  : { aspectRatio: '16 / 9', width: 'min(760px, 100%)', maxHeight: '68vh', background: '#000', border: '1px solid rgba(0,229,255,.25)', overflow: 'hidden' } as Record<string, string>);

const cTitleMain = computed(() => en.value ? 'CASTING CONSOLE' : '投播控制台');
const cTitleSub  = computed(() => en.value ? 'OPERATIONS' : 'CASTING CONSOLE');
const cTitleMainStyle = computed(() => en.value
  ? { fontFamily: 'Orbitron,sans-serif',      fontWeight: '900', fontSize: 'clamp(20px,3.5vh,30px)', letterSpacing: 'clamp(2px,0.4vw,4px)', lineHeight: '1', color: '#eafdff', textShadow: '0 0 20px rgba(0,229,255,.5)' } as Record<string, string>
  : { fontFamily: "'Noto Sans TC',sans-serif", fontWeight: '900', fontSize: 'clamp(26px,4.5vh,42px)', lineHeight: '1', color: '#eafdff', textShadow: '0 0 20px rgba(0,229,255,.5)' } as Record<string, string>);
const cTitleSubStyle: Record<string, string> = { fontFamily: 'Orbitron,sans-serif', fontWeight: '700', fontSize: 'clamp(13px,2vh,18px)', letterSpacing: 'clamp(3px,0.6vw,5px)', color: '#ff2d95' };

const langFs  = 'clamp(11px,1.4vh,14px)';
const langPad = 'clamp(5px,0.8vh,7px) clamp(10px,1.4vw,16px)';
const langBase: Record<string, string> = { fontFamily: 'Rajdhani,sans-serif', fontWeight: '700', fontSize: langFs, letterSpacing: '2px', padding: langPad, cursor: 'pointer', border: '1px solid rgba(0,229,255,.3)', background: 'rgba(0,0,0,.4)', color: '#5f93a8' };
const langOn:   Record<string, string> = { ...langBase, border: '1px solid #34c8e8', background: 'rgba(0,229,255,.16)', color: '#eafdff' };

const segFs  = 'clamp(12px,1.6vh,15px)';
const segPad = 'clamp(10px,1.5vh,14px) 0';
const segBase:   Record<string, string> = { padding: segPad, fontFamily: 'Rajdhani,sans-serif', fontWeight: '700', fontSize: segFs, letterSpacing: '2px', cursor: 'pointer', border: '1px solid rgba(0,229,255,.3)', background: 'transparent', color: '#5f93a8' };
const segActive: Record<string, string> = { ...segBase, border: '1px solid #34c8e8', background: 'rgba(0,229,255,.14)', color: '#eafdff', boxShadow: '0 0 16px rgba(0,229,255,.25) inset' };
const pBtnStyle = computed(() => isP.value ? segActive : segBase);
const lBtnStyle = computed(() => isP.value ? segBase : segActive);

// 期間勾選按鈕樣式
const chkBase: Record<string, string> = { display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: 'clamp(10px,1.5vh,14px) clamp(14px,1.6vw,18px)', fontFamily: 'Rajdhani,sans-serif', fontWeight: '700', fontSize: 'clamp(13px,1.7vh,16px)', letterSpacing: '2px', cursor: 'pointer', textAlign: 'left', border: '1px solid rgba(0,229,255,.3)', background: 'transparent', color: '#5f93a8' };
const chkOn:   Record<string, string> = { ...chkBase, border: '1px solid #34c8e8', background: 'rgba(0,229,255,.12)', color: '#eafdff', boxShadow: '0 0 16px rgba(0,229,255,.2) inset' };
const qBtnStyle = computed(() => incQuarter.value ? chkOn : chkBase);
const aBtnStyle = computed(() => incAnnual.value ? chkOn : chkBase);
const qBox = computed(() => incQuarter.value ? '☑' : '☐');
const aBox = computed(() => incAnnual.value ? '☑' : '☐');

const orientTag = computed(() => isP.value ? (en.value ? 'PORTRAIT' : '直式 PORTRAIT') : (en.value ? 'LANDSCAPE' : '橫式 LANDSCAPE'));

// ---- 標籤文字 ----
const tSource   = computed(() => en.value ? 'SOURCE: Game DB (sample)' : '資料來源:遊戲包資料庫(內建範例)');
const tSourceSub = computed(() => en.value ? '// swap to file / path / API later' : '// 之後可換接檔案 / 路徑 / API');
const tStep1    = computed(() => en.value ? '① SELECT STORE · FIELD' : '① 選擇店家 · 場域');
const tRegion   = computed(() => en.value ? 'STORE' : '店家 STORE');
const tVenue    = computed(() => en.value ? 'FIELD' : '場域 FIELD');
const tStep2    = computed(() => en.value ? '② CAST ORIENTATION' : '② 投播方向');
const tPortrait = computed(() => en.value ? 'PORTRAIT 1080×1920' : '直式 1080×1920');
const tLandscape= computed(() => en.value ? 'LANDSCAPE 1920×1080' : '橫式 1920×1080');
const tStep3    = computed(() => en.value ? '③ PERIOD ROTATION' : '③ 期間輪播');
const tQuarter  = computed(() => en.value ? 'Quarterly board' : '季度排行榜');
const tAnnual   = computed(() => en.value ? 'Annual board' : '年度總榜');
const tRotateSecLabel = computed(() => en.value ? 'ROTATE INTERVAL' : '輪播間隔');
const tSecUnit  = computed(() => en.value ? 'sec' : '秒');
const tRotateNote = computed(() => en.value
  ? '> Live always shown. Checked periods auto-rotate at the interval above (2-120s).'
  : '> 即時榜一定會播;勾選的期間會依上方秒數自動輪播(可設 2~120 秒)。');
const tAutoSync = computed(() => en.value ? 'AUTO-SYNC · every 8s from game DB' : '自動擷取中 · 每 8 秒從遊戲包讀取');
const tLastSync = computed(() => en.value ? 'LAST SYNC' : '最後更新 LAST SYNC');
const tOnAir    = computed(() => en.value ? 'AUTO-PUBLISHING · ON AIR' : '自動投播發布中 · ON AIR');
const tRefresh  = computed(() => en.value ? '⟳ REFRESH' : '⟳ 重新整理');
const tPreview  = computed(() => en.value ? 'LIVE PREVIEW' : '即時預覽 LIVE PREVIEW');
const tFullRank = computed(() => en.value ? '⊞ FULL RANKING (new tab)' : '⊞ 完整名次（新分頁）');
</script>

<template>
  <div class="console-root">
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

    <div class="body">
      <div class="left-column">
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
          <div class="select-wrap select-wrap-pink">
            <select :value="venueId" @change="onVenueChange" class="select-input">
              <option v-for="o in venueOpts" :key="o.id" :value="o.id">{{ o.label }}</option>
            </select>
            <span class="select-arrow arrow-pink">▼</span>
          </div>
        </div>

        <!-- STEP 2:方向 -->
        <div class="section">
          <div class="section-header">{{ tStep2 }}</div>
          <div class="orient-btns">
            <button @click="setOrientP" :style="pBtnStyle">{{ tPortrait }}</button>
            <button @click="setOrientL" :style="lBtnStyle">{{ tLandscape }}</button>
          </div>
        </div>

        <!-- STEP 3:期間輪播 -->
        <div class="section">
          <div class="section-header">{{ tStep3 }}</div>
          <div class="period-btns">
            <button @click="toggleQuarter" :style="qBtnStyle"><span class="chk-box">{{ qBox }}</span>{{ tQuarter }}</button>
            <button @click="toggleAnnual"  :style="aBtnStyle"><span class="chk-box">{{ aBox }}</span>{{ tAnnual }}</button>
          </div>
          <div class="rotate-sec-row">
            <label class="label">{{ tRotateSecLabel }}</label>
            <div class="rotate-sec-input">
              <input type="number" :value="rotationSeconds" @input="onSecondsInput" :min="ROT_MIN" :max="ROT_MAX" class="sec-input-lg" />
              <span class="sec-unit">{{ tSecUnit }}</span>
            </div>
          </div>
          <div class="rotate-note">{{ tRotateNote }}</div>
        </div>

        <!-- 狀態 -->
        <div class="status-section">
          <div class="status-row status-active"><span class="dot dot-cyan"></span>{{ tAutoSync }}</div>
          <div>{{ tLastSync }} <span class="updated-value">{{ updatedText }}</span></div>
          <div class="on-air-row"><span class="dot dot-pink"></span>{{ tOnAir }}</div>
        </div>

        <!-- 動作 -->
        <button @click="refresh" class="btn-refresh-full">{{ tRefresh }}</button>
        <button @click="openFull" class="btn-fullrank">{{ tFullRank }}</button>
      </div>

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
.console-root {
  height: 100vh; max-height: 100vh; overflow: hidden;
  background:
    radial-gradient(ellipse 80% 60% at 20% 0%, rgba(0, 229, 255, 0.08), transparent 60%),
    radial-gradient(ellipse 70% 60% at 100% 100%, rgba(255, 45, 149, 0.08), transparent 60%),
    #05070f;
  font-family: 'Noto Sans TC', sans-serif;
  padding: clamp(14px, 2.5vh, 36px) clamp(18px, 3vw, 44px);
  display: flex; flex-direction: column; gap: clamp(14px, 2.2vh, 28px); color: #eafdff;
}
.header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0, 229, 255, 0.2); padding-bottom: clamp(12px, 1.8vh, 22px); flex-shrink: 0; }
.kicker { font-family: Rajdhani, sans-serif; font-weight: 700; font-size: clamp(11px, 1.5vh, 15px); letter-spacing: clamp(4px, 0.8vw, 7px); color: #34c8e8; }
.title-row { display: flex; align-items: baseline; gap: clamp(10px, 1.5vw, 18px); margin-top: 6px; }
.header-right { display: flex; flex-direction: column; align-items: flex-end; gap: clamp(8px, 1.2vh, 12px); }
.lang-btns { display: flex; gap: 8px; }
.source-info { font-family: 'Share Tech Mono', monospace; font-size: clamp(11px, 1.4vh, 14px); letter-spacing: 2px; color: #5fb6cf; text-align: right; line-height: 1.7; }
.source-sub { color: #3f7f93; }

.body { display: grid; grid-template-columns: clamp(300px, 30vw, 440px) 1fr; gap: clamp(16px, 2vw, 32px); align-items: start; flex: 1; min-height: 0; overflow: hidden; }
.left-column { display: flex; flex-direction: column; gap: clamp(6px, 1.2vh, 16px); min-height: 0; overflow-y: auto; max-height: 100%; }
.section { border: 1px solid rgba(0, 229, 255, 0.18); background: linear-gradient(160deg, rgba(0, 229, 255, 0.04), rgba(0, 229, 255, 0.01)); padding: clamp(10px, 1.6vh, 22px) clamp(14px, 1.8vw, 24px) clamp(12px, 1.8vh, 24px); }
.section-header { font-family: Rajdhani, sans-serif; font-weight: 700; font-size: clamp(11px, 1.4vh, 14px); letter-spacing: clamp(3px, 0.6vw, 5px); color: #4f8aa0; margin-bottom: clamp(8px, 1.2vh, 14px); }
.label { font-family: 'Noto Sans TC', sans-serif; font-size: clamp(11px, 1.4vh, 14px); color: #7fb6c8; letter-spacing: 1px; }

.select-wrap { position: relative; margin: clamp(5px, 0.8vh, 8px) 0 clamp(12px, 1.8vh, 18px); }
.select-wrap:last-child { margin-bottom: 4px; }
.select-input { width: 100%; margin: 0; padding: clamp(10px, 1.5vh, 14px) 46px clamp(10px, 1.5vh, 14px) 16px; font-family: 'Noto Sans TC', sans-serif; font-size: clamp(14px, 1.9vh, 18px); font-weight: 700; color: #eafdff; background: #0a1018; outline: none; cursor: pointer; appearance: none; -webkit-appearance: none; }
.select-wrap-cyan .select-input { border: 1px solid rgba(0, 229, 255, 0.4); }
.select-wrap-pink .select-input { border: 1px solid rgba(255, 45, 149, 0.4); }
.select-input option { background: #0a1018; color: #eafdff; }
.select-arrow { position: absolute; top: 0; bottom: 0; right: 0; width: 42px; display: flex; align-items: center; justify-content: center; pointer-events: none; font-size: 12px; }
.arrow-cyan { border-left: 1px solid rgba(0, 229, 255, 0.3); color: #34c8e8; }
.arrow-pink { border-left: 1px solid rgba(255, 45, 149, 0.3); color: #ff6bb0; }

.orient-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

/* 期間輪播 */
.period-btns { display: flex; flex-direction: column; gap: clamp(8px, 1.2vh, 12px); }
.chk-box { font-family: 'Share Tech Mono', monospace; font-size: clamp(15px, 2vh, 18px); line-height: 1; }
.rotate-sec-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: clamp(12px, 1.8vh, 16px); }
.rotate-sec-input { display: flex; align-items: center; gap: 8px; }
.sec-input-lg { width: 78px; padding: clamp(8px, 1.2vh, 11px) 10px; font-family: 'Share Tech Mono', monospace; font-size: clamp(14px, 1.8vh, 17px); font-weight: 700; text-align: center; color: #eafdff; background: #0a1018; border: 1px solid rgba(0, 229, 255, 0.4); outline: none; -moz-appearance: textfield; }
.sec-input-lg::-webkit-inner-spin-button, .sec-input-lg::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.sec-input-lg:focus { border-color: #34c8e8; }
.sec-unit { font-family: 'Share Tech Mono', monospace; font-size: clamp(11px, 1.4vh, 13px); letter-spacing: 1px; color: #5fb6cf; }
.rotate-note { font-family: 'Share Tech Mono', monospace; font-size: clamp(10px, 1.3vh, 13px); letter-spacing: 1px; color: #3f7f93; line-height: 1.7; margin-top: clamp(8px, 1.2vh, 12px); }

.status-section { border: 1px solid rgba(0, 229, 255, 0.18); background: rgba(0, 229, 255, 0.02); padding: clamp(12px, 1.8vh, 22px) clamp(14px, 2vw, 26px); font-family: 'Share Tech Mono', monospace; font-size: clamp(12px, 1.6vh, 15px); letter-spacing: 1px; color: #5fb6cf; display: flex; flex-direction: column; gap: clamp(6px, 1vh, 10px); }
.status-row { display: flex; align-items: center; gap: 10px; }
.status-active { color: #7fe6f8; }
.dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.dot-cyan { background: #34c8e8; box-shadow: 0 0 10px #34c8e8; animation: pulse 1.6s ease-in-out infinite; }
.dot-pink { background: #ff2d95; box-shadow: 0 0 10px #ff2d95; animation: pulse 1.2s ease-in-out infinite; }
.updated-value { color: #9fe9ff; }
.on-air-row { display: flex; align-items: center; gap: 10px; color: #ff8fc4; }

.btn-refresh-full { width: 100%; padding: clamp(12px, 1.8vh, 18px) 0; font-family: Rajdhani, sans-serif; font-weight: 700; font-size: clamp(13px, 1.7vh, 17px); letter-spacing: 3px; color: #7fe6f8; background: rgba(0, 229, 255, 0.08); border: 1px solid rgba(0, 229, 255, 0.45); cursor: pointer; }
.btn-fullrank { padding: clamp(10px, 1.6vh, 14px) 0; font-family: Rajdhani, sans-serif; font-weight: 700; font-size: clamp(12px, 1.6vh, 15px); letter-spacing: clamp(2px, 0.5vw, 4px); color: #aef4ff; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(0, 229, 255, 0.3); cursor: pointer; }

.right-column { border: 1px solid rgba(0, 229, 255, 0.18); background: rgba(0, 0, 0, 0.25); padding: clamp(14px, 2vh, 24px); display: flex; flex-direction: column; gap: clamp(10px, 1.5vh, 16px); align-items: center; max-height: 100%; min-height: 0; overflow: hidden; }
.preview-header { width: 100%; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
.preview-label { font-family: Rajdhani, sans-serif; font-weight: 700; font-size: clamp(11px, 1.4vh, 14px); letter-spacing: clamp(3px, 0.6vw, 5px); color: #4f8aa0; }
.orient-tag { font-family: 'Share Tech Mono', monospace; font-size: clamp(10px, 1.3vh, 13px); letter-spacing: 2px; color: #7fe6f8; border: 1px solid rgba(0, 229, 255, 0.3); padding: 5px 12px; }
.preview-iframe { width: 100%; height: 100%; border: none; background: #000; display: block; }
</style>
