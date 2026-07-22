// 랜덤 핀볼(플링코) — 결정 돕기. 트렌드 조사 §4: "통제된 불확실성"이 핵심.
// 주도성: 떨어뜨릴 위치를 플레이어가 직접 고른다(드래그/탭). 결과는 실제 물리로.
// 도파민 설계: 핀 히트 플래시·튕김 카운터·막판 슬로모+줌·착지 파티클 폭발(Peak-End).
// 정직한 매핑: 결과를 몰래 유도하지 않는다 — 보이는 물리 그대로(핀 반발 잔떨림 포함).
import MiniGame from '../MiniGame.js';
import { C, css, FONT, SLICE, EASE, LAYOUT } from '../theme.js';
import { makeButton, makeHeader, makeSubLink, makeModal, chipFlow, openTextInput, closeTextInput } from '../ui.js';
import { Sfx } from '../sfx.js';

const LS_SLOTS = 'dori.pinball.slots';
const DEFAULT_SLOTS = ['꽝', '2등', '1등', '3등', '2등', '꽝']; // 1·2·3등 + 꽝꽝(가장자리)
const SLOT_MIN = 4;
const SLOT_MAX = 10;
const LEFT = 70;
const RIGHT = 650;
const BASE_SLOT_W = (RIGHT - LEFT) / 6; // 기준 칸 폭(6칸) — 공·핀 크기 스케일의 기준
const BALL_R = 12;     // 공 반지름(기준) — 핀보다 작게
const PEG_R = 16;      // 핀 반지름(기준) — 공보다 크게
const BALL_TEX_R = 14; // 'ball' 텍스처 원본 반지름(28px)
const PEG_TEX_R = 9;   // 'peg' 텍스처 원본 반지름(18px)

function loadSlots() {
  try {
    const raw = localStorage.getItem(LS_SLOTS);
    if (raw) {
      const a = JSON.parse(raw);
      if (Array.isArray(a) && a.length >= SLOT_MIN && a.length <= SLOT_MAX) return a;
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
    this.editor = null; // 재진입 시 stale 참조 초기화(편집 연 채 나간 경우)
    this.inputOverlay = null;
    // 이전 판의 파괴된 객체 참조도 초기화 — 특히 pegs는 남아 있으면 buildPegs가
    // 죽은 물리 그룹을 clear()하다 크래시(재진입 시 씬이 멈춘 것처럼 보임)
    this.pegs = null;
    this.slotBox = null;
    this.ball = null;
    this.pegCollider = null;
    this.dragging = false;
    this.lastSlotTap = null;
    this.toastPrev = null;
    this.slots = loadSlots();
    this.hits = 0;
    this.dropX = this.cx;

    // 공통 레이아웃 그리드(LAYOUT): 헤더48 / 태그라인128 / 문구190 / 낙하 조작230–340 / 핀376–836 / 칸871–971 / 링크1002(±150) / 주 버튼1104
    // 카운터(우, y246)는 투명 조작 영역과 겹쳐도 무방(표시 전용)
    const hdr = makeHeader(this, '랜덤 핀볼', '자리만 정하면, 나머지는 물리의 몫');
    this.titleText = hdr.titleText;
    this.taglineText = hdr.taglineText;

    this.hitText = this.add.text(width - 32, 246, '', {
      fontFamily: FONT, fontSize: '26px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(1, 0.5);

    // 맵 섞기 — 핀 배치와 결과 칸 순서를 다시 굴린다(전부 보이는 상태에서 바뀜 = 정직)
    // 판 구성 컨트롤이라 칸 편집과 함께 게임판 바로 아래에 나란히 배치
    this.shuffleBtn = makeSubLink(this, this.cx - LAYOUT.linkDX, LAYOUT.linksY, '🔀 맵 섞기', () => this.shuffleMap());

    this.physics.world.setBounds(LEFT, 0, RIGHT - LEFT, 1280);

    this.buildBoard();
    this.buildDropControl();

    // 안내·결과 공용 문구 — 상단(태그라인과 조작 영역 사이)
    this.resultText = this.add.text(this.cx, LAYOUT.msgY, '위쪽을 끌어 위치를 정하고 떨어뜨리세요', {
      fontFamily: FONT, fontSize: '32px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.dropBtn = makeButton(this, {
      x: this.cx, y: LAYOUT.btnY, w: 360, h: 100, label: '떨어뜨리기', variant: 'primary',
      onClick: () => this.drop(),
    });

    this.editBtn = makeSubLink(this, this.cx + LAYOUT.linkDX, LAYOUT.linksY, '✎ 칸 편집', () => this.openEditor());

    this.setupBoardCam();
  }

  // 보드 전용 카메라 — 슬로모 확대(zoomTo)를 핀볼판에만 적용한다.
  // 보드 객체는 main에서 ignore(생성 지점마다), UI·배경은 boardCam에서 ignore(여기서 일괄).
  setupBoardCam() {
    const { width, height } = this.scale;
    this.boardCam = this.cameras.add(0, 0, width, height);
    this.boardCam.fadeIn(160, 18, 19, 28); // main과 같은 씬 전환 페이드
    this.boardCam.ignore([
      ...(this.atmosphereLayers || []),
      this.backBtn, this.titleText, this.taglineText, this.resultText, this.hitText,
      this.shuffleBtn, this.editBtn, this.dropBtn,
    ]);
  }

  // 슬로모 줌은 보드 카메라만 — UI·문구는 그대로
  colorFlash(color, duration = 170) {
    // 최상단(boardCam)에서 플래시해야 화면 전체를 덮는다(main 플래시는 보드 아래에 깔림)
    this.boardCam.flash(duration, (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff);
  }

  shake(intensity = 0.008, duration = 180) {
    super.shake(intensity, duration);
    this.boardCam.shake(duration, intensity); // 보드도 함께 흔들려야 물리적 타격감이 맞는다
  }

  buildBoard() {
    // 벽(시각)
    const wall = this.add.graphics();
    wall.lineStyle(4, C.surfaceAlt, 1);
    wall.lineBetween(LEFT, 336, LEFT, 976);
    wall.lineBetween(RIGHT, 336, RIGHT, 976);
    this.cameras.main.ignore(wall); // 보드 카메라 전용

    this.buildSlots();
    this.buildPegs();
  }

  // 칸 수에 따른 공·핀 크기 스케일(6칸 기준 1, 칸이 좁아질수록 축소 — 최소 0.6)
  sizeScale() {
    const slotW = (RIGHT - LEFT) / this.slots.length;
    return Phaser.Math.Clamp(slotW / BASE_SLOT_W, 0.6, 1);
  }

  // 공 스프라이트 스케일(텍스처 r14 → 기준 r12에 크기 스케일 적용)
  ballScale() {
    return this.sizeScale() * (BALL_R / BALL_TEX_R);
  }

  // 슬롯(색상 연결: 칸 색 = 결과 색) — 칸 수 변경 시 재생성
  buildSlots() {
    if (this.slotBox) this.slotBox.destroy();
    this.slotBox = this.add.container(0, 0);
    this.slotRects = [];
    this.slotLabels = [];
    const n = this.slots.length;
    const slotW = (RIGHT - LEFT) / n;
    const fs = Math.min(26, Math.floor(slotW * 0.36)); // 좁은 칸은 라벨 축소
    const div = this.add.graphics();
    div.lineStyle(4, C.surfaceAlt, 1);
    this.slotBox.add(div);
    for (let i = 0; i < n; i += 1) {
      const x = LEFT + slotW * (i + 0.5);
      const color = SLICE[i % SLICE.length];
      const rect = this.add.rectangle(x, 921, slotW - 10, 96, color, 0.22)
        .setStrokeStyle(3, color, 0.9);
      const label = this.add.text(x, 921, this.slots[i], {
        fontFamily: FONT, fontSize: `${fs}px`, color: css(color), fontStyle: 'bold',
      }).setOrigin(0.5);
      this.slotBox.add(rect);
      this.slotBox.add(label);
      // 더블탭 = 이름 수정(사다리·뽑기와 같은 숨은 어포던스 — 한 번 탭하면 힌트)
      const hit = this.add.rectangle(x, 921, slotW - 10, 96, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => this.onSlotTap(i));
      this.slotBox.add(hit);
      this.slotRects.push(rect);
      this.slotLabels.push(label);
      if (i > 0) div.lineBetween(LEFT + slotW * i, 871, LEFT + slotW * i, 971);
    }
    this.cameras.main.ignore(this.slotBox); // 보드 카메라 전용
  }

  // 핀 랜덤 배치 — 보드는 낙하 전 전부 보이므로 정직.
  // 제약: 핀은 벽 바로 옆(틈 4px)까지 깔아 양끝 빈 통로 제거, 행 내 중심 간격 ≥ 공 지름 + 핀 지름 + 10(스케일 연동).
  buildPegs() {
    if (this.pegs) this.pegs.clear(true, true);
    else this.pegs = this.physics.add.staticGroup();
    const s = this.sizeScale();
    // 정적 바디는 스케일을 자동 반영하지 않는다 — 스케일 적용 후 refreshBody, 원은 월드 픽셀로 지정
    const pegScale = s * (PEG_R / PEG_TEX_R); // 텍스처 r9 → 기준 r16
    const makePeg = (x, y, delay) => {
      const peg = this.pegs.create(x, y, 'peg');
      peg.setTint(C.subtext);
      peg.setScale(pegScale).refreshBody();
      peg.body.setCircle(PEG_R * s);
      peg.baseScale = pegScale; // 히트 연출 복원용
      peg.lastHit = 0;
      // 새 핀이 통통 나타나는 피드백(섞였음이 눈에 보이게) — 표시만 커지고 바디는 그대로
      peg.setScale(0);
      this.tweens.add({ targets: peg, scale: pegScale, duration: 200, delay, ease: 'Back.easeOut' });
    };

    // 랜덤 8행: y 376–836(마지막 행이 결정칸 바로 위) — 모든 행 동일한 랜덤 규칙·크기
    const ballD = 2 * BALL_R * s; // 공 지름(스케일 반영)
    const minGap = ballD + 2 * PEG_R * s + 10; // 핀 중심 간격 하한: 공 + 핀 + 여유 → 핀 사이 틈 ≥ 공 지름 + 10
    // 핀 x 범위: 벽 바로 옆까지(벽-핀 틈 4px < 공 지름 → 양끝 빈 통로 없음, 공은 끼지도 통과하지도 못함)
    const lo = LEFT + PEG_R * s + 4;
    const hi = RIGHT - PEG_R * s - 4;
    const rowGap = (836 - 376) / 7;
    for (let row = 0; row < 8; row += 1) {
      // 행당 핀 개수는 칸 수에 연동 — 칸이 늘면 갈림도 촘촘해진다(간격 하한이 허용하는 개수로 캡)
      const nMax = Math.floor((hi - lo) / minGap) + 1;
      const n = Math.max(2, Math.min(this.rng.between(this.slots.length, this.slots.length + 2), nMax));
      const spacing = (hi - lo) / (n - 1);
      const jitter = Math.max(0, Math.floor(Math.min(18, (spacing - minGap) / 2)));
      // 가끔 안쪽 핀 하나를 빼서 '구멍'을 만든다(맵마다 성격이 달라짐)
      const skipIdx = n >= 6 && this.rng.frac() < 0.35 ? this.rng.between(1, n - 2) : -1;
      for (let i = 0; i < n; i += 1) {
        if (i === skipIdx) continue;
        const x = Phaser.Math.Clamp(lo + i * spacing + this.rng.between(-jitter, jitter), lo, hi);
        const y = 376 + row * rowGap + this.rng.between(-12, 12);
        makePeg(x, y, row * 30);
      }
    }
    this.cameras.main.ignore(this.pegs.getChildren()); // 보드 카메라 전용(섞을 때마다 재등록)
  }

  // 맵 섞기: 핀 배치 재생성 + 결과 칸 순서 셔플(화면 표시만 — 저장 안 함, 재진입 시 저장분 복원)
  shuffleMap() {
    if (this.locked) return;
    for (let i = this.slots.length - 1; i > 0; i -= 1) {
      const j = this.rng.between(0, i);
      [this.slots[i], this.slots[j]] = [this.slots[j], this.slots[i]];
    }
    this.refreshSlotLabels();
    this.buildPegs();
    this.resultText.setColor(css(C.subtext)).setText('위쪽을 끌어 위치를 정하고 떨어뜨리세요').setScale(1);
    this.dropBtn.setLabel('떨어뜨리기');
    Sfx.play('pop');
  }

  buildDropControl() {
    // 고스트 공 + 화살표(주도성: 여기서 떨어진다는 정직한 시그니파이어)
    this.ghost = this.add.image(this.dropX, 285, 'ball').setTint(C.primary).setAlpha(0.55).setScale(this.ballScale());
    this.arrow = this.add.graphics();
    this.drawArrow();
    this.cameras.main.ignore([this.ghost, this.arrow]); // 보드 카메라 전용

    // 상단 조작 영역: 드래그로 위치 선택, 탭으로 즉시 낙하(빠른 라운드 = 도파민)
    // 드래그는 씬 전역으로 추적 — 누른 채 영역 밖(아래)으로 끌어도 이어지고, 놓는 순간 낙하한다.
    // 조작 영역 230–340(높이 110 ≥ 터치 타깃 88) — 문구(y190)와 겹치지 않게 압축
    const zone = this.add.rectangle(this.cx, 285, RIGHT - LEFT, 110, 0xffffff, 0)
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
    this.arrow.fillTriangle(this.dropX - 14, 308, this.dropX + 14, 308, this.dropX, 332);
  }

  drop() {
    if (this.locked) return;
    this.lock();
    this.dropBtn.disableButton();
    this.hits = 0;
    this.hitText.setText('');
    this.resultText.setColor(css(C.subtext)).setText('...').setScale(1);
    this.slowmoDone = false;
    Sfx.play('pop'); // 출발

    this.ball = this.physics.add.image(this.dropX, 285, 'ball').setTint(C.text).setScale(this.ballScale());
    this.cameras.main.ignore(this.ball); // 보드 카메라 전용
    this.ball.body.setCircle(BALL_TEX_R); // 소스 픽셀 기준 — 동적 바디는 스케일 자동 반영(월드 r = BALL_R × 크기 스케일)
    this.ball.setBounce(0.55);
    this.ball.setCollideWorldBounds(true);
    this.ball.body.setGravityY(1500);
    this.ball.setVelocityX(this.rng.between(-20, 20)); // 미세 초기 흔들림(생동감)

    // 끼임 감시: 최저 도달 y가 갱신되지 않으면 넛지로 탈출시킨다(핀-벽 틈 트랩 대비)
    this.maxBallY = this.ball.y;
    this.lastProgressAt = this.time.now;
    this.nudgeCount = 0;

    // 라운드마다 생성·종료 시 파괴(resolve) — 콜라이더가 월드에 누적되지 않게
    this.pegCollider = this.physics.add.collider(this.ball, this.pegs, (ball, peg) => this.onPegHit(ball, peg));
  }

  onPegHit(ball, peg) {
    const now = this.time.now;
    if (now - peg.lastHit < 90) return;
    peg.lastHit = now;

    // 핀 히트 피드백: 플래시 + 팝(도파민 마이크로 보상) — 핀별 기본 크기 기준 상대 팝
    peg.setTint(C.primary);
    this.tweens.add({
      targets: peg, scale: peg.baseScale * 1.5, duration: 70, yoyo: true, ease: 'Quad.easeOut',
      onComplete: () => { if (peg.active) { peg.setTint(C.subtext); peg.setScale(peg.baseScale); } },
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
    if (!this.slowmoDone && this.ball.y > 736) {
      this.slowmoDone = true;
      this.physics.world.timeScale = 2.1;
      this.boardCam.zoomTo(1.06, 220); // 확대는 핀볼판만(UI·문구는 그대로)
    }

    // 끼임 감시: 1.2초간 아래로 진행이 없으면 틸트(넛지) — 화면에 보이는 정직한 탈출
    if (this.ball.y > this.maxBallY + 4) {
      this.maxBallY = this.ball.y;
      this.lastProgressAt = this.time.now;
    } else if (this.time.now - this.lastProgressAt > 1200) {
      this.nudgeBall();
      if (!this.ball) return; // 넛지 한도 초과로 강제 확정됐으면 이 프레임 종료
    }

    if (this.ball.y > 896) this.resolve();
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
    const slotW = (RIGHT - LEFT) / this.slots.length;
    const idx = Phaser.Math.Clamp(Math.floor((this.ball.x - LEFT) / slotW), 0, this.slots.length - 1);
    const color = SLICE[idx % SLICE.length];
    const slotX = LEFT + slotW * (idx + 0.5);

    this.physics.world.timeScale = 1;
    this.boardCam.zoomTo(1, 250);

    if (this.pegCollider) { this.pegCollider.destroy(); this.pegCollider = null; }
    const ball = this.ball;
    this.ball = null;
    ball.disableBody(true, false);
    this.tweens.add({
      targets: ball, x: slotX, y: 921, scale: this.ballScale() * 0.8, duration: 160, ease: 'Quad.easeIn',
      onComplete: () => {
        this.tweens.add({ targets: ball, alpha: 0, duration: 350, delay: 500, onComplete: () => ball.destroy() });
      },
    });

    // Peak-End: 착지 순간에 연출 집중(색상 연결)
    const rect = this.slotRects[idx];
    this.tweens.add({ targets: rect, scaleX: 1.12, scaleY: 1.25, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
    this.cameras.main.ignore(this.burst(slotX, 906, color, 36)); // 착지 파티클도 보드 카메라로
    this.colorFlash(color, 190);
    this.shake(0.006, 160);
    Sfx.play(this.slots[idx] === '꽝' ? 'fail' : 'win'); // Peak를 결과에 맞게(꽝은 하강 개그 톤)

    this.resultText.setColor(css(color));
    this.resultText.setText(`${this.slots[idx]} !   (튕김 ×${this.hits})`);
    this.resultText.setScale(0);
    this.tweens.add({ targets: this.resultText, scale: 1, duration: 320, ease: EASE.bounce });

    this.dropBtn.enableButton();
    this.dropBtn.setLabel('다시 떨어뜨리기');
    this.unlock();
  }

  // ===== 칸 편집(이름 변경 + 칸 수 4–10개, 크기 스케일 연동) =====
  openEditor() {
    if (this.editor || this.locked) return;

    // 공통 모달 스캐폴드(제목 38·안내 22·완료 버튼·페이드) — ui.makeModal.
    // 모달은 위층(boardCam)에 배정 — main에 두면 보드 객체(위층)가 모달을 덮는다.
    // 편집은 낙하 중(locked) 열 수 없으므로 boardCam 줌과 겹칠 일 없음.
    const modal = makeModal(this, {
      title: '칸 편집',
      note: `칸 ${SLOT_MIN}–${SLOT_MAX}개 · 눌러서 삭제 · 이름은 보드 칸 더블탭`,
      py: 260,
      ph: 760,
      onDone: () => { closeTextInput(this); this.editor.destroy(); this.editor = null; },
    });
    this.editor = modal.root;
    this.cameras.main.ignore(this.editor);
    this.editorNote = modal.noteText;
    this.chipsBox = modal.chipsBox;
    this.chipArea = modal.chips;
    this.renderChips();
  }

  renderChips() {
    this.chipsBox.removeAll(true);
    const chip = chipFlow(this, this.chipsBox, this.chipArea);
    // 칸 칩: 칸 색 = 칩 색(색상 연결) — 칩 탭 = 그 칸 삭제(룰렛 편집과 동일)
    this.slots.forEach((s, i) => {
      const color = SLICE[i % SLICE.length];
      chip(`${s}  ✕`, { fill: C.surfaceAlt, outline: true, color, textColor: color }, () => this.removeSlotAt(i));
    });
    chip.gapRow();
    // 컨트롤 행: ＋ 칸 추가 · ↺ 기본값 — 개별 삭제가 생겨 '− 칸 빼기'는 제거
    chip('＋ 칸 추가', { outline: true }, () => this.addSlot());
    chip('↺ 기본값', { outline: true, color: C.warning }, () => this.resetSlots());
  }

  // 칸 수 변경 후 보드·크기 일괄 반영
  applySlotCount() {
    saveSlots(this.slots);
    this.buildSlots();
    this.buildPegs();
    this.ghost.setScale(this.ballScale());
    this.renderChips();
  }

  addSlot() {
    if (this.slots.length >= SLOT_MAX) { this.flashNote(`최대 ${SLOT_MAX}칸까지예요`); return; }
    this.slots.push('꽝');
    this.applySlotCount();
  }

  removeSlotAt(i) {
    if (this.slots.length <= SLOT_MIN) { this.flashNote(`최소 ${SLOT_MIN}칸은 있어야 해요`); return; }
    this.slots.splice(i, 1);
    this.applySlotCount();
  }

  resetSlots() {
    try { localStorage.removeItem(LS_SLOTS); } catch (e) { /* 무시 */ }
    this.slots = [...DEFAULT_SLOTS];
    this.buildSlots();
    this.buildPegs();
    this.ghost.setScale(this.ballScale());
    this.renderChips();
  }

  flashNote(msg) {
    this.editorNote.setText(msg).setColor(css(C.warning));
    this.time.delayedCall(1200, () => {
      if (this.editorNote && this.editorNote.active) {
        this.editorNote.setText(`칸 ${SLOT_MIN}–${SLOT_MAX}개 · 눌러서 삭제 · 이름은 보드 칸 더블탭`).setColor(css(C.subtext));
      }
    });
  }

  // 보드 결과 칸 더블탭 = 이름 수정(사다리 보드·뽑기 풀 칩과 같은 패턴)
  onSlotTap(i) {
    if (this.locked) return;
    const now = this.time.now;
    if (this.lastSlotTap && this.lastSlotTap.i === i && now - this.lastSlotTap.t < 350) {
      this.lastSlotTap = null;
      this.renameSlot(i);
    } else {
      this.lastSlotTap = { i, t: now };
      this.toastResult('더블탭: 이름 수정');
    }
  }

  // 잠깐 안내 후 원래 문구(결과 포함)로 복원
  toastResult(msg) {
    if (!this.toastPrev) this.toastPrev = { text: this.resultText.text, color: this.resultText.style.color };
    this.resultText.setColor(css(C.warning)).setText(msg).setScale(1);
    this.time.delayedCall(1200, () => {
      if (this.resultText.active && this.toastPrev) {
        this.resultText.setColor(this.toastPrev.color).setText(this.toastPrev.text).setScale(1);
        this.toastPrev = null;
      }
    });
  }

  renameSlot(i) {
    openTextInput(this, {
      title: '칸 이름', hint: '4자 이내', maxLength: 4,
      onSubmit: (raw) => {
        const s = raw.trim();
        if (!s) return;
        this.slots[i] = s;
        saveSlots(this.slots);
        this.refreshSlotLabels();
        if (this.editor) this.renderChips();
      },
    });
  }

  refreshSlotLabels() {
    this.slotLabels.forEach((l, i) => l.setText(this.slots[i]));
  }
}
