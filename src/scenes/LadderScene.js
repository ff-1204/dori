// 사다리타기 — 결정 돕기(트렌드 조사: 커피/벌칙/청소/당첨 내기의 대표 도구).
// 공정성: 사다리는 순열(전단사)이라 결과 1:1이 자동 보장(game-theory §3).
// 정직한 매핑: '시작'을 누르면 가로 다리가 화면에 전부 공개되고,
// 경로 애니메이션은 그 다리를 그대로 따라간다(숨은 조작 없음).
// 색상 연결: 참가자 색 = 경로 색 = 결과 하이라이트 색(visual-polish §3-1a).
import MiniGame from '../MiniGame.js';
import { C, css, FONT, PLAYER, RADIUS, EASE } from '../theme.js';
import { makeButton, openTextInput, closeTextInput } from '../ui.js';
import { Sfx } from '../sfx.js';

// 가로 다리 행 수는 인원 비례(rowCount) — 인접 교환 셔플은 열 수 대비 행이 많아야
// 충분히 섞인다(적으면 출발 열 근처 도착으로 편향). 2명=8행 … 6명=16행.
const MIN_P = 2;
const MAX_P = 6; // 모바일 가독성 한계(responsive-design §7)
const NAME_MAX = 4; // 라벨 겹침 방지(글자 수 제한)

// 시작 전 기본 안내(상단 공용 문구 자리) — 이름 수정 어포던스를 노출
const HINT_SETUP = '이름을 더블탭으로 수정할 수 있어요';

const LS_NAMES = 'dori.ladder.names';
const LS_RESULTS = 'dori.ladder.results';

function loadList(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const a = JSON.parse(raw);
      if (Array.isArray(a) && a.length >= MIN_P) return a;
    }
  } catch (e) { /* 무시 */ }
  return [...fallback];
}

function saveList(key, list) {
  try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) { /* 무시 */ }
}

export default class LadderScene extends MiniGame {
  constructor() {
    super('Ladder');
  }

  onCreate() {
    const { width } = this.scale;
    this.cx = width / 2;
    this.editor = null; // 재진입 시 stale 참조 초기화
    this.inputOverlay = null;

    // 레이아웃(요소 점유 범위 검산: 제목116–164 / 안내208–236 / 이름286–314 / 사다리330–920 / 결과940–975 / 버튼1050–1150 / 편집1191–1221)
    this.topY = 330;
    this.bottomY = 920;
    this.leftX = 90;
    this.rightX = 630;

    this.names = loadList(LS_NAMES, ['1번', '2번', '3번', '4번']);
    this.results = loadList(LS_RESULTS, ['커피', '통과', '통과', '통과']);
    this.syncResults();

    this.started = false;
    this.traced = new Set();

    this.add.text(this.cx, 140, '사다리타기', {
      fontFamily: FONT, fontSize: '48px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.boardLayer = this.add.container(0, 0);   // 세로줄 + 다리
    this.traceLayer = this.add.container(0, 0);   // 경로(색상 연결)
    this.labelLayer = this.add.container(0, 0);   // 이름/결과 라벨

    // 안내 문구는 상단(제목과 이름 사이) 한 곳 — 설정·진행·결과 요약 공용
    this.hint = this.add.text(this.cx, 222, HINT_SETUP, {
      fontFamily: FONT, fontSize: '28px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.mainBtn = makeButton(this, {
      x: this.cx, y: 1100, w: 360, h: 100, label: '시작', variant: 'primary',
      onClick: () => this.startOrShuffle(),
    });

    this.editBtn = this.add.text(this.cx, 1206, '✎ 참가자·결과 편집', {
      fontFamily: FONT, fontSize: '30px', color: css(C.subtext),
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.editBtn.on('pointerover', () => this.editBtn.setColor(css(C.primary)));
    this.editBtn.on('pointerout', () => this.editBtn.setColor(css(C.subtext)));
    this.editBtn.on('pointerup', () => this.openEditor());

    this.drawBoard();
  }

  // 결과 개수를 참가자 수에 맞춘다(모자라면 '통과' 채움)
  syncResults() {
    const n = this.names.length;
    while (this.results.length < n) this.results.push('통과');
    if (this.results.length > n) this.results = this.results.slice(0, n);
  }

  colX(i) {
    const n = this.names.length;
    return this.leftX + (i * (this.rightX - this.leftX)) / (n - 1);
  }

  rowCount() { return 6 + 2 * (this.names.length - 1); }

  rowY(row) {
    return this.topY + 40 + (row * (this.bottomY - this.topY - 80)) / (this.rowCount() - 1);
  }

  // ===== 보드 그리기 =====
  drawBoard() {
    this.boardLayer.removeAll(true);
    this.traceLayer.removeAll(true);
    this.labelLayer.removeAll(true);
    this.traced.clear();

    const n = this.names.length;
    const nameSize = n >= 6 ? 24 : 28;

    // 세로줄
    const g = this.add.graphics();
    g.lineStyle(5, C.surfaceAlt, 1);
    for (let i = 0; i < n; i += 1) {
      g.lineBetween(this.colX(i), this.topY, this.colX(i), this.bottomY);
    }
    this.boardLayer.add(g);

    // 다리(시작 후에만 존재)
    if (this.started && this.rungs) {
      const rg = this.add.graphics();
      rg.lineStyle(5, C.subtext, 0.9);
      this.rungs.forEach((r) => {
        rg.lineBetween(this.colX(r.col), this.rowY(r.row), this.colX(r.col + 1), this.rowY(r.row));
      });
      this.boardLayer.add(rg);
    }

    // 이름(참가자 색 = 색상 연결 시작점) — 눌러서 출발(주도성)
    this.nameLabels = [];
    this.names.forEach((name, i) => {
      const t = this.add.text(this.colX(i), 300, name, {
        fontFamily: FONT, fontSize: `${nameSize}px`, color: css(PLAYER[i]), fontStyle: 'bold',
      }).setOrigin(0.5);
      const hit = this.add.rectangle(this.colX(i), 300, 100, 72, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => this.onNameTap(i));
      this.labelLayer.add(t);
      this.labelLayer.add(hit);
      this.nameLabels.push(t);
    });

    // 결과 라벨(하단)
    this.resultLabels = [];
    this.results.forEach((r, i) => {
      const t = this.add.text(this.colX(i), 955, r, {
        fontFamily: FONT, fontSize: `${n >= 6 ? 22 : 26}px`, color: css(C.subtext), fontStyle: 'bold',
      }).setOrigin(0.5);
      this.labelLayer.add(t);
      this.resultLabels.push(t);
    });
  }

  // ===== 다리 생성 (편향 없는 랜덤 + 경계당 최소 1개 보장) =====
  buildRungs() {
    const n = this.names.length;
    const rows = this.rowCount();
    const rungs = [];
    const has = (row, col) => rungs.some((r) => r.row === row && r.col === col);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < n - 1; col += 1) {
        // 같은 행 인접 다리 금지(한 점에서 세 갈래 방지)
        if (!has(row, col - 1) && this.rng.frac() < 0.42) rungs.push({ row, col });
      }
    }
    // 인접 두 줄이 한 번도 안 섞이면 심심하므로 경계마다 최소 1개 보장
    for (let col = 0; col < n - 1; col += 1) {
      if (!rungs.some((r) => r.col === col)) {
        const candidates = [];
        for (let row = 0; row < rows; row += 1) {
          if (!has(row, col - 1) && !has(row, col + 1)) candidates.push(row);
        }
        if (candidates.length) rungs.push({ row: this.rng.pick(candidates), col });
      }
    }
    return rungs;
  }

  startOrShuffle() {
    if (this.locked) return;
    this.started = true;
    this.rungs = this.buildRungs();
    this.drawBoard();
    this.mainBtn.setLabel('다시 섞기');
    this.hint.setColor(css(C.subtext)).setText('이름을 눌러 출발!');
  }

  // ===== 경로 추적 =====
  tracePath(startCol) {
    const points = [{ x: this.colX(startCol), y: this.topY }];
    let col = startCol;
    for (let row = 0; row < this.rowCount(); row += 1) {
      const y = this.rowY(row);
      const right = this.rungs.some((r) => r.row === row && r.col === col);
      const left = this.rungs.some((r) => r.row === row && r.col === col - 1);
      if (right || left) {
        points.push({ x: this.colX(col), y });
        col += right ? 1 : -1;
        points.push({ x: this.colX(col), y });
      }
    }
    points.push({ x: this.colX(col), y: this.bottomY });
    return { points, endCol: col };
  }

  onNameTap(i) {
    if (this.locked) return;
    // 시작 전: 더블탭으로 이름 수정(시작 후엔 탭 = 출발이라 수정과 충돌 — 섞기 전 설정 단계에서만)
    if (!this.started) {
      const now = this.time.now;
      if (this.lastNameTap && this.lastNameTap.i === i && now - this.lastNameTap.t < 350) {
        this.lastNameTap = null;
        this.renameName(i);
      } else {
        this.lastNameTap = { i, t: now };
        this.flashHint('더블탭: 이름 수정 · 시작을 누르면 출발!');
      }
      return;
    }
    if (this.traced.has(i)) return;
    this.lock();
    this.mainBtn.disableButton();

    const color = PLAYER[i];
    const { points, endCol } = this.tracePath(i);

    // 경로 애니메이션(참가자 색으로 그리며 내려간다)
    const g = this.add.graphics();
    g.lineStyle(6, color, 1);
    this.traceLayer.add(g);
    const dot = this.add.circle(points[0].x, points[0].y, 12, color);
    this.traceLayer.add(dot);

    const segs = [];
    let total = 0;
    for (let k = 1; k < points.length; k += 1) {
      const len = Phaser.Math.Distance.BetweenPoints(points[k - 1], points[k]);
      segs.push({ a: points[k - 1], b: points[k], len, start: total });
      total += len;
    }
    const proxy = { d: 0 };
    let prev = { ...points[0] };
    let lastSeg = 0; // 모서리(가로다리) 꺾임마다 틱 — 경로를 소리로 따라간다
    Sfx.play('pop'); // 출발
    this.tweens.add({
      targets: proxy,
      d: total,
      duration: Math.min(2400, 600 + total * 1.1),
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        let cur = points[points.length - 1];
        for (let si = 0; si < segs.length; si += 1) {
          const s = segs[si];
          if (proxy.d <= s.start + s.len) {
            const t = s.len === 0 ? 1 : (proxy.d - s.start) / s.len;
            cur = { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t };
            if (si !== lastSeg) { lastSeg = si; Sfx.play('tick'); }
            break;
          }
        }
        g.lineBetween(prev.x, prev.y, cur.x, cur.y);
        prev = cur;
        dot.setPosition(cur.x, cur.y);
      },
      onComplete: () => {
        dot.destroy();
        this.revealResult(i, endCol, color);
      },
    });
  }

  revealResult(i, endCol, color) {
    this.traced.add(i);

    // 결과 하이라이트(색상 연결: 참가자 색 배경 + 배경색 글자)
    const label = this.resultLabels[endCol];
    const bg = this.add.graphics();
    const w = Math.max(label.width + 28, 76);
    bg.fillStyle(color, 1).fillRoundedRect(label.x - w / 2, label.y - 24, w, 48, 12);
    this.traceLayer.add(bg);
    this.traceLayer.bringToTop(bg);
    label.setColor(css(C.bg));
    this.labelLayer.bringToTop(label);
    label.setScale(0);
    this.tweens.add({ targets: label, scale: 1, duration: 300, ease: EASE.bounce });

    // 요약(Peak-End: 결과 순간에 연출 집중)
    this.hint.setColor(css(color)).setText(`${this.names[i]} → ${this.results[endCol]} !`);
    this.hint.setScale(0);
    this.tweens.add({ targets: this.hint, scale: 1, duration: 300, ease: EASE.bounce });
    this.colorFlash(color, 150);
    this.burst(label.x, label.y - 12, color, 20); // 도착 지점에서 참가자 색 폭발
    Sfx.play('win');

    this.unlock();
    this.mainBtn.enableButton();
    if (this.traced.size === this.names.length) {
      this.time.delayedCall(900, () => {
        if (this.hint.active && this.traced.size === this.names.length) {
          this.hint.setColor(css(C.subtext)).setText('모두 도착! 다시 섞기로 새 판');
        }
      });
    }
  }

  flashHint(msg) {
    const orig = this.started ? '이름을 눌러 출발!' : HINT_SETUP;
    this.hint.setColor(css(C.warning)).setText(msg);
    this.time.delayedCall(1200, () => {
      if (this.hint.active) this.hint.setColor(css(C.subtext)).setText(orig);
    });
  }

  // ===== 편집(참가자·결과) =====
  openEditor() {
    if (this.editor || this.locked) return;
    const { width, height } = this.scale;

    this.editor = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.72).setOrigin(0).setInteractive();
    this.editor.add(dim);

    const px = 40; const py = 140; const pw = 640; const ph = 980;
    this.editorPanel = { px, py, pw };
    const panel = this.add.graphics();
    panel.fillStyle(C.surface, 1).fillRoundedRect(px, py, pw, ph, RADIUS);
    panel.lineStyle(2, C.surfaceAlt, 1).strokeRoundedRect(px, py, pw, ph, RADIUS);
    this.editor.add(panel);

    this.editor.add(this.add.text(width / 2, py + 48, '참가자·결과 편집', {
      fontFamily: FONT, fontSize: '38px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5));

    this.editorNote = this.add.text(width / 2, py + 94, '항목을 눌러 삭제 · 이름 수정은 보드에서 더블탭', {
      fontFamily: FONT, fontSize: '22px', color: css(C.subtext),
    }).setOrigin(0.5);
    this.editor.add(this.editorNote);

    this.chipsBox = this.add.container(0, 0);
    this.editor.add(this.chipsBox);

    const done = makeButton(this, {
      x: width / 2, y: py + ph - 64, w: 280, h: 84, label: '완료', variant: 'primary',
      onClick: () => this.closeEditor(),
    });
    this.editor.add(done);

    this.renderEditor();
  }

  renderEditor() {
    const { px, py, pw } = this.editorPanel;
    this.chipsBox.removeAll(true);

    const startX = px + 32;
    const maxX = px + pw - 32;
    const gap = 12;
    const chipH = 60;
    let x = startX;
    let y = py + 140;

    const section = (label) => {
      x = startX;
      const t = this.add.text(startX, y, label, {
        fontFamily: FONT, fontSize: '26px', color: css(C.primary), fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      this.chipsBox.add(t);
      y += 52;
    };

    const chip = (labelStr, opts, onTap) => {
      const t = this.add.text(0, 0, labelStr, {
        fontFamily: FONT, fontSize: '26px',
        color: opts.outline ? css(opts.color ?? C.primary) : css(opts.textColor ?? C.text),
        fontStyle: 'bold',
      }).setOrigin(0.5);
      const w = Math.ceil(t.width) + 40;
      if (x + w > maxX) { x = startX; y += chipH + gap; }
      const g = this.add.graphics();
      if (opts.outline) g.lineStyle(2, opts.color ?? C.primary, 1).strokeRoundedRect(0, 0, w, chipH, 14);
      else g.fillStyle(opts.fill ?? C.surfaceAlt, 1).fillRoundedRect(0, 0, w, chipH, 14);
      t.setPosition(w / 2, chipH / 2);
      const con = this.add.container(x, y, [g, t]);
      const hit = this.add.rectangle(w / 2, chipH / 2, w, chipH, 0xffffff, 0).setInteractive({ useHandCursor: true });
      con.add(hit);
      hit.on('pointerup', onTap);
      this.chipsBox.add(con);
      x += w + gap;
    };

    // 참가자(이름 색 = 참가자 색)
    section(`참가자 (${this.names.length}/${MAX_P})`);
    this.names.forEach((name, i) => chip(`${name}  ✕`, { fill: C.surfaceAlt, textColor: PLAYER[i] }, () => this.removeName(i)));
    if (this.names.length < MAX_P) chip('+ 추가', { outline: true }, () => this.addName());
    x = startX; y += chipH + 36;

    // 결과 일괄 설정: 당첨 1(무작위 자리) + 나머지 벌칙
    section('결과 일괄 설정');
    chip('🎯 당첨 1 · 나머지 벌칙', { outline: true, color: C.warning }, () => this.applyDefaultResults());
    x = startX; y += chipH + 36;

    // 결과(눌러서 이름 바꾸기)
    section('결과 (눌러서 수정)');
    this.results.forEach((r, i) => chip(r, { fill: C.surfaceAlt }, () => this.renameResult(i)));
  }

  // 'N번' 자동 추가(빈 번호 중 가장 작은 수) — 이름은 보드에서 더블탭으로 수정
  addName() {
    let k = 1;
    while (this.names.includes(`${k}번`)) k += 1;
    this.names.push(`${k}번`);
    this.syncResults();
    this.persistAndRefresh();
  }

  // 보드의 참가자 이름 더블탭 → 이름 수정(편집 즉시 저장)
  renameName(i) {
    openTextInput(this, {
      title: '이름 수정', hint: `${NAME_MAX}자 이내`, maxLength: NAME_MAX,
      onSubmit: (raw) => {
        const s = raw.trim();
        if (!s || s === this.names[i]) return;
        if (this.names.includes(s)) { this.flashHint('이미 있는 이름이에요'); return; }
        this.names[i] = s;
        this.persistAndRefresh();
      },
    });
  }

  removeName(i) {
    if (this.names.length <= MIN_P) { this.flashEditorNote(`최소 ${MIN_P}명은 있어야 해요`); return; }
    this.names.splice(i, 1);
    this.syncResults();
    this.persistAndRefresh();
  }

  // 결과 일괄 설정: '당첨' 1개 + 나머지 전부 '벌칙'
  // 당첨 위치는 무작위 — 고정 자리는 그 앞 참가자가 걸릴 확률이 구조적으로 높아진다(섞임 편향)
  applyDefaultResults() {
    const winner = this.rng.between(0, this.results.length - 1);
    this.results = this.results.map((_, i) => (i === winner ? '당첨' : '벌칙'));
    this.persistAndRefresh();
    this.flashEditorNote("'당첨' 자리는 무작위로 정했어요");
  }

  renameResult(i) {
    openTextInput(this, {
      title: '결과 수정', hint: `${NAME_MAX}자 이내`, maxLength: NAME_MAX,
      onSubmit: (raw) => {
        const s = raw.trim();
        if (!s) return;
        this.results[i] = s;
        this.persistAndRefresh();
      },
    });
  }

  persistAndRefresh() {
    saveList(LS_NAMES, this.names);
    saveList(LS_RESULTS, this.results);
    this.started = false;
    this.rungs = null;
    this.drawBoard();
    this.mainBtn.setLabel('시작');
    this.hint.setColor(css(C.subtext)).setText(HINT_SETUP);
    if (this.editor) this.renderEditor(); // 보드 더블탭 수정처럼 모달 밖에서도 호출된다
  }

  flashEditorNote(msg) {
    this.editorNote.setText(msg).setColor(css(C.warning));
    this.time.delayedCall(1200, () => {
      if (this.editorNote && this.editorNote.active) {
        this.editorNote.setText('항목을 눌러 삭제 · 이름 수정은 보드에서 더블탭').setColor(css(C.subtext));
      }
    });
  }

  closeEditor() {
    closeTextInput(this);
    if (this.editor) { this.editor.destroy(); this.editor = null; }
  }
}
