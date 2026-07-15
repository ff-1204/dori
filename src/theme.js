// 디자인 토큰 — docs/visual-polish.md 팔레트·간격·이징 기준.
// 모든 씬/컴포넌트는 이 값을 공유해 일관성을 유지한다.

// 팔레트(숫자형: Graphics/도형 fill용)
export const C = {
  bg: 0x12131c,
  surface: 0x1d1f2b,
  surfaceAlt: 0x2a2f42,
  text: 0xf2f3f7,
  subtext: 0x8b90a8,
  primary: 0x6cc7ff,
  success: 0x06d6a0,
  warning: 0xffd166,
  danger: 0xff6b6b,
};

// 룰렛 등 여러 칸을 칠할 때 쓰는 강조색 순환(팔레트 내에서만)
export const SLICE = [C.primary, C.success, C.warning, C.danger];

// 참가자 식별색(사다리 등 다인 게임, 최대 6명) — 색상 연결(visual-polish §3-1a)용
export const PLAYER = [C.primary, C.success, C.warning, C.danger, 0xc77dff, 0xff9f6c];

// 숫자 색 → CSS 문자열(Text color용)
export const css = (n) => `#${n.toString(16).padStart(6, '0')}`;

// 폰트(웹폰트 미설치 시 시스템 폴백)
export const FONT = 'Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

// 8pt 간격 스케일
export const SP = { xs: 8, sm: 16, md: 24, lg: 32, xl: 48, xxl: 64 };

// 이징 기본값(docs/visual-polish.md 표)
export const EASE = {
  popIn: 'Back.easeOut',
  popOut: 'Back.easeIn',
  spin: 'Cubic.easeOut',
  bounce: 'Bounce.easeOut',
  move: 'Quad.easeInOut',
};

export const RADIUS = 16;
