// 악어 이빨 누르기 — 복불복. 실물 완구의 디지털 재현(trend-research §3).
// 슬롯 배열 중 1개가 트리거(비복원 시도), 밟으면 입이 닫힌다.
// 정직한 긴장 연출: 안전한 이빨에 가짜 덜컥임 없음(design-principles).
import MiniGame from '../MiniGame.js';
import { C, css, FONT, EASE } from '../theme.js';
import { makeButton } from '../ui.js';
import { Sfx } from '../sfx.js';

const TEETH = 12; // 6 × 2줄
const CROC = 0x2e8b57; // 악어 몸통색(게임 전용 장식색)
const CROC_DARK = 0x1f6b41;

export default class CrocoScene extends MiniGame {
  constructor() {
    super('Croco');
  }

  onCreate() {
    const { width } = this.scale;
    this.cx = width / 2;

    this.add.text(this.cx, 140, '악어 이빨 누르기', {
      fontFamily: FONT, fontSize: '48px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(this.cx, 196, '이빨 하나가 함정 — 누르면 앙!', {
      fontFamily: FONT, fontSize: '26px', color: css(C.subtext),
    }).setOrigin(0.5);

    this.buildCroc();

    this.hint = this.add.text(this.cx, 1000, '', {
      fontFamily: FONT, fontSize: '30px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.resetBtn = makeButton(this, {
      x: this.cx, y: 1100, w: 360, h: 100, label: '다시 시작', variant: 'primary',
      onClick: () => this.reset(),
    });

    this.reset();
  }

  buildCroc() {
    // 아래턱(고정): y 640–860
    const lower = this.add.graphics();
    lower.fillStyle(CROC, 1).fillRoundedRect(80, 640, 560, 220, 40);
    lower.fillStyle(CROC_DARK, 1).fillRoundedRect(80, 640, 560, 30, { tl: 40, tr: 40, bl: 0, br: 0 });

    // 위턱(내려와서 무는 컨테이너): y 260–450 → 물면 +170
    this.upperJaw = this.add.container(0, 0);
    const upper = this.add.graphics();
    upper.fillStyle(CROC, 1).fillRoundedRect(80, 260, 560, 190, 40);
    upper.fillStyle(CROC_DARK, 1).fillRoundedRect(80, 420, 560, 30, { tl: 0, tr: 0, bl: 40, br: 40 });
    // 눈
    upper.fillStyle(0xffffff, 1).fillCircle(200, 300, 34).fillCircle(520, 300, 34);
    upper.fillStyle(C.bg, 1).fillCircle(200, 306, 14).fillCircle(520, 306, 14);
    this.upperJaw.add(upper);
    // (위턱 세모 장식 제거 — 누르는 버튼만으로 이빨을 표현)

    // 누르는 이빨 12개(2줄 × 6개, 입 안 y 500–630) — 터치 타깃 88×72
    this.teeth = [];
    for (let i = 0; i < TEETH; i += 1) {
      const row = Math.floor(i / 6);
      const col = i % 6;
      const x = 130 + col * 92;
      const y = 520 + row * 84;

      const tooth = this.add.graphics();
      tooth.fillStyle(0x000000, 0.25).fillRoundedRect(x - 32, y - 26 + 5, 64, 56, 12);
      tooth.fillStyle(0xffffff, 1).fillRoundedRect(x - 32, y - 30, 64, 56, 12);
      const hit = this.add.rectangle(x, y, 88, 76, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => this.press(i));
      this.teeth.push({ g: tooth, hit, x, y, pressed: false });
    }
  }

  reset() {
    this.trap = this.rng.between(0, TEETH - 1); // SETUP: 함정 재배치(학습 방지)
    this.doneCount = 0;
    this.bitten = false;
    this.upperJaw.y = 0;
    this.teeth.forEach((t) => {
      t.pressed = false;
      t.g.setAlpha(1);
      t.g.y = 0;
      // 빨간(함정) 표시 포함 원래 모습으로 다시 그림
      t.g.clear();
      t.g.fillStyle(0x000000, 0.25).fillRoundedRect(t.x - 32, t.y - 26 + 5, 64, 56, 12);
      t.g.fillStyle(0xffffff, 1).fillRoundedRect(t.x - 32, t.y - 30, 64, 56, 12);
      t.hit.setInteractive({ useHandCursor: true });
    });
    this.hint.setColor(css(C.subtext)).setScale(1);
    this.hint.setText(`남은 이빨 ${TEETH} · 함정은 1개`);
  }

  press(i) {
    if (this.locked || this.bitten) return;
    const t = this.teeth[i];
    if (t.pressed) return;
    this.lock();
    t.pressed = true;
    t.hit.disableInteractive();
    this.doneCount += 1;
    Sfx.play('tap');

    // 이빨 눌림(즉각 피드백)
    this.tweens.add({
      targets: t.g, y: 10, alpha: 0.45, duration: 110, ease: 'Quad.easeOut',
      onComplete: () => {
        if (i === this.trap) this.chomp(i);
        else this.safe(i);
      },
    });
  }

  chomp(i) {
    this.bitten = true;
    // 함정 이빨은 빨간색으로 표시(색상 연결: 위험색) — 어떤 이빨이었는지 정직하게 공개
    const t = this.teeth[i];
    t.g.setAlpha(1);
    t.g.fillStyle(C.danger, 1).fillRoundedRect(t.x - 32, t.y - 30, 64, 56, 12);
    // 위턱이 쾅 닫힌다(Peak)
    this.tweens.add({
      targets: this.upperJaw, y: 170, duration: 130, ease: 'Quad.easeIn',
      onComplete: () => {
        Sfx.play('bang');
        this.time.delayedCall(350, () => Sfx.play('win')); // Peak-End: 쾅 뒤 당첨 팡파르
        this.burst(t.x, t.y, C.danger, 36);
        this.colorFlash(C.danger, 220);
        this.shake(0.014, 280);
        this.hint.setColor(css(C.danger));
        this.hint.setText(`앙!! ${this.doneCount}번째에서 물렸다 — 벌칙 🎉`);
        this.hint.setScale(0);
        this.tweens.add({ targets: this.hint, scale: 1, duration: 340, ease: EASE.bounce });
        this.tweens.add({ targets: this.upperJaw, y: 150, duration: 300, delay: 250, ease: EASE.bounce });
        this.unlock();
      },
    });
  }

  safe(i) {
    Sfx.play('pop'); // 안도(마이크로 보상)
    const left = TEETH - this.doneCount;
    this.hint.setColor(css(C.success));
    this.hint.setText(`세이프! 남은 이빨 ${left} · 함정 확률 1/${left}`); // 정직한 확률
    this.unlock();
  }
}
