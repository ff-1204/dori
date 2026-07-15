// 점심 메뉴 룰렛 — 첫 실제 미니게임(결정 돕기).
// 정직한 매핑: 결과를 RNG로 먼저 정하고, 포인터가 가리키는 칸이 그 결과가 되도록
// 회전 각을 역산한다(docs/game-mechanics.md A-1). 감속은 Cubic.easeOut로 긴장 연출.
import MiniGame from '../MiniGame.js';
import { C, css, FONT, SLICE, EASE } from '../theme.js';
import { makeButton } from '../ui.js';

const MENU = ['짜장면', '짬뽕', '초밥', '김치찌개', '파스타', '햄버거', '비빔밥', '국밥'];

export default class RouletteScene extends MiniGame {
  constructor() {
    super('Roulette');
  }

  onCreate() {
    const { width } = this.scale;
    this.items = MENU;
    this.n = this.items.length;
    this.sliceAngle = 360 / this.n;
    this.cx = width / 2;
    this.cy = 560;
    this.radius = 300;
    this.wheelAngle = 0; // 누적 회전각(도), 랩 없이 관리

    this.add.text(this.cx, 220, '점심 메뉴 룰렛', {
      fontFamily: FONT, fontSize: '48px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.buildWheel();
    this.buildPointer();

    this.resultText = this.add.text(this.cx, 930, '돌려서 오늘 점심을 정하세요', {
      fontFamily: FONT, fontSize: '38px', color: css(C.subtext), fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);

    this.spinBtn = makeButton(this, {
      x: this.cx, y: 1120, w: 360, h: 100, label: '돌리기', variant: 'primary',
      onClick: () => this.spin(),
    });
  }

  buildWheel() {
    this.wheel = this.add.container(this.cx, this.cy);

    const g = this.add.graphics();
    for (let i = 0; i < this.n; i += 1) {
      const start = Phaser.Math.DegToRad(i * this.sliceAngle);
      const end = Phaser.Math.DegToRad((i + 1) * this.sliceAngle);
      g.fillStyle(SLICE[i % SLICE.length], 1);
      g.beginPath();
      g.slice(0, 0, this.radius, start, end, false);
      g.closePath();
      g.fillPath();
    }
    g.lineStyle(6, C.bg, 1).strokeCircle(0, 0, this.radius); // 외곽선
    this.wheel.add(g);

    // 라벨(반지름 방향, 왼쪽 절반은 뒤집어 가독성 유지)
    this.items.forEach((name, i) => {
      const mid = Phaser.Math.DegToRad((i + 0.5) * this.sliceAngle);
      const lx = Math.cos(mid) * this.radius * 0.62;
      const ly = Math.sin(mid) * this.radius * 0.62;
      const label = this.add.text(lx, ly, name, {
        fontFamily: FONT, fontSize: '30px', color: css(C.bg), fontStyle: 'bold',
      }).setOrigin(0.5);
      let rot = mid;
      if (Math.cos(mid) < 0) rot += Math.PI;
      label.setRotation(rot);
      this.wheel.add(label);
    });

    // 중심 허브(돌릴 수 있음 시그니파이어)
    const hub = this.add.circle(0, 0, 40, C.surface).setStrokeStyle(6, C.bg);
    this.wheel.add(hub);
  }

  buildPointer() {
    // 12시 방향에서 아래를 가리키는 삼각형(정직한 매핑: 여기 멈춘 칸이 결과)
    const topY = this.cy - this.radius;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25).fillTriangle(this.cx - 26, topY - 44, this.cx + 26, topY - 44, this.cx, topY + 10);
    g.fillStyle(C.text, 1).fillTriangle(this.cx - 24, topY - 46, this.cx + 24, topY - 46, this.cx, topY + 6);
  }

  spin() {
    if (this.locked) return;
    this.lock();
    this.spinBtn.disableButton();
    this.resultText.setText('...');
    this.resultText.setColor(css(C.subtext));

    // 1) 결과 먼저 결정(공정한 RNG)
    const winner = this.rng.between(0, this.n - 1);
    const winnerCenter = (winner + 0.5) * this.sliceAngle;

    // 2) 그 칸이 12시(270°)에 오도록 목표각 역산 + 여러 바퀴
    const spins = 4;
    const currentMod = ((this.wheelAngle % 360) + 360) % 360;
    const targetMod = (((270 - winnerCenter) % 360) + 360) % 360;
    const delta = ((targetMod - currentMod + 360) % 360) + 360 * spins;
    const finalAngle = this.wheelAngle + delta;

    // 3) 감속 회전(랩 방지를 위해 프록시 값 → rotation 직접 적용)
    const proxy = { a: this.wheelAngle };
    this.tweens.add({
      targets: proxy,
      a: finalAngle,
      duration: 3800,
      ease: EASE.spin,
      onUpdate: () => { this.wheel.rotation = Phaser.Math.DegToRad(proxy.a); },
      onComplete: () => {
        this.wheelAngle = finalAngle;
        this.reveal(winner);
      },
    });
  }

  reveal(winner) {
    this.resultText.setColor(css(C.success));
    this.resultText.setText(`오늘 점심은\n${this.items[winner]} !`);
    this.resultText.setScale(0);
    this.tweens.add({ targets: this.resultText, scale: 1, duration: 320, ease: EASE.bounce });
    this.cameras.main.flash(180, 108, 199, 255);

    this.spinBtn.enableButton();
    this.spinBtn.setLabel('다시 돌리기');
    this.unlock();
  }
}
