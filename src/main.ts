import * as Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  backgroundColor: '#0f0e1a',
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

async function start() {
  try {
    await Promise.all([
      document.fonts.load('16px "Press Start 2P"'),
      document.fonts.load('16px "VT323"'),
      document.fonts.load('32px "VT323"'),
    ]);
  } catch {
    // continue with fallbacks if loading fails
  }
  new Phaser.Game(config);
}

start();
