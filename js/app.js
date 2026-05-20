/* ═══════════════════════════════════════════
   ساحة المعركة - Main Application
   Entry point - connects all systems together
   ═══════════════════════════════════════════ */
window.BA = window.BA || {};

BA.App = class App {
    constructor() {
        this.engine = null;
        this.screens = null;
        this.hud = null;
        this.peerManager = null;
        this.gameSync = null;

        this.playerName = 'مقاتل';
        this.gameMode = BA.MODE.FFA;
        this.selectedMap = 'farm';
        this.isOnline = true;
        this.isHost = false;
        this.currentRoomCode = '';

        // Lobby players (for offline/solo play)
        this.lobbyPlayers = [];
    }

    init() {
        console.log('⚔️ ساحة المعركة - Initializing...');

        // Get canvas
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) {
            console.error('Canvas not found!');
            return;
        }

        // Create engine
        this.engine = new BA.Engine(canvas);
        this.engine.init();

        // Create screens
        this.screens = new BA.Screens(this);
        this.screens.init();

        // Create HUD
        this.hud = new BA.HUD();

        // Create peer manager
        this.peerManager = new BA.PeerManager();
        this.gameSync = new BA.GameSync(this, this.engine, this.peerManager);

        // Network events integration
        this.peerManager.onRoomCreated = (roomId) => {
            this.currentRoomCode = roomId;
            this.lobbyPlayers = [
                { id: this.peerManager.localPeerId, name: this.playerName, team: 0, isHost: true }
            ];
            this._updateLobbyDisplay();
            this.screens.showScreen('lobbyScreen');
        };

        this.peerManager.onJoinedRoom = () => {
            this.lobbyPlayers = [
                { id: this.peerManager.localPeerId, name: this.playerName, team: 0, isHost: false }
            ];
            this._updateLobbyDisplay();
            this.screens.showScreen('lobbyScreen');
            this.screens.showToast('تم الانضمام للغرفة!');
        };

        this.peerManager.onPlayerJoined = (peerId, info) => {
            // Re-sync lobby list from peer manager
            const list = this.peerManager.getPlayerList();
            this.lobbyPlayers = list;
            this._updateLobbyDisplay();
            if (peerId) {
                this.screens.showToast(`انضم اللاعب: ${info.name}`);
            }
        };

        this.peerManager.onPlayerLeft = (peerId) => {
            const list = this.peerManager.getPlayerList();
            this.lobbyPlayers = list;
            this._updateLobbyDisplay();
            this.screens.showToast('غادر أحد اللاعبين المعركة.');
        };

        this.peerManager.onError = (err) => {
            this.screens.showToast(`خطأ في الشبكة: ${err}`);
            this.backToMenu();
        };

        // Engine callbacks
        this.engine.onStateChange = (newState, oldState) => {
            this._onStateChange(newState, oldState);
        };

        this.engine.onGameOver = (winnerInfo) => {
            this._onGameOver(winnerInfo);
        };

        this.engine.onPlayerKill = (killerName, victimName) => {
            this.hud.addKillFeedEntry(killerName, victimName);
            // Send to peers if online and host
            if (this.isOnline && this.isHost && this.gameSync) {
                this.gameSync.sendKill(null, killerName, null, victimName);
            }
        };

        this.engine.onBulletFired = (bulletData) => {
            if (this.isOnline && this.gameSync) {
                this.gameSync.sendBullet(bulletData);
            }
        };

        // HUD update loop
        this._hudUpdateInterval = setInterval(() => {
            if (this.engine && (this.engine.state === BA.STATE.PREP || this.engine.state === BA.STATE.PLAYING)) {
                this.hud.update(this.engine);
            }
        }, 50);

        // Resume audio on first interaction
        document.addEventListener('click', () => {
            if (this.engine.audioCtx && this.engine.audioCtx.state === 'suspended') {
                this.engine.audioCtx.resume();
            }
        }, { once: true });

        document.addEventListener('touchstart', () => {
            if (this.engine.audioCtx && this.engine.audioCtx.state === 'suspended') {
                this.engine.audioCtx.resume();
            }
        }, { once: true });

        // Bind spectator leave button
        const btnLeaveSpectator = document.getElementById('btnLeaveSpectator');
        if (btnLeaveSpectator) {
            btnLeaveSpectator.addEventListener('click', () => {
                this.backToMenu();
            });
        }

        // Override menu buttons
        setTimeout(() => {
            const btnOnline = document.getElementById('btnOnlinePlay');
            if (btnOnline) {
                btnOnline.replaceWith(btnOnline.cloneNode(true));
                document.getElementById('btnOnlinePlay').addEventListener('click', () => {
                    const name = this.screens._getPlayerName();
                    if (!name) return;
                    this.setPlayerName(name);
                    this.isOnline = true;
                    this.screens.showScreen('roomScreen');
                });
            }
        }, 500);

        console.log('⚔️ ساحة المعركة - Ready!');
    }

    setPlayerName(name) {
        this.playerName = name;
        // Keep a temporary local ID, but will be overridden by peer ID if playing online
        this.engine.localPlayerId = 'local_' + Math.random().toString(36).substr(2, 6);
    }

    setGameMode(mode) {
        this.gameMode = mode;
        if (this.isOnline && this.gameSync && this.isHost) {
            this.gameSync.broadcastModeChange(mode);
        }
        this._updateLobbyDisplay();
    }

    setMapType(mapType) {
        this.selectedMap = mapType;
        this.engine.selectedMap = mapType;
        if (this.isOnline && this.gameSync && this.isHost) {
            this.gameSync.broadcastMapChange(mapType);
        }
        this._updateLobbyDisplay();
    }

    // ═══ ROOM MANAGEMENT ═══

    async createRoom() {
        this.isHost = true;

        this.screens.showToast('جاري الاتصال بخادم الشبكة...');
        try {
            const peerId = await this.peerManager.createRoom(this.playerName);
            this.engine.localPlayerId = this.peerManager.localPeerId; // Sync engine with PeerJS ID
        } catch (e) {
            this.screens.showToast('فشل إنشاء الغرفة. تأكد من اتصال الإنترنت.');
            console.error(e);
        }
    }

    async joinRoom(roomId) {
        this.isHost = false;
        this.currentRoomCode = roomId;

        this.screens.showToast('جاري الانضمام للغرفة...');
        try {
            await this.peerManager.joinRoom(roomId, this.playerName);
            this.engine.localPlayerId = this.peerManager.localPeerId; // Sync engine with PeerJS ID
        } catch (e) {
            this.screens.showToast('لم يتم العثور على الغرفة أو انتهت مهلة الاتصال.');
            console.error(e);
        }
    }

    _generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 5; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    _updateLobbyDisplay() {
        // Assign teams if in team mode
        if (this.gameMode === BA.MODE.TEAM) {
            // Deterministic sort: host first, then alphabetically by ID
            this.lobbyPlayers.sort((a, b) => {
                if (a.isHost && !b.isHost) return -1;
                if (!a.isHost && b.isHost) return 1;
                return String(a.id).localeCompare(String(b.id));
            });

            const half = Math.ceil(this.lobbyPlayers.length / 2);
            this.lobbyPlayers.forEach((p, i) => {
                p.team = i < half ? 1 : 2;
            });
        } else {
            this.lobbyPlayers.forEach(p => p.team = 0);
        }

        this.screens.updateLobby(
            this.currentRoomCode || '-----',
            this.lobbyPlayers,
            this.gameMode,
            this.isHost,
            this.selectedMap
        );
    }

    // ═══ GAME CONTROL ═══

    startGame() {
        const minRequired = 2;
        if (this.lobbyPlayers.length < minRequired) {
            this.screens.showToast('تحتاج لاعبين على الأقل للبدء!');
            return;
        }

        // Check even number for team mode
        if (this.gameMode === BA.MODE.TEAM && this.lobbyPlayers.length % 2 !== 0) {
            this.screens.showToast('عدد اللاعبين يجب أن يكون زوجي للعب كفرق!');
            return;
        }


        // Prepare player infos for engine
        const playerInfos = this.lobbyPlayers.map(p => ({
            id: p.id,
            name: p.name,
            team: p.team || 0
        }));

        // Hide screens, show game
        this.screens.hideAll();

        // Start the engine
        this.engine.startGame(this.gameMode, playerInfos);

        // Broadcast and start sync
        if (this.gameSync) {
            this.gameSync.broadcastGameStart(this.gameMode, playerInfos, this.selectedMap);
            this.gameSync.startSync();
        }
    }

    leaveLobby() {
        if (this.peerManager) {
            this.peerManager.disconnect();
        }
        if (this.gameSync) {
            this.gameSync.stopSync();
        }
        this.lobbyPlayers = [];
        this.isHost = false;
    }

    returnToLobby() {
        this.engine._stopLoop();
        this.engine.canvas.classList.remove('active');
        this.hud.hide();
        if (this.engine.controls) this.engine.controls.destroy();

        // Hide spectator overlay if visible
        const respawnOverlay = document.getElementById('respawnOverlay');
        if (respawnOverlay) {
            respawnOverlay.classList.add('hidden');
        }

        // Re-init controls
        this.engine.controls = new BA.Controls(this.engine.canvas);

        // Stop sync
        if (this.gameSync) {
            this.gameSync.stopSync();
        }

        this._updateLobbyDisplay();
        this.screens.showScreen('lobbyScreen');
    }

    playAgain() {
        this.screens.hideAll();
        this.engine._stopLoop();
        this.engine.canvas.classList.remove('active');

        // Re-init controls
        if (this.engine.controls) this.engine.controls.destroy();
        this.engine.controls = new BA.Controls(this.engine.canvas);

        // Restart with same players
        const minRequired = 2;
        if (this.lobbyPlayers.length >= minRequired) {
            const playerInfos = this.lobbyPlayers.map(p => ({
                id: p.id,
                name: p.name,
                team: p.team || 0
            }));

            this.engine.startGame(this.gameMode, playerInfos);

            // Broadcast and start sync
            if (this.isOnline && this.isHost && this.gameSync) {
                this.gameSync.broadcastGameStart(this.gameMode, playerInfos, this.selectedMap);
                this.gameSync.startSync();
            }
        }
    }

    backToMenu() {
        this.engine._stopLoop();
        this.engine.canvas.classList.remove('active');
        this.hud.hide();
        if (this.engine.controls) this.engine.controls.destroy();
        if (this.peerManager) this.peerManager.disconnect();
        if (this.gameSync) this.gameSync.stopSync();
        this.lobbyPlayers = [];

        // Re-init engine for next game
        this.engine.controls = new BA.Controls(this.engine.canvas);
        this.screens.showScreen('mainMenu');
    }

    // ═══ STATE CHANGE HANDLER ═══

    _onStateChange(newState, oldState) {
        switch (newState) {
            case BA.STATE.PREP:
                this.screens.hideAll();
                this.hud.show();
                // Show mobile controls if on mobile
                if (this.engine.controls && this.engine.controls.isMobile) {
                    const mc = document.getElementById('mobileControls');
                    if (mc) mc.classList.remove('hidden');
                }
                break;

            case BA.STATE.PLAYING:
                // Battle started notification
                this.screens.showToast('⚔️ بدأت المعركة!');
                break;

            case BA.STATE.GAME_OVER:
                break;
        }
    }

    _onGameOver(winnerInfo) {
        // Collect all player stats
        const allPlayers = [];
        for (const [, player] of this.engine.players) {
            allPlayers.push({
                name: player.name,
                kills: player.kills,
                deaths: player.deaths,
                team: player.team,
                isLocal: player.id === this.engine.localPlayerId
            });
        }

        // Hide HUD and mobile controls
        this.hud.hide();
        const mc = document.getElementById('mobileControls');
        if (mc) mc.classList.add('hidden');

        // Show game over screen
        setTimeout(() => {
            this.screens.showGameOver(winnerInfo, allPlayers);
        }, 1000);
    }
};

// ═══ BOOTSTRAP ═══
window.addEventListener('DOMContentLoaded', () => {
    // Load PeerJS from CDN
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
    script.onload = () => {
        console.log('PeerJS loaded');
    };
    script.onerror = () => {
        console.warn('PeerJS failed to load - multiplayer disabled');
    };
    document.head.appendChild(script);

    // Initialize app
    const app = new BA.App();
    app.init();
    window._battleArena = app; // for debugging
});
