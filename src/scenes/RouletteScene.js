// 메뉴 룰렛 — 시간대(아침/점심/저녁)에 따라 다른 메뉴 세트를 돌린다.
// 기본값은 한국인 선호 음식 트렌드 기반이며, 사용자가 추가/삭제할 수 있고 localStorage에 저장된다.
// 정직한 매핑: 결과를 RNG로 먼저 정하고 포인터 칸에 정확히 멈추게 회전 각을 역산(game-mechanics A-1).
import MiniGame from '../MiniGame.js';
import { C, css, FONT, EASE, RADIUS } from '../theme.js';
import { makeButton } from '../ui.js';
import { mealForPhase } from '../timeOfDay.js';
import { Sfx } from '../sfx.js';

// 트렌드 조사 기반 기본 메뉴(trend-research.md §6, 사용자가 편집 가능)
const MEALS = {
  // 아침: 간편식 전환 트렌드(편의점·베이커리 급증, 전통 밥 약 40%)
  breakfast: { label: '아침', defaults: ['토스트', '샌드위치', '삼각김밥', '김밥', '샐러드', '요거트', '시리얼', '계란후라이', '죽', '집밥'] },
  // 점심: 직장인 선호 조사(제육볶음 1위, 백반·찌개류·짬뽕·덮밥 상위)
  lunch: { label: '점심', defaults: ['제육볶음', '백반', '김치찌개', '된장찌개', '순두부찌개', '비빔밥', '짬뽕', '돈까스', '부대찌개', '냉면'] },
  // 저녁: 배달 순위(치킨>피자>족발·보쌈>햄버거) + 외식 대표(삼겹살 등)
  dinner: { label: '저녁', defaults: ['치킨', '피자', '족발', '보쌈', '햄버거', '삼겹살', '회', '찜닭', '마라탕', '국밥'] },
  // 야식: 조사(치킨 54.7% 압도적, 라면 31.1%, 떡볶이 20.6%, 족발·보쌈, 분식)
  latenight: { label: '야식', defaults: ['치킨', '라면', '떡볶이', '족발', '보쌈', '피자', '순대', '튀김', '곱창', '김밥'] },
};

// 🍟 이스터에그: 감자튀김은 시간대와 무관하게 항상 존재하며, 노란 칸은 감자튀김 전용.
const FRY = '감자튀김';
const FRY_COLOR = C.warning;
const OTHER_COLORS = [C.primary, C.success, C.danger, 0xc77dff]; // 노랑 제외 순환

function ensureFry(items) {
  if (!items.includes(FRY)) items.push(FRY);
  return items;
}

// 모드/보증/숫자 설정 (모드는 저장하지 않음 — 재진입 시 항상 기본 '메뉴' 모드)
const LS_NUM = 'dori.roulette.numberCount'; // 숫자 모드 칸 수
const LS_SPINS = 'dori.roulette.spins';     // 🍟 보증 카운터(메뉴 모드 전용)
const PITY = 10;                            // 10번째 스핀은 감자튀김 보증(공개 규칙 — docs/game.md)
const NUM_COLORS = [C.primary, C.success, C.warning, C.danger, 0xc77dff]; // 숫자 모드는 노랑 포함 순환

function loadStr(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch (e) { return fallback; }
}
function saveStr(key, v) {
  try { localStorage.setItem(key, v); } catch (e) { /* 무시 */ }
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

    // 시간대 → 식사 종류 → 메뉴(저장분 우선) / 모드(메뉴·숫자) 복원
    this.mealKey = mealForPhase(this.timePhase && this.timePhase.key);
    this.meal = MEALS[this.mealKey];
    this.mode = 'menu'; // 재진입 시 항상 기본(메뉴) 모드로 시작
    this.numberCount = Phaser.Math.Clamp(parseInt(loadStr(LS_NUM, '6'), 10) || 6, 2, 16);
    this.setupItems();
    this.makeFryTexture();

    // 제목은 포인터(원판 위 y≈214~266)와 겹치지 않게 충분히 위에 배치
    this.titleText = this.add.text(this.cx, 140, this.titleFor(), {
      fontFamily: FONT, fontSize: '48px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5);

    // 모드 토글(메뉴 ↔ 숫자) — 우측 상단
    this.modeBtn = this.add.text(width - 32, 140, this.mode === 'menu' ? '🔢 숫자로' : '🍽 메뉴로', {
      fontFamily: FONT, fontSize: '28px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    this.modeBtn.on('pointerover', () => this.modeBtn.setColor(css(C.primary)));
    this.modeBtn.on('pointerout', () => this.modeBtn.setColor(css(C.subtext)));
    this.modeBtn.on('pointerup', () => this.toggleMode());

    this.buildWheel();
    this.buildPointer();
    this.updateFryHint(); // 진입 시 카운터가 이미 9면 바로 반짝임

    this.resultText = this.add.text(this.cx, 930, this.defaultHint(), {
      fontFamily: FONT, fontSize: '38px', color: css(C.subtext), fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);

    this.spinBtn = makeButton(this, {
      x: this.cx, y: 1104, w: 360, h: 100, label: '돌리기', variant: 'primary',
      onClick: () => this.spin(),
    });

    // 보조 액션: 메뉴 모드=편집 / 숫자 모드=개수 설정
    this.editBtn = this.add.text(this.cx, 1206, this.editLabel(), {
      fontFamily: FONT, fontSize: '30px', color: css(C.subtext),
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.editBtn.on('pointerover', () => this.editBtn.setColor(css(C.primary)));
    this.editBtn.on('pointerout', () => this.editBtn.setColor(css(C.subtext)));
    this.editBtn.on('pointerup', () => {
      if (this.mode === 'menu') this.openEditor();
      else this.promptNumberCount();
    });
  }

  // 모드에 따른 항목 구성(숫자 모드엔 감자튀김 없음)
  setupItems() {
    if (this.mode === 'number') {
      this.items = Array.from({ length: this.numberCount }, (_, i) => String(i + 1));
    } else {
      this.items = ensureFry(loadItems(this.mealKey, this.meal.defaults));
    }
  }

  titleFor() { return this.mode === 'number' ? '숫자 룰렛' : `${this.meal.label} 메뉴 룰렛`; }

  defaultHint() { return this.mode === 'number' ? '돌려서 숫자를 정하세요' : '돌려서 메뉴를 정하세요'; }

  editLabel() { return this.mode === 'number' ? '# 숫자 개수' : '✎ 메뉴 편집'; }

  toggleMode() {
    if (this.locked) return;
    this.mode = this.mode === 'menu' ? 'number' : 'menu';
    this.setupItems();
    this.rebuildWheel();
    this.titleText.setText(this.titleFor());
    this.modeBtn.setText(this.mode === 'menu' ? '🔢 숫자로' : '🍽 메뉴로');
    this.editBtn.setText(this.editLabel());
    this.resultText.setColor(css(C.subtext)).setText(this.defaultHint()).setScale(1);
    this.spinBtn.setLabel('돌리기');
  }

  promptNumberCount() {
    if (this.locked) return;
    const input = window.prompt('숫자 개수 (2~16)');
    if (input == null) return;
    const n = parseInt(input.trim(), 10);
    if (!n || n < 2 || n > 16) {
      this.resultText.setColor(css(C.warning)).setText('2~16 사이로 입력해 주세요');
      return;
    }
    this.numberCount = n;
    saveStr(LS_NUM, String(n));
    this.setupItems();
    this.rebuildWheel();
    this.resultText.setColor(css(C.subtext)).setText(this.defaultHint()).setScale(1);
    this.spinBtn.setLabel('돌리기');
  }

  // 🍟 파티클용 텍스처: 시스템 이모지를 렌더텍스처로 굽는다(외부 에셋 없음 → 라이선스 클린)
  makeFryTexture() {
    if (this.textures.exists('fries')) return;
    const t = this.add.text(0, 0, '🍟', { fontSize: '44px' }).setVisible(false);
    const rt = this.make.renderTexture({ width: 56, height: 56 }, false);
    rt.draw(t, 4, 2);
    rt.saveTexture('fries');
    t.destroy();
    rt.destroy();
  }

  // 칸 색 배정: 인접 칸(마지막↔첫 칸 순환 포함)에 같은 색 금지.
  // 메뉴 모드에서 노랑은 감자튀김 전용(팔레트에서 제외되어 자동 보장).
  computeSliceColors() {
    const n = this.items.length;
    const palette = this.mode === 'number' ? NUM_COLORS : OTHER_COLORS;
    const colors = new Array(n);
    for (let i = 0; i < n; i += 1) {
      if (this.mode === 'menu' && this.items[i] === FRY) { colors[i] = FRY_COLOR; continue; }
      const avoid = new Set();
      if (i > 0) avoid.add(colors[i - 1]);
      if (i === n - 1) avoid.add(colors[0]); // 원형: 마지막 칸은 첫 칸과도 달라야
      let c = palette[i % palette.length];
      for (let k = 0; avoid.has(c) && k < palette.length; k += 1) {
        c = palette[(i + k + 1) % palette.length];
      }
      colors[i] = c;
    }
    this.sliceColors = colors;
  }

  colorFor(i) { return this.sliceColors[i]; }

  buildWheel() {
    this.n = this.items.length;
    this.sliceAngle = 360 / this.n;
    this.computeSliceColors();
    const fontSize = this.n > 10 ? 24 : 30;

    this.wheel = this.add.container(this.cx, this.cy);

    const g = this.add.graphics();
    for (let i = 0; i < this.n; i += 1) {
      const start = Phaser.Math.DegToRad(i * this.sliceAngle);
      const end = Phaser.Math.DegToRad((i + 1) * this.sliceAngle);
      g.fillStyle(this.colorFor(i), 1);
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
      const display = name === FRY ? `🍟 ${name}` : name;
      const label = this.add.text(lx, ly, display, {
        fontFamily: FONT, fontSize: `${fontSize}px`, color: css(C.bg), fontStyle: 'bold',
      }).setOrigin(0.5);
      let rot = mid;
      if (Math.cos(mid) < 0) rot += Math.PI;
      label.setRotation(rot);
      // 🍟 숨은 치트 진입점(더블탭) — 이스터에그라 커서 힌트 없음
      if (name === FRY && this.mode === 'menu') {
        label.setInteractive();
        label.on('pointerup', () => this.onFryTap());
      }
      this.wheel.add(label);
    });

    const hub = this.add.circle(0, 0, 40, C.surface).setStrokeStyle(6, C.bg);
    this.wheel.add(hub);
  }

  rebuildWheel() {
    if (this.wheel) this.wheel.destroy();
    this.fryHint = null; // 휠과 함께 파괴됨
    this.wheelAngle = 0;
    this.buildWheel();
    this.updateFryHint();
  }

  // 특정 칸 위에 흰 오버레이(반짝임용) — 휠 컨테이너에 넣어 함께 회전
  sliceOverlay(i) {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    g.slice(0, 0, this.radius, Phaser.Math.DegToRad(i * this.sliceAngle), Phaser.Math.DegToRad((i + 1) * this.sliceAngle), false);
    g.closePath();
    g.fillPath();
    g.setAlpha(0);
    this.wheel.add(g);
    return g;
  }

  // 🍟 보증 예고: 9번째 스핀 뒤(카운터 9)부터 감자튀김 칸이 은은하게 반짝인다(정직한 힌트)
  updateFryHint() {
    const pity = parseInt(loadStr(LS_SPINS, '0'), 10) || 0;
    const need = this.mode === 'menu' && pity >= PITY - 1 && this.items.indexOf(FRY) !== -1;
    if (!need) {
      if (this.fryHint) { this.fryHint.forEach((o) => o.destroy()); this.fryHint = null; }
      return;
    }
    if (this.fryHint) return;
    const i = this.items.indexOf(FRY);
    const glow = this.sliceOverlay(i);
    this.tweens.add({ targets: glow, alpha: 0.35, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const mid = Phaser.Math.DegToRad((i + 0.5) * this.sliceAngle);
    const spark = this.add.text(Math.cos(mid) * this.radius * 0.85, Math.sin(mid) * this.radius * 0.85, '✨', {
      fontSize: '32px',
    }).setOrigin(0.5);
    this.wheel.add(spark);
    this.fryHint = [glow, spark];
  }

  // 🍟 숨은 치트: 감자튀김 칸 더블탭 → 칸이 반짝이며 감자튀김 확정 스핀
  onFryTap() {
    if (this.locked || this.mode !== 'menu') return;
    const now = this.time.now;
    if (this.lastFryTap && now - this.lastFryTap < 350) {
      this.lastFryTap = 0;
      this.flashFrySlice(() => this.spin(true));
    } else {
      this.lastFryTap = now;
    }
  }

  flashFrySlice(onDone) {
    const i = this.items.indexOf(FRY);
    if (i === -1) { onDone(); return; }
    Sfx.play('pop');
    const g = this.sliceOverlay(i);
    this.tweens.add({
      targets: g, alpha: 0.7, duration: 110, yoyo: true, repeat: 2, ease: 'Quad.easeInOut',
      onComplete: () => { g.destroy(); onDone(); },
    });
  }

  buildPointer() {
    const topY = this.cy - this.radius;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25).fillTriangle(this.cx - 26, topY - 44, this.cx + 26, topY - 44, this.cx, topY + 10);
    g.fillStyle(C.text, 1).fillTriangle(this.cx - 24, topY - 46, this.cx + 24, topY - 46, this.cx, topY + 6);
  }

  spin(forceFry = false) {
    if (this.locked) return;
    this.lock();
    this.spinBtn.disableButton();
    this.resultText.setColor(css(C.subtext));
    this.resultText.setText('...');

    let winner;
    if (this.mode === 'menu') {
      // 🍟 보증(피티): 10번째 스핀은 감자튀김 확정 — 공개 규칙(docs/game.md)
      let pity = parseInt(loadStr(LS_SPINS, '0'), 10) || 0;
      pity += 1;
      const fryIdx = this.items.indexOf(FRY);
      if (forceFry && fryIdx !== -1) winner = fryIdx; // 더블탭 치트
      else if (pity >= PITY && fryIdx !== -1) winner = fryIdx;
      else winner = this.rng.between(0, this.n - 1);
      // 감자튀김이 나오면(보증이든 자연이든) 카운터 리셋
      if (this.items[winner] === FRY) pity = 0;
      saveStr(LS_SPINS, String(pity));
    } else {
      winner = this.rng.between(0, this.n - 1);
    }
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
    // 색상 연결(color linkage): 결과 텍스트·플래시를 당첨 칸 색과 매칭 → 출처가 색으로 이어짐
    const sliceColor = this.colorFor(winner);
    const isFry = this.mode === 'menu' && this.items[winner] === FRY;
    let text;
    if (isFry) text = `오늘 ${this.meal.label}은\n🍟 감자튀김 !!`;
    else if (this.mode === 'number') text = `결과는\n${this.items[winner]} !`;
    else text = `오늘 ${this.meal.label}은\n${this.items[winner]} !`;
    this.resultText.setColor(css(sliceColor));
    this.resultText.setText(text);
    this.resultText.setScale(0);
    this.tweens.add({ targets: this.resultText, scale: 1, duration: 320, ease: EASE.bounce });
    this.colorFlash(sliceColor, 180);
    if (isFry) {
      // 🍟 이스터에그: 감자튀김 파티클이 쏟아진다
      this.friesBurst(this.cx, this.cy - this.radius);
      this.friesBurst(this.cx, 930);
      this.shake(0.007, 220);
    } else {
      this.burst(this.cx, this.cy - this.radius, sliceColor, 26); // 당첨 칸(포인터) 위치에서 폭발
    }
    Sfx.play('win');

    this.spinBtn.enableButton();
    this.spinBtn.setLabel('다시 돌리기');
    this.unlock();
    this.updateFryHint(); // 보증 카운터 9면 반짝임 시작, 감자튀김이 나왔으면 해제
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
      const outlineColor = kind === 'add' ? C.primary : kind === 'reset' ? C.warning : null;
      const t = this.add.text(0, 0, labelStr, {
        fontFamily: FONT, fontSize: '28px',
        color: outlineColor ? css(outlineColor) : css(C.text), fontStyle: 'bold',
      }).setOrigin(0.5);
      const w = Math.ceil(t.width) + 44;
      if (x + w > maxX) { x = startX; y += chipH + gap; }

      const g = this.add.graphics();
      if (outlineColor) g.lineStyle(2, outlineColor, 1).strokeRoundedRect(0, 0, w, chipH, 14);
      else g.fillStyle(C.surfaceAlt, 1).fillRoundedRect(0, 0, w, chipH, 14);
      t.setPosition(w / 2, chipH / 2);

      const chip = this.add.container(x, y, [g, t]);
      const hit = this.add.rectangle(w / 2, chipH / 2, w, chipH, 0xffffff, 0).setInteractive({ useHandCursor: true });
      chip.add(hit);
      hit.on('pointerup', onTap);
      this.chipsBox.add(chip);

      x += w + gap;
    };

    this.items.forEach((name) => {
      const display = name === FRY ? `🍟 ${name}` : `${name}  ✕`; // 감자튀김은 삭제 불가 표시
      addChip(display, 'item', () => this.removeItem(name));
    });
    addChip('+ 추가', 'add', () => this.addItem());
    addChip('↺ 기본값', 'reset', () => this.resetItems());
  }

  // 이 시간대만 기본 메뉴로 복원(다른 시간대 저장분은 그대로)
  resetItems() {
    try { localStorage.removeItem(keyFor(this.mealKey)); } catch (e) { /* 무시 */ }
    this.items = ensureFry([...this.meal.defaults]);
    this.rebuildWheel();
    this.renderChips();
    this.flashNote(`${this.meal.label} 메뉴를 기본값으로 복원했어요`);
  }

  // 🍟 이모지 파티클 폭발(이스터에그 전용)
  friesBurst(x, y) {
    const em = this.add.particles(x, y, 'fries', {
      speed: { min: 180, max: 480 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0.4 },
      alpha: { start: 1, end: 0 },
      rotate: { min: -180, max: 180 },
      lifespan: { min: 600, max: 1100 },
      gravityY: 800,
      emitting: false,
    }).setDepth(60);
    em.explode(30);
    this.time.delayedCall(1300, () => em.destroy());
  }

  removeItem(name) {
    if (name === FRY) { this.flashNote('감자튀김은 영원해요 🍟'); return; }
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
    this.resultText.setColor(css(C.subtext)).setText(this.defaultHint()).setScale(1);
    this.spinBtn.setLabel('돌리기');
  }
}
