(function(){
  const CONFIG = window.HEQILIAO_CONFIG || {};
  const PLACEHOLDER = "card-placeholder.svg";
  const el = (id) => document.getElementById(id);
  const state = { products: [], filtered: [], category: "全部", query: "", categoryChosen: false, viewMode: "text" };

  document.addEventListener("DOMContentLoaded", init);

  async function init(){
    setLineLinks();
    bindSearch();
    bindPreviewModal();
    bindViewSwitch();
    resetQuickTableHeader(false, false);
    await loadProducts();
  }

  function setLineLinks(){
    document.querySelectorAll("[data-line-link]").forEach(a => a.href = CONFIG.lineUrl || "#");
    applyOptionalLink("[data-questionnaire-link]", CONFIG.questionnaireUrl, "問卷連結準備中");
    applyOptionalLink("[data-quarantine-link]", CONFIG.quarantineRecordUrl, "檢疫紀錄準備中");
  }

  function applyOptionalLink(selector, url, placeholderText){
    document.querySelectorAll(selector).forEach(a => {
      if(url && String(url).trim()){
        a.href = url;
        a.removeAttribute("aria-disabled");
        a.classList.remove("disabled-link");
        a.target = "_blank";
        a.rel = "noopener";
      }else{
        a.href = "#";
        a.setAttribute("aria-disabled", "true");
        a.classList.add("disabled-link");
        if(placeholderText) a.title = placeholderText;
      }
    });
  }

  function bindViewSwitch(){
    document.querySelectorAll("[data-view-mode]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.viewMode = btn.dataset.viewMode || "text";
        updateViewSwitch();
        applyFilters();
      });
    });
    updateViewSwitch();
  }

  function updateViewSwitch(){
    document.querySelectorAll("[data-view-mode]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.viewMode === state.viewMode);
    });
    const quick = el("quickListSection");
    const photoTitle = el("photoListTitle");
    const grid = el("productGrid");
    const showPhoto = state.viewMode === "photo";
    if(quick) quick.hidden = showPhoto;
    if(photoTitle) photoTitle.hidden = !showPhoto;
    if(grid) grid.hidden = !showPhoto;
  }

  function bindSearch(){
    const input = el("searchInput");
    if(!input) return;
    input.addEventListener("input", () => {
      state.query = input.value.trim().toLowerCase();
      applyFilters();
    });
  }

  async function loadProducts(){
    updateStatus("資料讀取中");
    const urls = [CONFIG.sheetCsvUrl, CONFIG.fallbackCsvUrl].filter(Boolean);
    let lastError = null;
    for(const url of urls){
      try{
        const csv = await fetchTextNoCache(url, 9000);
        const rows = csvToObjects(csv);
        const products = normalizeProducts(rows);
        if(products.length){
          state.products = products;
          state.filtered = products;
          renderCategories();
          applyFilters();
          const source = url === CONFIG.sheetCsvUrl ? "Google 試算表" : "內建備援資料";
          updateStatus(`已讀取：${source}｜${new Date().toLocaleTimeString("zh-TW", {hour:"2-digit", minute:"2-digit"})}`);
          return;
        }
      }catch(error){
        lastError = error;
        console.warn("讀取資料失敗：", url, error);
      }
    }
    state.products = [];
    state.filtered = [];
    renderCategories();
    applyFilters();
    updateStatus("沒有讀到商品資料，請檢查試算表發布連結與欄位名稱");
    if(lastError) console.warn(lastError);
  }

  async function fetchTextNoCache(url, timeoutMs){
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || 9000);
    try{
      const sep = url.includes("?") ? "&" : "?";
      const noCacheUrl = `${url}${sep}_=${Date.now()}`;
      const response = await fetch(noCacheUrl, { cache: "no-store", signal: controller.signal });
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    }finally{
      clearTimeout(timer);
    }
  }

  function parseCsv(text){
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    for(let i = 0; i < text.length; i++){
      const char = text[i];
      const next = text[i+1];
      if(char === '"'){
        if(inQuotes && next === '"'){
          field += '"';
          i++;
        }else{
          inQuotes = !inQuotes;
        }
      }else if(char === ',' && !inQuotes){
        row.push(field);
        field = "";
      }else if((char === '\n' || char === '\r') && !inQuotes){
        if(char === '\r' && next === '\n') i++;
        row.push(field);
        if(row.some(v => String(v).trim() !== "")) rows.push(row);
        row = [];
        field = "";
      }else{
        field += char;
      }
    }
    row.push(field);
    if(row.some(v => String(v).trim() !== "")) rows.push(row);
    return rows;
  }

  function csvToObjects(text){
    const rows = parseCsv(String(text || "").replace(/^\uFEFF/, ""));
    if(rows.length < 2) return [];
    const headers = rows[0].map(h => String(h || "").trim());
    return rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => obj[header] = String(row[index] ?? "").trim());
      return obj;
    }).filter(item => item["品名"] || item.name);
  }

  function normalizeProducts(rows){
    return rows.map((p, index) => {
      const stockRaw = firstValue(p["庫存"], p["數量"], p.stock, p.quantity);
      const hasStock = String(stockRaw ?? "").trim() !== "";
      const stockNumber = parseStockNumber(stockRaw);
      const manualUnavailable = isUnavailable(p["是否售完"] || p.soldOut || p["暫不販售"] || p.unavailable);
      const stockSoldOut = hasStock && stockNumber !== null && stockNumber <= 0;
      const statusUnavailable = isUnavailable(p["狀態"] || p.status);
      const sold = manualUnavailable || stockSoldOut || statusUnavailable;
      const statusText = manualUnavailable ? "暫不販售" : (stockSoldOut ? "售完" : (statusUnavailable ? "暫不販售" : (p["狀態"] || p.status || "可詢問")));
      return {
        id: p.id || `item-${index}`,
        name: p["品名"] || p.name || "未命名品項",
        scientific: p["學名"] || p.scientific || "",
        category: p["分類"] || p.category || "其他",
        price: cleanPrice(p["價格"] || p.price || ""),
        size: p["尺寸"] || p.size || "",
        status: statusText,
        hasStock,
        stock: hasStock ? formatStock(stockRaw, sold) : "",
        tags: splitTags(p["標籤"] || p.tags || ""),
        feeding: p["餵食"] || p.feeding || "",
        image: normalizeImageUrl(p["照片網址"] || p.image || ""),
        note: p["備註"] || p.note || "",
        soldOut: sold
      };
    });
  }

  function firstValue(...values){
    for(const value of values){
      if(value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return "";
  }

  function parseStockNumber(value){
    const raw = String(value ?? "").trim();
    if(!raw) return null;
    const match = raw.match(/^-?\d+(?:\.\d+)?/);
    if(!match) return null;
    return Number(match[0]);
  }

  function formatStock(value, sold){
    const raw = String(value ?? "").trim();
    if(!raw) return sold ? "0" : "詢問";
    const n = parseStockNumber(raw);
    if(n !== null) return String(n);
    return raw;
  }

  function cleanPrice(value){
    return String(value || "").replace(/^\s*NT\$?\s*/i, "").trim();
  }

  function formatPrice(value){
    const v = cleanPrice(value);
    return v ? `NT$ ${v}` : "詢問";
  }

  function isUnavailable(value){
    const v = String(value || "").trim().toLowerCase();
    return [
      "是", "yes", "true", "1",
      "售完", "已售完", "sold out", "soldout",
      "暫不販售", "不可販售", "不販售", "停售", "暫停販售", "保留", "休養"
    ].includes(v);
  }


  function statusClass(status, soldOut){
    const s = String(status || "").trim();
    if(soldOut || /售完|暫不|不可|停售|保留|休養/.test(s)) return "status-unavailable";
    if(/觀察|適應|檢疫|未穩/.test(s)) return "status-watch";
    if(/穩定|可詢問|可私訊|已開口/.test(s)) return "status-ready";
    return "status-neutral";
  }

  function splitTags(value){
    return String(value || "").split(/[，,、|]/).map(s => s.trim()).filter(Boolean);
  }

  function normalizeImageUrl(url){
    const raw = String(url || "").trim();
    if(!raw) return PLACEHOLDER;
    const driveFile = raw.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if(driveFile) return `https://drive.google.com/thumbnail?id=${driveFile[1]}&sz=w1200`;
    const driveOpen = raw.match(/[?&]id=([^&]+)/);
    if(raw.includes("drive.google.com") && driveOpen) return `https://drive.google.com/thumbnail?id=${driveOpen[1]}&sz=w1200`;
    return raw;
  }

  function renderCategories(){
    const container = el("categoryFilters");
    if(!container) return;
    const categories = ["全部", ...Array.from(new Set(state.products.map(p => p.category).filter(Boolean)))];
    container.innerHTML = categories.map(cat => `<button class="filter-btn ${state.categoryChosen && cat === state.category ? "active" : ""}" data-category="${escapeAttr(cat)}">${escapeHtml(cat)}</button>`).join("");
    container.querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => {
      state.category = btn.dataset.category;
      state.categoryChosen = true;
      renderCategories();
      applyFilters();
    }));
  }

  function applyFilters(){
    const query = state.query;
    state.filtered = state.products.filter(p => {
      const catOk = state.category === "全部" || p.category === state.category;
      const haystack = [p.name,p.scientific,p.category,p.status,p.size,p.tags.join(" "),p.feeding,p.note].join(" ").toLowerCase();
      return catOk && (!query || haystack.includes(query));
    });
    renderProducts();
    renderQuickList();
  }

  function renderProducts(){
    const grid = el("productGrid");
    if(!grid) return;
    updateViewSwitch();
    if(state.viewMode !== "photo"){
      grid.innerHTML = "";
      return;
    }
    if(!state.categoryChosen && !state.query){
      grid.innerHTML = `<div class="empty choose-list-prompt">請先選擇上方的「全部」或特定分類，再查看圖文版名單。</div>`;
      return;
    }
    if(!state.filtered.length){
      grid.innerHTML = `<div class="empty">目前沒有符合條件的品項。可清除搜尋，或直接透過 LINE 詢問本週名單。</div>`;
      return;
    }
    grid.innerHTML = state.filtered.map(productCard).join("");
    grid.querySelectorAll("img").forEach(img => img.addEventListener("error", () => { img.src = PLACEHOLDER; }));
    grid.querySelectorAll("[data-copy]").forEach(btn => btn.addEventListener("click", () => copyInquiry(btn.dataset.copy, btn)));
  }

  function productCard(p){
    const inquiry = [
      `您好，我想詢問：${p.name}`,
      p.size ? `尺寸：${p.size}` : "",
      p.price ? `價格：NT$ ${p.price}` : "",
      p.status ? `目前狀態：${p.status}` : "",
      "想確認目前是否可詢問，以及適合的取魚／出貨安排。"
    ].filter(Boolean).join("\n");
    const infoRows = [
      ["尺寸", p.size],
      ["餵食", p.feeding],
      ["備註", p.note]
    ].filter(row => row && row[1]);
    return `<article class="product-card ${p.soldOut ? "soldout" : ""}">
      <div class="product-image">
        <img src="${escapeAttr(p.image)}" alt="${escapeAttr(p.name)}">
        <span class="badge ${statusClass(p.status, p.soldOut)}">${escapeHtml(p.status)}</span>
      </div>
      <div class="product-body">
        <div class="meta"><span>${escapeHtml(p.category)}</span><span>${p.soldOut ? "暫不出貨" : "可私訊確認"}</span></div>
        <div>
          <h3 class="name">${escapeHtml(p.name)}</h3>
          ${p.scientific ? `<p class="sci">${escapeHtml(p.scientific)}</p>` : ""}
        </div>
        ${p.price ? `<div class="price">${escapeHtml(p.price)}</div>` : ""}
        <div class="info-list">${infoRows.map(([k,v]) => `<div><span>${escapeHtml(k)}</span><span>${escapeHtml(v)}</span></div>`).join("")}</div>
        ${p.tags.length ? `<div class="tags">${p.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
        <div class="card-actions">
          <button class="copy-btn" data-copy="${escapeAttr(inquiry)}">複製詢問文字</button>
          ${p.soldOut ? `<button class="btn" disabled>${escapeHtml(p.status || "暫不販售")}</button>` : `<a class="btn" href="${escapeAttr(CONFIG.lineUrl || "#")}">LINE 詢問</a>`}
        </div>
      </div>
    </article>`;
  }


  function bindPreviewModal(){
    document.addEventListener("click", (event) => {
      const close = event.target.closest("[data-preview-close]");
      if(close){
        closePreview();
        return;
      }
      const row = event.target.closest("[data-preview-id]");
      if(row){
        const product = state.products.find(p => String(p.id) === String(row.dataset.previewId));
        if(product) openPreview(product);
      }
    });
    document.addEventListener("keydown", (event) => {
      if(event.key === "Escape") closePreview();
    });
  }

  function openPreview(p){
    const modal = el("productPreviewModal");
    const content = el("previewContent");
    if(!modal || !content) return;

    const infoRows = [
      ["尺寸", p.size],
      ["餵食", p.feeding],
      ["備註", p.note]
    ].filter(row => row && row[1]);

    const inquiry = [
      `您好，我想詢問：${p.name}`,
      p.size ? `尺寸：${p.size}` : "",
      p.price ? `價格：NT$ ${p.price}` : "",
      p.status ? `目前狀態：${p.status}` : "",
      "想確認目前是否可詢問，以及適合的取魚／出貨安排。"
    ].filter(Boolean).join("\n");

    content.innerHTML = `<div class="preview-image">
        <img src="${escapeAttr(p.image)}" alt="${escapeAttr(p.name)}">
        <span class="badge ${statusClass(p.status, p.soldOut)}">${escapeHtml(p.status)}</span>
      </div>
      <div class="preview-body">
        <div class="preview-title-row">
          <h3>${escapeHtml(p.name)}</h3>
          <span class="category-chip">${escapeHtml(p.category)}</span>
        </div>
        ${p.scientific ? `<p class="sci">${escapeHtml(p.scientific)}</p>` : ""}
        ${p.price ? `<div class="price">${escapeHtml(p.price)}</div>` : ""}
        <div class="preview-info">${infoRows.map(([k,v]) => `<div><span>${escapeHtml(k)}</span><span>${escapeHtml(v)}</span></div>`).join("")}</div>
        <div class="card-actions preview-actions">
          <button class="copy-btn" data-copy="${escapeAttr(inquiry)}">複製詢問文字</button>
          ${p.soldOut ? `<button class="btn" disabled>${escapeHtml(p.status || "暫不販售")}</button>` : `<a class="btn" href="${escapeAttr(CONFIG.lineUrl || "#")}">LINE 詢問</a>`}
        </div>
      </div>`;

    const img = content.querySelector("img");
    if(img) img.addEventListener("error", () => { img.src = PLACEHOLDER; });
    content.querySelectorAll("[data-copy]").forEach(btn => btn.addEventListener("click", () => copyInquiry(btn.dataset.copy, btn)));

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closePreview(){
    const modal = el("productPreviewModal");
    if(!modal) return;
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  function resetQuickTableHeader(showStock, showSize){
    const table = el("quickTable") || document.querySelector(".quick-table table");
    if(!table) return;
    const sizeHeader = showSize ? "<th>尺寸</th>" : "";
    const stockHeader = showStock ? "<th>庫存</th>" : "";
    table.innerHTML = `<thead><tr><th>分類</th><th>品名</th>${sizeHeader}<th>價格</th>${stockHeader}<th>狀態</th></tr></thead><tbody id="quickListBody"></tbody>`;
  }

  function renderQuickList(){
    updateViewSwitch();
    const showStock = state.filtered.some(p => p.hasStock);
    const showSize = state.filtered.some(p => p.size);
    resetQuickTableHeader(showStock, showSize);
    const body = el("quickListBody");
    if(!body) return;
    body.innerHTML = state.filtered.map(p => `<tr class="preview-row" data-preview-id="${escapeAttr(p.id)}" title="點擊查看圖文預覽">
      <td>${escapeHtml(p.category)}</td>
      <td><strong>${escapeHtml(p.name)}</strong>${p.scientific ? `<br><small><em>${escapeHtml(p.scientific)}</em></small>` : ""}</td>
      ${showSize ? `<td>${escapeHtml(p.size || "—")}</td>` : ""}
      <td>${escapeHtml(formatPrice(p.price))}</td>
      ${showStock ? `<td>${escapeHtml(p.hasStock ? (p.stock && p.stock !== "詢問" ? `${p.stock} 隻` : p.stock) : "—")}</td>` : ""}
      <td><span class="status-pill ${statusClass(p.status, p.soldOut)}">${escapeHtml(p.status)}</span></td>
    </tr>`).join("");
  }

  async function copyInquiry(text, btn){
    try{
      await navigator.clipboard.writeText(text);
      const original = btn.textContent;
      btn.textContent = "已複製";
      setTimeout(() => btn.textContent = original, 1200);
    }catch(err){
      window.prompt("可複製以下文字後貼到 LINE：", text);
    }
  }

  function updateStatus(text){
    const s = el("stockStatus");
    if(s) s.textContent = text;
  }

  function escapeHtml(value){
    return String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  }

  function escapeAttr(value){
    return escapeHtml(value).replace(/`/g, "&#96;");
  }
})();
