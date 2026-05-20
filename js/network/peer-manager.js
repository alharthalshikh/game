/* ═══════════════════════════════════════════
   ساحة المعركة - PeerJS Network Manager
   P2P connections for multiplayer
   ═══════════════════════════════════════════ */
window.BA = window.BA || {};

BA.PeerManager = class PeerManager {
    constructor() {
        this.peer = null;
        this.connections = new Map(); // peerId -> DataConnection
        this.isHost = false;
        this.roomId = '';
        this.localPeerId = '';

        // Callbacks
        this.onPlayerJoined = null;   // (peerId, playerInfo) => {}
        this.onPlayerLeft = null;     // (peerId) => {}
        this.onData = null;           // (peerId, data) => {}
        this.onRoomCreated = null;    // (roomId) => {}
        this.onJoinedRoom = null;     // () => {}
        this.onError = null;          // (error) => {}

        this._playerInfos = new Map(); // peerId -> { name, team }
    }

    // Generate a simple room code
    _generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 5; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // Initialize PeerJS
    async _initPeer(customId) {
        return new Promise((resolve, reject) => {
            try {
                // Use PeerJS cloud server for signaling
                const peerId = customId || 'ba_' + Math.random().toString(36).substr(2, 8);

                this.peer = new Peer(peerId, {
                    debug: 0,
                    config: {
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:stun1.l.google.com:19302' },
                        ]
                    }
                });

                let openHandled = false;

                const connectTimeout = setTimeout(() => {
                    if (!openHandled) {
                        console.warn(`Connection timeout for peerId: ${peerId}`);
                        if (this.peer) {
                            try { this.peer.destroy(); } catch(e){}
                            this.peer = null;
                        }
                        reject(new Error('timeout'));
                    }
                }, 2000); // 2.0 seconds fast timeout!

                this.peer.on('open', (id) => {
                    clearTimeout(connectTimeout);
                    this.localPeerId = id;
                    console.log('PeerJS connected with ID:', id);
                    openHandled = true;
                    resolve(id);
                });

                this.peer.on('error', (err) => {
                    clearTimeout(connectTimeout);
                    console.warn('PeerJS error:', err.type, err.message);
                    if (!openHandled) {
                        if (this.peer) {
                            try { this.peer.destroy(); } catch(e){}
                            this.peer = null;
                        }
                        reject(err);
                    } else {
                        // Suppress peer-unavailable errors (caused by scan peers disconnecting)
                        if (err.type === 'peer-unavailable') return;
                        if (this.onError) this.onError(err.type + ': ' + err.message);
                    }
                });

                this.peer.on('disconnected', () => {
                    console.log('PeerJS disconnected');
                });

                // Handle incoming connections (host only)
                this.peer.on('connection', (conn) => {
                    this._setupConnection(conn);
                });

            } catch (e) {
                reject(e);
            }
        });
    }

    // Create a room (become host)
    async createRoom(playerName) {
        this.isHost = true;

        let claimedRoomNum = 0;
        for (let i = 1; i <= 5; i++) {
            const peerId = 'ba_room_' + i;
            try {
                await this._initPeer(peerId);
                claimedRoomNum = i;
                break;
            } catch (err) {
                console.log(`Room ID ${peerId} is taken, trying next...`);
            }
        }

        if (claimedRoomNum === 0) {
            throw new Error('جميع الغرف ممتلئة حالياً! حاول لاحقاً.');
        }

        this.roomId = 'ROOM_' + claimedRoomNum;

        this._playerInfos.set(this.localPeerId, {
            name: playerName,
            team: 0,
            isHost: true
        });

        if (this.onRoomCreated) this.onRoomCreated(this.roomId);
        return this.roomId;
    }

    // Join an existing room
    async joinRoom(roomId, playerName) {
        this.isHost = false;
        const roomNum = roomId.toUpperCase().replace('ROOM_', '');
        this.roomId = 'ROOM_' + roomNum;

        try {
            await this._initPeer();

            const hostPeerId = 'ba_room_' + roomNum;
            const conn = this.peer.connect(hostPeerId, {
                reliable: true,
                metadata: { name: playerName }
            });

            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 10000);

                conn.on('open', () => {
                    clearTimeout(timeout);
                    this._setupConnection(conn);

                    // Send join message
                    conn.send({
                        type: 'join',
                        name: playerName,
                        peerId: this.localPeerId
                    });

                    if (this.onJoinedRoom) this.onJoinedRoom();
                    resolve();
                });

                conn.on('error', (err) => {
                    clearTimeout(timeout);
                    reject(err);
                });
            });
        } catch (e) {
            throw e;
        }
    }

    // Setup a connection (both host and client)
    _setupConnection(conn) {
        const peerId = conn.peer;
        this.connections.set(peerId, conn);

        conn.on('open', () => {
            console.log('Connection opened with:', peerId);
        });

        conn.on('data', (data) => {
            this._handleData(peerId, data);
        });

        conn.on('close', () => {
            console.log('Connection closed with:', peerId);
            this.connections.delete(peerId);
            if (this._playerInfos.has(peerId)) {
                this._playerInfos.delete(peerId);
                if (this.onPlayerLeft) this.onPlayerLeft(peerId);
            }
        });

        conn.on('error', (err) => {
            console.error('Connection error with', peerId, ':', err);
        });
    }

    _handleData(peerId, data) {
        if (!data || !data.type) return;

        switch (data.type) {
            case 'ping':
                const hostInfo = this._playerInfos.get(this.localPeerId);
                const hostName = hostInfo ? hostInfo.name : 'قائد';
                const conn = this.connections.get(peerId);
                if (conn) {
                    conn.send({
                        type: 'pong',
                        hostName: hostName
                    });
                }
                break;

            case 'join':
                // A new player joined
                this._playerInfos.set(peerId, {
                    name: data.name,
                    team: 0,
                    isHost: false
                });
                if (this.onPlayerJoined) {
                    this.onPlayerJoined(peerId, {
                        name: data.name,
                        peerId: peerId
                    });
                }

                // If host, broadcast updated player list to all
                if (this.isHost) {
                    this._broadcastPlayerList();
                }
                break;

            case 'player_list':
                // Update local player list (client only)
                this._playerInfos.clear();
                for (const [id, info] of Object.entries(data.players)) {
                    this._playerInfos.set(id, info);
                }
                if (this.onPlayerJoined) {
                    this.onPlayerJoined(null, null); // trigger UI refresh
                }
                break;

            case 'game_start':
            case 'game_state':
            case 'player_state':
            case 'bullet':
            case 'hit':
            case 'kill':
            case 'mode_change':
                // Forward to game sync handler
                if (this.onData) this.onData(peerId, data);
                break;

            default:
                if (this.onData) this.onData(peerId, data);
                break;
        }
    }

    _broadcastPlayerList() {
        const players = {};
        for (const [id, info] of this._playerInfos) {
            players[id] = info;
        }
        this.broadcast({
            type: 'player_list',
            players: players
        });
    }

    // Send to all connected peers
    broadcast(data) {
        for (const [, conn] of this.connections) {
            try {
                if (conn.open) conn.send(data);
            } catch (e) {
                console.error('Broadcast error:', e);
            }
        }
    }

    // Send to specific peer
    sendTo(peerId, data) {
        const conn = this.connections.get(peerId);
        if (conn && conn.open) {
            try {
                conn.send(data);
            } catch (e) {
                console.error('Send error:', e);
            }
        }
    }

    // Get all player infos for lobby display
    getPlayerList() {
        const list = [];
        for (const [id, info] of this._playerInfos) {
            list.push({
                id: id,
                name: info.name,
                team: info.team || 0,
                isHost: info.isHost || false
            });
        }
        return list;
    }

    getConnectedCount() {
        return this._playerInfos.size;
    }

    // Disconnect everything
    disconnect() {
        for (const [, conn] of this.connections) {
            try { conn.close(); } catch (e) {}
        }
        this.connections.clear();
        this._playerInfos.clear();

        if (this.peer) {
            try { this.peer.destroy(); } catch (e) {}
            this.peer = null;
        }

        this.isHost = false;
        this.roomId = '';
    }

    findActiveRooms(onRoomFound) {
        const scanPeerId = 'ba_scan_' + Math.random().toString(36).substr(2, 6);
        let scanPeer;
        
        try {
            scanPeer = new Peer(scanPeerId, {
                debug: 0,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                    ]
                }
            });
        } catch (e) {
            console.error('Failed to create scan peer:', e);
            return;
        }

        scanPeer.on('open', () => {
            for (let i = 1; i <= 5; i++) {
                const roomId = 'ba_room_' + i;
                const conn = scanPeer.connect(roomId, {
                    reliable: true
                });

                const cleanup = setTimeout(() => {
                    try { conn.close(); } catch(e){}
                }, 6000); // Give PeerJS 6 seconds to negotiate P2P on slow networks

                conn.on('open', () => {
                    conn.send({ type: 'ping' });
                });

                conn.on('data', (data) => {
                    if (data && data.type === 'pong') {
                        clearTimeout(cleanup);
                        try { conn.close(); } catch(e){}
                        onRoomFound({ num: i, hostName: data.hostName });
                    }
                });

                conn.on('error', () => {
                    clearTimeout(cleanup);
                    try { conn.close(); } catch(e){}
                });
            }
        });

        scanPeer.on('error', (err) => {
            console.warn('Scan peer error:', err.type, err.message);
            if (err && err.type !== 'peer-unavailable') {
                try { scanPeer.destroy(); } catch(e){}
            }
        });

        // Destroy the scan peer after 7 seconds to free resources
        setTimeout(() => {
            try { scanPeer.destroy(); } catch(e){}
        }, 7000);
    }
};
