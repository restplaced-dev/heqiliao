(function(){
  const CONFIG = window.HEQILIAO_CONFIG || {};
  const PLACEHOLDER = "card-placeholder.svg";
  const el = (id) => document.getElementById(id);
  const state = { products: [], filtered: [], scapes: [], category: "全部", query: "", categoryChosen: false, viewMode: "text" };

  document.addEventListener("DOMContentLoaded", init);

  async function init(){
    setLineLinks();
    updateListUpdatedText();
    bindSearch();
    bindPreviewModal();
    bindViewSwitch();
    resetQuickTableHeader(false, false);
    await loadProducts();
    await loadScapeGallery();
  }
  function updateListUpdatedText(){
  const note = el("listUpdatedNote");
  if(!note) return;

  const text = CONFIG.listUpdatedText || "";
  note.textContent = text ? `名單更新：${text}` : "";
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
    let lastError = null;
    const url = CONFIG.sheetCsvUrl;
    if(url){
      try{
        const csv = await fetchTextNoCache(url, 9000);
        const rows = csvToObjects(csv);
        const products = normalizeProducts(rows);
        if(products.length){
          state.products = products;
          state.filtered = products;
          renderCategories();
          applyFilters();
          updateStatus(`已讀取：Google 試算表｜${new Date().toLocaleTimeString("zh-TW", {hour:"2-digit", minute:"2-digit"})}`);
          return;
        }
      }catch(error){
        lastError = error;
        console.warn("Google 試算表讀取失敗：", url, error);
      }
    }
    state.products = [];
    state.filtered = [];
    renderCategories();
    applyFilters();
    updateStatus("Google 試算表讀取失敗，請稍後重新整理，或直接透過 LINE 詢問本週名單");
    if(lastError) console.warn(lastError);
  }

  async function loadScapeGallery(){
    const list = el("scapeGalleryList");
    if(!list) return;

    updateScapeStatus("造景資料讀取中");

    const url = CONFIG.scapeCsvUrl;
    if(!url || !String(url).trim()){
      state.scapes = [];
      list.innerHTML = `<div class="empty scape-empty">造景介紹資料尚未設定。請先在 Google Sheets 建立「造景介紹」分頁，發布 CSV 後填入 config.js 的 scapeCsvUrl。</div>`;
      updateScapeStatus("尚未設定造景資料表");
      return;
    }

    try{
      const csv = await fetchTextNoCache(url, 9000);
      const rows = csvToObjects(csv);
      const scapes = normalizeScapes(rows);

      state.scapes = scapes;

      if(!scapes.length){
        list.innerHTML = `<div class="empty scape-empty">目前沒有可顯示的造景介紹。可確認「狀態」是否為顯示，或是否已有資料列。</div>`;
        updateScapeStatus("目前沒有可顯示的造景資料");
        return;
      }

      renderScapeGallery(scapes);
      updateScapeStatus(`已讀取：造景介紹｜${new Date().toLocaleTimeString("zh-TW", {hour:"2-digit", minute:"2-digit"})}`);
    }catch(error){
      console.warn("造景介紹讀取失敗：", url, error);
      state.scapes = [];
      list.innerHTML = `<div class="empty scape-empty">造景介紹讀取失敗。請確認 Google Sheets 是否已發布為 CSV，或稍後重新整理。</div>`;
      updateScapeStatus("造景介紹讀取失敗");
    }
  }

  function normalizeScapes(rows){
    return rows.map((p, index) => {
      const title = firstValue(
        p["類型名稱"],
        p["造景名稱"],
        p["名稱"],
        p["品名"],
        p.title,
        p.name
      );

      const orderRaw = firstValue(p["排序"], p.order, p["順序"]);
      const orderNumber = Number(orderRaw);
      const status = firstValue(p["狀態"], p.status);

      return {
        id: firstValue(p.id, p["ID"]) || `scape-${index}`,
        order: Number.isFinite(orderNumber) ? orderNumber : index + 1,
        status,
        title: title || "未命名造景",
        date: firstValue(p["日期"], p.date),
        fish: firstValue(p["適合魚種"], p["適合對象"], p["適合"], p.fish),
        description: firstValue(p["介紹文字"], p["介紹"], p["說明"], p.description),
        image: normalizeScapeImageUrl(firstValue(p["圖片網址"], p["照片網址"], p["圖片"], p.image)),
        size: firstValue(p["尺寸"], p["缸型"], p.size),
        note: firstValue(p["備註"], p.note)
      };
    })
    .filter(item => item.title && item.title !== "未命名造景")
    .filter(item => !isHidden(item.status))
    .sort((a, b) => a.order - b.order);
  }

  function isHidden(value){
    const v = String(value || "").trim().toLowerCase();
    return ["隱藏", "不顯示", "下架", "停售", "hide", "hidden", "false", "0", "no"].includes(v);
  }

  function renderScapeGallery(scapes){
    const list = el("scapeGalleryList");
    if(!list) return;

    list.innerHTML = scapes.map((scape, index) => {
      const meta = [scape.date, scape.size].filter(Boolean).join("｜");
      const imgHtml = scape.image
        ? `<div class="scape-photo-wrap"><img class="scape-photo" src="${escapeAttr(scape.image)}" alt="${escapeAttr(scape.title)}" loading="lazy"></div>`
        : "";

      const fishHtml = scape.fish
        ? `<div class="scape-row"><span>適合方向</span><p>${escapeHtml(scape.fish)}</p></div>`
        : "";

      const sizeHtml = scape.size
        ? `<div class="scape-row"><span>參考尺寸</span><p>${escapeHtml(scape.size)}</p></div>`
        : "";

      const noteHtml = scape.note
        ? `<div class="scape-row"><span>備註</span><p>${escapeHtml(scape.note)}</p></div>`
        : "";

      return `<details class="scape-item" ${index === 0 ? "" : ""}>
        <summary>
          <span>
            <b>${escapeHtml(scape.title)}</b>
            ${meta ? `<small>${escapeHtml(meta)}</small>` : `<small>點開查看作品介紹</small>`}
          </span>
        </summary>
        <div class="scape-content">
          ${imgHtml}
          ${scape.description ? `<p>${escapeHtml(scape.description)}</p>` : ""}
          <div class="scape-meta-list">
            ${fishHtml}
            ${sizeHtml}
            ${noteHtml}
          </div>
        </div>
      </details>`;
    }).join("");

    list.querySelectorAll("img").forEach(img => img.addEventListener("error", () => {
      const wrap = img.closest(".scape-photo-wrap");
      if(wrap) wrap.hidden = true;
    }));
  }

  function updateScapeStatus(text){
    const s = el("scapeGalleryStatus");
    if(s) s.textContent = text;
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
    }).filter(item => Object.values(item).some(value => String(value || "").trim() !== ""));
  }

 function normalizeProducts(rows){
  return rows.map((p, index) => {
    const stockRaw = firstValue(
      p["目前庫存"],
      p["庫存"],
      p["數量"],
      p.stock,
      p.quantity
    );

    const hasStock = String(stockRaw ?? "").trim() !== "";
    const stockNumber = parseStockNumber(stockRaw);

    const manualUnavailable = isUnavailable(
      firstValue(
        p["是否售完"],
        p["暫不販售"],
        p.soldOut,
        p.unavailable
      )
    );

    const statusRaw = firstValue(
      p["狀態"],
      p["販售狀態"],
      p.status
    );

    const stockSoldOut = hasStock && stockNumber !== null && stockNumber <= 0;
    const statusUnavailable = isUnavailable(statusRaw);
    const sold = manualUnavailable || stockSoldOut || statusUnavailable;

    const statusText = manualUnavailable
      ? "暫不販售"
      : stockSoldOut
        ? "售完"
        : statusUnavailable
          ? "暫不販售"
          : statusRaw || "可詢問";

    return {
      id: firstValue(p.id, p["ID"]) || `item-${index}`,
      name: firstValue(p["品名"], p["魚種"], p["名稱"], p.name) || "未命名品項",
      scientific: firstValue(p["學名"], p.scientific),
      category: firstValue(p["分類"], p["類別"], p.category) || "其他",
      price: cleanPrice(firstValue(p["售價"], p["價格"], p.price)),
      size: firstValue(p["尺寸"], p.size),
      status: statusText,
      hasStock,
      stock: hasStock ? formatStock(stockRaw, sold) : "",
      tags: splitTags(firstValue(p["標籤"], p.tags)),
      feeding: firstValue(p["餵食"], p.feeding),
      image: normalizeImageUrl(firstValue(p["圖片網址"], p["照片網址"], p["圖片"], p.image)),
      note: firstValue(p["簡介"], p["備註"], p.note, p.intro),
      soldOut: sold
    };
  }).filter(p => p.name && p.name !== "未命名品項");
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


  function normalizeScapeImageUrl(url){
    const raw = String(url || "").trim();
    if(!raw) return "";
    return normalizeImageUrl(raw);
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
      grid.innerHTML = `<div class="empty choose-list-prompt">請先選擇上方分類。想快速瀏覽可選「全部」；想找特定魚種或造景，可直接選分類。</div>`;
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


  function isScapeProduct(p){
    const text = [
      p.category,
      p.name,
      p.tags ? p.tags.join(" ") : ""
    ].join(" ");
    return /造景|沉木|石材|硬景|水草|缸/.test(text);
  }

  function previewLabels(p){
    if(isScapeProduct(p)){
      return {
        size: "適用缸型",
        feeding: "內容",
        note: "造景說明"
      };
    }
    return {
      size: "尺寸",
      feeding: "餵食",
      note: "備註"
    };
  }

  function buildInquiryText(p){
    if(isScapeProduct(p)){
      const title = String(p.name || "").includes("造景") ? p.name : `${p.category} ${p.name}`.trim();
      return [
        `您好，我想詢問：${title}`,
        p.size ? `適用缸型：${p.size}` : "",
        p.price ? `價格：NT$ ${p.price}` : "",
        p.status ? `目前狀態：${p.status}` : "",
        "想確認這組造景目前是否仍可詢問，以及實際庫存、款式與出貨安排。"
      ].filter(Boolean).join("\n");
    }

    return [
      `您好，我想詢問：${p.name}`,
      p.size ? `尺寸：${p.size}` : "",
      p.price ? `價格：NT$ ${p.price}` : "",
      p.status ? `目前狀態：${p.status}` : "",
      "想確認目前是否可詢問，以及適合的取魚／出貨安排。"
    ].filter(Boolean).join("\n");
  }

  function productCard(p){
    const inquiry = buildInquiryText(p);
    const labels = previewLabels(p);
    const infoRows = [
      [labels.size, p.size],
      [labels.feeding, p.feeding],
      [labels.note, p.note]
    ].filter(row => row && row[1]);
    return `<article class="product-card ${p.soldOut ? "soldout" : ""}">
      <div class="product-image">
        <button class="image-zoom-trigger" type="button" data-image-zoom="${escapeAttr(p.image)}" data-image-alt="${escapeAttr(p.name)}" aria-label="放大 ${escapeAttr(p.name)} 圖片">
          <img src="${escapeAttr(p.image)}" alt="${escapeAttr(p.name)}">
          <span class="image-zoom-hint">點圖看大圖</span>
        </button>
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
      const imageClose = event.target.closest("[data-image-close]");
      if(imageClose){
        closeImageZoom();
        return;
      }

      const zoom = event.target.closest("[data-image-zoom]");
      if(zoom){
        event.preventDefault();
        event.stopPropagation();
        openImageZoom(zoom.dataset.imageZoom, zoom.dataset.imageAlt || "");
        return;
      }

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
      if(event.key === "Escape"){
        closeImageZoom();
        closePreview();
      }
    });
  }

  function openPreview(p){
    const modal = el("productPreviewModal");
    const content = el("previewContent");
    if(!modal || !content) return;

    const labels = previewLabels(p);
    const infoRows = [
      [labels.size, p.size],
      [labels.feeding, p.feeding],
      [labels.note, p.note]
    ].filter(row => row && row[1]);

    const inquiry = buildInquiryText(p);

    content.innerHTML = `<div class="preview-image">
        <button class="image-zoom-trigger" type="button" data-image-zoom="${escapeAttr(p.image)}" data-image-alt="${escapeAttr(p.name)}" aria-label="放大 ${escapeAttr(p.name)} 圖片">
          <img src="${escapeAttr(p.image)}" alt="${escapeAttr(p.name)}">
          <span class="image-zoom-hint">點圖看大圖</span>
        </button>
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

  function openImageZoom(src, alt){
    const modal = el("imageZoomModal");
    const img = el("imageZoomImg");
    const caption = el("imageZoomCaption");
    if(!modal || !img) return;

    img.src = src || PLACEHOLDER;
    img.alt = alt || "品項圖片";
    img.onerror = () => { img.src = PLACEHOLDER; };
    if(caption) caption.textContent = alt || "";

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeImageZoom(){
    const modal = el("imageZoomModal");
    const img = el("imageZoomImg");
    if(!modal) return;
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    if(img) img.src = "";
    const previewOpen = el("productPreviewModal")?.classList.contains("show");
    if(!previewOpen) document.body.classList.remove("modal-open");
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
    const showStock = state.products.some(p => p.hasStock);
    const showSize = state.products.some(p => p.size);
    resetQuickTableHeader(showStock, showSize);
    const body = el("quickListBody");
    if(!body) return;
    const colSpan = 4 + (showSize ? 1 : 0) + (showStock ? 1 : 0);

    if(!state.categoryChosen && !state.query){
      body.innerHTML = `<tr class="quick-prompt-row"><td colspan="${colSpan}">請先選擇上方分類。想快速瀏覽可選「全部」；想找特定魚種或造景，可直接選分類。</td></tr>`;
      return;
    }

    if(!state.filtered.length){
      body.innerHTML = `<tr class="quick-prompt-row"><td colspan="${colSpan}">目前沒有符合條件的品項。可清除搜尋，或直接透過 LINE 詢問本週名單。</td></tr>`;
      return;
    }

    body.innerHTML = state.filtered.map(p => `<tr class="preview-row" data-preview-id="${escapeAttr(p.id)}" title="點擊查看圖文預覽">
      <td>${escapeHtml(p.category)}</td>
      <td><strong>${escapeHtml(p.name)}</strong>${p.scientific ? `<br><small><em>${escapeHtml(p.scientific)}</em></small>` : ""}</td>
      ${showSize ? `<td>${escapeHtml(p.size || "—")}</td>` : ""}
      <td>${escapeHtml(formatPrice(p.price))}</td>
      ${showStock ? `<td>${escapeHtml(p.hasStock ? p.stock : "—")}</td>` : ""}
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
