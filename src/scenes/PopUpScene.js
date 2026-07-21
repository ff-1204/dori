// 해적통(팝업 해적, 구 '통아저씨' — 상표 선제 회피 개명 2026-07-18) — 복불복. 실물 완구의 디지털 재현(trend-research §3).
// 칼 구멍 중 1개가 발사 트리거(비복원 시도) — 꽂으면 해적이 날아간다.
// 정직한 긴장: 안전 칸에 가짜 연출 없음, 남은 칸 확률을 정직하게 표시.
import MiniGame from '../MiniGame.js';
import { C, css, FONT, EASE } from '../theme.js';
import { makeButton } from '../ui.js';
import { Sfx } from '../sfx.js';

const SLOTS = 12; // 4 × 3줄
const BARREL = 0x8a5a33; // 나무통 색(게임 전용 장식색)
const BARREL_DARK = 0x6b4426;

export default class PopUpScene extends MiniGame {
  constructor() {
    super('PopUp');
  }

  onCreate() {
    const { width } = this.scale;
    this.cx = width / 2;

    // 공통 레이아웃 패턴: 헤더 y48(⬅·제목 40px) / 태그라인128 / 문구190(32px) / 게임판 / 주 버튼
    this.add.text(this.cx, 48, '해적통', {
      fontFamily: FONT, fontSize: '40px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(this.cx, 128, '칼을 꽂다 보면… 펑! 해적 발사', {
      fontFamily: FONT, fontSize: '24px', color: css(C.subtext),
    }).setOrigin(0.5);

    this.buildBarrel();

    this.hint = this.add.text(this.cx, 190, '', {
      fontFamily: FONT, fontSize: '32px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.resetBtn = makeButton(this, {
      x: this.cx, y: 1100, w: 360, h: 100, label: '다시 숨기기', variant: 'primary',
      onClick: () => this.reset(),
    });

    this.reset();
  }

  buildBarrel() {
    // 통(y 480–830)
    const g = this.add.graphics();
    g.fillStyle(BARREL, 1).fillRoundedRect(180, 480, 360, 350, 36);
    // 나무 판자 결(세로선)
    g.lineStyle(3, BARREL_DARK, 0.5);
    g.lineBetween(270, 496, 270, 826);
    g.lineBetween(360, 492, 360, 828);
    g.lineBetween(450, 496, 450, 826);
    g.fillStyle(BARREL_DARK, 1);
    g.fillRect(180, 540, 360, 14);
    g.fillRect(180, 700, 360, 14);
    g.fillEllipse(this.cx, 484, 360, 44); // 테두리 림

    // 해적(통 위에 반쯤 숨음) — 발사 대상
    this.pirate = this.add.container(this.cx, 452);
    const p = this.add.graphics();
    p.fillStyle(0xffcf9e, 1).fillCircle(0, 0, 46);            // 얼굴
    p.fillStyle(C.danger, 1).fillEllipse(0, -34, 96, 40);      // 두건
    p.fillStyle(0xffffff, 0.85);                               // 두건 물방울 무늬
    p.fillCircle(-24, -36, 5).fillCircle(0, -44, 5).fillCircle(24, -36, 5);
    p.fillStyle(C.danger, 0.22).fillCircle(-28, 10, 9).fillCircle(28, 10, 9); // 볼터치
    p.lineStyle(4, C.bg, 1).strokeCircle(0, 14, 10);           // 입(놀란 O)
    this.pirate.add(p);

    // 눈은 상태별 분리 — 평소(점) / 발사 후(X — 기절 연출)
    this.eyesNormal = this.add.graphics();
    this.eyesNormal.fillStyle(C.bg, 1).fillCircle(-16, -2, 7).fillCircle(16, -2, 7);
    this.pirate.add(this.eyesNormal);

    this.eyesX = this.add.graphics();
    this.eyesX.lineStyle(5, C.bg, 1);
    [-16, 16].forEach((ex) => {
      this.eyesX.lineBetween(ex - 7, -9, ex + 7, 5);
      this.eyesX.lineBetween(ex - 7, 5, ex + 7, -9);
    });
    this.eyesX.setVisible(false);
    this.pirate.add(this.eyesX);

    // 칼 구멍 12개(4열 × 3줄, 통 표면) — 터치 타깃 84×90
    this.slots = [];
    for (let i = 0; i < SLOTS; i += 1) {
      const row = Math.floor(i / 4);
      const col = i % 4;
      const x = 244 + col * 78;
      const y = 580 + row * 90;

      const slit = this.add.graphics();
      slit.fillStyle(C.bg, 0.85).fillRoundedRect(x - 26, y - 8, 52, 16, 8);
      const hit = this.add.rectangle(x, y, 84, 88, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => this.stab(i));
      this.slots.push({ slit, hit, x, y, used: false, sword: null });
    }
  }

  reset() {
    this.trigger = this.rng.between(0, SLOTS - 1); // SETUP: 트리거 재배치
    this.doneCount = 0;
    this.launched = false;
    this.tweens.killTweensOf(this.pirate); // 발사 트윈이 남아 있으면 복원 위치와 충돌
    this.pirate.setPosition(this.cx, 452).setAngle(0).setAlpha(1).setScale(1);
    this.eyesNormal.setVisible(true); // 눈 복원(멀쩡한 얼굴로 다시 숨음)
    this.eyesX.setVisible(false);
    this.slots.forEach((s) => {
      s.used = false;
      s.hit.setInteractive({ useHandCursor: true });
      if (s.sword) { s.sword.destroy(); s.sword = null; }
      if (s.maskG) { s.maskG.destroy(); s.maskG = null; }
      // 빨간(트리거) 표시 포함 원래 슬릿으로 복원
      s.slit.clear();
      s.slit.fillStyle(C.bg, 0.85).fillRoundedRect(s.x - 26, s.y - 8, 52, 16, 8);
    });
    this.hint.setColor(css(C.subtext)).setScale(1);
    this.hint.setText(`칼 구멍 ${SLOTS}개 · 트리거는 1개`);
  }

  stab(i) {
    if (this.locked || this.launched) return;
    const s = this.slots[i];
    if (s.used) return;
    this.lock();
    s.used = true;
    s.hit.disableInteractive();
    this.doneCount += 1;
    Sfx.play('tap');

    // 칼이 오른쪽에서 날아와 꽂힌다(즉각 피드백)
    const sword = this.add.container(s.x + 220, s.y);
    const sg = this.add.graphics();
    sg.fillStyle(0xc9cede, 1).fillRoundedRect(-64, -6, 96, 12, 6); // 칼날
    sg.fillStyle(C.warning, 1).fillRoundedRect(28, -16, 12, 32, 4); // 가드
    sg.fillStyle(BARREL_DARK, 1).fillRoundedRect(40, -8, 30, 16, 6); // 손잡이
    sword.add(sg);
    s.sword = sword;

    // 구멍 안으로 들어간 칼날은 가린다(구멍 오른쪽 영역만 보이는 마스크)
    const maskG = this.make.graphics({ add: false });
    maskG.fillStyle(0xffffff, 1).fillRect(s.x + 8, s.y - 50, 500, 100);
    sword.setMask(maskG.createGeometryMask());
    s.maskG = maskG;

    // 최종 위치: 밖으로 나온 부분(가드+손잡이)이 옆 구멍(간격 78px) 전에 끝나게 깊이 꽂는다
    this.tweens.add({
      targets: sword, x: s.x - 20, duration: 140, ease: 'Quad.easeIn',
      onComplete: () => {
        if (i === this.trigger) this.launch(i);
        else this.safe(i);
      },
    });
  }

  launch(i) {
    this.launched = true;
    // 트리거 구멍은 빨간색으로 공개(색상 연결: 위험색 — 악어 이빨과 동일 규칙)
    const s = this.slots[i];
    s.slit.clear();
    s.slit.fillStyle(C.danger, 1).fillRoundedRect(s.x - 30, s.y - 12, 60, 24, 10);
    // 펑! 해적 발사(Peak — 위로 회전하며 날아간다), 눈은 X(기절)
    this.eyesNormal.setVisible(false);
    this.eyesX.setVisible(true);
    Sfx.play('bang');
    this.time.delayedCall(350, () => Sfx.play('win')); // Peak-End: 펑 뒤 당첨 팡파르
    this.burst(this.cx, 452, C.warning, 40);
    this.colorFlash(C.warning, 220);
    this.shake(0.012, 260);
    // 랜덤 발사: 방향·거리·높이·회전량이 매판 다르다 — 회전은 나는 방향과 같은 쪽(자연스러운 스핀).
    // 가로는 등속 감속(Quad), 세로는 Back 오버슈트 — 둘이 겹치면 포물선처럼 보인다.
    const dir = this.rng.pick([-1, 1]);
    const tx = Phaser.Math.Clamp(this.cx + dir * this.rng.between(60, 250), 90, 630);
    const ty = this.rng.between(70, 130); // 문구(y174–)를 침범하지 않는 상한
    const spin = dir * this.rng.between(540, 1080);
    this.tweens.add({
      targets: this.pirate, y: ty, angle: spin, scale: 1.15, duration: 700, ease: 'Back.easeOut',
    });
    this.tweens.add({ targets: this.pirate, x: tx, duration: 700, ease: 'Quad.easeOut' });
    this.hint.setColor(css(C.warning));
    this.hint.setText(`펑!! ${this.doneCount}번째 칼에 발사 — 당첨 🎉`);
    this.hint.setScale(0);
    this.tweens.add({ targets: this.hint, scale: 1, duration: 340, ease: EASE.bounce });
    this.unlock();
  }

  safe(i) {
    Sfx.play('pop'); // 안도(마이크로 보상)
    const left = SLOTS - this.doneCount;
    this.hint.setColor(css(C.success));
    this.hint.setText(`세이프! 남은 구멍 ${left} · 트리거 확률 1/${left}`); // 정직한 확률
    this.unlock();
  }
}
