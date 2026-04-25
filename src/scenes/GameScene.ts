import * as Phaser from 'phaser';
import { COLORS, FONT } from '../theme';
import { addText } from '../ui/text';

type FallerKind = 'hero' | 'tank';

type Faller = {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  letterTexts: Phaser.GameObjects.Text[];
  letters: string;
  typedCount: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: FallerKind;
  baseValue: number;
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const COMBO_WINDOW_MS = 1500;
const GRAVITY = 95;
const HERO_BASE_VALUE = 10;
const TANK_BASE_VALUE = 25;
const STARTING_LIVES = 3;
const PARTICLE_KEY = 'p_particle';

export class GameScene extends Phaser.Scene {
  private fallers: Faller[] = [];
  private score = 0;
  private lives = STARTING_LIVES;
  private combo = 0;
  private highCombo = 0;
  private comboTimer = 0;
  private spawnTimer = 800;
  private waveCooldown = 16000;
  private waveActive = false;
  private waveTimeLeft = 0;
  private elapsed = 0;
  private over = false;

  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private overText!: Phaser.GameObjects.Text;
  private restartHint!: Phaser.GameObjects.Text;

  private fx!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super('GameScene');
  }

  create() {
    this.makeParticleTexture();

    this.fx = this.add
      .particles(0, 0, PARTICLE_KEY, {
        speed: { min: 90, max: 280 },
        lifespan: { min: 350, max: 750 },
        scale: { start: 1.4, end: 0 },
        alpha: { start: 1, end: 0 },
        gravityY: 220,
        emitting: false,
        blendMode: 'ADD',
      })
      .setDepth(20);

    this.scoreText = addText(this, 24, 20, '', {
      fontFamily: FONT,
      fontSize: '24px',
      color: COLORS.text,
      fontStyle: '800',
    }).setDepth(30);

    this.livesText = addText(this, 0, 20, '', {
      fontFamily: FONT,
      fontSize: '24px',
      color: '#fca5a5',
      fontStyle: '800',
    })
      .setOrigin(1, 0)
      .setDepth(30);

    this.comboText = addText(this, 0, 0, '', {
      fontFamily: FONT,
      fontSize: '40px',
      color: '#fde047',
      fontStyle: '900',
      align: 'center',
    })
      .setOrigin(0.5)
      .setDepth(30);

    this.waveText = addText(this, 0, 0, '', {
      fontFamily: FONT,
      fontSize: '44px',
      color: '#f472b6',
      fontStyle: '900',
      align: 'center',
    })
      .setOrigin(0.5)
      .setDepth(30);

    this.overText = addText(this, 0, 0, '', {
      fontFamily: FONT,
      fontSize: '64px',
      color: '#f87171',
      fontStyle: '900',
      align: 'center',
    })
      .setOrigin(0.5)
      .setDepth(30)
      .setVisible(false);

    this.restartHint = addText(this, 0, 0, '', {
      fontFamily: FONT,
      fontSize: '20px',
      color: COLORS.muted,
      align: 'center',
    })
      .setOrigin(0.5)
      .setDepth(30)
      .setVisible(false);

    this.input.keyboard?.on('keydown', this.handleKey, this);
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', this.cleanup, this);

    this.layout();
    this.refreshHud();
  }

  update(_time: number, deltaMs: number) {
    if (this.over) return;
    const dt = Math.min(deltaMs / 1000, 0.04);
    this.elapsed += deltaMs;

    this.spawnTimer -= deltaMs;
    if (this.spawnTimer <= 0) {
      this.spawn();
      const base = Math.max(420, 1100 - this.score * 0.5);
      this.spawnTimer = this.waveActive ? base / 2.6 : base;
    }

    if (this.waveActive) {
      this.waveTimeLeft -= deltaMs;
      if (this.waveTimeLeft <= 0) {
        this.waveActive = false;
        this.waveText.setText('');
      }
    } else {
      this.waveCooldown -= deltaMs;
      if (this.waveCooldown <= 0) this.startWave();
    }

    if (this.combo > 0) {
      this.comboTimer -= deltaMs;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.refreshHud();
      }
    }

    const w = this.scale.width;
    for (const f of this.fallers) {
      f.vy += GRAVITY * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.x < 30) {
        f.x = 30;
        f.vx = Math.abs(f.vx);
      } else if (f.x > w - 30) {
        f.x = w - 30;
        f.vx = -Math.abs(f.vx);
      }
      f.container.setPosition(f.x, f.y);
    }

    for (const f of [...this.fallers]) {
      if (f.y > this.scale.height + 40) this.loseLife(f);
    }
  }

  private cleanup() {
    this.input.keyboard?.off('keydown', this.handleKey, this);
    this.scale.off('resize', this.layout, this);
  }

  private makeParticleTexture() {
    if (this.textures.exists(PARTICLE_KEY)) return;
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture(PARTICLE_KEY, 8, 8);
    g.destroy();
  }

  private startWave() {
    this.waveActive = true;
    this.waveTimeLeft = 4500;
    this.waveCooldown = 18000 + Math.random() * 8000;
    this.waveText.setText('!! WAVE !!');
    this.tweens.add({
      targets: this.waveText,
      scale: { from: 0.6, to: 1.15 },
      duration: 220,
      yoyo: true,
      repeat: 2,
      ease: 'back.out',
    });
  }

  private spawn() {
    const isTank = Math.random() < 0.22;
    const kind: FallerKind = isTank ? 'tank' : 'hero';
    const letterCount = isTank ? 2 : 1;
    let letters = '';
    while (letters.length < letterCount) {
      const c = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
      if (!letters.includes(c)) letters += c;
    }
    const size = isTank ? 64 : 44;
    const color = isTank ? 0x6b21a8 : 0x1e3a8a;
    const stroke = isTank ? 0xc4b5fd : 0x93c5fd;
    const x = Phaser.Math.Between(60, this.scale.width - 60);
    const y = -size;
    const vx = Phaser.Math.Between(-50, 50);
    const vy = Phaser.Math.Between(20, 70);

    const bg = this.add.rectangle(0, 0, size, size, color, 1).setStrokeStyle(3, stroke);

    const letterTexts: Phaser.GameObjects.Text[] = [];
    if (isTank) {
      letterTexts.push(this.makeLetter(letters[0], -16));
      letterTexts.push(this.makeLetter(letters[1], 16));
    } else {
      letterTexts.push(this.makeLetter(letters[0], 0));
    }

    const container = this.add.container(x, y, [bg, ...letterTexts]).setDepth(10);

    this.fallers.push({
      container,
      bg,
      letterTexts,
      letters,
      typedCount: 0,
      x,
      y,
      vx,
      vy,
      kind,
      baseValue: isTank ? TANK_BASE_VALUE : HERO_BASE_VALUE,
    });
  }

  private makeLetter(ch: string, offsetX: number) {
    return addText(this, offsetX, 0, ch, {
      fontFamily: FONT,
      fontSize: '28px',
      color: '#f8fafc',
      fontStyle: '900',
    }).setOrigin(0.5);
  }

  private handleKey = (event: KeyboardEvent) => {
    if (this.over) {
      if (event.key === ' ' || event.key === 'Enter') this.scene.restart();
      return;
    }
    const key = event.key.toUpperCase();
    if (!/^[A-Z]$/.test(key)) return;

    let target: Faller | undefined;
    let lowestY = -Infinity;
    for (const f of this.fallers) {
      const next = f.letters[f.typedCount];
      if (next === key && f.y > lowestY) {
        lowestY = f.y;
        target = f;
      }
    }
    if (!target) return;

    const idx = target.typedCount;
    target.letterTexts[idx].setColor('#22c55e');
    target.typedCount = idx + 1;
    this.tweens.add({
      targets: target.letterTexts[idx],
      scale: { from: 1.6, to: 1 },
      duration: 160,
      ease: 'back.out',
    });

    if (target.typedCount >= target.letters.length) this.revive(target);
  };

  private revive(f: Faller) {
    const multiplier = Math.max(1, this.combo);
    const points = f.baseValue * multiplier;
    this.score += points;
    this.combo += 1;
    this.comboTimer = COMBO_WINDOW_MS;
    if (this.combo > this.highCombo) this.highCombo = this.combo;

    this.fx.setParticleTint(this.comboColor());
    this.fx.explode(20 + this.combo * 2, f.x, f.y);

    const popup = addText(this, f.x, f.y, `+${points}`, {
      fontFamily: FONT,
      fontSize: '26px',
      color: multiplier > 1 ? '#fde047' : '#a7f3d0',
      fontStyle: '900',
    })
      .setOrigin(0.5)
      .setDepth(25);
    this.tweens.add({
      targets: popup,
      y: f.y - 70,
      alpha: 0,
      duration: 750,
      ease: 'cubic.out',
      onComplete: () => popup.destroy(),
    });

    if (this.combo >= 3) this.cameras.main.flash(80, 253, 224, 71, false);

    f.container.destroy();
    this.fallers = this.fallers.filter((x) => x !== f);
    this.refreshHud();
  }

  private comboColor(): number {
    if (this.combo >= 10) return 0xf472b6;
    if (this.combo >= 5) return 0xfde047;
    if (this.combo >= 3) return 0x60a5fa;
    return 0xa7f3d0;
  }

  private loseLife(f: Faller) {
    this.lives -= 1;
    this.combo = 0;
    this.fx.setParticleTint(0xef4444);
    this.fx.explode(18, f.x, this.scale.height - 20);
    this.cameras.main.shake(200, 0.014);
    f.container.destroy();
    this.fallers = this.fallers.filter((x) => x !== f);
    this.refreshHud();
    if (this.lives <= 0) this.endGame();
  }

  private endGame() {
    this.over = true;
    this.overText.setText('GAME OVER').setVisible(true);
    this.restartHint
      .setText(`Score ${this.score}    Best Combo x${this.highCombo}\nPress SPACE to restart`)
      .setVisible(true);
    for (const f of this.fallers) f.container.destroy();
    this.fallers = [];
    this.comboText.setText('');
  }

  private refreshHud() {
    this.scoreText.setText(`Score ${this.score}`);
    this.livesText.setText(`Lives ${Math.max(0, this.lives)}`);
    this.comboText.setText(this.combo > 1 ? `x${this.combo} COMBO` : '');
  }

  private layout() {
    const { width, height } = this.scale;
    this.scoreText.setPosition(24, 20);
    this.livesText.setPosition(width - 24, 20);
    this.comboText.setPosition(width / 2, 64);
    this.waveText.setPosition(width / 2, 130);
    this.overText.setPosition(width / 2, height / 2 - 40);
    this.restartHint.setPosition(width / 2, height / 2 + 40);
  }
}
