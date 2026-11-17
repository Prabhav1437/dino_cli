# dino

A terminal-based Chrome Dino game with authentic dynamics.

## Run directly

```bash
npx dino
```

## Global Install

```bash
npm install -g @prabhav1437/dino
dino
```

## Local Development

```bash
node bin/dino.js
```

## Controls

- `Space` / `Up Arrow`: Jump (or Restart if Game Over)
- `Down Arrow`: Duck / Fast Drop
- `Q` or `Ctrl + C`: Quit

## Features

- Authentic Dino run, duck, jump, and crash animations
- Procedural obstacles: small cacti, large cacti, clusters, and flying pterodactyls
- Variable pterodactyl flight altitudes (low, mid, high)
- Progressive speed acceleration with distance
- Day and night visual transitions
- Floating clouds, moon, and twinkling stars
- High score tracking and milestone sound/flash notifications
- Zero dependencies: runs natively on Node.js standard libraries
