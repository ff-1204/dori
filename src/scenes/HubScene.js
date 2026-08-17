// 허브 씬 — 게임 선택 포털. 정체성(결정 돕기·랜덤 뽑기·복불복)을 범주로 노출.
// 미구현 게임은 '준비 중'으로 흐리게 표시(정직한 어포던스: 누를 수 없음을 드러냄).
import { C, css, FONT, SP } from '../theme.js';
import { makeButton, padHitArea, copyText } from '../ui.js';
import { applyTimeAtmosphere, mealForPhase, MEAL_LABEL, greetingForPhase } from '../timeOfDay.js';
import { pushGameState, consumeDeepLink, pushLayerState, popLayerState } from '../nav.js';
import { Sfx } from '../sfx.js';

// 시간대별 룰렛 이모지(라벨과 함께 바뀐다)
const MEAL_EMOJI = { breakfast: '🍳', lunch: '🍚', dinner: '🍗', latenight: '🌙' };

const SITE_URL = 'https://dori.io.kr/';

const GAMES = [
  {
    cat: '결정 돕기',
    items: [
      { key: 'Roulette', name: '메뉴 룰렛', ready: true }, // 라벨·이모지는 시간대에 맞춰 동적 표기
      { key: 'Ladder', name: '🪜 사다리타기', ready: true },
      { key: 'Pinball', name: '🎯 랜덤 핀볼', ready: true },
      { key: 'Team', name: '👥 조 배정', ready: true },
    ],
  },
  {
    cat: '랜덤 뽑기',
    items: [
      { key: 'Draw', name: '🎁 뽑기 상자', ready: true },
      { key: 'Lotto', name: '🎱 로또 추첨', ready: true },
      { key: 'Bingo', name: '🔢 빙고 뽑기', ready: true },
      { key: 'BingoCard', name: '🎟️ 빙고판', ready: true },
    ],
  },
  {
    cat: '복불복',
    items: [
      { key: 'Russian', name: '💥 러시안 룰렛', ready: true },
      { key: 'Croco', name: '🐊 악어 이빨', ready: true },
      { key: 'PopUp', name: '🗡️ 해적통', ready: true },
      { key: 'Dancheong', name: '🎴 단청', ready: true },
    ],
  },
];

export default class HubScene extends Phaser.Scene {
  constructor() {
    super('Hub');
  }

  create() {
    const { width } = this.scale;
    this.leaving = false; // 씬 전환 가드 — 버튼 연타·동시 탭으로 인한 중복 start 방지
    this.btnSeq = 0; // 버튼 순차 등장 카운터(씬 재진입 시 초기화)
    // 모달·토스트 stale 참조 초기화 — 연 채 떠나면 재진입 후 가드에 걸려 다시 안 열린다
    this.qrModal = null;
    this.guideModal = null;
    this.toastBox = null;
    this.input.keyboard?.on('keydown-ESC', () => this.closeTopLayer()); // ESC(PC) = 모달 닫기
    this.cameras.main.setBackgroundColor(C.bg);
    this.cameras.main.fadeIn(160, 18, 19, 28); // 씬 전환을 부드럽게(하드 컷 방지)
    const phase = applyTimeAtmosphere(this); // 시간대 분위기(생리적 패턴)

    // 타이틀 "dori" — 그라디언트·그림자·강조선·은은한 호흡(미학-사용성 효과)
    // 크기는 104 → 70px(1/3 축소, 2026-08-17) — 상단 사이트 헤더가 생겨 브랜드가 두 번 보이므로
    // 캔버스 타이틀의 무게를 덜었다. 강조선도 같은 비율로 줄인다.
    const title = this.add.text(width / 2, 104, 'dori', {
      fontFamily: FONT, fontSize: '70px', fontStyle: 'bold', color: css(C.text),
    }).setOrigin(0.5);
    title.setLetterSpacing(6);
    title.setShadow(0, 7, '#000000', 16, false, true); // 깊이감
    // 위(밝음)→아래(강조색) 세로 그라디언트
    const grad = title.context.createLinearGradient(0, 0, 0, title.height);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, css(C.primary));
    title.setFill(grad);

    // 강조선(장식) — 타이틀 크기에 맞춰 비례 축소
    this.add.rectangle(width / 2, 152, 58, 4, C.primary).setOrigin(0.5).setAlpha(0.9);

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

    // 시간대 인사말(감성) — 10종 중 해시 선택(KST 1시간 창 회전, 모두 같은 문구), 은은히 떠오름
    const greeting = this.add.text(width / 2, 212, greetingForPhase(phase), {
      fontFamily: FONT, fontSize: '30px', color: css(C.subtext),
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: greeting, alpha: 1, y: 208, duration: 600, delay: 250, ease: 'Quad.easeOut' });

    // 범주별 게임 목록 — 2열 그리드(게임 수 확장 대응)
    // 레이아웃 검산(12개·6행): 인사말 ~223 /(여백 51)/ 목록 288–1124 /(여백 49)/ 페이지 링크 1184 / 하단 바 1236
    // 행 간격 20px·범주 간 44px
    let y = 288;
    const colW = 304;
    const leftX = SP.xl + colW / 2;
    const rightX = width - SP.xl - colW / 2;
    GAMES.forEach((group) => {
      // 범주 라벨은 보조 정보 — 게임 버튼보다 시각 위계를 낮춘다(작게 + 살짝 흐리게)
      this.add.text(SP.xl, y, group.cat, {
        fontFamily: FONT, fontSize: '28px', color: css(C.primary), fontStyle: 'bold',
      }).setOrigin(0, 0.5).setAlpha(0.65);
      y += 56;

      // 룰렛 라벨은 현재 시간대의 식사로 표기(게임 내 동작과 일치 — 정직한 매핑)
      const mealLabel = MEAL_LABEL[mealForPhase(phase.key)];

      group.items.forEach((g, idx) => {
        const displayName = g.key === 'Roulette'
          ? `${MEAL_EMOJI[mealForPhase(phase.key)]} ${mealLabel} 룰렛`
          : g.name;
        const btn = makeButton(this, {
          x: idx % 2 === 0 ? leftX : rightX,
          y: y + Math.floor(idx / 2) * 100 + 40,
          w: colW,
          h: 80,
          label: g.ready ? displayName : `${displayName} · 준비 중`,
          variant: g.ready ? 'primary' : 'disabled',
          onClick: g.ready ? () => this.startGame(g.key) : null,
          fontSize: 30,
        });
        // 순차 등장(은은한 스태거) — 목록이 정돈되어 보인다
        const finalAlpha = btn.alpha; // 준비 중(0.7) 버튼은 원래 알파로 복귀
        btn.setAlpha(0);
        this.tweens.add({ targets: btn, alpha: finalAlpha, duration: 250, delay: 120 + this.btnSeq * 40 });
        this.btnSeq = (this.btnSeq || 0) + 1;
      });
      y += Math.ceil(group.items.length / 2) * 100 + 44;
    });

    this.buildTopBar();
    this.buildBottomBar();

    // 해시 딥링크(#roulette 등)로 들어왔으면 해당 게임으로 바로 진입
    const deepLink = consumeDeepLink();
    if (deepLink) this.startGame(deepLink);
  }

  // 게임 진입(전환 가드) — 첫 탭이 전환을 잡으면 이후 탭은 무시.
  // 히스토리에 한 칸 쌓아 브라우저/OS 뒤로가기가 '허브 복귀'가 되게 한다(nav.js).
  startGame(key) {
    if (this.leaving) return;
    this.leaving = true;
    pushGameState(key);
    this.scene.start(key);
  }

  // ===== 하단 바: 효과음(좌) · 크레딧(중앙) · 바로가기(우) =====
  buildBottomBar() {
    const { width, height } = this.scale;
    const by = height - 44; // 안전 영역 안쪽

    // 효과음 토글(기본 꺼짐, localStorage 저장) — 상태가 아이콘으로 정직하게 드러남
    this.soundBtn = this.add.text(SP.md + 16, by, Sfx.isEnabled() ? '🔊' : '🔇', {
      fontSize: '32px',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.soundBtn.on('pointerup', () => {
      const next = !Sfx.isEnabled();
      Sfx.setEnabled(next);
      this.soundBtn.setText(next ? '🔊' : '🔇');
      if (next) Sfx.play('pop');
      this.toast(next ? '효과음 켜짐' : '효과음 꺼짐');
    });
    padHitArea(this.soundBtn, 88, 88); // 이모지 단독 버튼이라 세로도 넉넉히

    // 제작자 크레딧 → GitHub (자연스러운 외부 링크)
    const credit = this.add.text(width / 2, by, 'made by ff-1204  ↗', {
      fontFamily: FONT, fontSize: '26px', color: css(C.subtext),
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    credit.on('pointerover', () => credit.setColor(css(C.primary)));
    credit.on('pointerout', () => credit.setColor(css(C.subtext)));
    credit.on('pointerup', () => {
      // 인앱 브라우저·팝업 차단 환경에서는 null 반환 — 죽은 버튼 대신 정직한 피드백
      const w = window.open('https://github.com/ff-1204', '_blank');
      if (!w) this.toast('새 창이 막혔어요 — github.com/ff-1204');
    });

    // 바로가기(PWA 설치) — 지원 브라우저는 즉시 설치, 아니면 방법 안내
    const install = this.add.text(width - SP.md, by, '📲 바로가기', {
      fontFamily: FONT, fontSize: '26px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    install.on('pointerover', () => install.setColor(css(C.primary)));
    install.on('pointerout', () => install.setColor(css(C.subtext)));
    install.on('pointerup', () => this.installShortcut());
    padHitArea(install);

    // 정적 페이지 링크(소개·사용 안내·읽을거리·FAQ·개인정보처리방침)는 캔버스 밖 상단 헤더
    // (index.html `.site-top`)가 담당한다 — 캔버스 안에 같은 줄을 두면 한 화면에 같은 링크가
    // 두 번 보이고, DOM `<a>`가 크롤러·접근성 면에서도 낫다(2026-08-17 이관).
  }

  async installShortcut() {
    // 이미 앱(standalone)으로 실행 중이면 안내만 — iOS 16.4 미만은 display-mode 쿼리가 없어 navigator.standalone 병행
    if ((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      || window.navigator.standalone === true) {
      this.toast('이미 바로가기로 실행 중이에요');
      return;
    }
    // Chrome/Edge/안드로이드: 잡아둔 설치 프롬프트를 바로 띄운다.
    // prompt()는 1회용 — 거절해도 재사용 불가라 결과와 무관하게 참조를 비운다(재탭 시 안내 모달 폴백).
    const evt = window.__deferredInstall;
    if (evt) {
      window.__deferredInstall = null;
      try {
        evt.prompt();
        const choice = await evt.userChoice;
        if (!this.scene.isActive()) return; // await 사이 씬이 종료됐으면 토스트 생략
        if (choice && choice.outcome === 'accepted') this.toast('바로가기가 추가되었어요');
      } catch (e) {
        if (this.scene.isActive()) this.openInstallGuide(); // 프롬프트가 이미 소비됐거나 실패 — 방법 안내로 폴백
      }
      return;
    }
    // iOS 사파리 등 프롬프트 미지원: 방법 안내 모달
    this.openInstallGuide();
  }

  openInstallGuide() {
    if (this.guideModal) return;
    const { width, height } = this.scale;
    // iPadOS 13+ Safari는 UA를 'Macintosh'로 보고한다 — 터치 지점 수로 iPad를 함께 판정
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

    this.guideModal = this.add.container(0, 0).setDepth(200);
    pushLayerState(); // 모바일 뒤로가기 = 모달 닫기(사이트 이탈 아님)
    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.75).setOrigin(0).setInteractive();
    dim.on('pointerup', () => this.closeGuide());
    this.guideModal.add(dim);

    const pw = 560; const ph = 380;
    const px = (width - pw) / 2; const py = (height - ph) / 2;
    const panel = this.add.graphics();
    panel.fillStyle(C.surface, 1).fillRoundedRect(px, py, pw, ph, 20);
    panel.lineStyle(2, C.surfaceAlt, 1).strokeRoundedRect(px, py, pw, ph, 20);
    this.guideModal.add(panel);

    this.guideModal.add(this.add.text(width / 2, py + 56, '📲 바로가기 만들기', {
      fontFamily: FONT, fontSize: '36px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5));

    // 인앱 브라우저(카카오톡·네이버·인스타 등)는 설치 자체가 불가 — 기본 브라우저로 안내
    const isInApp = /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\//i.test(navigator.userAgent);
    const body = isInApp
      ? '앱 속 브라우저에서는 설치할 수 없어요\n메뉴(⋮ 또는 공유)에서\n\'다른 브라우저로 열기\'를 선택해 주세요'
      : isIOS
        ? 'Safari의 공유 버튼(□↑)을 누른 뒤\n\'홈 화면에 추가\'를 선택하세요'
        : '브라우저 메뉴(⋮) 또는 주소창의 설치 아이콘에서\n\'홈 화면에 추가\'/\'설치\'를 선택하세요';
    this.guideModal.add(this.add.text(width / 2, py + 170, body, {
      fontFamily: FONT, fontSize: '28px', color: css(C.subtext), align: 'center', lineSpacing: 12,
    }).setOrigin(0.5));

    const close = this.add.text(width / 2, py + ph - 56, '✕ 닫기', {
      fontFamily: FONT, fontSize: '30px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on('pointerup', () => this.closeGuide());
    this.guideModal.add(close);

    // 팝 등장(주스) — QR 모달과 같은 페이드
    this.guideModal.setAlpha(0);
    this.tweens.add({ targets: this.guideModal, alpha: 1, duration: 180, ease: 'Quad.easeOut' });
  }

  closeGuide() {
    if (!this.guideModal) return;
    this.guideModal.destroy();
    this.guideModal = null;
    popLayerState(); // 화면 버튼으로 닫으면 가드 소비(뒤로가기 경유면 이미 소비돼 no-op)
  }

  // ===== 상단 바: QR(좌) · 공유(우) — 제목(중앙)과 좌표 겹침 없음 =====
  buildTopBar() {
    const { width } = this.scale;

    const qrBtn = this.add.text(SP.md, SP.md + 6, '▦ QR', {
      fontFamily: FONT, fontSize: '30px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    qrBtn.on('pointerover', () => qrBtn.setColor(css(C.primary)));
    qrBtn.on('pointerout', () => qrBtn.setColor(css(C.subtext)));
    qrBtn.on('pointerup', () => this.openQr());
    padHitArea(qrBtn); // 터치 타깃 ≥88px(responsive §7)

    const shareBtn = this.add.text(width - SP.md, SP.md + 6, '🔗 주소 복사', {
      fontFamily: FONT, fontSize: '30px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    shareBtn.on('pointerover', () => shareBtn.setColor(css(C.primary)));
    shareBtn.on('pointerout', () => shareBtn.setColor(css(C.subtext)));
    shareBtn.on('pointerup', () => this.doShare());
    padHitArea(shareBtn);
  }

  async doShare() {
    // 주소 복사만 — 어디서나 같은 동작(정직한 피드백 토스트). 인앱 브라우저는 copyText가 폴백 처리.
    const ok = await copyText(SITE_URL);
    if (!this.scene.isActive()) return; // await 사이 씬이 종료됐으면 토스트 생략
    if (ok) this.toast('주소가 복사됐어요');
    else this.toast('복사가 막힌 브라우저예요 — 주소창에서 복사해 주세요');
  }

  // ===== QR 모달: 흰 배경(스캔 대비) + 여백(quiet zone) =====
  openQr() {
    if (this.qrModal) return;
    if (typeof window.qrcode !== 'function') { this.toast('QR 모듈을 불러오지 못했어요'); return; }

    const { width, height } = this.scale;
    this.qrModal = this.add.container(0, 0).setDepth(200);
    pushLayerState(); // 모바일 뒤로가기 = 모달 닫기(사이트 이탈 아님)

    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.75).setOrigin(0).setInteractive();
    dim.on('pointerup', () => this.closeQr());
    this.qrModal.add(dim);

    // QR 데이터 생성
    const qr = window.qrcode(0, 'M');
    qr.addData(SITE_URL);
    qr.make();
    const count = qr.getModuleCount();

    const qrSize = 420;
    const pad = 36; // quiet zone
    const panelW = qrSize + pad * 2;
    const panelH = qrSize + pad * 2 + 96;
    const px = (width - panelW) / 2;
    const py = 340;

    const panel = this.add.graphics();
    panel.fillStyle(0xffffff, 1).fillRoundedRect(px, py, panelW, panelH, 20);
    this.qrModal.add(panel);

    // 셀 수백 개짜리 Graphics는 매 프레임 커맨드를 다시 처리한다(모달 열린 내내 발열·프레임 저하) —
    // 한 번 텍스처로 구워 Image로 표시. URL이 고정이라 최초 1회만 생성해 재사용.
    const cell = qrSize / count;
    if (!this.textures.exists('qr-site')) {
      const mods = this.add.graphics();
      mods.fillStyle(0x12131c, 1);
      for (let r = 0; r < count; r += 1) {
        for (let c = 0; c < count; c += 1) {
          if (qr.isDark(r, c)) {
            mods.fillRect(c * cell, r * cell, Math.ceil(cell), Math.ceil(cell));
          }
        }
      }
      mods.generateTexture('qr-site', qrSize, qrSize);
      mods.destroy();
    }
    this.qrModal.add(this.add.image(px + pad, py + pad, 'qr-site').setOrigin(0));

    this.qrModal.add(this.add.text(width / 2, py + pad + qrSize + 48, '카메라로 스캔하면 바로 접속!', {
      fontFamily: FONT, fontSize: '28px', color: '#12131c', fontStyle: 'bold',
    }).setOrigin(0.5));

    const close = this.add.text(width / 2, py + panelH + 56, '✕ 닫기', {
      fontFamily: FONT, fontSize: '32px', color: css(C.subtext), fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on('pointerup', () => this.closeQr());
    this.qrModal.add(close);

    // 팝 등장(주스)
    this.qrModal.setAlpha(0);
    this.tweens.add({ targets: this.qrModal, alpha: 1, duration: 180, ease: 'Quad.easeOut' });
  }

  closeQr() {
    if (!this.qrModal) return;
    this.qrModal.destroy();
    this.qrModal = null;
    popLayerState(); // 화면 버튼으로 닫으면 가드 소비(뒤로가기 경유면 이미 소비돼 no-op)
  }

  // 뒤로가기·ESC의 '위 레이어부터 닫기'(nav.js popstate에서 호출). 닫았으면 true.
  closeTopLayer() {
    if (this.qrModal) { this.closeQr(); return true; }
    if (this.guideModal) { this.closeGuide(); return true; }
    return false;
  }

  // 토스트 — 알약형 카드(라운드·그림자·팔레트 토큰), 아래에서 떠오르며 등장
  toast(msg) {
    if (this.toastBox) this.toastBox.destroy();
    const t = this.add.text(0, 0, msg, {
      fontFamily: FONT, fontSize: '27px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5);
    const w = Math.ceil(t.width) + 56;
    const h = 64;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2, -h / 2 + 4, w, h, h / 2); // 그림자(깊이)
    g.fillStyle(C.surface, 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);       // 면(알약)
    g.lineStyle(2, C.primary, 0.9).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2); // 강조 테두리
    const box = this.add.container(this.scale.width / 2, 1160, [g, t]).setDepth(300).setAlpha(0);
    this.toastBox = box;
    this.tweens.add({ targets: box, alpha: 1, y: 1150, duration: 220, ease: 'Quad.easeOut' });
    this.time.delayedCall(1600, () => {
      if (this.toastBox !== box || !box.active) return; // 새 토스트가 떴으면 이 타이머는 무시
      this.tweens.add({
        targets: box, alpha: 0, y: 1156, duration: 260, ease: 'Quad.easeIn',
        onComplete: () => { if (this.toastBox === box) this.toastBox = null; box.destroy(); },
      });
    });
  }
}
