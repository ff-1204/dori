// 부트 씬: 최초 초기화 담당. 무거운 로딩 전에 필요한 최소 설정만 처리한다.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    // 정적 폴백(index.html #fallback) 제거 — Phaser가 실제로 살아 있고 곧 캔버스를 그린다는
    // 사실이 확인된 시점이다. 부팅이 실패하면 여기까지 오지 못하므로 폴백이 그대로 남는다.
    document.getElementById('fallback')?.remove();

    // 여기서 폰트, 사운드 매니저 등 전역 설정을 초기화할 수 있다.
    this.scene.start('Preload');
  }
}
