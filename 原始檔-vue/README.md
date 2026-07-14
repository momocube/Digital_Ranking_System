# NEON CLASH 賽博龐克排行榜投播系統 · Vue 3 版

從 DC 框架逐步重寫成 Vue 3 + Vite + TypeScript 的版本。舊版在同層的 `原始碼/` 資料夾裡。

## 三個雙擊即跑的 .bat

第一次使用先跑一次：
- **`INSTALL.bat`** — 下載所有 npm 依賴（要幾分鐘，只需要一次）

之後日常：
- **`START.bat`** — 開發模式，瀏覽器打開 `http://localhost:5173/`，改檔即時重整
- **`BUILD.bat`** — 打包成 `dist/`，複製到營運電腦就能用（不需要 Node.js）

## 四個頁面（MPA 架構）

| 開發時網址 | 打包後檔案 | 對應舊檔 |
|---|---|---|
| `http://localhost:5173/index.html` | `dist/index.html` | 主頁.dc.html |
| `http://localhost:5173/console.html` | `dist/console.html` | 投播控制台.dc.html |
| `http://localhost:5173/broadcast.html` | `dist/broadcast.html` | 投播畫面.dc.html |
| `http://localhost:5173/full-ranking.html` | `dist/full-ranking.html` | 完整名次.dc.html |

## 目前進度

- ✅ **HomePage.vue** — 全功能，可以測試
- ⏸️ **CastingConsole.vue** — placeholder
- ⏸️ **BroadcastView.vue** — placeholder
- ⏸️ **FullRanking.vue** — placeholder

## 資料夾結構

```
原始碼-vue/
├── index.html               ← 主頁進入
├── console.html             ← 投播控制台進入
├── broadcast.html           ← 投播畫面進入
├── full-ranking.html        ← 完整名次進入
├── package.json             ← npm 設定
├── vite.config.ts           ← Vite 設定(定義 4 個進入點)
├── tsconfig.json            ← TypeScript 設定
├── .gitignore               ← 已排除 node_modules 和 license.json
├── INSTALL.bat / START.bat / BUILD.bat
├── public/
│   └── license.json         ← 開發用測試金鑰(不會進 git)
└── src/
    ├── entries/             ← 每個 HTML 的 mount 起點
    │   ├── home.ts
    │   ├── console.ts
    │   ├── broadcast.ts
    │   └── full-ranking.ts
    ├── views/               ← 4 個主要頁面元件
    │   ├── HomePage.vue     ← ✅ 已完成
    │   ├── CastingConsole.vue
    │   ├── BroadcastView.vue
    │   └── FullRanking.vue
    ├── composables/         ← 跨頁共用邏輯
    │   ├── useLanguage.ts   ← 中英切換 + 跨分頁同步
    │   └── useLicense.ts    ← 金鑰載入 + 三態
    ├── data/
    │   └── leaderboard-data.ts  ← 假資料 + LB API(TS 版)
    └── styles/
        └── global.css       ← 全站基本樣式 + 動畫關鍵幀
```

## 開發流程

1. 雙擊 `START.bat`
2. 改任何 `.vue` / `.ts` 檔存檔 → 瀏覽器自動更新
3. Console 有錯就看 DevTools（F12）
4. 要停止：命令視窗按 `Ctrl+C` 兩次

## 部署到營運電腦

1. 雙擊 `BUILD.bat`
2. 把 `dist/` 資料夾整包複製到營運電腦任何位置
3. 營運雙擊 `dist/index.html` 就能開始用
4. 記得放一份對應的 `license.json` 到 `dist/` 資料夾裡（複製 `public/license.json` 過去改內容即可）

## 舊版對照

舊版 8 個 `.dc.html` 在隔壁 `原始碼/` 資料夾，功能完全一樣，只是換成 Vue 語法。移植完會一個一個砍掉。

---

視覺規範、雙語規則、20 字截斷、跨分頁同步等 UX 慣例，跟舊版完全一致。詳見各元件的註解。
