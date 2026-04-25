# ldjam59

Weekend game jam. Ship > polish.

## North star

- **Iterate fast.** Smallest change that proves the idea. Tweak values in place, don't refactor.
- **No premature abstractions.** Duplicated code is fine if it's a one or two-off. Wait until it hurts before generalizing.
- **One-off scripts and hardcoded values are fine.** This code has a 48-hour shelf life.
- **Cut scope before cutting corners on fun.**
- **Splitting a file is fine when it helps.** Don't cram everything into one file just to avoid creating a new one — but don't split prematurely either.

## Think before coding

Don't assume. Don't hide confusion. Surface tradeoffs.

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.
- Prefix uncertain or predictive claims with `(speculative):`.

## Simplicity first

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask: "Would a senior engineer call this overcomplicated?" If yes, simplify.

## Surgical changes

Touch only what you must. Clean up only your own mess.

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you spot unrelated dead code, mention it — don't delete it.
- Remove imports/variables/functions that *your* changes orphaned. Leave pre-existing dead code alone unless asked.

Every changed line should trace directly to the request.

## Verification

No tests. No test-writing. No visual or gameplay verification loops — the user playtests personally.

"Done" means:

- `bun run typecheck` passes.
- The change matches the requested behavior on inspection.

Don't loop trying to confirm things by running the game or eyeballing the browser. State what you changed and stop.

## Skills

This project uses Phaser 4. A full set of `phaser-*` skills is installed covering scenes, sprites, tweens, physics (arcade + matter), input, tilemaps, particles, cameras, audio, etc. **Check for a relevant skill before writing Phaser code** — they have the current API and save guessing.

## Tooling

- `bun` for everything JS/TS. Never `npm`.
- `bun run dev` shows TS errors as a browser overlay in real time (vite-plugin-checker). Keep it running while you work — that's the feedback loop.
- `bun run typecheck` for a one-shot check.

## Development

NEVER UNDER ANY CIRCUMSTANCE START A PREVIEW OR TRY TO START A DEV SERVER. IT WILL BREAK THE ENVIRONMENT - I WILL CHECK THE RESULTS MYSELF.
