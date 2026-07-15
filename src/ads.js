// 광고/수익화 슬롯 스텁 — docs/commercial.md 기준.
// 지금은 no-op(미연결). 상업화 단계에서 실제 광고 SDK를 이 안에서 연결한다.
// 원칙: 플레이 중 삽입 금지 · 경계(결과 후/허브 복귀)에서만 · 보상형은 자발적만 · 다크패턴 금지.

export const AdConfig = {
  enabled: false, // 광고 전역 스위치(연결 전까지 false)
  interstitialEvery: 3, // N판마다 전면광고(빈도 제한)
  minGapMs: 60000, // 전면광고 최소 간격
};

let _playsSinceAd = 0;

// 경계에서 호출. 실제 SDK 연결 전까지 항상 즉시 완료(게임 흐름 방해 없음).
// 반환: 광고를 실제로 노출했는지(boolean) Promise.
export function maybeShowInterstitial() {
  if (!AdConfig.enabled) return Promise.resolve(false);
  _playsSinceAd += 1;
  if (_playsSinceAd < AdConfig.interstitialEvery) return Promise.resolve(false);
  _playsSinceAd = 0;
  // TODO: 실제 전면광고 SDK 호출(호출 전 게임은 pause 상태여야 함).
  //       광고 실패/차단 시에도 resolve 하여 게임이 계속되게 한다.
  return Promise.resolve(true);
}

// 자발적 보상형 광고. 시청 완료 시에만 보상 지급.
// 반환: 보상 지급 여부(boolean) Promise.
export function showRewarded() {
  if (!AdConfig.enabled) return Promise.resolve(false);
  // TODO: 실제 보상형 광고 SDK 호출.
  return Promise.resolve(false);
}
