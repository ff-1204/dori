---
description: 릴리스 마무리 — CHANGELOG 정리, README 정합, 버전 태깅, 배포 확인
---

dori 릴리스 절차를 수행하라. 모든 커밋은 docs/git.md 컨벤션(Conventional Commits + 한국어, Co-Authored-By 없음)을 따른다.

1. **변경분 파악**: `git describe --tags --abbrev=0`으로 마지막 태그를 찾고, `git log <태그>..HEAD --oneline`으로 이후 커밋을 검토한다.
2. **버전 결정(SemVer)**: 게임/기능 추가 = minor, 버그 수정·다듬기만 = patch, 방향 전환 = major.
3. **CHANGELOG.md**: 맨 위에 새 버전 섹션을 추가한다 — 사용자 관점의 핵심만(신규 게임 → 경험/연출 → 법적·상업 → 다듬기 순). 카피 톤 규칙(visual-polish §3-5: '무료·설치 없이' 등 금지) 준수.
4. **README.md 정합**: 게임 수·목록·특징이 현재 상태와 일치하는지 확인·갱신.
5. **사이트 문구 정합**: index.html 메타(description/og/twitter/JSON-LD)와 assets/og.png의 게임 수·문구가 일치하는지 확인. og.png 문구가 바뀌면 스크래치패드의 make-og.ps1로 재생성 후 Read로 눈검수.
6. **커밋 & 태깅**: 변경을 커밋·푸시한 뒤 `git tag -a vX.Y.Z -m "vX.Y.Z — 한 줄 요약"` → `git push origin vX.Y.Z`.
7. **GitHub Release 게시**: CHANGELOG의 해당 버전 섹션을 본문으로 릴리즈 노트를 태그에 게시한다.
   토큰은 `printf "protocol=https\nhost=github.com\n" | git credential fill`의 password를 사용, 본문 JSON은 스크래치패드 파일로 작성 후
   `curl -X POST -H "Authorization: token $token" https://api.github.com/repos/ff-1204/dori/releases -d @file.json` (`make_latest: "true"`).
8. **배포 확인**: 주요 변경 파일이 https://ff-1204.github.io/dori/ 에 반영됐는지 curl로 확인(약 20–40초 소요).
9. **결과 보고**: 버전·핵심 변경·태그/릴리즈 링크를 요약해 보고한다.
