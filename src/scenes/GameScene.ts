import * as Phaser from 'phaser';
import { COLORS, FONT } from '../theme';
import { addText } from '../ui/text';

type PlayState = 'intro' | 'rescue';
type HeroKind = 'knight' | 'wizard';
type HeroPhase = 'running' | 'falling' | 'carried' | 'lift';

type Hero = {
  kind: HeroKind;
  phase: HeroPhase;
  gfx: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
};

type UpgradeButton = {
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  refresh: () => void;
  setPosition: (x: number, y: number, width: number) => void;
};

const UI_DEPTH = 30;

export class GameScene extends Phaser.Scene {
  private state: PlayState = 'intro';
  private world!: Phaser.GameObjects.Graphics;
  private catcher!: Phaser.GameObjects.Graphics;
  private lift!: Phaser.GameObjects.Graphics;
  private introHero?: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private stats!: Phaser.GameObjects.Text;
  private liftText!: Phaser.GameObjects.Text;
  private modeText!: Phaser.GameObjects.Text;

  private keyA?: Phaser.Input.Keyboard.Key;
  private keyD?: Phaser.Input.Keyboard.Key;
  private keyLeft?: Phaser.Input.Keyboard.Key;
  private keyRight?: Phaser.Input.Keyboard.Key;
  private keySpace?: Phaser.Input.Keyboard.Key;

  private heroes: Hero[] = [];
  private carried: Hero[] = [];
  private liftQueue: Hero[] = [];
  private upgradeButtons: UpgradeButton[] = [];

  private gold = 0;
  private revived = 0;
  private missed = 0;
  private spawnTimer = 0;
  private liftProgress = 0;

  private introX = 92;
  private introY = 0;
  private introVy = 0;
  private introFalling = false;

  private catcherX = 0;
  private catcherY = 0;
  private pointerTargetX = 0;
  private netRadius = 32;
  private carryCapacity = 1;
  private liftCapacity = 2;
  private liftSpeed = 1;

  private platformY = 0;
  private underworldY = 0;
  private pitStart = 0;
  private pitEnd = 0;
  private liftX = 0;

  constructor() {
    super('GameScene');
  }

  create() {
    this.resetRun();

    this.world = this.add.graphics();
    this.catcher = this.add.graphics().setDepth(8);
    this.lift = this.add.graphics().setDepth(7);

    this.title = addText(this, 24, 20, 'Respawn Department', {
      fontFamily: FONT,
      fontSize: '22px',
      color: COLORS.text,
      fontStyle: '800',
    }).setDepth(UI_DEPTH);

    this.status = addText(this, 24, 48, 'A promising hero enters the level.', {
      fontFamily: FONT,
      fontSize: '15px',
      color: '#c7d2fe',
    }).setDepth(UI_DEPTH);

    this.stats = addText(this, 24, 78, '', {
      fontFamily: FONT,
      fontSize: '17px',
      color: COLORS.text,
      fontStyle: '700',
    }).setDepth(UI_DEPTH);

    this.modeText = addText(this, 0, 0, 'Reach the flag. It is definitely a normal platformer.', {
      fontFamily: FONT,
      fontSize: '16px',
      color: '#f8fafc',
      align: 'center',
      wordWrap: { width: 440 },
    })
      .setOrigin(0.5)
      .setDepth(UI_DEPTH);

    this.liftText = addText(this, 0, 0, '', {
      fontFamily: FONT,
      fontSize: '14px',
      color: '#0f172a',
      fontStyle: '800',
      align: 'center',
    })
      .setOrigin(0.5)
      .setDepth(9);

    this.createUpgradeButtons();

    this.keyA = this.input.keyboard?.addKey('A');
    this.keyD = this.input.keyboard?.addKey('D');
    this.keyLeft = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyRight = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keySpace = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerdown', this.handlePointerMove, this);
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', this.shutdown, this);

    this.introHero = this.drawHero('knight', 0, 0).setDepth(6);
    this.layout();
    this.updateStats();
  }

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.04);

    if (this.state === 'intro') {
      this.updateIntro(dt);
      return;
    }

    this.updateCatcher(dt);
    this.updateSpawner(deltaMs);
    this.updateHeroes(dt);
    this.updateLift(dt);
    this.drawCatcher();
    this.drawLift();
  }

  shutdown() {
    this.input.off('pointermove', this.handlePointerMove, this);
    this.input.off('pointerdown', this.handlePointerMove, this);
    this.scale.off('resize', this.layout, this);
  }

  private resetRun() {
    this.state = 'intro';
    this.heroes = [];
    this.carried = [];
    this.liftQueue = [];
    this.upgradeButtons = [];
    this.gold = 0;
    this.revived = 0;
    this.missed = 0;
    this.spawnTimer = 0;
    this.liftProgress = 0;
    this.netRadius = 32;
    this.carryCapacity = 1;
    this.liftCapacity = 2;
    this.liftSpeed = 1;
    this.introX = 92;
    this.introVy = 0;
    this.introFalling = false;
  }

  private createUpgradeButtons() {
    this.upgradeButtons.push(
      this.makeUpgradeButton(() => `Net radius +10  $${this.netCost()}`, () => this.gold >= this.netCost(), () => {
        this.gold -= this.netCost();
        this.netRadius += 10;
      }),
      this.makeUpgradeButton(
        () => `Carry capacity +1  $${this.carryCost()}`,
        () => this.gold >= this.carryCost(),
        () => {
          this.gold -= this.carryCost();
          this.carryCapacity += 1;
        },
      ),
      this.makeUpgradeButton(
        () => `Lift capacity +1  $${this.liftCost()}`,
        () => this.gold >= this.liftCost(),
        () => {
          this.gold -= this.liftCost();
          this.liftCapacity += 1;
        },
      ),
      this.makeUpgradeButton(
        () => `Revive motor +25%  $${this.motorCost()}`,
        () => this.gold >= this.motorCost(),
        () => {
          this.gold -= this.motorCost();
          this.liftSpeed += 0.25;
        },
      ),
    );
  }

  private makeUpgradeButton(labelText: () => string, canBuy: () => boolean, onBuy: () => void): UpgradeButton {
    const bg = this.add
      .rectangle(0, 0, 220, 38, 0x24313a, 0.94)
      .setStrokeStyle(2, 0x5eead4, 0.3)
      .setInteractive({ useHandCursor: true })
      .setDepth(UI_DEPTH);

    const label = addText(this, 0, 0, '', {
      fontFamily: FONT,
      fontSize: '14px',
      color: COLORS.text,
      fontStyle: '800',
    })
      .setOrigin(0.5)
      .setDepth(UI_DEPTH + 1);

    const refresh = () => {
      const afford = canBuy();
      label.setText(labelText());
      label.setColor(afford ? COLORS.text : '#94a3b8');
      bg.setFillStyle(afford ? 0x24423f : 0x202833, 0.94);
      bg.setStrokeStyle(2, afford ? 0x5eead4 : 0x475569, afford ? 0.7 : 0.35);
    };

    bg.on('pointerover', () => {
      if (canBuy()) bg.setFillStyle(0x2c5a52, 0.98);
    });
    bg.on('pointerout', refresh);
    bg.on('pointerdown', () => {
      if (!canBuy()) return;
      onBuy();
      this.updateStats();
      this.drawCatcher();
      this.drawLift();
      this.tweens.add({ targets: [bg, label], scale: 0.96, duration: 60, yoyo: true });
    });

    return {
      bg,
      label,
      refresh,
      setPosition(x: number, y: number, width: number) {
        bg.setPosition(x, y).setSize(width, 38).setDisplaySize(width, 38);
        label.setPosition(x, y);
        label.setFontSize(Math.round(Phaser.Math.Clamp(width * 0.064, 11, 14)));
      },
    };
  }

  private updateIntro(dt: number) {
    const movingRight = this.keyD?.isDown || this.keyRight?.isDown;
    const movingLeft = this.keyA?.isDown || this.keyLeft?.isDown;
    const speed = 185;

    if (!this.introFalling) {
      if (movingRight) this.introX += speed * dt;
      if (movingLeft) this.introX -= speed * dt;
      if (this.keySpace && Phaser.Input.Keyboard.JustDown(this.keySpace)) {
        this.introVy = -420;
      }

      const overPit = this.introX > this.pitStart && this.introX < this.pitEnd;
      const closeToFlag = this.introX > this.scale.width - 150;
      if (overPit || closeToFlag || this.introVy !== 0) {
        this.introY += this.introVy * dt;
        this.introVy += 980 * dt;
      }

      if (!overPit && !closeToFlag && this.introY >= this.platformY - 20) {
        this.introY = this.platformY - 20;
        this.introVy = 0;
      }

      if (overPit && this.introY > this.platformY + 10) {
        this.introFalling = true;
        this.status.setText('The first hero has encountered gravity.');
      }
    } else {
      this.introY += this.introVy * dt;
      this.introVy += 1040 * dt;
    }

    this.introX = Phaser.Math.Clamp(this.introX, 46, this.scale.width - 44);
    this.introHero?.setPosition(this.introX, this.introY);

    if (this.introY > this.underworldY + 30) {
      this.startRescueLoop(this.introX, this.introY, this.introVy);
    }
  }

  private startRescueLoop(x: number, y: number, vy: number) {
    this.state = 'rescue';
    this.modeText.setText('CATCH FALLING HEROES. FEED THE LIFT.');
    this.status.setText('The real job begins below the level.');
    this.introHero?.destroy();
    this.introHero = undefined;
    this.spawnTimer = 450;
    this.createHero('knight', x, y, 'falling', vy);
    this.updateStats();
  }

  private updateCatcher(dt: number) {
    const keyboardDir =
      (this.keyD?.isDown || this.keyRight?.isDown ? 1 : 0) - (this.keyA?.isDown || this.keyLeft?.isDown ? 1 : 0);
    const speed = 430;

    if (keyboardDir !== 0) {
      this.catcherX += keyboardDir * speed * dt;
      this.pointerTargetX = this.catcherX;
    } else {
      this.catcherX = Phaser.Math.Linear(this.catcherX, this.pointerTargetX, 1 - Math.pow(0.0007, dt));
    }

    this.catcherX = Phaser.Math.Clamp(this.catcherX, 42, this.scale.width - 42);
    this.depositCarriedHeroes();
    this.positionCarriedHeroes();
  }

  private updateSpawner(deltaMs: number) {
    this.spawnTimer -= deltaMs;
    if (this.spawnTimer > 0) return;

    const nextDelay = Phaser.Math.Clamp(1350 - this.revived * 12, 520, 1350);
    this.spawnTimer = nextDelay;
    const kind: HeroKind = Math.random() < 0.58 ? 'knight' : 'wizard';
    this.createHero(kind, -32, this.platformY - 20, 'running', 0);
  }

  private updateHeroes(dt: number) {
    for (const hero of this.heroes) {
      if (hero.phase === 'running') {
        hero.x += hero.vx * dt;
        hero.y = this.platformY - 20 + Math.sin(hero.x * 0.055) * 2;
        if (hero.x > this.pitStart + 12) {
          hero.phase = 'falling';
          hero.vy = hero.kind === 'knight' ? 110 : 20;
        }
      }

      if (hero.phase === 'falling') {
        const gravity = hero.kind === 'knight' ? 760 : 245;
        const maxFall = hero.kind === 'knight' ? 520 : 165;
        hero.vy = Math.min(maxFall, hero.vy + gravity * dt);
        hero.y += hero.vy * dt;

        const distance = Phaser.Math.Distance.Between(hero.x, hero.y, this.catcherX, this.catcherY - 18);
        if (distance < this.netRadius && this.carried.length < this.carryCapacity) {
          hero.phase = 'carried';
          hero.vy = 0;
          this.carried.push(hero);
          this.tweens.add({ targets: hero.gfx, scale: 1.18, duration: 70, yoyo: true });
          this.updateStats();
        } else if (hero.y > this.scale.height + 42) {
          this.missed += 1;
          this.destroyHero(hero);
          this.updateStats();
          continue;
        }
      }

      if (hero.phase !== 'carried') {
        hero.gfx.setPosition(hero.x, hero.y);
      }
    }
  }

  private updateLift(dt: number) {
    if (this.liftQueue.length === 0) {
      this.liftProgress = 0;
      this.drawLift();
      return;
    }

    this.liftProgress += (dt * this.liftSpeed) / 1.65;
    if (this.liftProgress >= 1) {
      const payout = this.liftQueue.reduce((total, hero) => total + hero.value, 0);
      this.gold += payout;
      this.revived += this.liftQueue.length;
      for (const hero of this.liftQueue) this.destroyHero(hero);
      this.liftQueue = [];
      this.liftProgress = 0;
      this.status.setText(`Lift sent them back up. +$${payout}`);
      this.updateStats();
    }

    this.positionLiftHeroes();
    this.drawLift();
  }

  private depositCarriedHeroes() {
    if (Math.abs(this.catcherX - this.liftX) > 72) return;
    while (this.carried.length > 0 && this.liftQueue.length < this.liftCapacity) {
      const hero = this.carried.shift();
      if (!hero) return;
      hero.phase = 'lift';
      this.liftQueue.push(hero);
      this.tweens.add({ targets: hero.gfx, scale: 0.92, duration: 90, yoyo: true });
    }
    this.positionCarriedHeroes();
    this.positionLiftHeroes();
    this.updateStats();
  }

  private positionCarriedHeroes() {
    this.carried.forEach((hero, index) => {
      const rowOffset = (index - (this.carried.length - 1) / 2) * 22;
      hero.x = this.catcherX + rowOffset;
      hero.y = this.catcherY - 38 - Math.floor(index / 3) * 18;
      hero.gfx.setPosition(hero.x, hero.y);
    });
  }

  private positionLiftHeroes() {
    this.liftQueue.forEach((hero, index) => {
      const xOffset = (index % 3) * 22 - Math.min(this.liftQueue.length - 1, 2) * 11;
      const yOffset = Math.floor(index / 3) * 19;
      hero.x = this.liftX + xOffset;
      hero.y = this.catcherY - 82 + yOffset - this.liftProgress * 44;
      hero.gfx.setPosition(hero.x, hero.y);
    });
  }

  private createHero(kind: HeroKind, x: number, y: number, phase: HeroPhase, vy: number): Hero {
    const hero: Hero = {
      kind,
      phase,
      gfx: this.drawHero(kind, x, y).setDepth(6),
      x,
      y,
      vx: kind === 'knight' ? 94 : 116,
      vy,
      value: 3,
    };
    this.heroes.push(hero);
    return hero;
  }

  private destroyHero(hero: Hero) {
    hero.gfx.destroy();
    this.heroes = this.heroes.filter((candidate) => candidate !== hero);
    this.carried = this.carried.filter((candidate) => candidate !== hero);
    this.liftQueue = this.liftQueue.filter((candidate) => candidate !== hero);
  }

  private drawHero(kind: HeroKind, x: number, y: number) {
    const gfx = this.add.graphics({ x, y });
    const body = kind === 'knight' ? 0x93c5fd : 0xc084fc;
    const trim = kind === 'knight' ? 0xe2e8f0 : 0xfde68a;

    gfx.lineStyle(2, 0x111827, 1);
    if (kind === 'wizard') {
      gfx.fillStyle(trim, 1);
      gfx.fillTriangle(-10, -24, 0, -43, 10, -24);
      gfx.strokeTriangle(-10, -24, 0, -43, 10, -24);
    }
    gfx.fillStyle(0xf9c7a5, 1);
    gfx.fillCircle(0, -20, 7);
    gfx.strokeCircle(0, -20, 7);
    gfx.fillStyle(body, 1);
    gfx.fillRoundedRect(-8, -13, 16, 22, 4);
    gfx.strokeRoundedRect(-8, -13, 16, 22, 4);
    gfx.lineStyle(3, trim, 1);
    gfx.lineBetween(-8, -3, 8, -3);
    if (kind === 'knight') {
      gfx.fillStyle(0xb7c4d8, 1);
      gfx.fillRoundedRect(-15, -8, 7, 15, 2);
      gfx.lineStyle(2, 0x111827, 1);
      gfx.strokeRoundedRect(-15, -8, 7, 15, 2);
    } else {
      gfx.fillStyle(0xfde68a, 1);
      gfx.fillCircle(9, -19, 2.5);
    }
    return gfx;
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer) {
    this.pointerTargetX = pointer.x;
    if (this.state === 'intro' && pointer.isDown) {
      this.introX = pointer.x;
    }
  }

  private updateStats() {
    this.stats.setText(
      `Gold $${this.gold}   Revived ${this.revived}   Lost ${this.missed}   Carry ${this.carried.length}/${this.carryCapacity}`,
    );
    this.liftText.setText(`${this.liftQueue.length}/${this.liftCapacity}`);
    for (const button of this.upgradeButtons) button.refresh();
  }

  private layout() {
    const { width, height } = this.scale;
    this.platformY = Math.round(Phaser.Math.Clamp(height * 0.26, 112, 178));
    this.underworldY = this.platformY + 48;
    this.pitStart = Math.round(width * 0.43);
    this.pitEnd = this.pitStart + Math.round(Phaser.Math.Clamp(width * 0.17, 92, 164));
    this.catcherY = height - 82;
    this.liftX = width - Math.round(Phaser.Math.Clamp(width * 0.14, 84, 132));
    this.catcherX = this.catcherX || width * 0.5;
    this.pointerTargetX = this.pointerTargetX || this.catcherX;
    this.introY = this.introY || this.platformY - 20;

    this.drawWorld();
    this.drawCatcher();
    this.drawLift();

    this.modeText.setPosition(width / 2, this.platformY - 74);
    this.modeText.setWordWrapWidth(Math.min(460, width - 48));
    this.liftText.setPosition(this.liftX, this.catcherY - 118);

    const sidePanelWidth = Math.round(Phaser.Math.Clamp(width * 0.28, 184, 250));
    const buttonX = Math.max(116, width - sidePanelWidth / 2 - 18);
    const startY = Math.min(height - 208, this.underworldY + 48);
    this.upgradeButtons.forEach((button, index) => {
      button.setPosition(buttonX, startY + index * 46, sidePanelWidth);
    });

    this.title.setPosition(24, 18);
    this.status.setPosition(24, 47);
    this.stats.setPosition(24, 76);
    this.introHero?.setPosition(this.introX, this.introY);
  }

  private drawWorld() {
    const { width, height } = this.scale;
    this.world.clear();

    this.world.fillGradientStyle(0x172554, 0x1e3a8a, 0x334155, 0x14532d, 1, 1, 1, 1);
    this.world.fillRect(0, 0, width, this.underworldY);

    this.world.fillStyle(0x15151b, 1);
    this.world.fillRect(0, this.underworldY, width, height - this.underworldY);

    this.world.fillStyle(0x365314, 1);
    this.world.fillRect(0, this.platformY, this.pitStart, 24);
    this.world.fillRect(this.pitEnd, this.platformY, width - this.pitEnd, 24);
    this.world.fillStyle(0x84cc16, 1);
    this.world.fillRect(0, this.platformY, this.pitStart, 5);
    this.world.fillRect(this.pitEnd, this.platformY, width - this.pitEnd, 5);

    this.world.fillStyle(0x0f172a, 1);
    this.world.fillRect(this.pitStart, this.platformY - 3, this.pitEnd - this.pitStart, 31);

    this.world.fillStyle(0xfacc15, 1);
    this.world.fillRect(width - 76, this.platformY - 60, 5, 60);
    this.world.fillTriangle(width - 71, this.platformY - 60, width - 31, this.platformY - 46, width - 71, this.platformY - 32);

    this.world.lineStyle(4, 0x475569, 1);
    this.world.lineBetween(0, this.underworldY, width, this.underworldY);
    this.world.lineStyle(1, 0x334155, 0.55);
    for (let x = 32; x < width; x += 58) {
      this.world.lineBetween(x, this.underworldY, x - 38, height);
    }

    this.world.fillStyle(0x1f2937, 1);
    this.world.fillRect(this.liftX - 48, this.catcherY - 150, 96, 156);
    this.world.fillStyle(0x111827, 1);
    this.world.fillRect(this.liftX - 34, this.catcherY - 138, 68, 110);
    this.world.fillStyle(0x94a3b8, 1);
    this.world.fillRect(this.liftX - 54, this.catcherY - 156, 108, 10);
    this.world.fillRect(this.liftX - 54, this.catcherY - 20, 108, 10);
  }

  private drawCatcher() {
    this.catcher.clear();
    this.catcher.setPosition(this.catcherX, this.catcherY);

    this.catcher.lineStyle(2, 0x7dd3fc, 0.55);
    this.catcher.strokeCircle(0, -18, this.netRadius);
    this.catcher.fillStyle(0x38bdf8, 0.16);
    this.catcher.fillCircle(0, -18, this.netRadius);
    this.catcher.lineStyle(4, 0xeab308, 1);
    this.catcher.lineBetween(-30, 4, -14, -16);
    this.catcher.lineBetween(30, 4, 14, -16);
    this.catcher.lineStyle(5, 0xfacc15, 1);
    this.catcher.strokeRoundedRect(-34, -21, 68, 22, 8);
    this.catcher.fillStyle(0x1f2937, 1);
    this.catcher.fillRoundedRect(-24, 2, 48, 16, 5);
  }

  private drawLift() {
    this.lift.clear();
    this.lift.setPosition(this.liftX, this.catcherY - 83);

    const progressHeight = Math.round(88 * this.liftProgress);
    this.lift.fillStyle(0xd97706, 1);
    this.lift.fillRoundedRect(-42, -46, 84, 92, 7);
    this.lift.fillStyle(0xfef3c7, 1);
    this.lift.fillRoundedRect(-32, -36, 64, 72, 5);
    this.lift.fillStyle(0x22c55e, 0.78);
    this.lift.fillRect(-32, 36 - progressHeight, 64, progressHeight);
    this.lift.lineStyle(4, 0x451a03, 1);
    this.lift.strokeRoundedRect(-42, -46, 84, 92, 7);
    this.liftText.setText(`${this.liftQueue.length}/${this.liftCapacity}`);
  }

  private netCost() {
    return Math.round(10 + (this.netRadius - 32) * 1.8);
  }

  private carryCost() {
    return 14 + (this.carryCapacity - 1) * 18;
  }

  private liftCost() {
    return 16 + (this.liftCapacity - 2) * 20;
  }

  private motorCost() {
    return Math.round(14 + (this.liftSpeed - 1) * 72);
  }
}
