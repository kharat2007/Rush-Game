/**
 * METRO RUSH - Complete Vanilla JS Endless Runner
 * Engine using HTML5 2D Canvas Pseudo-3D Perspective Projection
 */

(function() {
  'use strict';

  // --- AUDIO SYNTHESIZER (Web Audio API) ---
  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.enabled = true;
      this.musicEnabled = true;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    playTone(freq, type, duration, vol = 0.1) {
      if (!this.enabled || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {}
    }

    playCoin() {
      this.playTone(987.77, 'sine', 0.1, 0.15); // B5
      setTimeout(() => this.playTone(1318.51, 'sine', 0.15, 0.15), 60); // E6
    }

    playJump() {
      if (!this.enabled || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
      } catch (e) {}
    }

    playSlide() {
      this.playTone(120, 'sawtooth', 0.15, 0.08);
    }

    playPowerup() {
      [300, 400, 500, 700].forEach((freq, idx) => {
        setTimeout(() => this.playTone(freq, 'sine', 0.1, 0.12), idx * 50);
      });
    }

    playHit() {
      if (!this.enabled || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
      } catch(e) {}
    }

    playGameOver() {
      [200, 170, 140, 110].forEach((freq, idx) => {
        setTimeout(() => this.playTone(freq, 'sawtooth', 0.2, 0.15), idx * 120);
      });
    }
  }

  const audio = new AudioEngine();

  // --- STATE & CONFIG ---
  const CONFIG = {
    cameraHeight: 180,
    cameraFOV: 300,
    horizonYRatio: 0.42,
    laneWidth: 160,
    baseSpeed: 400,
    maxSpeed: 1100,
    accelRate: 3,
    gravity: 1800,
    jumpVelocity: 650,
    slideDuration: 0.8,
    invincibleTime: 1.5
  };

  const SETTINGS = {
    sound: true,
    music: true,
    vibrate: true,
    reducedFx: false
  };

  let canvas, ctx;
  let lastTime = 0;
  let gameTime = 0;
  let gameState = 'START'; // START, PLAYING, PAUSED, GAMEOVER

  let score = 0;
  let coins = 0;
  let distance = 0;
  let speed = CONFIG.baseSpeed;
  let lives = 3;
  let screenShakeTime = 0;

  // High Scores
  let bestScore = parseInt(localStorage.getItem('mr_best_score') || '0', 10);
  let bestCoins = parseInt(localStorage.getItem('mr_best_coins') || '0', 10);
  let bestDistance = parseInt(localStorage.getItem('mr_best_dist') || '0', 10);

  // Entities & World
  let player;
  let obstacles = [];
  let coinEntities = [];
  let powerupEntities = [];
  let particles = [];
  let stars = [];
  let buildings = [];

  let spawnTimer = 0;
  let coinSpawnTimer = 0;
  let powerupSpawnTimer = 0;

  // Active Powerups
  const activePowerups = {
    magnet: 0,
    shield: 0,
    scoreBoost: 0,
    speedBoost: 0
  };

  // --- INITIALIZATION ---
  window.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    loadSettings();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    setupControls();
    initStarsAndBuildings();
    resetGame();

    updateHighScoresUI();

    requestAnimationFrame(gameLoop);
  });

  function loadSettings() {
    SETTINGS.sound = localStorage.getItem('mr_s_sound') !== 'false';
    SETTINGS.music = localStorage.getItem('mr_s_music') !== 'false';
    SETTINGS.vibrate = localStorage.getItem('mr_s_vibrate') !== 'false';
    SETTINGS.reducedFx = localStorage.getItem('mr_s_reduced') === 'true';

    document.getElementById('setting-sound').checked = SETTINGS.sound;
    document.getElementById('setting-music').checked = SETTINGS.music;
    document.getElementById('setting-vibrate').checked = SETTINGS.vibrate;
    document.getElementById('setting-reduced-fx').checked = SETTINGS.reducedFx;

    audio.enabled = SETTINGS.sound;
    audio.musicEnabled = SETTINGS.music;
  }

  function saveSettings() {
    SETTINGS.sound = document.getElementById('setting-sound').checked;
    SETTINGS.music = document.getElementById('setting-music').checked;
    SETTINGS.vibrate = document.getElementById('setting-vibrate').checked;
    SETTINGS.reducedFx = document.getElementById('setting-reduced-fx').checked;

    localStorage.setItem('mr_s_sound', SETTINGS.sound);
    localStorage.setItem('mr_s_music', SETTINGS.music);
    localStorage.setItem('mr_s_vibrate', SETTINGS.vibrate);
    localStorage.setItem('mr_s_reduced', SETTINGS.reducedFx);

    audio.enabled = SETTINGS.sound;
    audio.musicEnabled = SETTINGS.music;
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
  }

  function updateHighScoresUI() {
    document.getElementById('start-best-score').textContent = bestScore;
  }

  // --- PLAYER CLASS ---
  class Player {
    constructor() {
      this.currentLane = 0; // -1: Left, 0: Center, 1: Right
      this.targetLane = 0;
      this.x = 0; // Relative to current lane center offset
      this.y = 0; // Height offset for jump
      this.vy = 0;
      
      this.isGrounded = true;
      this.isSliding = false;
      this.slideTimer = 0;
      
      this.invincibleTimer = 0;
      this.runAnimTime = 0;

      // Rendering Dimensions
      this.width = 40;
      this.height = 70;
    }

    reset() {
      this.currentLane = 0;
      this.targetLane = 0;
      this.x = 0;
      this.y = 0;
      this.vy = 0;
      this.isGrounded = true;
      this.isSliding = false;
      this.slideTimer = 0;
      this.invincibleTimer = 0;
    }

    moveLeft() {
      if (this.targetLane > -1) {
        this.targetLane--;
      }
    }

    moveRight() {
      if (this.targetLane < 1) {
        this.targetLane++;
      }
    }

    jump() {
      if (this.isGrounded) {
        this.vy = CONFIG.jumpVelocity;
        this.isGrounded = false;
        this.isSliding = false;
        audio.playJump();
      }
    }

    slide() {
      if (this.isGrounded && !this.isSliding) {
        this.isSliding = true;
        this.slideTimer = CONFIG.slideDuration;
        audio.playSlide();
      }
    }

    update(dt) {
      // Smooth Lane Switching
      const targetX = this.targetLane * CONFIG.laneWidth;
      this.x += (targetX - this.x) * 15 * dt;

      // Jump & Gravity
      if (!this.isGrounded) {
        this.y += this.vy * dt;
        this.vy -= CONFIG.gravity * dt;
        if (this.y <= 0) {
          this.y = 0;
          this.vy = 0;
          this.isGrounded = true;
        }
      }

      // Slide Timer
      if (this.isSliding) {
        this.slideTimer -= dt;
        if (this.slideTimer <= 0) {
          this.isSliding = false;
        }
      }

      // Invincibility
      if (this.invincibleTimer > 0) {
        this.invincibleTimer -= dt;
      }

      this.runAnimTime += dt * (speed / 100);
    }

    draw(ctx, screenX, screenY, scale) {
      if (this.invincibleTimer > 0 && Math.floor(Date.now() / 100) % 2 === 0) {
        return; // Flash effect during invincibility
      }

      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.scale(scale, scale);

      const pH = this.isSliding ? this.height * 0.5 : this.height;
      const pW = this.width;

      // Player Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 0, pW * 0.6, pW * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();

      // Shield Aura
      if (activePowerups.shield > 0) {
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, -pH / 2, pW * 0.9, pH * 0.7, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Body / Suit
      const legOffset = Math.sin(this.runAnimTime * 10) * (this.isGrounded && !this.isSliding ? 12 : 0);

      // Legs
      ctx.fillStyle = '#0a1026';
      ctx.fillRect(-pW * 0.35, -pH * 0.4 + legOffset, 10, pH * 0.4);
      ctx.fillRect(pW * 0.1, -pH * 0.4 - legOffset, 10, pH * 0.4);

      // Shoes (Neon soles)
      ctx.fillStyle = '#00f3ff';
      ctx.fillRect(-pW * 0.35 - 2, -4 + legOffset, 12, 4);
      ctx.fillRect(pW * 0.1 - 2, -4 - legOffset, 12, 4);

      // Torso / Jacket
      ctx.fillStyle = '#1a0033';
      ctx.fillRect(-pW / 2, -pH * 0.8, pW, pH * 0.45);

      ctx.fillStyle = '#ff00ff'; // Neon Trims
      ctx.fillRect(-pW / 2 - 2, -pH * 0.75, 3, pH * 0.35);
      ctx.fillRect(pW / 2 - 1, -pH * 0.75, 3, pH * 0.35);

      // Cyber Backpack
      ctx.fillStyle = '#00f3ff';
      ctx.fillRect(-pW * 0.25, -pH * 0.75, pW * 0.5, pH * 0.3);

      // Head & Helmet Visor
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(0, -pH * 0.9, 14, 0, Math.PI * 2);
      ctx.fill();

      // Visor Glow
      ctx.fillStyle = '#00f3ff';
      ctx.shadowColor = '#00f3ff';
      ctx.shadowBlur = 10;
      ctx.fillRect(-8, -pH * 0.9 - 4, 16, 6);
      ctx.shadowBlur = 0;

      ctx.restore();
    }
  }

  // --- BACKGROUND & WORLD ---
  function initStarsAndBuildings() {
    stars = [];
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random() * CONFIG.horizonYRatio,
        size: Math.random() * 2,
        alpha: Math.random()
      });
    }

    buildings = [];
    const count = 16;
    for (let i = 0; i < count; i++) {
      buildings.push({
        x: (i / count) * 2 - 1, // Normalized [-1, 1]
        width: 0.12 + Math.random() * 0.08,
        height: 0.2 + Math.random() * 0.25,
        color: ['#090514', '#0d0722', '#050a1a'][Math.floor(Math.random() * 3)],
        neonColor: ['#00f3ff', '#ff00ff', '#0066ff'][Math.floor(Math.random() * 3)]
      });
    }
  }

  function drawEnvironment(ctx, dt) {
    const w = canvas.width;
    const h = canvas.height;
    const horizonY = h * CONFIG.horizonYRatio;

    // Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGrad.addColorStop(0, '#03020a');
    skyGrad.addColorStop(0.7, '#0f0826');
    skyGrad.addColorStop(1, '#2a0845');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, horizonY);

    // Stars
    ctx.fillStyle = '#fff';
    stars.forEach(star => {
      ctx.globalAlpha = star.alpha;
      ctx.fillRect(star.x * w, star.y * h, star.size, star.size);
    });
    ctx.globalAlpha = 1.0;

    // Cyber Moon
    ctx.save();
    ctx.fillStyle = '#ff00aa';
    ctx.shadowColor = '#ff00aa';
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(w * 0.8, horizonY * 0.4, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Skyline Buildings
    buildings.forEach(b => {
      const bx = (b.x + 1) * 0.5 * w;
      const bw = b.width * w;
      const bh = b.height * h;
      const by = horizonY - bh;

      ctx.fillStyle = b.color;
      ctx.fillRect(bx, by, bw, bh);

      // Neon Top Edge
      ctx.fillStyle = b.neonColor;
      ctx.fillRect(bx, by, bw, 2);

      // Random glowing windows
      ctx.fillStyle = b.neonColor;
      ctx.globalAlpha = 0.15;
      for (let wx = bx + 5; wx < bx + bw - 5; wx += 12) {
        for (let wy = by + 10; wy < horizonY - 10; wy += 20) {
          if (Math.sin(wx + wy) > 0.2) {
            ctx.fillRect(wx, wy, 6, 10);
          }
        }
      }
      ctx.globalAlpha = 1.0;
    });

    // Atmospheric Horizon Fog
    const fogGrad = ctx.createLinearGradient(0, horizonY - 40, 0, horizonY + 20);
    fogGrad.addColorStop(0, 'rgba(42, 8, 69, 0)');
    fogGrad.addColorStop(0.8, '#ff00aa');
    fogGrad.addColorStop(1, 'rgba(3, 3, 12, 1)');
    ctx.fillStyle = fogGrad;
    ctx.fillRect(0, horizonY - 40, w, 60);
  }

  // --- PERSPECTIVE TRACK DRAWING ---
  function project3D(x3d, z3d, cameraZ) {
    const relZ = z3d - cameraZ;
    if (relZ <= 10) return null; // Behind camera

    const fov = CONFIG.cameraFOV;
    const scale = fov / relZ;
    const screenX = canvas.width / 2 + x3d * scale;
    const screenY = canvas.height * CONFIG.horizonYRatio + CONFIG.cameraHeight * scale;

    return { x: screenX, y: screenY, scale: scale };
  }

  function drawTrack(ctx, cameraZ) {
    const w = canvas.width;
    const h = canvas.height;
    const horizonY = h * CONFIG.horizonYRatio;

    // Track Ground Plane
    const groundGrad = ctx.createLinearGradient(0, horizonY, 0, h);
    groundGrad.addColorStop(0, '#050714');
    groundGrad.addColorStop(1, '#020308');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, horizonY, w, h - horizonY);

    // Draw Perspective Lanes (-1.5 to 1.5 lane borders)
    const maxZ = cameraZ + 2500;
    const laneBorders = [-1.5, -0.5, 0.5, 1.5];

    ctx.lineWidth = 2;
    laneBorders.forEach((border) => {
      const pNear = project3D(border * CONFIG.laneWidth, cameraZ + 50, cameraZ);
      const pFar = project3D(border * CONFIG.laneWidth, maxZ, cameraZ);

      if (pNear && pFar) {
        ctx.strokeStyle = (border === -1.5 || border === 1.5) ? '#00f3ff' : 'rgba(0, 243, 255, 0.25)';
        ctx.shadowColor = '#00f3ff';
        ctx.shadowBlur = (border === -1.5 || border === 1.5) ? 8 : 0;
        ctx.beginPath();
        ctx.moveTo(pNear.x, pNear.y);
        ctx.lineTo(pFar.x, pFar.y);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    });

    // Moving Floor Speed Markers
    const gridStep = 200;
    const startZ = Math.floor(cameraZ / gridStep) * gridStep;
    ctx.strokeStyle = 'rgba(255, 0, 255, 0.3)';
    ctx.lineWidth = 1.5;

    for (let z = startZ; z < startZ + 2400; z += gridStep) {
      const pLeft = project3D(-1.5 * CONFIG.laneWidth, z, cameraZ);
      const pRight = project3D(1.5 * CONFIG.laneWidth, z, cameraZ);

      if (pLeft && pRight) {
        ctx.beginPath();
        ctx.moveTo(pLeft.x, pLeft.y);
        ctx.lineTo(pRight.x, pRight.y);
        ctx.stroke();
      }
    }
  }

  // --- OBSTACLES & COINS ---
  class Obstacle {
    constructor(z, lane, type) {
      this.z = z;
      this.lane = lane; // -1, 0, 1
      this.type = type; // TRAIN, BARRIER, OVERHEAD, BLOCK
      this.active = true;
    }

    draw(ctx, cameraZ) {
      const x3d = this.lane * CONFIG.laneWidth;
      const p = project3D(x3d, this.z, cameraZ);
      if (!p) return;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(p.scale, p.scale);

      if (this.type === 'TRAIN') {
        // High, long Metro Train
        ctx.fillStyle = '#11162b';
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 3;

        ctx.fillRect(-65, -180, 130, 180);
        ctx.strokeRect(-65, -180, 130, 180);

        // Windshield
        ctx.fillStyle = '#00f3ff';
        ctx.fillRect(-50, -160, 100, 45);

        // Lights
        ctx.fillStyle = '#ffff00';
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(-40, -20, 10, 0, Math.PI * 2);
        ctx.arc(40, -20, 10, 0, Math.PI * 2);
        ctx.fill();

      } else if (this.type === 'BARRIER') {
        // Road Jump Barrier
        ctx.fillStyle = '#ff0055';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;

        ctx.fillRect(-60, -50, 120, 50);
        ctx.strokeRect(-60, -50, 120, 50);

        // Stripes
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(-40, 0); ctx.lineTo(-20, -50); ctx.lineTo(-10, -50); ctx.lineTo(-30, 0);
        ctx.moveTo(10, 0); ctx.lineTo(30, -50); ctx.lineTo(40, -50); ctx.lineTo(20, 0);
        ctx.fill();

      } else if (this.type === 'OVERHEAD') {
        // Overhead Slide Barrier
        ctx.fillStyle = '#ffaa00';
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 8;

        // Support Poles
        ctx.fillRect(-70, -160, 12, 160);
        ctx.fillRect(58, -160, 12, 160);

        // Overhead Sign Beam
        ctx.fillRect(-70, -160, 140, 70);
        ctx.fillStyle = '#000';
        ctx.fillRect(-60, -150, 120, 50);

        ctx.fillStyle = '#ffaa00';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('SLIDE', -30, -118);

      } else if (this.type === 'BLOCK') {
        // Low Neon Concrete Block
        ctx.fillStyle = '#220033';
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 3;
        ctx.fillRect(-50, -40, 100, 40);
        ctx.strokeRect(-50, -40, 100, 40);
      }

      ctx.restore();
    }
  }

  class Collectible {
    constructor(z, lane, isPowerup = false, type = 'COIN') {
      this.z = z;
      this.lane = lane;
      this.isPowerup = isPowerup;
      this.type = type; // COIN, MAGNET, SHIELD, SCORE_BOOST, SPEED_BOOST
      this.active = true;
      this.rotation = Math.random() * Math.PI * 2;
    }

    update(dt, playerZ) {
      this.rotation += dt * 4;

      // Magnet Pull Effect
      if (activePowerups.magnet > 0 && !this.isPowerup) {
        const distZ = this.z - playerZ;
        if (distZ > 0 && distZ < 600) {
          this.z -= (distZ * 6 * dt);
          const targetX = player.targetLane;
          this.lane += (targetX - this.lane) * 8 * dt;
        }
      }
    }

    draw(ctx, cameraZ) {
      const x3d = this.lane * CONFIG.laneWidth;
      const p = project3D(x3d, this.z, cameraZ);
      if (!p) return;

      ctx.save();
      ctx.translate(p.x, p.y - 30 * p.scale);
      ctx.scale(p.scale, p.scale);

      if (!this.isPowerup) {
        // Neon Gold Coin
        ctx.rotate(this.rotation);
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.ellipse(0, 0, 16 * Math.abs(Math.sin(this.rotation)), 16, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Powerup Orb
        const colors = {
          MAGNET: '#ff0055',
          SHIELD: '#00f3ff',
          SCORE_BOOST: '#ff00ff',
          SPEED_BOOST: '#00ff66'
        };

        ctx.fillStyle = colors[this.type] || '#fff';
        ctx.shadowColor = colors[this.type] || '#fff';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.type[0], 0, 0);
      }

      ctx.restore();
    }
  }

  // --- PARTICLES & VISUAL EFFECTS ---
  class Particle {
    constructor(x, y, color) {
      this.x = x;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 400;
      this.vy = (Math.random() - 0.5) * 400;
      this.color = color;
      this.life = 0.4 + Math.random() * 0.3;
      this.maxLife = this.life;
      this.size = 3 + Math.random() * 5;
    }

    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.life -= dt;
    }

    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function spawnSparkles(x, y, color, count = 12) {
    if (SETTINGS.reducedFx) return;
    for (let i = 0; i < count; i++) {
      particles.push(new Particle(x, y, color));
    }
  }

  function triggerScreenShake() {
    if (SETTINGS.reducedFx) return;
    screenShakeTime = 0.3;
    if (SETTINGS.vibrate && navigator.vibrate) {
      navigator.vibrate(200);
    }
  }

  // --- SPAWNING LOGIC ---
  function updateSpawning(dt, cameraZ) {
    spawnTimer += dt;
    coinSpawnTimer += dt;
    powerupSpawnTimer += dt;

    // Obstacle Spawning
    const spawnRate = Math.max(0.7, 2.2 - (speed / 600));
    if (spawnTimer >= spawnRate) {
      spawnTimer = 0;
      const z = cameraZ + 2200;
      const lane = Math.floor(Math.random() * 3) - 1;
      const types = ['TRAIN', 'BARRIER', 'OVERHEAD', 'BLOCK'];
      const type = types[Math.floor(Math.random() * types.length)];

      obstacles.push(new Obstacle(z, lane, type));
    }

    // Coin Chains
    if (coinSpawnTimer >= 1.2) {
      coinSpawnTimer = 0;
      const lane = Math.floor(Math.random() * 3) - 1;
      const startZ = cameraZ + 2000;
      for (let i = 0; i < 5; i++) {
        coinEntities.push(new Collectible(startZ + i * 80, lane, false, 'COIN'));
      }
    }

    // Powerup Spawning
    if (powerupSpawnTimer >= 12) {
      powerupSpawnTimer = 0;
      const lane = Math.floor(Math.random() * 3) - 1;
      const types = ['MAGNET', 'SHIELD', 'SCORE_BOOST', 'SPEED_BOOST'];
      const type = types[Math.floor(Math.random() * types.length)];
      powerupEntities.push(new Collectible(cameraZ + 2200, lane, true, type));
    }
  }

  // --- COLLISION DETECTION ---
  function checkCollisions(cameraZ) {
    const playerZ = cameraZ + 200; // Fixed player Z projection offset
    const playerLane = player.targetLane;

    // 1. Obstacle Collision
    obstacles.forEach(obs => {
      if (!obs.active) return;
      
      const distZ = Math.abs(obs.z - playerZ);
      if (distZ < 60 && obs.lane === playerLane) {

        // Check if avoided by Jump or Slide
        let pass = false;
        if (obs.type === 'BARRIER' && player.y > 40) pass = true;
        if (obs.type === 'OVERHEAD' && player.isSliding) pass = true;

        if (!pass) {
          obs.active = false;
          handleHit();
        }
      }
    });

    // 2. Coin Collection
    coinEntities.forEach(coin => {
      if (!coin.active) return;
      const distZ = Math.abs(coin.z - playerZ);

      if (distZ < 50 && Math.abs(coin.lane - player.x / CONFIG.laneWidth) < 0.5) {
        coin.active = false;
        coins += 1;
        const multiplier = activePowerups.scoreBoost > 0 ? 2 : 1;
        score += 50 * multiplier;
        audio.playCoin();

        const p = project3D(player.x, playerZ, cameraZ);
        if (p) spawnSparkles(p.x, p.y - 20, '#ffd700', 8);
      }
    });

    // 3. Powerup Collection
    powerupEntities.forEach(pw => {
      if (!pw.active) return;
      const distZ = Math.abs(pw.z - playerZ);

      if (distZ < 50 && Math.abs(pw.lane - player.x / CONFIG.laneWidth) < 0.5) {
        pw.active = false;
        audio.playPowerup();

        if (pw.type === 'MAGNET') activePowerups.magnet = 10;
        if (pw.type === 'SHIELD') activePowerups.shield = 1; // Shield is hit-based or timed
        if (pw.type === 'SCORE_BOOST') activePowerups.scoreBoost = 12;
        if (pw.type === 'SPEED_BOOST') activePowerups.speedBoost = 8;

        const p = project3D(player.x, playerZ, cameraZ);
        if (p) spawnSparkles(p.x, p.y - 20, '#00f3ff', 15);
      }
    });
  }

  function handleHit() {
    if (player.invincibleTimer > 0) return;

    if (activePowerups.shield > 0) {
      activePowerups.shield = 0;
      player.invincibleTimer = CONFIG.invincibleTime;
      triggerScreenShake();
      audio.playHit();
      return;
    }

    lives--;
    triggerScreenShake();
    audio.playHit();

    player.invincibleTimer = CONFIG.invincibleTime;

    if (lives <= 0) {
      gameOver();
    }
  }

  // --- CONTROLS SYSTEM ---
  function setupControls() {
    // Keyboard
    window.addEventListener('keydown', (e) => {
      if (gameState !== 'PLAYING') return;

      switch(e.key) {
        case 'ArrowLeft': case 'a': case 'A': player.moveLeft(); break;
        case 'ArrowRight': case 'd': case 'D': player.moveRight(); break;
        case 'ArrowUp': case 'w': case 'W': case ' ': player.jump(); break;
        case 'ArrowDown': case 's': case 'S': player.slide(); break;
        case 'p': case 'P': case 'Escape': togglePause(); break;
      }
    });

    // Mobile Swipe Gestures
    let touchStartX = 0;
    let touchStartY = 0;

    canvas.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    canvas.addEventListener('touchend', (e) => {
      if (gameState !== 'PLAYING') return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;

      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 30) player.moveRight();
        else if (dx < -30) player.moveLeft();
      } else {
        if (dy < -30) player.jump();
        else if (dy > 30) player.slide();
      }
    }, { passive: true });

    // Touch Buttons
    document.getElementById('btn-left').onclick = () => player.moveLeft();
    document.getElementById('btn-right').onclick = () => player.moveRight();
    document.getElementById('btn-jump').onclick = () => player.jump();
    document.getElementById('btn-slide').onclick = () => player.slide();

    // UI Buttons
    document.getElementById('start-btn').onclick = () => { audio.init(); startGame(); };
    document.getElementById('pause-btn').onclick = () => togglePause();
    document.getElementById('resume-btn').onclick = () => togglePause();
    document.getElementById('restart-btn').onclick = () => { togglePause(); resetGame(); startGame(); };
    document.getElementById('retry-btn').onclick = () => { hideScreens(); startGame(); };
    
    document.getElementById('main-menu-btn').onclick = () => { hideScreens(); showStartScreen(); };
    document.getElementById('over-main-menu-btn').onclick = () => { hideScreens(); showStartScreen(); };

    // Modals
    document.getElementById('how-to-btn').onclick = () => document.getElementById('how-to-modal').classList.remove('hidden');
    document.getElementById('close-how-to').onclick = () => document.getElementById('how-to-modal').classList.add('hidden');

    document.getElementById('settings-btn').onclick = () => document.getElementById('settings-modal').classList.remove('hidden');
    document.getElementById('close-settings').onclick = () => {
      saveSettings();
      document.getElementById('settings-modal').classList.add('hidden');
    };
  }

  // --- GAME FLOW STATE MANAGERS ---
  function resetGame() {
    score = 0;
    coins = 0;
    distance = 0;
    speed = CONFIG.baseSpeed;
    lives = 3;
    gameTime = 0;

    obstacles = [];
    coinEntities = [];
    powerupEntities = [];
    particles = [];

    activePowerups.magnet = 0;
    activePowerups.shield = 0;
    activePowerups.scoreBoost = 0;
    activePowerups.speedBoost = 0;

    player = new Player();
  }

  function startGame() {
    resetGame();
    gameState = 'PLAYING';
    hideScreens();
    document.getElementById('hud').classList.remove('hidden');
    if ('ontouchstart' in window) {
      document.getElementById('mobile-controls').classList.remove('hidden');
    }
  }

  function togglePause() {
    if (gameState === 'PLAYING') {
      gameState = 'PAUSED';
      document.getElementById('pause-screen').classList.remove('hidden');
    } else if (gameState === 'PAUSED') {
      gameState = 'PLAYING';
      document.getElementById('pause-screen').classList.add('hidden');
    }
  }

  function gameOver() {
    gameState = 'GAMEOVER';
    audio.playGameOver();

    // Save Highscores
    if (score > bestScore) { bestScore = score; localStorage.setItem('mr_best_score', bestScore); }
    if (coins > bestCoins) { bestCoins = coins; localStorage.setItem('mr_best_coins', bestCoins); }
    if (distance > bestDistance) { bestDistance = Math.floor(distance); localStorage.setItem('mr_best_dist', bestDistance); }

    updateHighScoresUI();

    document.getElementById('final-score').textContent = Math.floor(score).toString().padStart(6, '0');
    document.getElementById('final-coins').textContent = coins;
    document.getElementById('final-distance').textContent = `${Math.floor(distance)} m`;
    document.getElementById('final-best').textContent = bestScore.toString().padStart(6, '0');

    document.getElementById('hud').classList.add('hidden');
    document.getElementById('mobile-controls').classList.add('hidden');
    document.getElementById('game-over-screen').classList.remove('hidden');
  }

  function hideScreens() {
    document.querySelectorAll('.overlay-screen').forEach(s => s.classList.add('hidden'));
  }

  function showStartScreen() {
    gameState = 'START';
    hideScreens();
    document.getElementById('start-screen').classList.remove('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('mobile-controls').classList.add('hidden');
  }

  // --- MAIN GAME LOOP ---
  function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1); // Cap delta time
    lastTime = timestamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'PLAYING') {
      gameTime += dt;

      // Speed Progression
      const currentMaxSpeed = activePowerups.speedBoost > 0 ? CONFIG.maxSpeed * 1.3 : CONFIG.maxSpeed;
      if (speed < currentMaxSpeed) {
        speed += CONFIG.accelRate * dt * 10;
      }

      distance += (speed * dt) / 10;
      const scoreMult = activePowerups.scoreBoost > 0 ? 2 : 1;
      score += (speed * dt * 0.1) * scoreMult;

      // Update Powerups
      Object.keys(activePowerups).forEach(pw => {
        if (activePowerups[pw] > 0 && pw !== 'shield') {
          activePowerups[pw] -= dt;
        }
      });

      player.update(dt);

      const cameraZ = gameTime * speed;

      updateSpawning(dt, cameraZ);
      checkCollisions(cameraZ);

      // Clean Out-of-Bound Entities
      obstacles = obstacles.filter(o => o.z > cameraZ - 100 && o.active);
      coinEntities = coinEntities.filter(c => c.z > cameraZ - 100 && c.active);
      powerupEntities = powerupEntities.filter(p => p.z > cameraZ - 100 && p.active);

      // Collectibles update (Magnet)
      coinEntities.forEach(c => c.update(dt, cameraZ + 200));

      updateHUD();
    }

    // --- RENDER SECTION ---
    const cameraZ = gameTime * speed;

    // Apply Screen Shake
    ctx.save();
    if (screenShakeTime > 0) {
      screenShakeTime -= dt;
      const shakeX = (Math.random() - 0.5) * 15;
      const shakeY = (Math.random() - 0.5) * 15;
      ctx.translate(shakeX, shakeY);
    }

    drawEnvironment(ctx, dt);
    drawTrack(ctx, cameraZ);

    // Draw Entities (Sorted from far to near)
    const renderList = [
      ...obstacles,
      ...coinEntities,
      ...powerupEntities
    ].sort((a, b) => b.z - a.z);

    renderList.forEach(item => item.draw(ctx, cameraZ));

    // Render Player
    const playerZ = cameraZ + 200;
    const playerProj = project3D(player.x, playerZ - player.y * 1.5, cameraZ);
    if (playerProj) {
      player.draw(ctx, playerProj.x, playerProj.y, playerProj.scale);
    }

    // Render Particle Systems
    particles.forEach((p, idx) => {
      p.update(dt);
      p.draw(ctx);
      if (p.life <= 0) particles.splice(idx, 1);
    });

    ctx.restore();

    requestAnimationFrame(gameLoop);
  }

  function updateHUD() {
    document.getElementById('score-val').textContent = Math.floor(score).toString().padStart(6, '0');
    document.getElementById('coins-val').textContent = coins.toString().padStart(3, '0');
    document.getElementById('distance-val').textContent = `${Math.floor(distance)}m`;
    document.getElementById('speed-val').textContent = `x${(speed / CONFIG.baseSpeed).toFixed(1)}`;

    // Lives Display
    const hearts = '❤️'.repeat(Math.max(0, lives));
    document.getElementById('lives-display').textContent = hearts || '💀';

    // Powerup Indicators
    const pwContainer = document.getElementById('powerup-bar');
    pwContainer.innerHTML = '';
    Object.keys(activePowerups).forEach(pw => {
      if (activePowerups[pw] > 0) {
        const div = document.createElement('div');
        div.className = 'powerup-indicator';
        div.innerHTML = `
          <span>${pw.toUpperCase()}</span>
          <div class="powerup-progress" style="width: ${(activePowerups[pw] / 10) * 100}%"></div>
        `;
        pwContainer.appendChild(div);
      }
    });
  }

})();