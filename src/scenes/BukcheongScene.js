// 붉청 — 양자택일 오라클(복불복). 질문을 입력하면 운명이 붉 또는 청으로 답한다.
// 핵심: 결정적 해시 = FNV-1a("붉청" + 정규화(질문) + 4시간창번호) % 2.
// 순수 함수라 서버·저장소 없이 어떤 기기/브라우저에서 열어도 같은 질문이면 같은 답이고,
// 답은 4시간(KST 00/04/08/12/16/20시 정각 경계)에 1번만 바뀔 수 있다 — 리롤 불가(운명성).
// 정직성: 이 규칙(유효 시각·동일 답)을 화면에 그대로 공개한다. 입력은 클라이언트에서만 처리(전송 없음).
import MiniGame from '../MiniGame.js';
import { C, css, FONT, EASE } from '../theme.js';
import { makeButton } from '../ui.js';
import { Sfx } from '../sfx.js';

const RED = C.danger;   // 붉
const BLUE = C.primary; // 청

const WINDOW_MS = 4 * 60 * 60 * 1000;
const KST_OFFSET = 9 * 60 * 60 * 1000;

// FNV-1a 32bit — 퍼블릭 도메인 알고리즘을 스펙에서 직접 구현(서드파티 없음)
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// 같은 질문이 같은 답을 받도록 정규화(공백·유니코드·대소문자)
function normalize(s) {
  return s.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function windowIndex(now = Date.now()) {
  return Math.floor((now + KST_OFFSET) / WINDOW_MS);
}

function windowEndMs(now = Date.now()) {
  return (windowIndex(now) + 1) * WINDOW_MS - KST_OFFSET;
}

// 0 = 붉, 1 = 청
function pickColor(text, now = Date.now()) {
  return fnv1a(`붉청|${normalize(text)}|${windowIndex(now)}`) % 2;
}

export default class BukcheongScene extends MiniGame {
  constructor() {
    super('Bukcheong');
  }

  onCreate() {
    const { width } = this.scale;
    this.cx = width / 2;

    this.add.text(this.cx, 140, '붉청', {
      fontFamily: FONT, fontSize: '48px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(this.cx, 196, '묻고, 운명의 색을 받으세요', {
      fontFamily: FONT, fontSize: '26px', color: css(C.subtext),
    }).setOrigin(0.5);

    // 질문 입력창(HTML 오버레이 — 한글 IME 대응)
    this.inputEl = this.add.dom(this.cx, 290).createFromHTML(
      '<input type="text" maxlength="24" placeholder="무엇이 궁금한가요?" '
      + 'style="width:480px;padding:18px 24px;font-size:28px;border-radius:16px;'
      + 'border:2px solid #2a2f42;background:#1d1f2b;color:#f2f3f7;outline:none;'
      + 'text-align:center;font-family:sans-serif;">',
    );

    this.buildOrb();

    this.resultText = this.add.text(this.cx, 890, '', {
      fontFamily: FONT, fontSize: '38px', color: css(C.subtext), fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);

    // 규칙 공개(정직성): 유효 시간·동일 답 안내
    this.noteText = this.add.text(this.cx, 990, '같은 질문은 어디서 물어도 4시간 동안 같은 답이에요', {
      fontFamily: FONT, fontSize: '24px', color: css(C.subtext),
    }).setOrigin(0.5);

    this.askBtn = makeButton(this, {
      x: this.cx, y: 1100, w: 380, h: 100, label: '운명에 묻기', variant: 'primary',
      onClick: () => this.ask(),
    });
  }

  // 붉/청 반반의 오라클 구슬 — 천천히 돈다(무엇이 나올지 모름을 정직하게 표현)
  buildOrb() {
    this.orb = this.add.container(this.cx, 620);
    this.orbHalves = this.add.graphics();
    this.orbHalves.fillStyle(RED, 1);
    this.orbHalves.slice(0, 0, 165, Phaser.Math.DegToRad(90), Phaser.Math.DegToRad(270), false);
    this.orbHalves.fillPath();
    this.orbHalves.fillStyle(BLUE, 1);
    this.orbHalves.slice(0, 0, 165, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(90), false);
    this.orbHalves.fillPath();
    this.orbHalves.lineStyle(6, C.bg, 1).strokeCircle(0, 0, 165);
    this.orb.add(this.orbHalves);

    // 대기 상태: 느린 회전
    this.idleSpin = this.tweens.add({
      targets: this.orb, angle: 360, duration: 14000, repeat: -1, ease: 'Linear',
    });
  }

  getQuestion() {
    const el = this.inputEl && this.inputEl.node && this.inputEl.node.querySelector('input');
    return el ? el.value : '';
  }

  ask() {
    if (this.locked) return;
    const q = this.getQuestion();
    if (!normalize(q)) {
      this.resultText.setColor(css(C.warning)).setText('질문을 입력해 주세요').setScale(1);
      return;
    }
    this.lock();
    this.askBtn.disableButton();
    this.resultText.setColor(css(C.subtext)).setText('...').setScale(1);
    if (this.countdownTimer) { this.countdownTimer.remove(); this.countdownTimer = null; }
    Sfx.play('pop');

    // 빌드업: 구슬이 점점 빨리 돌며 커진다(기대 → 긴장)
    this.idleSpin.pause();
    this.tweens.add({
      targets: this.orb, angle: this.orb.angle + 1080, duration: 1500, ease: 'Cubic.easeIn',
    });
    this.tweens.add({
      targets: this.orb, scale: 1.12, duration: 750, yoyo: true, ease: 'Sine.easeInOut',
      onComplete: () => this.reveal(q),
    });
  }

  reveal(q) {
    const now = Date.now();
    const isRed = pickColor(q, now) === 0;
    const color = isRed ? RED : BLUE;
    const name = isRed ? '붉' : '청';

    // 구슬이 한 색으로 확정(색상 연결의 원천)
    this.orbHalves.clear();
    this.orbHalves.fillStyle(color, 1).fillCircle(0, 0, 165);
    this.orbHalves.lineStyle(6, C.bg, 1).strokeCircle(0, 0, 165);
    this.orb.setAngle(0);
    this.orb.setScale(0.9);
    this.tweens.add({ targets: this.orb, scale: 1, duration: 380, ease: EASE.bounce });

    // 구슬 위에 결과 글자
    const mark = this.add.text(0, 0, name, {
      fontFamily: FONT, fontSize: '120px', color: css(C.bg), fontStyle: 'bold',
    }).setOrigin(0.5).setScale(0);
    this.orb.add(mark);
    this.tweens.add({ targets: mark, scale: 1, duration: 320, ease: EASE.popIn });

    this.burst(this.cx, 620, color, 36);
    this.colorFlash(color, 200);
    this.shake(0.005, 150);
    Sfx.play(isRed ? 'bang' : 'win');

    const shown = q.trim().length > 12 ? `${q.trim().slice(0, 12)}…` : q.trim();
    this.resultText.setColor(css(color));
    this.resultText.setText(`"${shown}"\n운명은 ${name} !`);
    this.resultText.setScale(0);
    this.tweens.add({ targets: this.resultText, scale: 1, duration: 320, ease: EASE.bounce });

    this.startCountdown();

    this.askBtn.enableButton();
    this.askBtn.setLabel('다시 묻기');
    this.unlock();

    // 다음 질문 대기: 잠시 후 구슬을 반반 상태로 되돌린다
    this.time.delayedCall(2600, () => {
      if (!this.locked && this.orb && this.orb.active) {
        mark.destroy();
        this.orbHalves.clear();
        this.orbHalves.fillStyle(RED, 1);
        this.orbHalves.slice(0, 0, 165, Phaser.Math.DegToRad(90), Phaser.Math.DegToRad(270), false);
        this.orbHalves.fillPath();
        this.orbHalves.fillStyle(BLUE, 1);
        this.orbHalves.slice(0, 0, 165, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(90), false);
        this.orbHalves.fillPath();
        this.orbHalves.lineStyle(6, C.bg, 1).strokeCircle(0, 0, 165);
        this.idleSpin.resume();
      }
    });
  }

  // 유효 시각 카운트다운(규칙 공개)
  startCountdown() {
    const update = () => {
      const remain = windowEndMs() - Date.now();
      if (remain <= 0) {
        this.noteText.setText('운명이 새로 바뀌었어요 — 다시 물어보세요');
        if (this.countdownTimer) { this.countdownTimer.remove(); this.countdownTimer = null; }
        return;
      }
      const h = Math.floor(remain / 3600000);
      const m = Math.floor((remain % 3600000) / 60000);
      const s = Math.floor((remain % 60000) / 1000);
      const end = new Date(windowEndMs());
      const endStr = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
      this.noteText.setText(`이 답은 ${endStr}까지 유효 · 새 운명까지 ${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    update();
    this.countdownTimer = this.time.addEvent({ delay: 1000, loop: true, callback: update });
  }
}
