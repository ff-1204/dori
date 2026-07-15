// 최소 서비스워커 — PWA 설치 조건 충족용. 캐시 전략 없이 네트워크 기본 동작을 유지한다.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* respondWith 미호출 = 브라우저 기본(네트워크) 처리 */ });
