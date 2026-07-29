// 빙고판 — 랜덤 뽑기. 빙고 참가자용 5×5 카드('빙고 뽑기'의 짝 도구).
// 미국식 규칙: 열마다 구간이 정해져 있고(75면 B·I·N·G·O), 카드는 무작위 생성.
// 마킹은 사용자가 직접 탭한다 — 서버 동기화 없음(단청과 같은 원칙), 판정은 내 표시 기준임을 숨기지 않는다.
// 색상 연결: 열 색 = '빙고 뽑기'의 구간 색 5분할과 동일 — 사회자 화면의 구간 색으로 내 판의 열을 바로 찾는다.
// 진행 중 카드·표시는 localStorage에 저장 — 새로고침해도 판이 유지된다.
import MiniGame from '../MiniGame.js';
import { C, css, FONT, EASE, LAYOUT } from '../theme.js';
import { makeButton, makeHeader, makeSubLink, makeModal, chipFlow } from '../ui.js';
import { Sfx } from '../sfx.js';

const LS_KEY = 'dori.bingocard';
// 5×5 카드가 성립하는 범위만(마지막 구간에도 숫자 5개 이상) — '빙고 뽑기' 프리셋과 동일
const PRESETS = [25, 30, 50, 75, 90];
const DEFAULT_N = 75;
// 열 구간 색 — BingoScene의 구간 색 5분할과 같은 순서(색상 연결)
const BAND = [C.warning, C.primary, C.danger, C.success, 0xc77dff];
const CENTER = 12; // 가운데 칸(자유칸 위치)
// 빙고 줄 12개: 가로 5 + 세로 5 + 대각 2
const LINES = [
  [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24],
  [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24],
  [0, 6, 12, 18, 24], [4, 8, 12, 16, 20],
];

// 카드 지오메트리(판 밴드 230–980 내) — 열 헤더 336 / 셀 5행 402–866(칸 104·간격 116)
const COLW = 116;
const CELL = 104;
const ROWH = 116;
const HEADER_Y = 336;
const ROW0_Y = 402;
const BOARD_CY = 634; // 셀 영역 세로 중심(연출 기준점)

function bandRange(max, c) {
  const s = Math.ceil(max / 5);
  return [c * s + 1, Math.min((c + 1) * s, max)];
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const st = JSON.parse(raw);
      // 손상 데이터 방어: 프리셋·자유칸·카드 25칸(열 구간·중복)·표시 배열을 검증해 통과분만 복원
      if (st && PRESETS.includes(st.max) && typeof st.free === 'boolean'
        && Array.isArray(st.nums) && st.nums.length === 25
        && Array.isArray(st.marks) && st.marks.length === 25
        && st.marks.every((m) => typeof m === 'boolean')) {
        const seen = new Set();
        const ok = st.nums.every((n, i) => {
          if (st.free && i === CENTER) return n === null;
          const [lo, hi] = bandRange(st.max, i % 5);
          if (!Number.isInteger(n) || n < lo || n > hi || seen.has(n)) return false;
          seen.add(n);
          return true;
        });
        if (ok) return { max: st.max, free: st.free, nums: st.nums, marks: st.marks };
      }
    }
  } catch (e) { /* 무시 */ }
  return null;
}

function saveState(st) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch (e) { /* 무시 */ }
}

export default class BingoCardScene extends MiniGame {
  constructor() {
    super('BingoCard');
  }

  onCreate() {
    this.cx = this.scale.width / 2;
    this.settingsModal = null; // 재진입 시 stale 참조 초기화
    this.boardLayer = null;
    this.newArmedAt = 0;   // '새 판' 두 번 탭 확정 타이머
    this.clearArmedAt = 0; // '표시 지우기' 두 번 탭 확정 타이머
    this.toastPrev = null;

    const saved = loadState();
    this.maxN = saved ? saved.max : DEFAULT_N;
    this.free = saved ? saved.free : true; // 자유칸 기본 켬(미국식 표준)
    this.nums = saved ? [...saved.nums] : this.genCard();
    this.marks = saved ? [...saved.marks] : new Array(25).fill(false);
    if (!saved) this.save();

    // 공통 레이아웃 그리드(LAYOUT): 헤더48 / 태그라인128 / 문구190 / 카드(헤더336·셀402–866) / 링크1002(±150) / 주 버튼1104
    makeHeader(this, '빙고판', '줄이 완성되면 바로 알려드려요');

    this.hint = this.add.text(this.cx, LAYOUT.msgY, '', {
      fontFamily: FONT, fontSize: '32px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.buildBoard();
    this.lines = this.lineCount();
    this.redrawLines();
    this.updateHint();

    this.newBtn = makeButton(this, {
      x: this.cx, y: LAYOUT.btnY, w: 360, h: 100, label: '새 판', variant: 'primary',
      onClick: () => this.newCard(),
    });
    makeSubLink(this, this.cx - LAYOUT.linkDX, LAYOUT.linksY, '✎ 판 설정', () => this.openSettings());
    makeSubLink(this, this.cx + LAYOUT.linkDX, LAYOUT.linksY, '⌫ 표시 지우기', () => this.clearMarks(), C.warning);
  }

  // 열마다 자기 구간에서 비복원 5개(자유칸이면 가운데 열은 4개) — Fisher-Yates 셔플
  genCard() {
    const nums = new Array(25).fill(null);
    for (let c = 0; c < 5; c += 1) {
      const [lo, hi] = bandRange(this.maxN, c);
      const pool = [];
      for (let n = lo; n <= hi; n += 1) pool.push(n);
      this.rng.shuffle(pool);
      let k = 0;
      for (let r = 0; r < 5; r += 1) {
        const i = r * 5 + c;
        if (this.free && i === CENTER) continue;
        nums[i] = pool[k];
        k += 1;
      }
    }
    return nums;
  }

  save() {
    saveState({ max: this.maxN, free: this.free, nums: this.nums, marks: this.marks });
  }

  markedAt(i) {
    return (this.free && i === CENTER) || this.marks[i];
  }

  lineCount() {
    return LINES.filter((line) => line.every((i) => this.markedAt(i))).length;
  }

  // ===== 카드 =====
  buildBoard() {
    if (this.boardLayer) this.boardLayer.destroy();
    this.boardLayer = this.add.container(0, 0);
    this.cells = [];

    // 열 헤더: 구간 표기(75면 B·I·N·G·O 문자도 함께) — 열 색 = 구간 색
    for (let c = 0; c < 5; c += 1) {
      const [lo, hi] = bandRange(this.maxN, c);
      const label = (this.maxN === 75 ? `${'BINGO'[c]} ` : '') + `${lo}–${hi}`;
      this.boardLayer.add(this.add.text(this.cx + (c - 2) * COLW, HEADER_Y, label, {
        fontFamily: FONT, fontSize: '20px', color: css(BAND[c]), fontStyle: 'bold',
      }).setOrigin(0.5));
    }

    for (let i = 0; i < 25; i += 1) {
      const x = this.cx + ((i % 5) - 2) * COLW;
      const y = ROW0_Y + Math.floor(i / 5) * ROWH;
      const g = this.add.graphics();
      const t = this.add.text(x, y, '', {
        fontFamily: FONT, fontSize: '38px', fontStyle: 'bold',
      }).setOrigin(0.5);
      const hit = this.add.rectangle(x, y, CELL, CELL, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => this.toggleMark(i));
      this.boardLayer.add(g);
      this.boardLayer.add(t);
      this.boardLayer.add(hit);
      this.cells.push({ g, t, x, y });
      this.redrawCell(i);
    }

    // 완성 줄 오버레이(셀 위에 겹쳐 그린다)
    this.lineG = this.add.graphics();
    this.boardLayer.add(this.lineG);
  }

  redrawCell(i) {
    const { g, t, x, y } = this.cells[i];
    const col = BAND[i % 5];
    const marked = this.markedAt(i);
    g.clear();
    g.fillStyle(marked ? col : C.surface, 1).fillRoundedRect(x - CELL / 2, y - CELL / 2, CELL, CELL, 14);
    g.lineStyle(3, col, marked ? 1 : 0.55).strokeRoundedRect(x - CELL / 2, y - CELL / 2, CELL, CELL, 14);
    if (this.free && i === CENTER) {
      t.setText('★').setFontSize(44).setColor(css(C.bg));
    } else {
      t.setText(String(this.nums[i])).setFontSize(38).setColor(css(marked ? C.bg : col));
    }
  }

  redrawLines() {
    this.lineG.clear();
    this.lineG.lineStyle(10, C.warning, 0.5);
    LINES.forEach((line) => {
      if (!line.every((i) => this.markedAt(i))) return;
      const a = this.cells[line[0]];
      const b = this.cells[line[4]];
      this.lineG.lineBetween(a.x, a.y, b.x, b.y);
    });
  }

  // ===== 마킹 =====
  toggleMark(i) {
    if (this.free && i === CENTER) return; // 자유칸은 항상 채워져 있다
    this.marks[i] = !this.marks[i];
    this.save();
    this.redrawCell(i);
    if (this.marks[i]) {
      const { t } = this.cells[i];
      t.setScale(0.5);
      this.tweens.add({ targets: t, scale: 1, duration: 200, ease: EASE.popIn });
    }
    const n = this.lineCount();
    if (n > this.lines) this.celebrate(n);
    else if (this.marks[i]) Sfx.play('pop');
    else Sfx.play('tap');
    this.lines = n;
    this.redrawLines();
    this.updateHint();
  }

  celebrate(n) {
    const all = [...Array(25).keys()].every((i) => this.markedAt(i));
    this.burst(this.cx, BOARD_CY, C.warning, all ? 44 : 30);
    this.colorFlash(C.warning, 170);
    Sfx.play('win');
    this.hint.setScale(0);
    this.tweens.add({ targets: this.hint, scale: 1, duration: 300, ease: EASE.bounce });
  }

  updateHint() {
    const all = [...Array(25).keys()].every((i) => this.markedAt(i));
    if (all) this.hint.setColor(css(C.warning)).setText('모든 칸을 채웠어요!');
    else if (this.lines > 0) this.hint.setColor(css(C.warning)).setText(`빙고 ${this.lines}줄!`);
    else this.hint.setColor(css(C.subtext)).setText('불린 숫자를 탭해서 표시하세요');
  }

  // ===== 새 판 · 표시 지우기(두 번 탭 확정 — 진행 중 오조작 방어) =====
  newCard() {
    const now = this.time.now;
    if (now - this.newArmedAt < 1600) {
      this.newArmedAt = 0;
      this.nums = this.genCard();
      this.marks = new Array(25).fill(false);
      this.save();
      this.buildBoard();
      this.lines = 0;
      this.updateHint();
      Sfx.play('pop');
    } else {
      this.newArmedAt = now;
      this.toastHint('한 번 더 누르면 새 판 — 숫자가 바뀌어요');
    }
  }

  clearMarks() {
    if (!this.marks.some(Boolean)) { this.toastHint('지울 표시가 없어요'); return; }
    const now = this.time.now;
    if (now - this.clearArmedAt < 1600) {
      this.clearArmedAt = 0;
      this.marks = new Array(25).fill(false);
      this.save();
      for (let i = 0; i < 25; i += 1) this.redrawCell(i);
      this.lines = this.lineCount();
      this.redrawLines();
      this.updateHint();
      Sfx.play('tap');
    } else {
      this.clearArmedAt = now;
      this.toastHint('한 번 더 누르면 표시만 지워요 — 숫자는 그대로');
    }
  }

  // ===== 판 설정(범위 프리셋 + 자유칸 — 바꾸면 새 판) =====
  openSettings() {
    if (this.settingsModal) return;
    const modal = makeModal(this, {
      title: '판 설정',
      note: '범위·자유칸을 바꾸면 새 판이 돼요',
      py: 320,
      ph: 560,
      onDone: () => { this.settingsModal.destroy(); this.settingsModal = null; },
    });
    this.settingsModal = modal.root;
    const chip = chipFlow(this, modal.chipsBox, modal.chips);
    PRESETS.forEach((n) => {
      const cur = n === this.maxN;
      chip(cur ? `1–${n} ✓` : `1–${n}`,
        cur ? { fill: C.primary, textColor: C.bg } : { outline: true },
        () => this.applySettings(n, this.free));
    });
    chip.gapRow();
    chip(this.free ? '★ 자유칸 켬' : '★ 자유칸 끔',
      this.free ? { fill: C.success, textColor: C.bg } : { outline: true, color: C.success },
      () => this.applySettings(this.maxN, !this.free));
  }

  applySettings(max, free) {
    // 같은 설정 재선택은 진행 중인 판을 지우지 않는다(닫기만)
    if (max !== this.maxN || free !== this.free) {
      this.maxN = max;
      this.free = free;
      this.nums = this.genCard();
      this.marks = new Array(25).fill(false);
      this.save();
      this.buildBoard();
      this.lines = 0;
      this.updateHint();
      Sfx.play('pop');
    }
    if (this.settingsModal) { this.settingsModal.destroy(); this.settingsModal = null; }
  }

  // 잠깐 안내를 보였다가 원래 문구(빙고 줄 수 포함)로 복원
  toastHint(msg) {
    if (!this.toastPrev) this.toastPrev = { text: this.hint.text, color: this.hint.style.color };
    this.hint.setColor(css(C.warning)).setText(msg).setScale(1);
    this.time.delayedCall(1400, () => {
      if (this.hint.active && this.toastPrev) {
        this.hint.setColor(this.toastPrev.color).setText(this.toastPrev.text).setScale(1);
        this.toastPrev = null;
      }
    });
  }
}
