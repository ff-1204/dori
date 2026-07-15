// 로또 번호 추첨 — 랜덤 뽑기. 1~45에서 6개(줄당), 최대 5줄.
// 규칙: 추첨은 매 정각(매시 00분) 한 번 — 뽑은 번호는 다음 정각까지 기록·유지(localStorage).
// 법·윤리: "모든 조합의 확률은 같다"를 화면에 고지(당첨 보장·확률 향상 암시 금지),
//          재추첨 시각은 정적 표기(초읽기 카운트다운 금지 — 도박적 긴급함 배제).
// 공 색은 공식 로또 색 구간(1-10 노랑, 11-20 파랑, 21-30 빨강, 31-40 회색, 41-45 초록)을 팔레트로 매핑.
import MiniGame from '../MiniGame.js';
import { C, css, FONT, EASE } from '../theme.js';
import { makeButton } from '../ui.js';
import { Sfx } from '../sfx.js';

const LS_KEY = 'dori.lotto';
const MIN_LINES = 1;
const MAX_LINES = 5;
const LINE_LABELS = ['A', 'B', 'C', 'D', 'E'];
const SITE_URL = 'https://ff-1204.github.io/dori/';

const HOUR_MS = 60 * 60 * 1000;
const hourWindow = (now = Date.now()) => Math.floor(now / HOUR_MS);

// 공식 로또 색 구간 → 팔레트 매핑
function ballColor(n) {
  if (n <= 10) return C.warning;
  if (n <= 20) return C.primary;
  if (n <= 30) return C.danger;
  if (n <= 40) return C.subtext;
  return C.success;
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.lines)) return s;
    }
  } catch (e) { /* 무시 */ }
  return null;
}

function saveState(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) { /* 무시 */ }
}

export default class LottoScene extends MiniGame {
  constructor() {
    super('Lotto');
  }

  onCreate() {
    const { width } = this.scale;
    this.cx = width / 2;

    const saved = loadState();
    this.lines = saved ? saved.lines : [];
    this.lineCount = saved ? Math.min(Math.max(saved.count || 1, MIN_LINES), MAX_LINES) : 1;
    this.drawnHour = saved ? saved.hour : null;

    this.add.text(this.cx, 140, '로또 번호 추첨', {
      fontFamily: FONT, fontSize: '48px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(this.cx, 196, '이번 주, 당신의 여섯 숫자', {
      fontFamily: FONT, fontSize: '26px', color: css(C.subtext),
    }).setOrigin(0.5);

    this.linesLayer = this.add.container(0, 0);

    this.buildLineControls();

    this.hint = this.add.text(this.cx, 1000, '', {
      fontFamily: FONT, fontSize: '25px', color: css(C.subtext), fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);

    this.drawBtn = makeButton(this, {
      x: this.cx, y: 1100, w: 360, h: 100, label: '추첨', variant: 'primary',
      onClick: () => this.draw(),
    });

    // 복사 · 공유(하단 보조 액션)
    this.copyBtn = this.add.text(this.cx - 140, 1206, '📋 복사', {
      fontFamily: FONT, fontSize: '30px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.copyBtn.on('pointerover', () => this.copyBtn.setColor(css(C.primary)));
    this.copyBtn.on('pointerout', () => this.copyBtn.setColor(css(C.subtext)));
    this.copyBtn.on('pointerup', () => this.copyNumbers());

    this.shareBtn = this.add.text(this.cx + 140, 1206, '공유 ↗', {
      fontFamily: FONT, fontSize: '30px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.shareBtn.on('pointerover', () => this.shareBtn.setColor(css(C.primary)));
    this.shareBtn.on('pointerout', () => this.shareBtn.setColor(css(C.subtext)));
    this.shareBtn.on('pointerup', () => this.shareNumbers());

    this.renderLines();
    this.refreshLockState();
  }

  isLocked() {
    return this.drawnHour !== null && this.drawnHour === hourWindow();
  }

  nextHourLabel() {
    const d = new Date((hourWindow() + 1) * HOUR_MS);
    return `${String(d.getHours()).padStart(2, '0')}:00`;
  }

  refreshLockState() {
    if (this.isLocked()) {
      this.drawBtn.disableButton();
      this.drawBtn.setLabel('추첨 완료');
      this.hint.setColor(css(C.subtext));
      this.hint.setText(`이 번호와 함께 — 다음 추첨은 ${this.nextHourLabel()}부터\n모든 조합의 확률은 같아요`);
    } else {
      this.drawBtn.enableButton();
      this.drawBtn.setLabel('추첨');
      this.hint.setColor(css(C.subtext));
      this.hint.setText('추첨은 매 정각 한 번\n모든 조합의 확률은 같아요 — 재미로 즐겨 주세요');
    }
  }

  // ===== 줄 수 조절 (－ n줄 ＋) =====
  buildLineControls() {
    const y = 880;
    const mk = (x, label, onTap) => {
      const t = this.add.text(x, y, label, {
        fontFamily: FONT, fontSize: '36px', color: css(C.primary), fontStyle: 'bold',
      }).setOrigin(0.5);
      const hit = this.add.rectangle(x, y, 88, 88, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerup', onTap);
      return t;
    };
    mk(this.cx - 130, '－', () => this.changeLines(-1));
    mk(this.cx + 130, '＋', () => this.changeLines(1));
    this.lineCountText = this.add.text(this.cx, y, `${this.lineCount}줄`, {
      fontFamily: FONT, fontSize: '34px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5);
  }

  changeLines(delta) {
    if (this.locked) return;
    if (this.isLocked()) { this.toastHint('줄 수는 다음 정각부터 바꿀 수 있어요'); return; }
    const next = Phaser.Math.Clamp(this.lineCount + delta, MIN_LINES, MAX_LINES);
    if (next === this.lineCount) return;
    this.lineCount = next;
    this.lineCountText.setText(`${this.lineCount}줄`);
    this.renderLines();
    Sfx.play('tap');
  }

  // ===== 번호 표시 =====
  renderLines() {
    this.linesLayer.removeAll(true);
    const startY = 310;
    const gapY = 95;
    const ballR = 32;
    const firstX = 168;
    const gapX = 88;

    for (let li = 0; li < this.lineCount; li += 1) {
      const y = startY + li * gapY;
      const label = this.add.text(84, y, LINE_LABELS[li], {
        fontFamily: FONT, fontSize: '30px', color: css(C.subtext), fontStyle: 'bold',
      }).setOrigin(0.5);
      this.linesLayer.add(label);

      const nums = this.lines[li];
      for (let bi = 0; bi < 6; bi += 1) {
        const x = firstX + bi * gapX;
        if (nums && nums[bi] != null) {
          const n = nums[bi];
          const color = ballColor(n);
          const ball = this.add.circle(x, y, ballR, color);
          const txt = this.add.text(x, y, String(n).padStart(2, '0'), {
            fontFamily: FONT, fontSize: '26px', color: css(C.bg), fontStyle: 'bold',
          }).setOrigin(0.5);
          this.linesLayer.add(ball);
          this.linesLayer.add(txt);
        } else {
          const empty = this.add.circle(x, y, ballR).setStrokeStyle(3, C.surfaceAlt);
          const q = this.add.text(x, y, '?', {
            fontFamily: FONT, fontSize: '26px', color: css(C.subtext), fontStyle: 'bold',
          }).setOrigin(0.5);
          this.linesLayer.add(empty);
          this.linesLayer.add(q);
        }
      }
    }
  }

  // ===== 추첨 =====
  draw() {
    if (this.locked || this.isLocked()) return;
    this.lock();
    this.drawBtn.disableButton();

    // 줄마다 1~45에서 비복원 6개(Fisher-Yates 셔플 후 앞 6개, 오름차순)
    this.lines = [];
    for (let li = 0; li < this.lineCount; li += 1) {
      const pool = Array.from({ length: 45 }, (_, i) => i + 1);
      this.rng.shuffle(pool);
      this.lines.push(pool.slice(0, 6).sort((a, b) => a - b));
    }
    this.drawnHour = hourWindow();
    saveState({ lines: this.lines, hour: this.drawnHour, count: this.lineCount });

    // 공이 줄·칸 순서로 통통 등장(스태거)
    this.renderLines();
    const balls = this.linesLayer.list.filter((o) => o.type === 'Arc' || o.type === 'Text');
    this.linesLayer.list.forEach((o) => { o.setScale(0); });
    this.linesLayer.list.forEach((o, i) => {
      this.tweens.add({
        targets: o, scale: 1, duration: 260, delay: 40 * Math.floor(i / 2), ease: EASE.popIn,
        onStart: () => { if (i % 26 === 0) Sfx.play('tick'); },
      });
    });

    const total = this.lineCount * 13 * 40 + 400;
    this.time.delayedCall(total, () => {
      this.burst(this.cx, 520, C.warning, 30);
      this.colorFlash(C.primary, 150);
      Sfx.play('win');
      this.unlock();
      this.refreshLockState();
    });
  }

  // ===== 복사 · 공유 =====
  numbersText() {
    if (!this.lines.length) return null;
    const rows = this.lines.map((nums, i) => `${LINE_LABELS[i]}  ${nums.map((n) => String(n).padStart(2, '0')).join(' ')}`);
    return rows.join('\n');
  }

  async copyNumbers() {
    const text = this.numbersText();
    if (!text) { this.toastHint('먼저 추첨해 주세요'); return; }
    try {
      await navigator.clipboard.writeText(text);
      this.toastHint('번호가 복사됐어요');
      Sfx.play('pop');
    } catch (e) {
      this.toastHint('복사에 실패했어요');
    }
  }

  async shareNumbers() {
    const text = this.numbersText();
    if (!text) { this.toastHint('먼저 추첨해 주세요'); return; }
    const body = `오늘의 여섯 숫자 🎱\n${text}\n${SITE_URL}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'dori 로또 번호', text: body }); } catch (e) { /* 취소 */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(body);
      this.toastHint('공유 문구가 복사됐어요');
    } catch (e) {
      this.toastHint('공유에 실패했어요');
    }
  }

  toastHint(msg) {
    const prev = this.hint.text;
    const prevColor = this.hint.style.color;
    this.hint.setColor(css(C.warning)).setText(msg);
    this.time.delayedCall(1400, () => {
      if (this.hint && this.hint.active) {
        this.hint.setColor(prevColor).setText(prev);
      }
    });
  }
}
