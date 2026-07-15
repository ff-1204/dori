# CLAUDE.md

Claude Code가 이 저장소에서 작업할 때 따르는 가이드입니다. 세션마다 자동으로 로드됩니다.

## 프로젝트 개요

`dori` — **결정 돕기 · 랜덤 뽑기 · 복불복**을 모두 포괄하는 Phaser 3 기반 캐주얼 **미니게임 컬렉션 사이트**. 빌드 도구 없이 GitHub Pages로 배포됩니다.

- 배포 주소: https://ff-1204.github.io/dori/
- 원격: https://github.com/ff-1204/dori.git

## ⭐ 설계 최우선 원칙

모든 설계·구현 결정은 **게이미피케이션 + 어포던스**를 최우선한다.
다른 문서의 기법이 이와 충돌하면 [docs/design-principles.md](docs/design-principles.md)를 따르고, 충돌 기법은 수정/삭제한다.

- **어포던스**: 조작은 눌러/돌려 보이게(시그니파이어), 화면과 결과는 일치(정직한 매핑), 즉각·정직한 피드백.
- **게이미피케이션**: 명확한 목표·피드백 루프·몰입(Flow)·내재적 동기. 다크 패턴/기만/중독 유도 금지.

## 문서 (작업 시 참고 및 갱신)

작업 내용이 아래 영역에 영향을 주면 **해당 문서를 함께 업데이트**합니다.

| 문서 | 내용 |
|------|------|
| [docs/design-principles.md](docs/design-principles.md) | ⭐ **최우선** — 게이미피케이션·어포던스 |
| [docs/affective-design.md](docs/affective-design.md) | 감성 설계 — 심리·생리(시간) 패턴, 색채·감정·서카디안 |
| [docs/git.md](docs/git.md) | Git 저장소·커밋 컨벤션·워크플로 |
| [docs/development.md](docs/development.md) | 기술 스택·구조·로컬 실행·배포 |
| [docs/game.md](docs/game.md) | 게임 컨셉·현재 상태·로드맵 |
| [docs/trend-research.md](docs/trend-research.md) | 장르 트렌드 조사(사다리·돌림판·복불복·플링코)와 기능 번역 |
| [docs/game-theory.md](docs/game-theory.md) | 난수·확률·공정성·긴장 설계 등 공통 게임 이론 |
| [docs/game-mechanics.md](docs/game-mechanics.md) | 룰렛·사다리·핀볼·러시안룰렛 등 게임별 메커니즘 |
| [docs/visual-polish.md](docs/visual-polish.md) | 시각 마감·체감 품질(팔레트·간격·이징·지각된 성능) |
| [docs/responsive-design.md](docs/responsive-design.md) | 멀티 디바이스(데스크톱·모바일·태블릿)·입력 방식·터치 타깃 |
| [docs/workflow.md](docs/workflow.md) | 개발 워크플로·릴리스 절차·확립된 규칙(어떻게 일하는가) |
| [docs/commercial.md](docs/commercial.md) | 상업화·광고 규칙(라이선스·개인정보·광고 설계·호스팅) |
| [docs/licenses.md](docs/licenses.md) | 서드파티 라이선스 기록(상업 사용 점검) |

> **원칙: 앞으로의 작업은 관련 문서에 계속 기록합니다.**
> 예) 기능 추가 → `docs/game.md`의 상태/로드맵 갱신, 구조 변경 → `docs/development.md` 갱신,
> Git 규칙 변경 → `docs/git.md` 갱신.
> 사용자에게 보이는 **의미 있는 변화가 쌓이면 `CHANGELOG.md`에 릴리스 단위로 정리**하고,
> 프로젝트 소개가 바뀌면 `README.md`도 함께 갱신한다.

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

## 상업 안전 (개발 중 상시)

이 프로젝트는 **상업용**(추후 광고). 개발 내내 지킨다 — 자세한 규칙 [docs/commercial.md](docs/commercial.md).

- 서드파티(라이브러리·폰트·에셋)는 **상업 허용 라이선스만**(MIT/Apache/BSD/ISC/CC0/OFL/CC-BY). GPL·AGPL·CC BY-NC·CC BY-SA·저작권 불명 **금지**.
- 추가하는 **즉시** [docs/licenses.md](docs/licenses.md)에 기록.
- **브랜드/상표/저작 음악·이미지** 무단 사용 금지(메뉴는 일반명만).
- 자체 라이선스는 **독점**(`LICENSE`, All Rights Reserved) — 오픈소스 라이선스로 되돌리지 않는다.
