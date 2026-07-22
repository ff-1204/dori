// 공통 UI 컴포넌트 — 어포던스(눌러 보임)·정직한 피드백 원칙 적용.
import { C, css, FONT, RADIUS, SP, LAYOUT } from './theme.js';
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

// 공통 헤더 — 제목(40px, y48) + 태그라인(24px, y128). 모든 잼잼 씬의 첫 블록(LAYOUT 그리드).
export function makeHeader(scene, title, tagline) {
  const cx = scene.scale.width / 2;
  const titleText = scene.add.text(cx, LAYOUT.headerY, title, {
    fontFamily: FONT, fontSize: '40px', color: css(C.text), fontStyle: 'bold',
  }).setOrigin(0.5);
  const taglineText = scene.add.text(cx, LAYOUT.taglineY, tagline, {
    fontFamily: FONT, fontSize: '24px', color: css(C.subtext),
  }).setOrigin(0.5);
  return { titleText, taglineText };
}

// 판 아래 보조 링크(26px, y1002 행) — hover 색·터치 타깃(≥88px)까지 한 문법.
// 라벨을 setText로 바꾸면 padHitArea를 다시 불러 히트 영역을 재계산할 것.
export function makeSubLink(scene, x, y, label, onTap, hoverColor = C.primary) {
  const t = scene.add.text(x, y, label, {
    fontFamily: FONT, fontSize: '26px', color: css(C.subtext), fontStyle: 'bold',
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  t.on('pointerover', () => t.setColor(css(hoverColor)));
  t.on('pointerout', () => t.setColor(css(C.subtext)));
  t.on('pointerup', onTap);
  padHitArea(t);
  return t;
}

// 편집 모달 스캐폴드 — 딤·패널·제목(38px)·안내(22px)·완료 버튼·페이드 160ms를 한 문법으로.
// 반환된 chips(startX·startY·maxX)는 chipFlow의 기준 좌표로 쓴다.
export function makeModal(scene, { title, note, py = 180, ph = 900, doneLabel = '완료', onDone }) {
  const { width, height } = scene.scale;
  const px = 40;
  const pw = width - px * 2;
  const root = scene.add.container(0, 0).setDepth(100);
  const dim = scene.add.rectangle(0, 0, width, height, 0x000000, 0.72).setOrigin(0).setInteractive();
  root.add(dim);
  const panel = scene.add.graphics();
  panel.fillStyle(C.surface, 1).fillRoundedRect(px, py, pw, ph, RADIUS);
  panel.lineStyle(2, C.surfaceAlt, 1).strokeRoundedRect(px, py, pw, ph, RADIUS);
  root.add(panel);
  const titleText = scene.add.text(width / 2, py + 48, title, {
    fontFamily: FONT, fontSize: '38px', color: css(C.text), fontStyle: 'bold',
  }).setOrigin(0.5);
  root.add(titleText);
  let noteText = null;
  if (note) {
    noteText = scene.add.text(width / 2, py + 94, note, {
      fontFamily: FONT, fontSize: '22px', color: css(C.subtext),
    }).setOrigin(0.5);
    root.add(noteText);
  }
  const chipsBox = scene.add.container(0, 0);
  root.add(chipsBox);
  const doneBtn = makeButton(scene, {
    x: width / 2, y: py + ph - 64, w: 280, h: 84, label: doneLabel, variant: 'primary', onClick: onDone,
  });
  root.add(doneBtn);
  root.setAlpha(0);
  scene.tweens.add({ targets: root, alpha: 1, duration: 160, ease: 'Quad.easeOut' });
  return {
    root, titleText, noteText, chipsBox, doneBtn, px, py, pw, ph,
    chips: { startX: px + 32, startY: py + 150, maxX: px + pw - 32 },
  };
}

// 칩 플로우 — 편집 모달의 항목 칩 공통 문법(높이 64·폰트 26·간격 12, 줄바꿈 자동).
// add(label, opts, onTap) → 칩 컨테이너(chipW 보관). onTap이 없으면 히트 없이 반환(씬이 직접 붙임).
// opts: { fill, outline, color(외곽선), textColor } / add.section(라벨) = 구분 제목 행 / add.gapRow(추가여백) = 줄 띄움.
export function chipFlow(scene, box, { startX, startY, maxX, gap = 12, chipH = 64 }) {
  let x = startX;
  let y = startY;
  const add = (label, opts = {}, onTap) => {
    const t = scene.add.text(0, 0, label, {
      fontFamily: FONT, fontSize: '26px',
      color: css(opts.textColor ?? (opts.outline ? (opts.color ?? C.primary) : C.text)),
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const w = Math.ceil(t.width) + 40;
    if (x + w > maxX) { x = startX; y += chipH + gap; }
    const g = scene.add.graphics();
    const fill = opts.fill ?? (opts.outline ? null : C.surfaceAlt);
    if (fill != null) g.fillStyle(fill, 1).fillRoundedRect(0, 0, w, chipH, 14);
    if (opts.outline) g.lineStyle(2, opts.color ?? C.primary, 1).strokeRoundedRect(0, 0, w, chipH, 14);
    t.setPosition(w / 2, chipH / 2);
    const con = scene.add.container(x, y, [g, t]);
    con.chipW = w;
    con.chipH = chipH;
    if (onTap) {
      const hit = scene.add.rectangle(w / 2, chipH / 2, w, chipH, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerup', onTap);
      con.add(hit);
    }
    box.add(con);
    x += w + gap;
    return con;
  };
  add.section = (label) => {
    x = startX;
    const t = scene.add.text(startX, y, label, {
      fontFamily: FONT, fontSize: '26px', color: css(C.primary), fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    box.add(t);
    y += 52;
  };
  add.gapRow = (extra = 0) => { x = startX; y += chipH + gap + extra; };
  return add;
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
