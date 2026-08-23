// 사다리타기 — 결정 돕기(트렌드 조사: 커피/벌칙/청소/당첨 내기의 대표 도구).
// 공정성: 사다리는 순열(전단사)이라 결과 1:1이 자동 보장(game-theory §3).
// 정직한 매핑: '시작'을 누르면 가로 다리가 화면에 전부 공개되고,
// 경로 애니메이션은 그 다리를 그대로 따라간다(숨은 조작 없음).
// 색상 연결: 참가자 색 = 경로 색 = 결과 하이라이트 색(visual-polish §3-1a).
import MiniGame from '../MiniGame.js';
import { C, css, FONT, PLAYER, RADIUS, EASE, LAYOUT } from '../theme.js';
import { makeButton, makeHeader, makeSubLink, makeModal, chipFlow, openTextInput, closeTextInput } from '../ui.js';
import { Sfx } from '../sfx.js';

// 가로 다리 행 수는 인원 비례(rowCount) — 2명=8행 … 6명=16행.
// 위쪽은 보기 좋은 무작위 다리, 아래 n행은 균등한 목표 순열로 데려가는 보정(buildRungs 참고).
const MIN_P = 2;
const MAX_P = 6; // 모바일 가독성 한계(responsive-design §7)
const NAME_MAX = 4; // 라벨 겹침 방지(글자 수 제한)

// 시작 전 기본 안내 — 이름·결과 수정 어포던스를 노출(38px에서 화면 폭 내 길이 유지)
const HINT_SETUP = '이름과 결과는 더블탭으로 수정';

const LS_NAMES = 'dori.ladder.names';
const LS_RESULTS = 'dori.ladder.results';

function loadList(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const a = JSON.parse(raw);
      // 손상 데이터 방어: 개수 2–6 + 문자열만 — 범위 밖이면 기본값(PLAYER[6] 색 참조 크래시 방지)
      if (Array.isArray(a) && a.length >= MIN_P && a.length <= MAX_P
        && a.every((v) => typeof v === 'string')) return a;
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
    this.resultsOverlay = null;
    this.rungs = null;
    this.lastNameTap = null;
    this.lastResultTap = null;

    // 레이아웃(검산): 헤더 y48(⬅·제목 40px) / 문구124–156 / 이름174–246(라벨 210) / 사다리250–890 / 결과905–945(라벨 925) / 편집989–1015 / 버튼1054–1154
    // 룰렛과 같은 패턴: 헤더 행 + 상단 문구 + 게임판 + 판 아래 편집 + 주 버튼(크기 위계 40>32>26)
    this.topY = 284; // 이름 라벨(y244)이 문구(y190)와 겹치지 않는 게임판 밴드 시작
    this.bottomY = 904;
    this.leftX = 90;
    this.rightX = 630;

    this.names = loadList(LS_NAMES, ['1번', '2번', '3번', '4번']);
    this.results = loadList(LS_RESULTS, ['커피', '통과', '통과', '통과']);
    this.syncResults();

    this.started = false;
    this.traced = new Set();

    // 공통 레이아웃 그리드(LAYOUT): 헤더48 / 태그라인128 / 문구190 / 게임판 / 링크1002(±150) / 주 버튼1104
    makeHeader(this, '사다리타기', '줄 따라 내려가면 결과가 기다려요');

    this.boardLayer = this.add.container(0, 0);   // 세로줄 + 다리
    this.traceLayer = this.add.container(0, 0);   // 경로(색상 연결)
    this.labelLayer = this.add.container(0, 0);   // 이름/결과 라벨

    // 안내·결과 문구 — 상단 한 곳(설정·진행·결과 공용)
    this.hint = this.add.text(this.cx, LAYOUT.msgY, HINT_SETUP, {
      fontFamily: FONT, fontSize: '32px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.mainBtn = makeButton(this, {
      x: this.cx, y: LAYOUT.btnY, w: 360, h: 100, label: '시작', variant: 'primary',
      onClick: () => this.startOrShuffle(),
    });

    // 게임판 바로 아래 — 좌: 편집(설정 컨트롤) / 우: 전체 결과(시작 후에만 — 조 배정 복사 버튼 패턴)
    this.editBtn = makeSubLink(this, this.cx - LAYOUT.linkDX, LAYOUT.linksY, '✎ 참가자 편집', () => this.openEditor());
    this.resultsBtn = makeSubLink(this, this.cx + LAYOUT.linkDX, LAYOUT.linksY, '👀 전체 결과', () => this.openResults());
    this.resultsBtn.setVisible(false);

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
      const t = this.add.text(this.colX(i), 244, name, {
        fontFamily: FONT, fontSize: `${nameSize}px`, color: css(PLAYER[i]), fontStyle: 'bold',
      }).setOrigin(0.5);
      const hit = this.add.rectangle(this.colX(i), 244, 100, 72, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => this.onNameTap(i));
      this.labelLayer.add(t);
      this.labelLayer.add(hit);
      this.nameLabels.push(t);
    });

    // 결과 라벨(하단) — 참가자와 동일하게 시작 전 더블탭으로 수정
    this.resultLabels = [];
    this.results.forEach((r, i) => {
      const t = this.add.text(this.colX(i), 939, r, {
        fontFamily: FONT, fontSize: `${n >= 6 ? 22 : 26}px`, color: css(C.subtext), fontStyle: 'bold',
      }).setOrigin(0.5);
      const hit = this.add.rectangle(this.colX(i), 939, 100, 64, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => this.onResultTap(i));
      this.labelLayer.add(t);
      this.labelLayer.add(hit);
      this.resultLabels.push(t);
    });
  }

  // ===== 다리 생성 — 결과를 먼저 균등하게 뽑고, 그 결과가 나오도록 다리를 놓는다 =====
  // 룰렛과 같은 원칙이다(결과를 RNG로 정하고 화면을 역산 — game-theory §3).
  // 다리만 무작위로 놓던 이전 방식은 편향됐다: 인접 교환 셔플은 섞이는 데 Θ(n² log n) 행이
  // 필요한데 16행으로는 모자랐다(6명 실측 — 출발 자리 도착 24.3%, 반대쪽 8.8%, 균등은 16.7%).
  // 화면은 그대로 정직하다 — 다리는 시작할 때 전부 공개되고 경로는 그 다리만 따라간다.
  buildRungs() {
    const n = this.names.length;
    const rows = this.rowCount();
    const mixRows = rows - n; // 아래 n행은 보정용으로 남긴다(홀짝 교환 정렬은 n라운드면 끝난다)
    const rungs = [];
    const has = (row, col) => rungs.some((r) => r.row === row && r.col === col);

    // 1) 보기 좋은 무작위 다리 — 공정성은 여기에 기대지 않는다
    for (let row = 0; row < mixRows; row += 1) {
      // 한 방향으로만 훑으면 먼저 보는 경계가 더 자주 채워진다(실측 1.72배) — 매 행 방향을 뒤집는다
      const cols = [...Array(n - 1).keys()];
      if (this.rng.frac() < 0.5) cols.reverse();
      cols.forEach((col) => {
        // 같은 행 인접 다리 금지(한 점에서 세 갈래 방지)
        if (!has(row, col - 1) && !has(row, col + 1) && this.rng.frac() < 0.42) rungs.push({ row, col });
      });
    }
    // 인접 두 줄이 한 번도 안 섞이면 심심하므로 경계마다 최소 1개 보장
    for (let col = 0; col < n - 1; col += 1) {
      if (!rungs.some((r) => r.col === col)) {
        const candidates = [];
        for (let row = 0; row < mixRows; row += 1) {
          if (!has(row, col - 1) && !has(row, col + 1)) candidates.push(row);
        }
        if (candidates.length) rungs.push({ row: this.rng.pick(candidates), col });
      }
    }

    // 2) 균등한 목표 순열(Fisher-Yates) — 공정성의 근거는 오직 여기다
    const target = this.rng.shuffle([...Array(n).keys()]); // target[출발 열] = 도착 열

    // 3) 1)까지 내려온 자리에서 목표까지 데려가는 보정
    // A[위치] = 지금 그 위치에 있는 선이 가야 할 자리. 오름차순이 되면 모두 제자리다.
    const A = [];
    for (let i = 0; i < n; i += 1) A[this.walkTo(rungs, i, mixRows)] = target[i];
    // 홀짝 교환 정렬: n라운드면 어떤 순열이든 정렬된다. 한 라운드의 다리는 경계 번호의 홀짝이
    // 같아 반드시 두 칸 이상 떨어지므로, 한 점에서 세 갈래가 되는 일이 없다.
    const layers = [];
    for (let r = 0; r < n; r += 1) {
      const layer = [];
      for (let col = r % 2; col < n - 1; col += 2) {
        if (A[col] > A[col + 1]) { [A[col], A[col + 1]] = [A[col + 1], A[col]]; layer.push(col); }
      }
      if (layer.length) layers.push(layer); // 할 일 없는 라운드는 버린다(순서만 지키면 된다)
    }
    const fixFrom = rows - layers.length; // 보정은 맨 아래에 붙인다
    layers.forEach((layer, k) => layer.forEach((col) => rungs.push({ row: fixFrom + k, col })));

    // 보정이 짧으면 그만큼 빈 줄이 생겨 사다리가 중간에 끊겨 보인다 —
    // 같은 경계에 위아래로 하나씩(갔다가 되돌아오기)을 놓아 채운다. 결과는 그대로고 화면만 촘촘해진다.
    for (let row = mixRows; row + 1 < fixFrom; row += 2) {
      const col = this.rng.between(0, n - 2);
      rungs.push({ row, col });
      rungs.push({ row: row + 1, col });
    }
    return rungs;
  }

  // 다리를 따라 toRow 직전까지 내려갔을 때의 열
  walkTo(rungs, startCol, toRow) {
    let col = startCol;
    for (let row = 0; row < toRow; row += 1) {
      if (rungs.some((x) => x.row === row && x.col === col)) col += 1;
      else if (rungs.some((x) => x.row === row && x.col === col - 1)) col -= 1;
    }
    return col;
  }

  startOrShuffle() {
    if (this.locked) return;
    // 라운드 완료 후 '새 판': 설정 단계로 복귀(더블탭 수정 가능) — 설정→시작→모두 도착→새 판 사이클
    if (this.started && this.traced.size === this.names.length) {
      this.resetToSetup();
      return;
    }
    this.started = true;
    this.rungs = this.buildRungs();
    this.drawBoard();
    this.mainBtn.setLabel('다시 섞기');
    this.resultsBtn.setVisible(true);
    this.hint.setColor(css(C.subtext)).setText('이름을 눌러 출발!');
  }

  // 설정 단계로 복귀: 사다리를 걷고 편집(더블탭) 가능 상태로
  resetToSetup() {
    this.started = false;
    this.rungs = null;
    this.closeResults();
    this.drawBoard();
    this.mainBtn.setLabel('시작');
    this.resultsBtn.setVisible(false);
    this.hint.setColor(css(C.subtext)).setText(HINT_SETUP);
  }

  // ===== 전체 결과 팝업 =====
  // 사다리는 시작 시 전부 공개되므로 요약 표도 정직 — 추적 애니메이션 없이 경로만 계산해 보여준다
  openResults() {
    if (this.resultsOverlay || this.locked || !this.started) return;
    Sfx.play('tap');
    const { width, height } = this.scale;
    this.resultsOverlay = this.add.container(0, 0).setDepth(120);
    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.72).setOrigin(0).setInteractive();
    dim.on('pointerup', () => this.closeResults()); // 바깥 탭으로도 닫기
    this.resultsOverlay.add(dim);

    const n = this.names.length;
    const rowH = 64;
    const pw = 520;
    const ph = 150 + n * rowH + 116;
    const px = (width - pw) / 2;
    const py = (height - ph) / 2 - 40; // 광학 중앙(살짝 위)
    const panel = this.add.graphics();
    panel.fillStyle(C.surface, 1).fillRoundedRect(px, py, pw, ph, RADIUS);
    panel.lineStyle(2, C.surfaceAlt, 1).strokeRoundedRect(px, py, pw, ph, RADIUS);
    this.resultsOverlay.add(panel);

    this.resultsOverlay.add(this.add.text(this.cx, py + 56, '전체 결과', {
      fontFamily: FONT, fontSize: '38px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5));

    // 행: 참가자 색 = 색상 연결, 이미 도착한 사람은 ✓
    this.names.forEach((name, i) => {
      const { endCol } = this.tracePath(i);
      const done = this.traced.has(i) ? '  ✓' : '';
      this.resultsOverlay.add(this.add.text(this.cx, py + 130 + i * rowH, `${name}  →  ${this.results[endCol]}${done}`, {
        fontFamily: FONT, fontSize: '30px', color: css(PLAYER[i]), fontStyle: 'bold',
      }).setOrigin(0.5));
    });

    const close = makeButton(this, {
      x: this.cx, y: py + ph - 62, w: 240, h: 80, label: '닫기', variant: 'primary',
      onClick: () => this.closeResults(),
    });
    this.resultsOverlay.add(close);

    // 모달 공통 페이드
    this.resultsOverlay.setAlpha(0);
    this.tweens.add({ targets: this.resultsOverlay, alpha: 1, duration: 160, ease: 'Quad.easeOut' });
  }

  closeResults() {
    if (this.resultsOverlay) { this.resultsOverlay.destroy(); this.resultsOverlay = null; }
  }

  // 뒤로가기 레이어: 전체 결과 팝업도 '위부터 닫기' 대상(공통 레이어는 super가 처리)
  closeTopLayer() {
    if (!this.inputOverlay && this.resultsOverlay) { this.closeResults(); return true; }
    return super.closeTopLayer();
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
        this.flashHint('더블탭: 이름 수정');
      }
      return;
    }
    if (this.traced.has(i)) return;
    this.startTrace(i);
  }

  // 결과도 참가자와 동일: 시작 전 더블탭으로 수정(시작 후엔 결과 확정 단계라 수정 불가)
  onResultTap(i) {
    if (this.locked || this.started) return;
    const now = this.time.now;
    if (this.lastResultTap && this.lastResultTap.i === i && now - this.lastResultTap.t < 350) {
      this.lastResultTap = null;
      this.renameResult(i);
    } else {
      this.lastResultTap = { i, t: now };
      this.flashHint('더블탭: 결과 수정');
    }
  }

  startTrace(i) {
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
    // 라운드 완료: 버튼이 '새 판'이 되고, 누르면 설정 단계로 돌아간다
    if (this.traced.size === this.names.length) {
      this.mainBtn.setLabel('새 판');
      this.time.delayedCall(900, () => {
        if (this.hint.active && this.traced.size === this.names.length) {
          this.hint.setColor(css(C.subtext)).setText('모두 도착! 새 판으로 계속');
        }
      });
    }
  }

  flashHint(msg) {
    this.hint.setColor(css(C.warning)).setText(msg);
    // 복귀 문구는 발화 시점의 상태로 계산 — 경고 1.2초 사이 시작/전원 도착으로 단계가 바뀌어도 거짓 안내가 없다
    this.time.delayedCall(1200, () => {
      if (!this.hint.active) return;
      const orig = !this.started ? HINT_SETUP
        : this.traced.size === this.names.length ? '모두 도착! 새 판으로 계속'
          : '이름을 눌러 출발!';
      this.hint.setColor(css(C.subtext)).setText(orig);
    });
  }

  // ===== 편집(참가자·결과) =====
  openEditor() {
    if (this.editor || this.locked) return;

    // 공통 모달 스캐폴드(제목 38·안내 22·완료 버튼·페이드) — ui.makeModal
    const modal = makeModal(this, {
      title: '참가자 편집',
      note: '항목을 눌러 삭제 · 이름·결과는 보드에서 더블탭',
      py: 140,
      ph: 980,
      onDone: () => this.closeEditor(),
    });
    this.editor = modal.root;
    this.editorNote = modal.noteText;
    this.chipsBox = modal.chipsBox;
    this.chipArea = modal.chips;

    this.renderEditor();
  }

  renderEditor() {
    this.chipsBox.removeAll(true);
    const chip = chipFlow(this, this.chipsBox, this.chipArea);

    // 참가자(이름 색 = 참가자 색)
    chip.section(`참가자 (${this.names.length}/${MAX_P})`);
    this.names.forEach((name, i) => chip(`${name}  ✕`, { textColor: PLAYER[i] }, () => this.removeName(i)));
    if (this.names.length < MAX_P) chip('+ 추가', { outline: true }, () => this.addName());
    chip.gapRow(24);

    // 결과 기본값: 당첨 1(무작위 자리) + 나머지 벌칙 — 개별 수정은 보드에서 더블탭
    chip.section('결과 기본값');
    chip('🎯 당첨 1 · 나머지 벌칙', { outline: true, color: C.warning }, () => this.applyDefaultResults());
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
    this.resetToSetup();
    if (this.editor) this.renderEditor(); // 보드 더블탭 수정처럼 모달 밖에서도 호출된다
  }

  flashEditorNote(msg) {
    this.editorNote.setText(msg).setColor(css(C.warning));
    this.time.delayedCall(1200, () => {
      if (this.editorNote && this.editorNote.active) {
        this.editorNote.setText('항목을 눌러 삭제 · 이름·결과는 보드에서 더블탭').setColor(css(C.subtext));
      }
    });
  }

  closeEditor() {
    closeTextInput(this);
    if (this.editor) { this.editor.destroy(); this.editor = null; }
  }
}
