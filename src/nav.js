// 뒤로가기 내비게이션 — 브라우저/OS 뒤로가기(popstate)와 씬 전환을 잇는다.
// 게임 진입 시 히스토리에 한 칸 쌓아, 모바일 백 제스처·브라우저 뒤로가기가
// '사이트 이탈'이 아니라 '허브로 복귀'가 되게 한다(허브에서는 평소처럼 나감).
// 부가로 해시 딥링크(#roulette 등)로 특정 게임에 바로 진입할 수 있다.

const GAME_KEYS = ['Roulette', 'Ladder', 'Pinball', 'Team', 'Draw', 'Lotto', 'Bingo', 'BingoCard', 'Russian', 'Croco', 'PopUp', 'Dancheong'];

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
      // 모달·오버레이가 열려 있으면 그 레이어만 닫는다(모바일 백 제스처 기대 동작 — 위부터 닫기).
      // 소비된 게임 히스토리 한 칸은 다시 쌓아, 다음 뒤로가기가 허브 복귀로 이어지게 한다.
      if (typeof inGame.closeTopLayer === 'function' && inGame.closeTopLayer()) {
        inGame.navBack = false;
        pushGameState(inGame.scene.key);
        return;
      }
      // 뒤로: 게임 → 허브 (연타는 leaving 가드가 흡수)
      if (!inGame.leaving) {
        inGame.leaving = true;
        inGame.scene.start('Hub');
      }
      return;
    }
    const hub = scenes.find((s) => s.scene.key === 'Hub');
    // 허브 모달(QR·바로가기 안내)은 열릴 때 레이어 가드를 쌓는다(pushLayerState) —
    // 뒤로가기 = 모달 닫기(사이트 이탈 아님). 가드 한 칸은 이 pop으로 이미 소비됐다.
    if (hub && typeof hub.closeTopLayer === 'function' && hub.closeTopLayer()) return;
    const key = ev.state && ev.state.dori;
    // '앞으로'로 소비된 레이어 가드에 되돌아온 경우: 빈 엔트리를 건너뛴다(죽은 뒤로가기 1회 방지)
    if (key === 'layer') {
      try { history.back(); } catch (e) { /* 무시 */ }
      return;
    }
    // 앞으로(브라우저 forward): 허브에서 게임 상태로 복귀
    if (hub && GAME_KEYS.includes(key) && !hub.leaving) {
      hub.leaving = true;
      hub.scene.start(key);
    }
  });
}

// 게임 진입 시 호출 — 히스토리에 게임 상태를 쌓는다.
// 이미 같은 게임 엔트리 위면 중복 push하지 않는다(게임 중 새로고침 복원 시 죽은 엔트리 방지).
export function pushGameState(key) {
  try {
    if (history.state && history.state.dori === key) return;
    history.pushState({ dori: key }, '', `#${key.toLowerCase()}`);
  } catch (e) { /* 무시 */ }
}

// 인게임 ⬅ 버튼 — 쌓아둔 히스토리를 소비(popstate 경유)해 브라우저 스택과 화면을 일치시킨다
export function goBackToHub(scene) {
  if (scene.navBack || scene.leaving) return; // 연타 가드
  // 레이어(입력 오버레이 등)가 열려 있으면 ⬅도 그 레이어부터 닫는다(뒤로가기와 같은 문법)
  if (typeof scene.closeTopLayer === 'function' && scene.closeTopLayer()) return;
  scene.navBack = true;
  if (history.state && history.state.dori) history.back();
  else { scene.leaving = true; scene.scene.start('Hub'); } // 히스토리가 없으면 직접 전환(폴백)
}

// 게임 상태가 없는 화면(허브)에서 모달을 열 때 — 히스토리에 가드 한 칸을 쌓아
// 모바일 뒤로가기가 '사이트 이탈' 대신 '모달 닫기'가 되게 한다.
export function pushLayerState() {
  try { history.pushState({ dori: 'layer' }, '', location.href); } catch (e) { /* 무시 */ }
}

// 모달을 화면 버튼(✕·딤 탭)으로 닫을 때 — 쌓아둔 가드를 소비해 스택과 화면을 일치시킨다.
// 뒤로가기(popstate) 경유로 닫힐 땐 가드가 이미 소비된 뒤라 아무것도 하지 않는다.
export function popLayerState() {
  if (history.state && history.state.dori === 'layer') {
    try { history.back(); } catch (e) { /* 무시 */ }
  }
}

// 허브 진입 시 딥링크 소비 — 남은 해시는 지워 스택을 깨끗하게 유지.
// 단, 게임 중 새로고침(현재 엔트리가 이미 그 게임 state)이면 state·해시를 보존해
// 이어지는 pushGameState가 no-op으로 처리되게 한다(죽은 엔트리 방지).
export function consumeDeepLink() {
  const key = pendingDeepLink;
  pendingDeepLink = null;
  if (key && !(history.state && history.state.dori === key)) {
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* 무시 */ }
  }
  return key;
}
