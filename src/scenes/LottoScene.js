// 로또 번호 추첨 — 랜덤 뽑기. 1–45에서 6개(줄당), 최대 5줄.
// 규칙: 추첨은 매 정각(매시 00분) 한 번 — 뽑은 번호는 다음 정각까지 기록·유지(localStorage).
// 법·윤리: "모든 조합의 확률은 같다"를 화면에 고지(당첨 보장·확률 향상 암시 금지),
//          재추첨 시각은 정적 표기(초읽기 카운트다운 금지 — 도박적 긴급함 배제).
// 공 색은 공식 로또 색 구간(1-10 노랑, 11-20 파랑, 21-30 빨강, 31-40 회색, 41-45 초록)을 팔레트로 매핑.
import MiniGame from '../MiniGame.js';
import { C, css, FONT, EASE, LAYOUT } from '../theme.js';
import { makeButton, makeHeader, makeSubLink, copyText } from '../ui.js';
import { Sfx } from '../sfx.js';

const LS_KEY = 'dori.lotto';
const MIN_LINES = 1;
const MAX_LINES = 5;
const LINE_LABELS = ['A', 'B', 'C', 'D', 'E'];
const SITE_URL = 'https://dori.io.kr/';

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
      // 손상 데이터 방어: 줄(6개·1–45 정수)·개수·시각을 정규화해 반환 — count가 NaN으로 고착되는 것 방지
      if (s && Array.isArray(s.lines) && s.lines.length <= MAX_LINES
        && s.lines.every((l) => Array.isArray(l) && l.length === 6
          && l.every((n) => Number.isInteger(n) && n >= 1 && n <= 45))) {
        return {
          lines: s.lines,
          hour: Number.isInteger(s.hour) ? s.hour : null,
          count: Number.isInteger(s.count) ? Math.min(Math.max(s.count, MIN_LINES), MAX_LINES) : 1,
        };
      }
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
    this.toastPrev = null; // 토스트 복원 원본(중첩 호출에도 최초 문구 유지 — 확률 고지가 지워지지 않게)
    this.lines = saved ? saved.lines : [];
    this.lineCount = saved ? saved.count : 1;
    this.drawnHour = saved ? saved.hour : null;
    // 기기 시계를 되돌려 기록이 '미래 시각'이 된 경우 현재 창으로 보정 — 잠금이 무한 해제되는 우회 축소
    if (this.drawnHour !== null && this.drawnHour > hourWindow()) this.drawnHour = hourWindow();

    // 공통 레이아웃 그리드(LAYOUT): 헤더48 / 태그라인128 / 문구190 / 게임판 / 링크1002(±150) / 주 버튼1104
    makeHeader(this, '로또 추첨', '이번 주, 당신의 여섯 숫자');

    this.linesLayer = this.add.container(0, 0);

    this.buildLineControls();

    // 두 줄 문구가 길어 26px 유지(패턴 32px 대신 — 화면 폭 검산, 문서화된 예외)
    this.hint = this.add.text(this.cx, LAYOUT.msgY, '', {
      fontFamily: FONT, fontSize: '26px', color: css(C.subtext), fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);

    this.drawBtn = makeButton(this, {
      x: this.cx, y: LAYOUT.btnY, w: 360, h: 100, label: '추첨', variant: 'primary',
      onClick: () => this.draw(),
    });

    // 복사 · 공유(하단 보조 액션)
    this.copyBtn = makeSubLink(this, this.cx - LAYOUT.linkDX, LAYOUT.linksY, '📋 복사', () => this.copyNumbers());
    this.shareBtn = makeSubLink(this, this.cx + LAYOUT.linkDX, LAYOUT.linksY, '공유 ↗', () => this.shareNumbers());

    this.renderLines();
    this.refreshLockState();

    // 정각 경과 감시: 씬을 켜둔 채 정각이 지나면 잠금을 자동 해제(재진입 없이) — 10초 간격 상태 비교
    this.time.addEvent({
      delay: 10000,
      loop: true,
      callback: () => {
        if (this.locked) return; // 추첨 연출 중에는 건드리지 않는다(연출 끝에 refreshLockState가 돈다)
        if (this.lockShown !== this.isLocked()) this.refreshLockState();
      },
    });
  }

  isLocked() {
    return this.drawnHour !== null && this.drawnHour === hourWindow();
  }

  nextHourLabel() {
    const d = new Date((hourWindow() + 1) * HOUR_MS);
    return `${String(d.getHours()).padStart(2, '0')}:00`;
  }

  refreshLockState() {
    this.toastPrev = null; // 상태 문구를 새로 쓰므로 대기 중인 토스트 복원은 무효화(옛 문구 부활 방지)
    this.lockShown = this.isLocked(); // 정각 경과 감시 타이머의 비교 기준(화면에 반영된 상태)
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
    const gapY = 95;
    // 줄 블록을 판 영역 중앙(y 550)에 세로 정렬 — 1줄이어도 위로 쏠리지 않는다
    const startY = Math.round(550 - ((this.lineCount - 1) * gapY) / 2);
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

    // 줄마다 1–45에서 비복원 6개(Fisher-Yates 셔플 후 앞 6개, 오름차순)
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
      this.burst(this.cx, 550, C.warning, 30);
      this.colorFlash(C.primary, 150);
      Sfx.play('win');
      this.unlock();
      this.refreshLockState();
    });
  }

  // ===== 복사 · 공유 =====
  numbersText() {
    // 화면에 보이는 줄까지만 — 잠금 해제 후 줄 수를 줄이면 기록엔 남아도 표시가 진실(정직한 매핑)
    const rows = this.lines.slice(0, this.lineCount)
      .map((nums, i) => `${LINE_LABELS[i]}  ${nums.map((n) => String(n).padStart(2, '0')).join(' ')}`);
    if (!rows.length) return null;
    return rows.join('\n');
  }

  async copyNumbers() {
    const text = this.numbersText();
    if (!text) { this.toastHint('먼저 추첨해 주세요'); return; }
    if (await copyText(text)) {
      this.toastHint('번호가 복사됐어요');
      Sfx.play('pop');
    } else {
      this.toastHint('복사가 막힌 브라우저예요');
    }
  }

  async shareNumbers() {
    const text = this.numbersText();
    if (!text) { this.toastHint('먼저 추첨해 주세요'); return; }
    const body = `오늘의 여섯 숫자 🎱\n${text}\n${SITE_URL}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'dori 로또 번호', text: body });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return; // 사용자 취소 — 조용히 종료
        // 공유 차단(인앱 브라우저·데스크톱 등) → 아래 클립보드 폴백으로 진행
      }
    }
    if (await copyText(body)) this.toastHint('공유 문구가 복사됐어요');
    else this.toastHint('공유가 막힌 브라우저예요');
  }

  // 토스트 중첩 시 원본은 최초 1회만 캡처(빙고와 같은 문법) — 토스트 문구가 원본으로 저장돼
  // 확률 고지 라인이 영구 대체되는 것을 방지. refreshLockState가 toastPrev를 비우면 복원도 무효.
  toastHint(msg) {
    if (!this.toastPrev) this.toastPrev = { text: this.hint.text, color: this.hint.style.color };
    this.hint.setColor(css(C.warning)).setText(msg);
    this.time.delayedCall(1400, () => {
      if (!this.hint || !this.hint.active || !this.toastPrev) return;
      this.hint.setColor(this.toastPrev.color).setText(this.toastPrev.text);
      this.toastPrev = null;
    });
  }
}
