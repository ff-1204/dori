// 빙고판 — 랜덤 뽑기. 빙고 참가자용 5×5 카드('빙고 뽑기'의 짝 도구).
// 미국식 규칙: 열마다 구간이 정해져 있고(75면 B·I·N·G·O), 카드는 무작위 생성.
// 마킹은 사용자가 직접 탭한다 — 서버 동기화 없음(단청과 같은 원칙), 판정은 내 표시 기준임을 숨기지 않는다.
// 색상 연결: 열 색 = '빙고 뽑기'의 구간 색 5분할과 동일 — 사회자 화면의 구간 색으로 내 판의 열을 바로 찾는다.
// 진행 중 카드·표시는 localStorage에 저장 — 새로고침해도 판이 유지된다.
// 뽑기 겸하기(사회자 모드, 기본 끔): 이 폰이 숫자도 뽑는다 — 뽑는 폰도 게임에 참여할 수 있게.
//   내 카드는 자동 표시(이 폰은 뽑은 숫자를 전부 알므로 수동인 척하지 않는다 — 정직),
//   뽑은 숫자 전체는 표시 줄 탭 → 전체 숫자판 팝업으로 언제든 검증 가능.
import MiniGame from '../MiniGame.js';
import { C, css, FONT, EASE, LAYOUT, RADIUS } from '../theme.js';
import { makeButton, makeHeader, makeSubLink, makeModal, chipFlow, padHitArea } from '../ui.js';
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

// 카드 지오메트리(판 밴드 230–980 내) — 뽑기 줄 262 / 열 헤더 336 / 셀 5행 402–866(칸 104·간격 116)
const COLW = 116;
const CELL = 104;
const ROWH = 116;
const HEADER_Y = 336;
const ROW0_Y = 402;
const BOARD_CY = 634; // 셀 영역 세로 중심(연출 기준점)
const CALL_Y = 262;   // 뽑기 겸하기: 작은 공 + 진행 표시 줄(문구 190과 헤더 336 사이)

function bandRange(max, c) {
  const s = Math.ceil(max / 5);
  return [c * s + 1, Math.min((c + 1) * s, max)];
}

function bandColorOf(max, n) {
  const s = Math.ceil(max / 5);
  return BAND[Math.min(4, Math.floor((n - 1) / s))];
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
        const numsOk = st.nums.every((n, i) => {
          if (st.free && i === CENTER) return n === null;
          const [lo, hi] = bandRange(st.max, i % 5);
          if (!Number.isInteger(n) || n < lo || n > hi || seen.has(n)) return false;
          seen.add(n);
          return true;
        });
        // 뽑기 겸하기 필드는 선택(v1 저장분 호환): 불리언·범위·중복 검증, 어긋나면 안전하게 끔
        let caller = st.caller === true;
        let called = Array.isArray(st.called) ? st.called : [];
        if (!(called.length <= st.max
          && called.every((n) => Number.isInteger(n) && n >= 1 && n <= st.max)
          && new Set(called).size === called.length)) { caller = false; called = []; }
        if (numsOk) return { max: st.max, free: st.free, nums: st.nums, marks: st.marks, caller, called };
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
    this.calledView = null;
    this.boardLayer = null;
    this.callStrip = null;
    this.newArmedAt = 0;   // '새 판' 두 번 탭 확정 타이머
    this.clearArmedAt = 0; // '표시 지우기' 두 번 탭 확정 타이머
    this.toastPrev = null;

    const saved = loadState();
    this.maxN = saved ? saved.max : DEFAULT_N;
    this.free = saved ? saved.free : true; // 자유칸 기본 켬(미국식 표준)
    this.nums = saved ? [...saved.nums] : this.genCard();
    this.marks = saved ? [...saved.marks] : new Array(25).fill(false);
    this.caller = saved ? saved.caller : false; // 뽑기 겸하기(기본 끔 — 참가자용이 기본)
    this.called = saved ? [...saved.called] : []; // 뽑은 순서 그대로
    if (!saved) this.save();

    // 공통 레이아웃 그리드(LAYOUT): 헤더48 / 태그라인128 / 문구190 / 뽑기 줄262(모드) / 카드336–918 / 링크1002(±150) / 주 버튼1104
    makeHeader(this, '빙고판', '줄이 완성되면 바로 알려드려요');

    this.hint = this.add.text(this.cx, LAYOUT.msgY, '', {
      fontFamily: FONT, fontSize: '32px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.buildBoard();
    this.lines = this.lineCount();
    this.redrawLines();

    // 주 버튼·우측 링크는 모드에 따라 역할이 바뀐다(뽑기/새 판 · 새 판/표시 지우기)
    this.mainBtn = makeButton(this, {
      x: this.cx, y: LAYOUT.btnY, w: 360, h: 100, label: '새 판', variant: 'primary',
      onClick: () => (this.caller ? this.draw() : this.newCard()),
    });
    makeSubLink(this, this.cx - LAYOUT.linkDX, LAYOUT.linksY, '✎ 판 설정', () => this.openSettings());
    this.rightLink = makeSubLink(this, this.cx + LAYOUT.linkDX, LAYOUT.linksY, '⌫ 표시 지우기',
      () => (this.caller ? this.newCard() : this.clearMarks()), C.warning);

    this.refreshModeUI();
    this.updateHint();
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
    saveState({
      max: this.maxN, free: this.free, nums: this.nums, marks: this.marks,
      caller: this.caller, called: this.called,
    });
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

  // ===== 마킹(참가자 모드: 직접 탭 / 뽑기 겸하기: 자동) =====
  toggleMark(i) {
    if (this.free && i === CENTER) return; // 자유칸은 항상 채워져 있다
    if (this.caller) { this.toastHint('뽑기 모드에선 나온 숫자가 자동으로 표시돼요'); return; }
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
    else if (this.caller) this.hint.setColor(css(C.subtext)).setText('뽑기를 누르고, 나온 숫자를 불러 주세요');
    else this.hint.setColor(css(C.subtext)).setText('불린 숫자를 탭해서 표시하세요');
  }

  // ===== 뽑기 겸하기: 표시 줄(작은 공 + 진행) — 탭하면 전체 숫자판 팝업 =====
  refreshModeUI() {
    if (this.callStrip) { this.callStrip.destroy(); this.callStrip = null; }
    this.mainBtn.setLabel(this.caller ? (this.called.length >= this.maxN ? '끝!' : '뽑기') : '새 판');
    this.rightLink.setText(this.caller ? '↺ 새 판' : '⌫ 표시 지우기');
    padHitArea(this.rightLink);
    if (!this.caller) return;

    this.callStrip = this.add.container(0, 0);
    this.callBall = this.add.circle(250, CALL_Y, 40, C.surface).setStrokeStyle(4, C.surfaceAlt);
    this.callBallText = this.add.text(250, CALL_Y, '?', {
      fontFamily: FONT, fontSize: '34px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0.5);
    this.callInfo = this.add.text(306, CALL_Y, '', {
      fontFamily: FONT, fontSize: '24px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    const hit = this.add.rectangle(385, CALL_Y, 350, 88, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => this.openCalledView());
    this.callStrip.add([this.callBall, this.callBallText, this.callInfo, hit]);
    this.refreshCallStrip();
  }

  refreshCallStrip() {
    if (!this.callStrip) return;
    const last = this.called[this.called.length - 1];
    if (last == null) {
      this.callBall.setFillStyle(C.surface).setStrokeStyle(4, C.surfaceAlt);
      this.callBallText.setText('?').setColor(css(C.subtext));
      this.callInfo.setText('아직 안 뽑았어요');
    } else {
      this.callBall.setFillStyle(bandColorOf(this.maxN, last)).setStrokeStyle(4, 0xffffff, 0.28);
      this.callBallText.setText(String(last)).setColor(css(C.bg));
      this.callInfo.setText(`${this.called.length}번째 · 남은 ${this.maxN - this.called.length} 👀`);
    }
  }

  // ===== 뽑기(겸하기 모드) — 비복원, 결과 우선 확정 후 남은 숫자만 셔플 표시(정직) =====
  draw() {
    if (this.locked) return;
    const pool = [];
    for (let n = 1; n <= this.maxN; n += 1) if (!this.called.includes(n)) pool.push(n);
    if (!pool.length) { this.toastHint('모든 숫자가 나왔어요 — ↺ 새 판을 눌러 주세요'); return; }
    this.lock();
    this.mainBtn.disableButton();
    this.toastPrev = null;
    this.newArmedAt = 0;

    const result = this.rng.pick(pool);
    this.callBallText.setColor(css(C.text));
    let step = 0;
    const steps = 6;
    this.time.addEvent({
      delay: 60,
      repeat: steps - 1,
      callback: () => {
        step += 1;
        if (step === steps) { this.revealCall(result); return; }
        this.callBallText.setText(String(this.rng.pick(pool)));
        if (step % 2 === 1) Sfx.play('tick');
      },
    });
  }

  revealCall(n) {
    this.called.push(n);
    const col = bandColorOf(this.maxN, n);
    this.refreshCallStrip();
    this.callBall.setScale(0.7);
    this.callBallText.setScale(0.7);
    this.tweens.add({ targets: [this.callBall, this.callBallText], scale: 1, duration: 280, ease: EASE.popIn });

    // 내 카드에 있으면 자동 표시 — 이 폰은 뽑은 숫자를 전부 알므로 수동인 척하지 않는다(정직)
    const i = this.nums.indexOf(n);
    let lined = false;
    if (i >= 0) {
      this.marks[i] = true;
      this.redrawCell(i);
      const { t } = this.cells[i];
      t.setScale(0.5);
      this.tweens.add({ targets: t, scale: 1, duration: 220, delay: 100, ease: EASE.popIn });
      const cnt = this.lineCount();
      lined = cnt > this.lines;
      if (lined) this.celebrate(cnt);
      this.lines = cnt;
      this.redrawLines();
    }
    this.save();
    if (!lined) Sfx.play('pop');
    this.updateHint();
    this.mainBtn.enableButton();
    this.mainBtn.setLabel(this.called.length >= this.maxN ? '끝!' : '뽑기');
    this.unlock();
  }

  // ===== 뽑은 숫자 전체 팝업(검증용 — "그 숫자 나왔었나?") =====
  openCalledView() {
    if (this.calledView || this.locked) return;
    const { width, height } = this.scale;
    const cols = 10;
    const colW = 60;
    const rowH = 46;
    const rows = Math.ceil(this.maxN / cols);
    const ph = rows * rowH + 170;
    const py = Math.round(640 - ph / 2);
    const px = 40;
    const pw = width - px * 2;

    this.calledView = this.add.container(0, 0).setDepth(120);
    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.72).setOrigin(0).setInteractive();
    dim.on('pointerup', () => this.closeCalledView());
    this.calledView.add(dim);
    const panel = this.add.graphics();
    panel.fillStyle(C.surface, 1).fillRoundedRect(px, py, pw, ph, RADIUS);
    panel.lineStyle(2, C.surfaceAlt, 1).strokeRoundedRect(px, py, pw, ph, RADIUS);
    this.calledView.add(panel);
    this.calledView.add(this.add.text(this.cx, py + 46, `뽑은 숫자 ${this.called.length}개 · 남은 ${this.maxN - this.called.length}개`, {
      fontFamily: FONT, fontSize: '30px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5));

    const calledSet = new Set(this.called);
    const last = this.called[this.called.length - 1];
    const x0 = this.cx - ((cols - 1) * colW) / 2;
    const y0 = py + 106;
    for (let n = 1; n <= this.maxN; n += 1) {
      const x = x0 + ((n - 1) % cols) * colW;
      const y = y0 + Math.floor((n - 1) / cols) * rowH;
      const hit2 = calledSet.has(n);
      const col = bandColorOf(this.maxN, n);
      const c = this.add.circle(x, y, 20, hit2 ? col : C.surface);
      if (!hit2) c.setStrokeStyle(2, C.surfaceAlt);
      this.calledView.add(c);
      this.calledView.add(this.add.text(x, y, String(n), {
        fontFamily: FONT, fontSize: '18px', color: css(hit2 ? C.bg : C.subtext), fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(hit2 ? 1 : 0.75));
      if (n === last) this.calledView.add(this.add.circle(x, y, 25).setStrokeStyle(3, C.text));
    }

    const close = this.add.text(this.cx, py + ph - 40, '✕ 닫기', {
      fontFamily: FONT, fontSize: '26px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on('pointerup', () => this.closeCalledView());
    padHitArea(close);
    this.calledView.add(close);

    this.calledView.setAlpha(0);
    this.tweens.add({ targets: this.calledView, alpha: 1, duration: 160, ease: 'Quad.easeOut' });
  }

  closeCalledView() {
    if (!this.calledView) return;
    this.calledView.destroy();
    this.calledView = null;
  }

  // 뒤로가기·⬅·ESC의 '위 레이어부터 닫기' — 팝업이 열려 있으면 팝업만 닫는다
  closeTopLayer() {
    if (this.calledView) { this.closeCalledView(); return true; }
    return super.closeTopLayer();
  }

  // ===== 새 판 · 표시 지우기(두 번 탭 확정 — 진행 중 오조작 방어) =====
  newCard() {
    if (this.locked) return;
    const now = this.time.now;
    if (now - this.newArmedAt < 1600) {
      this.newArmedAt = 0;
      this.nums = this.genCard();
      this.marks = new Array(25).fill(false);
      this.called = [];
      this.save();
      this.buildBoard();
      this.lines = 0;
      this.refreshCallStrip();
      this.mainBtn.setLabel(this.caller ? '뽑기' : '새 판');
      this.updateHint();
      Sfx.play('pop');
    } else {
      this.newArmedAt = now;
      this.toastHint(this.caller
        ? '한 번 더 누르면 새 판 — 카드·뽑기 기록이 초기화돼요'
        : '한 번 더 누르면 새 판 — 숫자가 바뀌어요');
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

  // ===== 판 설정(범위 프리셋 + 자유칸 + 뽑기 겸하기 — 범위·자유칸은 바꾸면 새 판) =====
  openSettings() {
    if (this.settingsModal || this.locked) return;
    const modal = makeModal(this, {
      title: '판 설정',
      note: '범위·자유칸을 바꾸면 새 판이 돼요',
      py: 300,
      ph: 620,
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
    chip.gapRow();
    // 뽑기 겸하기: 이 폰으로 숫자도 뽑는다(뽑는 폰도 게임 참여) — 켜면 표시가 자동이라 초기화
    chip(this.caller ? '🔢 뽑기 겸하기 켬' : '🔢 뽑기 겸하기 끔',
      this.caller ? { fill: C.warning, textColor: C.bg } : { outline: true, color: C.warning },
      () => this.toggleCaller());
  }

  applySettings(max, free) {
    // 같은 설정 재선택은 진행 중인 판을 지우지 않는다(닫기만)
    if (max !== this.maxN || free !== this.free) {
      this.maxN = max;
      this.free = free;
      this.nums = this.genCard();
      this.marks = new Array(25).fill(false);
      this.called = [];
      this.save();
      this.buildBoard();
      this.lines = 0;
      this.refreshCallStrip();
      this.updateHint();
      Sfx.play('pop');
    }
    if (this.settingsModal) { this.settingsModal.destroy(); this.settingsModal = null; }
  }

  toggleCaller() {
    this.caller = !this.caller;
    if (this.caller) {
      // 켜기: 지금까지의 콜을 이 폰이 모르므로 표시·기록을 새로 시작(자동 표시의 정직성 유지)
      this.marks = new Array(25).fill(false);
      this.called = [];
      for (let i = 0; i < 25; i += 1) this.redrawCell(i);
      this.lines = this.lineCount();
      this.redrawLines();
    }
    // 끄기: 카드·표시는 그대로 — 지금부터 직접 탭으로 이어간다(뽑기 기록만 잠듦)
    this.save();
    this.refreshModeUI();
    this.updateHint();
    Sfx.play('pop');
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
