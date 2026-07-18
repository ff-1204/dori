# 개발 가이드

프로젝트 구조와 개발/배포 방법을 정리한 문서입니다. 구조가 바뀌면 이 문서에 계속 기록합니다.

## 기술 스택

- **Phaser 3** (v3.80.1) — CDN으로 로드, 별도 빌드 도구 없음
- **바닐라 JS (ES 모듈)** — `import`/`export` 사용
- **GitHub Pages** — 정적 호스팅, `main` 브랜치 루트에서 직접 배포

빌드 단계가 없어 파일을 푸시하면 곧바로 반영됩니다.

## 디렉터리 구조

```
dori/
├── index.html            # Phaser CDN 로드 + SEO/OG 메타 + 캔버스 컨테이너
├── README.md             # 프로젝트 소개(핵심 요약)
├── CHANGELOG.md          # 릴리즈 노트
├── robots.txt / sitemap.xml   # 검색 엔진용
├── manifest.json         # PWA 매니페스트(바로가기 설치)
├── sw.js                 # 최소 서비스워커(설치 조건용, 캐시 없음)
├── assets/
│   ├── og.png            # 링크 미리보기 이미지(자체 제작 1200×630)
│   └── icon-192/512.png  # PWA 아이콘(자체 제작 룰렛 심볼)
├── src/
│   ├── main.js           # 게임 설정 + 씬 등록
│   ├── theme.js          # 디자인 토큰(팔레트·간격·이징) — visual-polish 기준
│   ├── ui.js             # 공통 UI(어포던스 버튼·뒤로가기)
│   ├── MiniGame.js       # 미니게임 공통 베이스(FSM·시드 RNG·입력 잠금·시간 분위기·연출 헬퍼 burst/colorFlash/shake)
│   ├── timeOfDay.js      # 시간대 분위기(서카디안) — affective-design 기준
│   ├── nav.js            # 뒤로가기 통합(popstate ↔ 씬 전환) + 해시 딥링크(#roulette 등)
│   ├── ads.js            # 광고 슬롯 스텁(no-op) — commercial 기준, 미연결
│   ├── sfx.js            # 효과음(Web Audio 합성, 기본 꺼짐, 허브 🔇/🔊 토글)
│   ├── guard.js          # 도메인 잠금 가드 — 허용 호스트에서만 실행
│   └── scenes/
│       ├── BootScene.js      # 최초 초기화
│       ├── PreloadScene.js   # 에셋 로딩 + 로딩 바
│       ├── HubScene.js       # 게임 선택 허브(범주별 목록)
│       ├── RouletteScene.js  # 메뉴 룰렛(시간대별 세트 + 편집)
│       ├── LadderScene.js    # 사다리타기(참가자·결과 편집 + 프리셋)
│       ├── PinballScene.js   # 랜덤 핀볼(Arcade 물리·낙하 지점 선택)
│       ├── DrawScene.js      # 뽑기 상자(비복원 추첨)
│       ├── RussianScene.js   # 러시안 룰렛(조건부 확률 정직 표시)
│       ├── CrocoScene.js     # 악어 이빨(트리거 슬롯)
│       ├── PopUpScene.js     # 통아저씨(트리거 슬롯 + 발사)
│       ├── DancheongScene.js # 단청(결정적 해시 오라클, HTML 입력 오버레이)
│       └── LottoScene.js     # 로또 번호 추첨(정각 잠금·기록, 복사/공유)
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
# Python
python -m http.server 8000
# → http://localhost:8000

# 또는 Node가 있다면
npx serve
```

> 브라우저에서 직접 `index.html`을 여는 방식은 모듈 로딩이 실패하니 사용하지 않습니다.

## 배포

1. 변경 사항 커밋 ([git.md](./git.md) 컨벤션 준수)
2. `git push`
3. 약 20초 후 `https://ff-1204.github.io/dori/` 반영

## 바로가기 (PWA)

- `manifest.json` + 최소 `sw.js`(캐시 없음)로 설치형 웹앱 요건 충족.
- 허브 하단 **📲 바로가기** 버튼: `beforeinstallprompt`를 잡아둔 프롬프트로 즉시 설치(Chrome/안드로이드/Edge), 미지원(iOS Safari 등)은 방법 안내 모달.
- 이미 standalone 실행 중이면 안내 토스트만. 아이콘은 자체 제작 룰렛 심볼(192/512).

## 공유 · SEO

- **공유 버튼**(허브 우상단): 모바일은 `navigator.share`(네이티브 시트), 데스크톱은 클립보드 복사 + 토스트.
- **QR 모달**(허브 좌상단): `qrcode-generator`(MIT, CDN)로 접속 QR 생성 — 흰 배경 + quiet zone 확보.
- **링크 미리보기**: `index.html`에 Open Graph/Twitter 메타(제목·설명·URL·locale). `og:image`는 1200×630 제작 후 추가(TODO).
- **검색 최적화**: title/description, canonical, JSON-LD(WebApplication), `robots.txt`, `sitemap.xml`, `<noscript>` 설명 텍스트(캔버스 게임의 크롤러 대응).
- 사이트 정보(제목·설명·URL) 변경 시 **index.html 메타 + HubScene 공유 문구 + sitemap**을 함께 갱신한다.

## 멀티 디바이스 / 반응형

- 대상: **데스크톱 · 모바일 · 태블릿**.
- 기준 해상도 720×1280(세로), Phaser `Scale.FIT` + `CENTER_BOTH`([main.js](../src/main.js)).
- `index.html` 뷰포트에 `viewport-fit=cover`로 노치 안전 영역 대응.
- 좌표는 고정 px 대신 `this.scale.width/height` 기준 **상대 배치**.
- 자세한 이론·규칙(터치 타깃·안전 영역·입력 방식·방향 등)은 [responsive-design.md](./responsive-design.md).

## 코드 컨벤션

- 씬은 `Phaser.Scene`을 상속하고 파일당 하나씩 분리
- 씬 키는 문자열(`'Boot'`, `'Preload'`, `'Hub'`, 게임별 키)로 통일
- 미니게임 씬은 `MiniGame` 베이스 상속, `onCreate()`에 게임 로직 구현
- 색·간격·이징은 하드코딩 대신 `theme.js` 토큰 사용, 버튼은 `ui.js`의 `makeButton`
- 에셋이 없을 땐 `generateTexture`로 코드 생성(현재 타일 텍스처 방식)
- 좌표는 `scale.width/height` 기준 상대 배치(멀티 디바이스 대응)
- 주석은 한국어로 간결하게
