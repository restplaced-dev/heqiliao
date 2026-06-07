# 河憩寮｜Codex 接手文件包

這份文件包用途：

- 讓 Codex 之後能理解河憩寮網站架構。
- 避免後續修改把既有功能改壞。
- 記錄 Google Sheets 資料欄位與硬體販售多規格邏輯。
- 提供每次開 Codex 可直接貼上的起手式。

## 建議放置位置

請把本包內所有文件放在 GitHub repo 根目錄：`restplaced-dev/heqiliao/`

也就是與 `index.html`、`config.js`、`app.v2.js`、`styles.v2.css` 同一層。

## 文件說明

| 檔案 | 用途 |
|---|---|
| `AGENTS.md` | 給 Codex 的主要專案規則 |
| `PROJECT_CONTEXT.md` | 河憩寮網站背景與定位 |
| `DATA_SCHEMA.md` | Google Sheets CSV 欄位規格 |
| `CHANGELOG_HEQILIAO.md` | 既有功能與避免回退事項 |
| `TODO_FOR_CODEX.md` | 後續可交給 Codex 的任務 |
| `CODEX_START_PROMPT.txt` | 每次開 Codex 可貼上的起手式 |
| `UPLOAD_STEPS.md` | 如何把文件放進 GitHub repo |

## 最重要原則

不要讓 Codex 自由重做整個網站。先讓它讀文件，再要求它針對單一任務小步修改。
