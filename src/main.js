import BootScene from './scenes/BootScene.js';
import PreloadScene from './scenes/PreloadScene.js';
import HubScene from './scenes/HubScene.js';
import RouletteScene from './scenes/RouletteScene.js';
import { enforceHostLock } from './guard.js';

// 도메인 잠금: 허용 호스트가 아니면 게임을 시작하지 않는다(무단 재호스팅 억제).
if (enforceHostLock()) {
  // 게임 전역 설정 (세로형, docs/responsive-design.md 기준)
  const config = {
    type: Phaser.AUTO,
    parent: 'game',
    width: 720,
    height: 1280,
    backgroundColor: '#12131c',
    scale: {
      mode: Phaser.Scale.FIT,          // 비율 유지하며 화면에 맞춤
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, PreloadScene, HubScene, RouletteScene],
  };

  // eslint-disable-next-line no-new
  new Phaser.Game(config);
}
