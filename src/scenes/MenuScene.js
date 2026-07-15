// 메뉴 씬: 타이틀 + 시작 버튼.
export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    const { width, height } = this.scale;

    this.add.text(width / 2, height * 0.32, 'dori', {
      fontFamily: 'sans-serif',
      fontSize: '110px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.32 + 100, '2D 퍼즐', {
      fontFamily: 'sans-serif',
      fontSize: '40px',
      color: '#8b90a8',
    }).setOrigin(0.5);

    const btn = this.add.text(width / 2, height * 0.6, '시작하기', {
      fontFamily: 'sans-serif',
      fontSize: '52px',
      color: '#12131c',
      backgroundColor: '#6cc7ff',
      padding: { x: 48, y: 20 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    // 버튼 호버/클릭 피드백
    btn.on('pointerover', () => btn.setScale(1.05));
    btn.on('pointerout', () => btn.setScale(1));
    btn.on('pointerdown', () => this.scene.start('Game'));
  }
}
