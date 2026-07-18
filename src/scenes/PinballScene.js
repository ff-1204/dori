// 랜덤 핀볼(플링코) — 결정 돕기. 트렌드 조사 §4: "통제된 불확실성"이 핵심.
// 주도성: 떨어뜨릴 위치를 플레이어가 직접 고른다(드래그/탭). 결과는 실제 물리로.
// 도파민 설계: 핀 히트 플래시·튕김 카운터·막판 슬로모+줌·착지 파티클 폭발(Peak-End).
// 정직한 매핑: 결과를 몰래 유도하지 않는다 — 보이는 물리 그대로(핀 반발 잔떨림 포함).
import MiniGame from '../MiniGame.js';
import { C, css, FONT, SLICE, EASE, RADIUS } from '../theme.js';
import { makeButton } from '../ui.js';
import { Sfx } from '../sfx.js';

const LS_SLOTS = 'dori.pinball.slots';
const DEFAULT_SLOTS = ['꽝', '2등', '1등', '3등', '2등', '꽝']; // 1·2·3등 + 꽝꽝(가장자리)
const SLOT_N = 6;
const LEFT = 70;
const RIGHT = 650;

function loadSlots() {
  try {
    const raw = localStorage.getItem(LS_SLOTS);
    if (raw) {
      const a = JSON.parse(raw);
      if (Array.isArray(a) && a.length === SLOT_N) return a;
    }
  } catch (e) { /* 무시 */ }
  return [...DEFAULT_SLOTS];
}

function saveSlots(slots) {
  try { localStorage.setItem(LS_SLOTS, JSON.stringify(slots)); } catch (e) { /* 무시 */ }
}

export default class PinballScene extends MiniGame {
  constructor() {
    super('Pinball');
  }

  onCreate() {
    const { width } = this.scale;
    this.cx = width / 2;
    this.slots = loadSlots();
    this.hits = 0;
    this.dropX = this.cx;

    this.add.text(this.cx, 140, '랜덤 핀볼', {
      fontFamily: FONT, fontSize: '48px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.hitText = this.add.text(width - 32, 200, '', {
      fontFamily: FONT, fontSize: '26px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(1, 0.5);

    // 오늘의 맵 표기 — 매일 자정(KST)에 새 맵이라는 규칙을 정적으로 안내(카운트다운 없음)
    this.add.text(32, 200, '🗓 오늘의 맵 · 매일 자정에 새 맵', {
      fontFamily: FONT, fontSize: '26px', color: css(C.subtext),
    }).setOrigin(0, 0.5);

    this.physics.world.setBounds(LEFT, 0, RIGHT - LEFT, 1280);

    this.buildBoard();
    this.buildDropControl();

    this.resultText = this.add.text(this.cx, 1025, '위쪽을 끌어 위치를 정하고 떨어뜨리세요', {
      fontFamily: FONT, fontSize: '30px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.dropBtn = makeButton(this, {
      x: this.cx, y: 1100, w: 380, h: 100, label: '떨어뜨리기', variant: 'primary',
      onClick: () => this.drop(),
    });

    this.editBtn = this.add.text(this.cx, 1206, '✎ 칸 편집', {
      fontFamily: FONT, fontSize: '30px', color: css(C.subtext),
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.editBtn.on('pointerover', () => this.editBtn.setColor(css(C.primary)));
    this.editBtn.on('pointerout', () => this.editBtn.setColor(css(C.subtext)));
    this.editBtn.on('pointerup', () => this.openEditor());
  }

  buildBoard() {
    // 벽(시각)
    const wall = this.add.graphics();
    wall.lineStyle(4, C.surfaceAlt, 1);
    wall.lineBetween(LEFT, 360, LEFT, 1000);
    wall.lineBetween(RIGHT, 360, RIGHT, 1000);

    // 핀 — 오늘의 맵: KST 날짜를 시드로 한 결정적 랜덤 배치(단청과 같은 기법).
    // 서버 없이 누구나 같은 날 = 같은 맵, KST 자정에 교체. 보드는 낙하 전 전부 보이므로 정직.
    // 트랩 방지 제약: 핀 중심 x 115–605(벽과 틈 ≥ 36px), 행 내 중심 간격 ≥ 56px(공 지름 28 + 여유).
    const day = Math.floor((Date.now() + 9 * 3600 * 1000) / 86400000);
    const mapRng = new Phaser.Math.RandomDataGenerator([`dori-pinball-${day}`]);

    this.pegs = this.physics.add.staticGroup();
    for (let row = 0; row < 7; row += 1) {
      const n = mapRng.between(5, 7);
      const spacing = (605 - 115) / (n - 1);
      const jitter = Math.floor(Math.min(18, (spacing - 56) / 2));
      // 가끔 안쪽 핀 하나를 빼서 '구멍'을 만든다(맵마다 성격이 달라짐)
      const skipIdx = n >= 6 && mapRng.frac() < 0.35 ? mapRng.between(1, n - 2) : -1;
      for (let i = 0; i < n; i += 1) {
        if (i === skipIdx) continue;
        const x = Phaser.Math.Clamp(115 + i * spacing + mapRng.between(-jitter, jitter), 115, 605);
        const y = 400 + row * 70 + mapRng.between(-12, 12);
        const peg = this.pegs.create(x, y, 'peg');
        peg.setTint(C.subtext);
        peg.body.setCircle(9);
        peg.lastHit = 0;
      }
    }

    // 슬롯(색상 연결: 칸 색 = 결과 색)
    this.slotRects = [];
    this.slotLabels = [];
    const slotW = (RIGHT - LEFT) / SLOT_N;
    const div = this.add.graphics();
    div.lineStyle(4, C.surfaceAlt, 1);
    for (let i = 0; i < SLOT_N; i += 1) {
      const x = LEFT + slotW * (i + 0.5);
      const color = SLICE[i % SLICE.length];
      const rect = this.add.rectangle(x, 945, slotW - 10, 96, color, 0.22)
        .setStrokeStyle(3, color, 0.9);
      const label = this.add.text(x, 945, this.slots[i], {
        fontFamily: FONT, fontSize: '26px', color: css(color), fontStyle: 'bold',
      }).setOrigin(0.5);
      this.slotRects.push(rect);
      this.slotLabels.push(label);
      if (i > 0) div.lineBetween(LEFT + slotW * i, 895, LEFT + slotW * i, 995);
    }
  }

  buildDropControl() {
    // 고스트 공 + 화살표(주도성: 여기서 떨어진다는 정직한 시그니파이어)
    this.ghost = this.add.image(this.dropX, 300, 'ball').setTint(C.primary).setAlpha(0.55);
    this.arrow = this.add.graphics();
    this.drawArrow();

    // 상단 조작 영역: 드래그로 위치 선택, 탭으로 즉시 낙하(빠른 라운드 = 도파민)
    // 드래그는 씬 전역으로 추적 — 누른 채 영역 밖(아래)으로 끌어도 이어지고, 놓는 순간 낙하한다.
    const zone = this.add.rectangle(this.cx, 290, RIGHT - LEFT, 150, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    const follow = (p) => {
      this.dropX = Phaser.Math.Clamp(p.x, LEFT + 24, RIGHT - 24);
      this.ghost.x = this.dropX;
      this.drawArrow();
    };
    zone.on('pointerdown', (p) => {
      if (this.locked) return;
      this.dragging = true;
      follow(p);
    });
    zone.on('pointermove', (p) => {
      if (this.locked || this.dragging) return;
      follow(p); // 마우스 hover 미리보기(보조)
    });
    this.input.on('pointermove', (p) => {
      if (this.locked || !this.dragging) return;
      follow(p);
    });
    const release = (p) => {
      if (!this.dragging) return;
      this.dragging = false;
      if (this.locked) return;
      follow(p);
      this.drop();
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  drawArrow() {
    this.arrow.clear();
    this.arrow.fillStyle(C.primary, 0.9);
    this.arrow.fillTriangle(this.dropX - 14, 332, this.dropX + 14, 332, this.dropX, 356);
  }

  drop() {
    if (this.locked) return;
    this.lock();
    this.dropBtn.disableButton();
    this.hits = 0;
    this.hitText.setText('');
    this.resultText.setColor(css(C.subtext)).setText('...').setScale(1);
    this.slowmoDone = false;

    this.ball = this.physics.add.image(this.dropX, 300, 'ball').setTint(C.text);
    this.ball.body.setCircle(14);
    this.ball.setBounce(0.55);
    this.ball.setCollideWorldBounds(true);
    this.ball.body.setGravityY(1500);
    this.ball.setVelocityX(this.rng.between(-20, 20)); // 미세 초기 흔들림(생동감)

    // 끼임 감시: 최저 도달 y가 갱신되지 않으면 넛지로 탈출시킨다(핀-벽 틈 트랩 대비)
    this.maxBallY = this.ball.y;
    this.lastProgressAt = this.time.now;
    this.nudgeCount = 0;

    this.physics.add.collider(this.ball, this.pegs, (ball, peg) => this.onPegHit(ball, peg));
  }

  onPegHit(ball, peg) {
    const now = this.time.now;
    if (now - peg.lastHit < 90) return;
    peg.lastHit = now;

    // 핀 히트 피드백: 플래시 + 팝(도파민 마이크로 보상)
    peg.setTint(C.primary);
    this.tweens.add({
      targets: peg, scale: 1.5, duration: 70, yoyo: true, ease: 'Quad.easeOut',
      onComplete: () => { if (peg.active) { peg.setTint(C.subtext); peg.setScale(1); } },
    });

    // 실물리 잔떨림(플링코 특유의 예측불가) — 화면에 그대로 보이는 정직한 랜덤
    ball.body.velocity.x += this.rng.between(-70, 70);

    this.hits += 1;
    this.hitText.setText(`튕김 ×${this.hits}`);
    Sfx.play('tick');
  }

  update() {
    if (!this.ball || !this.ball.active) return;

    // 막판 슬로모 + 살짝 줌(기대감 → 해소 직전 긴장 연장)
    if (!this.slowmoDone && this.ball.y > 760) {
      this.slowmoDone = true;
      this.physics.world.timeScale = 2.1;
      this.cameras.main.zoomTo(1.06, 220);
    }

    // 끼임 감시: 1.2초간 아래로 진행이 없으면 틸트(넛지) — 화면에 보이는 정직한 탈출
    if (this.ball.y > this.maxBallY + 4) {
      this.maxBallY = this.ball.y;
      this.lastProgressAt = this.time.now;
    } else if (this.time.now - this.lastProgressAt > 1200) {
      this.nudgeBall();
      if (!this.ball) return; // 넛지 한도 초과로 강제 확정됐으면 이 프레임 종료
    }

    if (this.ball.y > 920) this.resolve();
  }

  // 틸트 넛지: 중앙 쪽으로 살짝 튕겨 끼임에서 빼낸다. 3회로도 못 빠지면 그 자리 기준 확정(안전망).
  nudgeBall() {
    this.nudgeCount += 1;
    this.lastProgressAt = this.time.now;
    if (this.nudgeCount > 3) { this.resolve(); return; }
    const dir = this.ball.x < this.cx ? 1 : -1;
    this.ball.setVelocity(dir * this.rng.between(200, 280), -this.rng.between(280, 400));
    this.shake(0.004, 120); // 기계를 살짝 친 듯한 연출 — 개입이 눈에 보이게(정직)
    Sfx.play('pop');
  }

  resolve() {
    const slotW = (RIGHT - LEFT) / SLOT_N;
    const idx = Phaser.Math.Clamp(Math.floor((this.ball.x - LEFT) / slotW), 0, SLOT_N - 1);
    const color = SLICE[idx % SLICE.length];
    const slotX = LEFT + slotW * (idx + 0.5);

    this.physics.world.timeScale = 1;
    this.cameras.main.zoomTo(1, 250);

    const ball = this.ball;
    this.ball = null;
    ball.disableBody(true, false);
    this.tweens.add({
      targets: ball, x: slotX, y: 945, scale: 0.8, duration: 160, ease: 'Quad.easeIn',
      onComplete: () => {
        this.tweens.add({ targets: ball, alpha: 0, duration: 350, delay: 500, onComplete: () => ball.destroy() });
      },
    });

    // Peak-End: 착지 순간에 연출 집중(색상 연결)
    const rect = this.slotRects[idx];
    this.tweens.add({ targets: rect, scaleX: 1.12, scaleY: 1.25, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
    this.burst(slotX, 930, color, 36);
    this.colorFlash(color, 190);
    this.shake(0.006, 160);
    Sfx.play('win');

    this.resultText.setColor(css(color));
    this.resultText.setText(`${this.slots[idx]} !   (튕김 ×${this.hits})`);
    this.resultText.setScale(0);
    this.tweens.add({ targets: this.resultText, scale: 1, duration: 320, ease: EASE.bounce });

    this.dropBtn.enableButton();
    this.dropBtn.setLabel('다시 떨어뜨리기');
    this.unlock();
  }

  // ===== 칸 편집(라벨만, 6칸 고정 — 물리 균등성 유지) =====
  openEditor() {
    if (this.editor || this.locked) return;
    const { width, height } = this.scale;

    this.editor = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.72).setOrigin(0).setInteractive();
    this.editor.add(dim);

    const px = 40; const py = 300; const pw = 640; const ph = 600;
    const panel = this.add.graphics();
    panel.fillStyle(C.surface, 1).fillRoundedRect(px, py, pw, ph, RADIUS);
    panel.lineStyle(2, C.surfaceAlt, 1).strokeRoundedRect(px, py, pw, ph, RADIUS);
    this.editor.add(panel);

    this.editor.add(this.add.text(width / 2, py + 52, '칸 편집 (눌러서 이름 변경)', {
      fontFamily: FONT, fontSize: '36px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5));

    this.editorNote = this.add.text(width / 2, py + 100, '칸 수는 6개 고정 · 4자 이내', {
      fontFamily: FONT, fontSize: '22px', color: css(C.subtext),
    }).setOrigin(0.5);
    this.editor.add(this.editorNote);

    this.chipsBox = this.add.container(0, 0);
    this.editor.add(this.chipsBox);
    this.renderChips(px, py, pw);

    const done = makeButton(this, {
      x: width / 2, y: py + ph - 64, w: 280, h: 84, label: '완료', variant: 'primary',
      onClick: () => { this.editor.destroy(); this.editor = null; },
    });
    this.editor.add(done);
  }

  renderChips(px, py, pw) {
    this.chipsBox.removeAll(true);
    const startX = px + 40;
    const gap = 16;
    const chipW = 176;
    const chipH = 72;
    this.slots.forEach((s, i) => {
      const x = startX + (i % 3) * (chipW + gap);
      const y = py + 150 + Math.floor(i / 3) * (chipH + gap);
      const color = SLICE[i % SLICE.length];
      const g = this.add.graphics();
      g.fillStyle(C.surfaceAlt, 1).fillRoundedRect(x, y, chipW, chipH, 14);
      g.lineStyle(3, color, 1).strokeRoundedRect(x, y, chipW, chipH, 14);
      const t = this.add.text(x + chipW / 2, y + chipH / 2, s, {
        fontFamily: FONT, fontSize: '28px', color: css(color), fontStyle: 'bold',
      }).setOrigin(0.5);
      const hit = this.add.rectangle(x + chipW / 2, y + chipH / 2, chipW, chipH, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => this.renameSlot(i));
      this.chipsBox.add(g);
      this.chipsBox.add(t);
      this.chipsBox.add(hit);
    });

    // 기본값 복원
    const rx = startX + 0;
    const ry = py + 150 + 2 * (chipH + gap) + 12;
    const rg = this.add.graphics();
    rg.lineStyle(2, C.warning, 1).strokeRoundedRect(rx, ry, 200, 60, 14);
    const rt = this.add.text(rx + 100, ry + 30, '↺ 기본값', {
      fontFamily: FONT, fontSize: '26px', color: css(C.warning), fontStyle: 'bold',
    }).setOrigin(0.5);
    const rhit = this.add.rectangle(rx + 100, ry + 30, 200, 60, 0xffffff, 0).setInteractive({ useHandCursor: true });
    rhit.on('pointerup', () => {
      try { localStorage.removeItem(LS_SLOTS); } catch (e) { /* 무시 */ }
      this.slots = [...DEFAULT_SLOTS];
      this.refreshSlotLabels();
      this.renderChips(px, py, pw);
    });
    this.chipsBox.add(rg);
    this.chipsBox.add(rt);
    this.chipsBox.add(rhit);
  }

  renameSlot(i) {
    const input = window.prompt('칸 이름 (4자 이내)');
    if (input == null) return;
    const s = input.trim();
    if (!s || s.length > 4) return;
    this.slots[i] = s;
    saveSlots(this.slots);
    this.refreshSlotLabels();
    if (this.editor) { const { x, y, w } = { x: 40, y: 300, w: 640 }; this.renderChips(x, y, w); }
  }

  refreshSlotLabels() {
    this.slotLabels.forEach((l, i) => l.setText(this.slots[i]));
  }
}
