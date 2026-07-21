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
  // 상단 광택(입체감) — 위쪽 절반에 옅은 흰 하이라이트
  g.fillStyle(0xffffff, 0.12).fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h / 2 - 4, {
    tl: RADIUS - 3, tr: RADIUS - 3, bl: 0, br: 0,
  });
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

// 작은 텍스트 링크의 터치 타깃 확장 — 표시 크기는 그대로 두고 히트 영역만 키운다(responsive §7: ≥88px 설계 단위).
// 라벨을 setText로 바꾸는 버튼은 바꾼 뒤 다시 호출할 것(폭 기준으로 재계산).
export function padHitArea(t, minW = 88, minH = 56) {
  if (!t.input) return;
  const w = Math.max(t.width + 24, minW);
  const h = Math.max(t.height + 24, minH);
  t.input.hitArea.setTo((t.width - w) / 2, (t.height - h) / 2, w, h);
}

// 한 줄 입력 오버레이 — window.prompt 대체(테마 일치·Enter 확정·inputmode로 모바일 자판 선택).
// 씬당 1개(scene.inputOverlay)만 유지. 씬 전환 시 DOM은 Phaser가 함께 파괴하므로
// 재진입하는 씬은 onCreate에서 scene.inputOverlay = null 로 stale 참조를 초기화할 것.
export function openTextInput(scene, { title, hint, inputmode = 'text', maxLength = 12, y = 560, onSubmit }) {
  if (scene.inputOverlay) return;
  const cx = scene.scale.width / 2;
  scene.inputOverlay = scene.add.dom(cx, y).createFromHTML(
    `<div style="width:520px;background:${css(C.surface)};border:2px solid ${css(C.surfaceAlt)};border-radius:16px;padding:20px;font-family:sans-serif;">`
    + `<div style="color:${css(C.text)};font-size:24px;font-weight:bold;text-align:center;margin-bottom:12px;">${title}</div>`
    + (hint ? `<div style="color:${css(C.subtext)};font-size:18px;text-align:center;margin-bottom:10px;">${hint}</div>` : '')
    + `<input id="dori-input" type="text" inputmode="${inputmode}" maxlength="${maxLength}" autocomplete="off" `
    + `style="width:100%;box-sizing:border-box;font-size:24px;padding:12px;text-align:center;`
    + `border-radius:12px;border:2px solid ${css(C.surfaceAlt)};background:${css(C.bg)};color:${css(C.text)};outline:none;"/>`
    + '<div style="display:flex;gap:12px;margin-top:14px;">'
    + `<button id="dori-input-ok" style="flex:1;padding:14px;font-size:22px;font-weight:bold;border:none;border-radius:12px;background:${css(C.primary)};color:${css(C.bg)};">확인</button>`
    + `<button id="dori-input-cancel" style="flex:1;padding:14px;font-size:22px;border:none;border-radius:12px;background:${css(C.surfaceAlt)};color:${css(C.text)};">취소</button>`
    + '</div></div>',
  ).setDepth(300);
  const node = scene.inputOverlay.node;
  const field = node.querySelector('#dori-input');
  const submit = () => {
    const v = field.value;
    closeTextInput(scene);
    onSubmit(v);
  };
  node.querySelector('#dori-input-ok').addEventListener('click', submit);
  node.querySelector('#dori-input-cancel').addEventListener('click', () => closeTextInput(scene));
  field.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') closeTextInput(scene);
  });
  field.focus();
}

export function closeTextInput(scene) {
  if (scene.inputOverlay) { scene.inputOverlay.destroy(); scene.inputOverlay = null; }
}

// 좌상단 뒤로가기(안전 영역 24px 안쪽) — 아이콘만(⬅). 글자는 작아도
// 히트 영역은 88×88(설계 단위)로 확장해 터치 타깃 규칙을 지킨다(responsive §7).
export function makeBackButton(scene, onBack) {
  const t = scene.add.text(SP.md, SP.md, '⬅', {
    fontFamily: FONT, fontSize: '40px', color: css(C.subtext),
  }).setOrigin(0, 0);
  t.setInteractive({
    hitArea: new Phaser.Geom.Rectangle(-22, -16, 88, 88),
    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    useHandCursor: true,
  });
  t.on('pointerover', () => t.setColor(css(C.text)));
  t.on('pointerout', () => t.setColor(css(C.subtext)));
  t.on('pointerup', () => onBack());
  return t;
}
