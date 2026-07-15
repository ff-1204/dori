// 프리로드 씬: 에셋 로딩 + 로딩 바 표시. 아직 실제 이미지 에셋은 없어
// 타일 텍스처를 코드로 생성해 둔다(에셋 파일이 생기면 preload에서 load하면 됨).
export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    const { width, height } = this.scale;

    // 로딩 바 UI
    this.add.rectangle(width / 2, height / 2, 400, 24, 0x333849)
      .setStrokeStyle(2, 0x555b70);
    const bar = this.add.rectangle(width / 2 - 196, height / 2, 0, 16, 0x6cc7ff)
      .setOrigin(0, 0.5);

    this.load.on('progress', (p) => {
      bar.width = 392 * p;
    });

    // 실제 에셋 로드 예시 (에셋 추가되면 주석 해제)
    // this.load.image('logo', 'assets/logo.png');
    // this.load.audio('pop', 'assets/pop.mp3');
  }

  create() {
    this.createTileTextures();
    this.scene.start('Menu');
  }

  // 5가지 색상의 둥근 사각형 타일 텍스처를 코드로 생성
  createTileTextures() {
    const colors = [0xff6b6b, 0xffd166, 0x06d6a0, 0x4d96ff, 0xc77dff];
    colors.forEach((c, i) => {
      const g = this.add.graphics();
      g.fillStyle(c, 1).fillRoundedRect(0, 0, 96, 96, 16);
      g.generateTexture(`tile${i}`, 96, 96);
      g.destroy();
    });
  }
}
