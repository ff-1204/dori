// 생리적(서카디안) 패턴 — 접속 시각에 따라 분위기를 바꾼다.
// docs/affective-design.md §2 기준. new Date()는 브라우저 런타임에서 정상 동작.
// 주의: 시간 글로우는 '분위기'만 담당. 정보색(성공/위험/강조)은 시간과 무관하게 고정한다.
import { C } from './theme.js';

// 밤은 웜·저휘도(블루라이트↓·수면 배려)로, 흔한 네온블루를 쓰지 않는다.
const PHASES = [
  { key: 'morning',   from: 5,  to: 11, label: '아침', greeting: '상쾌한 아침이에요',      mood: '차분한 활기', glow: 0xffcf8f, alpha: 0.12 },
  { key: 'noon',      from: 11, to: 14, label: '점심', greeting: '점심시간! 뭐 먹을까요?', mood: '활기',       glow: 0x9fdcff, alpha: 0.14 },
  { key: 'afternoon', from: 14, to: 17, label: '오후', greeting: '나른한 오후네요',        mood: '이완(식곤증)', glow: 0xffb27a, alpha: 0.12 },
  { key: 'evening',   from: 17, to: 21, label: '저녁', greeting: '수고한 저녁이에요',      mood: '차분',       glow: 0xb98cff, alpha: 0.13 },
  { key: 'night',     from: 21, to: 29, label: '밤',   greeting: '고요한 밤이에요',        mood: '안정(저자극)', glow: 0xd98a5a, alpha: 0.08 },
];

export function getTimePhase(hour = new Date().getHours()) {
  const h = hour < 5 ? hour + 24 : hour; // 밤(21시~다음날 5시) 구간 처리
  return PHASES.find((p) => h >= p.from && h < p.to) ?? PHASES[0];
}

// 시간대 → 식사 종류(룰렛 등 음식 관련 게임 공용)
export const MEAL_LABEL = { breakfast: '아침', lunch: '점심', dinner: '저녁' };

export function mealForPhase(phaseKey) {
  if (phaseKey === 'morning') return 'breakfast';
  if (phaseKey === 'evening' || phaseKey === 'night') return 'dinner';
  return 'lunch'; // noon, afternoon
}

// 배경 뒤(depth -10)에 시간대 글로우를 은은하게 깔고 phase를 반환한다.
export function applyTimeAtmosphere(scene) {
  const phase = getTimePhase();
  const { width, height } = scene.scale;
  const g = scene.add.graphics().setDepth(-10);
  // 상단 글로우(시간대 색) → 하단 투명(배경색 노출)
  g.fillGradientStyle(phase.glow, phase.glow, C.bg, C.bg, phase.alpha, phase.alpha, 0, 0);
  g.fillRect(0, 0, width, height);
  return phase;
}
