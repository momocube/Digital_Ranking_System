<script setup lang="ts">
/**
 * 主頁 HomePage.vue — 系統入口(已移除金鑰認證)
 *  - 不再依 license 擋人,兩顆按鈕永遠可用
 *  - 左鈕「進入控制台」:點擊 → 密碼視窗(模擬:任意密碼)→ full-ranking.html
 *  - 右鈕「進入投播畫面」:點擊直接前往 broadcast.html
 *  - 10 秒內未點任一主要按鈕 → 自動跳轉投播畫面;右鈕顯示倒數秒數
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useLanguage } from '@/composables/useLanguage';

const { en, setLang } = useLanguage();

// ---- 時鐘 ----
const time = ref('');
const p2 = (n: number) => String(n).padStart(2, '0');
const tick = () => {
  const d = new Date();
  time.value = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
};
let clockTimer: number | undefined;

// ---- 前往投播畫面 ----
const goCast = () => { window.location.href = './broadcast.html#src=cast'; };

// ---- 10 秒自動投播倒數 ----
const AUTO_SECONDS = 10;
const countdown = ref(AUTO_SECONDS);
const autoActive = ref(true);
let cdTimer: number | undefined;
const cancelCountdown = () => {
  autoActive.value = false;
  if (cdTimer) { clearInterval(cdTimer); cdTimer = undefined; }
};
const startCountdown = () => {
  autoActive.value = true;
  countdown.value = AUTO_SECONDS;
  if (cdTimer) clearInterval(cdTimer);
  cdTimer = window.setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) { cancelCountdown(); goCast(); }
  }, 1000);
};

// ---- 密碼關卡(模擬:任意密碼皆可) ----
const askPwd = ref(false);
const pwd = ref('');
const pwdErr = ref(false);
const enter = () => { cancelCountdown(); askPwd.value = true; pwd.value = ''; pwdErr.value = false; };
const enterCast = () => { cancelCountdown(); goCast(); };
const onPwd = (e: Event) => { pwd.value = (e.target as HTMLInputElement).value; pwdErr.value = false; };
const submitPwd = () => {
  if (pwd.value.length > 0) window.location.href = './full-ranking.html';
  else pwdErr.value = true;
};
const onPwdKey = (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); submitPwd(); } };
const closePwd = () => { askPwd.value = false; pwd.value = ''; pwdErr.value = false; };

onMounted(() => {
  tick();
  clockTimer = window.setInterval(tick, 1000);
  startCountdown();
});
onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer);
  cancelCountdown();
});

// ---- 文字 ----
const titleMain = computed(() => en.value ? 'LIVE RANKING' : '即時排行系統');
const titleSub  = computed(() => en.value ? 'LEADERBOARD SYSTEM' : 'LIVE RANKING');
const btnText   = computed(() => en.value ? 'ENTER CONSOLE' : '進入控制台');
const castText  = computed(() => en.value ? 'CAST SCREEN' : '進入投播畫面');
const btnIcon = '▶';
const castIcon = '▣';

const tLockTitle = computed(() => en.value ? 'ENTER PASSWORD' : '請輸入密碼');
const tLockSub = computed(() => en.value ? 'Password required to enter the console.' : '進入控制台需要輸入密碼');
const tPwdPh = computed(() => en.value ? 'PASSWORD' : '密碼');
const tPwdErr = computed(() => en.value ? 'Enter any password to continue.' : '請輸入任意密碼以繼續');
const tUnlock = computed(() => en.value ? '▶ ENTER' : '▶ 進入');
const tCancel = computed(() => en.value ? 'CANCEL' : '取消');
const tPwdHint = computed(() => en.value ? '// Demo: any input works' : '// 模擬用:輸入任意密碼皆可');
</script>

<template>
  <div class="home-root">
    <!-- 密碼視窗 -->
    <div v-if="askPwd" class="pwd-overlay">
      <div class="pwd-card">
        <div class="pwd-kicker">◢ ACCESS REQUIRED ◣</div>
        <div class="pwd-lock">⚿</div>
        <div class="pwd-title">{{ tLockTitle }}</div>
        <div class="pwd-sub">{{ tLockSub }}</div>
        <input type="password" :value="pwd" @input="onPwd" @keydown="onPwdKey" :placeholder="tPwdPh" class="pwd-input" />
        <div v-if="pwdErr" class="pwd-err">{{ tPwdErr }}</div>
        <div class="pwd-actions">
          <button @click="closePwd" class="pwd-cancel">{{ tCancel }}</button>
          <button @click="submitPwd" class="pwd-submit">{{ tUnlock }}</button>
        </div>
        <div class="pwd-hint">{{ tPwdHint }}</div>
      </div>
    </div>

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
      <div class="title-block">
        <div class="kicker">◢ NEON CLASH · LEADERBOARD ◣</div>
        <div :class="['title-main', en ? 'title-en' : 'title-zh']">{{ titleMain }}</div>
        <div :class="['title-sub',  en ? 'title-en' : 'title-zh']">{{ titleSub }}</div>
      </div>

      <!-- 進入按鈕 -->
      <div class="enter-row">
        <button @click="enter" class="enter-btn enter-enabled">
          <span class="enter-icon">{{ btnIcon }}</span>
          <span>{{ btnText }}</span>
        </button>
        <button @click="enterCast" class="enter-btn cast-btn cast-enabled">
          <span class="enter-icon">{{ castIcon }}</span>
          <span>{{ castText }}</span>
          <span v-if="autoActive" class="cd-badge">{{ en ? 'AUTO ' : '自動 ' }}{{ countdown }}s</span>
        </button>
      </div>

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
.enter-row { display: flex; flex-wrap: wrap; gap: clamp(12px, 2vw, 20px); align-items: center; justify-content: center; }
.cast-enabled {
  color: #7fe6f8;
  background: rgba(0, 229, 255, 0.06);
  border: 1px solid rgba(0, 229, 255, 0.55);
  box-shadow: 0 0 24px rgba(0, 229, 255, 0.22), inset 0 0 18px rgba(0, 229, 255, 0.05);
  cursor: pointer;
}

/* ===== 密碼視窗 ===== */
.pwd-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(2, 4, 10, 0.82); display: flex; align-items: center; justify-content: center; }
.pwd-card {
  position: relative; width: min(420px, 90vw);
  border: 1px solid rgba(0, 229, 255, 0.35);
  background: linear-gradient(160deg, rgba(10, 16, 24, 0.98), rgba(5, 10, 18, 0.98));
  box-shadow: 0 0 40px rgba(0, 229, 255, 0.18), inset 0 0 30px rgba(0, 229, 255, 0.03);
  padding: clamp(26px, 4.5vh, 40px) clamp(22px, 4vw, 36px);
  display: flex; flex-direction: column; gap: clamp(13px, 2.2vh, 18px); align-items: center; text-align: center;
}
.pwd-kicker { font-family: Rajdhani, sans-serif; font-weight: 700; font-size: clamp(11px, 1.5vh, 14px); letter-spacing: clamp(4px, 0.9vw, 7px); color: #34c8e8; }
.pwd-lock { font-family: 'Share Tech Mono', monospace; font-size: clamp(40px, 6vh, 56px); line-height: 1; color: #34c8e8; text-shadow: 0 0 22px rgba(0, 229, 255, 0.6); }
.pwd-title { font-family: 'Noto Sans TC', sans-serif; font-weight: 900; font-size: clamp(19px, 3.2vh, 28px); color: #eafdff; text-shadow: 0 0 18px rgba(0, 229, 255, 0.5); }
.pwd-sub { font-family: 'Share Tech Mono', monospace; font-size: clamp(11px, 1.5vh, 13px); letter-spacing: 1px; color: #5fb6cf; line-height: 1.6; }
.pwd-input { width: 100%; margin-top: 4px; padding: clamp(12px, 1.8vh, 16px) 18px; font-family: 'Share Tech Mono', monospace; font-size: clamp(15px, 2vh, 18px); letter-spacing: 3px; color: #eafdff; background: #0a1018; border: 1px solid rgba(0, 229, 255, 0.4); outline: none; text-align: center; }
.pwd-input:focus { border-color: #34c8e8; }
.pwd-err { font-family: 'Share Tech Mono', monospace; font-size: clamp(10px, 1.4vh, 12px); letter-spacing: 1px; color: #ff6680; }
.pwd-actions { display: flex; gap: 10px; width: 100%; margin-top: 2px; }
.pwd-cancel { flex: 0 0 34%; padding: clamp(11px, 1.8vh, 16px) 0; font-family: Rajdhani, sans-serif; font-weight: 700; font-size: clamp(13px, 1.8vh, 16px); letter-spacing: 2px; color: #7fb6c8; background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(0, 229, 255, 0.3); cursor: pointer; }
.pwd-submit { flex: 1; padding: clamp(11px, 1.8vh, 16px) 0; font-family: Rajdhani, sans-serif; font-weight: 700; font-size: clamp(14px, 2vh, 18px); letter-spacing: clamp(2px, 0.6vw, 5px); color: #fff; background: linear-gradient(90deg, rgba(255, 45, 149, 0.9), rgba(0, 229, 255, 0.8)); border: none; box-shadow: 0 0 26px rgba(255, 45, 149, 0.4); cursor: pointer; }
.pwd-hint { font-family: 'Share Tech Mono', monospace; font-size: clamp(9px, 1.2vh, 11px); letter-spacing: 1px; color: #3f7f93; }

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

/* ===== 自動投播倒數徽章 ===== */
.cd-badge {
  margin-left: clamp(6px, 1vw, 10px);
  font-family: 'Share Tech Mono', monospace;
  font-weight: 700;
  font-size: clamp(12px, 1.7vh, 15px);
  letter-spacing: 1px;
  color: #05070f;
  background: #7ff0ff;
  padding: 3px 10px;
  border-radius: 2px;
  box-shadow: 0 0 12px rgba(0, 229, 255, 0.55);
}
</style>
