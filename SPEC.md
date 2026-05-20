# Battle Arena - Shared API Specification

## Namespace
All code uses: `window.BA = window.BA || {};`

## Constants
```
BA.TILE_SIZE = 40
BA.MAP_COLS = 80
BA.MAP_ROWS = 60
BA.TILE = { GRASS:0, TREE:1, WALL:2, ROCK:3, WATER:4, SAND:5, FLOOR:6, DOOR:7 }
BA.STATE = { MENU:'menu', LOBBY:'lobby', PREP:'prep', PLAYING:'playing', GAME_OVER:'gameOver' }
BA.MODE = { FFA:'ffa', TEAM:'team' }
BA.PREP_TIME = 15 (seconds)
BA.MIN_PLAYERS = 2
BA.MAX_PLAYERS = 20
BA.PLAYER_SPEED = 3
BA.BULLET_SPEED = 10
BA.BULLET_DAMAGE = 25
BA.PLAYER_RADIUS = 14
BA.SHOOT_COOLDOWN = 15 (frames)
```

## HTML Element IDs
- Canvas: #gameCanvas
- Screens: #mainMenu, #roomScreen, #lobbyScreen, #gameOverScreen
- Buttons: #btnLocalPlay, #btnOnlinePlay, #btnCreateRoom, #btnJoinRoom, #btnStartGame, #btnFFA, #btnTeam, #btnShoot, #btnBackToMenu, #btnLeaveLobby, #btnPlayAgain, #btnBackToMenuFromGameOver
- Inputs: #playerName, #roomCode
- HUD: #hud, #healthFill, #healthText, #prepTimer, #prepCount, #killCount, #deathCount, #aliveCount
- Displays: #roomCodeDisplay, #playersList, #playerCount, #winnerText, #gameStats
- Mobile: #mobileControls, #joystickArea, #joystickBase, #joystickThumb

## Module APIs

### BA.GameMap (map.js)
- constructor() - generates map
- data: 2D array [row][col]
- getTile(col, row): tileType
- isSolid(col, row): boolean (WALL, ROCK, TREE are solid)
- isWalkable(worldX, worldY, radius): boolean
- getSpawnPoints(): [{x,y}] - array of safe spawn positions
- worldToTile(worldX, worldY): {col, row}

### BA.Player (player.js)
- constructor(id, name, x, y, team=0)
- Properties: id, name, x, y, angle, speed, health, maxHealth(100), team, alive, kills, deaths, canShoot, shootCooldown, color
- update(moveX, moveY, angle, map): void
- shoot(): BA.Bullet|null
- takeDamage(amount, attackerId): boolean (returns true if died)
- respawn(x, y): void
- serialize(): {id,name,x,y,angle,health,team,alive,kills,deaths}
- Team colors: 0='#00ff88'(FFA green), 1='#ff4444'(Red), 2='#4488ff'(Blue)

### BA.Bullet (bullet.js)
- constructor(x, y, angle, ownerId, team)
- Properties: x, y, vx, vy, speed(10), damage(25), ownerId, team, lifetime(90), active
- update(map): boolean (false=remove)
- serialize(): {x,y,vx,vy,ownerId,team}

### BA.Controls (controls.js)
- constructor(canvas)
- Properties: keys{up,down,left,right}, mouseX, mouseY, mouseDown, isMobile, aimAngle, shooting
- getMovement(): {dx, dy} normalized
- getAimAngle(playerX, playerY, cameraX, cameraY): radians
- isShooting(): boolean
- destroy(): void

### BA.Renderer (renderer.js)
- constructor(canvas, ctx)
- render(state): void
- state = { map, players[], bullets[], localPlayer, camera{x,y}, effects[], prepTime, gameMode }

### BA.Engine (engine.js)
- constructor(canvas)
- Properties: state, gameMode, players(Map), bullets[], localPlayer, map, controls, renderer, camera, prepTimer, effects[]
- setState(newState): void
- startGame(mode, playerInfos[]): void
- update(): void
- render(): void
- gameLoop(): void
- addBot(): void (for testing)
- onStateChange: callback
- onGameOver: callback(winnerInfo)

### BA.Screens (screens.js)
- constructor(engine)
- showScreen(id): void
- hideAll(): void
- init(): void

### BA.HUD (hud.js)
- constructor()
- update(engine): void
- show(): void
- hide(): void

### BA.PeerManager (peer-manager.js)
- constructor()
- createRoom(): Promise<roomId>
- joinRoom(roomId, playerName): Promise
- broadcast(data): void
- sendTo(peerId, data): void
- onPlayerJoined: callback(playerInfo)
- onPlayerLeft: callback(peerId)
- onData: callback(peerId, data)
- disconnect(): void
- isHost: boolean
- roomId: string
- connectedPeers: string[]

### BA.GameSync (game-sync.js)
- constructor(engine, peerManager)
- startSync(): void
- stopSync(): void
- sendBullet(bullet): void
- sendHit(playerId, damage): void

### BA.App (app.js)
- constructor()
- init(): void
