const readline = require('readline');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  DINO_STAND,
  DINO_RUN_1,
  DINO_RUN_2,
  DINO_DUCK_1,
  DINO_DUCK_2,
  DINO_DEAD,
  CACTUS_SMALL_1,
  CACTUS_SMALL_2,
  CACTUS_SMALL_3,
  CACTUS_LARGE_1,
  CACTUS_LARGE_2,
  PTERO_1,
  PTERO_2,
  CLOUD,
  MOON,
  GAME_OVER_TEXT
} = require('./sprites');

const HIGHSCORE_FILE = path.join(os.homedir(), '.chrome-dino-cli-highscore');

function getHighScore() {
  try {
    const val = parseInt(fs.readFileSync(HIGHSCORE_FILE, 'utf8'), 10);
    return isNaN(val) ? 0 : val;
  } catch (e) {
    return 0;
  }
}

function saveHighScore(val) {
  try {
    fs.writeFileSync(HIGHSCORE_FILE, String(val), 'utf8');
  } catch (e) {}
}

function startGame() {
  const GAME_WIDTH = 80;
  const GAME_HEIGHT = 16;
  const GROUND_Y = 13;
  const DINO_X = 6;
  const JUMP_VELOCITY = 1.05;
  const GRAVITY = 0.075;
  const FAST_FALL = 0.22;
  const INITIAL_SPEED = 0.95;
  const MAX_SPEED = 2.4;
  const GROUND_TEXTURE = '  ..   __  .    ...   _   .  ..   ____  .   ..   _   ...   .  __   ..   ';

  let gameState = 'START';
  let score = 0;
  let scoreDistance = 0;
  let speed = INITIAL_SPEED;
  let highScore = getHighScore();
  let lastMilestone = 0;
  let milestoneTimer = 0;
  let groundOffset = 0;
  let distanceToNext = 35;
  let tick = 0;
  let timer = null;
  let dinoAnimPhase = 0;
  let pteroAnimPhase = 0;

  const dino = {
    x: DINO_X,
    y: 0,
    vy: 0,
    isJumping: false,
    isDucking: false,
    duckTimer: 0
  };

  const clouds = [
    { x: 18, row: 2 },
    { x: 48, row: 4 },
    { x: 74, row: 1 }
  ];

  const stars = [
    { x: 8, y: 2 },
    { x: 22, y: 4 },
    { x: 38, y: 1 },
    { x: 50, y: 3 },
    { x: 68, y: 2 },
    { x: 76, y: 5 }
  ];

  let obstacles = [];

  function resetGame() {
    score = 0;
    scoreDistance = 0;
    speed = INITIAL_SPEED;
    lastMilestone = 0;
    milestoneTimer = 0;
    groundOffset = 0;
    distanceToNext = 35;
    obstacles = [];
    dinoAnimPhase = 0;
    pteroAnimPhase = 0;
    dino.y = 0;
    dino.vy = 0;
    dino.isJumping = false;
    dino.isDucking = false;
    dino.duckTimer = 0;
  }

  function spawnObstacle() {
    if (score >= 300 && Math.random() < 0.35) {
      const altitudes = [1, 3, 5];
      const y = altitudes[Math.floor(Math.random() * altitudes.length)];
      obstacles.push({
        type: 'ptero',
        x: GAME_WIDTH,
        y: y,
        width: 6,
        height: 2,
        frames: [PTERO_1, PTERO_2]
      });
    } else {
      const cactusOptions = [
        { sprite: CACTUS_SMALL_1, w: 3, h: 2 },
        { sprite: CACTUS_SMALL_2, w: 7, h: 2 },
        { sprite: CACTUS_LARGE_1, w: 4, h: 3 }
      ];
      if (score >= 120) {
        cactusOptions.push(
          { sprite: CACTUS_SMALL_3, w: 11, h: 2 },
          { sprite: CACTUS_LARGE_2, w: 10, h: 3 }
        );
      }
      const chosen = cactusOptions[Math.floor(Math.random() * cactusOptions.length)];
      obstacles.push({
        type: 'cactus',
        x: GAME_WIDTH,
        y: 0,
        width: chosen.w,
        height: chosen.h,
        sprite: chosen.sprite
      });
    }
  }

  function drawSprite(buf, startX, startY, lines) {
    for (let r = 0; r < lines.length; r++) {
      const row = startY + r;
      if (row < 0 || row >= GAME_HEIGHT) continue;
      const line = lines[r];
      for (let c = 0; c < line.length; c++) {
        const col = startX + c;
        if (col < 0 || col >= GAME_WIDTH) continue;
        const char = line[c];
        if (char !== ' ') buf[row][col] = char;
      }
    }
  }

  function drawText(buf, x, y, str) {
    for (let i = 0; i < str.length; i++) {
      if (x + i >= 0 && x + i < GAME_WIDTH && y >= 0 && y < GAME_HEIGHT) {
        buf[y][x + i] = str[i];
      }
    }
  }

  function render() {
    const isNight = score % 1000 >= 700;
    const buffer = Array.from({ length: GAME_HEIGHT }, () => Array(GAME_WIDTH).fill(' '));

    if (isNight) {
      drawSprite(buffer, 65, 1, MOON);
      for (const star of stars) {
        if ((tick + star.x) % 24 < 16) {
          if (star.y < GAME_HEIGHT && star.x < GAME_WIDTH) {
            buffer[star.y][star.x] = (tick + star.x) % 48 < 24 ? '·' : '*';
          }
        }
      }
    }

    for (const cloud of clouds) {
      drawSprite(buffer, Math.round(cloud.x), cloud.row, CLOUD);
    }

    for (let c = 0; c < GAME_WIDTH; c++) {
      buffer[GROUND_Y][c] = '─';
    }

    const gOffset = Math.floor(groundOffset) % GROUND_TEXTURE.length;
    for (let c = 0; c < GAME_WIDTH; c++) {
      const ch = GROUND_TEXTURE[(gOffset + c) % GROUND_TEXTURE.length];
      if (ch !== ' ') buffer[GROUND_Y + 1][c] = ch;
    }

    for (const obs of obstacles) {
      const sprite = obs.type === 'ptero'
        ? obs.frames[Math.floor(pteroAnimPhase) % 2]
        : obs.sprite;
      const y = GROUND_Y - obs.y - obs.height;
      drawSprite(buffer, Math.round(obs.x), y, sprite);
    }

    let dinoSprite;
    let dinoHeight;
    if (gameState === 'GAMEOVER') {
      dinoSprite = DINO_DEAD;
      dinoHeight = 5;
    } else if (dino.isDucking) {
      dinoSprite = (Math.floor(dinoAnimPhase) % 2 === 0) ? DINO_DUCK_1 : DINO_DUCK_2;
      dinoHeight = 3;
    } else if (dino.isJumping || gameState === 'START') {
      dinoSprite = DINO_STAND;
      dinoHeight = 5;
    } else {
      dinoSprite = (Math.floor(dinoAnimPhase) % 2 === 0) ? DINO_RUN_1 : DINO_RUN_2;
      dinoHeight = 5;
    }

    const dinoY = GROUND_Y - dinoHeight - Math.round(dino.y);
    drawSprite(buffer, dino.x, dinoY, dinoSprite);

    let scoreText;
    if (milestoneTimer > 0) {
      milestoneTimer--;
      scoreText = (Math.floor(milestoneTimer / 8) % 2 === 0)
        ? String(lastMilestone).padStart(5, '0')
        : '     ';
    } else {
      scoreText = String(Math.floor(score)).padStart(5, '0');
    }
    const hiText = String(Math.max(highScore, Math.floor(score))).padStart(5, '0');
    const hudStr = 'HI ' + hiText + '  ' + scoreText;
    const hudX = GAME_WIDTH - hudStr.length - 2;
    for (let c = 0; c < hudStr.length; c++) {
      buffer[0][hudX + c] = hudStr[c];
    }

    if (gameState === 'START') {
      const title = 'CHROME DINO RUNNER';
      const sub1 = 'SPACE / UP  : JUMP';
      const sub2 = 'DOWN        : DUCK';
      const sub3 = 'Q           : QUIT';
      drawText(buffer, Math.floor((GAME_WIDTH - title.length) / 2), 3, title);
      drawText(buffer, Math.floor((GAME_WIDTH - sub1.length) / 2), 5, sub1);
      drawText(buffer, Math.floor((GAME_WIDTH - sub2.length) / 2), 6, sub2);
      drawText(buffer, Math.floor((GAME_WIDTH - sub3.length) / 2), 7, sub3);
    }

    if (gameState === 'GAMEOVER') {
      const bannerX = Math.floor((GAME_WIDTH - 46) / 2);
      drawSprite(buffer, bannerX, 2, GAME_OVER_TEXT);
      const restartText = 'PRESS SPACE TO RESTART';
      const restartX = Math.floor((GAME_WIDTH - restartText.length) / 2);
      drawText(buffer, restartX, 7, restartText);
    }

    const termCols = process.stdout.columns || 80;
    const termRows = process.stdout.rows || 24;
    const padX = Math.max(0, Math.floor((termCols - GAME_WIDTH) / 2));
    const padY = Math.max(0, Math.floor((termRows - GAME_HEIGHT) / 2));
    const xSpaces = ' '.repeat(padX);
    const yNewlines = '\n'.repeat(padY);

    let output = '\x1b[H' + yNewlines;
    for (let r = 0; r < GAME_HEIGHT; r++) {
      const line = buffer[r].join('').padEnd(GAME_WIDTH, ' ');
      output += xSpaces + (isNight ? '\x1b[7m' + line + '\x1b[0m' : line) + '\n';
    }
    process.stdout.write(output);
  }

  function update() {
    tick++;

    if (gameState === 'PLAYING') {
      speed = Math.min(MAX_SPEED, INITIAL_SPEED + Math.pow(score / 350, 0.75) * 0.55);
      groundOffset += speed;
      scoreDistance += speed * 0.08;
      score = scoreDistance;

      dinoAnimPhase += speed * 0.18;
      pteroAnimPhase += speed * 0.12;

      const currentIntScore = Math.floor(score);
      if (currentIntScore > 0 && currentIntScore % 100 === 0 && currentIntScore !== lastMilestone) {
        lastMilestone = currentIntScore;
        milestoneTimer = 48;
        process.stdout.write('\x07');
      }

      for (const cloud of clouds) {
        cloud.x -= speed * 0.2;
        if (cloud.x < -8) {
          cloud.x = GAME_WIDTH + Math.random() * 15;
          cloud.row = Math.floor(Math.random() * 4) + 1;
        }
      }

      if (dino.duckTimer > 0) {
        dino.duckTimer--;
        if (dino.duckTimer === 0) {
          dino.isDucking = false;
        }
      }

      if (dino.isJumping) {
        dino.y += dino.vy;
        dino.vy -= GRAVITY;
        if (dino.y <= 0) {
          dino.y = 0;
          dino.vy = 0;
          dino.isJumping = false;
        }
      }

      distanceToNext -= speed;
      if (distanceToNext <= 0) {
        spawnObstacle();
        const minGap = Math.floor(30 + speed * 21);
        const randGap = Math.floor(Math.random() * Math.max(12, 28 - speed * 4));
        distanceToNext = minGap + randGap;
      }

      const dinoHeight = dino.isDucking ? 3 : 5;
      const dinoLeft = dino.x + 1;
      const dinoRight = dino.x + (dino.isDucking ? 8 : 4);
      const dinoBot = GROUND_Y - 1 - Math.round(dino.y);
      const dinoTop = GROUND_Y - dinoHeight - Math.round(dino.y) + (dino.isDucking ? 0 : 1);

      for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.x -= speed;
        if (obs.x + obs.width < 0) {
          obstacles.splice(i, 1);
          continue;
        }

        const obsLeft = Math.round(obs.x) + 1;
        const obsRight = Math.round(obs.x) + obs.width - 1;
        const obsBot = GROUND_Y - obs.y - 1;
        const obsTop = GROUND_Y - obs.y - obs.height;

        if (dinoLeft < obsRight && dinoRight > obsLeft && dinoTop <= obsBot && dinoBot >= obsTop) {
          gameState = 'GAMEOVER';
          process.stdout.write('\x07');
          if (Math.floor(score) > highScore) {
            highScore = Math.floor(score);
            saveHighScore(highScore);
          }
          break;
        }
      }
    }

    render();
  }

  function cleanup() {
    if (timer) clearInterval(timer);
    process.stdout.write('\x1b[0m\x1b[?25h\x1b[?1049l');
    if (process.stdin.isTTY && process.stdin.setRawMode) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
  }

  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });
  process.on('uncaughtException', () => {
    cleanup();
    process.exit(1);
  });

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  process.stdin.on('keypress', (str, key) => {
    if (!key) return;
    if ((key.ctrl && key.name === 'c') || key.name === 'q') {
      cleanup();
      process.exit(0);
    }

    if (gameState === 'START') {
      if (key.name === 'space' || key.name === 'up') {
        gameState = 'PLAYING';
        dino.vy = JUMP_VELOCITY;
        dino.isJumping = true;
      }
      return;
    }

    if (gameState === 'GAMEOVER') {
      if (key.name === 'space' || key.name === 'up') {
        resetGame();
        gameState = 'PLAYING';
      }
      return;
    }

    if (gameState === 'PLAYING') {
      if (key.name === 'space' || key.name === 'up') {
        if (!dino.isJumping && dino.y === 0) {
          dino.vy = JUMP_VELOCITY;
          dino.isJumping = true;
          dino.isDucking = false;
          dino.duckTimer = 0;
        }
      } else if (key.name === 'down') {
        if (dino.isJumping) {
          dino.vy -= FAST_FALL;
        }
        dino.isDucking = true;
        dino.duckTimer = 16;
      }
    }
  });

  process.stdout.write('\x1b[?1049h\x1b[?25l');
  render();
  timer = setInterval(update, 20);
}

module.exports = { startGame };

if (require.main === module) {
  startGame();
}
