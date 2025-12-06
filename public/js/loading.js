// public/js/loading.js

const SRC = '../assets/loadinggift.lottie';

const host = document.getElementById('playerHost');
const hint = document.getElementById('hint');
const show = msg => {
  if (hint) hint.textContent = msg || '';
};

// =====================
// ▼▼▼ Lottie プレイヤー部分（完全に元のまま・変更なし）
// =====================
async function initLottie() {
  try {
    const r = await fetch(SRC, { method: 'HEAD' });
    if (!r.ok) {
      show(`❌ ファイルが見つかりません (${r.status})`);
      console.error(`Failed to fetch ${SRC}: ${r.status}`);
      return;
    }
    console.log('✅ .lottie ファイル確認OK');
  } catch (e) {
    show('❌ ファイルにアクセスできません');
    console.error('File check error:', e);
    return;
  }

  try {
    await import('https://unpkg.com/@dotlottie/player-component@2.7.12/dist/dotlottie-player.mjs');

    const player = document.createElement('dotlottie-player');
    player.setAttribute('src', SRC);
    player.setAttribute('autoplay', '');
    player.setAttribute('loop', '');
    player.setAttribute('background', 'transparent');
    player.style.width = 'min(300px, 60vw)';
    player.style.height = 'min(300px, 60vw)';
    player.style.display = 'block';

    host.replaceChildren(player);

    player.addEventListener('ready', () => {
      console.log('✅ Lottie animation ready');
      show('');

      try {
        player.speed = 0.5;
        if (typeof player.setSpeed === 'function') player.setSpeed(0.5);

        setTimeout(() => {
          const lottie = player.getLottie && player.getLottie();
          if (lottie && typeof lottie.setSpeed === 'function') {
            lottie.setSpeed(0.5);
          }
        }, 100);
      } catch (e) {
        console.error('Speed setting error:', e);
      }
    });

    player.addEventListener('error', e => {
      show('❌ アニメーションの読み込みに失敗しました');
      console.error('Player error:', e);
    });

    console.log('✅ Player mounted to DOM');
  } catch (e) {
    show('❌ Lottieライブラリの読み込みに失敗しました');
    console.error('Import error:', e);
  }
}

// =====================
// 「…」アニメーション
// =====================
function initDots() {
  const dotsEl = document.querySelector('.dots');
  if (!dotsEl) return;

  let step = 0;
  setInterval(() => {
    step = (step + 1) % 4;
    dotsEl.textContent = '.'.repeat(step);
  }, 400);
}

// ===============================================================
// ▼▼▼ OGP 完了を Sheets で確認 → データを取得 → localStorage 保存 → confirm へ
// ===============================================================
async function checkStatusAndLoad() {
  const params = new URLSearchParams(location.search);
  const catalogId = params.get("id") || localStorage.getItem("catalogId");
  const rawUrlCount = localStorage.getItem("urlCount");
  const urlCount = rawUrlCount ? Number(rawUrlCount) : null;

  if (!catalogId || !urlCount) {
    alert("エラーが発生しました。最初からやり直してください。");
    location.href = "create.html";
    return;
  }

  console.log("👀 Loading... catalogId =", catalogId, "urlCount =", urlCount);

  const MAX_RETRY = 10;   // 3秒×10回 = 30秒
  const WAIT_MS   = 3000;

  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {

    try {
      // ▼ Google Sheets （ogp_status）を読む
      const statusRes = await fetch(`/api/sheets/ogp_status/${catalogId}`);
      const statusJson = await statusRes.json();

      console.log("📦 statusJson =", statusJson);

      if (!statusJson.success) throw new Error("ogp_status read failed");

      const s = statusJson.status;

      const doneCount =
      (String(s.item1).trim() === "done") +
      (String(s.item2).trim() === "done") +
      (String(s.item3).trim() === "done");


      console.log(`📝 Attempt ${attempt}: done=${doneCount}/${urlCount}`);


      // ▼ 一致 → confirm.html に進む
      if (doneCount === urlCount) {
        console.log("🎉 全ての OGP が完了！");

        // ▼ 商品の本データを Sheets から読み込む（items_output）
        const sheetRes = await fetch(`/api/sheets/catalog/${catalogId}`);
        const sheetData = await sheetRes.json();

        if (!sheetData.success) {
          alert("商品データの取得に失敗しました。");
          location.href = "giveselect.html";
          return;
        }

        const c = sheetData.catalog;

        console.log("📦 c =", c);

        // ▼ localStorage に保存（confirm.html が読む）
        const newDraft = {
          catalogId,
          perUrl: {
            slot1: { url: "", title: c.gift1_title, desc: c.gift1_desc400, imgData: c.gift1_img },
            slot2: { url: "", title: c.gift2_title, desc: c.gift2_desc400, imgData: c.gift2_img },
            slot3: { url: "", title: c.gift3_title, desc: c.gift3_desc400, imgData: c.gift3_img }
          }
        };

        localStorage.setItem("giftDraft_enriched_v1", JSON.stringify(newDraft));

        // ▼ confirm.html へ遷移
        location.href = `confirm.html?id=${catalogId}`;
        return;
      }

    } catch (e) {
      console.error("❌ Polling error:", e);
    }

    // ▼ まだ揃っていない → 3秒待つ
    await new Promise(res => setTimeout(res, WAIT_MS));
  }

  // ▼ 30秒経っても揃わない
  alert("商品情報の取得に時間がかかっています。もう一度お試しください。");
  location.href = "giveselect.html";
}

// =====================
// 初期化
// =====================
function init() {
  initLottie();  // ← 一切触らない
  initDots();
  checkStatusAndLoad(); // ← ここが新しい判定ロジック
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
