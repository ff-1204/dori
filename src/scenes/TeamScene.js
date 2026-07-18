// 조 배정 — 결정 돕기. 인원과 조 수를 정하면 번호를 섞어 N개 조로 공정하게 나눈다.
// 정직한 매핑: Fisher-Yates 셔플 → 라운드로빈 순차 배정 — 배정 과정이 순서대로 화면에 보인다.
// 색상 연결: 조마다 고유색(PLAYER 팔레트) — 라벨·패널 테두리·완료 연출이 같은 색.
import MiniGame from '../MiniGame.js';
import { C, css, FONT, EASE, RADIUS, PLAYER } from '../theme.js';
import { makeButton } from '../ui.js';
import { Sfx } from '../sfx.js';

const LS_COUNT = 'dori.team.count';
const LS_GROUPS = 'dori.team.groups';
const COUNT_MIN = 2;
const COUNT_MAX = 30;
const GROUP_MIN = 2;
const GROUP_MAX = 6; // PLAYER 색 6종 한계(색상 연결 유지)

function loadInt(key, fallback, min, max) {
  try {
    const v = parseInt(localStorage.getItem(key) ?? '', 10);
    if (!Number.isNaN(v)) return Phaser.Math.Clamp(v, min, max);
  } catch (e) { /* 무시 */ }
  return fallback;
}

function saveInt(key, v) {
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

    this.add.text(this.cx, 140, '조 배정', {
      fontFamily: FONT, fontSize: '48px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(this.cx, 196, '인원과 조를 정하면 번호를 섞어 나눠드려요', {
      fontFamily: FONT, fontSize: '26px', color: css(C.subtext),
    }).setOrigin(0.5);

    this.countLabel = this.makeStepper(310, () => this.changeCount(-1), () => this.changeCount(1));
    this.groupLabel = this.makeStepper(408, () => this.changeGroups(-1), () => this.changeGroups(1));

    this.panelBox = this.add.container(0, 0);
    this.buildPanels();
    this.refreshLabels();

    this.hint = this.add.text(this.cx, 1000, '조 짜기를 누르면 번호가 조로 나뉘어요', {
      fontFamily: FONT, fontSize: '30px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.assignBtn = makeButton(this, {
      x: this.cx, y: 1100, w: 360, h: 100, label: '조 짜기', variant: 'primary',
      onClick: () => this.assign(),
    });
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
    saveInt(LS_COUNT, this.count);
    saveInt(LS_GROUPS, this.groups);
    this.refreshLabels();
    this.buildPanels();
    this.resetHint();
    Sfx.play('tap');
  }

  changeGroups(d) {
    if (this.locked) return;
    this.groups = Phaser.Math.Clamp(this.groups + d, GROUP_MIN, Math.min(GROUP_MAX, this.count));
    saveInt(LS_GROUPS, this.groups);
    this.refreshLabels();
    this.buildPanels();
    this.resetHint();
    Sfx.play('tap');
  }

  refreshLabels() {
    this.countLabel.setText(`인원 ${this.count}명`);
    this.groupLabel.setText(`조 ${this.groups}개`);
  }

  resetHint() {
    this.hint.setColor(css(C.subtext)).setText('조 짜기를 누르면 번호가 조로 나뉘어요').setScale(1);
  }

  // 조 패널 — 색상 연결(조 색 = 라벨·테두리), 조 수에 맞춰 높이 자동
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
      const nums = this.add.text(176, y + h / 2, '', {
        fontFamily: FONT, fontSize: '26px', color: css(C.text), fontStyle: 'bold',
        wordWrap: { width: 460 }, lineSpacing: 6,
      }).setOrigin(0, 0.5);
      this.panelBox.add(g);
      this.panelBox.add(label);
      this.panelBox.add(nums);
      this.panels.push({ label, nums, y, h, color, list: [] });
    }
  }

  assign() {
    if (this.locked) return;
    this.lock();
    this.assignBtn.disableButton();
    this.panels.forEach((p) => { p.list = []; p.nums.setText(''); });
    this.hint.setColor(css(C.subtext)).setText('...').setScale(1);
    Sfx.play('pop'); // 출발

    // Fisher-Yates 셔플(시드 RNG) → 라운드로빈 배정. 안 나눠떨어지면 앞 조부터 1명 더(공정·공개)
    const order = Array.from({ length: this.count }, (_, i) => i + 1);
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = this.rng.between(0, i);
      [order[i], order[j]] = [order[j], order[i]];
    }

    const delay = Phaser.Math.Clamp(Math.floor(1800 / this.count), 45, 120);
    order.forEach((num, i) => {
      this.time.delayedCall(delay * (i + 1), () => {
        const p = this.panels[i % this.groups];
        p.list.push(num);
        p.nums.setText([...p.list].sort((a, b) => a - b).join(' · ')); // 읽기 쉽게 오름차순 표시
        Sfx.play('tick'); // 빌드업 틱
        if (i === this.count - 1) this.finish();
      });
    });
  }

  finish() {
    const sizes = this.panels.map((p) => p.list.length);
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
    this.unlock();
  }
}
