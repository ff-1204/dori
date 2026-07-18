// 단청(丹靑) — 양자택일 오라클(복불복). 丹(붉을 단)·靑(푸를 청): 질문하면 붉 또는 청으로 답한다.
// 핵심: 결정적 해시 = FNV-1a("단청" + 정규화(질문) + 4시간창번호) % 2.
// 순수 함수라 서버·저장소 없이 어떤 기기/브라우저에서 열어도 같은 질문이면 같은 답이고,
// 답은 4시간(KST 00/04/08/12/16/20시 정각 경계)에 1번만 바뀔 수 있다 — 리롤 불가(번복 없음).
// 표현: 수정구가 아니라 붉/청 두 색패(色牌) — 하이라이트가 둘 사이를 오가다 한쪽에 멈춘다.
// 정직성: 두 선택지가 항상 화면에 보이고, "동일 답" 규칙을 안내 문구로 공개. 입력은 클라이언트에서만 처리.
import MiniGame from '../MiniGame.js';
import { C, css, FONT, EASE } from '../theme.js';
import { makeButton } from '../ui.js';
import { Sfx } from '../sfx.js';

const RED = C.danger;   // 붉
const BLUE = C.primary; // 청

// 마지막 질문 기억 — 기기 내 localStorage에만 저장(전송 없음), 재진입 시 입력창에 미리 채움
const LS_QUESTION = 'dori.dancheong.question';

const WINDOW_MS = 4 * 60 * 60 * 1000;
const KST_OFFSET = 9 * 60 * 60 * 1000;

// FNV-1a 32bit — 퍼블릭 도메인 알고리즘을 스펙에서 직접 구현(서드파티 없음)
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// 같은 질문이 같은 답을 받도록 정규화(공백·유니코드·대소문자)
function normalize(s) {
  return s.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function windowIndex(now = Date.now()) {
  return Math.floor((now + KST_OFFSET) / WINDOW_MS);
}

// 0 = 붉, 1 = 청
function pickColor(text, now = Date.now()) {
  return fnv1a(`단청|${normalize(text)}|${windowIndex(now)}`) % 2;
}

export default class DancheongScene extends MiniGame {
  constructor() {
    super('Dancheong');
  }

  onCreate() {
    const { width } = this.scale;
    this.cx = width / 2;

    this.add.text(this.cx, 140, '단청', {
      fontFamily: FONT, fontSize: '48px', color: css(C.text), fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(this.cx, 196, '묻고, 색으로 답을 받으세요', {
      fontFamily: FONT, fontSize: '26px', color: css(C.subtext),
    }).setOrigin(0.5);

    // 질문 입력창(HTML 오버레이 — 한글 IME 대응)
    this.inputEl = this.add.dom(this.cx, 290).createFromHTML(
      '<input type="text" maxlength="24" enterkeyhint="go" placeholder="무엇이 궁금한가요?" '
      + 'style="width:480px;padding:18px 24px;font-size:28px;border-radius:16px;'
      + 'border:2px solid #2a2f42;background:#1d1f2b;color:#f2f3f7;outline:none;'
      + 'text-align:center;font-family:sans-serif;">',
    );
    this.inputNode = this.inputEl.node.querySelector('input');
    // 마지막 질문 복원(기기 내 저장분)
    try {
      const saved = localStorage.getItem(LS_QUESTION);
      if (saved && this.inputNode) this.inputNode.value = saved;
    } catch (e) { /* 무시 */ }
    // 모바일 자판 제어 — Phaser가 캔버스 터치에 preventDefault를 걸어 기본 blur가 막히므로 직접 처리:
    // 입력창 밖(캔버스) 탭이면 자판을 내리고, Enter(모바일 '완료/이동')는 바로 묻기로 잇는다
    if (this.inputNode) {
      this.inputNode.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); this.ask(); }
      });
      this.input.on('pointerdown', () => this.inputNode.blur());
    }

    this.buildTiles();

    this.resultText = this.add.text(this.cx, 890, '', {
      fontFamily: FONT, fontSize: '38px', color: css(C.subtext), fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);

    // 규칙 공개(정직성): 동일 답 안내
    this.noteText = this.add.text(this.cx, 990, '같은 질문은 어디서 물어도 4시간 동안 같은 답이에요', {
      fontFamily: FONT, fontSize: '24px', color: css(C.subtext),
    }).setOrigin(0.5);

    this.askBtn = makeButton(this, {
      x: this.cx, y: 1100, w: 380, h: 100, label: '단청에 묻기', variant: 'primary',
      onClick: () => this.ask(),
    });
  }

  // 붉/청 두 색패 — 두 선택지가 항상 나란히 보인다(정직)
  buildTiles() {
    const size = 220;
    const y = 590;
    this.tiles = [
      this.makeTile(this.cx - 130, y, size, RED, '붉'),
      this.makeTile(this.cx + 130, y, size, BLUE, '청'),
    ];
  }

  makeTile(x, y, size, color, glyph) {
    const con = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25).fillRoundedRect(-size / 2 + 4, -size / 2 + 10, size, size, 24); // 그림자
    g.fillStyle(color, 1).fillRoundedRect(-size / 2, -size / 2, size, size, 24);
    // 내부 프레임 + 모서리 점(단청 문양 힌트 — 색패다운 마감)
    g.lineStyle(3, C.bg, 0.28).strokeRoundedRect(-size / 2 + 12, -size / 2 + 12, size - 24, size - 24, 16);
    g.fillStyle(C.bg, 0.28);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
      g.fillCircle(sx * (size / 2 - 26), sy * (size / 2 - 26), 4);
    });
    con.add(g);
    con.add(this.add.text(0, 0, glyph, {
      fontFamily: FONT, fontSize: '96px', color: css(C.bg), fontStyle: 'bold',
    }).setOrigin(0.5));
    con.color = color;
    con.glyph = glyph;
    return con;
  }

  // 두 패를 대기 상태로(동등한 강조)
  resetTiles() {
    this.tiles.forEach((t) => {
      this.tweens.killTweensOf(t);
      t.setAlpha(1).setScale(1);
    });
  }

  getQuestion() {
    return this.inputNode ? this.inputNode.value : '';
  }

  ask() {
    if (this.locked) return;
    const q = this.getQuestion();
    if (!normalize(q)) {
      this.resultText.setColor(css(C.warning)).setText('질문을 입력해 주세요').setScale(1);
      return;
    }
    this.lock();
    if (this.inputNode) this.inputNode.blur(); // 자판 내리기 — 답 공개 연출이 전체 화면에서 보이게
    try { localStorage.setItem(LS_QUESTION, q.trim()); } catch (e) { /* 무시 */ }
    this.askBtn.disableButton();
    this.resultText.setColor(css(C.subtext)).setText('...').setScale(1);
    this.resetTiles(); // 이전 결과는 여기서 해제(버튼 누를 때까지 유지)
    Sfx.play('pop');

    // 빌드업: 하이라이트가 두 패 사이를 튕기다 점점 느려진다(기대 → 긴장)
    const steps = [130, 130, 130, 130, 170, 170, 210, 260, 320];
    this.bounceStep(q, 0, steps);
  }

  bounceStep(q, i, steps) {
    if (i >= steps.length) { this.reveal(q); return; }
    const on = this.tiles[i % 2];
    const off = this.tiles[(i + 1) % 2];
    on.setAlpha(1).setScale(1.07);
    off.setAlpha(0.4).setScale(0.94);
    Sfx.play('tick');
    this.time.delayedCall(steps[i], () => this.bounceStep(q, i + 1, steps));
  }

  reveal(q) {
    const isRed = pickColor(q) === 0;
    const chosen = this.tiles[isRed ? 0 : 1];
    const other = this.tiles[isRed ? 1 : 0];
    const color = chosen.color;
    const name = chosen.glyph;

    // 선택 확정: 답 패는 크게, 나머지는 물러난다(결과는 다음 질문 전까지 유지)
    other.setAlpha(0.22).setScale(0.9);
    chosen.setAlpha(1).setScale(0.95);
    this.tweens.add({ targets: chosen, scale: 1.12, duration: 340, ease: EASE.bounce });

    this.burst(chosen.x, chosen.y, color, 34);
    this.colorFlash(color, 200);
    this.shake(0.005, 150);
    Sfx.play(isRed ? 'bang' : 'win');

    const shown = q.trim().length > 12 ? `${q.trim().slice(0, 12)}…` : q.trim();
    this.resultText.setColor(css(color));
    this.resultText.setText(`"${shown}"\n답은 ${name} !`);
    this.resultText.setScale(0);
    this.tweens.add({ targets: this.resultText, scale: 1, duration: 320, ease: EASE.bounce });

    this.askBtn.enableButton();
    this.askBtn.setLabel('다시 묻기');
    this.unlock();
  }
}
