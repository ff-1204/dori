// 부트 씬: 최초 초기화 담당. 무거운 로딩 전에 필요한 최소 설정만 처리한다.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    // 여기서 폰트, 사운드 매니저 등 전역 설정을 초기화할 수 있다.
    this.scene.start('Preload');
  }
}
