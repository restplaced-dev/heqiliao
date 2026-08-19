window.HEQILIAO_CONFIG = {
  brandName: "河憩寮",
  studioLabel: "寵物魚工作室",
  lineUrl: "https://lin.ee/p9wkJW2",

  // 本週名單 CSV
  sheetCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSepWHrHrBa3VZJAL2d0Ga8jOa2_qpZAu6cHNiY7aBYhmMY_i0rK-NfGEGQmSgYyoBWQUHhysZm9KVe/pub?gid=456433745&single=true&output=csv",

  // 造景介紹 CSV
  scapeCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSepWHrHrBa3VZJAL2d0Ga8jOa2_qpZAu6cHNiY7aBYhmMY_i0rK-NfGEGQmSgYyoBWQUHhysZm9KVe/pub?gid=1032575506&single=true&output=csv",

  // 設備介紹 CSV
  equipmentCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSepWHrHrBa3VZJAL2d0Ga8jOa2_qpZAu6cHNiY7aBYhmMY_i0rK-NfGEGQmSgYyoBWQUHhysZm9KVe/pub?gid=376213302&single=true&output=csv",

  // 硬體販售 CSV
  hardwareSaleCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSepWHrHrBa3VZJAL2d0Ga8jOa2_qpZAu6cHNiY7aBYhmMY_i0rK-NfGEGQmSgYyoBWQUHhysZm9KVe/pub?gid=858285018&single=true&output=csv",

  questionnaireUrl: "https://docs.google.com/forms/d/e/1FAIpQLSe27SlEwZQrY_D3Zv_-TUr2Xwg0ImgzkrwHCTbeB9ByuVS0YA/viewform",
  quarantineRecordUrl: "https://docs.google.com/document/d/1vH2a4YFpSMDVqkEpPS6Y58D4G45ALnZhn51a7fMO6l4/edit?tab=t.ib81wg9n3ayj",

  listUpdatedText: "2026/05/31"
};

document.addEventListener("DOMContentLoaded", () => {
  const CONFIG = window.HEQILIAO_CONFIG || {};

  // 首頁品牌定位文字。
  const studioLabel = document.querySelector(".hero .eyebrow");
  if(studioLabel && CONFIG.studioLabel) studioLabel.textContent = CONFIG.studioLabel;

  const heroLead = document.querySelector(".hero .lead");
  if(heroLead){
    heroLead.textContent = heroLead.textContent.replace("河憩寮以淡水觀賞魚為主", "河憩寮以寵物魚為主");
  }

  const footerText = Array.from(document.querySelectorAll(".footer p"))
    .find(p => (p.textContent || "").includes("淡水觀賞魚｜鼠魚｜異型魚｜小型魚"));
  if(footerText){
    footerText.textContent = footerText.textContent.replace(
      "淡水觀賞魚｜鼠魚｜異型魚｜小型魚",
      "寵物魚｜鼠魚｜異型魚｜小型魚"
    );
  }

  // 正式主視覺：使用已定稿的實體圖片，不再使用文字覆蓋層。
  const heroImage = document.querySelector(".hero-card > img");
  if(heroImage){
    heroImage.src = "hero-illustration-v20-exact-text.jpg?v=20260819-29";
    heroImage.alt = "河憩寮淡水寵物魚工作室品牌插畫";
  }

  // 瀏覽器頁籤品牌名稱同步更新；SEO 內容仍保留淡水觀賞魚相關關鍵字。
  document.title = "河憩寮｜寵物魚工作室";
});
