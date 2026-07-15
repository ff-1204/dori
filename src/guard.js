// 도메인 잠금 가드 — 허용된 호스트에서만 실행(무단 재호스팅 억제).
// 소프트 보호: 클라이언트 JS라 수정으로 우회 가능하나, 게으른 복제·재배포를 막는다.
// 강한 보호는 라이선스(LICENSE, 독점)와 AdSense 도메인 허용목록·ads.txt로 보완한다.

export const GUARD_ENABLED = true;

// 허용 호스트. 커스텀 도메인으로 이전하면 여기에 추가한다.
export const ALLOWED_HOSTS = [
  'ff-1204.github.io',
  'localhost',
  '127.0.0.1',
  // 'yourdomain.com',
];

export function isAllowedHost(host) {
  const h = host ?? (typeof location !== 'undefined' ? location.hostname : '');
  if (!h) return true; // file:// 등 호스트 불명 → 개발 편의상 통과
  return ALLOWED_HOSTS.some((a) => h === a || h.endsWith(`.${a}`));
}

// 허용 호스트면 true. 아니면 차단 화면을 그리고 false.
export function enforceHostLock() {
  if (!GUARD_ENABLED || isAllowedHost()) return true;

  document.body.innerHTML = '';
  const box = document.createElement('div');
  box.style.cssText =
    'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;'
    + 'justify-content:center;background:#12131c;color:#f2f3f7;'
    + 'font-family:sans-serif;text-align:center;padding:24px;';
  box.innerHTML =
    '<h1 style="font-size:28px;margin:0 0 12px">dori</h1>'
    + '<p style="color:#8b90a8;font-size:16px;line-height:1.7;margin:0">'
    + '공식 사이트에서만 플레이할 수 있습니다.<br>Play the official version at<br>'
    + '<a style="color:#6cc7ff" href="https://ff-1204.github.io/dori/">ff-1204.github.io/dori</a>'
    + '</p>';
  document.body.appendChild(box);
  return false;
}
