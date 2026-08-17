const fs = require('fs');
const patch = (file, from, to) => {
  let s = fs.readFileSync(file, 'utf8');
  if (!s.includes(from)) throw new Error(file + ': 패턴 없음 — ' + from.slice(0, 40));
  fs.writeFileSync(file, s.replace(from, to));
  console.log('  ' + file + ' 갱신');
};

patch('docs/game.md', '타이틀 "dori"(104px)는', '타이틀 "dori"(**70px** — 상단 사이트 헤더가 생겨 브랜드 중복을 덜려고 2026-08-17 104→70 축소, 강조선도 비례 축소)는');

patch('docs/development.md',
  '├── index.html            # Phaser CDN 로드 + SEO/OG 메타 + 상단 헤더(.site-top)·캔버스·안내 띠(.scroll-cue)·소개 섹션(#site-info)',
  '├── index.html            # Phaser CDN 로드 + SEO/OG 메타 + 고정 상단바(.site-top)·캔버스·고정 하단바(.site-bottom)');

patch('docs/commercial-plan.md',
  '  **하단 안내 띠**(`.scroll-cue` 48px)가 "아래에 더 있다"는 시그니파이어이자 모바일에서 소개 섹션에 닿는 유일한 통로가 된다\n  (캔버스는 Phaser가 터치를 잡아 쓸어올려도 스크롤되지 않는다).\n  `#site-info` 본문은 약 250자 → **1,889자**로 확장(도구 12종 개별 설명 + 정직한 랜덤 3원칙 + 읽을거리 목록).',
  '  **하단바**(`.site-bottom` 48px)가 저작권·오락 목적 고지를 담는다.\n  홈의 소개 섹션(`#site-info`)은 2026-08-17 **`about.html`로 통합**했다 — 상단바의 "소개"와 목적지가 겹쳤기 때문.\n  소개·도구 12종 목록·읽을거리 목록은 모두 `about.html`이 담당한다(2,504자).');
