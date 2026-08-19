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

  // 硬體販售 CSV：建立「硬體販售」分頁並發布 CSV 後，把網址貼到這裡
  hardwareSaleCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSepWHrHrBa3VZJAL2d0Ga8jOa2_qpZAu6cHNiY7aBYhmMY_i0rK-NfGEGQmSgYyoBWQUHhysZm9KVe/pub?gid=858285018&single=true&output=csv",

  questionnaireUrl: "https://docs.google.com/forms/d/e/1FAIpQLSe27SlEwZQrY_D3Zv_-TUr2Xwg0ImgzkrwHCTbeB9ByuVS0YA/viewform",
  quarantineRecordUrl: "https://docs.google.com/document/d/1vH2a4YFpSMDVqkEpPS6Y58D4G45ALnZhn51a7fMO6l4/edit?tab=t.ib81wg9n3ayj",

  listUpdatedText: "2026/05/31"
};

document.addEventListener("DOMContentLoaded", () => {
  const CONFIG = window.HEQILIAO_CONFIG || {};

  // 品牌定位：畫面用「寵物魚工作室」；SEO 仍由 index.html 保留「淡水觀賞魚」關鍵字。
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

  // 插畫原圖的舊副標是圖片像素，使用同色覆蓋層改成「寵物魚工作室」，不破壞原圖主體。
  const heroImage = document.querySelector(".hero-card > img");
  if(heroImage && !document.querySelector(".hero-brand-subtitle-overlay")){
    const wrapper = document.createElement("div");
    wrapper.className = "hero-image-brand-wrap";
    heroImage.parentNode.insertBefore(wrapper, heroImage);
    wrapper.appendChild(heroImage);

    const overlay = document.createElement("div");
    overlay.className = "hero-brand-subtitle-overlay";
    overlay.textContent = CONFIG.studioLabel || "寵物魚工作室";
    wrapper.appendChild(overlay);

    const style = document.createElement("style");
    style.id = "heqiliao-pet-fish-brand-style";
    style.textContent = `
      .hero-image-brand-wrap {
        position: relative;
        overflow: hidden;
      }
      .hero-image-brand-wrap > img {
        display: block;
        width: 100%;
        height: auto;
      }
      .hero-brand-subtitle-overlay {
        position: absolute;
        left: 29%;
        right: 29%;
        bottom: 4.2%;
        min-height: 6.8%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.15em 0.3em;
        background: rgba(247, 243, 232, 0.98);
        box-shadow: 0 0 12px 10px rgba(247, 243, 232, 0.90);
        color: #31534b;
        font-size: clamp(10px, 1.05vw, 15px);
        font-weight: 500;
        line-height: 1;
        letter-spacing: 0.28em;
        white-space: nowrap;
        pointer-events: none;
      }
      @media (max-width: 720px) {
        .hero-brand-subtitle-overlay {
          left: 25%;
          right: 25%;
          bottom: 4%;
          font-size: clamp(9px, 2.8vw, 13px);
          letter-spacing: 0.22em;
        }
      }
    `;
    document.head.appendChild(style);
  }
});
