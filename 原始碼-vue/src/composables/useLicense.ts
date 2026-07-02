import { ref, computed, onMounted } from 'vue';

const STORAGE_KEY = 'leaderboard_license';
const FILE_URL = './license.json';

export interface License {
  key: string;
  storeId: string;
  storeName?: string;
  storeNameZh: string;
  storeNameEn: string;
  venues: string[];
  country?: string;
  registeredAt?: string;
}

/**
 * 金鑰載入 composable
 * - 優先從 localStorage 讀(同步,首次渲染就不會閃)
 * - 再非同步 fetch license.json(檔案存在則覆蓋 + 寫回 localStorage)
 * - 給 bound / unbound / loading 三態衍生值
 */
export function useLicense() {
  const license = ref<License | null>(null);
  const loading = ref(true);

  const loadFromStorage = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) license.value = JSON.parse(raw) as License;
    } catch {}
  };

  const loadFromFile = async () => {
    try {
      const res = await fetch(FILE_URL, { cache: 'no-store' });
      if (res.ok) {
        const lic = (await res.json()) as License;
        if (lic && (lic.storeId || lic.storeNameZh)) {
          license.value = lic;
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lic)); } catch {}
        }
      }
    } catch {
      // 檔案不存在(如 file:// 或 CORS)—忽略,以 localStorage 為準
    } finally {
      loading.value = false;
    }
  };

  onMounted(() => {
    loadFromStorage();
    if (license.value) loading.value = false;
    loadFromFile();
  });

  const bound = computed(() => !loading.value && !!license.value);
  const unbound = computed(() => !loading.value && !license.value);

  return { license, loading, bound, unbound };
}
