// 뽑기 상자 — 랜덤 뽑기. 트렌드 조사 §2: Wheel of Names의 인기 기능 "뽑힌 항목 제거(비복원)".
// 여러 명이 순서대로 서로 다른 결과를 받아야 할 때(발표 순서·선물 교환·자리 뽑기).
// 정직한 비복원: 뽑힌 항목은 화면에서 흐려져 남은 풀이 그대로 보인다.
// 색상 연결: 항목 칩 색 = 뽑힌 카드 색 = 폭발 색.
import MiniGame from '../MiniGame.js';
import { C, css, FONT, PLAYER, EASE, RADIUS } from '../theme.js';
import { makeButton, openTextInput, closeTextInput } from '../ui.js';
import { Sfx } from '../sfx.js';

const LS_ITEMS = 'dori.draw.items';
const DEFAULTS = ['1번', '2번', '3번', '4번'];
const MIN_I = 2;
const MAX_I = 12;

function loadItems() {
  try {
    const raw = localStorage.getItem(LS_ITEMS);
    if (raw) {
      const a = JSON.parse(raw);
      if (Array.isArray(a) && a.length >= MIN_I) return a;
    }
  } catch (e) { /* 무시 */ }
  return [...DEFAULTS];
}

function saveItems(items) {
  try { localStorage.setItem(LS_ITEMS, JSON.stringify(items)); } catch (e) { /* 무시 */ }
}

export default class DrawScene extends MiniGame {
  constructor() {
    super('Draw');
  }

  onCreate() {
    const { width } = this.scale;
    this.cx = width / 2;
    this.inputOverlay = null; // 재진입 시 stale 참조 초기화
    this.items = loadItems();
    this.drawn = new Set(); // 비복원: 뽑힌 원본 인덱스

    // 레이아웃(검산): 헤더 y48(⬅·제목 40px) / 문구124–156 / 풀 칩202–394 / 상자560–740(카드 팝 450) / 편집·되돌리기989–1015 / 버튼1054–1154
    // 룰렛·사다리와 같은 패턴: 헤더 행 + 상단 문구 + 게임판 + 판 아래 컨트롤 + 주 버튼(위계 40>32>26)
    this.add.text(this.cx, 48, '뽑기 상자', {
      fontFamily: FONT, fontSize: '40px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.chipLayer = this.add.container(0, 0);
    this.renderPool();

    this.buildBox();

    // 안내·결과 공용 문구 — 상단. '(뽑힌 건 제외)'는 풀 칩이 시각적으로 보여주므로 문구에선 생략(32px 폭 확보)
    this.hint = this.add.text(this.cx, 140, '뽑기를 누르면 하나가 나와요', {
      fontFamily: FONT, fontSize: '32px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.drawBtn = makeButton(this, {
      x: this.cx, y: 1104, w: 360, h: 100, label: '뽑기', variant: 'primary',
      onClick: () => this.draw(),
    });

    // 보조 액션: 편집 / 전부 되돌리기 — 상자 아래 나란히
    this.editBtn = this.add.text(this.cx - 150, 1002, '✎ 편집', {
      fontFamily: FONT, fontSize: '26px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.editBtn.on('pointerover', () => this.editBtn.setColor(css(C.primary)));
    this.editBtn.on('pointerout', () => this.editBtn.setColor(css(C.subtext)));
    this.editBtn.on('pointerup', () => this.openEditor());

    this.resetBtn = this.add.text(this.cx + 150, 1002, '↺ 전부 되돌리기', {
      fontFamily: FONT, fontSize: '26px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.resetBtn.on('pointerover', () => this.resetBtn.setColor(css(C.warning)));
    this.resetBtn.on('pointerout', () => this.resetBtn.setColor(css(C.subtext)));
    this.resetBtn.on('pointerup', () => this.resetDrawn());
  }

  itemColor(i) {
    return PLAYER[i % PLAYER.length];
  }

  // 남은/뽑힌 풀을 항상 보여준다(정직한 비복원)
  renderPool() {
    this.chipLayer.removeAll(true);
    const perRow = 4;
    const chipW = 150;
    const chipH = 56;
    const gap = 12;
    const rows = Math.ceil(this.items.length / perRow);
    const startY = 230;

    this.items.forEach((name, i) => {
      const row = Math.floor(i / perRow);
      const inRow = Math.min(perRow, this.items.length - row * perRow);
      const rowW = inRow * chipW + (inRow - 1) * gap;
      const x = this.cx - rowW / 2 + (i % perRow) * (chipW + gap) + chipW / 2;
      const y = startY + row * (chipH + gap);
      const color = this.itemColor(i);
      const used = this.drawn.has(i);

      const g = this.add.graphics();
      g.fillStyle(C.surfaceAlt, 1).fillRoundedRect(x - chipW / 2, y - chipH / 2, chipW, chipH, 12);
      g.lineStyle(3, color, used ? 0.25 : 1).strokeRoundedRect(x - chipW / 2, y - chipH / 2, chipW, chipH, 12);
      const t = this.add.text(x, y, used ? `${name} ✓` : name, {
        fontFamily: FONT, fontSize: '24px', color: css(used ? C.subtext : color), fontStyle: 'bold',
      }).setOrigin(0.5);
      if (used) { g.setAlpha(0.5); t.setAlpha(0.55); }
      this.chipLayer.add(g);
      this.chipLayer.add(t);
      // 더블탭 = 이름 수정(숨은 어포던스 — 한 번 탭하면 힌트 안내)
      const hit = this.add.rectangle(x, y, chipW, chipH, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => this.onItemTap(i));
      this.chipLayer.add(hit);
    });

    this.rows = rows;
  }

  buildBox() {
    // 상자(y 560–740) — 카드가 여기서 튀어나온다
    this.box = this.add.container(this.cx, 650);
    const g = this.add.graphics();
    g.fillStyle(C.surface, 1).fillRoundedRect(-130, -90, 260, 180, RADIUS);
    g.lineStyle(4, C.surfaceAlt, 1).strokeRoundedRect(-130, -90, 260, 180, RADIUS);
    g.fillStyle(C.surfaceAlt, 1).fillRoundedRect(-140, -110, 280, 34, 10); // 뚜껑
    this.box.add(g);
    this.box.add(this.add.text(0, 12, '?', {
      fontFamily: FONT, fontSize: '72px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0.5));
  }

  remaining() {
    return this.items.map((_, i) => i).filter((i) => !this.drawn.has(i));
  }

  draw() {
    if (this.locked) return;
    const pool = this.remaining();
    if (pool.length === 0) { this.flashHint('모두 뽑았어요 — 전부 되돌리기!'); return; }
    this.lock();
    this.drawBtn.disableButton();
    if (this.card) { this.card.destroy(); this.card = null; }

    // 상자 흔들림(기대감 빌드업) — 덜컹거리는 틱과 함께
    this.tweens.add({
      targets: this.box, angle: { from: -5, to: 5 }, duration: 70, yoyo: true, repeat: 7, ease: 'Sine.easeInOut',
      onRepeat: () => Sfx.play('tick'),
      onComplete: () => {
        this.box.setAngle(0);
        const idx = this.rng.pick(pool); // 비복원 풀에서 공정 추첨
        this.reveal(idx);
      },
    });
  }

  reveal(idx) {
    this.drawn.add(idx);
    const color = this.itemColor(idx);
    const name = this.items[idx];

    // 카드가 상자에서 튀어나온다(색상 연결)
    this.card = this.add.container(this.cx, 630).setDepth(20);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25).fillRoundedRect(-105, -66, 210, 140, 16);
    g.fillStyle(color, 1).fillRoundedRect(-100, -70, 200, 140, 16);
    this.card.add(g);
    this.card.add(this.add.text(0, 0, name, {
      fontFamily: FONT, fontSize: '44px', color: css(C.bg), fontStyle: 'bold',
    }).setOrigin(0.5));

    this.card.setScale(0.2).setAlpha(0);
    this.tweens.add({
      targets: this.card, y: 450, scale: 1, alpha: 1, duration: 420, ease: EASE.popIn,
    });

    this.burst(this.cx, 560, color, 30);
    this.colorFlash(color, 170);
    Sfx.play('win');

    const left = this.remaining().length;
    this.hint.setColor(css(color)).setText(`${name} 당첨!   (남은 ${left}/${this.items.length})`);
    this.hint.setScale(0);
    this.tweens.add({ targets: this.hint, scale: 1, duration: 300, ease: EASE.bounce });

    this.renderPool();
    this.drawBtn.enableButton();
    if (left === 0) this.drawBtn.setLabel('끝!');
    else this.drawBtn.setLabel('또 뽑기');
    this.unlock();
  }

  resetDrawn() {
    if (this.locked) return;
    this.drawn.clear();
    if (this.card) { this.card.destroy(); this.card = null; }
    this.renderPool();
    this.hint.setColor(css(C.subtext)).setText('뽑기를 누르면 하나가 나와요').setScale(1);
    this.drawBtn.setLabel('뽑기');
  }

  flashHint(msg) {
    this.hint.setColor(css(C.warning)).setText(msg);
  }

  // ===== 항목 편집 =====
  openEditor() {
    if (this.editor || this.locked) return;
    const { width, height } = this.scale;

    this.editor = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.72).setOrigin(0).setInteractive();
    this.editor.add(dim);

    const px = 40; const py = 220; const pw = 640; const ph = 780;
    this.panelPos = { px, py, pw };
    const panel = this.add.graphics();
    panel.fillStyle(C.surface, 1).fillRoundedRect(px, py, pw, ph, RADIUS);
    panel.lineStyle(2, C.surfaceAlt, 1).strokeRoundedRect(px, py, pw, ph, RADIUS);
    this.editor.add(panel);

    this.editor.add(this.add.text(width / 2, py + 48, '뽑기 항목 편집', {
      fontFamily: FONT, fontSize: '38px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5));

    this.editorNote = this.add.text(width / 2, py + 94, `항목 ${MIN_I}–${MAX_I}개 · 눌러서 삭제 · 이름은 칩 더블탭으로 수정`, {
      fontFamily: FONT, fontSize: '22px', color: css(C.subtext),
    }).setOrigin(0.5);
    this.editor.add(this.editorNote);

    this.chipsBox = this.add.container(0, 0);
    this.editor.add(this.chipsBox);
    this.renderEditorChips();

    const done = makeButton(this, {
      x: width / 2, y: py + ph - 64, w: 280, h: 84, label: '완료', variant: 'primary',
      onClick: () => { closeTextInput(this); this.editor.destroy(); this.editor = null; },
    });
    this.editor.add(done);
  }

  renderEditorChips() {
    const { px, py, pw } = this.panelPos;
    this.chipsBox.removeAll(true);
    const startX = px + 32;
    const maxX = px + pw - 32;
    const gap = 12;
    const chipH = 60;
    let x = startX;
    let y = py + 150;

    const chip = (labelStr, opts, onTap) => {
      const t = this.add.text(0, 0, labelStr, {
        fontFamily: FONT, fontSize: '26px',
        color: css(opts.color ?? C.text), fontStyle: 'bold',
      }).setOrigin(0.5);
      const w = Math.ceil(t.width) + 40;
      if (x + w > maxX) { x = startX; y += chipH + gap; }
      const g = this.add.graphics();
      if (opts.outline) g.lineStyle(2, opts.color, 1).strokeRoundedRect(0, 0, w, chipH, 14);
      else g.fillStyle(C.surfaceAlt, 1).fillRoundedRect(0, 0, w, chipH, 14);
      t.setPosition(w / 2, chipH / 2);
      const con = this.add.container(x, y, [g, t]);
      const hit = this.add.rectangle(w / 2, chipH / 2, w, chipH, 0xffffff, 0).setInteractive({ useHandCursor: true });
      con.add(hit);
      hit.on('pointerup', onTap);
      this.chipsBox.add(con);
      x += w + gap;
    };

    this.items.forEach((name, i) => chip(`${name}  ✕`, { color: this.itemColor(i) }, () => this.removeItem(i)));
    if (this.items.length < MAX_I) chip('+ 추가', { outline: true, color: C.primary }, () => this.addItem());
    chip('↺ 기본값', { outline: true, color: C.warning }, () => this.resetItems());
  }

  // 'N번' 자동 추가(빈 번호 중 가장 작은 수) — 이름은 풀 칩 더블탭으로 수정(사다리와 같은 패턴)
  addItem() {
    let k = 1;
    while (this.items.includes(`${k}번`)) k += 1;
    this.items.push(`${k}번`);
    this.afterEdit();
  }

  // 풀 칩 더블탭 → 이름 수정(수정하면 뽑기 기록 초기화 — 기존 편집 공정성 정책과 동일)
  onItemTap(i) {
    if (this.locked) return;
    const now = this.time.now;
    if (this.lastItemTap && this.lastItemTap.i === i && now - this.lastItemTap.t < 350) {
      this.lastItemTap = null;
      this.renameItem(i);
    } else {
      this.lastItemTap = { i, t: now };
      this.toastHint('더블탭: 이름 수정');
    }
  }

  renameItem(i) {
    openTextInput(this, {
      title: '이름 수정', hint: '6자 이내', maxLength: 6,
      onSubmit: (raw) => {
        const s = raw.trim();
        if (!s || s === this.items[i]) return;
        if (this.items.includes(s)) { this.toastHint('이미 있는 이름이에요'); return; }
        this.items[i] = s;
        this.afterEdit();
      },
    });
  }

  // 잠깐 경고를 보였다가 원래 문구(결과 포함)로 복원 — flashHint와 달리 되돌아온다
  toastHint(msg) {
    if (!this.toastPrev) this.toastPrev = { text: this.hint.text, color: this.hint.style.color };
    this.hint.setColor(css(C.warning)).setText(msg).setScale(1);
    this.time.delayedCall(1200, () => {
      if (this.hint.active && this.toastPrev) {
        this.hint.setColor(this.toastPrev.color).setText(this.toastPrev.text).setScale(1);
        this.toastPrev = null;
      }
    });
  }

  removeItem(i) {
    if (this.items.length <= MIN_I) { this.flashEditorNote(`최소 ${MIN_I}개는 있어야 해요`); return; }
    this.items.splice(i, 1);
    this.afterEdit();
  }

  resetItems() {
    try { localStorage.removeItem(LS_ITEMS); } catch (e) { /* 무시 */ }
    this.items = [...DEFAULTS];
    this.afterEdit();
  }

  afterEdit() {
    saveItems(this.items);
    this.drawn.clear(); // 풀이 바뀌면 뽑기 기록 초기화(공정성)
    if (this.card) { this.card.destroy(); this.card = null; }
    this.renderPool();
    if (this.editor) this.renderEditorChips(); // 풀 칩 더블탭 수정처럼 모달 밖에서도 호출된다
    this.hint.setColor(css(C.subtext)).setText('뽑기를 누르면 하나가 나와요').setScale(1);
    this.drawBtn.setLabel('뽑기');
  }

  flashEditorNote(msg) {
    this.editorNote.setText(msg).setColor(css(C.warning));
    this.time.delayedCall(1200, () => {
      if (this.editorNote && this.editorNote.active) {
        this.editorNote.setText(`항목 ${MIN_I}–${MAX_I}개 · 눌러서 삭제 · 이름은 칩 더블탭으로 수정`).setColor(css(C.subtext));
      }
    });
  }
}
