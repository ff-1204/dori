// 허브 씬 — 게임 선택 포털. 정체성(결정 돕기·랜덤 뽑기·복불복)을 범주로 노출.
// 미구현 게임은 '준비 중'으로 흐리게 표시(정직한 어포던스: 누를 수 없음을 드러냄).
import { C, css, FONT, SP } from '../theme.js';
import { makeButton } from '../ui.js';

const GAMES = [
  {
    cat: '결정 돕기',
    items: [
      { key: 'Roulette', name: '점심 메뉴 룰렛', ready: true },
      { key: 'Ladder', name: '사다리타기', ready: false },
      { key: 'Pinball', name: '랜덤 핀볼', ready: false },
    ],
  },
  {
    cat: '랜덤 뽑기',
    items: [
      { key: 'Draw', name: '뽑기 상자', ready: false },
    ],
  },
  {
    cat: '복불복',
    items: [
      { key: 'Russian', name: '러시안 룰렛', ready: false },
      { key: 'Croco', name: '악어 이빨 누르기', ready: false },
      { key: 'PopUp', name: '통아저씨', ready: false },
    ],
  },
];

export default class HubScene extends Phaser.Scene {
  constructor() {
    super('Hub');
  }

  create() {
    const { width } = this.scale;
    this.cameras.main.setBackgroundColor(C.bg);

    // 타이틀(미학-사용성 효과: 첫인상에 투자)
    this.add.text(width / 2, 96, 'dori', {
      fontFamily: FONT, fontSize: '104px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(width / 2, 168, '결정 · 뽑기 · 복불복 미니게임', {
      fontFamily: FONT, fontSize: '32px', color: css(C.subtext),
    }).setOrigin(0.5);

    // 범주별 게임 목록
    let y = 258;
    const btnW = width - SP.xl * 2;
    GAMES.forEach((group) => {
      this.add.text(SP.xl, y, group.cat, {
        fontFamily: FONT, fontSize: '34px', color: css(C.primary), fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      y += 52;

      group.items.forEach((g) => {
        makeButton(this, {
          x: width / 2,
          y: y + 44,
          w: btnW,
          h: 88, // 터치 타깃 ≥ 88px
          label: g.ready ? g.name : `${g.name}   ·   준비 중`,
          variant: g.ready ? 'primary' : 'disabled',
          onClick: g.ready ? () => this.scene.start(g.key) : null,
          fontSize: 36,
        });
        y += 88 + SP.sm;
      });

      y += SP.md;
    });
  }
}
