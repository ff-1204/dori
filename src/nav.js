// 뒤로가기 내비게이션 — 브라우저/OS 뒤로가기(popstate)와 씬 전환을 잇는다.
// 게임 진입 시 히스토리에 한 칸 쌓아, 모바일 백 제스처·브라우저 뒤로가기가
// '사이트 이탈'이 아니라 '허브로 복귀'가 되게 한다(허브에서는 평소처럼 나감).
// 부가로 해시 딥링크(#roulette 등)로 특정 게임에 바로 진입할 수 있다.

const GAME_KEYS = ['Roulette', 'Ladder', 'Pinball', 'Team', 'Draw', 'Lotto', 'Russian', 'Croco', 'PopUp', 'Dancheong'];

let phaserGame = null;
let pendingDeepLink = null;

export function initNav(game) {
  phaserGame = game;

  // 진입 시 URL 해시가 게임을 가리키면 딥링크로 예약(허브가 뜬 뒤 소비)
  const h = (location.hash || '').slice(1).toLowerCase();
  pendingDeepLink = GAME_KEYS.find((k) => k.toLowerCase() === h) ?? null;

  window.addEventListener('popstate', (ev) => {
    if (!phaserGame) return;
    const scenes = phaserGame.scene.getScenes(true);
    const inGame = scenes.find((s) => GAME_KEYS.includes(s.scene.key));
    if (inGame) {
      // 뒤로: 게임 → 허브 (연타는 leaving 가드가 흡수)
      if (!inGame.leaving) {
        inGame.leaving = true;
        inGame.scene.start('Hub');
      }
      return;
    }
    // 앞으로(브라우저 forward): 허브에서 게임 상태로 복귀
    const key = ev.state && ev.state.dori;
    const hub = scenes.find((s) => s.scene.key === 'Hub');
    if (hub && GAME_KEYS.includes(key) && !hub.leaving) {
      hub.leaving = true;
      hub.scene.start(key);
    }
  });
}

// 게임 진입 시 호출 — 히스토리에 게임 상태를 쌓는다
export function pushGameState(key) {
  try { history.pushState({ dori: key }, '', `#${key.toLowerCase()}`); } catch (e) { /* 무시 */ }
}

// 인게임 ⬅ 버튼 — 쌓아둔 히스토리를 소비(popstate 경유)해 브라우저 스택과 화면을 일치시킨다
export function goBackToHub(scene) {
  if (scene.navBack || scene.leaving) return; // 연타 가드
  scene.navBack = true;
  if (history.state && history.state.dori) history.back();
  else { scene.leaving = true; scene.scene.start('Hub'); } // 히스토리가 없으면 직접 전환(폴백)
}

// 허브 진입 시 딥링크 소비 — 남은 해시는 지워 스택을 깨끗하게 유지
export function consumeDeepLink() {
  const key = pendingDeepLink;
  pendingDeepLink = null;
  if (key) {
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* 무시 */ }
  }
  return key;
}
