// 프리로드 씬: 에셋 로딩 + 로딩 바 표시(체감 성능). 로딩이 끝나면 허브로 전환.
import { C } from '../theme.js';

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    const { width, height } = this.scale;

    // 로딩 바 UI(지각된 성능: 빈 화면 방지)
    this.add.rectangle(width / 2, height / 2, 400, 24, C.surfaceAlt).setStrokeStyle(2, C.subtext);
    const bar = this.add.rectangle(width / 2 - 196, height / 2, 0, 16, C.primary).setOrigin(0, 0.5);
    this.load.on('progress', (p) => { bar.width = 392 * p; });

    // 실제 에셋이 생기면 여기서 로드
    // this.load.image('logo', 'assets/logo.png');
    // this.load.audio('spin', 'assets/spin.mp3');
  }

  create() {
    this.scene.start('Hub');
  }
}
