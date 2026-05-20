/* ═══════════════════════════════════════════
   ساحة المعركة - Screen Manager
   Menu, Lobby, GameOver screen management
   ═══════════════════════════════════════════ */
window.BA = window.BA || {};

BA.Screens = class Screens {
    constructor(app) {
        this.app = app;
        this.screens = {
            mainMenu: document.getElementById('mainMenu'),
            roomScreen: document.getElementById('roomScreen'),
            lobbyScreen: document.getElementById('lobbyScreen'),
            gameOverScreen: document.getElementById('gameOverScreen'),
        };
        this.activeScreen = 'mainMenu';
        this._scanInterval = null;
        this.activeRooms = new Map(); // roomId ("ROOM_X") -> { num, hostName, lastSeen }
    }

    init() {
        this._setupMainMenu();
        this._setupRoomScreen();
        this._setupLobbyScreen();
        this._setupGameOverScreen();
        this._createParticles();
    }

    _createParticles() {
        const container = document.getElementById('particles');
        if (!container) return;
        for (let i = 0; i < 30; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.left = Math.random() * 100 + '%';
            p.style.animationDelay = Math.random() * 6 + 's';
            p.style.animationDuration = (4 + Math.random() * 4) + 's';
            container.appendChild(p);
        }
    }

    showScreen(id) {
        // Hide all
        for (const [key, el] of Object.entries(this.screens)) {
            if (el) {
                el.classList.remove('active');
            }
        }
        // Show target
        if (this.screens[id]) {
            this.screens[id].classList.add('active');
            this.activeScreen = id;
        }

        if (id === 'roomScreen') {
            this._startScanning();
        } else {
            this._stopScanning();
        }
    }

    _startScanning() {
        this._stopScanning();
        this.activeRooms.clear();
        this._scanActiveRooms();
        this._scanInterval = setInterval(() => {
            this._scanActiveRooms();
        }, 4000);
    }

    _stopScanning() {
        if (this._scanInterval) {
            clearInterval(this._scanInterval);
            this._scanInterval = null;
        }
    }

    _scanActiveRooms() {
        const listEl = document.getElementById('activeRoomsList');
        if (!listEl) return;

        // Clean up rooms not seen in the last 8 seconds
        const now = Date.now();
        for (const [roomId, room] of this.activeRooms.entries()) {
            if (now - room.lastSeen > 8000) {
                this.activeRooms.delete(roomId);
            }
        }

        // Render the currently known rooms immediately to avoid blank list
        this._renderActiveRooms();

        try {
            this.app.peerManager.findActiveRooms((room) => {
                if (this.activeScreen !== 'roomScreen') return;

                const roomId = `ROOM_${room.num}`;
                this.activeRooms.set(roomId, {
                    num: room.num,
                    hostName: room.hostName,
                    lastSeen: Date.now()
                });

                // Re-render immediately when a room is found
                this._renderActiveRooms();
            });
        } catch (e) {
            console.error('Error starting active rooms scan:', e);
        }
    }

    _renderActiveRooms() {
        const listEl = document.getElementById('activeRoomsList');
        if (!listEl) return;

        if (this.activeRooms.size === 0) {
            listEl.innerHTML = '<div class="no-rooms-msg">لا توجد معارك نشطة حالياً. أنشئ غرفة لتبدأ المعركة!</div>';
            return;
        }

        listEl.innerHTML = '';
        for (const room of this.activeRooms.values()) {
            const roomItem = document.createElement('div');
            roomItem.className = 'room-item';
            roomItem.innerHTML = `
                <div class="room-info">
                    <span class="room-name">معركة القائد: ${room.hostName}</span>
                    <span class="room-status">● نشطة وجاهزة للانضمام</span>
                </div>
                <button class="btn-join-room" data-room-id="ROOM_${room.num}">دخول المعركة</button>
            `;

            const btnJoin = roomItem.querySelector('.btn-join-room');
            btnJoin.addEventListener('click', () => {
                this._stopScanning();
                this.app.joinRoom(`ROOM_${room.num}`);
            });

            listEl.appendChild(roomItem);
        }
    }

    hideAll() {
        for (const [, el] of Object.entries(this.screens)) {
            if (el) el.classList.remove('active');
        }
    }

    // ═══ MAIN MENU ═══
    _setupMainMenu() {
        const btnOnline = document.getElementById('btnOnlinePlay');
        const input = document.getElementById('playerName');

        // Load saved player name
        if (input) {
            const savedName = localStorage.getItem('BA_player_name');
            if (savedName) {
                input.value = savedName;
                this.app.playerName = savedName;
            } else {
                const defaultName = 'مقاتل_' + Math.floor(Math.random() * 999);
                input.value = defaultName;
                this.app.playerName = defaultName;
            }
        }

        if (btnOnline) {
            btnOnline.addEventListener('click', () => {
                const name = this._getPlayerName();
                if (!name) return;
                this.app.setPlayerName(name);
                // For online play, show room screen
                this.showScreen('roomScreen');
            });
        }
    }

    _getPlayerName() {
        const input = document.getElementById('playerName');
        let name = input ? input.value.trim() : '';
        if (!name) {
            name = 'مقاتل_' + Math.floor(Math.random() * 999);
            if (input) input.value = name;
        }
        // Save to local storage
        localStorage.setItem('BA_player_name', name);
        return name;
    }

    // ═══ ROOM SCREEN ═══
    _setupRoomScreen() {
        const btnCreate = document.getElementById('btnCreateRoom');
        const btnJoin = document.getElementById('btnJoinRoom');
        const btnBack = document.getElementById('btnBackToMenu');

        if (btnCreate) {
            btnCreate.addEventListener('click', () => {
                this._stopScanning();
                this.app.createRoom();
            });
        }

        if (btnJoin) {
            btnJoin.addEventListener('click', () => {
                const code = document.getElementById('roomCode');
                const roomId = code ? code.value.trim().toUpperCase() : '';
                if (!roomId) {
                    this._showToast('أدخل كود الغرفة!');
                    return;
                }
                this.app.joinRoom(roomId);
            });
        }

        if (btnBack) {
            btnBack.addEventListener('click', () => {
                this.showScreen('mainMenu');
            });
        }
    }

    // ═══ LOBBY SCREEN ═══
    _setupLobbyScreen() {
        const btnFFA = document.getElementById('btnFFA');
        const btnTeam = document.getElementById('btnTeam');
        const btnStart = document.getElementById('btnStartGame');
        const btnLeave = document.getElementById('btnLeaveLobby');
        const btnCopy = document.getElementById('btnCopyCode');

        if (btnFFA) {
            btnFFA.addEventListener('click', () => {
                btnFFA.classList.add('active');
                if (btnTeam) btnTeam.classList.remove('active');
                this.app.setGameMode(BA.MODE.FFA);
                this._updateTeamWarning();
            });
        }

        if (btnTeam) {
            btnTeam.addEventListener('click', () => {
                btnTeam.classList.add('active');
                if (btnFFA) btnFFA.classList.remove('active');
                this.app.setGameMode(BA.MODE.TEAM);
                this._updateTeamWarning();
            });
        }

        if (btnStart) {
            btnStart.addEventListener('click', () => {
                this.app.startGame();
            });
        }

        if (btnLeave) {
            btnLeave.addEventListener('click', () => {
                this.app.leaveLobby();
                this.showScreen('mainMenu');
            });
        }

        if (btnCopy) {
            btnCopy.addEventListener('click', () => {
                const codeEl = document.getElementById('roomCodeValue');
                if (codeEl && navigator.clipboard) {
                    navigator.clipboard.writeText(codeEl.textContent);
                    this._showToast('تم نسخ الكود!');
                }
            });
        }

        // Map selection cards click listener
        const mapCards = document.querySelectorAll('.map-card');
        mapCards.forEach(card => {
            card.addEventListener('click', () => {
                if (this.app.isOnline && !this.app.isHost) {
                    this._showToast('فقط قائد الغرفة يمكنه تغيير الخريطة!');
                    return;
                }
                const mapType = card.dataset.map;
                this.app.setMapType(mapType);
            });
        });
    }

    updateLobby(roomCode, players, gameMode, isHost, selectedMap = 'farm') {
        // Room code
        const codeEl = document.getElementById('roomCodeValue');
        if (codeEl) codeEl.textContent = roomCode || '----';

        // Player count
        const countEl = document.getElementById('playerCount');
        if (countEl) countEl.textContent = `${players.length}/${BA.MAX_PLAYERS}`;

        // Players list
        const listEl = document.getElementById('playersList');
        if (listEl) {
            listEl.innerHTML = '';
            const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899',
                           '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

            players.forEach((p, i) => {
                const item = document.createElement('div');
                const teamClass = gameMode === BA.MODE.TEAM ? ` team-${p.team || ((i % 2) + 1)}` : '';
                item.className = `player-item${teamClass}`;

                const avatarColor = colors[i % colors.length];
                const initials = p.name ? p.name.charAt(0) : '?';

                item.innerHTML = `
                    <div class="player-avatar" style="background:${avatarColor};color:#000">
                        ${initials}
                    </div>
                    <span class="player-name">${p.name}</span>
                    ${p.isHost ? '<span class="player-badge">قائد</span>' : ''}
                `;
                listEl.appendChild(item);
            });
        }

        // Start button
        const btnStart = document.getElementById('btnStartGame');
        if (btnStart) {
            const canStart = isHost && players.length >= BA.MIN_PLAYERS;
            btnStart.disabled = !canStart;
        }

        // Mode buttons
        const btnFFA = document.getElementById('btnFFA');
        const btnTeam = document.getElementById('btnTeam');
        if (gameMode === BA.MODE.TEAM) {
            if (btnTeam) btnTeam.classList.add('active');
            if (btnFFA) btnFFA.classList.remove('active');
        } else {
            if (btnFFA) btnFFA.classList.add('active');
            if (btnTeam) btnTeam.classList.remove('active');
        }

        // Disable mode switch for non-hosts
        if (btnFFA) btnFFA.disabled = !isHost;
        if (btnTeam) btnTeam.disabled = !isHost;

        // Update selected map card
        const mapCards = document.querySelectorAll('.map-card');
        mapCards.forEach(card => {
            if (card.dataset.map === selectedMap) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
            
            // Visual style for host vs clients
            if (isHost || !this.app.isOnline) {
                card.style.cursor = 'pointer';
                card.style.opacity = '1';
            } else {
                card.style.cursor = 'not-allowed';
                card.style.opacity = card.dataset.map === selectedMap ? '1' : '0.4';
            }
        });

        this._updateTeamWarning();
    }

    _updateTeamWarning() {
        const warning = document.getElementById('teamWarning');
        const btnTeam = document.getElementById('btnTeam');
        if (!warning) return;

        const isTeam = btnTeam && btnTeam.classList.contains('active');
        const countEl = document.getElementById('playerCount');
        const count = countEl ? parseInt(countEl.textContent) : 0;

        if (isTeam && count % 2 !== 0) {
            warning.classList.remove('hidden');
        } else {
            warning.classList.add('hidden');
        }
    }

    // ═══ GAME OVER ═══
    _setupGameOverScreen() {
        const btnAgain = document.getElementById('btnPlayAgain');
        const btnMenu = document.getElementById('btnBackToMenuFromGameOver');

        if (btnAgain) {
            btnAgain.addEventListener('click', () => {
                this.app.returnToLobby();
            });
        }

        if (btnMenu) {
            btnMenu.addEventListener('click', () => {
                this.app.backToMenu();
            });
        }
    }

    showGameOver(winnerInfo, allPlayers) {
        const winnerText = document.getElementById('winnerText');
        const statsEl = document.getElementById('gameStats');
        const btnAgain = document.getElementById('btnPlayAgain');

        if (btnAgain) {
            btnAgain.style.display = 'flex';
        }

        if (winnerText) {
            if (winnerInfo.type === 'team') {
                winnerText.textContent = `🏆 فاز ${winnerInfo.teamName}!`;
            } else {
                if (winnerInfo.isLocal) {
                    winnerText.textContent = '🏆 أنت الفائز!';
                } else {
                    winnerText.textContent = `🏆 فاز ${winnerInfo.name}!`;
                }
            }
        }

        if (statsEl) {
            statsEl.innerHTML = '';
            // Sort by kills
            const sorted = allPlayers.sort((a, b) => b.kills - a.kills);
            for (const p of sorted) {
                const card = document.createElement('div');
                card.className = 'stat-card';
                card.innerHTML = `
                    <div class="stat-value">${p.kills}</div>
                    <div class="stat-label">${p.name}</div>
                    <div style="font-size:0.7em;color:var(--text-dim)">
                        قتل: ${p.kills} | موت: ${p.deaths}
                    </div>
                `;
                statsEl.appendChild(card);
            }
        }

        this.showScreen('gameOverScreen');
    }

    // ═══ Toast Notification ═══
    _showToast(message) {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    showToast(message) {
        this._showToast(message);
    }

    showLoading(text) {
        const overlay = document.getElementById('loadingOverlay');
        const textEl = document.getElementById('loadingText');
        if (overlay) {
            if (textEl) textEl.textContent = text;
            overlay.classList.remove('hidden');
        }
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }
};
