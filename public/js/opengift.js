// public/js/opengift.js

const SRC = '/assets/opengift.lottie';

// ★ 追加：次のページ用のURLを組み立てるヘルパー
// ★ 次のページ用のURLを組み立てるヘルパー（カレントディレクトリ基準）
function buildNextUrl() {
  const params   = new URLSearchParams(window.location.search);
  const id       = params.get('id');
  const preview  = params.get('preview');

  const nextParams = new URLSearchParams();
  if (id) {
    nextParams.set('id', id);
  }
  if (preview === '1' || preview === 'true') {
    nextParams.set('preview', '1');
  }

  // 今のパスからディレクトリ部分だけ抜き出す（例: /foo/bar/giftopen.html → /foo/bar/）
  const baseDir = window.location.pathname.replace(/[^\/]*$/, '');
  const base    = baseDir + 'messageopen.html';

  const query = nextParams.toString();
  return query ? `${base}?${query}` : base;
}


async function initLottie() {
  console.log('🔍 initLottie 開始');

  // 1) ファイルの存在チェック
  try {
    console.log('📂 ファイルチェック中:', SRC);
    const r = await fetch(SRC, { method: 'HEAD' });
    console.log('📂 レスポンス:', r.status, r.statusText);
    if (!r.ok) {
      console.error(`❌ Failed to fetch ${SRC}: ${r.status}`);
      alert(`ファイルが見つかりません: ${r.status}`);
      return;
    }
    console.log('✅ opengift.lottie 確認OK');
  } catch (e) {
    console.error('❌ File check error:', e);
    alert('ファイルチェックエラー: ' + e.message);
    return;
  }

  // 2) dotlottie-player を読み込む
  try {
    console.log('📦 Lottieライブラリ読み込み中...');
    await import('https://unpkg.com/@dotlottie/player-component@2.7.12/dist/dotlottie-player.mjs');
    console.log('✅ Lottieライブラリ読み込み完了');

    const player = document.getElementById('giftPlayer');
    const box = document.getElementById('giftBox');
    const title = document.querySelector('.title');
    const caption = document.querySelector('.caption');

    console.log('🎯 player:', player);
    console.log('🎯 box:', box);

    if (!player) {
      console.error('❌ giftPlayer が見つかりません');
      alert('giftPlayer要素が見つかりません');
      return;
    }

    if (!box) {
      console.error('❌ giftBox が見つかりません');
      alert('giftBox要素が見つかりません');
      return;
    }

    let isAnimating = false;
    let isReady = false;
    let canClick = false;

    // ready時に0フレームから80フレームまで再生
    player.addEventListener('ready', () => {
      console.log('✅ Lottie ready イベント発火');
      
      try {
        // ループと自動再生を解除
        player.removeAttribute('loop');
        player.removeAttribute('autoplay');
        
        // Lottieインスタンスを取得
        const lottie = player.getLottie();
        if (lottie) {
          const totalFrames = lottie.totalFrames;
          console.log('📊 総フレーム数:', totalFrames);
          
          // 0フレームから開始
          lottie.goToAndStop(0, true);
          
          // 正方向に設定
          lottie.setDirection(1);
          
          // 80フレーム目で停止するイベントリスナー
          let hasStoppedAt80 = false;
          const frameCheckInterval = setInterval(() => {
            const currentFrame = Math.floor(lottie.currentFrame);
            console.log('📍 現在のフレーム:', currentFrame);
            
            if (!hasStoppedAt80 && currentFrame >= 75) {
              clearInterval(frameCheckInterval);
              lottie.pause();
              lottie.goToAndStop(79, true);
              hasStoppedAt80 = true;
              canClick = true;
              console.log('⏸️ 80フレーム目で停止完了');
              
              // 文字をフェードアウト→変更→フェードイン
              changeText();
            }
          }, 16); // 約60fpsでチェック
          
          // 再生開始
          lottie.play();
          console.log('▶️ 0から80フレームまで再生開始');
          
          isReady = true;
        }
        
      } catch (e) {
        console.error('❌ ready内のエラー:', e);
        isReady = true;
      }
    });

    // 文字を変更する関数
    function changeText() {
      console.log('✨ 文字変更開始');
      
      // フェードアウト
      if (title) {
        title.style.transition = 'opacity 0.5s ease';
        title.style.opacity = '0';
      }
      if (caption) {
        caption.style.transition = 'opacity 0.5s ease';
        caption.style.opacity = '0';
      }
      
      // 0.5秒後に文字を変更してフェードイン
      setTimeout(() => {
        if (title) title.textContent = 'OPEN YOUR GIFT';
        if (caption) caption.textContent = 'タップしてプレゼントを開いてください';
        
        console.log('📝 文字変更完了');
        
        setTimeout(() => {
          if (title) title.style.opacity = '1';
          if (caption) caption.style.opacity = '1';
          console.log('✨ フェードイン完了');
        }, 50);
      }, 500);
    }

    player.addEventListener('load', () => {
      console.log('✅ Lottie load イベント発火');
    });

    player.addEventListener('error', (e) => {
      console.error('❌ Lottie error:', e);
      alert('Lottie読み込みエラー');
    });

    // ★ ここだけ変更：逆再生完了時の遷移先を、id / preview 付きで組み立てる
    player.addEventListener('complete', () => {
      console.log('✅ 逆再生完了 → 次のページへ遷移');
      const nextUrl = buildNextUrl();
      console.log('➡️ 遷移先 URL:', nextUrl);
      window.location.href = nextUrl;
    });

    /* ▼ 戻るボタン対策（キャッシュ復元を防ぎ初期状態に戻す） ▼ */
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) {
        window.location.reload();
      }
    });
    /* ▲ 戻るボタン対策 ▲ */

    // クリックで逆再生開始
    box.addEventListener('click', () => {
      console.log('👆 ボックスがクリックされました');
      
      if (!isReady || !canClick) {
        console.log('⏳ まだ準備中 (isReady:', isReady, ', canClick:', canClick, ')');
        return;
      }
      
      if (isAnimating) {
        console.log('⏳ アニメーション中のためクリック無視');
        return;
      }
      
      isAnimating = true;
      canClick = false;
      
      try {
        const lottie = player.getLottie();
        
        if (lottie) {
          // Lottieインスタンス経由で逆再生
          lottie.setDirection(-1);
          lottie.play();
          console.log('⏪ 逆再生開始（Lottie直接制御）');
        } else {
          // フォールバック: player経由
          if (typeof player.setDirection === 'function') {
            player.setDirection(-1);
          }
          player.play();
          console.log('⏪ 逆再生開始（player経由）');
        }
        
      } catch (e) {
        console.error('❌ 逆再生エラー:', e);
        isAnimating = false;
      }
    });

    console.log('🎉 初期化完了');

  } catch (e) {
    console.error('❌ Lottie import error:', e);
    alert('Lottieライブラリエラー: ' + e.message);
  }
}

// DOM 準備後に実行
function init() {
  console.log('🚀 init() 実行');
  initLottie();
}

if (document.readyState === 'loading') {
  console.log('⏳ DOMContentLoaded 待機中');
  document.addEventListener('DOMContentLoaded', init);
} else {
  console.log('✅ DOM already ready');
  init();
}
