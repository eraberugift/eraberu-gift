// public/js/loading.js

const SRC = '/assets/loadinggift.lottie';
const host = document.getElementById('playerHost');
const hint = document.getElementById('hint');
const show = msg => (hint.textContent = msg || '');

// =====================
// Lottie プレイヤー部分
// =====================
async function initLottie() {
  // 1) ファイルの存在確認
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

  // 2) Lottie プレイヤーを読み込んで表示
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

      // 再生速度を少しゆっくりに
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
// 「…」のテキストアニメ
// =====================
function initDots() {
  const dotsEl = document.querySelector('.dots');
  if (!dotsEl) return;

  let step = 0;
  setInterval(() => {
    step = (step + 1) % 4;          // 0,1,2,3
    dotsEl.textContent = '.'.repeat(step);
  }, 400);                          // 0.4秒ごとに更新
}

// =====================
// ページ読み込み時
// =====================
function init() {
  initLottie();
  initDots();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
