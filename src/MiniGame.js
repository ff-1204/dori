// 미니게임 공통 베이스 — docs/game-theory.md §7 FSM(입력 잠금·시드 RNG)과
// docs/design-principles.md(정직한 난수·뒤로가기 일관성)를 구현한다.
// 하위 게임은 create() 대신 onCreate()를 구현한다.
import { C } from './theme.js';
import { makeBackButton } from './ui.js';
import { applyTimeAtmosphere } from './timeOfDay.js';
import { goBackToHub } from './nav.js';

export default class MiniGame extends Phaser.Scene {
  constructor(key) {
    super(key);
  }

  create() {
    this.locked = false;
    this.leaving = false; // 씬 전환 가드 — 연타로 scene.start가 중복 큐잉되면 씬이 겹치거나 크래시
    this.navBack = false; // ⬅ 버튼 연타 가드(nav.js)
    // 매 진입 자동 시드 → 정직하게 매번 다른 결과(재현이 필요하면 시드를 주입)
    this.rng = new Phaser.Math.RandomDataGenerator();
    this.cameras.main.setBackgroundColor(C.bg);
    this.cameras.main.fadeIn(160, 18, 19, 28); // 씬 전환을 부드럽게(하드 컷 방지)
    this.timePhase = applyTimeAtmosphere(this); // 시간대 분위기(생리적 패턴)
    // 뒤로가기: 히스토리를 경유해 브라우저/OS 뒤로가기와 동일 경로로 허브 복귀
    makeBackButton(this, () => goBackToHub(this));
    this.onCreate();
  }

  onCreate() {} // 하위 게임에서 구현

  lock() { this.locked = true; }
  unlock() { this.locked = false; }

  // ===== 공통 연출 헬퍼(주스·색상 연결) =====

  // 색상 연결 플래시: 결과 출처 요소의 색으로 화면 플래시
  colorFlash(color, duration = 170) {
    this.cameras.main.flash(duration, (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff);
  }

  // 파티클 폭발(도파민): 출처 색으로 터뜨린다
  burst(x, y, color, count = 26) {
    const em = this.add.particles(x, y, 'spark', {
      speed: { min: 140, max: 420 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.9, end: 0 },
      lifespan: { min: 350, max: 750 },
      gravityY: 700,
      tint: color,
      emitting: false,
    }).setDepth(50);
    em.explode(count);
    this.time.delayedCall(900, () => em.destroy());
  }

  shake(intensity = 0.008, duration = 180) {
    this.cameras.main.shake(duration, intensity);
  }
}
