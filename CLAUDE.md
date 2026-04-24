# ldjam59

Weekend game jam. Ship > polish.

## North star

- **Iterate fast.** Smallest change that proves the idea. Tweak values in place, don't refactor.
- **No premature abstractions.** Duplicated code is fine if it's a one or two-off. Wait until it hurts before generalizing.
- **One-off scripts and hardcoded values are fine.** This code has a 48-hour shelf life.
- **Cut scope before cutting corners on fun.**

## Skills

This project uses Phaser 4. A full set of `phaser-*` skills is installed covering scenes, sprites, tweens, physics (arcade + matter), input, tilemaps, particles, cameras, audio, etc. **Check for a relevant skill before writing Phaser code** — they have the current API and save guessing.

## Tooling

- `bun` for everything JS/TS.
- `bun run dev` shows TS errors as a browser overlay in real time (vite-plugin-checker). Keep it running while you work — that's the feedback loop.
- `bun run typecheck` for a one-shot check.

## Development

NEVER UNDER ANY CIRCUMSTANCE START A PREVIEW OR TRY TO START A DEV SERVER. IT WILL BREAK THE ENVIRONMENT - I WILL CHECK THE RESULTS MYSELF.