(function(){
  const CONFIG = window.HEQILIAO_CONFIG || {};
  const PLACEHOLDER = "card-placeholder.svg";
  const el = (id) => document.getElementById(id);
  const state = {
    products: [],
    filtered: [],
    scapes: [],
    equipments: [],
    equipmentCategory: "全部",
    category: "全部",
    query: "",
    categoryChosen: false,
    viewMode: "text"
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init(){
    injectQuantityStyles();
    setLineLinks();
    updateListUpdatedText();
    bindSearch();
    bindPreviewModal();
    bindProductActions();
    bindViewSwitch();
    resetQuickTableHeader(false, false);
    await loadProducts();
    await loadScapeGallery();
    await loadEquipmentGuide();
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
      list.innerHTML = `<div class="empty scape-empty">造景介紹整理中。</div>`;
      updateScapeStatus("尚未設定造景資料表");
      return;
    }
    try{
      const csv = await fetchTextNoCache(url, 9000);
      const rows = csvToObjects(csv);
      const scapes = normalizeScapes(rows);
      state.scapes = scapes;
      if(!scapes.length){
        list.innerHTML = `<div class="empty scape-empty">目前尚無造景介紹。</div>`;
        updateScapeStatus("目前沒有可顯示的造景資料");
        return;
      }
      renderScapeGallery(scapes);
      updateScapeStatus("造景介紹已更新");
    }catch(error){
      console.warn("造景介紹讀取失敗：", url, error);
      state.scapes = [];
      list.innerHTML = `<div class="empty scape-empty">造景介紹暫時無法讀取。</div>`;
      updateScapeStatus("造景介紹讀取失敗");
    }
  }

  function normalizeScapes(rows){
    return rows.map((p, index) => {
      const title = firstValue(p["類型名稱"], p["造景名稱"], p["名稱"], p["品名"], p.title, p.name);
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
        image: normalizeContentImageUrl(firstValue(p["圖片網址"], p["照片網址"], p["圖片"], p.image)),
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
    list.innerHTML = scapes.map((scape) => {
      const meta = [scape.date, scape.size].filter(Boolean).join("｜");
      const imgHtml = scape.image
        ? `<div class="scape-photo-wrap"><img class="scape-photo" src="${escapeAttr(scape.image)}" alt="${escapeAttr(scape.title)}" loading="lazy"></div>`
        : "";
      const fishHtml = scape.fish ? `<div class="scape-row"><span>適合方向</span><p>${escapeHtml(scape.fish)}</p></div>` : "";
      const sizeHtml = scape.size ? `<div class="scape-row"><span>參考尺寸</span><p>${escapeHtml(scape.size)}</p></div>` : "";
      const noteHtml = scape.note ? `<div class="scape-row"><span>備註</span><p>${escapeHtml(scape.note)}</p></div>` : "";
      return `<details class="scape-item">
        <summary>
          <span>
            <b>${escapeHtml(scape.title)}</b>
            ${meta ? `<small>${escapeHtml(meta)}</small>` : `<small>造景介紹</small>`}
          </span>
        </summary>
        <div class="scape-content">
          ${imgHtml}
          ${scape.description ? `<p>${escapeHtml(scape.description)}</p>` : ""}
          <div class="scape-meta-list">${fishHtml}${sizeHtml}${noteHtml}</div>
        </div>
      </details>`;
    }).join("");
    list.querySelectorAll("img").forEach(img => img.addEventListener("error", () => { img.src = PLACEHOLDER; }));
  }

  function updateScapeStatus(text){
    const s = el("scapeGalleryStatus");
    if(s) s.textContent = text;
  }

  async function loadEquipmentGuide(){
    const list = el("equipmentGuideList");
    const filterWrap = el("equipmentCategoryFilters");
    if(!list) return;
    updateEquipmentStatus("設備介紹整理中");
    const url = CONFIG.equipmentCsvUrl;
    if(!url || !String(url).trim()){
      state.equipments = [];
      if(filterWrap) filterWrap.innerHTML = "";
      list.innerHTML = `<div class="empty scape-empty">設備介紹整理中。</div>`;
      updateEquipmentStatus("");
      return;
    }
    try{
      const csv = await fetchTextNoCache(url, 9000);
      const rows = csvToObjects(csv);
      const equipments = normalizeEquipments(rows);
      state.equipments = equipments;
      renderEquipmentFilters();
      if(!equipments.length){
        list.innerHTML = `<div class="empty scape-empty">目前尚無設備介紹。</div>`;
        updateEquipmentStatus("");
        return;
      }
      renderEquipmentGuide();
      updateEquipmentStatus("設備介紹已更新");
    }catch(error){
      console.warn("設備介紹讀取失敗：", url, error);
      state.equipments = [];
      if(filterWrap) filterWrap.innerHTML = "";
      list.innerHTML = `<div class="empty scape-empty">設備介紹暫時無法讀取。</div>`;
      updateEquipmentStatus("");
    }
  }

  function normalizeEquipments(rows){
    return rows.map((p, index) => {
      const status = firstValue(p["狀態"], p.status) || "顯示";
      const hidden = isHidden(status);
      const orderRaw = firstValue(p["排序"], p.order);
      const orderNumber = Number(orderRaw);
      return {
        id: firstValue(p.id, p["ID"]) || `equipment-${index}`,
        order: Number.isFinite(orderNumber) ? orderNumber : index + 1,
        visible: !hidden,
        category: firstValue(p["分類"], p["子選項"], p["設備分類"], p.category) || "其他",
        title: firstValue(p["設備名稱"], p["名稱"], p["類型名稱"], p.title) || "未命名設備",
        description: firstValue(p["介紹文字"], p["用途"], p["說明"], p.description),
        scenario: firstValue(p["適合情境"], p["適合方向"], p["適用情境"], p.scenario),
        points: firstValue(p["選購重點"], p["注意事項"], p["重點"], p.points),
        image: normalizeContentImageUrl(firstValue(p["圖片網址"], p["照片網址"], p["圖片"], p.image)),
        note: firstValue(p["備註"], p.note)
      };
    })
    .filter(item => item.visible && item.title && item.title !== "未命名設備")
    .sort((a, b) => a.order - b.order);
  }

  function renderEquipmentFilters(){
    const container = el("equipmentCategoryFilters");
    if(!container) return;
    const categories = ["全部", ...Array.from(new Set(state.equipments.map(item => item.category).filter(Boolean)))];
    container.innerHTML = categories.map(cat => {
      const active = cat === state.equipmentCategory ? "active" : "";
      return `<button class="filter-btn ${active}" type="button" data-equipment-category="${escapeAttr(cat)}">${escapeHtml(cat)}</button>`;
    }).join("");
    container.querySelectorAll("[data-equipment-category]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.equipmentCategory = btn.dataset.equipmentCategory || "全部";
        renderEquipmentFilters();
        renderEquipmentGuide();
      });
    });
  }

  function renderEquipmentGuide(){
    const list = el("equipmentGuideList");
    if(!list) return;
    const items = state.equipments.filter(item => state.equipmentCategory === "全部" || item.category === state.equipmentCategory);
    if(!items.length){
      list.innerHTML = `<div class="empty scape-empty">目前尚無此分類的設備介紹。</div>`;
      return;
    }
    list.innerHTML = items.map(item => {
      const imgHtml = item.image ? `<div class="scape-photo-wrap"><img class="scape-photo" src="${escapeAttr(item.image)}" alt="${escapeAttr(item.title)}" loading="lazy"></div>` : "";
      const scenarioHtml = item.scenario ? `<div class="scape-row"><span>適合情境</span><p>${escapeHtml(item.scenario)}</p></div>` : "";
      const pointsHtml = item.points ? `<div class="scape-row"><span>選購重點</span><p>${escapeHtml(item.points)}</p></div>` : "";
      const noteHtml = item.note ? `<div class="scape-row"><span>備註</span><p>${escapeHtml(item.note)}</p></div>` : "";
      return `<details class="scape-item equipment-item">
        <summary>
          <span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.category || "設備介紹")}</small></span>
        </summary>
        <div class="scape-content">
          ${imgHtml}
          ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}
          <div class="scape-meta-list">${scenarioHtml}${pointsHtml}${noteHtml}</div>
        </div>
      </details>`;
    }).join("");
    list.querySelectorAll("img").forEach(img => img.addEventListener("error", () => {
      const wrap = img.closest(".scape-photo-wrap");
      if(wrap) wrap.hidden = true;
    }));
  }

  function updateEquipmentStatus(text){
    const s = el("equipmentGuideStatus");
    if(s) s.textContent = text || "";
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
      const askStockRaw = firstValue(
        p["可詢問庫存"],
        p["目前庫存"],
        p["庫存"],
        p["數量"],
        p.stockQty,
        p.stock,
        p.quantity
      );
      const hasStock = String(askStockRaw ?? "").trim() !== "";
      const stockNumber = parseStockNumber(askStockRaw);
      const manualUnavailable = isUnavailable(firstValue(p["是否售完"], p["暫不販售"], p.soldOut, p.unavailable));
      const statusRaw = firstValue(p["狀態"], p["販售狀態"], p.status);
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
      const unit = firstValue(p["單位"], p.unit) || "隻";
      const price = cleanPrice(firstValue(p["售價"], p["價格"], p["單價"], p.price));
      return {
        id: firstValue(p.id, p["ID"], p["編號"]) || `item-${index}`,
        name: firstValue(p["品名"], p["魚種"], p["名稱"], p.name) || "未命名品項",
        scientific: firstValue(p["學名"], p.scientific),
        category: firstValue(p["分類"], p["類別"], p.category) || "其他",
        price,
        priceNumber: parseMoney(price),
        size: firstValue(p["尺寸"], p.size),
        status: statusText,
        hasStock,
        stock: hasStock ? formatStock(askStockRaw, sold) : "",
        askStock: stockNumber,
        unit,
        tags: splitTags(firstValue(p["標籤"], p.tags)),
        feeding: firstValue(p["餵食"], p.feeding),
        image: normalizeContentImageUrl(firstValue(p["圖片網址"], p["照片網址"], p["圖片"], p.image)),
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
    const match = raw.match(/-?\d+(?:\.\d+)?/);
    if(!match) return null;
    const n = Number(match[0]);
    return Number.isFinite(n) ? n : null;
  }

  function parseMoney(value){
    const raw = String(value ?? "").replace(/,/g, "");
    const match = raw.match(/-?\d+(?:\.\d+)?/);
    if(!match) return null;
    const n = Number(match[0]);
    return Number.isFinite(n) ? n : null;
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

  function normalizeContentImageUrl(url){
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
      const haystack = [p.name, p.scientific, p.category, p.status, p.size, p.stock, p.tags.join(" "), p.feeding, p.note].join(" ").toLowerCase();
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
  }

  function isScapeProduct(p){
    const text = [p.category, p.name, p.tags ? p.tags.join(" ") : ""].join(" ");
    return /造景|沉木|石材|硬景|水草|缸/.test(text);
  }

  function previewLabels(p){
    if(isScapeProduct(p)){
      return { size: "適用缸型", feeding: "內容", note: "造景說明" };
    }
    return { size: "尺寸", feeding: "餵食", note: "備註" };
  }

  function canSelectQuantity(p){
    if(!p || p.soldOut || isScapeProduct(p)) return false;
    if(!Number.isFinite(p.askStock) || p.askStock <= 0) return false;
    const status = String(p.status || "").trim();
    if(!status) return true;
    return /可詢問|穩定|可私訊|已開口/.test(status) && !/檢疫|觀察|適應|未穩|暫不|售完|停售|休養/.test(status);
  }

  function quantityControls(p){
    if(!canSelectQuantity(p)) return "";
    const max = Math.max(1, Math.floor(p.askStock));
    return `<div class="qty-panel" data-qty-panel data-product-id="${escapeAttr(p.id)}">
      <div class="qty-title">預計詢問數量</div>
      <div class="qty-box">
        <button type="button" class="qty-minus" aria-label="減少數量">－</button>
        <input class="qty-input" type="number" inputmode="numeric" min="0" max="${max}" value="1" data-send-min="1" aria-label="詢問數量">
        <button type="button" class="qty-plus" aria-label="增加數量">＋</button>
      </div>
      <div class="qty-hint">目前最多可詢問：${max} ${escapeHtml(p.unit || "隻")}</div>
    </div>`;
  }

  function buildInquiryText(p, qty){
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

    const selectedQty = Number(qty || 0);
    const hasQty = canSelectQuantity(p) && selectedQty > 0;
    const subtotal = hasQty && Number.isFinite(p.priceNumber) ? Math.round(p.priceNumber * selectedQty) : null;

    if(hasQty){
      return [
        "您好，我想詢問河憩寮網站上的活體：",
        "",
        `魚種：${p.name}`,
        p.size ? `尺寸：約 ${p.size}` : "",
        p.price ? `單價：NT$ ${p.price} / ${p.unit || "隻"}` : "",
        `預計數量：${selectedQty} ${p.unit || "隻"}`,
        subtotal !== null ? `預估小計：NT$ ${subtotal}` : "",
        p.status ? `目前狀態：${p.status}` : "",
        "",
        "想確認目前是否還可安排，以及適合的取魚／出貨時間。"
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

  function buildMoreQuantityText(p, wantedQty){
    return [
      "您好，我想詢問河憩寮網站上的活體：",
      "",
      `魚種：${p.name}`,
      p.size ? `尺寸：約 ${p.size}` : "",
      p.price ? `單價：NT$ ${p.price} / ${p.unit || "隻"}` : "",
      Number.isFinite(p.askStock) ? `目前網站可詢問庫存：${Math.floor(p.askStock)} ${p.unit || "隻"}` : "",
      `我想詢問是否可安排更多數量：${wantedQty} ${p.unit || "隻"}`,
      p.status ? `目前狀態：${p.status}` : "",
      "",
      "想確認是否能協助安排，以及適合的取魚／出貨時間。"
    ].filter(Boolean).join("\n");
  }

  function productCard(p){
    const labels = previewLabels(p);
    const infoRows = [
      [labels.size, p.size],
      ["可詢問庫存", p.hasStock ? `${p.stock}${p.unit && !String(p.stock).includes(p.unit) ? ` ${p.unit}` : ""}` : ""],
      [labels.feeding, p.feeding],
      [labels.note, p.note]
    ].filter(row => row && row[1]);
    return `<article class="product-card ${p.soldOut ? "soldout" : ""}" data-product-id="${escapeAttr(p.id)}">
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
        ${quantityControls(p)}
        <div class="card-actions">
          <button class="copy-btn" type="button" data-copy-product="${escapeAttr(p.id)}">複製詢問文字</button>
          ${p.soldOut ? `<button class="btn" type="button" disabled>${escapeHtml(p.status || "暫不販售")}</button>` : `<a class="btn" href="${escapeAttr(lineHrefForProduct(p, 1))}" data-line-product="${escapeAttr(p.id)}" target="_blank" rel="noopener">LINE 詢問</a>`}
          ${canSelectQuantity(p) ? `<button class="more-qty-btn" type="button" data-more-qty="${escapeAttr(p.id)}">想詢問更多數量</button>` : ""}
        </div>
      </div>
    </article>`;
  }

  function bindPreviewModal(){
    document.addEventListener("click", (event) => {
      const imageClose = event.target.closest("[data-image-close]");
      if(imageClose){ closeImageZoom(); return; }
      const zoom = event.target.closest("[data-image-zoom]");
      if(zoom){
        event.preventDefault();
        event.stopPropagation();
        openImageZoom(zoom.dataset.imageZoom, zoom.dataset.imageAlt || "");
        return;
      }
      const close = event.target.closest("[data-preview-close]");
      if(close){ closePreview(); return; }
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
      ["可詢問庫存", p.hasStock ? `${p.stock}${p.unit && !String(p.stock).includes(p.unit) ? ` ${p.unit}` : ""}` : ""],
      [labels.feeding, p.feeding],
      [labels.note, p.note]
    ].filter(row => row && row[1]);

    content.innerHTML = `<div class="preview-image">
        <button class="image-zoom-trigger" type="button" data-image-zoom="${escapeAttr(p.image)}" data-image-alt="${escapeAttr(p.name)}" aria-label="放大 ${escapeAttr(p.name)} 圖片">
          <img src="${escapeAttr(p.image)}" alt="${escapeAttr(p.name)}">
          <span class="image-zoom-hint">點圖看大圖</span>
        </button>
        <span class="badge ${statusClass(p.status, p.soldOut)}">${escapeHtml(p.status)}</span>
      </div>
      <div class="preview-body" data-product-id="${escapeAttr(p.id)}">
        <div class="preview-title-row">
          <h3>${escapeHtml(p.name)}</h3>
          <span class="category-chip">${escapeHtml(p.category)}</span>
        </div>
        ${p.scientific ? `<p class="sci">${escapeHtml(p.scientific)}</p>` : ""}
        ${p.price ? `<div class="price">${escapeHtml(p.price)}</div>` : ""}
        <div class="preview-info">${infoRows.map(([k,v]) => `<div><span>${escapeHtml(k)}</span><span>${escapeHtml(v)}</span></div>`).join("")}</div>
        ${quantityControls(p)}
        <div class="card-actions preview-actions">
          <button class="copy-btn" type="button" data-copy-product="${escapeAttr(p.id)}">複製詢問文字</button>
          ${p.soldOut ? `<button class="btn" type="button" disabled>${escapeHtml(p.status || "暫不販售")}</button>` : `<a class="btn" href="${escapeAttr(lineHrefForProduct(p, 1))}" data-line-product="${escapeAttr(p.id)}" target="_blank" rel="noopener">LINE 詢問</a>`}
          ${canSelectQuantity(p) ? `<button class="more-qty-btn" type="button" data-more-qty="${escapeAttr(p.id)}">想詢問更多數量</button>` : ""}
        </div>
      </div>`;

    const img = content.querySelector("img");
    if(img) img.addEventListener("error", () => { img.src = PLACEHOLDER; });
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
    const stockHeader = showStock ? "<th>可詢問庫存</th>" : "";
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
    body.innerHTML = state.filtered.map(p => {
      const sizeCell = showSize ? `<td>${escapeHtml(p.size || "")}</td>` : "";
      const stockValue = p.hasStock ? `${p.stock}${p.unit && !String(p.stock).includes(p.unit) ? ` ${p.unit}` : ""}` : "";
      const stockCell = showStock ? `<td>${escapeHtml(stockValue)}</td>` : "";
      return `<tr class="quick-row" data-preview-id="${escapeAttr(p.id)}">
        <td>${escapeHtml(p.category)}</td>
        <td><b>${escapeHtml(p.name)}</b>${p.scientific ? `<small>${escapeHtml(p.scientific)}</small>` : ""}</td>
        ${sizeCell}
        <td>${escapeHtml(formatPrice(p.price))}</td>
        ${stockCell}
        <td><span class="badge ${statusClass(p.status, p.soldOut)}">${escapeHtml(p.status)}</span></td>
      </tr>`;
    }).join("");
  }

  function bindProductActions(){
    document.addEventListener("click", (event) => {
      const qtyButton = event.target.closest(".qty-minus, .qty-plus");
      if(qtyButton){
        const panel = qtyButton.closest("[data-qty-panel]");
        const input = panel ? panel.querySelector(".qty-input") : null;
        if(!input) return;
        const sendMin = Number(input.dataset.sendMin || 1);
        const max = Number(input.max || 1);
        const currentRaw = String(input.value || "").trim();
        const current = currentRaw === "" ? 0 : Number(currentRaw);
        const safeCurrent = Number.isFinite(current) ? current : 0;
        input.value = qtyButton.classList.contains("qty-plus")
          ? Math.min(Math.max(safeCurrent, 0) + 1, max)
          : Math.max(Math.max(safeCurrent, sendMin) - 1, sendMin);
        updateLineHrefsAround(panel);
        return;
      }

      const copyButton = event.target.closest("[data-copy-product]");
      if(copyButton){
        const product = findProduct(copyButton.dataset.copyProduct);
        if(!product) return;
        const qty = readQuantityNear(copyButton, product);
        copyInquiry(buildInquiryText(product, qty), copyButton);
        return;
      }

      const lineButton = event.target.closest("[data-line-product]");
      if(lineButton){
        const product = findProduct(lineButton.dataset.lineProduct);
        if(!product) return;
        const qty = readQuantityNear(lineButton, product);
        const message = buildInquiryText(product, qty);
        lineButton.href = buildLineHref(message);
        copyInquiry(message, lineButton, "已複製詢問文字，可貼到 LINE");
        return;
      }

      const moreButton = event.target.closest("[data-more-qty]");
      if(moreButton){
        const product = findProduct(moreButton.dataset.moreQty);
        if(!product) return;
        const currentStock = Number.isFinite(product.askStock) ? Math.floor(product.askStock) : 0;
        const wanted = window.prompt(`目前網站可詢問庫存為 ${currentStock} ${product.unit || "隻"}，請輸入想詢問的數量：`);
        if(!wanted) return;
        const message = buildMoreQuantityText(product, wanted);
        copyInquiry(message, moreButton, "已複製更多數量詢問文字");
        window.open(buildLineHref(message), "_blank", "noopener");
      }
    });

    document.addEventListener("input", (event) => {
      if(!event.target.classList.contains("qty-input")) return;
      const input = event.target;
      const max = Number(input.max || 1);
      const raw = String(input.value || "").trim();

      // 編輯中允許暫時空白，避免 iPad 刪除數字時立刻被補回 1。
      if(raw === ""){
        updateLineHrefsAround(input);
        return;
      }

      let value = Number(raw);
      if(!Number.isFinite(value)){
        input.value = "";
        updateLineHrefsAround(input);
        return;
      }

      value = Math.round(value);
      if(value < 0) value = 0;
      if(value > max) value = max;

      input.value = value;
      updateLineHrefsAround(input);
    });

    document.addEventListener("blur", (event) => {
      if(!event.target.classList.contains("qty-input")) return;
      normalizeQuantityInput(event.target, true);
    }, true);
  }

  function updateLineHrefsAround(node){
    const scope = node.closest(".product-card") || node.closest(".preview-body") || document;
    const link = scope.querySelector("[data-line-product]");
    if(!link) return;
    const product = findProduct(link.dataset.lineProduct);
    if(!product) return;
    const qty = readQuantityNear(link, product);
    link.href = lineHrefForProduct(product, qty);
  }

  function findProduct(id){
    return state.products.find(p => String(p.id) === String(id));
  }

  function normalizeQuantityInput(input, resetEmptyToOne){
    if(!input) return 1;
    const max = Number(input.max || 1);
    const sendMin = Number(input.dataset.sendMin || 1);
    const raw = String(input.value || "").trim();

    if(raw === ""){
      if(resetEmptyToOne) input.value = sendMin;
      return sendMin;
    }

    let value = Number(raw);
    if(!Number.isFinite(value)) value = sendMin;
    value = Math.round(value);

    if(value <= 0 && resetEmptyToOne) value = sendMin;
    if(value < 0) value = 0;
    if(value > max) value = max;

    input.value = value;
    return value <= 0 ? sendMin : value;
  }

  function readQuantityNear(node, product){
    if(!canSelectQuantity(product)) return 0;
    const scope = node.closest(".product-card") || node.closest(".preview-body") || document;
    const input = scope.querySelector(".qty-input");
    const max = Number.isFinite(product.askStock) ? Math.floor(product.askStock) : 1;
    let value = normalizeQuantityInput(input, false);
    if(value < 1) value = 1;
    if(value > max) value = max;
    return value;
  }

  function lineHrefForProduct(product, qty){
    return buildLineHref(buildInquiryText(product, qty));
  }

  function buildLineHref(message){
    const url = String(CONFIG.lineUrl || "#").trim();
    if(!url || url === "#") return "#";
    if(/line\.me\/R\/oaMessage\//.test(url)){
      const cleanUrl = url.replace(/[?&]$/, "");
      return `${cleanUrl}${cleanUrl.includes("?") ? "&" : "?"}${encodeURIComponent(message)}`;
    }
    return url;
  }

  async function copyInquiry(text, btn, successText){
    if(!text) return;
    try{
      if(navigator.clipboard && window.isSecureContext){
        await navigator.clipboard.writeText(text);
      }else{
        fallbackCopy(text);
      }
      flashButton(btn, successText || "已複製詢問文字");
    }catch(error){
      fallbackCopy(text);
      flashButton(btn, successText || "已複製詢問文字");
    }
  }

  function fallbackCopy(text){
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  function flashButton(btn, text){
    if(!btn) return;
    const old = btn.textContent;
    btn.textContent = text;
    btn.classList.add("copied");
    window.setTimeout(() => {
      btn.textContent = old;
      btn.classList.remove("copied");
    }, 1400);
  }

  function updateStatus(text){
    const s = el("dataStatus") || el("stockStatus") || el("listStatus");
    if(s) s.textContent = text || "";
  }

  function escapeHtml(value){
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value){
    return escapeHtml(value);
  }

  function injectQuantityStyles(){
    if(document.getElementById("heqiliao-quantity-style")) return;
    const style = document.createElement("style");
    style.id = "heqiliao-quantity-style";
    style.textContent = `
      .qty-panel{margin:14px 0 8px;padding:12px;border:1px solid rgba(24,60,53,.14);border-radius:14px;background:rgba(238,244,239,.6)}
      .qty-title{font-size:13px;color:#66756f;margin-bottom:8px;letter-spacing:.02em}
      .qty-box{display:flex;align-items:center;gap:8px}
      .qty-box button{width:38px;height:38px;border-radius:10px;border:1px solid rgba(24,60,53,.2);background:#fff;color:#183c35;font-size:18px;font-weight:700;cursor:pointer}
      .qty-input{width:68px;height:38px;text-align:center;border-radius:10px;border:1px solid rgba(24,60,53,.2);background:#fff;color:#183c35;font-size:16px}
      .qty-hint{font-size:13px;color:#66756f;margin-top:8px}
      .more-qty-btn{width:100%;padding:10px 12px;border:0;border-radius:10px;background:#f3f3f3;color:#183c35;cursor:pointer;font-weight:600}
      .copy-btn.copied,.btn.copied,.more-qty-btn.copied{filter:brightness(.96)}
    `;
    document.head.appendChild(style);
  }
})();
