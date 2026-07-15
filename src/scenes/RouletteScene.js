// 메뉴 룰렛 — 시간대(아침/점심/저녁)에 따라 다른 메뉴 세트를 돌린다.
// 기본값은 한국인 선호 음식 트렌드 기반이며, 사용자가 추가/삭제할 수 있고 localStorage에 저장된다.
// 정직한 매핑: 결과를 RNG로 먼저 정하고 포인터 칸에 정확히 멈추게 회전 각을 역산(game-mechanics A-1).
import MiniGame from '../MiniGame.js';
import { C, css, FONT, SLICE, EASE, RADIUS } from '../theme.js';
import { makeButton } from '../ui.js';

// 트렌드 기반 기본 메뉴(사용자가 편집 가능)
const MEALS = {
  breakfast: { label: '아침', defaults: ['토스트', '샌드위치', '김밥', '시리얼', '계란후라이', '샐러드', '베이글', '죽', '요거트', '과일'] },
  lunch: { label: '점심', defaults: ['김치찌개', '된장찌개', '제육볶음', '비빔밥', '돈까스', '라면', '냉면', '짜장면', '부대찌개', '순두부찌개'] },
  dinner: { label: '저녁', defaults: ['치킨', '삼겹살', '피자', '족발', '보쌈', '회', '찜닭', '마라탕', '파스타', '국밥'] },
};

function mealForPhase(phaseKey) {
  if (phaseKey === 'morning') return 'breakfast';
  if (phaseKey === 'evening' || phaseKey === 'night') return 'dinner';
  return 'lunch'; // noon, afternoon
}

const keyFor = (mealKey) => `dori.roulette.${mealKey}`;

function loadItems(mealKey, defaults) {
  try {
    const raw = localStorage.getItem(keyFor(mealKey));
    if (raw) {
      const a = JSON.parse(raw);
      if (Array.isArray(a) && a.length >= 2) return a;
    }
  } catch (e) { /* 저장소 접근 불가 시 무시 */ }
  return [...defaults];
}

function saveItems(mealKey, items) {
  try { localStorage.setItem(keyFor(mealKey), JSON.stringify(items)); } catch (e) { /* 무시 */ }
}

export default class RouletteScene extends MiniGame {
  constructor() {
    super('Roulette');
  }

  onCreate() {
    const { width } = this.scale;
    this.cx = width / 2;
    this.cy = 560;
    this.radius = 300;
    this.wheelAngle = 0;

    // 시간대 → 식사 종류 → 메뉴(저장분 우선)
    this.mealKey = mealForPhase(this.timePhase && this.timePhase.key);
    this.meal = MEALS[this.mealKey];
    this.items = loadItems(this.mealKey, this.meal.defaults);

    this.titleText = this.add.text(this.cx, 210, `${this.meal.label} 메뉴 룰렛`, {
      fontFamily: FONT, fontSize: '48px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.buildWheel();
    this.buildPointer();

    this.resultText = this.add.text(this.cx, 930, '돌려서 메뉴를 정하세요', {
      fontFamily: FONT, fontSize: '38px', color: css(C.subtext), fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);

    this.spinBtn = makeButton(this, {
      x: this.cx, y: 1104, w: 360, h: 100, label: '돌리기', variant: 'primary',
      onClick: () => this.spin(),
    });

    // 메뉴 편집 진입(부담 없는 보조 액션)
    this.editBtn = this.add.text(this.cx, 1206, '✎ 메뉴 편집', {
      fontFamily: FONT, fontSize: '30px', color: css(C.subtext),
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.editBtn.on('pointerover', () => this.editBtn.setColor(css(C.primary)));
    this.editBtn.on('pointerout', () => this.editBtn.setColor(css(C.subtext)));
    this.editBtn.on('pointerup', () => this.openEditor());
  }

  buildWheel() {
    this.n = this.items.length;
    this.sliceAngle = 360 / this.n;
    const fontSize = this.n > 10 ? 24 : 30;

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
    g.lineStyle(6, C.bg, 1).strokeCircle(0, 0, this.radius);
    this.wheel.add(g);

    this.items.forEach((name, i) => {
      const mid = Phaser.Math.DegToRad((i + 0.5) * this.sliceAngle);
      const lx = Math.cos(mid) * this.radius * 0.62;
      const ly = Math.sin(mid) * this.radius * 0.62;
      const label = this.add.text(lx, ly, name, {
        fontFamily: FONT, fontSize: `${fontSize}px`, color: css(C.bg), fontStyle: 'bold',
      }).setOrigin(0.5);
      let rot = mid;
      if (Math.cos(mid) < 0) rot += Math.PI;
      label.setRotation(rot);
      this.wheel.add(label);
    });

    const hub = this.add.circle(0, 0, 40, C.surface).setStrokeStyle(6, C.bg);
    this.wheel.add(hub);
  }

  rebuildWheel() {
    if (this.wheel) this.wheel.destroy();
    this.wheelAngle = 0;
    this.buildWheel();
  }

  buildPointer() {
    const topY = this.cy - this.radius;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25).fillTriangle(this.cx - 26, topY - 44, this.cx + 26, topY - 44, this.cx, topY + 10);
    g.fillStyle(C.text, 1).fillTriangle(this.cx - 24, topY - 46, this.cx + 24, topY - 46, this.cx, topY + 6);
  }

  spin() {
    if (this.locked) return;
    this.lock();
    this.spinBtn.disableButton();
    this.resultText.setColor(css(C.subtext));
    this.resultText.setText('...');

    const winner = this.rng.between(0, this.n - 1);
    const winnerCenter = (winner + 0.5) * this.sliceAngle;

    const spins = 4;
    const currentMod = ((this.wheelAngle % 360) + 360) % 360;
    const targetMod = (((270 - winnerCenter) % 360) + 360) % 360;
    const delta = ((targetMod - currentMod + 360) % 360) + 360 * spins;
    const finalAngle = this.wheelAngle + delta;

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
    this.resultText.setText(`오늘 ${this.meal.label}은\n${this.items[winner]} !`);
    this.resultText.setScale(0);
    this.tweens.add({ targets: this.resultText, scale: 1, duration: 320, ease: EASE.bounce });
    this.cameras.main.flash(180, 108, 199, 255);

    this.spinBtn.enableButton();
    this.spinBtn.setLabel('다시 돌리기');
    this.unlock();
  }

  // ===== 메뉴 편집 =====
  openEditor() {
    if (this.editor || this.locked) return;
    const { width, height } = this.scale;

    this.editor = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.72).setOrigin(0).setInteractive();
    this.editor.add(dim);

    const px = 40; const py = 180; const pw = 640; const ph = 900;
    this.editorPanel = { px, py, pw };
    const panel = this.add.graphics();
    panel.fillStyle(C.surface, 1).fillRoundedRect(px, py, pw, ph, RADIUS);
    panel.lineStyle(2, C.surfaceAlt, 1).strokeRoundedRect(px, py, pw, ph, RADIUS);
    this.editor.add(panel);

    this.editorTitle = this.add.text(width / 2, py + 52, `${this.meal.label} 메뉴 편집`, {
      fontFamily: FONT, fontSize: '40px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5);
    this.editor.add(this.editorTitle);

    this.editorNote = this.add.text(width / 2, py + 100, '항목을 눌러 삭제 · ‘+ 추가’로 새 메뉴', {
      fontFamily: FONT, fontSize: '24px', color: css(C.subtext),
    }).setOrigin(0.5);
    this.editor.add(this.editorNote);

    this.chipsBox = this.add.container(0, 0);
    this.editor.add(this.chipsBox);

    const done = makeButton(this, {
      x: width / 2, y: py + ph - 66, w: 280, h: 84, label: '완료', variant: 'primary',
      onClick: () => this.closeEditor(),
    });
    this.editor.add(done);

    this.renderChips();
  }

  renderChips() {
    const { px, py, pw } = this.editorPanel;
    this.chipsBox.removeAll(true);

    const startX = px + 32;
    const startY = py + 156;
    const maxX = px + pw - 32;
    const gap = 14;
    const chipH = 64;
    let x = startX;
    let y = startY;

    const addChip = (labelStr, kind, onTap) => {
      const t = this.add.text(0, 0, labelStr, {
        fontFamily: FONT, fontSize: '28px',
        color: kind === 'add' ? css(C.primary) : css(C.text), fontStyle: 'bold',
      }).setOrigin(0.5);
      const w = Math.ceil(t.width) + 44;
      if (x + w > maxX) { x = startX; y += chipH + gap; }

      const g = this.add.graphics();
      if (kind === 'add') g.lineStyle(2, C.primary, 1).strokeRoundedRect(0, 0, w, chipH, 14);
      else g.fillStyle(C.surfaceAlt, 1).fillRoundedRect(0, 0, w, chipH, 14);
      t.setPosition(w / 2, chipH / 2);

      const chip = this.add.container(x, y, [g, t]);
      const hit = this.add.rectangle(w / 2, chipH / 2, w, chipH, 0xffffff, 0).setInteractive({ useHandCursor: true });
      chip.add(hit);
      hit.on('pointerup', onTap);
      this.chipsBox.add(chip);

      x += w + gap;
    };

    this.items.forEach((name) => addChip(`${name}  ✕`, 'item', () => this.removeItem(name)));
    addChip('+ 추가', 'add', () => this.addItem());
  }

  removeItem(name) {
    if (this.items.length <= 2) { this.flashNote('최소 2개는 있어야 해요'); return; }
    this.items = this.items.filter((x) => x !== name);
    saveItems(this.mealKey, this.items);
    this.rebuildWheel();
    this.renderChips();
  }

  addItem() {
    // 캔버스엔 입력창이 없어 브라우저 기본 입력을 사용
    const input = window.prompt(`${this.meal.label}에 추가할 메뉴`);
    if (input == null) return;
    const name = input.trim();
    if (!name) return;
    if (this.items.includes(name)) { this.flashNote('이미 있는 메뉴예요'); return; }
    if (this.items.length >= 16) { this.flashNote('최대 16개까지예요'); return; }
    this.items.push(name);
    saveItems(this.mealKey, this.items);
    this.rebuildWheel();
    this.renderChips();
  }

  flashNote(msg) {
    this.editorNote.setText(msg).setColor(css(C.warning));
    this.time.delayedCall(1200, () => {
      if (this.editorNote && this.editorNote.active) {
        this.editorNote.setText('항목을 눌러 삭제 · ‘+ 추가’로 새 메뉴').setColor(css(C.subtext));
      }
    });
  }

  closeEditor() {
    if (this.editor) { this.editor.destroy(); this.editor = null; }
    this.resultText.setColor(css(C.subtext)).setText('돌려서 메뉴를 정하세요').setScale(1);
    this.spinBtn.setLabel('돌리기');
  }
}
