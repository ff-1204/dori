// 최소 서비스워커 — PWA 설치 조건 충족용. 캐시 전략 없이 네트워크 기본 동작을 유지한다.
// fetch 핸들러는 두지 않는다 — 빈(no-op) 핸들러는 모든 요청에 SW 왕복 지연만 얹는 안티패턴(Chrome 권고).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
