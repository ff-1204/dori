# CLAUDE.md

Claude Code가 이 저장소에서 작업할 때 따르는 가이드입니다. 세션마다 자동으로 로드됩니다.

## 프로젝트 개요

`dori` — Phaser 3 기반 2D 캐주얼/퍼즐 게임. 빌드 도구 없이 GitHub Pages로 배포됩니다.

- 배포 주소: https://ff-1204.github.io/dori/
- 원격: https://github.com/ff-1204/dori.git

## 문서 (작업 시 참고 및 갱신)

작업 내용이 아래 영역에 영향을 주면 **해당 문서를 함께 업데이트**합니다.

| 문서 | 내용 |
|------|------|
| [docs/git.md](docs/git.md) | Git 저장소·커밋 컨벤션·워크플로 |
| [docs/development.md](docs/development.md) | 기술 스택·구조·로컬 실행·배포 |
| [docs/game.md](docs/game.md) | 게임 컨셉·현재 상태·로드맵 |
| [docs/game-theory.md](docs/game-theory.md) | 난수·확률·공정성·긴장 설계 등 공통 게임 이론 |
| [docs/game-mechanics.md](docs/game-mechanics.md) | 룰렛·사다리·핀볼·러시안룰렛 등 게임별 메커니즘 |

> **원칙: 앞으로의 작업은 관련 문서에 계속 기록합니다.**
> 예) 기능 추가 → `docs/game.md`의 상태/로드맵 갱신, 구조 변경 → `docs/development.md` 갱신,
> Git 규칙 변경 → `docs/git.md` 갱신.

## 커밋 규칙 (요약)

- **Conventional Commits** 형식, 설명은 **한국어**
- `Co-Authored-By` 트레일러 **넣지 않음**
- 예: `feat: 매치-3 스왑 로직 추가`

자세한 내용은 [docs/git.md](docs/git.md) 참고.

## 개발 규칙 (요약)

- Phaser 3(CDN, v3.80.1), 바닐라 JS ES 모듈, 빌드 도구 없음
- 씬은 파일당 하나, `Phaser.Scene` 상속
- 로컬 실행은 정적 서버 필요(`python -m http.server`)
- 주석은 한국어로 간결하게

자세한 내용은 [docs/development.md](docs/development.md) 참고.
