河憩寮 GitHub Pages 平面上傳版

這一版已把 assets/ 與 data/ 資料夾路徑改成「全部檔案放在 GitHub repository 最外層」也能使用。

使用方式：
1. 解壓縮這個 ZIP。
2. 把解壓後看到的所有檔案，一次上傳到 GitHub repository。
3. GitHub repository 最外層要直接看到 index.html、config.js、app.v2.js、styles.v2.css、hero-illustration-v18.jpg、logo-official-transparent.png、products.csv 等檔案。
4. Settings → Pages → Deploy from a branch → main → / root。
5. 等 github-pages 部署完成後打開網址。

注意：
- 不要只上傳 ZIP 本身。
- 這版不需要 assets/ 或 data/ 資料夾。
- Google 試算表資料仍由 config.js 讀取；若無法讀取，才會用 products.csv 當備援。
