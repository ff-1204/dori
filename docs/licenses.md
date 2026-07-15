# 서드파티 라이선스 기록

상업적 사용 가능 여부를 릴리스 전에 점검하기 위한 목록. 새 라이브러리·폰트·에셋을 도입하면 여기에 추가한다.
규칙은 [commercial.md](./commercial.md) §1 참고.

> **프로젝트 자체 라이선스**는 독점(All Rights Reserved) — 루트 `LICENSE` 참고. 무단 복제·재호스팅 금지.
> 아래는 dori가 **사용하는** 서드파티의 라이선스다(별개).

## 라이브러리

| 항목 | 버전 | 라이선스 | 상업 사용 | 출처 |
|------|------|----------|-----------|------|
| Phaser | 3.80.1 | MIT | ✅ | https://github.com/phaserjs/phaser (CDN: jsdelivr) |
| qrcode-generator | 1.4.4 | MIT | ✅ | https://github.com/kazuhikoarase/qrcode-generator (CDN: jsdelivr) — QR 접속 모달용 |

## 폰트

| 항목 | 라이선스 | 상업 사용 | 비고 |
|------|----------|-----------|------|
| Pretendard | OFL 1.1 | ✅ | 폰트 파일 미번들, CSS 폰트 스택으로 참조(설치 시 사용) |
| Noto Sans KR | OFL 1.1 | ✅ | 폴백 |
| 시스템 sans-serif | — | ✅ | 최종 폴백 |

> 현재 폰트 파일을 저장소에 포함하지 않는다. 웹폰트를 실제로 번들/호스팅하려면 OFL 조건(파일 동봉·표기)을 지킨다.

## 이미지 / 사운드 / 아트

| 항목 | 라이선스 | 상업 사용 | 출처 |
|------|----------|-----------|------|
| assets/og.png (링크 미리보기 이미지) | 자체 제작 | ✅ | PowerShell System.Drawing 스크립트로 생성(외부 소재 없음) |
| 효과음 전체 | 자체 생성 | ✅ | Web Audio 합성(`src/sfx.js`), 외부 음원 없음 |

> 실제 에셋을 추가하면 각 항목의 출처·라이선스·URL을 반드시 기록한다.
