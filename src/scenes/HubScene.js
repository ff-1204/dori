// 허브 씬 — 게임 선택 포털. 정체성(결정 돕기·랜덤 뽑기·복불복)을 범주로 노출.
// 미구현 게임은 '준비 중'으로 흐리게 표시(정직한 어포던스: 누를 수 없음을 드러냄).
import { C, css, FONT, SP } from '../theme.js';
import { makeButton } from '../ui.js';
import { applyTimeAtmosphere } from '../timeOfDay.js';

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
    const phase = applyTimeAtmosphere(this); // 시간대 분위기(생리적 패턴)

    // 타이틀 "dori" — 그라디언트·그림자·강조선·은은한 호흡(미학-사용성 효과)
    const title = this.add.text(width / 2, 108, 'dori', {
      fontFamily: FONT, fontSize: '120px', fontStyle: 'bold', color: css(C.text),
    }).setOrigin(0.5);
    title.setLetterSpacing(6);
    title.setShadow(0, 8, '#000000', 18, false, true); // 깊이감
    // 위(밝음)→아래(강조색) 세로 그라디언트
    const grad = title.context.createLinearGradient(0, 0, 0, title.height);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, css(C.primary));
    title.setFill(grad);

    // 강조선(장식)
    this.add.rectangle(width / 2, 182, 96, 6, C.primary).setOrigin(0.5).setAlpha(0.9);

    // 등장(팝) 후 은은한 호흡 — 살짝 움직이는 화면이 비싸 보인다
    title.setScale(0.9).setAlpha(0);
    this.tweens.add({
      targets: title, scale: 1, alpha: 1, duration: 480, ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: title, scale: 1.03, duration: 2600, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        });
      },
    });

    // 시간대 인사말(감성) — 정보가 아닌 분위기 문구
    this.add.text(width / 2, 220, phase.greeting, {
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

    // 하단 제작자 크레딧 → GitHub (자연스러운 외부 링크, 안전 영역 안쪽)
    const credit = this.add.text(width / 2, this.scale.height - 44, 'made by ff-1204  ↗', {
      fontFamily: FONT, fontSize: '26px', color: css(C.subtext),
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    credit.on('pointerover', () => credit.setColor(css(C.primary)));
    credit.on('pointerout', () => credit.setColor(css(C.subtext)));
    credit.on('pointerup', () => window.open('https://github.com/ff-1204', '_blank'));
  }
}
