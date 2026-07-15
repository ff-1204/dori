# Git 가이드

이 프로젝트의 Git 사용 규칙을 정리한 문서입니다. 작업 방식이 바뀌면 이 문서에 계속 기록합니다.

## 저장소

- 원격: `https://github.com/ff-1204/dori.git`
- 기본 브랜치: `main`
- 배포: `main` 브랜치 루트 → GitHub Pages (`https://ff-1204.github.io/dori/`)

## 커밋 메시지 컨벤션

**Conventional Commits + 한국어 설명**, `Co-Authored-By` 트레일러는 넣지 않습니다.

형식:

```
<타입>: <한국어 설명>

<본문 (선택, 무엇을/왜 변경했는지)>
```

타입 목록:

| 타입 | 용도 |
|------|------|
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `docs` | 문서 변경 |
| `style` | 포맷팅 등 동작에 영향 없는 변경 |
| `refactor` | 리팩터링 |
| `perf` | 성능 개선 |
| `test` | 테스트 추가/수정 |
| `chore` | 빌드/설정 등 잡무 |
| `build` | 빌드 시스템/의존성 |
| `ci` | CI 설정 |

예시:

```
feat: 매치-3 스왑 로직 추가
fix: 타일 리스폰 시 각도 초기화 누락 수정
docs: 게임 로드맵 업데이트
```

## 워크플로

1. `main`에서 직접 작업(현재는 단독 개발이라 브랜치 전략 없음)
2. 변경 → **커밋 전 상업 컴플라이언스 3문 점검**([commercial.md](./commercial.md) "개발 중 상시 준수 수칙") → `git add` → 위 컨벤션으로 커밋
3. `git push` → 약 20초 후 GitHub Pages 자동 반영

> 서드파티(라이브러리·폰트·에셋)를 추가한 커밋이라면, **상업 허용 라이선스인지 + `docs/licenses.md`에 기록했는지**를 먼저 확인한다.

## 로컬 Git 설정

이 저장소에 한해 다음으로 설정되어 있습니다(전역 설정은 없음):

```
user.name  = ff-1204
user.email = myesung12@gmail.com
```
