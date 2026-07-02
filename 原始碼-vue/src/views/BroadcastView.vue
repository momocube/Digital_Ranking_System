<script setup lang="ts">
/**
 * 投播畫面 BroadcastView.vue — 給大螢幕看的成品
 * 對應舊版 投播畫面.dc.html。功能:
 *  - 直式 1080×1920 / 橫式 1920×1080 兩種佈局,依 payload.orientation 決定
 *  - 用 transform:scale 塞進任何視窗(包含控制台 iframe 預覽 380×676)
 *  - 從 localStorage(leaderboard_cast 或 leaderboard_preview)讀 payload
 *  - 也接收 postMessage 'cast' 事件(控制台直接推送用)
 *  - 開新窗時發 'ready' 回 opener/parent,讓控制台推目前資料過來
 *  - src=preview 隱藏中英切換與全螢幕按鈕
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useLanguage } from '@/composables/useLanguage';
import { LB, type Payload, type Row } from '@/data/leaderboard-data';

const { en, setLang } = useLanguage();

// ---- src 判斷:URL query 或 hash 決定「這是預覽 iframe 還是 cast 大螢幕」 ----
type Src = 'cast' | 'preview';
const src = ref<Src>('cast');
const detectSrc = (): Src => {
  try {
    const u = new URL(location.href);
    const fromQuery = u.searchParams.get('src');
    const fromHash = new URLSearchParams((u.hash || '').replace(/^#/, '')).get('src');
    const val = fromQuery || fromHash || 'cast';
    return val === 'preview' ? 'preview' : 'cast';
  } catch {
    return 'cast';
  }
};

const storageKey = computed(() => src.value === 'preview' ? 'leaderboard_preview' : 'leaderboard_cast');
const showFs = computed(() => src.value !== 'preview');

// ---- payload 狀態 ----
const payload = ref<Payload | null>(null);

// 預設(當還沒收到任何資料時給個示範畫面)
const defaultRows = (): Row[] => [
  { _id: 'd0', teamZh: '霓虹幽靈', teamEn: 'NEON GHOST',    stage: '9-4', time: '06:42.18', score: '9,982,400' },
  { _id: 'd1', teamZh: '數據風暴', teamEn: 'DATA STORM',    stage: '9-2', time: '07:15.40', score: '9,640,210' },
  { _id: 'd2', teamZh: '鈦合金狼', teamEn: 'TITAN WOLF',    stage: '8-5', time: '07:58.92', score: '9,210,880' },
  { _id: 'd3', teamZh: '像素獵手', teamEn: 'PIXEL HUNTER',  stage: '8-3', time: '06:33.05', score: '8,870,500' },
  { _id: 'd4', teamZh: '暗影協議', teamEn: 'SHADOW PROTOCOL', stage: '8-1', time: '08:02.77', score: '8,540,120' },
  { _id: 'd5', teamZh: '電弧核心', teamEn: 'ARC CORE',      stage: '7-4', time: '08:44.30', score: '8,120,640' },
  { _id: 'd6', teamZh: '故障矩陣', teamEn: 'GLITCH MATRIX', stage: '7-2', time: '07:21.66', score: '7,760,300' },
  { _id: 'd7', teamZh: '鉻合金蛇', teamEn: 'CHROME VIPER',  stage: '6-5', time: '09:10.12', score: '7,430,890' },
  { _id: 'd8', teamZh: '零號終端', teamEn: 'ZERO TERMINAL', stage: '6-3', time: '09:55.48', score: '7,010,250' },
  { _id: 'd9', teamZh: '合成之心', teamEn: 'SYNTH HEART',   stage: '6-1', time: '08:38.91', score: '6,680,770' }
];
const defaultPayload = (): Payload => ({
  region: { zh: 'NEON CLASH 2026', en: 'NEON CLASH 2026' },
  venue:  { zh: '主競技場',        en: 'MAIN ARENA' },
  orientation: 'portrait',
  rows: defaultRows(),
  updated: Date.now()
});

const loadPayload = () => {
  try {
    const raw = localStorage.getItem(storageKey.value);
    if (raw) { payload.value = JSON.parse(raw) as Payload; return; }
  } catch {}
  // 沒有 localStorage 資料 → 用 LB.current 抓一組當預設
  const first = LB.current('tpe', 'f480');
  if (first) payload.value = { ...first, orientation: 'portrait' };
};

// ---- 監聽:storage / postMessage / resize ----
const vw = ref(typeof window !== 'undefined' ? window.innerWidth  : 1920);
const vh = ref(typeof window !== 'undefined' ? window.innerHeight : 1080);

const onStorage = (e: StorageEvent) => {
  if (e.key === storageKey.value && e.newValue) {
    try { payload.value = JSON.parse(e.newValue) as Payload; } catch {}
  }
};
const onMsg = (e: MessageEvent) => {
  const d = e.data;
  if (!d || typeof d !== 'object') return;
  if (d.type === 'cast' && d.payload) payload.value = d.payload as Payload;
};
const onResize = () => {
  vw.value = window.innerWidth;
  vh.value = window.innerHeight;
};

onMounted(() => {
  src.value = detectSrc();
  loadPayload();

  window.addEventListener('storage', onStorage);
  window.addEventListener('message', onMsg);
  window.addEventListener('resize', onResize);

  // 告訴 opener / parent「我準備好了,請推目前資料過來」
  try { if (window.opener) window.opener.postMessage({ type: 'ready' }, '*'); } catch {}
  try { if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'ready' }, '*'); } catch {}
});

onUnmounted(() => {
  window.removeEventListener('storage', onStorage);
  window.removeEventListener('message', onMsg);
  window.removeEventListener('resize', onResize);
});

// ---- 全螢幕 ----
const enterFs = () => {
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => void;
    msRequestFullscreen?: () => void;
  };
  const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  if (fn) fn.call(el);
};

// ---- 佈局 computed ----
const P = computed<Payload>(() => payload.value || defaultPayload());
const isPortrait  = computed(() => (P.value.orientation || 'portrait') !== 'landscape');
const isLandscape = computed(() => !isPortrait.value);
const W = computed(() => isPortrait.value ? 1080 : 1920);
const H = computed(() => isPortrait.value ? 1920 : 1080);
const scale = computed(() => Math.min(vw.value / W.value, vh.value / H.value) || 1);

const cols = computed(() => isPortrait.value
  ? '84px 1.3fr 0.8fr 1.05fr 1.35fr'
  : '120px 1.1fr 1fr 1.05fr 1.1fr');
const gap = computed(() => isPortrait.value ? '22px' : '32px');
const rowPad = computed(() => isPortrait.value ? '0 26px' : '0 36px');

// 各列字級(前 3 名放大 = 尾巴帶 T 的那組)
const sz = computed(() => {
  const eng = en.value;
  return isPortrait.value
    ? { rank: 40, team: eng ? 32 : 38, stage: 34, time: 31, score: 36,
        rankT: 46, teamT: eng ? 34 : 40, stageT: 36, timeT: 32, scoreT: 38 }
    : { rank: 36, team: eng ? 30 : 34, stage: 32, time: 30, score: 34,
        rankT: 42, teamT: eng ? 32 : 36, stageT: 34, timeT: 32, scoreT: 36 };
});

// ---- 隊名 20 字截斷 ----
const truncate = (s: string | undefined): string => {
  if (s == null) return '';
  const str = String(s);
  return str.length <= 20 ? str : str.slice(0, 19) + '…';
};

// ---- 前三名 tier 顏色 ----
interface Tier { rankC: string; bL: string; bd: string; bg: string; teamC: string; stageC: string; timeC: string; sh: string; }
const tier = (i: number): Tier => {
  if (i === 0) return { rankC: '#ffe27a', bL: '#ffd84d', bd: 'rgba(255,216,77,.3)', bg: 'linear-gradient(90deg,rgba(255,216,77,.13),rgba(0,229,255,.02))', teamC: '#ffffff', stageC: '#ffe27a', timeC: '#fff0bf', sh: 'inset 0 0 28px rgba(255,216,77,.08)' };
  if (i === 1) return { rankC: '#aef4ff', bL: '#7ff0ff', bd: 'rgba(0,229,255,.22)', bg: 'linear-gradient(90deg,rgba(0,229,255,.09),rgba(0,229,255,.015))', teamC: '#eafdff', stageC: '#aef4ff', timeC: '#9fe9ff', sh: 'none' };
  if (i === 2) return { rankC: '#ff8fd0', bL: '#ff5db4', bd: 'rgba(255,45,149,.22)', bg: 'linear-gradient(90deg,rgba(255,45,149,.08),rgba(0,229,255,.012))', teamC: '#ffeaf6', stageC: '#ff8fd0', timeC: '#9fe9ff', sh: 'none' };
  return { rankC: '#5f93a8', bL: 'rgba(0,229,255,.28)', bd: 'rgba(0,229,255,.12)', bg: 'linear-gradient(90deg,rgba(0,229,255,.045),rgba(0,229,255,.01))', teamC: '#dff6ff', stageC: '#bfe9f5', timeC: '#8fd6ea', sh: 'none' };
};

// ---- 排行列 ----
const rows = computed(() => {
  const list = (P.value.rows || []).slice(0, 10);
  return list.map((r, i) => {
    const t = tier(i);
    const top = i < 3;
    const blW = isPortrait.value ? (top ? '5px' : '4px') : (top ? '4px' : '3px');
    const s = sz.value;
    return {
      key: r._id || `row-${i}`,
      rankText: String(i + 1).padStart(2, '0'),
      team: truncate(en.value ? (r.teamEn || r.teamZh) : (r.teamZh || r.teamEn)),
      stage: r.stage,
      time: r.time,
      score: r.score,
      rowStyle: {
        display: 'grid',
        gridTemplateColumns: cols.value,
        alignItems: 'center',
        gap: gap.value,
        flex: '1',
        padding: rowPad.value,
        border: `1px solid ${t.bd}`,
        borderLeft: `${blW} solid ${t.bL}`,
        background: t.bg,
        boxShadow: t.sh
      } as Record<string, string>,
      rankStyle: {
        fontFamily: 'Orbitron,sans-serif',
        fontWeight: (top ? 900 : 700).toString(),
        fontSize:   (top ? s.rankT : s.rank) + 'px',
        color: t.rankC,
        textAlign: 'center',
        textShadow: top ? `0 0 14px ${t.rankC}` : 'none'
      } as Record<string, string>,
      teamStyle: {
        fontFamily: en.value ? 'Rajdhani,sans-serif' : "'Noto Sans TC',sans-serif",
        fontWeight: '700',
        fontSize: (top ? s.teamT : s.team) + 'px',
        letterSpacing: en.value ? '1px' : '0',
        color: t.teamC
      } as Record<string, string>,
      stageStyle: {
        fontFamily: 'Orbitron,sans-serif',
        fontWeight: '700',
        fontSize: (top ? s.stageT : s.stage) + 'px',
        color: t.stageC,
        textAlign: 'center',
        textShadow: top ? `0 0 10px ${t.stageC}` : 'none'
      } as Record<string, string>,
      timeStyle: {
        fontFamily: "'Share Tech Mono',monospace",
        fontSize: (top ? s.timeT : s.time) + 'px',
        color: t.timeC,
        textAlign: 'right'
      } as Record<string, string>,
      scoreStyle: {
        fontFamily: 'Orbitron,sans-serif',
        fontWeight: '700',
        fontSize: (top ? s.scoreT : s.score) + 'px',
        color: '#ff5db4',
        textAlign: 'right',
        textShadow: '0 0 12px rgba(255,45,149,.45)'
      } as Record<string, string>
    };
  });
});

// ---- 標題、場域、狀態 ----
const region    = computed(() => P.value.region ? (en.value ? P.value.region.en : P.value.region.zh) : '');
const venueName = computed(() => P.value.venue  ? (en.value ? P.value.venue.en  : P.value.venue.zh)  : '');

const p2 = (n: number) => String(n).padStart(2, '0');
const updatedText = computed(() => {
  const d = new Date(P.value.updated || Date.now());
  return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
});
const statusText = computed(() => `${region.value} · ${en.value ? 'UPDATED ' : '更新 '}${updatedText.value}`);

const titleMain = computed(() => en.value ? 'LEADERBOARD' : '排行榜');
const titleSub  = computed(() => en.value ? 'RANKINGS'    : 'LEADERBOARD');

const titleMainStyle = computed(() => en.value
  ? { fontFamily: 'Orbitron,sans-serif',      fontWeight: '900', fontSize: `${isPortrait.value ? 72  : 56}px`, lineHeight: '1', letterSpacing: '4px', color: '#eafdff', textShadow: '0 0 30px rgba(0,229,255,.6),0 0 5px rgba(0,229,255,.9)' } as Record<string, string>
  : { fontFamily: "'Noto Sans TC',sans-serif", fontWeight: '900', fontSize: `${isPortrait.value ? 104 : 72}px`, lineHeight: isPortrait.value ? '.95' : '1', color: '#eafdff', textShadow: '0 0 30px rgba(0,229,255,.6),0 0 5px rgba(0,229,255,.9)' } as Record<string, string>);

const titleSubStyle = computed(() => en.value
  ? { fontFamily: 'Rajdhani,sans-serif',  fontWeight: '700', fontSize: `${isPortrait.value ? 22 : 20}px`, letterSpacing: '7px', color: '#ff2d95', textShadow: '0 0 16px rgba(255,45,149,.6)' } as Record<string, string>
  : { fontFamily: 'Orbitron,sans-serif',  fontWeight: '700', fontSize: `${isPortrait.value ? 30 : 26}px`, letterSpacing: isPortrait.value ? '7px' : '6px', color: '#ff2d95', textShadow: '0 0 16px rgba(255,45,149,.6)' } as Record<string, string>);

// ---- 版面容器 style ----
const stageStyle = computed(() => ({
  position: 'relative',
  width: `${W.value}px`,
  height: `${H.value}px`,
  overflow: 'hidden',
  background: '#05070f',
  fontFamily: "'Noto Sans TC',sans-serif",
  transform: `scale(${scale.value})`,
  transformOrigin: 'center center',
  flex: '0 0 auto'
}) as Record<string, string>);

const contentStyle = computed(() => ({
  position: 'relative',
  zIndex: '2',
  height: '100%',
  padding: isPortrait.value ? '54px 44px 44px' : '50px 60px 50px',
  display: 'flex',
  flexDirection: 'column' as const
}));

const colHeaderStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: cols.value,
  alignItems: 'center',
  gap: gap.value,
  padding: isPortrait.value ? '22px 26px 14px' : '20px 36px 18px',
  fontFamily: 'Rajdhani,sans-serif',
  fontWeight: '700',
  fontSize: '18px',
  letterSpacing: '4px',
  color: '#4f8aa0'
} as Record<string, string>));

const rowsWrapStyle = computed(() => ({
  display: 'flex',
  flexDirection: 'column' as const,
  gap: isPortrait.value ? '9px' : '12px',
  flex: '1'
}));

// ---- 語言按鈕樣式 ----
const langBase = {
  fontFamily: 'Rajdhani,sans-serif', fontWeight: '700',
  fontSize: 'clamp(11px,1.5vh,14px)', letterSpacing: '2px',
  padding: 'clamp(6px,1vh,8px) clamp(10px,1.4vw,14px)',
  cursor: 'pointer', border: '1px solid rgba(0,229,255,.3)',
  background: 'rgba(0,0,0,.4)', color: '#5f93a8'
} as Record<string, string>;
const langOn: Record<string, string> = { ...langBase, border: '1px solid #34c8e8', background: 'rgba(0,229,255,.16)', color: '#eafdff' };

// ---- 標籤文字 ----
const venueLabel = computed(() => en.value ? 'FIELD' : '場域');
const lblRank  = computed(() => en.value ? 'RANK'  : '排名');
const lblTeam  = computed(() => en.value ? 'TEAM'  : '隊伍');
const lblStage = computed(() => en.value ? 'STAGE' : '關卡');
const lblTime  = computed(() => en.value ? 'TIME'  : '破關時間');
const lblScore = computed(() => en.value ? 'SCORE' : '分數');
const fsLabel  = computed(() => en.value ? 'FULLSCREEN' : '全螢幕');
const footerLeft  = computed(() => `${venueName.value}${en.value ? ' · AUTO-SYNC' : ' · 自動擷取中'}`);
const footerRight = computed(() => en.value
  ? '// 5 SUB-STAGES PER TIER · NEON CLASH RANKING'
  : '// 每 5 小關晉升一大關 · NEON CLASH RANKING');
</script>

<template>
  <div class="broadcast-root">
    <!-- 只有 cast 模式才顯示上方語言與全螢幕按鈕 -->
    <template v-if="showFs">
      <div class="top-lang">
        <button @click="setLang('zh')" :style="en ? langBase : langOn">中文</button>
        <button @click="setLang('en')" :style="en ? langOn   : langBase">EN</button>
      </div>
      <button @click="enterFs" class="fs-btn">⛶ {{ fsLabel }}</button>
    </template>

    <!-- 主 stage:固定 W×H,靠 scale 塞進視窗 -->
    <div :style="stageStyle">
      <!-- 背景:網格 / 上暈 / 下暈 / 邊緣暗角 / 掃描線 -->
      <div class="bg-grid"></div>
      <div class="bg-top-glow"></div>
      <div class="bg-bottom-glow"></div>
      <div class="bg-vignette"></div>
      <div class="bg-scan"></div>

      <div :style="contentStyle">
        <!-- 直式標題 -->
        <div v-if="isPortrait" class="header-portrait">
          <div class="header-kicker">◢ LIVE RANKING SYSTEM ◣</div>
          <div class="header-title-stack">
            <span :style="titleMainStyle">{{ titleMain }}</span>
            <span :style="titleSubStyle">{{ titleSub }}</span>
          </div>
          <div class="venue-capsule">
            <span class="venue-label-p">{{ venueLabel }}</span>
            <span class="venue-divider"></span>
            <span class="venue-name-p">{{ venueName }}</span>
          </div>
          <div class="status-row">
            <span class="live-badge">
              <span class="live-dot"></span>LIVE
            </span>
            <span>{{ statusText }}</span>
          </div>
        </div>

        <!-- 橫式標題 -->
        <div v-if="isLandscape" class="header-landscape">
          <div>
            <div class="header-kicker-l">◢ LIVE RANKING SYSTEM</div>
            <div class="header-title-row">
              <span :style="titleMainStyle">{{ titleMain }}</span>
              <span :style="titleSubStyle">{{ titleSub }}</span>
            </div>
          </div>
          <div class="header-right">
            <div class="venue-capsule venue-capsule-l">
              <span class="venue-label-l">{{ venueLabel }}</span>
              <span class="venue-divider-l"></span>
              <span class="venue-name-l">{{ venueName }}</span>
            </div>
            <div class="status-row-l">
              <span class="live-badge live-badge-l">
                <span class="live-dot live-dot-l"></span>LIVE
              </span>
              <span>{{ statusText }}</span>
            </div>
          </div>
        </div>

        <!-- 欄位表頭 -->
        <div :style="colHeaderStyle">
          <div style="text-align:center">{{ lblRank }}</div>
          <div>{{ lblTeam }}</div>
          <div style="text-align:center">{{ lblStage }}</div>
          <div style="text-align:right">{{ lblTime }}</div>
          <div style="text-align:right">{{ lblScore }}</div>
        </div>

        <!-- 10 名資料列 -->
        <div :style="rowsWrapStyle">
          <div v-for="r in rows" :key="r.key" :style="r.rowStyle">
            <div :style="r.rankStyle">{{ r.rankText }}</div>
            <div :style="r.teamStyle">{{ r.team }}</div>
            <div :style="r.stageStyle">{{ r.stage }}</div>
            <div :style="r.timeStyle">{{ r.time }}</div>
            <div :style="r.scoreStyle">{{ r.score }}</div>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <span>&gt; {{ footerLeft }}<span class="cursor">_</span></span>
          <span class="footer-right">{{ footerRight }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.broadcast-root {
  width: 100vw;
  height: 100vh;
  background: #02040a;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* ===== 頂部按鈕(僅 cast 模式) ===== */
.top-lang {
  position: fixed;
  top: clamp(10px, 1.8vh, 18px);
  left: clamp(10px, 1.5vw, 18px);
  z-index: 50;
  display: flex;
  gap: 8px;
}
.fs-btn {
  position: fixed;
  top: clamp(10px, 1.8vh, 18px);
  right: clamp(10px, 1.5vw, 18px);
  z-index: 50;
  font-family: Rajdhani, sans-serif;
  font-weight: 700;
  font-size: clamp(12px, 1.6vh, 15px);
  letter-spacing: 3px;
  color: #7fe6f8;
  background: rgba(0, 229, 255, 0.1);
  border: 1px solid rgba(0, 229, 255, 0.5);
  padding: clamp(7px, 1.2vh, 10px) clamp(12px, 1.6vw, 18px);
  cursor: pointer;
}

/* ===== stage 背景層 ===== */
.bg-grid {
  position: absolute;
  inset: -48px;
  background-image:
    linear-gradient(rgba(0, 229, 255, 0.10) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 229, 255, 0.10) 1px, transparent 1px);
  background-size: 48px 48px;
  animation: gridPan 16s linear infinite;
}
.bg-top-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 90% 38% at 50% 3%, rgba(0, 229, 255, 0.17), transparent 70%);
  animation: breathe 6s ease-in-out infinite;
  pointer-events: none;
}
.bg-bottom-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 80% 32% at 50% 100%, rgba(255, 45, 149, 0.16), transparent 70%);
  pointer-events: none;
}
.bg-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 110% 110% at 50% 50%, transparent 56%, rgba(0, 0, 0, 0.55));
  pointer-events: none;
}
.bg-scan {
  position: absolute;
  left: 0;
  right: 0;
  height: 200px;
  background: linear-gradient(rgba(0, 229, 255, 0), rgba(0, 229, 255, 0.08), rgba(0, 229, 255, 0));
  animation: scan 10s linear infinite;
  pointer-events: none;
}
@keyframes breathe {
  0%, 100% { opacity: 0.32; }
  50% { opacity: 0.85; }
}
@keyframes scan {
  0% { transform: translateY(-200px); }
  100% { transform: translateY(1960px); }
}

/* ===== 直式標題 ===== */
.header-portrait {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 18px;
  border-bottom: 1px solid rgba(0, 229, 255, 0.2);
  padding-bottom: 34px;
}
.header-kicker {
  font-family: Rajdhani, sans-serif;
  font-weight: 700;
  font-size: 20px;
  letter-spacing: 9px;
  color: #34c8e8;
}
.header-title-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.venue-capsule {
  display: inline-flex;
  align-items: center;
  gap: 18px;
  background: linear-gradient(90deg, rgba(255, 45, 149, 0.16), rgba(0, 229, 255, 0.16));
  border: 1.5px solid rgba(0, 229, 255, 0.55);
  box-shadow: 0 0 26px rgba(0, 229, 255, 0.22), inset 0 0 18px rgba(255, 45, 149, 0.12);
  padding: 16px 34px;
}
.venue-label-p {
  font-family: Rajdhani, sans-serif;
  font-weight: 700;
  font-size: 17px;
  letter-spacing: 5px;
  color: #ff6bb0;
}
.venue-divider {
  width: 1px;
  height: 38px;
  background: rgba(0, 229, 255, 0.4);
}
.venue-name-p {
  font-family: 'Noto Sans TC', sans-serif;
  font-weight: 900;
  font-size: 44px;
  line-height: 1;
  color: #fff;
  text-shadow: 0 0 18px rgba(0, 229, 255, 0.7);
}
.status-row {
  display: flex;
  align-items: center;
  gap: 16px;
  font-family: 'Share Tech Mono', monospace;
  font-size: 17px;
  letter-spacing: 2px;
  color: #5fb6cf;
}
.live-badge {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  color: #ff8fc4;
}
.live-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ff2d95;
  box-shadow: 0 0 10px #ff2d95;
  animation: pulse 1.6s ease-in-out infinite;
}

/* ===== 橫式標題 ===== */
.header-landscape {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(0, 229, 255, 0.2);
  padding-bottom: 22px;
}
.header-kicker-l {
  font-family: Rajdhani, sans-serif;
  font-weight: 700;
  font-size: 17px;
  letter-spacing: 7px;
  color: #34c8e8;
}
.header-title-row {
  display: flex;
  align-items: center;
  gap: 22px;
  margin-top: 6px;
}
.header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 14px;
}
.venue-capsule-l {
  gap: 16px;
  padding: 14px 30px;
  box-shadow: 0 0 24px rgba(0, 229, 255, 0.22), inset 0 0 18px rgba(255, 45, 149, 0.12);
}
.venue-label-l {
  font-family: Rajdhani, sans-serif;
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 5px;
  color: #ff6bb0;
}
.venue-divider-l {
  width: 1px;
  height: 34px;
  background: rgba(0, 229, 255, 0.4);
}
.venue-name-l {
  font-family: 'Noto Sans TC', sans-serif;
  font-weight: 900;
  font-size: 38px;
  line-height: 1;
  color: #fff;
  text-shadow: 0 0 18px rgba(0, 229, 255, 0.7);
}
.status-row-l {
  display: flex;
  align-items: center;
  gap: 14px;
  font-family: 'Share Tech Mono', monospace;
  font-size: 16px;
  letter-spacing: 2px;
  color: #5fb6cf;
}
.live-badge-l { gap: 9px; }
.live-dot-l {
  width: 9px;
  height: 9px;
}

/* ===== Footer ===== */
.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid rgba(0, 229, 255, 0.18);
  font-family: 'Share Tech Mono', monospace;
  font-size: 15px;
  letter-spacing: 2px;
  color: #3f7f93;
}
.cursor { color: #34c8e8; }
.footer-right { color: #ff6bb0; }
</style>
