# 개발 가이드

프로젝트 구조와 개발/배포 방법을 정리한 문서입니다. 구조가 바뀌면 이 문서에 계속 기록합니다.

## 기술 스택

- **Phaser 3** (v3.80.1) — `vendor/`에서 **자체 호스팅**, 별도 빌드 도구 없음
- **바닐라 JS (ES 모듈)** — `import`/`export` 사용
- **GitHub Pages** — 정적 호스팅, `main` 브랜치 루트에서 직접 배포

빌드 단계가 없어 파일을 푸시하면 곧바로 반영됩니다.

## 디렉터리 구조

```
dori/
├── index.html            # 라이브러리 로드 + SEO/OG 메타 + 고정 바·캔버스·소개 섹션(#site-info)
├── README.md             # 프로젝트 소개(핵심 요약)
├── CHANGELOG.md          # 릴리즈 노트
├── .nojekyll             # GitHub Pages의 Jekyll 처리 끔 — docs/*.md가 HTML 페이지로 공개되는 것 방지
├── robots.txt / sitemap.xml   # 검색 엔진용(24 URL, /docs/는 Disallow)
├── about.html / faq.html / privacy.html   # 소개·FAQ·개인정보처리방침
├── guide.html + guide-<도구>.html × 12     # 도구별 사용 안내(목차 + 개별 페이지)
├── read.html + read-<주제>.html × 6        # 읽을거리 — 확률·심리 원고(편당 약 4,000자)
├── site.css              # 공통 스타일 — 고정 상단바·하단바와 본문 서식(index.html 포함 전 페이지 공유)
├── manifest.json         # PWA 매니페스트(바로가기 설치)
├── sw.js                 # 최소 서비스워커(설치 조건용, 캐시 없음)
├── assets/
│   ├── og.png            # 링크 미리보기 이미지(자체 제작 1200×630)
│   └── icon-192/512.png  # PWA 아이콘(자체 제작 룰렛 심볼)
├── vendor/               # 서드파티 라이브러리 자체 호스팅(MIT) — CDN 단일 실패점 제거
│   ├── phaser-3.80.1.min.js / qrcode-1.4.4.min.js   # 머리에 저작권 배너 유지
│   └── LICENSE-phaser.txt / LICENSE-qrcode-generator.txt  # MIT 고지 사본(번들 조건)
├── src/
│   ├── main.js           # 게임 설정 + 씬 등록
│   ├── theme.js          # 디자인 토큰(팔레트·간격·이징·씬 레이아웃 그리드 LAYOUT) — visual-polish 기준
│   ├── ui.js             # 공통 UI(버튼 makeButton·헤더 makeHeader·보조 링크 makeSubLink·모달 makeModal·칩 chipFlow·뒤로가기·입력 오버레이 openTextInput·padHitArea·클립보드 copyText[인앱 브라우저 폴백])
│   ├── MiniGame.js       # 미니게임 공통 베이스(FSM·시드 RNG·입력 잠금·시간 분위기·연출 헬퍼 burst/colorFlash/shake)
│   ├── timeOfDay.js      # 시간대 분위기(서카디안) — affective-design 기준
│   ├── nav.js            # 뒤로가기 통합(popstate ↔ 씬 전환, 열린 레이어부터 닫기 closeTopLayer) + 해시 딥링크(#roulette 등) + 허브 모달 히스토리 가드(pushLayerState/popLayerState)
│   ├── ads.js            # 광고 슬롯 스텁(no-op) — commercial 기준, 미연결
│   ├── sfx.js            # 효과음(Web Audio 합성, 기본 꺼짐, 허브 🔇/🔊 토글)
│   ├── guard.js          # 도메인 잠금 가드 — 허용 호스트에서만 실행
│   └── scenes/
│       ├── BootScene.js      # 최초 초기화
│       ├── PreloadScene.js   # 에셋 로딩 + 로딩 바
│       ├── HubScene.js       # 게임 선택 허브(범주별 목록)
│       ├── RouletteScene.js  # 메뉴 룰렛(시간대별 세트 + 편집)
│       ├── LadderScene.js    # 사다리타기(참가자 편집 + 결과 기본값, 이름·결과는 보드 더블탭 수정)
│       ├── PinballScene.js   # 랜덤 핀볼(Arcade 물리·낙하 지점 선택)
│       ├── DrawScene.js      # 뽑기 상자(비복원 추첨)
│       ├── RussianScene.js   # 러시안 룰렛(조건부 확률 정직 표시)
│       ├── CrocoScene.js     # 악어 이빨(트리거 슬롯)
│       ├── PopUpScene.js     # 해적통(트리거 슬롯 + 발사 — 구 '통아저씨', 씬 키는 유지)
│       ├── DancheongScene.js # 단청(결정적 해시 오라클, HTML 입력 오버레이)
│       ├── LottoScene.js     # 로또 추첨(정각 잠금·기록, 복사/공유)
│       └── TeamScene.js      # 조 배정(번호 셔플 + N분할 라운드로빈)
├── docs/                 # 프로젝트 문서
├── CLAUDE.md             # Claude Code 작업 가이드
├── LICENSE               # 독점(All Rights Reserved)
└── .gitignore
```

새 미니게임은 `MiniGame`을 상속한 씬을 `src/scenes/`에 추가하고, `main.js` 씬 목록과
`HubScene`의 게임 목록(`ready: true`)에 등록한다.

## 로컬 실행

ES 모듈은 `file://`에서 CORS로 막히므로 **로컬 정적 서버**가 필요합니다.

```bash
# Node (이 개발 환경 기준 — Node는 C:\Program Files\nodejs 에 있고 PATH에는 없다)
npx serve
# → http://localhost:3000

# Python이 설치된 환경이라면
python -m http.server 8000
```

> 브라우저에서 직접 `index.html`을 여는 방식은 모듈 로딩이 실패하니 사용하지 않습니다.

## 배포

1. 변경 사항 커밋 ([git.md](./git.md) 컨벤션 준수)
2. `git push`
3. 약 20초 후 `https://dori.io.kr/` 반영

## 홈 구조 (index.html)

홈은 **첫 화면 = 도리 화면(캔버스), 그 아래 = 소개 섹션**의 스크롤 페이지다(2026-08-17 B안).
고정 바·본문 서식은 다른 페이지와 같은 `site.css`를 함께 쓴다(홈만 갖고 있던 중복 CSS는 제거).

```
a.skip                 ─ 건너뛰기 링크(포커스 시에만 보임)
header.site-top (fixed 48) ─ 이름·설명·안내 5링크
main
 ├ #game  (100dvh-96)  ─ 캔버스
 └ #site-info (.wrap)  ─ 상황→도구 표, 정직한 랜덤 3원칙, 알아 두면 좋은 것, 읽을거리, 더 보기
footer.site-bottom (fixed 48) ─ '둘러보기 ↓' 조작(좌) + 저작권·오락 목적 고지(중앙)
```

- **캔버스 크기는 그대로**다 — 첫 화면 배분(48/캔버스/48)을 건드리지 않고 아래로 늘렸다. 실측 390폭 385×684, 360폭 360×640으로 개편 전과 동일.
- **`#game`은 `touch-action: none`** — 캔버스 위 터치는 전부 조작이다. 페이지 스크롤로 넘어가면 핀볼 드래그·사다리 탭이 어긋난다.
  그래서 아래로 가는 길은 **하단바의 '사이트 소개 ↓'**(앵커 링크)가 담당한다. 데스크톱은 휠로도 내려간다.
  (v0.12에서 같은 구조가 실패한 원인이 정확히 이 **도달 불가**였다 — 콘텐츠가 아니라 길이 없었다.)
- 하단바의 조작은 **절대 배치하지 않는다** — 360px에서 저작권 문구와 겹쳤다. 자리를 나눠 갖고(`flex`),
  데스크톱에서는 오른쪽에 같은 폭의 빈 칸(`.spacer`, `visibility: hidden`)을 둬 문구를 정중앙에 유지한다.
- 역할 분담: **`#site-info`는 "무엇을 정하나"**(상황→도구), **`about.html`은 "누가 만들었나·어떻게 쓰나"**.
  문장이 겹치면 중복 콘텐츠가 되므로 서로 다른 각도로 쓴다.
- **하단바는 DOM에서 소개 뒤에 온다** — 고정 배치라 보이는 자리는 그대로이고, 읽는 순서(스크린 리더·탭)만 제자리를 찾는다.
  `main`은 body가 하던 플렉스 컬럼 역할을 그대로 물려받아 첫 화면 높이 계산이 바뀌지 않는다.
- 렌더링 후 홈 본문 **82자 → 약 1,030자**(구글은 JS를 실행하므로 이 섹션이 색인된다).

### 정적 폴백은 두지 않는다 (2026-08-23 제거)

캔버스 자리에 있던 정적 폴백(`#fallback`, 2026-08-17 도입)을 없앴다.

- **이유**: 정상 이용자에게 "도리 화면을 불러오지 못했습니다"가 번쩍였다. 600ms 지연 페이드로 막으려 했지만
  Phaser(약 1MB) + 씬 로드는 그 안에 끝나지 않는 경우가 많다(실측 부팅 완료 약 1.4초).
  **잘 뜨고 있는 화면에 실패 문구를 먼저 보여 주는 것은 정직한 피드백이 아니다**([design-principles](./design-principles.md)).
- **잃는 것**: 스크립트가 안 도는 환경에서 첫 화면은 다시 빈 검은 상자가 된다. 다만 폴백 도입 **뒤에** 생긴
  소개 섹션(`#site-info`)이 같은 페이지 아래에 그대로 있어, 크롤러가 읽는 본문과 이용자가 읽을 내용은 유지된다.
- 되살린다면 **시간 지연이 아니라 실패를 감지한 뒤에만** 띄운다(부팅 타임아웃 + `window.onerror`). 추측으로 실패를 알리지 않는다.

> **AdSense '광고 설정 미리보기'의 빈 화면은 애초에 폴백으로 고쳐지지 않았다.**
> 그 도구는 페이지를 여는 게 아니라 **구글 렌더러가 JS를 실행한 뒤의 DOM을 직렬화 → `<script>` 제거 → `srcdoc` 재생**하는 구조라,
> 스냅샷 시점에 폴백은 이미 제거돼 있고 **캔버스 픽셀은 직렬화되지 않는다**. 캔버스 사이트의 공통 현상이다.
> 폴백을 캔버스 뒤에 숨겨 이를 우회하는 안은 **정직함 원칙에 어긋나 채택하지 않았다**([workflow.md](./workflow.md) §4).

## 라이브러리 자체 호스팅

Phaser와 qrcode-generator는 `vendor/`에 두고 같은 출처에서 로드한다(2026-08-17 전환).

- 이유: CDN 한 곳이 막히면 **사이트 전체가 검은 화면**이 되는 단일 실패점이었다. 자체 호스팅으로 SRI 부재 문제도 함께 사라진다.
- MIT 조건: 번들하면 CDN 원본의 고지가 사라지므로 **파일 머리에 저작권 배너**를 유지하고 `vendor/LICENSE-*.txt`에 전문을 둔다([licenses.md](./licenses.md)).
- 버전 올릴 때: 파일명에 버전을 넣어 교체(`phaser-<버전>.min.js`) → 배너 다시 붙이기 → `index.html`·licenses.md·이 문서 갱신.
- `robots.txt`에서 `/vendor/`를 **막지 않는다** — Google이 페이지를 렌더링하려면 스크립트를 가져갈 수 있어야 한다.

## 바로가기 (PWA)

- `manifest.json` + 최소 `sw.js`(캐시 없음)로 설치형 웹앱 요건 충족.
- 허브 하단 **📲 바로가기** 버튼: `beforeinstallprompt`를 잡아둔 프롬프트로 즉시 설치(Chrome/안드로이드/Edge), 미지원(iOS Safari 등)은 방법 안내 모달.
- 이미 standalone 실행 중이면 안내 토스트만. 아이콘은 자체 제작 룰렛 심볼(192/512).

## 공유 · SEO

- **공유 버튼**(허브 우상단): 모바일은 `navigator.share`(네이티브 시트), 데스크톱은 클립보드 복사 + 토스트.
- **QR 모달**(허브 좌상단): `qrcode-generator`(MIT, CDN)로 접속 QR 생성 — 흰 배경 + quiet zone 확보.
- **링크 미리보기**: **전 페이지**에 Open Graph/Twitter 메타(제목·설명·URL·locale·이미지 1200×630 + alt, `twitter:card=summary_large_image`). 페이지를 추가하면 이 묶음을 함께 넣는다.
- **구조화 데이터**: 홈 WebApplication · FAQ FAQPage · 읽을거리 Article · 도구/글 상세 **BreadcrumbList**(홈 › 사용 안내|읽을거리 › 이 문서).
- **검색 최적화**: title/description, canonical, `robots.txt`, `sitemap.xml`, 첫 화면 아래 소개 섹션(캔버스 화면의 크롤러 대응).
- 사이트 정보(제목·설명·URL) 변경 시 **index.html 메타 + HubScene 공유 문구 + sitemap**을 함께 갱신한다.

## 접근성 (정적 페이지 공통)

캔버스 안(도리 화면)은 Phaser가 그리므로 여기 규칙은 **HTML 페이지와 고정 바**에 적용된다.
새 페이지를 만들 때 이 묶음을 그대로 가져간다.

- **랜드마크**: `header.site-top` / `main.wrap#main` / `footer.site-bottom`. 페이지마다 `<main>`은 하나.
- **건너뛰기 링크**: `<body>` 첫 줄에 `<a class="skip" href="#main">본문 바로가기</a>`.
  고정 상단바의 같은 링크 5개를 매 페이지 지나야 하는 문제를 없앤다(WCAG 2.4.1).
  홈은 캔버스가 키보드 조작 대상이 아니므로 `#site-info`로 보낸다.
- **포커스 표시**: `:focus-visible`에 하늘색 링(site.css). 어두운 배경에서 브라우저 기본 링은 잘 보이지 않는다.
- **페이지 안 이동**은 스크롤과 함께 **포커스도 옮긴다**(`el.focus({preventScroll:true})`) —
  스크롤만 하면 다음 탭이 다시 상단바로 돌아가 링크가 헛돈다. 착지점에는 `tabindex="-1"`.
- **대비**: 본문·보조 텍스트 모두 4.5:1 이상. 고정 바의 12px 문구가 특히 걸리기 쉽다
  (상단바 부제 `#7a8099` 4.9:1, 하단바 `#8b90a8` 6.0:1 — 이보다 어둡게 내리지 않는다).
- **확대 허용**: 뷰포트에 `user-scalable=no`·`maximum-scale`을 쓰지 않는다.

## 멀티 디바이스 / 반응형

- 대상: **데스크톱 · 모바일 · 태블릿**.
- 기준 해상도 720×1280(세로), Phaser `Scale.FIT` + `CENTER_BOTH`([main.js](../src/main.js)).
- `index.html` 뷰포트에 `viewport-fit=cover`로 노치 안전 영역 대응.
- **확대(핀치 줌)는 막지 않는다** — 첫 화면 아래가 읽는 페이지가 된 뒤로 `user-scalable=no`는 본문 확대까지 막았다.
  캔버스 위 제스처는 `#game { touch-action: none }`이 이미 잡고 있으므로 조작은 그대로다.
- 좌표는 고정 px 대신 `this.scale.width/height` 기준 **상대 배치**.
- 자세한 이론·규칙(터치 타깃·안전 영역·입력 방식·방향 등)은 [responsive-design.md](./responsive-design.md).

## 코드 컨벤션

- 씬은 `Phaser.Scene`을 상속하고 파일당 하나씩 분리
- 씬 키는 문자열(`'Boot'`, `'Preload'`, `'Hub'`, 게임별 키)로 통일
- 미니게임 씬은 `MiniGame` 베이스 상속, `onCreate()`에 게임 로직 구현
- **씬 인스턴스는 재사용된다** — 나갔다 들어와도 인스턴스 프로퍼티가 남으므로, 게임 객체·그룹·트윈·모달을 담는 프로퍼티는 **`onCreate()` 첫머리에서 반드시 null 초기화**(파괴된 객체 재사용 시 크래시: 핀볼 pegs 사례 2026-07-22 / 가드에 걸려 기능 먹통: 허브 QR 모달 사례)
- 색·간격·이징은 하드코딩 대신 `theme.js` 토큰 사용, 버튼은 `ui.js`의 `makeButton`
- 에셋이 없을 땐 `generateTexture`로 코드 생성(현재 타일 텍스처 방식)
- 좌표는 `scale.width/height` 기준 상대 배치(멀티 디바이스 대응)
- 주석은 한국어로 간결하게
