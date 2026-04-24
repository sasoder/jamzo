import * as Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  backgroundColor: '#101014',
  fps: {
    target: 60,
    limit: 60,
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    parent: 'game',
    width: '100%',
    height: '100%',
  },
  scene: [MenuScene, GameScene],
};

new Phaser.Game(config);
