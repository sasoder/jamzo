import * as Phaser from 'phaser';
import { COLORS, FONT, FONT_DISPLAY } from '../theme';
import { addText } from '../ui/text';

export class MenuScene extends Phaser.Scene {
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private credit!: Phaser.GameObjects.Text;
  private backdrop!: Phaser.GameObjects.Rectangle;
  private vignette!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('MenuScene');
  }

  create() {
    this.backdrop = this.add.rectangle(0, 0, 10, 10, COLORS.background);
    this.vignette = this.add.rectangle(0, 0, 10, 10, 0x000000, 0).setBlendMode(Phaser.BlendModes.MULTIPLY);

    this.title = addText(this, 0, 0, 'REVIVE', {
      fontFamily: FONT_DISPLAY,
      fontSize: '64px',
      color: '#facc15',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: this.title,
      y: '+=8',
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });

    this.subtitle = addText(this, 0, 0, 'type letters to keep your heroes fighting', {
      fontFamily: FONT,
      fontSize: '32px',
      color: COLORS.text,
    }).setOrigin(0.5);

    this.hint = addText(this, 0, 0, 'press SPACE to begin', {
      fontFamily: FONT,
      fontSize: '28px',
      color: COLORS.muted,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: this.hint,
      alpha: { from: 0.4, to: 1 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });

    this.credit = addText(this, 0, 0, 'ld jam 59  //  theme: revive', {
      fontFamily: FONT,
      fontSize: '20px',
      color: COLORS.muted,
    }).setOrigin(0.5);

    const start = () => this.scene.start('GameScene');
    this.input.keyboard?.once('keydown-SPACE', start);
    this.input.keyboard?.once('keydown-ENTER', start);
    this.input.once('pointerdown', start);

    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
    this.layout();
  }

  private layout() {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const titleSize = Math.round(Phaser.Math.Clamp(width * 0.07, 32, 80));

    this.backdrop.setPosition(cx, cy).setSize(width, height);
    this.vignette.setPosition(cx, cy).setSize(width, height);

    this.title.setPosition(cx, cy - 110).setFontSize(titleSize);
    this.subtitle.setPosition(cx, cy - 20);
    this.hint.setPosition(cx, cy + 60);
    this.credit.setPosition(cx, height - 30);
  }
}
