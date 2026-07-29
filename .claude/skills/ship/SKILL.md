---
name: ship
description: dori 작업 마무리 절차 — 검산·로컬 검증·문서화까지 실행한 뒤 보고하고, 승인에 따라 커밋/푸시한다. 기능 작업을 마치고 마무리할 때 호출. (릴리스 태깅은 /release)
---

# ship — 작업 마무리 절차

workflow.md §1 파이프라인의 뒷부분(검산 이후)을 실행 체크리스트로 만든 것.
자매 프로젝트 fries-get-cold의 /ship을 dori 문화(보고·승인 분리)에 맞게 수용 (2026-07-30).

## 1. 검산 (코드를 눈으로 다시)

- 요소 **좌표 점유 범위 겹침 검사** (visual-polish 체크리스트), 레이아웃 총합 1280 예산
- 리팩터링이면: 미사용 임포트·옛 시그니처 호출부 grep
- **`grep -rn "\[임시\]" src/` = 0건** — 검증용 임시 값(디버그 기본값 등)이 남지 않았는지
- workflow.md §4 "배운 것" 표의 기존 함정 재점검 (leaving 가드, 오버레이 onCreate 초기화,
  LAYOUT 토큰·공통 컴포넌트만 사용 등)

## 2. 로컬 검증 (시각 변경 시)

- 정적 서버 + 헤드리스 Edge(720×1280) 스크린샷으로 **영향받는 씬 전부** 확인
- Node는 이 PC에 있다 — PATH만 지정: `export PATH="/c/Program Files/nodejs:$PATH"` (bash)
  / `$env:Path = "C:\Program Files\nodejs;$env:Path"` (PowerShell). `npx http-server`나
  puppeteer-core 자동화 가능 (fries-get-cold `scripts/verify.mjs` 참고 — 자동 주파·스크린샷 패턴)
- 임시 테스트 페이지·서버는 사용 후 즉시 정리

## 3. 문서화 (코드와 같은 커밋에)

- 기능/상태 → docs/game.md, 구조 → docs/development.md, 절차·새로 배운 규칙 →
  docs/workflow.md("배운 것" 표), 서드파티 → docs/licenses.md (**즉시**)
- 사용자 노출 문면이 바뀌면: 대외 워딩 규칙 점검 ('게임'·'플레이'·배너식 표현 금지 — CLAUDE.md)

## 4. 보고·확인 ← 여기서 멈춘다

- 변경 요약 + 테스트 포인트를 보고하고 **사용자 확인을 기다린다**
- 진단만 요청받았으면 "적용해줘" 전에 수정하지 않는다

## 5. 커밋 ("커밋해줘" 승인 후)

- Conventional Commits + 한국어, `Co-Authored-By` 없음
- 커밋 전 **상업 3문 점검** (docs/git.md): 서드파티 라이선스? 브랜드/상표? licenses.md 기록?

## 6. 푸시·배포 확인 ("푸시해줘" 별도 승인 후)

- 푸시 → Pages 반영 안내(약 20초–2분) → curl로 핵심 파일 라이브 반영 폴링
- 삭제한 파일은 404 확인, 띄워 둔 임시 서버·파일 정리
- 릴리스 단위면 /release 커맨드로 태깅·CHANGELOG 정리
