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

  // 使用 repo 中原本的高解析主視覺；只覆蓋圖內舊副標，避免再經過低解析重建流程。
  const heroImage = document.querySelector(".hero-card > img, .hero-image-brand-wrap > img");
  if(heroImage){
    heroImage.src = "hero-illustration.jpg?v=20260819-33";
    heroImage.alt = "河憩寮淡水寵物魚工作室品牌插畫";

    let wrapper = heroImage.closest(".hero-image-brand-wrap");
    if(!wrapper){
      wrapper = document.createElement("div");
      wrapper.className = "hero-image-brand-wrap";
      heroImage.parentNode.insertBefore(wrapper, heroImage);
      wrapper.appendChild(heroImage);
    }

    if(!wrapper.querySelector(".hero-brand-subtitle-overlay")){
      const overlay = document.createElement("div");
      overlay.className = "hero-brand-subtitle-overlay";
      overlay.textContent = "淡水寵物魚工作室";
      wrapper.appendChild(overlay);
    }

    if(!document.getElementById("heqiliao-hires-hero-style")){
      const style = document.createElement("style");
      style.id = "heqiliao-hires-hero-style";
      style.textContent = `
        .hero-image-brand-wrap {
          position: relative;
          overflow: hidden;
          width: 100%;
        }
        .hero-image-brand-wrap > img {
          display: block;
          width: 100%;
          height: auto;
        }
        .hero-brand-subtitle-overlay {
          position: absolute;
          left: 24%;
          right: 24%;
          bottom: 3.8%;
          min-height: 6.2%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.15em 0.35em;
          background: rgba(248, 244, 233, 0.99);
          box-shadow: 0 0 10px 10px rgba(248, 244, 233, 0.96);
          color: #31534b;
          font-size: clamp(10px, 1.05vw, 15px);
          font-weight: 500;
          line-height: 1;
          letter-spacing: 0.22em;
          white-space: nowrap;
          pointer-events: none;
        }
        @media (max-width: 720px) {
          .hero-brand-subtitle-overlay {
            left: 20%;
            right: 20%;
            bottom: 3.6%;
            font-size: clamp(9px, 2.8vw, 13px);
            letter-spacing: 0.18em;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  document.title = "河憩寮｜寵物魚工作室";
});
