// 조 배정 — 결정 돕기. 인원(번호 또는 이름 명단)과 조 수를 정하면 섞어서 N개 조로 나눈다.
// 정직한 매핑: Fisher-Yates 셔플 → 조별 순차 배치 — 배정 과정이 순서대로 화면에 보인다.
// 표현: 조 패널 안에 번호/이름이 '칩 클러스터'로 모여든다(도착 순서 그대로 — 정직).
// 명단(옵션): '✎ 명단 편집'에서 이름을 넣고 사람마다 참여 → 👑 조장 → 쉬기 상태를 탭으로 순환.
//   참여 2명 이상이면 번호 대신 명단으로 배정하고, 지정 조장은 각 조에 1명씩 우선 배치된다.
// 색상 연결: 조마다 고유색(PLAYER 팔레트) — 라벨·테두리·칩·완료 연출이 같은 색.
import MiniGame from '../MiniGame.js';
import { C, css, FONT, EASE, RADIUS, PLAYER } from '../theme.js';
import { makeButton } from '../ui.js';
import { Sfx } from '../sfx.js';

const LS_COUNT = 'dori.team.count';
const LS_GROUPS = 'dori.team.groups';
const LS_LEADER = 'dori.team.leader';
const LS_ROSTER = 'dori.team.roster';
const LS_LAST = 'dori.team.last'; // 지난 편성 기록(기기 내 — 재진입 시 복원)
const COUNT_MIN = 2;
const COUNT_MAX = 60;
const GROUP_MIN = 2;
const GROUP_MAX = 6;    // PLAYER 색 6종 한계(색상 연결 유지)
const ROSTER_MAX = 16;  // 이름 명단 상한(칩 가독 — 룰렛 16개와 동일)
const NAME_MAX = 4;     // 이름 4자(사다리와 동일 — 라벨 겹침 방지)

// 칩 클러스터 배치 — 이름(알약형) / 숫자(원형, 인원 밀도에 따라 3단계 자동 축소)
const NAME_CHIP = { w: 110, h: 42, cellW: 118, cellH: 50, perRow: 4, font: 22 };
const NUM_TIERS = [
  { d: 48, cellW: 56, cellH: 56, perRow: 8, font: 24 },
  { d: 40, cellW: 46, cellH: 46, perRow: 10, font: 20 },
  { d: 32, cellW: 38, cellH: 38, perRow: 12, font: 16 },
];

function saveStr(key, v) {
  try { localStorage.setItem(key, String(v)); } catch (e) { /* 무시 */ }
}

function loadInt(key, fallback, min, max) {
  try {
    const v = parseInt(localStorage.getItem(key) ?? '', 10);
    if (!Number.isNaN(v)) return Phaser.Math.Clamp(v, min, max);
  } catch (e) { /* 무시 */ }
  return fallback;
}

// 명단: [{ n: 이름, s: 'in'(참여) | 'lead'(조장) | 'out'(쉬기) }]
function loadRoster() {
  try {
    const raw = localStorage.getItem(LS_ROSTER);
    if (raw) {
      const a = JSON.parse(raw);
      if (Array.isArray(a)) {
        return a.filter((r) => r && typeof r.n === 'string' && ['in', 'lead', 'out'].includes(r.s))
          .slice(0, ROSTER_MAX);
      }
    }
  } catch (e) { /* 무시 */ }
  return [];
}

function saveRoster(roster) {
  try { localStorage.setItem(LS_ROSTER, JSON.stringify(roster)); } catch (e) { /* 무시 */ }
}

// 지난 편성: { roster: bool, lists: [[{label, isLeader}...], ...] }
function loadLast() {
  try {
    const raw = localStorage.getItem(LS_LAST);
    if (raw) {
      const v = JSON.parse(raw);
      if (v && Array.isArray(v.lists) && v.lists.every((l) => Array.isArray(l))) return v;
    }
  } catch (e) { /* 무시 */ }
  return null;
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
    this.roster = loadRoster();

    this.add.text(this.cx, 140, '조 배정', {
      fontFamily: FONT, fontSize: '48px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(this.cx, 196, '번호로 뽑거나, 명단을 만들어 이름으로 나눠요', {
      fontFamily: FONT, fontSize: '26px', color: css(C.subtext),
    }).setOrigin(0.5);

    this.countLabel = this.makeStepper(285, () => this.changeCount(-1), () => this.changeCount(1));
    this.groupLabel = this.makeStepper(360, () => this.changeGroups(-1), () => this.changeGroups(1));

    // 👑 조장 안내/토글 — 명단에 지정 조장이 있으면 그 현황을, 없으면 랜덤 조장 토글을 보여준다
    this.leaderBtn = this.add.text(this.cx, 425, '', {
      fontFamily: FONT, fontSize: '26px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.leaderBtn.on('pointerup', () => this.onLeaderTap());

    this.panelBox = this.add.container(0, 0);
    this.buildPanels();
    this.refreshLabels();

    this.hint = this.add.text(this.cx, 1000, '조 짜기를 누르면 조로 모여요', {
      fontFamily: FONT, fontSize: '30px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.assignBtn = makeButton(this, {
      x: this.cx, y: 1100, w: 360, h: 100, label: '조 짜기', variant: 'primary',
      onClick: () => this.assign(),
    });

    // 보조 액션: 명단 편집(좌) · 조 편성 복사(우 — 결과 후에만)
    this.editBtn = this.add.text(this.cx - 170, 1206, '✎ 명단 편집', {
      fontFamily: FONT, fontSize: '30px', color: css(C.subtext),
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.editBtn.on('pointerover', () => this.editBtn.setColor(css(C.primary)));
    this.editBtn.on('pointerout', () => this.editBtn.setColor(css(C.subtext)));
    this.editBtn.on('pointerup', () => this.openEditor());

    this.copyBtn = this.add.text(this.cx + 170, 1206, '📋 조 편성 복사', {
      fontFamily: FONT, fontSize: '30px', color: css(C.subtext),
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setVisible(false);
    this.copyBtn.on('pointerover', () => this.copyBtn.setColor(css(C.primary)));
    this.copyBtn.on('pointerout', () => this.copyBtn.setColor(css(C.subtext)));
    this.copyBtn.on('pointerup', () => this.copyResult());

    this.restoreLast(); // 지난 편성이 있으면 그대로 보여준다
  }

  // 지난 편성 복원 — 저장된 조 수가 현재 설정과 같을 때만 표시(다르면 새 판에서 갱신)
  restoreLast() {
    const saved = loadLast();
    if (!saved || saved.lists.length !== this.groups) return;
    this.rosterRound = !!saved.roster;
    const maxSize = Math.max(...saved.lists.map((l) => l.length), 1);
    this.chipSpec = this.rosterRound ? NAME_CHIP : this.pickNumSpecFor(maxSize);
    this.panels.forEach((p, i) => { p.expected = saved.lists[i].length; });
    saved.lists.forEach((list, g) => list.forEach((item) => this.makeChip(this.panels[g], item)));
    this.lastLists = saved.lists;
    const sizes = saved.lists.map((l) => l.length);
    const n = sizes.reduce((a, b) => a + b, 0);
    this.hint.setColor(css(C.subtext)).setText(`지난 편성 · ${n}명 → ${this.groups}조 (${sizes.join('·')}명)`);
    this.copyBtn.setVisible(true);
  }

  // ===== 명단 상태 =====
  activePeople() { return this.roster.filter((r) => r.s !== 'out'); }
  useRoster() { return this.activePeople().length >= 2; }

  // ± 스테퍼 한 줄(가운데 라벨, 양옆 버튼) — 콤팩트 사이즈
  makeStepper(y, onMinus, onPlus) {
    const label = this.add.text(this.cx, y, '', {
      fontFamily: FONT, fontSize: '28px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5);
    makeButton(this, { x: this.cx - 225, y, w: 76, h: 64, label: '−', variant: 'primary', fontSize: 34, onClick: onMinus });
    makeButton(this, { x: this.cx + 225, y, w: 76, h: 64, label: '＋', variant: 'primary', fontSize: 34, onClick: onPlus });
    return label;
  }

  // 긴 라벨(명단 요약 등)은 버튼과 겹치지 않게 자동 축소
  fitLabel(label, maxW = 350) {
    label.setFontSize(28);
    if (label.width > maxW) {
      label.setFontSize(Math.max(18, Math.floor((28 * maxW) / label.width)));
    }
  }

  changeCount(d) {
    if (this.locked) return;
    if (this.useRoster()) { this.flashHint('명단 사용 중 — 인원은 명단 편집에서 조정해요'); return; }
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
    const maxByPeople = this.useRoster() ? this.activePeople().length : this.count;
    this.groups = Phaser.Math.Clamp(this.groups + d, GROUP_MIN, Math.min(GROUP_MAX, maxByPeople));
    saveStr(LS_GROUPS, this.groups);
    this.refreshLabels();
    this.buildPanels();
    this.resetHint();
    Sfx.play('tap');
  }

  onLeaderTap() {
    if (this.locked) return;
    // 명단에 지정 조장이 있으면 토글 대신 명단 편집으로 안내
    if (this.roster.some((r) => r.s === 'lead')) { this.openEditor(); return; }
    this.leaderMode = !this.leaderMode;
    saveStr(LS_LEADER, this.leaderMode ? 'on' : 'off');
    this.refreshLabels();
    this.buildPanels();
    this.resetHint();
    Sfx.play('tap');
  }

  refreshLabels() {
    if (this.useRoster()) {
      const act = this.activePeople().length;
      const rest = this.roster.length - act;
      this.countLabel.setText(rest > 0 ? `명단 ${act}명 참여 · ${rest}명 쉼` : `명단 ${act}명 참여`);
    } else {
      this.countLabel.setText(`인원 ${this.count}명`);
    }
    this.fitLabel(this.countLabel);
    this.groupLabel.setText(`조 ${this.groups}개`);
    this.fitLabel(this.groupLabel);
    const leads = this.roster.filter((r) => r.s === 'lead').length;
    if (leads > 0) {
      this.leaderBtn.setText(`👑 조장 ${leads}명 지정됨 — 랜덤 조에 우선 배치`);
      this.leaderBtn.setColor(css(C.warning));
    } else {
      this.leaderBtn.setText(this.leaderMode ? '☑ 👑 조장 뽑기 — 첫 도착이 조장' : '☐ 👑 조장 뽑기');
      this.leaderBtn.setColor(css(this.leaderMode ? C.primary : C.subtext));
    }
  }

  resetHint() {
    this.hint.setColor(css(C.subtext)).setText('조 짜기를 누르면 조로 모여요').setScale(1);
    if (this.copyBtn) this.copyBtn.setVisible(false); // 결과가 사라지면 복사도 숨김(정직)
    this.lastLists = null;
  }

  flashHint(msg) {
    this.hint.setColor(css(C.warning)).setText(msg).setScale(1);
    this.time.delayedCall(1500, () => { if (this.hint.active && !this.lastLists) this.resetHint(); });
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

  // 칩 위치(클러스터): 도착 순서 j → 행/열, 최종 개수 기준 세로 중앙 고정(애니 중에도 안 흔들림)
  chipPos(panel, j, spec) {
    const col = j % spec.perRow;
    const row = Math.floor(j / spec.perRow);
    const rows = Math.max(1, Math.ceil(panel.expected / spec.perRow));
    const blockH = rows * spec.cellH - (spec.cellH - (spec.d ?? spec.h));
    const x = 160 + col * spec.cellW + spec.cellW / 2;
    const y = panel.y + (panel.h - blockH) / 2 + row * spec.cellH + (spec.d ?? spec.h) / 2;
    return { x, y };
  }

  // 조당 최대 인원에 맞는 숫자 칩 티어 선택(패널 높이에 들어가는 첫 티어)
  pickNumSpecFor(maxSize) {
    const avail = this.panels[0].h - 8;
    for (const t of NUM_TIERS) {
      const rows = Math.ceil(maxSize / t.perRow);
      if (rows * t.cellH - (t.cellH - t.d) <= avail) return t;
    }
    return NUM_TIERS[NUM_TIERS.length - 1];
  }

  pickNumSpec() {
    return this.pickNumSpecFor(Math.ceil(this.count / this.groups));
  }

  // 칩 — 숫자는 원형, 이름은 알약형. 조원: 어두운 면+조 색 테두리 / 조장: 조 색 채움+👑
  makeChip(panel, item) {
    const spec = this.chipSpec;
    const { x, y } = this.chipPos(panel, panel.chips.length, spec);
    const con = this.add.container(x, y);
    const g = this.add.graphics();
    if (this.rosterRound) {
      if (item.isLeader) g.fillStyle(panel.color, 1).fillRoundedRect(-spec.w / 2, -spec.h / 2, spec.w, spec.h, spec.h / 2);
      else {
        g.fillStyle(C.surfaceAlt, 1).fillRoundedRect(-spec.w / 2, -spec.h / 2, spec.w, spec.h, spec.h / 2);
        g.lineStyle(3, panel.color, 0.9).strokeRoundedRect(-spec.w / 2, -spec.h / 2, spec.w, spec.h, spec.h / 2);
      }
    } else if (item.isLeader) {
      g.fillStyle(panel.color, 1).fillCircle(0, 0, spec.d / 2);
    } else {
      g.fillStyle(C.surfaceAlt, 1).fillCircle(0, 0, spec.d / 2);
      g.lineStyle(3, panel.color, 0.9).strokeCircle(0, 0, spec.d / 2);
    }
    con.add(g);
    con.add(this.add.text(0, 0, item.label, {
      fontFamily: FONT, fontSize: `${spec.font}px`,
      color: css(item.isLeader ? C.bg : C.text), fontStyle: 'bold',
    }).setOrigin(0.5));
    if (item.isLeader) {
      const cx = this.rosterRound ? spec.w / 2 - 8 : spec.d / 2 - 9;
      const cy = this.rosterRound ? -spec.h / 2 : -(spec.d / 2) + 3;
      con.add(this.add.text(cx, cy, '👑', { fontSize: '20px' }).setOrigin(0.5));
    }
    this.panelBox.add(con);
    panel.chips.push(con);
    panel.result.push(item);
    // 통통 등장(클러스터가 자라나는 느낌)
    con.setScale(0);
    this.tweens.add({ targets: con, scale: 1, duration: 200, ease: EASE.popIn });
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = this.rng.between(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // 배정표 구성: 조별 리스트(조장 우선) — 균형 인원(앞 조부터 1명 더, 공정·공개)
  buildAssignment() {
    const K = this.groups;
    let people;
    if (this.rosterRound) {
      const act = this.activePeople();
      const leaders = this.shuffle(act.filter((p) => p.s === 'lead').map((p) => ({ label: p.n, isLeader: true })));
      const members = this.shuffle(act.filter((p) => p.s !== 'lead').map((p) => ({ label: p.n, isLeader: false })));
      // 지정 조장은 각 조에 1명씩 — 조 수보다 많으면 나머지는 조원으로(규칙 공개)
      const demoted = leaders.splice(K).map((p) => ({ ...p, isLeader: false }));
      members.push(...this.shuffle(demoted));
      people = { leaders, members, n: act.length };
    } else {
      const order = this.shuffle(Array.from({ length: this.count }, (_, i) => ({ label: String(i + 1), isLeader: false })));
      const leaders = [];
      if (this.leaderMode) {
        for (let g = 0; g < K; g += 1) { const p = order.shift(); p.isLeader = true; leaders.push(p); }
      }
      people = { leaders, members: order, n: this.count + 0 };
    }
    const lists = Array.from({ length: K }, () => []);
    // 조장이 조 수보다 적어도 허용 — 어떤 조가 조장을 받을지도 셔플(앞 조 고정 방지, 공정)
    const targets = this.shuffle(Array.from({ length: K }, (_, i) => i));
    people.leaders.forEach((p, i) => lists[targets[i % K]].push(p));
    const sizes = lists.map((_, i) => Math.floor(people.n / K) + (i < people.n % K ? 1 : 0));
    let gi = 0;
    people.members.forEach((p) => {
      let guard = 0;
      while (lists[gi].length >= sizes[gi] && guard < K) { gi = (gi + 1) % K; guard += 1; }
      lists[gi].push(p);
      gi = (gi + 1) % K;
    });
    return lists;
  }

  assign() {
    if (this.locked) return;
    this.rosterRound = this.useRoster(); // 이번 판의 모드 고정(명단 참여 2명 이상이면 이름으로)
    const n = this.rosterRound ? this.activePeople().length : this.count;
    if (n < this.groups) { this.flashHint('참여 인원이 조 수보다 적어요'); return; }
    this.lock();
    this.assignBtn.disableButton();
    this.buildPanels(); // 이전 결과 클리어
    this.chipSpec = this.rosterRound ? NAME_CHIP : this.pickNumSpec(); // 밀도에 맞는 칩 크기
    this.hint.setColor(css(C.subtext)).setText('...').setScale(1);
    this.copyBtn.setVisible(false);
    Sfx.play('pop'); // 출발

    const lists = this.buildAssignment();
    this.panels.forEach((p, i) => { p.expected = lists[i].length; });

    // 애니메이션 순서: 자리(조장 → 조원) 단위로 조를 돌며 등장 — 라운드로빈이 눈에 보인다
    const seq = [];
    const maxLen = Math.max(...lists.map((l) => l.length));
    for (let pos = 0; pos < maxLen; pos += 1) {
      for (let g = 0; g < this.groups; g += 1) {
        if (lists[g][pos]) seq.push({ g, item: lists[g][pos] });
      }
    }
    const delay = Phaser.Math.Clamp(Math.floor(1800 / seq.length), 45, 120);
    seq.forEach((step, i) => {
      this.time.delayedCall(delay * (i + 1), () => {
        this.makeChip(this.panels[step.g], step.item);
        Sfx.play('tick'); // 빌드업 틱
        if (i === seq.length - 1) this.finish(lists);
      });
    });
  }

  finish(lists) {
    this.lastLists = lists;
    // 지난 편성 기록(기기 내 — 재진입 시 복원, 서버 전송 없음)
    try { localStorage.setItem(LS_LAST, JSON.stringify({ roster: this.rosterRound, lists })); } catch (e) { /* 무시 */ }
    const sizes = this.panels.map((p) => p.chips.length);
    const n = sizes.reduce((a, b) => a + b, 0);
    this.hint.setColor(css(C.success));
    this.hint.setText(`완료! ${n}명 → ${this.groups}조 (${sizes.join('·')}명)`);
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

  // 조 편성을 텍스트로 복사(조장 👑 표시 — 붙여넣기 가독)
  async copyResult() {
    if (!this.lastLists) return;
    const lines = this.lastLists.map((list, i) => {
      const parts = list.map((r) => (r.isLeader ? `👑${r.label}` : r.label));
      return `${i + 1}조  ${parts.join(' · ')}`;
    });
    const n = this.lastLists.reduce((a, l) => a + l.length, 0);
    const text = `dori 조 배정 — ${n}명 → ${this.groups}조\n${lines.join('\n')}\nhttps://ff-1204.github.io/dori/#team`;
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

  // ===== 명단 편집(버퍼): 이름 추가 · 탭으로 참여 → 👑 조장 → 쉬기 순환 · ✕ 삭제 =====
  openEditor() {
    if (this.editor || this.locked) return;
    const { width, height } = this.scale;

    this.editor = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.72).setOrigin(0).setInteractive();
    this.editor.add(dim);

    const px = 40; const py = 180; const pw = 640; const ph = 900;
    this.edRect = { px, py, pw };
    const panel = this.add.graphics();
    panel.fillStyle(C.surface, 1).fillRoundedRect(px, py, pw, ph, RADIUS);
    panel.lineStyle(2, C.surfaceAlt, 1).strokeRoundedRect(px, py, pw, ph, RADIUS);
    this.editor.add(panel);

    this.editor.add(this.add.text(width / 2, py + 52, '명단 편집', {
      fontFamily: FONT, fontSize: '40px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5));

    this.editorNote = this.add.text(width / 2, py + 100, '탭: 참여 → 👑 조장 → 쉬기 · ✕로 삭제', {
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
    const { px, py, pw } = this.edRect;
    this.chipsBox.removeAll(true);

    const startX = px + 32;
    const startY = py + 156;
    const maxX = px + pw - 32;
    const gap = 14;
    const chipH = 64;
    let x = startX;
    let y = startY;

    const addChip = (r, idx) => {
      const stateIcon = r.s === 'lead' ? '👑 ' : '';
      const labelStr = `${stateIcon}${r.n}  ✕`;
      const color = r.s === 'lead' ? C.warning : C.text;
      const t = this.add.text(0, 0, labelStr, {
        fontFamily: FONT, fontSize: '28px', color: css(color), fontStyle: 'bold',
      }).setOrigin(0.5);
      const w = Math.ceil(t.width) + 44;
      if (x + w > maxX) { x = startX; y += chipH + gap; }

      const g = this.add.graphics();
      if (r.s === 'lead') g.lineStyle(2, C.warning, 1).strokeRoundedRect(0, 0, w, chipH, 14);
      else g.fillStyle(C.surfaceAlt, 1).fillRoundedRect(0, 0, w, chipH, 14);
      t.setPosition(w / 2, chipH / 2);

      const chip = this.add.container(x, y, [g, t]);
      if (r.s === 'out') chip.setAlpha(0.35); // 쉬는 사람은 흐리게(정직한 상태 표시)
      // 본문 탭: 상태 순환 / 오른쪽 ✕: 삭제
      const mainHit = this.add.rectangle((w - 40) / 2, chipH / 2, w - 40, chipH, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      mainHit.on('pointerup', () => this.cycleState(idx));
      const delHit = this.add.rectangle(w - 22, chipH / 2, 40, chipH, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      delHit.on('pointerup', () => this.removeName(idx));
      chip.add(mainHit);
      chip.add(delHit);
      this.chipsBox.add(chip);

      x += w + gap;
    };

    this.roster.forEach((r, idx) => addChip(r, idx));

    // 컨트롤 칩: 추가 · 명단 복사(내보내기) · 붙여넣기(가져오기)
    const controls = [
      { label: '+ 추가', color: C.primary, onTap: () => this.addName() },
      { label: '📋 명단 복사', color: C.primary, onTap: () => this.copyRoster() },
      { label: '📥 붙여넣기', color: C.warning, onTap: () => this.pasteRoster() },
    ];
    controls.forEach((c) => {
      const t = this.add.text(0, 0, c.label, {
        fontFamily: FONT, fontSize: '28px', color: css(c.color), fontStyle: 'bold',
      }).setOrigin(0.5);
      const w = Math.ceil(t.width) + 44;
      if (x + w > maxX) { x = startX; y += chipH + gap; }
      const g = this.add.graphics();
      g.lineStyle(2, c.color, 1).strokeRoundedRect(0, 0, w, chipH, 14);
      t.setPosition(w / 2, chipH / 2);
      const chip = this.add.container(x, y, [g, t]);
      const hit = this.add.rectangle(w / 2, chipH / 2, w, chipH, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerup', c.onTap);
      chip.add(hit);
      this.chipsBox.add(chip);
      x += w + gap;
    });
  }

  // 명단 내보내기 — 그룹(조장/참여/쉼) 제목 아래 이름을 나열하는 순수 텍스트(특수문자 없음).
  // 비어 있는 그룹도 제목은 항상 포함 — 명단이 없어도 채워 쓸 수 있는 양식이 복사된다.
  async copyRoster() {
    const names = (s) => this.roster.filter((r) => r.s === s).map((r) => r.n);
    const section = (title, list) => (list.length ? `${title}\n${list.join('\n')}` : title);
    const text = [
      section('조장', names('lead')),
      section('참여', names('in')),
      section('쉼', names('out')),
    ].join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      this.flashNote(this.roster.length
        ? '명단이 복사됐어요 — 메모장 등에 붙여넣어 보관하세요'
        : '빈 명단 양식이 복사됐어요 — 채워서 붙여넣기 하세요');
    } catch (e) {
      this.flashNote('복사 실패 — 다시 시도해 주세요');
    }
  }

  // 명단 가져오기 — 여러 줄 입력이 필요해 DOM 텍스트영역 오버레이 사용(prompt는 줄바꿈이 깨짐)
  pasteRoster() {
    if (this.pasteOverlay) return;
    this.pasteOverlay = this.add.dom(this.cx, 620).createFromHTML(
      '<div style="width:560px;background:#1d1f2b;border:2px solid #2a2f42;border-radius:16px;padding:20px;font-family:sans-serif;">'
      + '<div style="color:#f2f3f7;font-size:24px;font-weight:bold;text-align:center;margin-bottom:12px;">명단 붙여넣기</div>'
      + '<div style="color:#8b90a8;font-size:18px;text-align:center;margin-bottom:10px;">조장 · 참여 · 쉼 제목 아래에 이름을 한 줄씩 (제목 없으면 전원 참여)</div>'
      + '<textarea id="dori-paste" rows="9" style="width:100%;box-sizing:border-box;font-size:22px;padding:12px;'
      + 'border-radius:12px;border:2px solid #2a2f42;background:#12131c;color:#f2f3f7;outline:none;resize:none;"></textarea>'
      + '<div style="display:flex;gap:12px;margin-top:14px;">'
      + '<button id="dori-paste-ok" style="flex:1;padding:14px;font-size:22px;font-weight:bold;border:none;border-radius:12px;background:#6cc7ff;color:#12131c;">불러오기</button>'
      + '<button id="dori-paste-cancel" style="flex:1;padding:14px;font-size:22px;border:none;border-radius:12px;background:#2a2f42;color:#f2f3f7;">취소</button>'
      + '</div></div>',
    ).setDepth(300);
    const node = this.pasteOverlay.node;
    node.querySelector('#dori-paste-ok').addEventListener('click', () => {
      const text = node.querySelector('#dori-paste').value;
      this.closePaste();
      this.importRoster(text);
    });
    node.querySelector('#dori-paste-cancel').addEventListener('click', () => this.closePaste());
    node.querySelector('#dori-paste').focus();
  }

  closePaste() {
    if (this.pasteOverlay) { this.pasteOverlay.destroy(); this.pasteOverlay = null; }
  }

  // 파싱: '조장'·'참여'·'쉼' 단어가 나오면 그 아래 이름들이 해당 그룹(제목 전까지) — 표식 문자 불필요
  importRoster(text) {
    const HEADERS = { 조장: 'lead', 참여: 'in', 쉼: 'out' };
    const tokens = String(text).split(/[\s,·]+/).map((t) => t.trim()).filter(Boolean);
    const parsed = [];
    let mode = 'in';
    let skipped = 0;
    tokens.forEach((tok) => {
      if (HEADERS[tok]) { mode = HEADERS[tok]; return; }
      const valid = tok.length <= NAME_MAX && !parsed.some((p) => p.n === tok) && parsed.length < ROSTER_MAX;
      if (valid) parsed.push({ n: tok, s: mode });
      else skipped += 1;
    });
    if (parsed.length === 0) { this.flashNote('가져올 이름이 없어요'); return; }
    this.roster = parsed;
    saveRoster(this.roster);
    this.renderChips();
    this.flashNote(`${parsed.length}명을 불러왔어요${skipped ? ` · ${skipped}건 제외(중복·4자 초과)` : ''}`);
    Sfx.play('pop');
  }

  cycleState(idx) {
    const r = this.roster[idx];
    r.s = r.s === 'in' ? 'lead' : r.s === 'lead' ? 'out' : 'in';
    saveRoster(this.roster);
    this.renderChips();
    Sfx.play('tap');
  }

  removeName(idx) {
    this.roster.splice(idx, 1);
    saveRoster(this.roster);
    this.renderChips();
  }

  addName() {
    if (this.roster.length >= ROSTER_MAX) { this.flashNote(`최대 ${ROSTER_MAX}명까지예요`); return; }
    const input = window.prompt(`이름 (${NAME_MAX}자 이내)`);
    if (input == null) return;
    const name = input.trim();
    if (!name || name.length > NAME_MAX) { if (name) this.flashNote(`${NAME_MAX}자 이내로 입력해 주세요`); return; }
    if (this.roster.some((r) => r.n === name)) { this.flashNote('이미 있는 이름이에요'); return; }
    this.roster.push({ n: name, s: 'in' });
    saveRoster(this.roster);
    this.renderChips();
  }

  flashNote(msg) {
    this.editorNote.setText(msg).setColor(css(C.warning));
    this.time.delayedCall(1200, () => {
      if (this.editorNote && this.editorNote.active) {
        this.editorNote.setText('탭: 참여 → 👑 조장 → 쉬기 · ✕로 삭제').setColor(css(C.subtext));
      }
    });
  }

  closeEditor() {
    this.closePaste();
    if (this.editor) { this.editor.destroy(); this.editor = null; }
    // 명단 변경을 화면에 반영: 조 수 상한 재검토 + 라벨·패널 갱신
    const maxByPeople = this.useRoster() ? this.activePeople().length : this.count;
    this.groups = Phaser.Math.Clamp(this.groups, GROUP_MIN, Math.max(GROUP_MIN, Math.min(GROUP_MAX, maxByPeople)));
    saveStr(LS_GROUPS, this.groups);
    this.refreshLabels();
    this.buildPanels();
    this.resetHint();
  }
}
