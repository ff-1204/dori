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
├── index.html            # Phaser CDN 로드 + 캔버스 컨테이너
├── src/
│   ├── main.js           # 게임 설정 + 씬 등록
│   └── scenes/
│       ├── BootScene.js      # 최초 초기화
│       ├── PreloadScene.js   # 에셋 로딩 + 로딩 바 + 타일 텍스처 생성
│       ├── MenuScene.js      # 타이틀 + 시작 버튼
│       └── GameScene.js      # 게임 플레이(현재 탭 데모)
├── docs/                 # 프로젝트 문서
├── CLAUDE.md             # Claude Code 작업 가이드
├── LICENSE               # MIT
└── .gitignore
```

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

## 코드 컨벤션

- 씬은 `Phaser.Scene`을 상속하고 파일당 하나씩 분리
- 씬 키는 문자열(`'Boot'`, `'Preload'`, `'Menu'`, `'Game'`)로 통일
- 에셋이 없을 땐 `generateTexture`로 코드 생성(현재 타일 텍스처 방식)
- 주석은 한국어로 간결하게
