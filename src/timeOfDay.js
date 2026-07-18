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
  const h = hour < 5 ? hour + 24 : hour; // 밤(21시–다음날 5시) 구간 처리
  return PHASES.find((p) => h >= p.from && h < p.to) ?? PHASES[0];
}

// 시간대별 인사말 10종 — 평안한 마음이 들도록, 각 시간대의 무드에 맞춰(affective-design §2)
const GREETINGS = {
  morning: [
    '상쾌한 아침이에요',
    '오늘 하루도 가볍게 시작해요',
    '천천히, 나답게 출발해요',
    '아침 공기처럼 맑은 하루 되세요',
    '좋은 일이 먼저 찾아오는 아침',
    '서두르지 않아도 괜찮아요',
    '따뜻한 한 잔과 함께 시작해요',
    '오늘의 첫 결정, 여기서 가볍게',
    '햇살만큼 부드러운 하루 되기를',
    '차분하게, 그리고 힘차게',
  ],
  noon: [
    '점심시간! 뭐 먹을까요?',
    '맛있는 한 끼가 오후를 바꿔요',
    '고민은 짧게, 식사는 든든하게',
    '잠깐 쉬어 가도 좋은 시간이에요',
    '오늘 점심은 즐거운 쪽으로',
    '햇살 좋은 한낮, 기분 좋은 선택',
    '든든하게 먹고 다시 가벼워져요',
    '좋아하는 메뉴가 기다리고 있어요',
    '한 끼의 행복, 생각보다 커요',
    '천천히 씹고 천천히 웃어요',
  ],
  afternoon: [
    '나른한 오후네요',
    '잠깐의 쉼이 오후를 살려요',
    '커피 한 잔 하기 좋은 시간',
    '조금 느려도 잘 가고 있어요',
    '오후 햇살처럼 포근하게',
    '남은 하루도 부드럽게 흘러가길',
    '어깨 한번 펴고, 숨 한번 크게',
    '작은 결정 하나로 기분 전환',
    '지금 이대로도 충분해요',
    '달콤한 게 필요한 시간이에요',
  ],
  evening: [
    '수고한 저녁이에요',
    '오늘도 잘 해냈어요',
    '이제 나를 위한 시간이에요',
    '저녁의 여유를 천천히 즐겨요',
    '고생한 만큼 맛있는 걸 먹어요',
    '하루의 무게, 여기 내려놓아요',
    '노을처럼 편안한 저녁 되세요',
    '좋은 사람과 좋은 한 끼 하세요',
    '내일 걱정은 내일에게 맡겨요',
    '느긋하게, 오늘을 마무리해요',
  ],
  night: [
    '고요한 밤이에요',
    '오늘 하루도 무사히 도착했어요',
    '마음을 천천히 내려놓는 시간',
    '별처럼 조용한 밤 되세요',
    '애쓴 하루, 참 잘했어요',
    '포근한 이불 같은 밤이 되기를',
    '생각이 많다면 잠시 쉬어가요',
    '밤바람처럼 마음도 선선하게',
    '내일은 내일의 빛이 있어요',
    '편안한 꿈으로 이어지길',
  ],
};

// FNV-1a — 단청과 같은 결정적 해시. KST 1시간 창 기준으로 회전(같은 시간엔 모두 같은 문구).
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function greetingForPhase(phase) {
  const list = GREETINGS[phase.key] ?? [phase.greeting];
  const windowId = Math.floor((Date.now() + 9 * 3600 * 1000) / 3600000);
  return list[fnv1a(`인사|${phase.key}|${windowId}`) % list.length];
}

// 시간대 → 식사 종류(룰렛 등 음식 관련 게임 공용)
export const MEAL_LABEL = { breakfast: '아침', lunch: '점심', dinner: '저녁', latenight: '야식' };

export function mealForPhase(phaseKey) {
  if (phaseKey === 'morning') return 'breakfast';
  if (phaseKey === 'evening') return 'dinner';
  if (phaseKey === 'night') return 'latenight'; // 21시–새벽 5시
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
  // 하단 비네트(깊이) — 아래로 갈수록 살짝 어두워져 상단 글로우와 짝을 이룬다
  const v = scene.add.graphics().setDepth(-9);
  v.fillGradientStyle(0x0a0b11, 0x0a0b11, 0x0a0b11, 0x0a0b11, 0, 0, 0.4, 0.4);
  v.fillRect(0, Math.floor(height * 0.6), width, Math.ceil(height * 0.4));
  return phase;
}
