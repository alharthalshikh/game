/* ═══════════════════════════════════════════
   ساحة المعركة - Game Sync
   Synchronize game state between peers
   ═══════════════════════════════════════════ */
window.BA = window.BA || {};

BA.GameSync = class GameSync {
    constructor(app, engine, peerManager) {
        this.app = app;
        this.engine = engine;
        this.peer = peerManager;
        this._syncInterval = null;
        this._syncRate = 50; // ms between syncs (20 per second)

        // Setup data handler
        this.peer.onData = (peerId, data) => this._handleData(peerId, data);
    }

    startSync() {
        if (this._syncInterval) clearInterval(this._syncInterval);
        this._syncInterval = setInterval(() => {
            this._sendLocalState();
        }, this._syncRate);
    }

    stopSync() {
        if (this._syncInterval) {
            clearInterval(this._syncInterval);
            this._syncInterval = null;
        }
    }

    // Send local player state to all peers
    _sendLocalState() {
        if (!this.engine.localPlayer) return;

        this.peer.broadcast({
            type: 'player_state',
            player: this.engine.localPlayer.serialize(),
            timestamp: Date.now()
        });
    }

    // Send bullet fired event
    sendBullet(bulletData) {
        this.peer.broadcast({
            type: 'bullet',
            bullet: bulletData,
            timestamp: Date.now()
        });
    }

    // Send hit event
    sendHit(targetId, damage, killerId) {
        this.peer.broadcast({
            type: 'hit',
            targetId: targetId,
            damage: damage,
            killerId: killerId,
            timestamp: Date.now()
        });
    }

    // Send kill event
    sendKill(killerId, killerName, victimId, victimName) {
        this.peer.broadcast({
            type: 'kill',
            killerId, killerName,
            victimId, victimName,
            timestamp: Date.now()
        });
    }

    // Broadcast game start (host only)
    broadcastGameStart(mode, playerInfos, mapType) {
        this.peer.broadcast({
            type: 'game_start',
            mode: mode,
            players: playerInfos,
            mapType: mapType || 'farm',
            timestamp: Date.now()
        });
    }

    // Broadcast mode change (host only)
    broadcastModeChange(mode) {
        this.peer.broadcast({
            type: 'mode_change',
            mode: mode,
            timestamp: Date.now()
        });
    }

    // Broadcast map change (host only)
    broadcastMapChange(mapType) {
        this.peer.broadcast({
            type: 'map_change',
            mapType: mapType,
            timestamp: Date.now()
        });
    }

    // Broadcast return to lobby (host only)
    broadcastReturnToLobby() {
        this.peer.broadcast({
            type: 'return_to_lobby',
            timestamp: Date.now()
        });
    }

    _handleData(peerId, data) {
        switch (data.type) {
            case 'return_to_lobby':
                this.stopSync();
                if (this.app) {
                    this.app.returnToLobby();
                }
                break;

            case 'player_state':
                this._handlePlayerState(peerId, data.player);
                break;

            case 'bullet':
                this._handleBullet(data.bullet);
                break;

            case 'hit':
                this._handleHit(data);
                break;

            case 'kill':
                this._handleKill(data);
                break;

            case 'game_start':
                this._handleGameStart(data);
                break;

            case 'mode_change':
                if (this.engine) {
                    this.engine.gameMode = data.mode;
                }
                if (this.app) {
                    this.app.gameMode = data.mode;
                    this.app._updateLobbyDisplay();
                }
                break;

            case 'map_change':
                if (this.app) {
                    this.app.selectedMap = data.mapType;
                    if (this.engine) this.engine.selectedMap = data.mapType;
                    this.app._updateLobbyDisplay();
                }
                break;
        }
    }

    _handlePlayerState(peerId, playerData) {
        if (!this.engine || !playerData) return;

        let player = this.engine.players.get(playerData.id);
        if (!player) {
            // New remote player
            player = this.engine.addRemotePlayer(
                playerData.id,
                playerData.name,
                playerData.team
            );
        }

        // Don't update local player from remote data
        if (playerData.id === this.engine.localPlayerId) return;

        player.updateFromData(playerData);
    }

    _handleBullet(bulletData) {
        if (!this.engine) return;
        // Don't add our own bullets back
        if (bulletData.ownerId === this.engine.localPlayerId) return;

        const bullet = BA.Bullet.deserialize(bulletData);
        this.engine.bullets.push(bullet);
    }

    _handleHit(data) {
        if (!this.engine) return;
        const target = this.engine.players.get(data.targetId);
        if (target && target.id !== this.engine.localPlayerId) {
            target.takeDamage(data.damage, data.killerId);
        }
    }

    _handleKill(data) {
        if (!this.engine) return;
        // Update kill feed via HUD
        if (this.engine.onPlayerKill) {
            this.engine.onPlayerKill(data.killerName, data.victimName);
        }
    }

    _handleGameStart(data) {
        if (!this.engine) return;
        // Client received game start from host
        this.engine.selectedMap = data.mapType || 'farm';
        this.engine.startGame(data.mode, data.players);
        this.startSync();
    }

    destroy() {
        this.stopSync();
    }
};
