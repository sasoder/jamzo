import * as Phaser from 'phaser';
import { COLORS, FONT, FONT_DISPLAY } from '../theme';
import { addText } from '../ui/text';

type HeroType = 'knight' | 'tank' | 'mage' | 'necromancer' | 'bard';
type HeroState = 'fighting' | 'falling' | 'dead';

type Hero = {
  type: HeroType;
  slotIndex: number;
  state: HeroState;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  letterTexts: Phaser.GameObjects.Text[];
  letters: string;
  typedCount: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
  cursedUntil: number;
  autoReviveAt: number;
};

type BossId = 'warden' | 'twinhex' | 'tyrant';
type Phase = 'intro' | 'fighting' | 'cleared' | 'upgrade' | 'endurance_intro' | 'endurance' | 'gameover';
type UpgradeId =
  | 'revival_potion'
  | 'twin_bolt'
  | 'reanimator'
  | 'crescendo'
  | 'power_chord'
  | 'encore';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const PARTICLE_KEY = 'p_particle';

const ROSTER: HeroType[] = ['knight', 'tank', 'mage', 'knight', 'necromancer', 'bard'];

const HERO_CONFIG: Record<
  HeroType,
  {
    color: number;
    stroke: number;
    size: number;
    letters: number;
    fallVy: number;
    score: number;
    label: string;
  }
> = {
  knight:      { color: 0x2563eb, stroke: 0x93c5fd, size: 46, letters: 1, fallVy: 30, score: 10, label: 'KNIGHT' },
  tank:        { color: 0x7c3aed, stroke: 0xc4b5fd, size: 62, letters: 2, fallVy: 50, score: 25, label: 'TANK' },
  mage:        { color: 0x059669, stroke: 0x6ee7b7, size: 46, letters: 1, fallVy: 25, score: 20, label: 'MAGE' },
  necromancer: { color: 0xb91c1c, stroke: 0xfca5a5, size: 52, letters: 2, fallVy: 30, score: 35, label: 'NECRO' },
  bard:        { color: 0xd97706, stroke: 0xfde047, size: 46, letters: 1, fallVy: 35, score: 15, label: 'BARD' },
};

const BOSS_ORDER: BossId[] = ['warden', 'twinhex', 'tyrant'];

const BOSS_CONFIG: Record<
  BossId,
  {
    name: string;
    subtitle: string;
    hp: number;
    attackMin: number; // interval at low HP (frenzy)
    attackMax: number; // interval at full HP
    pattern: 'single' | 'double';
    cursedRevive: boolean;
    color: number;
    stroke: number;
    width: number;
    height: number;
  }
> = {
  warden:  { name: 'THE WARDEN',  subtitle: 'BOSS I',         hp: 200, attackMin: 1500, attackMax: 2900, pattern: 'single', cursedRevive: false, color: 0xb91c1c, stroke: 0xfca5a5, width: 110, height: 60 },
  twinhex: { name: 'THE TWIN HEX', subtitle: 'BOSS II',        hp: 320, attackMin: 2200, attackMax: 3600, pattern: 'double', cursedRevive: false, color: 0xc2410c, stroke: 0xfdba74, width: 140, height: 70 },
  tyrant:  { name: 'THE TYRANT',   subtitle: 'BOSS III // FINAL', hp: 450, attackMin: 1100, attackMax: 2200, pattern: 'single', cursedRevive: true, color: 0x6d28d9, stroke: 0xc4b5fd, width: 160, height: 84 },
};

const UPGRADE_INFO: Record<UpgradeId, { name: string; desc: string; color: string }> = {
  revival_potion: { name: 'REVIVAL POTION', desc: 'KNIGHTS auto-revive after 1.5s of falling', color: '#93c5fd' },
  twin_bolt:      { name: 'TWIN BOLT',      desc: 'MAGE casts 2 bolts (12 dmg each)',         color: '#6ee7b7' },
  reanimator:     { name: 'REANIMATOR',     desc: 'NECRO revives ALL dead heroes',            color: '#fca5a5' },
  crescendo:      { name: 'CRESCENDO',      desc: '+25% party DPS per combo level',           color: '#fde047' },
  power_chord:    { name: 'POWER CHORD',    desc: 'BARD revive deals 30 dmg to the boss',     color: '#fbbf24' },
  encore:         { name: 'ENCORE',         desc: 'Combo window +0.6s',                       color: '#f9a8d4' },
};

const ALL_UPGRADES: UpgradeId[] = Object.keys(UPGRADE_INFO) as UpgradeId[];

const GRAVITY = 95;
const HERO_DPS_BASE = 2;
const COMBO_WINDOW_BASE = 1200;
const ENCORE_BONUS = 600;
const KNIGHT_AUTOREVIVE_MS = 1500;
const MAGE_BASE_DAMAGE = 20;
const TWIN_BOLT_DAMAGE = 12;
const POWER_CHORD_DAMAGE = 30;
const TYRANT_CURSE_MS = 4000;
const FLOOR_FRACTION = 0.26;

export class GameScene extends Phaser.Scene {
  private heroes: Hero[] = [];
  private bossIndex = 0;
  private bossHp = 0;
  private bossMaxHp = 0;
  private bossId: BossId = 'warden';
  private bossAttackTimer = 0;
  private comboCount = 0;
  private comboTimer = 0;
  private highCombo = 0;
  private score = 0;
  private elapsed = 0;
  private phase: Phase = 'intro';
  private upgrades = new Set<UpgradeId>();
  private enduranceElapsed = 0;
  private enduranceWaveTimer = 0;

  // hud
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private bossNameText!: Phaser.GameObjects.Text;
  private upgradesHud!: Phaser.GameObjects.Text;
  private enduranceLabel!: Phaser.GameObjects.Text;

  // overlays
  private introBig!: Phaser.GameObjects.Text;
  private introSmall!: Phaser.GameObjects.Text;
  private overText!: Phaser.GameObjects.Text;
  private restartHint!: Phaser.GameObjects.Text;

  // boss visuals
  private bossShape!: Phaser.GameObjects.Rectangle;
  private bossGlow!: Phaser.GameObjects.Rectangle;
  private bossHpBar!: Phaser.GameObjects.Rectangle;
  private bossHpBarBg!: Phaser.GameObjects.Rectangle;
  private bossHpBarTarget = 1;

  // floor
  private floorLine!: Phaser.GameObjects.Rectangle;
  private floorGlow!: Phaser.GameObjects.Rectangle;

  // upgrade ui
  private upgradeOverlay?: Phaser.GameObjects.Rectangle;
  private upgradeTitle?: Phaser.GameObjects.Text;
  private upgradeCards: Array<{
    bg: Phaser.GameObjects.Rectangle;
    nameText: Phaser.GameObjects.Text;
    descText: Phaser.GameObjects.Text;
    indexText: Phaser.GameObjects.Text;
    id: UpgradeId;
  }> = [];

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

    // boss
    this.bossGlow = this.add.rectangle(0, 0, 130, 80, 0xffffff, 0).setDepth(4);
    this.bossShape = this.add.rectangle(0, 0, 110, 60, 0xb91c1c).setStrokeStyle(3, 0xfca5a5).setDepth(5);
    this.bossHpBarBg = this.add.rectangle(0, 0, 540, 16, 0x1a1828).setStrokeStyle(2, 0x4a4665).setOrigin(0.5).setDepth(5);
    this.bossHpBar = this.add.rectangle(0, 0, 540, 16, 0xef4444).setOrigin(0, 0.5).setDepth(6);
    this.bossNameText = addText(this, 0, 0, '', {
      fontFamily: FONT,
      fontSize: '24px',
      color: '#f8f5e6',
    }).setOrigin(0.5).setDepth(6);

    // floor
    this.floorGlow = this.add.rectangle(0, 0, 100, 40, 0xfacc15, 0.04).setOrigin(0, 0.5).setDepth(1);
    this.floorLine = this.add.rectangle(0, 0, 100, 2, 0x4a4665, 1).setOrigin(0, 0.5).setDepth(2);

    // hud
    this.scoreText = addText(this, 24, 16, '', {
      fontFamily: FONT,
      fontSize: '32px',
      color: COLORS.text,
    }).setDepth(30);

    this.comboText = addText(this, 0, 0, '', {
      fontFamily: FONT_DISPLAY,
      fontSize: '28px',
      color: '#fde047',
      align: 'center',
    }).setOrigin(0.5).setDepth(30);

    this.upgradesHud = addText(this, 24, 0, '', {
      fontFamily: FONT,
      fontSize: '20px',
      color: COLORS.muted,
    }).setDepth(30);

    this.enduranceLabel = addText(this, 0, 0, '', {
      fontFamily: FONT,
      fontSize: '24px',
      color: '#fde047',
      align: 'center',
    }).setOrigin(0.5).setDepth(30);

    // intro overlay
    this.introBig = addText(this, 0, 0, '', {
      fontFamily: FONT_DISPLAY,
      fontSize: '40px',
      color: '#facc15',
      align: 'center',
    }).setOrigin(0.5).setDepth(40).setVisible(false);

    this.introSmall = addText(this, 0, 0, '', {
      fontFamily: FONT,
      fontSize: '28px',
      color: COLORS.text,
      align: 'center',
    }).setOrigin(0.5).setDepth(40).setVisible(false);

    this.overText = addText(this, 0, 0, '', {
      fontFamily: FONT_DISPLAY,
      fontSize: '40px',
      color: '#f87171',
      align: 'center',
    }).setOrigin(0.5).setDepth(40).setVisible(false);

    this.restartHint = addText(this, 0, 0, '', {
      fontFamily: FONT,
      fontSize: '24px',
      color: COLORS.muted,
      align: 'center',
    }).setOrigin(0.5).setDepth(40).setVisible(false);

    this.spawnRoster();

    this.input.keyboard?.on('keydown', this.handleKey, this);
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', this.cleanup, this);

    this.layout();
    this.refreshHud();
    this.startBoss(0);
  }

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.04);
    this.elapsed += deltaMs;

    // smooth boss hp bar
    const currentScale = this.bossHpBar.scaleX;
    const target = this.bossHpBarTarget;
    if (Math.abs(currentScale - target) > 0.001) {
      this.bossHpBar.scaleX = currentScale + (target - currentScale) * Math.min(1, dt * 8);
    }

    if (this.phase === 'gameover') return;

    // physics for fallers (always run, even between phases, so they finish their fall)
    const w = this.scale.width;
    for (const h of this.heroes) {
      if (h.state !== 'falling') continue;

      // auto-revive (Knights with Revival Potion)
      if (h.autoReviveAt > 0 && this.elapsed >= h.autoReviveAt) {
        this.revive(h, true);
        continue;
      }

      h.vy += GRAVITY * dt;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      if (h.x < 30) {
        h.x = 30;
        h.vx = Math.abs(h.vx);
      } else if (h.x > w - 30) {
        h.x = w - 30;
        h.vx = -Math.abs(h.vx);
      }
      h.container.setPosition(h.x, h.y);
    }

    for (const h of this.heroes) {
      if (h.state === 'falling' && h.y > this.scale.height + 40) this.die(h);
    }

    // clear curse status
    for (const h of this.heroes) {
      if (h.state === 'fighting' && h.cursedUntil > 0 && this.elapsed >= h.cursedUntil) {
        h.cursedUntil = 0;
        this.tweens.add({ targets: h.bg, alpha: 1, duration: 200 });
      }
    }

    if (this.phase === 'fighting') {
      const fighters = this.heroes.filter((h) => h.state === 'fighting' && h.cursedUntil === 0);
      const comboMultiplier = this.upgrades.has('crescendo') && this.comboCount > 1
        ? 1 + 0.25 * (this.comboCount - 1)
        : 1;
      const dps = fighters.length * HERO_DPS_BASE * comboMultiplier;
      if (dps > 0) {
        this.bossHp = Math.max(0, this.bossHp - dps * dt);
        this.bossHpBarTarget = this.bossHp / this.bossMaxHp;
        if (this.bossHp <= 0) {
          this.bossDefeated();
          return;
        }
      }

      this.bossAttackTimer -= deltaMs;
      if (this.bossAttackTimer <= 0) {
        this.bossAttack();
        const frac = this.bossHp / this.bossMaxHp;
        const cfg = BOSS_CONFIG[this.bossId];
        const interval = cfg.attackMin + (cfg.attackMax - cfg.attackMin) * frac;
        this.bossAttackTimer = interval * (0.85 + Math.random() * 0.3);
      }
    } else if (this.phase === 'endurance') {
      this.enduranceElapsed += deltaMs;
      this.enduranceWaveTimer -= deltaMs;
      if (this.enduranceWaveTimer <= 0) {
        this.enduranceTick();
        const t = this.enduranceElapsed / 1000;
        const interval = Math.max(420, 1500 - t * 12);
        this.enduranceWaveTimer = interval * (0.85 + Math.random() * 0.3);
      }
      // passive score climb
      this.score += dt * 4;
      this.refreshHud();
    }

    // combo timeout
    if (this.comboCount > 0) {
      this.comboTimer -= deltaMs;
      if (this.comboTimer <= 0) this.endCombo();
    }

    // gameover check (only during combat phases)
    if ((this.phase === 'fighting' || this.phase === 'endurance') && this.heroes.every((h) => h.state === 'dead')) {
      this.gameOver();
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

  // --- Roster ---

  private spawnRoster() {
    ROSTER.forEach((type, i) => {
      const cfg = HERO_CONFIG[type];
      const bg = this.add.rectangle(0, 0, cfg.size, cfg.size, cfg.color).setStrokeStyle(3, cfg.stroke);
      const label = addText(this, 0, cfg.size / 2 + 14, cfg.label, {
        fontFamily: FONT,
        fontSize: '18px',
        color: '#cbd5e1',
      }).setOrigin(0.5);
      const container = this.add.container(0, 0, [bg, label]).setDepth(10);
      this.heroes.push({
        type,
        slotIndex: i,
        state: 'fighting',
        container,
        bg,
        label,
        letterTexts: [],
        letters: '',
        typedCount: 0,
        vx: 0,
        vy: 0,
        x: 0,
        y: 0,
        cursedUntil: 0,
        autoReviveAt: 0,
      });
    });
    // idle bob
    for (const h of this.heroes) {
      this.tweens.add({
        targets: h.container,
        y: '+=4',
        duration: 1100 + Math.random() * 400,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      });
    }
  }

  private resetRoster() {
    for (const h of this.heroes) {
      h.state = 'fighting';
      h.cursedUntil = 0;
      h.autoReviveAt = 0;
      h.letterTexts.forEach((t) => t.destroy());
      h.letterTexts = [];
      h.letters = '';
      h.typedCount = 0;
      h.container.setVisible(true).setAlpha(1).setScale(1).setAngle(0);
      h.bg.setAlpha(1);
      const slot = this.slotPosition(h.slotIndex);
      h.x = slot.x;
      h.y = slot.y;
      h.container.setPosition(slot.x, slot.y);
    }
  }

  private slotPosition(slotIndex: number) {
    const { width, height } = this.scale;
    const slots = ROSTER.length;
    const x = (width / (slots + 1)) * (slotIndex + 1);
    const y = height * 0.18;
    return { x, y };
  }

  // --- Boss flow ---

  private startBoss(index: number) {
    this.bossIndex = index;
    this.bossId = BOSS_ORDER[index];
    const cfg = BOSS_CONFIG[this.bossId];
    this.bossMaxHp = cfg.hp;
    this.bossHp = cfg.hp;
    this.bossHpBarTarget = 1;
    this.bossHpBar.scaleX = 1;
    this.bossAttackTimer = cfg.attackMax;

    this.bossShape
      .setSize(cfg.width, cfg.height)
      .setFillStyle(cfg.color)
      .setStrokeStyle(3, cfg.stroke)
      .setVisible(true);
    this.bossGlow.setSize(cfg.width + 30, cfg.height + 30).setFillStyle(cfg.color, 0.18).setVisible(true);
    this.bossHpBarBg.setVisible(true);
    this.bossHpBar.setVisible(true).setFillStyle(cfg.color);
    this.bossNameText.setText(cfg.name).setVisible(true);

    this.tweens.add({
      targets: this.bossGlow,
      alpha: { from: 0.6, to: 0.18 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });

    this.layout();
    this.showIntro(cfg.subtitle, cfg.name, () => {
      this.phase = 'fighting';
    });
  }

  private bossAttack() {
    const candidates = this.heroes.filter((h) => h.state === 'fighting');
    if (candidates.length === 0) return;
    const cfg = BOSS_CONFIG[this.bossId];
    const count = cfg.pattern === 'double' ? 2 : 1;
    Phaser.Utils.Array.Shuffle(candidates);
    const targets = candidates.slice(0, Math.min(count, candidates.length));

    this.tweens.add({
      targets: this.bossShape,
      scale: { from: 1.2, to: 1 },
      duration: 200,
      ease: 'back.out',
    });
    this.cameras.main.shake(120, 0.006);

    for (const t of targets) this.knockDown(t);
  }

  private bossDefeated() {
    this.phase = 'cleared';
    this.endCombo();
    this.cameras.main.flash(220, 250, 240, 200, false);
    this.cameras.main.shake(280, 0.014);
    this.fx.setParticleTint(0xfacc15);
    this.fx.explode(60, this.bossShape.x, this.bossShape.y);

    // boss collapse animation
    this.tweens.add({
      targets: this.bossShape,
      scale: 0,
      angle: 90,
      duration: 600,
      ease: 'cubic.in',
      onComplete: () => this.bossShape.setVisible(false),
    });
    this.tweens.add({ targets: this.bossGlow, alpha: 0, duration: 400 });
    this.bossHpBar.setVisible(false);
    this.bossHpBarBg.setVisible(false);
    this.bossNameText.setVisible(false);

    // freeze any current fallers (count them as revived for free? no — let them resolve)
    for (const h of this.heroes) {
      if (h.state === 'falling') {
        h.letterTexts.forEach((t) => t.destroy());
        h.letterTexts = [];
        h.container.setVisible(false);
        h.state = 'dead';
      }
    }

    this.showIntro('VICTORY', BOSS_CONFIG[this.bossId].name + ' FALLS', () => {
      this.resetRoster();
      if (this.bossIndex + 1 < BOSS_ORDER.length) {
        this.openUpgradePicker();
      } else {
        this.startEndurance();
      }
    });
  }

  // --- Knock down + revive ---

  private knockDown(h: Hero) {
    const cfg = HERO_CONFIG[h.type];
    h.state = 'falling';
    h.cursedUntil = 0;
    h.bg.setAlpha(1);
    h.letters = this.pickLetters(cfg.letters);
    h.typedCount = 0;
    const slot = this.slotPosition(h.slotIndex);
    h.x = slot.x;
    h.y = slot.y;
    h.vx = Phaser.Math.Between(-50, 50);
    h.vy = cfg.fallVy;

    h.letterTexts.forEach((t) => t.destroy());
    h.letterTexts = [];
    if (cfg.letters === 1) {
      h.letterTexts.push(this.makeLetter(h.letters[0], 0, -cfg.size / 2 - 20));
    } else {
      h.letterTexts.push(this.makeLetter(h.letters[0], -18, -cfg.size / 2 - 20));
      h.letterTexts.push(this.makeLetter(h.letters[1], 18, -cfg.size / 2 - 20));
    }
    h.letterTexts.forEach((t) => h.container.add(t));

    // Revival Potion: queue auto-revive for knights
    if (h.type === 'knight' && this.upgrades.has('revival_potion')) {
      h.autoReviveAt = this.elapsed + KNIGHT_AUTOREVIVE_MS;
    } else {
      h.autoReviveAt = 0;
    }

    this.tweens.add({
      targets: h.container,
      angle: { from: 0, to: Phaser.Math.Between(-20, 20) },
      duration: 220,
      yoyo: true,
    });
    this.fx.setParticleTint(0xef4444);
    this.fx.explode(8, slot.x, slot.y);
  }

  private pickLetters(count: number) {
    let s = '';
    while (s.length < count) {
      const c = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
      if (!s.includes(c)) s += c;
    }
    return s;
  }

  private makeLetter(ch: string, ox: number, oy: number) {
    return addText(this, ox, oy, ch, {
      fontFamily: FONT_DISPLAY,
      fontSize: '22px',
      color: '#fef3c7',
    }).setOrigin(0.5);
  }

  private handleKey = (event: KeyboardEvent) => {
    if (this.phase === 'gameover') {
      if (event.key === ' ' || event.key === 'Enter') this.scene.restart();
      return;
    }
    if (this.phase === 'upgrade') {
      if (event.key === '1' || event.key === '2' || event.key === '3') {
        const idx = parseInt(event.key, 10) - 1;
        if (idx < this.upgradeCards.length) this.pickUpgrade(this.upgradeCards[idx].id);
      }
      return;
    }

    const key = event.key.toUpperCase();
    if (!/^[A-Z]$/.test(key)) return;

    let target: Hero | undefined;
    let lowestY = -Infinity;
    for (const h of this.heroes) {
      if (h.state !== 'falling') continue;
      const next = h.letters[h.typedCount];
      if (next === key && h.y > lowestY) {
        lowestY = h.y;
        target = h;
      }
    }
    if (!target) return;

    const idx = target.typedCount;
    target.letterTexts[idx].setColor('#22c55e');
    target.typedCount = idx + 1;
    this.tweens.add({
      targets: target.letterTexts[idx],
      scale: { from: 1.7, to: 1 },
      duration: 160,
      ease: 'back.out',
    });

    if (target.typedCount >= target.letters.length) this.revive(target, false);
  };

  private revive(h: Hero, auto: boolean) {
    const cfg = HERO_CONFIG[h.type];
    const multiplier = Math.max(1, this.comboCount);
    const points = Math.round(cfg.score * multiplier);
    this.score += points;

    this.fx.setParticleTint(this.heroParticleColor(h.type));
    this.fx.explode(22, h.x, h.y);

    this.popup(`+${points}`, h.x, h.y, multiplier > 1 ? '#fde047' : '#a7f3d0');

    h.letterTexts.forEach((t) => t.destroy());
    h.letterTexts = [];
    h.autoReviveAt = 0;
    h.state = 'fighting';
    h.container.setAngle(0);

    // cursed revive (Tyrant)
    if (BOSS_CONFIG[this.bossId].cursedRevive && this.phase === 'fighting') {
      h.cursedUntil = this.elapsed + TYRANT_CURSE_MS;
      h.bg.setAlpha(0.45);
      this.popup('CURSED', h.x, h.y - 30, '#c4b5fd');
    }

    const slot = this.slotPosition(h.slotIndex);
    h.x = slot.x;
    h.y = slot.y;
    this.tweens.add({
      targets: h.container,
      x: slot.x,
      y: slot.y,
      duration: 280,
      ease: 'cubic.out',
    });
    this.tweens.add({
      targets: h.container,
      scale: { from: 1.5, to: 1 },
      duration: 260,
      ease: 'back.out',
    });

    this.applyEffect(h);

    // combo
    if (h.type === 'bard') {
      this.comboCount = Math.max(this.comboCount + 1, 2);
      this.comboTimer = this.comboWindow();
      this.popup('COMBO!', h.x, h.y - 50, '#fde047');
    } else if (this.comboCount > 0) {
      this.comboCount += 1;
      this.comboTimer = this.comboWindow();
    }
    if (this.comboCount > this.highCombo) this.highCombo = this.comboCount;
    if (this.comboCount >= 3) this.cameras.main.flash(70, 253, 224, 71, false);

    this.refreshHud();
    if (!auto) {
      // small "press confirm" punch
      this.cameras.main.shake(30, 0.0025);
    }
  }

  private comboWindow() {
    return COMBO_WINDOW_BASE + (this.upgrades.has('encore') ? ENCORE_BONUS : 0);
  }

  private endCombo() {
    if (this.comboCount === 0) return;
    this.comboCount = 0;
    this.refreshHud();
  }

  private applyEffect(h: Hero) {
    if (h.type === 'mage' && this.phase === 'fighting') {
      if (this.upgrades.has('twin_bolt')) {
        this.castMageBolt(h, TWIN_BOLT_DAMAGE, -20);
        this.time.delayedCall(120, () => this.castMageBolt(h, TWIN_BOLT_DAMAGE, 20));
      } else {
        this.castMageBolt(h, MAGE_BASE_DAMAGE, 0);
      }
    } else if (h.type === 'necromancer') {
      const dead = this.heroes.filter((d) => d.state === 'dead');
      if (dead.length === 0) return;
      const reviveCount = this.upgrades.has('reanimator') ? dead.length : 1;
      let raised = 0;
      for (const d of dead) {
        if (raised >= reviveCount) break;
        this.raiseFromDead(d);
        raised += 1;
      }
      if (raised > 0) this.popup(`RAISED x${raised}`, h.x, h.y - 50, '#fca5a5');
    } else if (h.type === 'bard' && this.upgrades.has('power_chord') && this.phase === 'fighting') {
      this.castMageBolt(h, POWER_CHORD_DAMAGE, 0, 0xfde047);
    }
  }

  private castMageBolt(from: Hero, damage: number, ox: number, color = 0x6ee7b7) {
    if (!this.bossShape.visible) return;
    const bolt = this.add.circle(from.x + ox, from.y, 9, color).setDepth(15);
    const targetX = this.bossShape.x;
    const targetY = this.bossShape.y;
    this.tweens.add({
      targets: bolt,
      x: targetX,
      y: targetY,
      duration: 280,
      ease: 'cubic.in',
      onComplete: () => {
        bolt.destroy();
        if (this.phase !== 'fighting') return;
        this.bossHp = Math.max(0, this.bossHp - damage);
        this.bossHpBarTarget = this.bossHp / this.bossMaxHp;
        this.fx.setParticleTint(color);
        this.fx.explode(20, targetX, targetY);
        this.popup(`-${damage}`, targetX, targetY - 30, '#' + color.toString(16).padStart(6, '0'));
        this.tweens.add({
          targets: this.bossShape,
          scale: { from: 1.2, to: 1 },
          duration: 180,
          ease: 'back.out',
        });
        this.cameras.main.shake(120, 0.008);
        if (this.bossHp <= 0) this.bossDefeated();
      },
    });
  }

  private raiseFromDead(h: Hero) {
    h.state = 'fighting';
    h.cursedUntil = 0;
    h.container.setVisible(true).setAlpha(0).setScale(0.3);
    h.bg.setAlpha(1);
    const slot = this.slotPosition(h.slotIndex);
    h.x = slot.x;
    h.y = slot.y;
    h.container.setPosition(slot.x, slot.y);
    this.tweens.add({
      targets: h.container,
      alpha: 1,
      scale: 1,
      duration: 380,
      ease: 'back.out',
    });
    this.fx.setParticleTint(0xfca5a5);
    this.fx.explode(24, slot.x, slot.y);
  }

  private heroParticleColor(type: HeroType): number {
    switch (type) {
      case 'tank': return 0xc4b5fd;
      case 'mage': return 0x6ee7b7;
      case 'necromancer': return 0xfca5a5;
      case 'bard': return 0xfde047;
      case 'knight':
      default: return 0x93c5fd;
    }
  }

  private die(h: Hero) {
    h.state = 'dead';
    h.autoReviveAt = 0;
    this.endCombo();
    this.fx.setParticleTint(0xef4444);
    this.fx.explode(28, h.x, this.scale.height - 20);
    this.cameras.main.shake(240, 0.018);
    this.cameras.main.flash(120, 90, 0, 20, false);
    h.letterTexts.forEach((t) => t.destroy());
    h.letterTexts = [];
    h.container.setVisible(false);
    this.refreshHud();
  }

  private popup(text: string, x: number, y: number, color: string) {
    const t = addText(this, x, y, text, {
      fontFamily: FONT,
      fontSize: '26px',
      color,
    })
      .setOrigin(0.5)
      .setDepth(25);
    this.tweens.add({
      targets: t,
      y: y - 60,
      alpha: 0,
      duration: 720,
      ease: 'cubic.out',
      onComplete: () => t.destroy(),
    });
  }

  // --- Endurance ---

  private startEndurance() {
    this.phase = 'endurance_intro';
    this.bossShape.setVisible(false);
    this.bossGlow.setVisible(false);
    this.bossHpBar.setVisible(false);
    this.bossHpBarBg.setVisible(false);
    this.bossNameText.setVisible(false);
    this.enduranceElapsed = 0;
    this.enduranceWaveTimer = 1500;
    this.showIntro('ENDURANCE', 'survive as long as you can', () => {
      this.phase = 'endurance';
    });
  }

  private enduranceTick() {
    const candidates = this.heroes.filter((h) => h.state === 'fighting');
    if (candidates.length === 0) return;
    const t = this.enduranceElapsed / 1000;
    const doubleChance = Math.min(0.9, t / 60);
    const count = Math.random() < doubleChance ? 2 : 1;
    Phaser.Utils.Array.Shuffle(candidates);
    for (const c of candidates.slice(0, Math.min(count, candidates.length))) this.knockDown(c);
    this.cameras.main.shake(80, 0.005);
  }

  // --- Upgrade picker ---

  private openUpgradePicker() {
    this.phase = 'upgrade';
    const available = ALL_UPGRADES.filter((u) => !this.upgrades.has(u));
    Phaser.Utils.Array.Shuffle(available);
    const choices = available.slice(0, Math.min(3, available.length));
    if (choices.length === 0) {
      this.startBoss(this.bossIndex + 1);
      return;
    }

    const { width, height } = this.scale;
    this.upgradeOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65).setDepth(45);
    this.upgradeTitle = addText(this, width / 2, height * 0.25, 'CHOOSE AN UPGRADE', {
      fontFamily: FONT_DISPLAY,
      fontSize: '28px',
      color: '#facc15',
    }).setOrigin(0.5).setDepth(46);

    const cardW = 260;
    const cardH = 220;
    const gap = 28;
    const totalW = choices.length * cardW + (choices.length - 1) * gap;
    const startX = width / 2 - totalW / 2 + cardW / 2;
    const cardY = height / 2 + 20;

    choices.forEach((id, i) => {
      const x = startX + i * (cardW + gap);
      const info = UPGRADE_INFO[id];
      const bg = this.add
        .rectangle(x, cardY + 20, cardW, cardH, 0x1a1828)
        .setStrokeStyle(3, 0x4a4665)
        .setDepth(46)
        .setInteractive({ useHandCursor: true });

      const indexText = addText(this, x, cardY + 20 - cardH / 2 + 26, `${i + 1}`, {
        fontFamily: FONT_DISPLAY,
        fontSize: '22px',
        color: '#9b94b8',
      }).setOrigin(0.5).setDepth(47);

      const nameText = addText(this, x, cardY + 20 - 30, info.name, {
        fontFamily: FONT_DISPLAY,
        fontSize: '16px',
        color: info.color,
        align: 'center',
      }).setOrigin(0.5).setDepth(47);

      const descText = addText(this, x, cardY + 20 + 30, info.desc, {
        fontFamily: FONT,
        fontSize: '22px',
        color: COLORS.text,
        align: 'center',
        wordWrap: { width: cardW - 30 },
      }).setOrigin(0.5).setDepth(47);

      bg.on('pointerover', () => {
        bg.setStrokeStyle(3, 0xfacc15);
        this.tweens.add({ targets: [bg, indexText, nameText, descText], y: '-=8', duration: 140, ease: 'sine.out' });
      });
      bg.on('pointerout', () => {
        bg.setStrokeStyle(3, 0x4a4665);
        this.tweens.add({ targets: [bg, indexText, nameText, descText], y: '+=8', duration: 140, ease: 'sine.out' });
      });
      bg.on('pointerdown', () => this.pickUpgrade(id));

      // entrance anim
      bg.setAlpha(0).setScale(0.85);
      indexText.setAlpha(0);
      nameText.setAlpha(0);
      descText.setAlpha(0);
      this.tweens.add({
        targets: [bg],
        alpha: 1,
        scale: 1,
        duration: 280,
        delay: 80 * i,
        ease: 'back.out',
      });
      this.tweens.add({
        targets: [indexText, nameText, descText],
        alpha: 1,
        duration: 240,
        delay: 80 * i + 80,
      });

      this.upgradeCards.push({ bg, nameText, descText, indexText, id });
    });
  }

  private pickUpgrade(id: UpgradeId) {
    if (this.phase !== 'upgrade') return;
    this.upgrades.add(id);
    this.closeUpgradePicker();
    this.refreshHud();
    this.time.delayedCall(180, () => this.startBoss(this.bossIndex + 1));
  }

  private closeUpgradePicker() {
    this.upgradeOverlay?.destroy();
    this.upgradeOverlay = undefined;
    this.upgradeTitle?.destroy();
    this.upgradeTitle = undefined;
    for (const c of this.upgradeCards) {
      c.bg.destroy();
      c.nameText.destroy();
      c.descText.destroy();
      c.indexText.destroy();
    }
    this.upgradeCards = [];
  }

  // --- Intro overlay ---

  private showIntro(small: string, big: string, onDone: () => void) {
    const { width, height } = this.scale;
    this.introSmall.setText(small).setPosition(width / 2, height / 2 - 50).setVisible(true).setAlpha(0);
    this.introBig.setText(big).setPosition(width / 2, height / 2 + 10).setVisible(true).setAlpha(0).setScale(0.85);

    this.tweens.add({ targets: this.introSmall, alpha: 1, duration: 240 });
    this.tweens.add({ targets: this.introBig, alpha: 1, scale: 1, duration: 360, ease: 'back.out' });

    this.time.delayedCall(1700, () => {
      this.tweens.add({
        targets: [this.introSmall, this.introBig],
        alpha: 0,
        duration: 280,
        onComplete: () => {
          this.introSmall.setVisible(false);
          this.introBig.setVisible(false);
          onDone();
        },
      });
    });
  }

  // --- HUD ---

  private refreshHud() {
    this.scoreText.setText(`SCORE  ${Math.floor(this.score)}`);
    this.comboText.setText(this.comboCount > 1 ? `x${this.comboCount}` : '');
    if (this.upgrades.size > 0) {
      const names = [...this.upgrades].map((u) => UPGRADE_INFO[u].name).join('  /  ');
      this.upgradesHud.setText(names);
    } else {
      this.upgradesHud.setText('');
    }
    if (this.phase === 'endurance' || this.phase === 'endurance_intro') {
      this.enduranceLabel.setText(`ENDURANCE  ${Math.floor(this.enduranceElapsed / 1000)}s`);
    } else {
      this.enduranceLabel.setText('');
    }
  }

  private gameOver() {
    if (this.phase === 'gameover') return;
    this.phase = 'gameover';
    this.endCombo();
    this.cameras.main.flash(300, 120, 0, 20, false);
    this.cameras.main.shake(400, 0.02);
    const { width, height } = this.scale;
    this.overText.setText('ALL HEROES FALLEN').setColor('#f87171').setPosition(width / 2, height / 2 - 30).setVisible(true);
    this.restartHint
      .setText(`SCORE ${Math.floor(this.score)}    BEST COMBO x${this.highCombo}\npress SPACE to restart`)
      .setPosition(width / 2, height / 2 + 40)
      .setVisible(true);
  }

  // --- Layout ---

  private layout() {
    const { width, height } = this.scale;

    this.scoreText.setPosition(24, 16);
    this.comboText.setPosition(width / 2, height * 0.34);
    this.upgradesHud.setPosition(24, height - 30);
    this.enduranceLabel.setPosition(width - 24, 24).setOrigin(1, 0);

    this.bossShape.setPosition(width / 2, height * 0.07);
    this.bossGlow.setPosition(width / 2, height * 0.07);
    this.bossHpBarBg.setPosition(width / 2, height * 0.115);
    this.bossHpBar.setPosition(width / 2 - 270, height * 0.115);
    this.bossNameText.setPosition(width / 2, height * 0.115);

    this.floorLine.setPosition(0, height * FLOOR_FRACTION).setSize(width, 2);
    this.floorGlow.setPosition(0, height * FLOOR_FRACTION).setSize(width, 60);

    for (const h of this.heroes) {
      if (h.state === 'fighting') {
        const slot = this.slotPosition(h.slotIndex);
        h.x = slot.x;
        h.y = slot.y;
        h.container.setPosition(slot.x, slot.y);
      }
    }

    if (this.upgradeOverlay) {
      this.upgradeOverlay.setPosition(width / 2, height / 2).setSize(width, height);
      this.upgradeTitle?.setPosition(width / 2, height * 0.25);
    }
  }
}
