// 공통 UI 컴포넌트 — 어포던스(눌러 보임)·정직한 피드백 원칙 적용.
import { C, css, FONT, RADIUS, SP } from './theme.js';
import { Sfx } from './sfx.js';

// 어포던스 버튼: 입체감(그림자) + 눌림/호버 피드백. 터치 타깃 ≥ 88px 권장.
// variant: 'primary' | 'success' | 'danger' | 'disabled'
export function makeButton(scene, opts) {
  const { x, y, w = 320, h = 96, label, onClick, variant = 'primary', fontSize = 40 } = opts;
  const disabled = variant === 'disabled';
  const fill = disabled ? C.surfaceAlt
    : variant === 'danger' ? C.danger
    : variant === 'success' ? C.success
    : C.primary;
  const txtColor = disabled ? css(C.subtext) : css(C.bg);

  const con = scene.add.container(x, y);

  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2, -h / 2 + 6, w, h, RADIUS); // 그림자(깊이)
  g.fillStyle(fill, 1).fillRoundedRect(-w / 2, -h / 2, w, h, RADIUS);            // 면
  con.add(g);

  const t = scene.add.text(0, 0, label, {
    fontFamily: FONT, fontSize: `${fontSize}px`, color: txtColor, fontStyle: 'bold',
  }).setOrigin(0.5);
  con.add(t);

  con.setLabel = (s) => t.setText(s);

  if (disabled) {
    con.setAlpha(0.7); // 조작 불가는 흐리게 → 정직한 시그니파이어(누를 수 없음)
    return con;
  }

  const hit = scene.add.rectangle(0, 0, w, h, 0xffffff, 0).setInteractive({ useHandCursor: true });
  con.add(hit);

  // 호버는 데스크톱 보너스, 눌림은 모든 입력 공통 피드백
  hit.on('pointerover', () => con.setScale(1.04));
  hit.on('pointerout', () => con.setScale(1));
  hit.on('pointerdown', () => { con.setScale(0.94); Sfx.play('tap'); });
  hit.on('pointerup', () => { con.setScale(1.04); if (onClick) onClick(); });
  hit.on('pointerupoutside', () => con.setScale(1));

  con.disableButton = () => { hit.disableInteractive(); con.setAlpha(0.5); };
  con.enableButton = () => { hit.setInteractive({ useHandCursor: true }); con.setAlpha(1); con.setScale(1); };
  return con;
}

// 좌상단 뒤로가기(안전 영역 24px 안쪽)
export function makeBackButton(scene, onBack) {
  const t = scene.add.text(SP.md, SP.md, '⬅ 메뉴', {
    fontFamily: FONT, fontSize: '34px', color: css(C.subtext),
  }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
  t.on('pointerover', () => t.setColor(css(C.text)));
  t.on('pointerout', () => t.setColor(css(C.subtext)));
  t.on('pointerup', () => onBack());
  return t;
}
