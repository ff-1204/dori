import BootScene from './scenes/BootScene.js';
import PreloadScene from './scenes/PreloadScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';

// 게임 전역 설정 (세로형 캐주얼/퍼즐 기준)
const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 720,
  height: 1280,
  backgroundColor: '#1d1f2b',
  scale: {
    mode: Phaser.Scale.FIT,          // 화면 크기에 맞춰 비율 유지하며 축소/확대
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, PreloadScene, MenuScene, GameScene],
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
