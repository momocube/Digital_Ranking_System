# 賽博龐克排行榜投播系統 — 原始碼

## 檔案
| 檔案 | 說明 |
|---|---|
| `leaderboard-data.js` | 共用資料模組(模擬遊戲包資料庫)。階層:**店家 STORE → 場域 FIELD**(480 / 225 / 64 格)。雙語資料。 |
| `投播控制台.dc.html` | 控制台:選店家/場域、投播方向(直式/橫式)、中英切換、自動擷取狀態、即時預覽、投播按鈕。 |
| `投播畫面.dc.html` | 投播顯示頁:資料驅動、雙語、雙方向、全螢幕。供大螢幕/第二螢幕顯示。 |
| `賽博龐克排行榜.dc.html` | 最初版的靜態排行榜底圖(直式)。 |
| `support.js` | Design Component 執行階段(系統產生)。執行 `.dc.html` 需要它。 |

## 如何執行
1. 把以上檔案放在**同一個資料夾**。
2. 用瀏覽器開啟 `投播控制台.dc.html`(建議透過簡易本機伺服器,例如 `python -m http.server`,跨視窗同步最穩;直接 file:// 開啟亦可,改用內建的 postMessage 通道)。
3. 在控制台選店家與場域 → 按「投播畫面 CAST」會另開視窗;拖到第二螢幕後點右上「全螢幕」。

## 串接真實資料(遊戲包資料庫)
所有資料集中在 `leaderboard-data.js` 的兩個函式:
- `window.LB.current(storeId, fieldId)` — 取目前排行榜(不變動)
- `window.LB.capture(storeId, fieldId)` — 模擬「定期擷取」一次最新資料

只要把這兩個函式內部改成「讀檔 / fetch(API) / 解析 DB」,**輸出格式維持不變**,其餘控制台與投播畫面都不必改。輸出格式:

```js
{
  region: { zh: '台北旗艦店', en: 'TAIPEI FLAGSHIP' },   // 店家 STORE
  venue:  { zh: '480 格',     en: '480-CELL' },          // 場域 FIELD
  rows: [ { teamZh, teamEn, stage, time, score }, ... ],  // 最多 10 筆,已排序
  updated: 1719640000000                                  // 毫秒時間戳
}
```

控制台每 8 秒呼叫一次 `capture()`,透過 localStorage + postMessage 把資料推送到投播畫面;投播畫面監聽後即時更新,不需重開。

## 語言切換
共用 `localStorage['leaderboard_lang']`('zh' / 'en')+ postMessage 同步,控制台與投播畫面一起切換。
