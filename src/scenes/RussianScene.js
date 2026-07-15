// 러시안 룰렛 — 복불복. 순차 조건부 확률(1/6→1/5→…)의 대표 게임(game-theory §2).
// 정직한 확률 표시: 매 시도의 실제 확률을 화면에 그대로 보여준다(설계 원칙: 정직한 확률).
// 유쾌한 프레이밍: 걸리면 "빵!"과 함께 벌칙 당첨 — 가볍고 웃기게(game-theory §9).
import MiniGame from '../MiniGame.js';
import { C, css, FONT, EASE } from '../theme.js';
import { makeButton } from '../ui.js';
import { Sfx } from '../sfx.js';

const CHAMBERS = 6;

export default class RussianScene extends MiniGame {
  constructor() {
    super('Russian');
  }

  onCreate() {
    const { width } = this.scale;
    this.cx = width / 2;
    this.cy = 560;

    this.add.text(this.cx, 140, '러시안 룰렛', {
      fontFamily: FONT, fontSize: '48px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(this.cx, 196, '한 칸에만 "빵!" — 걸리면 벌칙 당첨', {
      fontFamily: FONT, fontSize: '26px', color: css(C.subtext),
    }).setOrigin(0.5);

    this.buildCylinder();
    this.buildPointer();

    this.hint = this.add.text(this.cx, 1000, '', {
      fontFamily: FONT, fontSize: '30px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.triggerBtn = makeButton(this, {
      x: this.cx, y: 1100, w: 360, h: 100, label: '방아쇠', variant: 'danger',
      onClick: () => this.pull(),
    });

    this.reload();
  }

  buildCylinder() {
    this.cylinder = this.add.container(this.cx, this.cy);

    const body = this.add.graphics();
    body.fillStyle(C.surface, 1).fillCircle(0, 0, 175);
    body.lineStyle(6, C.surfaceAlt, 1).strokeCircle(0, 0, 175);
    body.fillStyle(C.surfaceAlt, 1).fillCircle(0, 0, 34);
    this.cylinder.add(body);

    // 약실 6칸(위 = 현재 칸)
    this.chamberDots = [];
    for (let i = 0; i < CHAMBERS; i += 1) {
      const ang = Phaser.Math.DegToRad(-90 + i * 60);
      const x = Math.cos(ang) * 108;
      const y = Math.sin(ang) * 108;
      const dot = this.add.circle(x, y, 34, C.bg).setStrokeStyle(4, C.surfaceAlt);
      this.cylinder.add(dot);
      this.chamberDots.push(dot);
    }
  }

  buildPointer() {
    // 위쪽 포인터: 이번에 발사되는 칸(정직한 매핑)
    const topY = this.cy - 175;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25).fillTriangle(this.cx - 24, topY - 42, this.cx + 24, topY - 42, this.cx, topY + 8);
    g.fillStyle(C.text, 1).fillTriangle(this.cx - 22, topY - 44, this.cx + 22, topY - 44, this.cx, topY + 4);
  }

  reload() {
    this.bullet = this.rng.between(0, CHAMBERS - 1); // SETUP: 탄 위치 결정(비복원 순차)
    this.tryCount = 0;
    this.done = false;
    this.cylinder.setRotation(0);
    this.chamberDots.forEach((d) => d.setFillStyle(C.bg).setStrokeStyle(4, C.surfaceAlt).setScale(1));
    this.triggerBtn.setLabel('방아쇠');
    this.updateHint();
  }

  updateHint() {
    const left = CHAMBERS - this.tryCount;
    this.hint.setColor(css(C.subtext)).setScale(1);
    this.hint.setText(`남은 칸 ${left} · 이번 확률 1/${left}`); // 정직한 조건부 확률
  }

  pull() {
    if (this.locked) return;
    if (this.done) { this.reload(); return; }
    this.lock();
    this.triggerBtn.disableButton();

    const t = this.tryCount; // 이번에 발사되는 약실 인덱스
    // 실린더 회전(긴장 빌드업 — 시도가 쌓일수록 대기 시간이 살짝 길어진다)
    const suspense = 300 + t * 130;
    this.tweens.add({
      targets: this.cylinder,
      rotation: `-=${Phaser.Math.DegToRad(60)}`,
      duration: 260,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.time.delayedCall(suspense, () => this.resolve(t));
      },
    });
    this.tryCount += 1;
  }

  resolve(t) {
    const dot = this.chamberDots[t];
    if (t === this.bullet) {
      // 빵! — Peak 연출(위험색으로 색상 연결)
      dot.setFillStyle(C.danger);
      Sfx.play('bang');
      this.burst(this.cx, this.cy - 175, C.danger, 40);
      this.colorFlash(C.danger, 220);
      this.shake(0.012, 260);
      this.hint.setColor(css(C.danger));
      this.hint.setText(`빵!! ${t + 1}번째에서 당첨 — 벌칙 담당 🎉`);
      this.hint.setScale(0);
      this.tweens.add({ targets: this.hint, scale: 1, duration: 340, ease: EASE.bounce });
      this.done = true;
      this.triggerBtn.setLabel('다시 장전');
    } else {
      // 찰칵 — 빈 약실 표시(정직: 지나간 칸이 안전했음을 보여준다)
      Sfx.play('tick');
      dot.setFillStyle(C.surfaceAlt).setStrokeStyle(4, C.success);
      const click = this.add.text(this.cx, this.cy - 230, '찰칵', {
        fontFamily: FONT, fontSize: '36px', color: css(C.success), fontStyle: 'bold',
      }).setOrigin(0.5).setScale(0);
      this.tweens.add({
        targets: click, scale: 1, duration: 200, ease: EASE.popIn,
        onComplete: () => {
          this.tweens.add({ targets: click, alpha: 0, y: this.cy - 260, duration: 420, onComplete: () => click.destroy() });
        },
      });
      this.updateHint();
    }
    this.triggerBtn.enableButton();
    this.unlock();
  }
}
