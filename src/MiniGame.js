// 미니게임 공통 베이스 — docs/game-theory.md §7 FSM(입력 잠금·시드 RNG)과
// docs/design-principles.md(정직한 난수·뒤로가기 일관성)를 구현한다.
// 하위 게임은 create() 대신 onCreate()를 구현한다.
import { C } from './theme.js';
import { makeBackButton } from './ui.js';
import { applyTimeAtmosphere } from './timeOfDay.js';

export default class MiniGame extends Phaser.Scene {
  constructor(key) {
    super(key);
  }

  create() {
    this.locked = false;
    // 매 진입 자동 시드 → 정직하게 매번 다른 결과(재현이 필요하면 시드를 주입)
    this.rng = new Phaser.Math.RandomDataGenerator();
    this.cameras.main.setBackgroundColor(C.bg);
    this.timePhase = applyTimeAtmosphere(this); // 시간대 분위기(생리적 패턴)
    makeBackButton(this, () => this.scene.start('Hub'));
    this.onCreate();
  }

  onCreate() {} // 하위 게임에서 구현

  lock() { this.locked = true; }
  unlock() { this.locked = false; }
}
