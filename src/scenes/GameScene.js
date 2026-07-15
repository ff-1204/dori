// 게임 씬: 퍼즐 게임의 뼈대.
// 지금은 "타일을 탭하면 점수가 오르고 새 색으로 바뀌는" 최소 데모.
// 이 구조 위에 매치-3 등 실제 퍼즐 로직을 얹으면 된다.
export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    const { width } = this.scale;

    // 게임 상태
    this.score = 0;
    this.cols = 5;
    this.rows = 6;
    this.tileSize = 96;
    this.gap = 12;

    // HUD: 점수 + 메뉴 버튼
    this.scoreText = this.add.text(28, 28, '점수: 0', {
      fontFamily: 'sans-serif',
      fontSize: '44px',
      color: '#ffffff',
    });

    const back = this.add.text(width - 28, 28, '⬅ 메뉴', {
      fontFamily: 'sans-serif',
      fontSize: '36px',
      color: '#8b90a8',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('Menu'));

    this.createBoard();
  }

  // 격자 형태로 타일 배치
  createBoard() {
    const boardW = this.cols * this.tileSize + (this.cols - 1) * this.gap;
    const startX = (this.scale.width - boardW) / 2 + this.tileSize / 2;
    const startY = 240;

    for (let r = 0; r < this.rows; r += 1) {
      for (let c = 0; c < this.cols; c += 1) {
        const x = startX + c * (this.tileSize + this.gap);
        const y = startY + r * (this.tileSize + this.gap);
        this.spawnTile(x, y);
      }
    }
  }

  // 무작위 색 타일 하나 생성
  spawnTile(x, y) {
    const idx = Phaser.Math.Between(0, 4);
    const tile = this.add.image(x, y, `tile${idx}`)
      .setInteractive({ useHandCursor: true });
    tile.colorIndex = idx;
    tile.on('pointerdown', () => this.popTile(tile));
    return tile;
  }

  // 타일 탭 처리: 점수 +10, 팝 애니메이션 후 새 색으로 리스폰
  popTile(tile) {
    this.score += 10;
    this.scoreText.setText(`점수: ${this.score}`);

    this.tweens.add({
      targets: tile,
      scale: 0,
      angle: 180,
      duration: 150,
      ease: 'Back.easeIn',
      onComplete: () => {
        const next = Phaser.Math.Between(0, 4);
        tile.setTexture(`tile${next}`);
        tile.colorIndex = next;
        tile.setAngle(0);
        tile.setScale(0);
        this.tweens.add({
          targets: tile,
          scale: 1,
          duration: 150,
          ease: 'Back.easeOut',
        });
      },
    });
  }
}
