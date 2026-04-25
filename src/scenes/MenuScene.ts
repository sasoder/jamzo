import * as Phaser from 'phaser';
import { COLORS, FONT } from '../theme';
import { makeButton, type Button } from '../ui/button';
import { addText } from '../ui/text';

export class MenuScene extends Phaser.Scene {
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private startButton!: Button;
  private backdrop!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('MenuScene');
  }

  create() {
    this.backdrop = this.add.rectangle(0, 0, 10, 10, COLORS.background);
    this.title = addText(this, 0, 0, 'NECROMANCER', {
      fontFamily: FONT,
      fontSize: '72px',
      color: COLORS.text,
      fontStyle: '800',
    }).setOrigin(0.5);

    this.subtitle = addText(this, 0, 0, 'type the letter to revive', {
      fontFamily: FONT,
      fontSize: '20px',
      color: COLORS.muted,
    }).setOrigin(0.5);

    this.startButton = makeButton(this, 0, 0, 'Start', () => this.scene.start('GameScene'));
    this.input.keyboard?.once('keydown-SPACE', () => this.scene.start('GameScene'));
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('GameScene'));

    this.scale.on('resize', this.layout, this);
    this.layout();
  }

  shutdown() {
    this.scale.off('resize', this.layout, this);
  }

  private layout() {
    const { width, height } = this.scale;
    const centerX = width / 2;
    const centerY = height / 2;
    const titleSize = Math.round(Phaser.Math.Clamp(width * 0.078, 36, 72));

    this.backdrop.setPosition(centerX, centerY).setSize(width, height);
    this.title.setPosition(centerX, centerY - 104).setFontSize(titleSize);
    this.subtitle.setPosition(centerX, centerY - 32);
    this.startButton.setPosition(centerX, centerY + 64);
    this.startButton.setSize(Math.min(240, width - 48), 64);
  }
}
