// 광고/수익화 슬롯 — docs/commercial.md 기준. 현재 미연결(no-op).
// Google H5 Games Ads(HTML5 게임용 전면·보상형, AdSense/Ad Manager 기반) 어댑터 자리만 마련.
// 원칙: 플레이 중 삽입 금지 · 경계(결과 후/허브 복귀)에서만 · 보상형은 자발적만 · 다크패턴 금지.
//
// [활성화 절차]
//  1) 커스텀 도메인 + 상업 허용 호스팅으로 이전, AdSense 승인, 동의(CMP) 구비
//  2) index.html의 H5 Games Ads 스크립트 주석 해제 + ca-pub-XXXX 교체
//  3) 아래 AdConfig.enabled = true, provider = 'google-h5', client 설정

export const AdConfig = {
  enabled: false,                     // 전역 스위치(준비 완료 전까지 false)
  provider: 'none',                   // 'none' | 'google-h5'
  client: 'ca-pub-XXXXXXXXXXXXXXXX',  // AdSense 퍼블리셔 ID(승인 후 교체)
  interstitialEvery: 3,               // N판마다 전면광고(빈도 제한)
};

let _playsSinceAd = 0;

// H5 Games Ads API(adBreak)가 로드되고 활성화됐는지
function h5Ready() {
  return (
    AdConfig.enabled &&
    AdConfig.provider === 'google-h5' &&
    typeof window !== 'undefined' &&
    typeof window.adBreak === 'function'
  );
}

// 경계(결과 후/허브 복귀)에서 호출. 미연결 시 즉시 false → 게임 흐름 방해 없음.
// 반환: 광고를 실제 노출했는지(boolean) Promise.
export function maybeShowInterstitial({ onPause, onResume } = {}) {
  _playsSinceAd += 1;
  if (!h5Ready() || _playsSinceAd < AdConfig.interstitialEvery) return Promise.resolve(false);
  _playsSinceAd = 0;
  return new Promise((resolve) => {
    window.adBreak({
      type: 'next', // 플레이 사이 전면광고
      beforeAd: () => onPause && onPause(),
      afterAd: () => onResume && onResume(),
      adBreakDone: () => resolve(true), // 실패/차단이어도 resolve → 게임 계속
    });
  });
}

// 자발적 보상형. 시청 완료 시에만 보상 지급(resolve(true)).
export function showRewarded({ onPause, onResume } = {}) {
  if (!h5Ready()) return Promise.resolve(false);
  return new Promise((resolve) => {
    let earned = false;
    window.adBreak({
      type: 'reward',
      beforeAd: () => onPause && onPause(),
      afterAd: () => onResume && onResume(),
      beforeReward: (showAdFn) => showAdFn(),
      adViewed: () => { earned = true; },
      adDismissed: () => { earned = false; },
      adBreakDone: () => resolve(earned),
    });
  });
}
