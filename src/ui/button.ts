import * as Phaser from 'phaser';
import { COLORS, FONT } from '../theme';
import { addText } from './text';

export type Button = {
  setPosition(x: number, y: number): void;
  setSize(width: number, height: number): void;
  setVisible(visible: boolean): void;
  destroy(): void;
};

type ButtonOptions = {
  width?: number;
  height?: number;
  fontSize?: number;
  fill?: number;
  hoverFill?: number;
  textColor?: string;
};

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  options: ButtonOptions = {},
): Button {
  const width = options.width ?? 220;
  const height = options.height ?? 64;
  const fill = options.fill ?? COLORS.primary;
  const hoverFill = options.hoverFill ?? COLORS.primaryHover;
  const bg = scene.add
    .rectangle(x, y, width, height, fill, 1)
    .setStrokeStyle(2, COLORS.panelStroke)
    .setInteractive({ useHandCursor: true });

  const text = addText(scene, x, y, label, {
    fontFamily: FONT,
    fontSize: `${options.fontSize ?? 26}px`,
    color: options.textColor ?? COLORS.darkText,
    fontStyle: '700',
  }).setOrigin(0.5);

  bg.on('pointerover', () => {
    bg.setFillStyle(hoverFill);
    scene.tweens.add({ targets: [bg, text], scale: 1.03, duration: 90, ease: 'Sine.easeOut' });
  });

  bg.on('pointerout', () => {
    bg.setFillStyle(fill);
    scene.tweens.add({ targets: [bg, text], scale: 1, duration: 110, ease: 'Sine.easeOut' });
  });

  bg.on('pointerdown', () => {
    scene.tweens.add({ targets: [bg, text], scale: 0.97, duration: 70, yoyo: true });
    onClick();
  });

  return {
    setPosition(nx: number, ny: number) {
      bg.setPosition(nx, ny);
      text.setPosition(nx, ny);
    },
    setSize(nextWidth: number, nextHeight: number) {
      bg.setSize(nextWidth, nextHeight);
      bg.setDisplaySize(nextWidth, nextHeight);
      text.setFontSize(Math.round(Phaser.Math.Clamp(nextWidth * 0.12, 18, 30)));
    },
    setVisible(visible: boolean) {
      bg.setVisible(visible);
      text.setVisible(visible);
      if (visible) bg.setInteractive({ useHandCursor: true });
      else bg.disableInteractive();
    },
    destroy() {
      bg.destroy();
      text.destroy();
    },
  };
}
