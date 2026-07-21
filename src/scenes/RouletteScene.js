// 메뉴 룰렛 — 시간대(아침/점심/저녁)에 따라 다른 메뉴 세트를 돌린다.
// 기본값은 한국인 선호 음식 트렌드 기반이며, 사용자가 추가/삭제할 수 있고 localStorage에 저장된다.
// 정직한 매핑: 결과를 RNG로 먼저 정하고 포인터 칸에 정확히 멈추게 회전 각을 역산(game-mechanics A-1).
import MiniGame from '../MiniGame.js';
import { C, css, FONT, EASE, RADIUS } from '../theme.js';
import { makeButton, openTextInput, closeTextInput } from '../ui.js';
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

const LS_SPINS = 'dori.roulette.spins'; // 🍟 보증 카운터
const PITY = 10;                        // 10번째 스핀은 감자튀김 보증(공개 규칙 — docs/game.md)

function loadStr(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch (e) { return fallback; }
}
function saveStr(key, v) {
  try { localStorage.setItem(key, v); } catch (e) { /* 무시 */ }
}

const keyFor = (mealKey) => `dori.roulette.${mealKey}`;

// 비복원 모드 저장(기기 내 localStorage — 전송 없음): 토글 상태 + 시간대별 제외 목록
const LS_EXCLUDE = 'dori.roulette.exclude';
const exKeyFor = (mealKey) => `dori.roulette.excluded.${mealKey}`;

function loadExcluded(mealKey, items) {
  try {
    const raw = localStorage.getItem(exKeyFor(mealKey));
    if (raw) {
      const a = JSON.parse(raw);
      // 사라진 메뉴는 버림 + 🍟 감자튀김은 제외 불가(영원해요)
      if (Array.isArray(a)) return a.filter((n) => items.includes(n) && n !== FRY);
    }
  } catch (e) { /* 무시 */ }
  return [];
}

function saveExcluded(mealKey, set) {
  try { localStorage.setItem(exKeyFor(mealKey), JSON.stringify([...set])); } catch (e) { /* 무시 */ }
}

function loadItems(mealKey, defaults) {
  try {
    const raw = localStorage.getItem(keyFor(mealKey));
    if (raw) {
      const a = JSON.parse(raw);
      // 1개(감자튀김만)도 유효 — '모두 지우기' 상태 유지(스핀은 2개 미만이면 잠김)
      if (Array.isArray(a) && a.length >= 1) return a;
    }
  } catch (e) { /* 저장소 접근 불가 시 무시 */ }
  return [...defaults];
}

// 기본값과 같으면 저장하지 않는다(키 삭제) — localStorage는 '편집된 상태'만 담는다
function saveItems(mealKey, items) {
  try {
    const def = ensureFry([...MEALS[mealKey].defaults]);
    if (items.length === def.length && items.every((v, i) => v === def[i])) {
      localStorage.removeItem(keyFor(mealKey));
    } else {
      localStorage.setItem(keyFor(mealKey), JSON.stringify(items));
    }
  } catch (e) { /* 무시 */ }
}

export default class RouletteScene extends MiniGame {
  constructor() {
    super('Roulette');
  }

  onCreate() {
    const { width } = this.scale;
    this.cx = width / 2;
    this.editor = null; // 재진입 시 stale 참조 초기화(편집 연 채 나간 경우)
    this.inputOverlay = null; // 입력 오버레이도 동일(연 채 나간 경우)
    // 레이아웃(검산): 제목116–164 / 제외 토글186–214 / 문구220–284 / 포인터294–346 / 원판340–940 / 버튼1054–1154 / 편집1191–1221
    this.cy = 640;
    this.radius = 300;
    this.wheelAngle = 0;

    // 시간대 → 식사 종류 → 메뉴(저장분 우선)
    this.mealKey = mealForPhase(this.timePhase && this.timePhase.key);
    this.meal = MEALS[this.mealKey];
    this.setupItems();
    this.makeFryTexture();

    // 제목 — 아래 요소들과의 간격은 onCreate 상단 레이아웃 검산 주석 참고
    this.titleText = this.add.text(this.cx, 140, `${this.meal.label} 메뉴 룰렛`, {
      fontFamily: FONT, fontSize: '48px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5);

    // 비복원 모드: 나온 항목은 칸이 흐려지고 다음 스핀에서 제외(뽑기 상자와 같은 정직 원칙)
    // 토글·제외 목록은 기기 내 저장(localStorage) — 재진입해도 이어진다(excluded는 setupItems에서 복원)
    this.excludeMode = loadStr(LS_EXCLUDE, 'off') === 'on';
    this.excludeBtn = this.add.text(32, 200, '', {
      fontFamily: FONT, fontSize: '28px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    this.excludeBtn.on('pointerup', () => this.toggleExclude());
    this.cancelBtn = this.add.text(width - 32, 200, '', {
      fontFamily: FONT, fontSize: '28px', color: css(C.warning), fontStyle: 'bold',
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    this.cancelBtn.on('pointerup', () => this.cancelExclusions());
    this.updateExcludeUi();

    this.buildWheel();
    this.buildPointer();
    this.updateFryHint(); // 진입 시 카운터가 이미 9면 바로 반짝임
    this.applyExclusionDims(); // 저장된 제외 칸 흐림 복원

    // 안내·실시간 표기·결과 공용 문구 — '나온 건 제외' 행과 원판(포인터) 사이
    this.resultText = this.add.text(this.cx, 252, '돌려서 메뉴를 정하세요', {
      fontFamily: FONT, fontSize: '32px', color: css(C.subtext), fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);

    this.spinBtn = makeButton(this, {
      x: this.cx, y: 1104, w: 360, h: 100, label: '돌리기', variant: 'primary',
      onClick: () => this.spin(),
    });

    this.editBtn = this.add.text(this.cx, 1206, '✎ 메뉴 편집', {
      fontFamily: FONT, fontSize: '30px', color: css(C.subtext),
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.editBtn.on('pointerover', () => this.editBtn.setColor(css(C.primary)));
    this.editBtn.on('pointerout', () => this.editBtn.setColor(css(C.subtext)));
    this.editBtn.on('pointerup', () => this.openEditor());
  }

  // 메뉴(저장분 우선) + 제외 목록 복원
  setupItems() {
    this.items = ensureFry(loadItems(this.mealKey, this.meal.defaults));
    this.excluded = new Set(loadExcluded(this.mealKey, this.items));
  }

  // ===== 비복원 모드 =====
  toggleExclude() {
    if (this.locked) return;
    this.excludeMode = !this.excludeMode;
    saveStr(LS_EXCLUDE, this.excludeMode ? 'on' : 'off');
    if (!this.excludeMode) this.cancelExclusions(); // 끄면 목록도 비움(저장 포함)
    else this.applyExclusionDims(); // 켜면 저장돼 있던 제외 표시 복원
    this.updateExcludeUi();
    Sfx.play('tap');
  }

  // 제외 취소: 흐려진 칸을 전부 되살린다(저장분도 비움)
  cancelExclusions() {
    if (this.locked) return;
    this.excluded.clear();
    saveExcluded(this.mealKey, this.excluded);
    (this.dimOverlays || []).forEach((o) => o.destroy());
    this.dimOverlays = [];
    (this.sliceLabels || []).forEach((l) => l.setAlpha(1));
    this.updateExcludeUi();
  }

  // 저장·복원된 제외 목록을 휠에 반영(칸 흐림)
  applyExclusionDims() {
    if (!this.excludeMode) return;
    this.items.forEach((name, i) => { if (this.excluded.has(name)) this.dimSlice(i); });
  }

  updateExcludeUi() {
    this.excludeBtn.setText(this.excludeMode ? '☑ 나온 건 제외' : '☐ 나온 건 제외');
    this.excludeBtn.setColor(css(this.excludeMode ? C.primary : C.subtext));
    const n = this.excluded.size;
    this.cancelBtn.setVisible(this.excludeMode && n > 0);
    this.cancelBtn.setText(`↺ 제외 취소 (${n})`);
  }

  // 칸 오버레이 공통 경로(도넛 조각) — 가운데 허브(원+캡)는 가리지 않는다
  fillSlicePath(g, i) {
    const innerR = 43; // 허브가 가리는 경계와 일치(반지름 40 + 테두리 6의 바깥 절반 3) — 틈도 침범도 없게
    const start = Phaser.Math.DegToRad(i * this.sliceAngle);
    const end = Phaser.Math.DegToRad((i + 1) * this.sliceAngle);
    g.beginPath();
    g.arc(0, 0, this.radius, start, end, false);
    g.arc(0, 0, innerR, end, start, true);
    g.closePath();
    g.fillPath();
  }

  // 흐림 처리: 칸 위에 어두운 오버레이 + 라벨 흐림(휠과 함께 회전)
  dimSlice(i) {
    const g = this.add.graphics();
    g.fillStyle(C.bg, 0.62);
    this.fillSlicePath(g, i);
    this.wheel.add(g);
    this.dimOverlays.push(g);
    if (this.sliceLabels[i]) this.sliceLabels[i].setAlpha(0.4);
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
  // 노랑은 감자튀김 전용(팔레트에서 제외되어 자동 보장).
  computeSliceColors() {
    const n = this.items.length;
    const palette = OTHER_COLORS;
    const colors = new Array(n);
    for (let i = 0; i < n; i += 1) {
      if (this.items[i] === FRY) { colors[i] = FRY_COLOR; continue; }
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
    this.sliceLabels = [];
    this.dimOverlays = [];

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
    g.lineStyle(4, C.surfaceAlt, 1).strokeCircle(0, 0, this.radius + 5); // 외곽 림(질감)
    this.wheel.add(g);

    this.items.forEach((name, i) => {
      const mid = Phaser.Math.DegToRad((i + 0.5) * this.sliceAngle);
      const lx = Math.cos(mid) * this.radius * 0.62;
      const ly = Math.sin(mid) * this.radius * 0.62;
      const display = name === FRY ? `🍟 ${name}` : name;
      const label = this.add.text(lx, ly, display, {
        fontFamily: FONT, fontSize: `${fontSize}px`, color: css(C.bg), fontStyle: 'bold',
      }).setOrigin(0.5);
      // 긴 이름은 칸 안에 들어가도록 폰트 자동 축소(반지름 방향 최대 폭 기준)
      const maxW = 200;
      if (label.width > maxW) {
        label.setFontSize(Math.max(14, Math.floor((fontSize * maxW) / label.width)));
      }
      let rot = mid;
      if (Math.cos(mid) < 0) rot += Math.PI;
      label.setRotation(rot);
      // 숨은 치트 진입점(더블탭, 모든 메뉴) — 이스터에그라 커서 힌트 없음
      label.setInteractive();
      label.on('pointerup', () => this.onLabelTap(i));
      this.wheel.add(label);
      this.sliceLabels.push(label);
    });

    const hub = this.add.circle(0, 0, 40, C.surface).setStrokeStyle(6, C.bg);
    this.wheel.add(hub);
    const hubCap = this.add.circle(-9, -11, 13, 0xffffff, 0.10); // 허브 캡 광택
    this.wheel.add(hubCap);
  }

  // 참고: 제외 목록 초기화는 호출자가 결정 — 모드 전환은 setupItems가 모드별로 복원하고,
  // 메뉴 편집(추가/삭제/기본값)은 clearExclusions()로 명시적으로 비운다(공정성).
  rebuildWheel() {
    if (this.wheel) this.wheel.destroy();
    this.fryHint = null; // 휠과 함께 파괴됨(제외 오버레이도 함께)
    this.wheelAngle = 0;
    this.buildWheel();
    this.updateFryHint();
    this.applyExclusionDims();
    this.updateExcludeUi();
  }

  // 메뉴 구성이 바뀔 때 제외 기록 초기화(뽑기 상자와 같은 공정성 정책)
  clearExclusions() {
    this.excluded.clear();
    saveExcluded(this.mealKey, this.excluded);
  }

  // 특정 칸 위에 흰 오버레이(반짝임용) — 휠 컨테이너에 넣어 함께 회전
  sliceOverlay(i) {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    this.fillSlicePath(g, i);
    g.setAlpha(0);
    this.wheel.add(g);
    return g;
  }

  // 🍟 보증 예고: 9번째 스핀 뒤(카운터 9)부터 감자튀김 칸이 은은하게 반짝인다(정직한 힌트)
  updateFryHint() {
    const pity = parseInt(loadStr(LS_SPINS, '0'), 10) || 0;
    const need = pity >= PITY - 1 && this.items.indexOf(FRY) !== -1;
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

  // 숨은 치트: 아무 메뉴 라벨이나 더블탭 → 칸이 반짝이며 그 메뉴 확정 스핀
  onLabelTap(i) {
    if (this.locked) return;
    if (this.excludeMode && this.excluded.has(this.items[i])) return; // 제외된 칸은 무시
    const now = this.time.now;
    if (this.lastTap && this.lastTap.i === i && now - this.lastTap.t < 350) {
      this.lastTap = null;
      this.flashSlice(i, () => this.spin(i));
    } else {
      this.lastTap = { i, t: now };
    }
  }

  flashSlice(i, onDone) {
    Sfx.play('pop');
    const g = this.sliceOverlay(i);
    this.tweens.add({
      targets: g, alpha: 0.7, duration: 110, yoyo: true, repeat: 2, ease: 'Quad.easeInOut',
      onComplete: () => { g.destroy(); onDone(); },
    });
  }

  buildPointer() {
    const topY = this.cy - this.radius;
    // 명시적 depth — rebuildWheel()로 원판이 새로 그려져도(리스트 맨 위) 포인터가 항상 위에 온다
    const g = this.add.graphics().setDepth(5);
    g.fillStyle(0x000000, 0.25).fillTriangle(this.cx - 26, topY - 44, this.cx + 26, topY - 44, this.cx, topY + 10);
    g.fillStyle(C.text, 1).fillTriangle(this.cx - 24, topY - 46, this.cx + 24, topY - 46, this.cx, topY + 6);
  }

  spin(forceIdx = null) {
    if (this.locked) return;
    // 비복원: 남은 풀 계산 — 모두 나왔으면 스핀 대신 안내(정직: 빈 풀에서 돌리지 않는다)
    const pool = this.items.map((_, i) => i)
      .filter((i) => !this.excludeMode || !this.excluded.has(this.items[i]));
    if (pool.length === 0) {
      this.resultText.setColor(css(C.warning)).setText('전부 나왔어요!\n↺ 제외 취소로 되돌리기').setScale(1);
      return;
    }
    this.lock();
    this.spinBtn.disableButton();

    // 스핀 중 실시간 표기: 포인터가 지나는 칸의 이름을 그 칸 색으로(포인터-텍스트 일치 + 색상 연결)
    const pointedAt = (deg) => {
      const local = (((270 - deg) % 360) + 360) % 360; // 포인터는 상단(270°)
      return Math.floor(local / this.sliceAngle) % this.n;
    };
    const showPointed = (idx) => {
      this.resultText.setColor(css(this.colorFor(idx))).setText(this.items[idx]);
    };

    // 🍟 보증(피티): 10번째 스핀은 감자튀김 확정 — 공개 규칙(docs/game.md)
    let pity = parseInt(loadStr(LS_SPINS, '0'), 10) || 0;
    pity += 1;
    const fryIdx = this.items.indexOf(FRY);
    const fryAvailable = fryIdx !== -1 && pool.includes(fryIdx);
    let winner;
    if (forceIdx !== null) winner = forceIdx; // 더블탭 치트(선택 메뉴 확정)
    else if (pity >= PITY && fryAvailable) winner = fryIdx;
    else winner = pool[this.rng.between(0, pool.length - 1)];
    // 감자튀김이 나오면(보증이든 자연이든) 카운터 리셋
    if (this.items[winner] === FRY) pity = 0;
    saveStr(LS_SPINS, String(pity));
    const winnerCenter = (winner + 0.5) * this.sliceAngle;

    const spins = 4;
    const currentMod = ((this.wheelAngle % 360) + 360) % 360;
    const targetMod = (((270 - winnerCenter) % 360) + 360) % 360;
    const delta = ((targetMod - currentMod + 360) % 360) + 360 * spins;
    const finalAngle = this.wheelAngle + delta;

    Sfx.play('pop'); // 출발
    const proxy = { a: this.wheelAngle };
    let lastPointed = pointedAt(this.wheelAngle);
    showPointed(lastPointed);
    this.tweens.add({
      targets: proxy,
      a: finalAngle,
      duration: 3800,
      ease: EASE.spin,
      onUpdate: () => {
        this.wheel.rotation = Phaser.Math.DegToRad(proxy.a);
        // 칸이 바뀔 때만 틱 + 표기 갱신 — 감속(ease-out)과 함께 간격이 벌어지며 긴장이 자연히 쌓인다
        const idx = pointedAt(proxy.a);
        if (idx !== lastPointed) { lastPointed = idx; Sfx.play('tick'); showPointed(idx); }
      },
      onComplete: () => {
        this.wheelAngle = finalAngle;
        this.reveal(winner);
      },
    });
  }

  reveal(winner) {
    // 색상 연결(color linkage): 결과 텍스트·플래시를 당첨 칸 색과 매칭 → 출처가 색으로 이어짐
    const sliceColor = this.colorFor(winner);
    const isFry = this.items[winner] === FRY;
    const text = isFry
      ? `오늘 ${this.meal.label}은\n🍟 감자튀김 !!`
      : `오늘 ${this.meal.label}은\n${this.items[winner]} !`;
    this.resultText.setColor(css(sliceColor));
    this.resultText.setText(text);
    this.resultText.setScale(0);
    this.tweens.add({ targets: this.resultText, scale: 1, duration: 320, ease: EASE.bounce });
    this.colorFlash(sliceColor, 180);
    if (isFry) {
      // 🍟 이스터에그: 감자튀김 파티클이 쏟아진다
      this.friesBurst(this.cx, this.cy - this.radius);
      this.friesBurst(this.cx, 252); // 결과 문구 위치
      this.shake(0.007, 220);
    } else {
      this.burst(this.cx, this.cy - this.radius, sliceColor, 26); // 당첨 칸(포인터) 위치에서 폭발
    }
    Sfx.play('win');

    this.spinBtn.enableButton(); // 라벨은 항상 '돌리기' 유지
    this.unlock();
    this.updateFryHint(); // 보증 카운터 9면 반짝임 시작, 감자튀김이 나왔으면 해제

    // 비복원: 나온 항목을 제외 목록에 넣고 칸을 흐린다(남은 풀이 항상 보임 — 정직)
    // 🍟 감자튀김은 제외되지 않는다 — "감자튀김은 영원해요"(삭제 불가와 같은 규칙)
    if (this.excludeMode && this.items[winner] !== FRY) {
      this.excluded.add(this.items[winner]);
      saveExcluded(this.mealKey, this.excluded); // 기기 내 저장 — 재진입해도 유지
      this.dimSlice(winner);
      this.updateExcludeUi();
    }
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

    // 팝 등장(주스) — 모달 공통 페이드
    this.editor.setAlpha(0);
    this.tweens.add({ targets: this.editor, alpha: 1, duration: 160, ease: 'Quad.easeOut' });
  }

  renderChips() {
    this.stopClearBlink(); // 이전 칩을 향한 트윈이 파괴된 대상을 만지지 않도록
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
      const outlineColor = kind === 'add' ? C.primary
        : kind === 'reset' ? C.warning
        : kind === 'clear' ? C.danger : null;
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
      return chip;
    };

    this.items.forEach((name) => {
      const display = name === FRY ? `🍟 ${name}` : `${name}  ✕`; // 감자튀김은 삭제 불가 표시
      addChip(display, 'item', () => this.removeItem(name));
    });
    addChip('+ 추가', 'add', () => this.addItem());
    addChip('↺ 기본값', 'reset', () => this.resetItems());
    this.clearChip = addChip('🗑 모두 지우기', 'clear', () => this.clearItems());
  }

  // 이 시간대만 기본 메뉴로 복원(다른 시간대 저장분은 그대로)
  resetItems() {
    try { localStorage.removeItem(keyFor(this.mealKey)); } catch (e) { /* 무시 */ }
    this.items = ensureFry([...this.meal.defaults]);
    this.clearExclusions();
    this.rebuildWheel();
    this.renderChips();
    this.flashNote(`${this.meal.label} 메뉴를 기본값으로 복원했어요`);
  }

  // 모두 지우기: 이 시간대 메뉴를 감자튀김만 남기고 비운다 — 파괴적 동작이라 두 번 눌러 확정
  clearItems() {
    if (!this.confirmClear) {
      this.confirmClear = true;
      this.flashNote(`한 번 더 누르면 ${this.meal.label} 메뉴를 모두 지워요 (🍟 제외)`);
      // 주의 환기: 버튼 깜빡임(안내 문구가 돌아오는 1.2초에 맞춰 종료, 알파 1로 복귀)
      this.stopClearBlink();
      this.clearBlink = this.tweens.add({
        targets: this.clearChip,
        alpha: 0.25, duration: 150, yoyo: true, repeat: 3, ease: 'Quad.easeInOut',
      });
      this.time.delayedCall(1400, () => { this.confirmClear = false; });
      return;
    }
    this.confirmClear = false;
    this.stopClearBlink();
    this.items = [FRY];
    saveItems(this.mealKey, this.items);
    this.clearExclusions();
    this.rebuildWheel();
    this.renderChips();
    this.flashNote('감자튀김만 남기고 모두 지웠어요 — + 추가로 채워 주세요');
  }

  // 깜빡임 중단 + 알파 원복(확정·에디터 닫기 등 중도 이탈 대비)
  stopClearBlink() {
    if (this.clearBlink) { this.clearBlink.stop(); this.clearBlink = null; }
    if (this.clearChip && this.clearChip.active) this.clearChip.setAlpha(1);
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
    this.items = this.items.filter((x) => x !== name);
    saveItems(this.mealKey, this.items);
    this.clearExclusions();
    this.rebuildWheel();
    this.renderChips();
  }

  addItem() {
    if (this.items.length >= 16) { this.flashNote('최대 16개까지예요'); return; }
    openTextInput(this, {
      title: `${this.meal.label} 메뉴 추가`,
      inputmode: 'text', maxLength: 12,
      onSubmit: (raw) => {
        const name = raw.trim();
        if (!name) return;
        if (this.items.includes(name)) { this.flashNote('이미 있는 메뉴예요'); return; }
        this.items.push(name);
        saveItems(this.mealKey, this.items);
        this.clearExclusions();
        this.rebuildWheel();
        this.renderChips();
      },
    });
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
    this.stopClearBlink();
    closeTextInput(this);
    if (this.editor) { this.editor.destroy(); this.editor = null; }
    this.resultText.setColor(css(C.subtext)).setText('돌려서 메뉴를 정하세요').setScale(1);
    this.spinBtn.setLabel('돌리기');
  }
}
