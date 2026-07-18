// 조 배정 — 결정 돕기. 인원과 조 수를 정하면 번호를 섞어 N개 조로 공정하게 나눈다.
// 정직한 매핑: Fisher-Yates 셔플 → 라운드로빈 순차 배정 — 배정 과정이 순서대로 화면에 보인다.
// 표현: 조 패널 안에 번호가 '칩 클러스터'로 모여든다(도착 순서 그대로 — 정직).
// 색상 연결: 조마다 고유색(PLAYER 팔레트) — 라벨·테두리·칩·완료 연출이 같은 색.
// 옵션: 👑 조장 뽑기 — 켜면 각 조의 첫 번째 번호가 조장(색 채움 + 왕관)으로 표시된다.
import MiniGame from '../MiniGame.js';
import { C, css, FONT, EASE, RADIUS, PLAYER } from '../theme.js';
import { makeButton } from '../ui.js';
import { Sfx } from '../sfx.js';

const LS_COUNT = 'dori.team.count';
const LS_GROUPS = 'dori.team.groups';
const LS_LEADER = 'dori.team.leader';
const COUNT_MIN = 2;
const COUNT_MAX = 30;
const GROUP_MIN = 2;
const GROUP_MAX = 6; // PLAYER 색 6종 한계(색상 연결 유지)

const CHIP_D = 48;   // 칩 지름(2자리 번호 가독)
const CHIP_GAP = 8;
const PER_ROW = 8;   // 패널 폭 기준 한 줄 최대(8×56 = 448 ≤ 470)

function loadInt(key, fallback, min, max) {
  try {
    const v = parseInt(localStorage.getItem(key) ?? '', 10);
    if (!Number.isNaN(v)) return Phaser.Math.Clamp(v, min, max);
  } catch (e) { /* 무시 */ }
  return fallback;
}

function saveStr(key, v) {
  try { localStorage.setItem(key, String(v)); } catch (e) { /* 무시 */ }
}

export default class TeamScene extends MiniGame {
  constructor() {
    super('Team');
  }

  onCreate() {
    const { width } = this.scale;
    this.cx = width / 2;
    this.count = loadInt(LS_COUNT, 8, COUNT_MIN, COUNT_MAX);
    this.groups = loadInt(LS_GROUPS, 2, GROUP_MIN, GROUP_MAX);
    if (this.groups > this.count) this.groups = GROUP_MIN;
    try { this.leaderMode = localStorage.getItem(LS_LEADER) === 'on'; } catch (e) { this.leaderMode = false; }

    this.add.text(this.cx, 140, '조 배정', {
      fontFamily: FONT, fontSize: '48px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(this.cx, 196, '인원과 조를 정하면 번호를 섞어 나눠드려요', {
      fontFamily: FONT, fontSize: '26px', color: css(C.subtext),
    }).setOrigin(0.5);

    this.countLabel = this.makeStepper(290, () => this.changeCount(-1), () => this.changeCount(1));
    this.groupLabel = this.makeStepper(375, () => this.changeGroups(-1), () => this.changeGroups(1));

    // 👑 조장 옵션 토글 — 각 조의 첫 번호가 조장이 된다(정직: 규칙을 라벨로 공개)
    this.leaderBtn = this.add.text(this.cx, 438, '', {
      fontFamily: FONT, fontSize: '28px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.leaderBtn.on('pointerup', () => this.toggleLeader());

    this.panelBox = this.add.container(0, 0);
    this.buildPanels();
    this.refreshLabels();

    this.hint = this.add.text(this.cx, 1000, '조 짜기를 누르면 번호가 조로 모여요', {
      fontFamily: FONT, fontSize: '30px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.assignBtn = makeButton(this, {
      x: this.cx, y: 1100, w: 360, h: 100, label: '조 짜기', variant: 'primary',
      onClick: () => this.assign(),
    });

    // 조 편성 복사 — 결과가 나온 뒤에만 노출(로또 복사 버튼과 같은 패턴)
    this.copyBtn = this.add.text(this.cx, 1206, '📋 조 편성 복사', {
      fontFamily: FONT, fontSize: '30px', color: css(C.subtext),
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setVisible(false);
    this.copyBtn.on('pointerover', () => this.copyBtn.setColor(css(C.primary)));
    this.copyBtn.on('pointerout', () => this.copyBtn.setColor(css(C.subtext)));
    this.copyBtn.on('pointerup', () => this.copyResult());
  }

  // ± 스테퍼 한 줄(가운데 라벨, 양옆 버튼 — 터치 타깃 88px)
  makeStepper(y, onMinus, onPlus) {
    const label = this.add.text(this.cx, y, '', {
      fontFamily: FONT, fontSize: '34px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5);
    makeButton(this, { x: this.cx - 240, y, w: 88, h: 76, label: '−', variant: 'primary', fontSize: 40, onClick: onMinus });
    makeButton(this, { x: this.cx + 240, y, w: 88, h: 76, label: '＋', variant: 'primary', fontSize: 40, onClick: onPlus });
    return label;
  }

  changeCount(d) {
    if (this.locked) return;
    this.count = Phaser.Math.Clamp(this.count + d, COUNT_MIN, COUNT_MAX);
    if (this.groups > this.count) this.groups = this.count; // 조가 인원보다 많을 수 없다
    saveStr(LS_COUNT, this.count);
    saveStr(LS_GROUPS, this.groups);
    this.refreshLabels();
    this.buildPanels();
    this.resetHint();
    Sfx.play('tap');
  }

  changeGroups(d) {
    if (this.locked) return;
    this.groups = Phaser.Math.Clamp(this.groups + d, GROUP_MIN, Math.min(GROUP_MAX, this.count));
    saveStr(LS_GROUPS, this.groups);
    this.refreshLabels();
    this.buildPanels();
    this.resetHint();
    Sfx.play('tap');
  }

  toggleLeader() {
    if (this.locked) return;
    this.leaderMode = !this.leaderMode;
    saveStr(LS_LEADER, this.leaderMode ? 'on' : 'off');
    this.refreshLabels();
    this.buildPanels(); // 이전 결과의 조장 표시가 남지 않게 초기화
    this.resetHint();
    Sfx.play('tap');
  }

  refreshLabels() {
    this.countLabel.setText(`인원 ${this.count}명`);
    this.groupLabel.setText(`조 ${this.groups}개`);
    this.leaderBtn.setText(this.leaderMode ? '☑ 👑 조장 뽑기 — 첫 번호가 조장' : '☐ 👑 조장 뽑기');
    this.leaderBtn.setColor(css(this.leaderMode ? C.primary : C.subtext));
  }

  resetHint() {
    this.hint.setColor(css(C.subtext)).setText('조 짜기를 누르면 번호가 조로 모여요').setScale(1);
    if (this.copyBtn) this.copyBtn.setVisible(false); // 결과가 사라지면 복사도 숨김(정직)
  }

  // 조 패널 — 색상 연결(조 색 = 라벨·테두리·칩), 조 수에 맞춰 높이 자동
  buildPanels() {
    this.panelBox.removeAll(true);
    this.panels = [];
    const top = 470;
    const bottom = 950;
    const gap = 12;
    const h = Math.min(120, Math.floor((bottom - top - gap * (this.groups - 1)) / this.groups));
    for (let i = 0; i < this.groups; i += 1) {
      const y = top + i * (h + gap);
      const color = PLAYER[i];
      const g = this.add.graphics();
      g.fillStyle(C.surface, 1).fillRoundedRect(60, y, 600, h, RADIUS);
      g.lineStyle(3, color, 0.9).strokeRoundedRect(60, y, 600, h, RADIUS);
      const label = this.add.text(92, y + h / 2, `${i + 1}조`, {
        fontFamily: FONT, fontSize: '30px', color: css(color), fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      this.panelBox.add(g);
      this.panelBox.add(label);
      this.panels.push({ y, h, color, chips: [], result: [], expected: 0 });
    }
  }

  // 칩 위치(클러스터): 도착 순서 j → 행/열, 최종 개수 기준으로 세로 중앙 정렬(애니 중에도 안 흔들림)
  chipPos(panel, j) {
    const col = j % PER_ROW;
    const row = Math.floor(j / PER_ROW);
    const rows = Math.max(1, Math.ceil(panel.expected / PER_ROW));
    const blockH = rows * (CHIP_D + CHIP_GAP) - CHIP_GAP;
    const x = 160 + col * (CHIP_D + CHIP_GAP) + CHIP_D / 2;
    const y = panel.y + (panel.h - blockH) / 2 + row * (CHIP_D + CHIP_GAP) + CHIP_D / 2;
    return { x, y };
  }

  // 번호 칩 — 조원: 어두운 면 + 조 색 테두리 / 조장: 조 색 채움 + 👑
  makeChip(panel, num, isLeader) {
    const { x, y } = this.chipPos(panel, panel.chips.length);
    const con = this.add.container(x, y);
    const g = this.add.graphics();
    if (isLeader) {
      g.fillStyle(panel.color, 1).fillCircle(0, 0, CHIP_D / 2);
    } else {
      g.fillStyle(C.surfaceAlt, 1).fillCircle(0, 0, CHIP_D / 2);
      g.lineStyle(3, panel.color, 0.9).strokeCircle(0, 0, CHIP_D / 2);
    }
    con.add(g);
    con.add(this.add.text(0, 0, String(num), {
      fontFamily: FONT, fontSize: '24px', color: css(isLeader ? C.bg : C.text), fontStyle: 'bold',
    }).setOrigin(0.5));
    if (isLeader) {
      con.add(this.add.text(15, -21, '👑', { fontSize: '20px' }).setOrigin(0.5));
    }
    this.panelBox.add(con);
    panel.chips.push(con);
    panel.result.push({ num, isLeader });
    // 통통 등장(클러스터가 자라나는 느낌)
    con.setScale(0);
    this.tweens.add({ targets: con, scale: 1, duration: 200, ease: EASE.popIn });
    return con;
  }

  assign() {
    if (this.locked) return;
    this.lock();
    this.assignBtn.disableButton();
    this.buildPanels(); // 이전 결과 클리어
    // 조별 최종 인원 미리 계산(라운드로빈: 앞 조부터 1명 더 — 공정·공개)
    this.panels.forEach((p, i) => {
      p.expected = Math.floor(this.count / this.groups) + (i < this.count % this.groups ? 1 : 0);
    });
    this.hint.setColor(css(C.subtext)).setText('...').setScale(1);
    this.copyBtn.setVisible(false);
    Sfx.play('pop'); // 출발

    const order = Array.from({ length: this.count }, (_, i) => i + 1);
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = this.rng.between(0, i);
      [order[i], order[j]] = [order[j], order[i]];
    }

    const delay = Phaser.Math.Clamp(Math.floor(1800 / this.count), 45, 120);
    order.forEach((num, i) => {
      this.time.delayedCall(delay * (i + 1), () => {
        const p = this.panels[i % this.groups];
        const isLeader = this.leaderMode && p.chips.length === 0; // 각 조의 첫 번호 = 조장
        this.makeChip(p, num, isLeader);
        Sfx.play('tick'); // 빌드업 틱
        if (i === this.count - 1) this.finish();
      });
    });
  }

  finish() {
    const sizes = this.panels.map((p) => p.chips.length);
    this.hint.setColor(css(C.success));
    this.hint.setText(`완료! ${this.count}명 → ${this.groups}조 (${sizes.join('·')}명)`);
    this.hint.setScale(0);
    this.tweens.add({ targets: this.hint, scale: 1, duration: 300, ease: EASE.bounce });
    // Peak-End: 조별 색 파티클을 순서대로 터뜨린다(색상 연결)
    this.panels.forEach((p, i) => {
      this.time.delayedCall(i * 70, () => this.burst(this.cx, p.y + p.h / 2, p.color, 14));
    });
    Sfx.play('win');
    this.assignBtn.enableButton();
    this.copyBtn.setVisible(true);
    this.unlock();
  }

  // 조 편성을 텍스트로 복사(조장 👑 우선 + 오름차순 — 붙여넣기 가독)
  async copyResult() {
    const lines = this.panels.map((p, i) => {
      const parts = [...p.result]
        .sort((a, b) => (b.isLeader - a.isLeader) || (a.num - b.num))
        .map((r) => (r.isLeader ? `👑${r.num}` : String(r.num)));
      return `${i + 1}조  ${parts.join(' · ')}`;
    });
    const text = `dori 조 배정 — ${this.count}명 → ${this.groups}조\n${lines.join('\n')}\nhttps://ff-1204.github.io/dori/#team`;
    try {
      await navigator.clipboard.writeText(text);
      this.flashCopy('✓ 복사됐어요');
    } catch (e) {
      this.flashCopy('복사 실패 — 다시 시도해 주세요');
    }
  }

  flashCopy(msg) {
    this.copyBtn.setText(msg);
    this.time.delayedCall(1200, () => {
      if (this.copyBtn.active) this.copyBtn.setText('📋 조 편성 복사');
    });
  }
}
