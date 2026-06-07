# 河憩寮 Codex 接手文件｜上傳步驟

這包文件是要放進 GitHub repo 根目錄，讓 Codex 之後能讀到專案規則。

## 方法一：GitHub 網頁直接上傳

1. 打開 repo：`https://github.com/restplaced-dev/heqiliao`
2. 進入 `main` 分支。
3. 點 `Add file`。
4. 選 `Upload files`。
5. 把本包內的文件拖進去。
6. Commit 訊息建議填：`Add Codex handoff documentation`
7. Commit 到 `main`。

這些只是文件，不會影響網站前台顯示。

## 方法二：用 Git 上傳

```bash
git clone https://github.com/restplaced-dev/heqiliao.git
cd heqiliao

# 把本包文件複製到這個資料夾後：
git add AGENTS.md PROJECT_CONTEXT.md DATA_SCHEMA.md CHANGELOG_HEQILIAO.md TODO_FOR_CODEX.md CODEX_START_PROMPT.txt UPLOAD_STEPS.md README_CODEX_HANDOFF.md
git commit -m "Add Codex handoff documentation"
git push origin main
```

## 上傳後怎麼用 Codex

第一次開 Codex 時，貼 `CODEX_START_PROMPT.txt` 的內容。

之後每次任務盡量小步，例如：

```text
請只調整硬體販售區塊的手機版價格排列，不要修改 config.js，也不要改動本週名單與設備介紹。
```

## 注意事項

- 不要讓 Codex 直接「重構整個網站」。
- 不要一次要求修改太多區塊。
- 若 Codex 要動 `config.js`，請先確認它不會洗掉既有 CSV 網址。
- 每次合併前，請用 GitHub Pages 測試網址加版本參數，例如：`https://restplaced-dev.github.io/heqiliao/?v=42`
