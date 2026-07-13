import fs from "node:fs/promises";
import path from "node:path";

const SHOP_URL = "https://mall.iopenmall.tw/113248/";
const OUTPUT_DIR = path.resolve("outputs");
const CSV_PATH = path.join(OUTPUT_DIR, "iopenmall_hardware_import.csv");
const REPORT_PATH = path.join(OUTPUT_DIR, "iopenmall_hardware_import_report.md");
const HEADERS = [
  "商品ID",
  "排序",
  "分類",
  "品名",
  "商品說明",
  "規格",
  "狀態",
  "售價",
  "規格備註",
  "圖片網址",
  "商品狀態",
];

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const shopHtml = await fetchText(SHOP_URL);
  const productUrls = extractProductUrls(shopHtml);
  const products = [];
  const warnings = [];

  for (const [index, url] of productUrls.entries()) {
    try {
      const html = await fetchText(url);
      products.push(parseProductPage(html, url, index + 1));
    } catch (error) {
      warnings.push(`無法讀取商品頁：${url} (${error.message})`);
    }
  }

  const rows = products.flatMap(productToRows);
  await fs.writeFile(CSV_PATH, toCsv([HEADERS, ...rows]), "utf8");
  await fs.writeFile(REPORT_PATH, buildReport(products, warnings), "utf8");

  console.log(`已輸出 ${rows.length} 列：${CSV_PATH}`);
  console.log(`已輸出報告：${REPORT_PATH}`);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; HeqiliaoImportHelper/1.0)",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.text();
}

function extractProductUrls(html) {
  const urls = new Map();
  const re = /href=["']([^"']*action=product_detail&prod_no=(P\d+)[^"']*)["']/g;
  let match;
  while ((match = re.exec(html))) {
    const raw = decodeHtml(match[1]).replace(/&amp;/g, "&");
    const url = new URL(raw, SHOP_URL).href;
    urls.set(match[2], url);
  }
  return Array.from(urls.values());
}

function parseProductPage(html, url, order) {
  const title = cleanTitle(
    attr(html, /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
      attr(html, /<title>([\s\S]*?)<\/title>/i)
  );
  const ogDescription = cleanDescription(
    attr(html, /<meta\s+property=["']og:description["']\s+content=["']([^"']*)["']/i)
  );
  const image = attr(html, /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  const productNo = attr(html, /商品編號：\s*([A-Z0-9]+)/i) || attr(html, /"productID"\s*:\s*"([^"]+)"/i) || productNoFromUrl(url);
  const rawCategory = extractCategory(html, title);
  const category = mapCategory(rawCategory, title);
  const variants = extractVariants(html);
  const specs = variants.length ? variants : [{ spec: "", price: extractLowestPrice(html) }];

  return {
    id: makeProductId(productNo, title),
    sourceNo: productNo,
    sourceUrl: url,
    order,
    category,
    rawCategory,
    title,
    description: ogDescription,
    image: cleanUrl(image),
    variants: specs,
  };
}

function extractCategory(html, title) {
  const breadcrumb = html.match(/<ol[^>]*class=["'][^"']*breadcrumb[^"']*["'][\s\S]*?<\/ol>/i)?.[0] || "";
  const crumbs = Array.from(breadcrumb.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi))
    .map((m) => stripTags(m[1]))
    .map(cleanText)
    .filter(Boolean);
  const fromBreadcrumb = crumbs.find((crumb) => !["首頁", "賣場分類"].includes(crumb) && crumb !== title);
  if (fromBreadcrumb) return fromBreadcrumb;

  const categoryName = attr(html, /["']category_name["']\s*:\s*["']([^"']+)["']/i);
  if (categoryName) return cleanText(categoryName);

  return inferCategory(title);
}

function mapCategory(category, title = "") {
  const text = `${category || ""} ${title || ""}`;
  if (/過濾|濾材|生化棉|生化球|Matrix|Tidal|水妖精/.test(text)) return "過濾設備";
  if (/換水|撈網|魚網|滴管|吸管|清潔|虹吸|工具/.test(text)) return "水族工具";
  if (/飼料|高夠力|Hikari/.test(text)) return "飼料";
  if (/底沙|底砂|造景|川砂|雨林沙/.test(text)) return "造景素材";
  if (/水質|測試|除氯|Prime|Flourish|肥料|添加|試紙|氨|硝酸|亞硝酸/.test(text)) return "水質處理";
  if (/打氣|空氣馬達|氣動/.test(text)) return "打氣設備";
  if (/爬蟲|飼養盒/.test(text)) return "其他";
  if (/水族設備|水族用品|所有商品/.test(String(category || ""))) return "待分類";
  return category || "待分類";
}

function inferCategory(title) {
  return mapCategory("", title);
}

function extractVariants(html) {
  const allProductsJson = extractJsObjectLiteral(html, "all_products");
  if (!allProductsJson) return [];

  const variants = [];
  try {
    const allProducts = JSON.parse(allProductsJson);
    for (const item of Object.values(allProducts)) {
      const spec = [item.prod_color_name, item.prod_size].filter(Boolean).join(" ");
      const price = item.prod_selling_price || item.selling_price || "";
      const sku = item.prod_no || "";
      if (spec || price) variants.push({ spec: cleanText(spec), price: cleanText(price), sku });
    }
  } catch {
    return [];
  }
  return variants;
}

function extractJsObjectLiteral(html, variableName) {
  const marker = `const ${variableName} =`;
  const start = html.indexOf(marker);
  if (start < 0) return "";
  const braceStart = html.indexOf("{", start + marker.length);
  if (braceStart < 0) return "";

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = braceStart; i < html.length; i += 1) {
    const char = html[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return html.slice(braceStart, i + 1);
    }
  }
  return "";
}

function extractLowestPrice(html) {
  return (
    attr(html, /"price"\s*:\s*"([^"]+)"/i) ||
    cleanText(attr(html, /<meta\s+property=["']product:price:amount["']\s+content=["']([^"']+)["']/i)) ||
    cleanText(attr(html, /\$\s*([0-9,]+)/i))
  );
}

function productToRows(product) {
  return product.variants.map((variant, index) => {
    const first = index === 0;
    return [
      product.id,
      String(product.order + index / 100),
      first ? product.category : "",
      first ? product.title : "",
      first ? product.description : "",
      normalizeSpec(product.title, variant.spec),
      "現貨",
      variant.price || "",
      "",
      first ? product.image : "",
      first ? "顯示" : "",
    ];
  });
}

function normalizeSpec(title, spec) {
  const clean = cleanText(spec);
  if (!clean) return "單一規格";
  if (/^\d+$/.test(clean)) {
    const prefix = title.match(/\b(Tidal|K-|EX|ZY-|API|ISTA|Rio|Hikari|Seachem)\b/i)?.[1];
    if (prefix && /Tidal/i.test(prefix)) return `Tidal ${clean}`;
  }
  return clean;
}

function buildReport(products, warnings) {
  const lines = [];
  lines.push("# iOPEN Mall 硬體販售匯入整理報告");
  lines.push("");
  lines.push(`來源：${SHOP_URL}`);
  lines.push(`商品數：${products.length}`);
  lines.push(`輸出列數：${products.reduce((sum, p) => sum + p.variants.length, 0)}`);
  lines.push("");
  lines.push("## 注意事項");
  lines.push("");
  lines.push("- CSV 只供匯入前確認，尚未自動寫入 Google Sheets。");
  lines.push("- 分類是依 iOPEN Mall 分類與商品名稱推測，建議匯入前人工確認。");
  lines.push("- 圖片目前使用 iOPEN Mall 公開圖片網址，若要長期穩定，建議之後再搬到 Google Drive。");
  lines.push("- 商品ID 由 iOPEN Mall 商品編號產生，匯入前可改成你習慣的內部代碼。");
  lines.push("");
  if (warnings.length) {
    lines.push("## 抓取警告");
    lines.push("");
    warnings.forEach((warning) => lines.push(`- ${warning}`));
    lines.push("");
  }
  lines.push("## 商品摘要");
  lines.push("");
  for (const product of products) {
    const specSummary = product.variants.map((v) => `${normalizeSpec(product.title, v.spec)} ${v.price ? `NT$${v.price}` : "未抓到價格"}`).join("、");
    lines.push(`- ${product.id}｜${product.category}｜${product.title}｜${specSummary}`);
    if (product.rawCategory && product.rawCategory !== product.category) {
      lines.push(`  - 原始分類：${product.rawCategory}`);
    }
    if (!product.image) lines.push("  - 需確認：未抓到圖片網址");
  }
  return `${lines.join("\n")}\n`;
}

function cleanTitle(value) {
  return cleanText(value)
    .replace(/\s*-\s*河憩寮水族工作室\s*-\s*iOPEN Mall\s*$/i, "")
    .trim();
}

function cleanDescription(value) {
  return cleanText(value)
    .replace(/^[:：\s]+/, "")
    .replace(/^商品說明\s*/, "")
    .replace(/^[:：\s]+/, "")
    .replace(/退換貨說明[\s\S]*$/u, "")
    .trim();
}

function makeProductId(productNo, title) {
  const no = String(productNo || "").replace(/^P/i, "");
  if (no) return `iopen-${no}`;
  return `iopen-${slugify(title).slice(0, 36)}`;
}

function productNoFromUrl(url) {
  return new URL(url).searchParams.get("prod_no") || "";
}

function attr(text, regex) {
  const match = text.match(regex);
  return match ? decodeHtml(match[1]) : "";
}

function cleanUrl(value) {
  return decodeHtml(value || "").replace(/&amp;/g, "&").trim();
}

function cleanText(value) {
  return decodeHtml(stripTags(String(value || "")))
    .replace(/\\n/g, "\n")
    .replace(/\\\//g, "/")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function stripTags(value) {
  return String(value || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "");
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)));
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
