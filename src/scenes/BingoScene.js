// 빙고 뽑기 — 랜덤 뽑기. 빙고 진행자용 숫자 콜(비복원 추첨).
// 정직한 비복원: 나온 숫자는 판에 그대로 칠해져 남아, 지나간 숫자를 누구나 확인할 수 있다.
// 진행 중인 판은 localStorage에 저장 — 실수로 새로고침해도 판이 날아가지 않는다(실제 진행 방어).
// 색상 연결: 숫자 구간(5분할) 색 = 큰 공 색 = 판 칸 색 = 폭발 색.
//            최대 75면 구간이 15개씩 — 미국식 빙고의 B·I·N·G·O 열과 일치한다.
import MiniGame from '../MiniGame.js';
import { C, css, FONT, EASE, LAYOUT } from '../theme.js';
import { makeButton, makeHeader, makeSubLink, makeModal, chipFlow, openTextInput, closeTextInput } from '../ui.js';
import { Sfx } from '../sfx.js';

const LS_KEY = 'dori.bingo';
const MIN_N = 10;
const MAX_N = 99;
const DEFAULT_N = 75; // 미국식 빙고 기본
const PRESETS = [25, 30, 50, 75, 90];
// 구간 색 5종(팔레트 내) — subtext(회색)는 축하 색으로 어색해 보라로 대체
const BAND = [C.warning, C.primary, C.danger, C.success, 0xc77dff];

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      // 손상 데이터 방어: 범위·정수·중복을 검증해 통과분만 복원
      if (s && Number.isInteger(s.max) && s.max >= MIN_N && s.max <= MAX_N
        && Array.isArray(s.order) && s.order.length <= s.max
        && s.order.every((n) => Number.isInteger(n) && n >= 1 && n <= s.max)
        && new Set(s.order).size === s.order.length) {
        return { max: s.max, order: s.order };
      }
    }
  } catch (e) { /* 무시 */ }
  return null;
}

function saveState(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) { /* 무시 */ }
}

export default class BingoScene extends MiniGame {
  constructor() {
    super('Bingo');
  }

  onCreate() {
    this.cx = this.scale.width / 2;
    this.inputOverlay = null; // 재진입 시 stale 참조 초기화
    this.rangeModal = null;
    this.gridLayer = null;
    this.resetArmedAt = -Infinity; // '새 판' 두 번 탭 확정 타이머 — 0이면 기동 1.6초 안 첫 탭이 확정으로 오인된다
    this.toastPrev = null;

    const saved = loadState();
    this.maxN = saved ? saved.max : DEFAULT_N;
    this.order = saved ? [...saved.order] : []; // 나온 순서 그대로(몇 번째 숫자인지 확인 가능)
    this.drawn = new Set(this.order);

    // 공통 레이아웃 그리드(LAYOUT): 헤더48 / 태그라인128 / 문구190 / 큰 공(y330)+판(중심 y715) / 링크1002(±150) / 주 버튼1104
    makeHeader(this, '빙고 뽑기', '나온 숫자는 판에 그대로 남아요');

    this.hint = this.add.text(this.cx, LAYOUT.msgY, '', {
      fontFamily: FONT, fontSize: '32px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.buildBall();
    this.buildGrid();

    this.drawBtn = makeButton(this, {
      x: this.cx, y: LAYOUT.btnY, w: 360, h: 100, label: '뽑기', variant: 'primary',
      onClick: () => this.draw(),
    });
    makeSubLink(this, this.cx - LAYOUT.linkDX, LAYOUT.linksY, '✎ 범위 설정', () => this.openRange());
    makeSubLink(this, this.cx + LAYOUT.linkDX, LAYOUT.linksY, '↺ 새 판', () => this.resetGame(), C.warning);

    this.refreshStatus(true);
  }

  // 구간 색: 전체를 5등분해 같은 구간 = 같은 색(최대 75면 15개씩 — B·I·N·G·O 열과 일치)
  bandColor(n) {
    const size = Math.ceil(this.maxN / 5);
    return BAND[Math.min(4, Math.floor((n - 1) / size))];
  }

  // ===== 큰 공(현재 숫자) =====
  buildBall() {
    this.ball = this.add.container(this.cx, 330);
    this.ballBg = this.add.circle(0, 0, 80, C.surface).setStrokeStyle(5, C.surfaceAlt);
    this.ballText = this.add.text(0, 0, '?', {
      fontFamily: FONT, fontSize: '72px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0.5);
    this.ball.add([this.ballBg, this.ballText]);
  }

  setBall(n) {
    if (n == null) {
      this.ballBg.setFillStyle(C.surface).setStrokeStyle(5, C.surfaceAlt);
      this.ballText.setText('?').setColor(css(C.subtext));
    } else {
      this.ballBg.setFillStyle(this.bandColor(n)).setStrokeStyle(5, 0xffffff, 0.28);
      this.ballText.setText(String(n)).setColor(css(C.bg));
    }
  }

  // ===== 숫자 판(전체 상시 표시 — 정직한 비복원) =====
  buildGrid() {
    if (this.gridLayer) this.gridLayer.destroy();
    this.gridLayer = this.add.container(0, 0);
    this.cells = [];
    const cols = 10;
    const colW = 64;
    const rowH = 52;
    const rows = Math.ceil(this.maxN / cols);
    const x0 = this.cx - ((cols - 1) * colW) / 2;
    const startY = 715 - ((rows - 1) * rowH) / 2; // 판 영역 세로 중앙 정렬(행 수 1–10 가변)

    for (let n = 1; n <= this.maxN; n += 1) {
      const i = n - 1;
      const x = x0 + (i % cols) * colW;
      const y = startY + Math.floor(i / cols) * rowH;
      const c = this.add.circle(x, y, 23, C.surface).setStrokeStyle(2, C.surfaceAlt);
      const t = this.add.text(x, y, String(n), {
        fontFamily: FONT, fontSize: '20px', color: css(C.subtext), fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0.8);
      this.gridLayer.add(c);
      this.gridLayer.add(t);
      this.cells.push({ c, t, x, y });
    }
    // 마지막 나온 숫자 표시 링(하나가 옮겨 다닌다)
    this.lastRing = this.add.circle(0, 0, 29).setStrokeStyle(4, C.text).setVisible(false);
    this.gridLayer.add(this.lastRing);
    // 복원: 이미 나온 숫자를 판에 그대로 칠한다
    this.order.forEach((n) => this.markCell(n));
  }

  markCell(n) {
    const cell = this.cells[n - 1];
    const col = this.bandColor(n);
    cell.c.setFillStyle(col).setStrokeStyle(2, col);
    cell.t.setColor(css(C.bg)).setAlpha(1);
  }

  // 상태 문구·버튼 라벨·공·링을 현재 판에 맞춘다(진입 복원 포함)
  refreshStatus(initial = false) {
    const left = this.maxN - this.order.length;
    if (!this.order.length) {
      this.setBall(null);
      this.lastRing.setVisible(false);
      this.hint.setColor(css(C.subtext)).setText('뽑기를 누르면 숫자가 하나 나와요');
      this.drawBtn.setLabel('뽑기');
      return;
    }
    const last = this.order[this.order.length - 1];
    this.setBall(last);
    const cell = this.cells[last - 1];
    this.lastRing.setPosition(cell.x, cell.y).setVisible(true);
    if (initial) {
      this.hint.setColor(css(C.subtext))
        .setText(`이어서 뽑을 수 있어요 (나온 ${this.order.length} · 남은 ${left})`);
    }
    this.drawBtn.setLabel(left === 0 ? '끝!' : '또 뽑기');
  }

  // ===== 뽑기 =====
  draw() {
    if (this.locked) return;
    const pool = [];
    for (let n = 1; n <= this.maxN; n += 1) if (!this.drawn.has(n)) pool.push(n);
    if (!pool.length) { this.toastHint('모든 숫자가 나왔어요 — ↺ 새 판을 눌러 주세요'); return; }
    this.lock();
    this.drawBtn.disableButton();
    this.toastPrev = null; // 대기 중 토스트 복원이 이번 결과 문구를 덮지 않게
    this.resetArmedAt = 0; // '새 판' 확정 대기 해제

    const result = this.rng.pick(pool); // 결과 우선 확정 — 셔플 표시는 연출일 뿐(정직한 매핑)
    // 빌드업: 남은 숫자들 사이를 빠르게 오간다(실제 후보만 표시 — 정직)
    this.ballText.setColor(css(C.text));
    let step = 0;
    const steps = 9;
    this.time.addEvent({
      delay: 60,
      repeat: steps - 1,
      callback: () => {
        step += 1;
        if (step === steps) { this.reveal(result); return; }
        this.ballText.setText(String(this.rng.pick(pool)));
        if (step % 2 === 1) Sfx.play('tick');
      },
    });
  }

  reveal(n) {
    this.order.push(n);
    this.drawn.add(n);
    saveState({ max: this.maxN, order: this.order });

    const col = this.bandColor(n);
    const left = this.maxN - this.order.length;

    // 큰 공: 구간 색으로 팝(색상 연결)
    this.setBall(n);
    this.ball.setScale(0.7);
    this.tweens.add({ targets: this.ball, scale: 1, duration: 320, ease: EASE.popIn });

    // 판: 그 칸이 칠해지며 팝, 마지막 링 이동
    this.markCell(n);
    const cell = this.cells[n - 1];
    this.lastRing.setPosition(cell.x, cell.y).setVisible(true);
    cell.c.setScale(0);
    cell.t.setScale(0);
    this.tweens.add({ targets: [cell.c, cell.t], scale: 1, duration: 300, delay: 120, ease: EASE.popIn });

    this.burst(this.cx, 330, col, left === 0 ? 40 : 22);
    this.colorFlash(col, 150);
    Sfx.play(left === 0 ? 'win' : 'pop'); // 매 콜은 pop, 마지막 숫자만 win(Peak-End)

    this.hint.setColor(css(col)).setText(left === 0
      ? `${n}! 마지막 숫자예요 — 모두 나왔어요`
      : `${n} 나왔어요!  (${this.order.length}번째 · 남은 ${left})`);
    this.hint.setScale(0);
    this.tweens.add({ targets: this.hint, scale: 1, duration: 260, ease: EASE.bounce });

    this.drawBtn.setLabel(left === 0 ? '끝!' : '또 뽑기');
    this.drawBtn.enableButton();
    this.unlock();
  }

  // ===== 새 판(두 번 탭 확정 — 진행 중 판 오조작 방어) =====
  resetGame() {
    if (this.locked) return;
    if (!this.order.length) { this.toastHint('이미 새 판이에요'); return; }
    const now = this.time.now;
    if (now - this.resetArmedAt < 1600) {
      this.resetArmedAt = -Infinity;
      this.applyReset();
    } else {
      this.resetArmedAt = now;
      this.toastHint('한 번 더 누르면 새 판을 시작해요');
    }
  }

  applyReset() {
    this.order = [];
    this.drawn = new Set();
    saveState({ max: this.maxN, order: [] });
    this.toastPrev = null;
    this.buildGrid();
    this.refreshStatus();
    Sfx.play('pop');
  }

  // ===== 범위 설정(최대 숫자 10–99 — 바꾸면 새 판) =====
  openRange() {
    if (this.rangeModal || this.locked) return;
    const modal = makeModal(this, {
      title: '숫자 범위 설정',
      note: `최대 숫자를 고르세요 (${MIN_N}–${MAX_N}) · 바꾸면 새 판`,
      py: 320,
      ph: 560,
      onDone: () => { closeTextInput(this); this.rangeModal.destroy(); this.rangeModal = null; },
    });
    this.rangeModal = modal.root;
    this.rangeNote = modal.noteText;
    const chip = chipFlow(this, modal.chipsBox, modal.chips);
    PRESETS.forEach((n) => {
      const cur = n === this.maxN;
      chip(cur ? `1–${n} ✓` : `1–${n}`,
        cur ? { fill: C.primary, textColor: C.bg } : { outline: true },
        () => this.applyRange(n));
    });
    chip.gapRow();
    chip('직접 입력', { outline: true, color: C.warning }, () => {
      openTextInput(this, {
        // 참가자 빙고판은 5×5가 성립하는 값만 만들 수 있다 — 판을 함께 쓸 계획이면 여기서 미리 알린다
        title: '최대 숫자', hint: `${MIN_N}–${MAX_N} 사이 · 빙고판도 쓰려면 25 이상`, inputmode: 'numeric', maxLength: 2,
        onSubmit: (raw) => {
          const v = parseInt(raw.trim(), 10);
          if (!Number.isInteger(v) || v < MIN_N || v > MAX_N) {
            this.flashRangeNote(`${MIN_N}–${MAX_N} 사이 숫자로 적어 주세요`);
            return;
          }
          this.applyRange(v);
        },
      });
    });
  }

  applyRange(v) {
    // 같은 값 재선택은 진행 중인 판을 지우지 않는다(닫기만)
    if (v !== this.maxN) {
      this.maxN = v;
      this.order = [];
      this.drawn = new Set();
      saveState({ max: v, order: [] });
      this.buildGrid();
      this.refreshStatus();
      Sfx.play('pop');
    }
    if (this.rangeModal) { this.rangeModal.destroy(); this.rangeModal = null; }
  }

  flashRangeNote(msg) {
    if (!this.rangeNote) return;
    this.rangeNote.setText(msg).setColor(css(C.warning));
    this.time.delayedCall(1400, () => {
      if (this.rangeNote && this.rangeNote.active) {
        this.rangeNote.setText(`최대 숫자를 고르세요 (${MIN_N}–${MAX_N}) · 바꾸면 새 판`).setColor(css(C.subtext));
      }
    });
  }

  // 잠깐 안내를 보였다가 원래 문구(결과 포함)로 복원
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
