import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue';
import type { Lang } from '@/data/leaderboard-data';

const STORAGE_KEY = 'leaderboard_lang';

/**
 * 中英切換 composable
 * - 初次 mount 自動讀 localStorage
 * - 切換時同步寫回 localStorage,storage event 讓其他分頁跟著變
 * - 也接收 postMessage 型別為 'lang' 的訊息(控制台推送給被 window.open 的分頁)
 */
export function useLanguage() {
  const lang = ref<Lang>('zh');

  const load = () => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === 'zh' || v === 'en') lang.value = v;
    } catch {}
  };

  const setLang = (l: Lang) => {
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
    lang.value = l;
  };

  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && (e.newValue === 'zh' || e.newValue === 'en')) {
      lang.value = e.newValue;
    }
  };

  // postMessage 通道:控制台 window.open 出來的投播畫面/完整名次,
  // storage 事件在某些瀏覽器/file:// 條件下不會跨窗觸發,靠這條備援
  const onMsg = (e: MessageEvent) => {
    const d = e.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'lang' && (d.lang === 'zh' || d.lang === 'en')) {
      lang.value = d.lang;
    }
  };

  onMounted(() => {
    load();
    window.addEventListener('storage', onStorage);
    window.addEventListener('message', onMsg);
  });
  onUnmounted(() => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('message', onMsg);
  });

  const en = computed(() => lang.value === 'en');

  return { lang: lang as Readonly<Ref<Lang>>, en, setLang };
}
