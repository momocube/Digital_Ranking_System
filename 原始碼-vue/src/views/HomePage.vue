<script setup lang="ts">
/**
 * 主頁 HomePage.vue — 系統入口
 * 對應舊版 主頁.dc.html。功能:
 *  - 讀 license.json / localStorage 判斷已綁定 / 未綁定 / 載入中
 *  - 中英切換(共用 leaderboard_lang localStorage,跨分頁同步)
 *  - 進入按鈕帶到 console.html;未綁定則失效
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useLanguage } from '@/composables/useLanguage';
import { useLicense } from '@/composables/useLicense';

const { en, setLang } = useLanguage();
const { license, loading, bound, unbound } = useLicense();

// ---- 時鐘 ----
const time = ref('');
const p2 = (n: number) => String(n).padStart(2, '0');
const tick = () => {
  const d = new Date();
  time.value = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
};
let timer: number | undefined;
onMounted(() => { tick(); timer = window.setInterval(tick, 1000); });
onUnmounted(() => { if (timer) clearInterval(timer); });

// ---- 進入 ----
const enter = () => {
  if (!license.value) return;
  window.location.href = './console.html';
};

// ---- 顯示用 computed ----
const maskKey = (k: string | undefined): string => {
  if (!k) return '— —';
  if (k.length <= 6) return k;
  return `${k.slice(0, 3)}-***-${k.slice(-4)}`;
};

const storeNameZh = computed(() => license.value?.storeNameZh || license.value?.storeName || '— —');
const storeNameEn = computed(() => license.value?.storeNameEn || '');
const venuesText = computed(() => {
  const v = license.value?.venues;
  if (!v) return '— —';
  return Array.isArray(v) ? v.map((x) => String(x).toUpperCase()).join(' · ') : String(v).toUpperCase();
});
const keyMasked = computed(() => maskKey(license.value?.key));

const statusText = computed(() => loading.value ? 'CHECKING' : (bound.value ? 'AUTHORIZED' : 'UNAUTHORIZED'));

// 標題:zh 主中文/副英文,en 主英文/副不同英文
const titleMain = computed(() => en.value ? 'LIVE RANKING' : '即時排行系統');
const titleSub  = computed(() => en.value ? 'LEADERBOARD SYSTEM' : 'LIVE RANKING');

// 已綁定主副:zh 主中(動詞+店名)/副英店名,en 主英店名/副中店名
const boundName = computed(() => en.value ? (storeNameEn.value || storeNameZh.value) : `金鑰已綁定:${storeNameZh.value}`);
const boundSub  = computed(() => en.value ? storeNameZh.value : storeNameEn.value);

// 未綁定訊息
const unboundMain = computed(() => en.value ? '⚠ NO LICENSE KEY' : '⚠ 尚未綁定金鑰');
const unboundSub  = computed(() => en.value ? 'UNAUTHORIZED STATION' : 'NO LICENSE KEY DETECTED');
const unboundDesc = computed(() =>
  en.value
    ? 'This station has not been registered. Please complete license binding in the main software before opening this page.'
    : '本機尚未完成金鑰註冊,無法啟動投播控制台。請先在主軟體完成金鑰綁定後再進入此頁。'
);

// 按鈕文字
const btnText = computed(() => {
  if (bound.value) return en.value ? 'ENTER CONSOLE' : '進入控制台';
  return en.value ? 'LOCKED' : '進入受限';
});
const btnIcon = computed(() => bound.value ? '▶' : '⚿');
</script>

<template>
  <div class="home-root">
    <!-- 背景層 -->
    <div class="bg-grid"></div>
    <div class="bg-edge-glow"></div>
    <div class="bg-scan-line"></div>

    <!-- 右上中英切換 -->
    <div class="lang-buttons">
      <button @click="setLang('zh')" :class="['lang-btn', { active: !en }]">中文</button>
      <button @click="setLang('en')" :class="['lang-btn', { active: en }]">EN</button>
    </div>

    <!-- 主內容 -->
    <div class="content">
      <!-- 標題區 -->
      <div class="title-block">
        <div class="kicker">◢ NEON CLASH · LEADERBOARD ◣</div>
        <div :class="['title-main', en ? 'title-en' : 'title-zh']">{{ titleMain }}</div>
        <div :class="['title-sub',  en ? 'title-en' : 'title-zh']">{{ titleSub }}</div>
      </div>

      <!-- 身份卡 -->
      <div :class="['card', { 'card-bound': bound, 'card-unbound': unbound, 'card-loading': loading }]">
        <div class="card-header">
          <div class="card-header-label">AUTHORIZATION STATUS</div>
          <div class="card-status">
            <span :class="['dot', bound ? 'dot-bound' : unbound ? 'dot-unbound' : 'dot-loading']"></span>
            <span :class="['status', bound ? 'status-bound' : unbound ? 'status-unbound' : 'status-loading']">
              {{ statusText }}
            </span>
          </div>
        </div>

        <!-- 已綁定 -->
        <div v-if="bound" class="body-bound">
          <div>
            <div class="mono-label">KEY BOUND TO</div>
            <div :class="['bound-name', en ? 'bound-name-en' : 'bound-name-zh']">{{ boundName }}</div>
            <div :class="['bound-sub',  en ? 'bound-sub-en' : 'bound-sub-zh']">{{ boundSub }}</div>
          </div>
          <div class="bound-grid">
            <div>
              <div class="mono-sublabel">FIELD AUTHORIZED</div>
              <div class="mono-value">{{ venuesText }}</div>
            </div>
            <div>
              <div class="mono-sublabel">KEY ID</div>
              <div class="mono-value">{{ keyMasked }}</div>
            </div>
          </div>
        </div>

        <!-- 未綁定 -->
        <div v-else-if="unbound" class="body-unbound">
          <div :class="['unbound-main', en ? 'unbound-en' : 'unbound-zh']">{{ unboundMain }}</div>
          <div class="unbound-sub">{{ unboundSub }}</div>
          <div :class="['unbound-desc', en ? 'desc-en' : 'desc-zh']">{{ unboundDesc }}</div>
        </div>

        <!-- 載入中 -->
        <div v-else class="body-loading">
          <span class="dot dot-loading"></span>
          <span class="loading-text">CHECKING LICENSE...</span>
        </div>
      </div>

      <!-- 進入按鈕 -->
      <button
        @click="enter"
        :class="['enter-btn', bound ? 'enter-enabled' : 'enter-disabled']"
      >
        <span :class="['enter-icon', { faded: !bound }]">{{ btnIcon }}</span>
        <span>{{ btnText }}</span>
      </button>

      <!-- 底部 -->
      <div class="footer">
        <div>NEON CLASH BROADCAST SYSTEM · v1.0</div>
        <div class="footer-time">{{ time }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===== 版面容器 ===== */
.home-root {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(ellipse 80% 60% at 20% 0%, rgba(0, 229, 255, 0.08), transparent 60%),
    radial-gradient(ellipse 70% 60% at 100% 100%, rgba(255, 45, 149, 0.08), transparent 60%),
    #05070f;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Noto Sans TC', sans-serif;
}

.bg-grid {
  position: absolute;
  inset: -48px;
  background-image:
    linear-gradient(rgba(0, 229, 255, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 229, 255, 0.07) 1px, transparent 1px);
  background-size: 48px 48px;
  animation: gridPan 16s linear infinite;
  pointer-events: none;
}
.bg-edge-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 110% 110% at 50% 50%, transparent 56%, rgba(0, 0, 0, 0.55));
  pointer-events: none;
}
.bg-scan-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 180px;
  background: linear-gradient(rgba(0, 229, 255, 0), rgba(0, 229, 255, 0.07), rgba(0, 229, 255, 0));
  animation: scan 9s linear infinite;
  pointer-events: none;
}

/* ===== 語言切換 ===== */
.lang-buttons {
  position: absolute;
  top: clamp(14px, 2.5vh, 24px);
  right: clamp(14px, 2vw, 28px);
  z-index: 20;
  display: flex;
  gap: 8px;
}
.lang-btn {
  font-family: Rajdhani, sans-serif;
  font-weight: 700;
  font-size: clamp(11px, 1.5vh, 14px);
  letter-spacing: 2px;
  padding: clamp(5px, 0.8vh, 7px) clamp(10px, 1.4vw, 16px);
  cursor: pointer;
  border: 1px solid rgba(0, 229, 255, 0.3);
  background: rgba(0, 0, 0, 0.4);
  color: #5f93a8;
}
.lang-btn.active {
  border-color: #34c8e8;
  background: rgba(0, 229, 255, 0.16);
  color: #eafdff;
}

/* ===== 主內容 ===== */
.content {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(14px, 3vh, 38px);
  padding: clamp(12px, 3vh, 40px);
  max-width: 100vw;
  max-height: 100vh;
}

/* ===== 標題 ===== */
.title-block { text-align: center; }
.kicker {
  font-family: Rajdhani, sans-serif;
  font-weight: 700;
  font-size: clamp(11px, 1.8vh, 17px);
  letter-spacing: clamp(5px, 1vw, 11px);
  color: #34c8e8;
  margin-bottom: clamp(8px, 1.5vh, 14px);
}
.title-main {
  font-weight: 900;
  font-size: clamp(32px, 7.5vh, 64px);
  color: #eafdff;
  line-height: 1;
  animation: titleGlow 4s ease-in-out infinite;
}
.title-main.title-zh { font-family: 'Noto Sans TC', sans-serif; letter-spacing: clamp(4px, 0.9vw, 8px); }
.title-main.title-en { font-family: Orbitron, sans-serif; letter-spacing: clamp(2px, 0.6vw, 6px); }
.title-sub {
  font-weight: 900;
  font-size: clamp(14px, 2.4vh, 22px);
  letter-spacing: clamp(4px, 0.9vw, 8px);
  color: #ff2d95;
  margin-top: clamp(8px, 1.5vh, 14px);
  text-shadow: 0 0 14px rgba(255, 45, 149, 0.5);
}
.title-sub.title-zh { font-family: Orbitron, sans-serif; font-weight: 700; }
.title-sub.title-en { font-family: Rajdhani, sans-serif; font-weight: 700; }

/* ===== 身份卡 ===== */
.card {
  width: min(580px, 92vw);
  padding: clamp(16px, 3vh, 28px) clamp(20px, 4vw, 36px);
}
.card-bound {
  border: 1px solid rgba(0, 229, 255, 0.35);
  background: linear-gradient(160deg, rgba(0, 229, 255, 0.05), rgba(0, 229, 255, 0.01));
  box-shadow: 0 0 40px rgba(0, 229, 255, 0.15), inset 0 0 30px rgba(0, 229, 255, 0.03);
}
.card-unbound {
  border: 1px solid rgba(255, 51, 85, 0.45);
  background: linear-gradient(160deg, rgba(255, 51, 85, 0.07), rgba(255, 51, 85, 0.01));
  box-shadow: 0 0 40px rgba(255, 51, 85, 0.2), inset 0 0 30px rgba(255, 51, 85, 0.04);
}
.card-loading {
  border: 1px solid rgba(0, 229, 255, 0.18);
  background: rgba(0, 229, 255, 0.02);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: clamp(14px, 2.5vh, 24px);
  padding-bottom: clamp(12px, 2vh, 18px);
  border-bottom: 1px solid;
}
.card-bound   > .card-header { border-bottom-color: rgba(0, 229, 255, 0.2); }
.card-unbound > .card-header { border-bottom-color: rgba(255, 51, 85, 0.25); }
.card-loading > .card-header { border-bottom-color: rgba(0, 229, 255, 0.15); }

.card-header-label {
  font-family: Rajdhani, sans-serif;
  font-weight: 700;
  font-size: clamp(10px, 1.5vh, 13px);
  letter-spacing: clamp(3px, 0.6vw, 5px);
  color: #4f8aa0;
}
.card-status { display: flex; align-items: center; gap: 10px; }
.dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
.dot-bound   { background: #34c8e8; box-shadow: 0 0 10px #34c8e8; animation: pulse 1.6s ease-in-out infinite; }
.dot-unbound { background: #ff3355; box-shadow: 0 0 10px #ff3355; animation: pulseRed 1.2s ease-in-out infinite; }
.dot-loading { background: #7f8fa0; box-shadow: 0 0 8px  #7f8fa0; animation: pulse 1.2s ease-in-out infinite; }
.status {
  font-family: 'Share Tech Mono', monospace;
  font-size: clamp(10px, 1.5vh, 13px);
  letter-spacing: 2.5px;
}
.status-bound   { color: #7fe6f8; }
.status-unbound { color: #ff8899; }
.status-loading { color: #9aa8b8; }

/* ===== 已綁定 ===== */
.body-bound { display: flex; flex-direction: column; gap: clamp(12px, 2vh, 18px); }
.mono-label {
  font-family: 'Share Tech Mono', monospace;
  font-size: clamp(9px, 1.3vh, 12px);
  letter-spacing: 2px;
  color: #5fb6cf;
  margin-bottom: clamp(4px, 1vh, 8px);
}
.bound-name {
  font-weight: 900;
  color: #eafdff;
  text-shadow: 0 0 18px rgba(0, 229, 255, 0.5);
  line-height: 1.2;
}
.bound-name.bound-name-zh { font-family: 'Noto Sans TC', sans-serif; font-size: clamp(18px, 3.5vh, 30px); letter-spacing: 1px; }
.bound-name.bound-name-en { font-family: Orbitron, sans-serif;      font-size: clamp(20px, 3.8vh, 32px); letter-spacing: clamp(3px, 0.6vw, 5px); }

.bound-sub {
  font-weight: 700;
  color: #ff6bb0;
  margin-top: clamp(4px, 1vh, 8px);
}
.bound-sub.bound-sub-zh { font-family: Orbitron, sans-serif;      font-size: clamp(12px, 2.1vh, 18px); letter-spacing: clamp(3px, 0.6vw, 5px); }
.bound-sub.bound-sub-en { font-family: 'Noto Sans TC', sans-serif; font-size: clamp(12px, 2vh, 17px); letter-spacing: 1px; }

.bound-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(12px, 2vw, 18px);
  padding-top: clamp(10px, 2vh, 16px);
  border-top: 1px solid rgba(0, 229, 255, 0.15);
}
.mono-sublabel {
  font-family: 'Share Tech Mono', monospace;
  font-size: clamp(9px, 1.2vh, 11px);
  letter-spacing: 2px;
  color: #4f8aa0;
  margin-bottom: clamp(3px, 0.8vh, 6px);
}
.mono-value {
  font-family: 'Share Tech Mono', monospace;
  font-size: clamp(12px, 1.8vh, 15px);
  color: #7fe6f8;
  letter-spacing: 1px;
}

/* ===== 未綁定 ===== */
.body-unbound {
  display: flex;
  flex-direction: column;
  gap: clamp(10px, 1.8vh, 14px);
  align-items: center;
  text-align: center;
  padding: clamp(6px, 1.5vh, 10px) 0 4px;
}
.unbound-main {
  font-weight: 900;
  font-size: clamp(18px, 3.2vh, 28px);
  color: #ff3355;
  text-shadow: 0 0 18px rgba(255, 51, 85, 0.65);
  letter-spacing: 2px;
}
.unbound-main.unbound-zh { font-family: 'Noto Sans TC', sans-serif; }
.unbound-main.unbound-en { font-family: Orbitron, sans-serif; letter-spacing: clamp(2px, 0.5vw, 4px); }
.unbound-sub {
  font-family: Orbitron, sans-serif;
  font-weight: 700;
  font-size: clamp(11px, 1.5vh, 14px);
  letter-spacing: clamp(3px, 0.7vw, 5px);
  color: #ff6680;
}
.unbound-desc {
  font-size: clamp(11px, 1.5vh, 14px);
  color: #ff8899;
  line-height: 1.7;
  margin-top: clamp(4px, 1vh, 8px);
}
.unbound-desc.desc-zh { font-family: 'Noto Sans TC', sans-serif; max-width: min(420px, 90%); }
.unbound-desc.desc-en { font-family: Rajdhani, sans-serif; max-width: min(440px, 90%); }

/* ===== 載入中 ===== */
.body-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: clamp(14px, 3vh, 24px) 0;
}
.loading-text {
  font-family: 'Share Tech Mono', monospace;
  font-size: clamp(12px, 1.7vh, 15px);
  letter-spacing: 3px;
  color: #7fe6f8;
}

/* ===== 進入按鈕 ===== */
.enter-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(8px, 1.3vw, 14px);
  padding: clamp(12px, 2.2vh, 20px) clamp(36px, 7vw, 72px);
  font-family: Rajdhani, sans-serif;
  font-weight: 700;
  font-size: clamp(15px, 2.5vh, 24px);
  letter-spacing: clamp(3px, 0.7vw, 6px);
}
.enter-enabled {
  color: #fff;
  background: linear-gradient(90deg, rgba(255, 45, 149, 0.9), rgba(0, 229, 255, 0.8));
  border: none;
  box-shadow: 0 0 30px rgba(255, 45, 149, 0.4), 0 0 50px rgba(0, 229, 255, 0.2);
  cursor: pointer;
}
.enter-disabled {
  color: #6a4050;
  background: rgba(50, 28, 36, 0.4);
  border: 1px solid rgba(120, 60, 80, 0.35);
  cursor: not-allowed;
  opacity: 0.55;
}
.enter-icon { font-size: clamp(14px, 2vh, 20px); }
.enter-icon.faded { opacity: 0.6; }

/* ===== 底部 ===== */
.footer {
  font-family: 'Share Tech Mono', monospace;
  font-size: clamp(9px, 1.3vh, 12px);
  letter-spacing: 2px;
  color: #3f7f93;
  text-align: center;
  line-height: 1.7;
}
.footer-time { opacity: 0.7; }
</style>
