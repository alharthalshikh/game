/* ═══════════════════════════════════════════
   ساحة المعركة - Game Engine
   Main game loop, state management, collision
   ═══════════════════════════════════════════ */
window.BA = window.BA || {};

BA.STATE = {
    MENU: 'menu',
    LOBBY: 'lobby',
    PREP: 'prep',
    PLAYING: 'playing',
    GAME_OVER: 'gameOver'
};

BA.MODE = {
    FFA: 'ffa',
    TEAM: 'team'
};

BA.PREP_TIME = 15; // seconds
BA.GAME_TIME = 300; // 5 minutes
BA.MIN_PLAYERS = 2;
BA.MAX_PLAYERS = 20;

BA.Engine = class Engine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.state = BA.STATE.MENU;
        this.gameMode = BA.MODE.FFA;
        this.selectedMap = 'farm';

        // Game objects
        this.map = null;
        this.players = new Map();
        this.bullets = [];
        this.effects = [];
        this.localPlayer = null;
        this.localPlayerId = 'local_' + Math.random().toString(36).substr(2, 6);
        this.baseSpawn1 = null;
        this.baseSpawn2 = null;

        // Camera
        this.camera = { x: 0, y: 0 };

        // Timers
        this.prepTimer = 0;
        this.gameTimer = 0;
        this.prepSeconds = BA.PREP_TIME;

        // Systems
        this.controls = null;
        this.renderer = null;

        // Callbacks
        this.onStateChange = null;
        this.onGameOver = null;
        this.onPlayerKill = null;
        this.onBulletFired = null;

        // Sound
        this.audioCtx = null;
        this._initAudio();

        // Game loop
        this._running = false;
        this._rafId = null;
        this._lastTime = 0;
        this._accumulator = 0;
        this._tickRate = 1000 / 60; // 60 fps

    }

    _initAudio() {
        try {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Audio not available');
        }
    }

    _playSound(type) {
        if (!this.audioCtx) return;
        try {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            switch (type) {
                case 'shoot':
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(200, this.audioCtx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(50, this.audioCtx.currentTime + 0.1);
                    gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.1);
                    osc.start();
                    osc.stop(this.audioCtx.currentTime + 0.1);
                    break;
                case 'hit':
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(400, this.audioCtx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(100, this.audioCtx.currentTime + 0.15);
                    gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.15);
                    osc.start();
                    osc.stop(this.audioCtx.currentTime + 0.15);
                    break;
                case 'death':
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(300, this.audioCtx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(30, this.audioCtx.currentTime + 0.5);
                    gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.5);
                    osc.start();
                    osc.stop(this.audioCtx.currentTime + 0.5);
                    break;
                case 'siren':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(500, this.audioCtx.currentTime);
                    osc.frequency.linearRampToValueAtTime(800, this.audioCtx.currentTime + 0.5);
                    osc.frequency.linearRampToValueAtTime(500, this.audioCtx.currentTime + 1);
                    gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 1.5);
                    osc.start();
                    osc.stop(this.audioCtx.currentTime + 1.5);
                    break;
                case 'countdown':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(600, this.audioCtx.currentTime);
                    gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.15);
                    osc.start();
                    osc.stop(this.audioCtx.currentTime + 0.15);
                    break;
            }
        } catch (e) { /* ignore audio errors */ }
    }

    init() {
        // Setup canvas size
        this._resizeCanvas();
        window.addEventListener('resize', () => this._resizeCanvas());

        // Create map
        this.map = new BA.GameMap(this.selectedMap || 'farm');

        // Create renderer
        this.renderer = new BA.Renderer(this.canvas, this.ctx);

        // Create controls
        this.controls = new BA.Controls(this.canvas);
    }

    _resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    setState(newState) {
        const oldState = this.state;
        this.state = newState;
        if (this.onStateChange) this.onStateChange(newState, oldState);
    }

    findWalkableSpotNear(baseX, baseY, index) {
        const offsets = [
            { dx: 0, dy: 0 },
            { dx: -35, dy: 0 },
            { dx: 35, dy: 0 },
            { dx: 0, dy: -35 },
            { dx: 0, dy: 35 },
            { dx: -35, dy: -35 },
            { dx: 35, dy: -35 },
            { dx: -35, dy: 35 },
            { dx: 35, dy: 35 },
            { dx: -70, dy: 0 },
            { dx: 70, dy: 0 },
            { dx: 0, dy: -70 },
            { dx: 0, dy: 70 },
            { dx: -70, dy: -70 },
            { dx: 70, dy: -70 },
            { dx: -70, dy: 70 },
            { dx: 70, dy: 70 }
        ];

        // Attempt to place in the preferred grid offset first
        if (index < offsets.length) {
            const offset = offsets[index];
            const targetX = baseX + offset.dx;
            const targetY = baseY + offset.dy;
            if (this.map && this.map.isWalkable(targetX, targetY, BA.PLAYER_RADIUS)) {
                return { x: targetX, y: targetY };
            }
        }

        // If preferred offset is blocked, search sequentially through all offsets
        for (const offset of offsets) {
            const targetX = baseX + offset.dx;
            const targetY = baseY + offset.dy;
            if (this.map && this.map.isWalkable(targetX, targetY, BA.PLAYER_RADIUS)) {
                return { x: targetX, y: targetY };
            }
        }

        // Spiral search as a robust fallback
        for (let r = 20; r < 160; r += 20) {
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
                const targetX = baseX + Math.cos(angle) * r;
                const targetY = baseY + Math.sin(angle) * r;
                if (this.map && this.map.isWalkable(targetX, targetY, BA.PLAYER_RADIUS)) {
                    return { x: targetX, y: targetY };
                }
            }
        }

        return { x: baseX, y: baseY };
    }

    startGame(mode, playerInfos) {
        this.gameMode = mode;
        this.players.clear();
        this.bullets = [];
        this.effects = [];

        // Generate fresh map
        this.map = new BA.GameMap(this.selectedMap || 'farm');
        const spawns = this.map.getSpawnPoints();

        // Sort spawn points first to ensure identical base order across all peers
        spawns.sort((a, b) => {
            if (a.x !== b.x) return a.x - b.x;
            return a.y - b.y;
        });

        // Generate a deterministic seed from the players list
        let seed = 0;
        for (const info of playerInfos) {
            const idStr = String(info.id || '');
            for (let i = 0; i < idStr.length; i++) {
                seed += idStr.charCodeAt(i);
            }
        }

        // Seed-based pseudo-random number generator
        const pseudoRandom = () => {
            const x = Math.sin(seed++) * 10000;
            return x - Math.floor(x);
        };

        // Create players and assign spawns
        let spawnIdx = 0;
        if (mode === BA.MODE.TEAM) {
            const mapWidth = this.map.width;
            const leftSpawns = spawns.filter(sp => sp.x < mapWidth / 2);
            const rightSpawns = spawns.filter(sp => sp.x >= mapWidth / 2);

            // Select one single base spawn point for Team 1 and one for Team 2 deterministically
            this.baseSpawn1 = leftSpawns[Math.floor(pseudoRandom() * leftSpawns.length)] || spawns[0];
            this.baseSpawn2 = rightSpawns[Math.floor(pseudoRandom() * rightSpawns.length)] || spawns[spawns.length - 1];

            let leftIdx = 0;
            let rightIdx = 0;

            for (const info of playerInfos) {
                let spawn;
                const team = Number(info.team) || 0;
                if (team === 1) {
                    // Team 1 (Red) spawns in a tight group around baseSpawn1
                    spawn = this.findWalkableSpotNear(this.baseSpawn1.x, this.baseSpawn1.y, leftIdx);
                    leftIdx++;
                } else if (team === 2) {
                    // Team 2 (Blue) spawns in a tight group around baseSpawn2
                    spawn = this.findWalkableSpotNear(this.baseSpawn2.x, this.baseSpawn2.y, rightIdx);
                    rightIdx++;
                } else {
                    // Fallback
                    spawn = spawns[Math.floor(pseudoRandom() * spawns.length)];
                }

                const player = new BA.Player(info.id, info.name, spawn.x, spawn.y, team);
                player.canShoot = false;
                this.players.set(info.id, player);

                if (info.id === this.localPlayerId) {
                    this.localPlayer = player;
                }
            }
        } else {
            // FFA mode: Deterministic shuffle of all spawns
            for (let i = spawns.length - 1; i > 0; i--) {
                const j = Math.floor(pseudoRandom() * (i + 1));
                [spawns[i], spawns[j]] = [spawns[j], spawns[i]];
            }

            for (const info of playerInfos) {
                const spawn = spawns[spawnIdx % spawns.length];
                spawnIdx++;
                const player = new BA.Player(info.id, info.name, spawn.x, spawn.y, info.team || 0);
                player.canShoot = false; // disabled during prep
                this.players.set(info.id, player);

                if (info.id === this.localPlayerId) {
                    this.localPlayer = player;
                }
            }
        }

        // If no local player found (shouldn't happen)
        if (!this.localPlayer) {
            const spawn = spawns[spawnIdx % spawns.length];
            this.localPlayer = new BA.Player(this.localPlayerId, 'أنت', spawn.x, spawn.y, 0);
            this.localPlayer.canShoot = false;
            this.players.set(this.localPlayerId, this.localPlayer);
        }

        // Camera to player
        this.camera.x = this.localPlayer.x;
        this.camera.y = this.localPlayer.y;

        // Start prep phase
        this.prepTimer = BA.PREP_TIME * 60; // convert to frames
        this.prepSeconds = BA.PREP_TIME;
        this.gameTimer = BA.GAME_TIME * 60;

        this.setState(BA.STATE.PREP);
        this._startLoop();

        // Show canvas
        this.canvas.classList.add('active');
    }

    _startLoop() {
        if (this._running) return;
        this._running = true;
        this._lastTime = performance.now();
        this._loop();
    }

    _stopLoop() {
        this._running = false;
        if (this._rafId) cancelAnimationFrame(this._rafId);
    }

    _loop() {
        if (!this._running) return;
        this._rafId = requestAnimationFrame(() => this._loop());

        const now = performance.now();
        const dt = now - this._lastTime;
        this._lastTime = now;
        this._accumulator += dt;

        // Fixed timestep updates
        while (this._accumulator >= this._tickRate) {
            this.update();
            this._accumulator -= this._tickRate;
        }

        this.render();
    }

    update() {
        if (this.state === BA.STATE.PREP) {
            this._updatePrep();
        } else if (this.state === BA.STATE.PLAYING) {
            this._updatePlaying();
        }
    }

    _updatePrep() {
        this.prepTimer--;

        const newSeconds = Math.ceil(this.prepTimer / 60);
        if (newSeconds !== this.prepSeconds && newSeconds > 0) {
            this.prepSeconds = newSeconds;
            this._playSound('countdown');
        }
        this.prepSeconds = newSeconds;

        // Allow movement but not shooting
        this._updateLocalPlayerMovement();
        this._updateCamera();

        if (this.prepTimer <= 0) {
            // START BATTLE!
            this.prepSeconds = 0;
            this._playSound('siren');
            this.setState(BA.STATE.PLAYING);

            // Enable shooting for all players
            for (const [, player] of this.players) {
                player.canShoot = true;
            }

            // Siren flash effect
            this._showSirenFlash();
        }
    }

    _updatePlaying() {
        this._updateLocalPlayerMovement();
        this._updateLocalPlayerShooting();
        this._updateBullets();
        this._updateEffects();
        this._updateRespawns();
        this._updateCamera();
        this._checkGameOver();
    }

    _updateLocalPlayerMovement() {
        if (!this.localPlayer || !this.localPlayer.alive) return;

        const move = this.controls.getMovement();
        const screenX = this.localPlayer.x - this.camera.x + this.canvas.width / 2;
        const screenY = this.localPlayer.y - this.camera.y + this.canvas.height / 2;
        const aimAngle = this.controls.getAimAngle(screenX, screenY);

        this.localPlayer.update(move.dx, move.dy, aimAngle, this.map);
    }

    _updateLocalPlayerShooting() {
        if (!this.localPlayer || !this.localPlayer.alive || !this.localPlayer.canShoot) return;

        if (this.controls.isFiring()) {
            const bullet = this.localPlayer.shoot();
            if (bullet) {
                this.bullets.push(bullet);
                this._playSound('shoot');
                if (this.onBulletFired) this.onBulletFired(bullet.serialize());
            }
        }
    }

    _updateBullets() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            const alive = bullet.update(this.map);

            if (!alive) {
                // Wall hit effect
                this.effects.push(new BA.Effect(bullet.x, bullet.y, 'spark'));
                this.bullets.splice(i, 1);
                continue;
            }

            // Check player collisions
            for (const [, player] of this.players) {
                if (!bullet.active) break;

                // Skip same team in team mode
                if (this.gameMode === BA.MODE.TEAM && bullet.team > 0 && bullet.team === player.team) continue;

                if (bullet.hitsPlayer(player)) {
                    const died = player.takeDamage(bullet.damage, bullet.ownerId);
                    bullet.active = false;

                    this._playSound('hit');
                    this.effects.push(new BA.Effect(player.x, player.y, 'blood'));

                    if (died) {
                        this._playSound('death');
                        // Credit kill
                        const killer = this.players.get(bullet.ownerId);
                        if (killer) {
                            killer.kills++;
                            if (this.onPlayerKill) {
                                this.onPlayerKill(killer.name, player.name);
                            }
                        }
                    }

                    this.bullets.splice(i, 1);
                    break;
                }
            }
        }
    }

    _updateEffects() {
        for (let i = this.effects.length - 1; i >= 0; i--) {
            if (!this.effects[i].update()) {
                this.effects.splice(i, 1);
            }
        }
    }

    _updateRespawns() {
        // Respawns disabled for Battle Royale
    }

    _updateCamera() {
        let targetPlayer = this.localPlayer;

        // Spectate mode: if local player is dead, follow any alive player
        if (targetPlayer && !targetPlayer.alive) {
            for (const [, p] of this.players) {
                if (p.alive) {
                    targetPlayer = p;
                    break;
                }
            }
        }

        if (!targetPlayer) return;

        // Smooth camera follow
        const targetX = targetPlayer.x;
        const targetY = targetPlayer.y;
        this.camera.x += (targetX - this.camera.x) * 0.1;
        this.camera.y += (targetY - this.camera.y) * 0.1;

        // Clamp to map bounds
        const halfW = this.canvas.width / 2;
        const halfH = this.canvas.height / 2;
        this.camera.x = Math.max(halfW, Math.min(this.map.width - halfW, this.camera.x));
        this.camera.y = Math.max(halfH, Math.min(this.map.height - halfH, this.camera.y));
    }

    _checkGameOver() {
        if (this.state !== BA.STATE.PLAYING) return;
        if (this.players.size < 2) return;

        if (this.gameMode === BA.MODE.TEAM) {
            let team1Alive = 0;
            let team2Alive = 0;
            for (const [, player] of this.players) {
                if (player.alive) {
                    if (player.team === 1) team1Alive++;
                    else if (player.team === 2) team2Alive++;
                }
            }

            if (team1Alive === 0 || team2Alive === 0) {
                const winningTeam = team1Alive > 0 ? 1 : 2;
                this._endGame({ type: 'team', team: winningTeam });
            }
        } else {
            // FFA: Last man standing
            let alivePlayers = [];
            for (const [, player] of this.players) {
                if (player.alive) {
                    alivePlayers.push(player);
                }
            }

            if (alivePlayers.length === 1) {
                this._endGame({ type: 'player', player: alivePlayers[0] });
            } else if (alivePlayers.length === 0) {
                this._endGame(null);
            }
        }
    }

    _endGame(customWinner) {
        this.setState(BA.STATE.GAME_OVER);
        this._stopLoop();

        // Determine winner
        let winnerInfo;
        if (customWinner) {
            if (customWinner.type === 'team') {
                winnerInfo = {
                    type: 'team',
                    team: customWinner.team,
                    teamName: customWinner.team === 1 ? 'الفريق الأحمر' : 'الفريق الأزرق',
                    score: 0
                };
            } else {
                winnerInfo = {
                    type: 'player',
                    name: customWinner.player.name,
                    kills: customWinner.player.kills,
                    isLocal: customWinner.player.id === this.localPlayerId
                };
            }
        } else {
            if (this.gameMode === BA.MODE.TEAM) {
                let team1Kills = 0, team2Kills = 0;
                for (const [, player] of this.players) {
                    if (player.team === 1) team1Kills += player.kills;
                    else if (player.team === 2) team2Kills += player.kills;
                }
                winnerInfo = {
                    type: 'team',
                    team: team1Kills >= team2Kills ? 1 : 2,
                    teamName: team1Kills >= team2Kills ? 'الفريق الأحمر' : 'الفريق الأزرق',
                    score: Math.max(team1Kills, team2Kills)
                };
            } else {
                // FFA: highest kills wins
                let topPlayer = null;
                let topKills = -1;
                for (const [, player] of this.players) {
                    if (player.kills > topKills) {
                        topKills = player.kills;
                        topPlayer = player;
                    }
                }
                winnerInfo = {
                    type: 'player',
                    name: topPlayer ? topPlayer.name : '???',
                    kills: topKills,
                    isLocal: topPlayer && topPlayer.id === this.localPlayerId
                };
            }
        }

        if (this.onGameOver) this.onGameOver(winnerInfo);
    }

    _showSirenFlash() {
        const flash = document.createElement('div');
        flash.className = 'siren-flash';
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 1500);
    }

    render() {
        if (!this.renderer || !this.localPlayer) return;

        this.renderer.render({
            map: this.map,
            players: this.players,
            bullets: this.bullets,
            localPlayer: this.localPlayer,
            camera: this.camera,
            effects: this.effects,
            controls: this.controls,
            prepPhase: this.state === BA.STATE.PREP,
            gameMode: this.gameMode
        });
    }

    getAliveCount() {
        let count = 0;
        for (const [, p] of this.players) {
            if (p.alive) count++;
        }
        return count;
    }

    getGameTimeRemaining() {
        return Math.max(0, Math.ceil(this.gameTimer / 60));
    }

    // Add a remote player
    addRemotePlayer(id, name, team) {
        let spawn;
        const parsedTeam = Number(team) || 0;
        if (this.gameMode === BA.MODE.TEAM && parsedTeam > 0) {
            const baseSpawn = parsedTeam === 1 ? this.baseSpawn1 : this.baseSpawn2;
            if (baseSpawn) {
                // Find how many players are already on this team to determine offset index
                let teamCount = 0;
                for (const [, p] of this.players) {
                    if (Number(p.team) === parsedTeam) teamCount++;
                }
                spawn = this.findWalkableSpotNear(baseSpawn.x, baseSpawn.y, teamCount);
            }
        }

        if (!spawn) {
            spawn = this.map.getRandomSpawn();
        }

        const player = new BA.Player(id, name, spawn.x, spawn.y, parsedTeam);
        this.players.set(id, player);
        return player;
    }

    removeRemotePlayer(id) {
        this.players.delete(id);
    }

    // Cleanup
    destroy() {
        this._stopLoop();
        if (this.controls) this.controls.destroy();
        this.canvas.classList.remove('active');
    }
};
