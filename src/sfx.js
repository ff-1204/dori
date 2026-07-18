// 효과음 — Web Audio 합성(외부 에셋 없음 → 라이선스 무관, docs/commercial.md).
// 기본값 꺼짐. 설정은 localStorage('dori.sound')에 저장, 허브의 🔇/🔊 토글로 변경.
// AudioContext는 사용자 입력 후 첫 재생 시 생성(브라우저 자동재생 정책 준수).

const LS_KEY = 'dori.sound';

let ctx = null;
let enabled = false;
try { enabled = localStorage.getItem(LS_KEY) === 'on'; } catch (e) { /* 무시 */ }

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// 단일 톤(주파수 슬라이드 지원)
function tone({ freq = 440, to = null, dur = 0.12, type = 'sine', gain = 0.14, delay = 0 }) {
  const a = ac();
  const t0 = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

// 노이즈 버스트(빵/쾅)
function noise({ dur = 0.28, gain = 0.28, delay = 0 }) {
  const a = ac();
  const t0 = a.currentTime + delay;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(g).connect(a.destination);
  src.start(t0);
}

const SOUNDS = {
  tap: () => tone({ freq: 700, dur: 0.05, type: 'square', gain: 0.07 }),        // 버튼/누르기
  tick: () => tone({ freq: 1250, dur: 0.03, type: 'square', gain: 0.05 }),      // 핀 히트/찰칵
  pop: () => tone({ freq: 420, to: 880, dur: 0.12, type: 'sine', gain: 0.14 }), // 등장/출발
  win: () => {                                                                   // 당첨(도–미–솔)
    tone({ freq: 523, dur: 0.1, type: 'triangle', gain: 0.16 });
    tone({ freq: 659, dur: 0.1, type: 'triangle', gain: 0.16, delay: 0.09 });
    tone({ freq: 784, dur: 0.16, type: 'triangle', gain: 0.16, delay: 0.18 });
  },
  bang: () => {                                                                  // 빵/쾅/펑
    noise({ dur: 0.3, gain: 0.3 });
    tone({ freq: 150, to: 55, dur: 0.3, type: 'sine', gain: 0.3 });
  },
  fail: () => {                                                                  // 꽝(하강 개그 톤 — 유쾌하게)
    tone({ freq: 330, to: 262, dur: 0.16, type: 'triangle', gain: 0.15 });
    tone({ freq: 262, to: 175, dur: 0.24, type: 'triangle', gain: 0.15, delay: 0.15 });
  },
};

export const Sfx = {
  isEnabled() { return enabled; },
  setEnabled(v) {
    enabled = !!v;
    try { localStorage.setItem(LS_KEY, enabled ? 'on' : 'off'); } catch (e) { /* 무시 */ }
  },
  play(name) {
    if (!enabled || !SOUNDS[name]) return;
    try { SOUNDS[name](); } catch (e) { /* 오디오 불가 환경 무시 */ }
  },
};
