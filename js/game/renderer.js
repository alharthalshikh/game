/* ═══════════════════════════════════════════
   ساحة المعركة - Renderer
   Canvas rendering for map, players, effects
   ═══════════════════════════════════════════ */
window.BA = window.BA || {};

BA.Renderer = class Renderer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.tileColors = {};
        this.mapType = '';
        this._initColors('farm');
    }

    _initColors(mapType = 'farm') {
        this.mapType = mapType;
        if (mapType === 'cave') {
            this.tileColors = {
                [BA.TILE.GRASS]: '#1f1a24',    // Dark rocky cavern floor
                [BA.TILE.TREE]: '#4a125c',     // Violet stalagmite / crystal structure
                [BA.TILE.WALL]: '#2b1c2e',     // Purple obsidian rock wall
                [BA.TILE.ROCK]: '#3d2542',     // Dark crystal cluster
                [BA.TILE.WATER]: '#134057',    // Crystalline liquid
                [BA.TILE.SAND]: '#332938',     // Fine violet dust
                [BA.TILE.FLOOR]: '#15101a',    // Smooth obsidian ritual chamber floor
                [BA.TILE.DOOR]: '#541c41',     // Glowing purple security door
            };
            this.grassVariants = ['#1f1a24', '#1c1721', '#231e2b', '#1a161f', '#25202e'];
        } else if (mapType === 'village') {
            this.tileColors = {
                [BA.TILE.GRASS]: '#3a6629',    // Cozy village grass
                [BA.TILE.TREE]: '#1c420e',     // Fruit trees
                [BA.TILE.WALL]: '#75402c',     // Brick cottage walls
                [BA.TILE.ROCK]: '#53565c',     // Stone wall paths
                [BA.TILE.WATER]: '#184f85',    // Village pond
                [BA.TILE.SAND]: '#8c8064',     // Dirt paths
                [BA.TILE.FLOOR]: '#5c4838',    // Wooden floor panels
                [BA.TILE.DOOR]: '#663a23',     // Cottage door
            };
            this.grassVariants = ['#3a6629', '#376127', '#3d6c2c', '#335b23', '#40712f'];
        } else if (mapType === 'city') {
            this.tileColors = {
                [BA.TILE.GRASS]: '#383a3d',    // Dark asphalt roads
                [BA.TILE.TREE]: '#1c4224',     // City garden trees / lamp posts
                [BA.TILE.WALL]: '#555f69',     // Reinforced concrete buildings
                [BA.TILE.ROCK]: '#626a73',     // Metallic bins / concrete barriers
                [BA.TILE.WATER]: '#10304a',    // Greenish toxic waste channel
                [BA.TILE.SAND]: '#484b52',     // Sidewalk concrete pavement
                [BA.TILE.FLOOR]: '#282b30',    // Office tiling
                [BA.TILE.DOOR]: '#135c75',     // Metal sliding doors
            };
            this.grassVariants = ['#383a3d', '#35373a', '#3c3e42', '#323437', '#404247'];
        } else { // farm
            this.tileColors = {
                [BA.TILE.GRASS]: '#2d5a1e',
                [BA.TILE.TREE]: '#1a4010',
                [BA.TILE.WALL]: '#4a4a5a',
                [BA.TILE.ROCK]: '#5a5a6a',
                [BA.TILE.WATER]: '#1a4a7a',
                [BA.TILE.SAND]: '#8a7a50',
                [BA.TILE.FLOOR]: '#3a3a4a',
                [BA.TILE.DOOR]: '#6a5a3a',
            };
            this.grassVariants = ['#2d5a1e', '#2a5520', '#305e1c', '#285018', '#336322'];
        }
    }

    render(state) {
        const { map, players, bullets, localPlayer, camera, effects, prepPhase, gameMode } = state;
        if (map && map.mapType !== this.mapType) {
            this._initColors(map.mapType);
        }
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Clear
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.translate(-camera.x + w / 2, -camera.y + h / 2);

        // Render map
        this._renderMap(ctx, map, camera, w, h);

        // Render decorations (under players)
        this._renderDecorations(ctx, map, camera, w, h);

        // Render bullets
        for (const bullet of bullets) {
            if (bullet.active) this._renderBullet(ctx, bullet);
        }

        // Render players (remote first, local on top)
        const sortedPlayers = [...players.values()].sort((a, b) => {
            if (a.id === localPlayer.id) return 1;
            if (b.id === localPlayer.id) return -1;
            return a.y - b.y;
        });

        for (const player of sortedPlayers) {
            const isLocal = player.id === localPlayer.id;
            let visible = true;

            if (!isLocal) {
                // Calculate distance
                const dx = player.x - localPlayer.x;
                const dy = player.y - localPlayer.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // 1. Check max vision range
                if (dist > 400) {
                    visible = false;
                } else {
                    // Get tile types
                    const playerTile = map.getTile(Math.floor(player.x / map.tileSize), Math.floor(player.y / map.tileSize));
                    const localTile = map.getTile(Math.floor(localPlayer.x / map.tileSize), Math.floor(localPlayer.y / map.tileSize));

                    // 2. Hide if player is in dense forest (TREE tile) and not extremely close
                    if (playerTile === BA.TILE.TREE && dist > 80) {
                        visible = false;
                    }

                    // 3. Hide if separated by indoors/outdoors (one inside building floor, one outside)
                    const isPlayerInside = playerTile === BA.TILE.FLOOR;
                    const isLocalInside = localTile === BA.TILE.FLOOR;
                    if (isPlayerInside !== isLocalInside && dist > 100) {
                        // Check if either is standing on a door (which allows seeing through)
                        const onDoor = playerTile === BA.TILE.DOOR || localTile === BA.TILE.DOOR;
                        if (!onDoor) visible = false;
                    }
                }
            }

            if (visible) {
                this._renderPlayer(ctx, player, isLocal, gameMode);
            }
        }

        // Render effects
        for (const effect of effects) {
            this._renderEffect(ctx, effect);
        }

        // Render tree tops (over players for depth effect)
        this._renderTreeTops(ctx, map, camera, w, h);

        ctx.restore();

        // Render crosshair (desktop only)
        if (!state.controls || !state.controls.isMobile) {
            this._renderCrosshair(ctx, state.controls);
        }
    }

    _renderMap(ctx, map, camera, viewW, viewH) {
        const ts = map.tileSize;
        const startCol = Math.max(0, Math.floor((camera.x - viewW / 2) / ts));
        const endCol = Math.min(map.cols - 1, Math.ceil((camera.x + viewW / 2) / ts));
        const startRow = Math.max(0, Math.floor((camera.y - viewH / 2) / ts));
        const endRow = Math.min(map.rows - 1, Math.ceil((camera.y + viewH / 2) / ts));

        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const tile = map.data[r][c];
                const x = c * ts;
                const y = r * ts;

                // Base tile
                if (tile === BA.TILE.GRASS) {
                    // Subtle grass variation based on position
                    ctx.fillStyle = this.grassVariants[(c * 7 + r * 13) % this.grassVariants.length];
                } else {
                    ctx.fillStyle = this.tileColors[tile] || '#333';
                }
                ctx.fillRect(x, y, ts, ts);

                // Tile details
                switch (tile) {
                    case BA.TILE.WALL:
                        this._renderWall(ctx, x, y, ts, map, c, r);
                        break;
                    case BA.TILE.ROCK:
                        this._renderRock(ctx, x, y, ts);
                        break;
                    case BA.TILE.WATER:
                        this._renderWater(ctx, x, y, ts);
                        break;
                    case BA.TILE.SAND:
                        this._renderSand(ctx, x, y, ts);
                        break;
                    case BA.TILE.DOOR:
                        this._renderDoor(ctx, x, y, ts);
                        break;
                    case BA.TILE.FLOOR:
                        this._renderFloor(ctx, x, y, ts);
                        break;
                    case BA.TILE.TREE:
                        // Tree trunk (rendered at base layer)
                        this._renderTreeTrunk(ctx, x, y, ts);
                        break;
                }

                // Grid lines (subtle)
                ctx.strokeStyle = 'rgba(0,0,0,0.08)';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(x, y, ts, ts);
            }
        }
    }

    _renderWall(ctx, x, y, ts, map, c, r) {
        // Brick pattern
        ctx.fillStyle = '#555568';
        ctx.fillRect(x + 1, y + 1, ts - 2, ts - 2);

        // Brick lines
        ctx.strokeStyle = '#3a3a4a';
        ctx.lineWidth = 1;
        const halfTs = ts / 2;
        ctx.beginPath();
        ctx.moveTo(x, y + halfTs);
        ctx.lineTo(x + ts, y + halfTs);
        ctx.stroke();

        // Vertical brick lines
        ctx.beginPath();
        ctx.moveTo(x + halfTs, y);
        ctx.lineTo(x + halfTs, y + halfTs);
        ctx.moveTo(x + ts * 0.25, y + halfTs);
        ctx.lineTo(x + ts * 0.25, y + ts);
        ctx.moveTo(x + ts * 0.75, y + halfTs);
        ctx.lineTo(x + ts * 0.75, y + ts);
        ctx.stroke();

        // Top highlight
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(x, y, ts, 2);
    }

    _renderRock(ctx, x, y, ts) {
        const cx = x + ts / 2;
        const cy = y + ts / 2;
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(cx + 2, cy + 3, ts * 0.38, ts * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Rock body
        ctx.fillStyle = '#6a6a7a';
        ctx.beginPath();
        ctx.ellipse(cx, cy, ts * 0.38, ts * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.ellipse(cx - 3, cy - 4, ts * 0.15, ts * 0.1, -0.3, 0, Math.PI * 2);
        ctx.fill();
    }

    _renderWater(ctx, x, y, ts) {
        const time = Date.now() / 1000;
        const shimmer = Math.sin(time * 2 + x * 0.1 + y * 0.1) * 10;
        ctx.fillStyle = `hsl(210, 60%, ${25 + shimmer}%)`;
        ctx.fillRect(x, y, ts, ts);
        // Wave lines
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        const offset = Math.sin(time + x * 0.05) * 5;
        ctx.beginPath();
        ctx.moveTo(x, y + ts * 0.3 + offset);
        ctx.quadraticCurveTo(x + ts / 2, y + ts * 0.3 + offset + 4, x + ts, y + ts * 0.3 + offset);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y + ts * 0.6 - offset);
        ctx.quadraticCurveTo(x + ts / 2, y + ts * 0.6 - offset + 4, x + ts, y + ts * 0.6 - offset);
        ctx.stroke();
    }

    _renderSand(ctx, x, y, ts) {
        // Dots for sandy texture
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        for (let i = 0; i < 5; i++) {
            const sx = x + ((i * 17 + y) % ts);
            const sy = y + ((i * 23 + x) % ts);
            ctx.fillRect(sx, sy, 1, 1);
        }
    }

    _renderDoor(ctx, x, y, ts) {
        ctx.fillStyle = '#5a4a2a';
        ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
        // Door handle
        ctx.fillStyle = '#c0a040';
        ctx.beginPath();
        ctx.arc(x + ts * 0.7, y + ts / 2, 2, 0, Math.PI * 2);
        ctx.fill();
        // Door frame
        ctx.strokeStyle = '#4a3a20';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, ts - 4, ts - 4);
    }

    _renderFloor(ctx, x, y, ts) {
        // Tile pattern for indoor floors
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 1, y + 1, ts - 2, ts - 2);
    }

    _renderTreeTrunk(ctx, x, y, ts) {
        if (this.mapType === 'cave') {
            // Caves have crystals/stalagmites, which are drawn fully in _renderTreeTops, so no separate trunks
            return;
        }
        if (this.mapType === 'city') {
            // Lamp post metal base
            const cx = x + ts / 2;
            const by = y + ts - 4;
            ctx.fillStyle = '#475569';
            ctx.fillRect(cx - 2, by - 12, 4, 14);
            return;
        }
        const cx = x + ts / 2;
        const by = y + ts - 4;
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(cx + 2, by + 2, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Trunk
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(cx - 3, by - 14, 6, 16);
    }

    _renderTreeTops(ctx, map, camera, viewW, viewH) {
        const ts = map.tileSize;
        const startCol = Math.max(0, Math.floor((camera.x - viewW / 2) / ts) - 1);
        const endCol = Math.min(map.cols - 1, Math.ceil((camera.x + viewW / 2) / ts) + 1);
        const startRow = Math.max(0, Math.floor((camera.y - viewH / 2) / ts) - 1);
        const endRow = Math.min(map.rows - 1, Math.ceil((camera.y + viewH / 2) / ts) + 1);

        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                if (map.data[r][c] === BA.TILE.TREE) {
                    const cx = c * ts + ts / 2;
                    const cy = r * ts + ts / 2 - 8;
                    const variant = (c * 7 + r * 13) % 3;
                    const radius = 14 + variant * 2;

                    if (this.mapType === 'cave') {
                        // Glowing crystal shapes
                        const crystalHue = 270 + variant * 30; // Violet/pinkish
                        const crystalColor = `hsl(${crystalHue}, 90%, 60%)`;
                        ctx.fillStyle = crystalColor;
                        ctx.shadowColor = crystalColor;
                        ctx.shadowBlur = 8;
                        ctx.beginPath();
                        ctx.moveTo(cx, cy - radius);
                        ctx.lineTo(cx + radius * 0.7, cy);
                        ctx.lineTo(cx, cy + radius);
                        ctx.lineTo(cx - radius * 0.7, cy);
                        ctx.closePath();
                        ctx.fill();
                        ctx.shadowBlur = 0;

                        // Inner highlights
                        ctx.fillStyle = '#fff';
                        ctx.beginPath();
                        ctx.moveTo(cx, cy - radius * 0.6);
                        ctx.lineTo(cx + radius * 0.2, cy);
                        ctx.lineTo(cx, cy + radius * 0.6);
                        ctx.lineTo(cx - radius * 0.2, cy);
                        ctx.closePath();
                        ctx.fill();
                    } else if (this.mapType === 'city') {
                        // Street lamp post glow
                        ctx.fillStyle = '#334155';
                        ctx.fillRect(cx - 5, cy - 5, 10, 10);
                        
                        ctx.fillStyle = '#fef08a'; // Bright yellow lamp glow
                        ctx.shadowColor = '#eab308';
                        ctx.shadowBlur = 12;
                        ctx.beginPath();
                        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.shadowBlur = 0;
                    } else {
                        // Tree canopy shadow
                        ctx.fillStyle = 'rgba(0,40,0,0.4)';
                        ctx.beginPath();
                        ctx.arc(cx + 2, cy + 2, radius, 0, Math.PI * 2);
                        ctx.fill();

                        // Tree canopy
                        const greenShade = 25 + variant * 10;
                        ctx.fillStyle = `hsl(120, 50%, ${greenShade}%)`;
                        ctx.beginPath();
                        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                        ctx.fill();

                        // Highlight
                        ctx.fillStyle = 'rgba(100,200,50,0.15)';
                        ctx.beginPath();
                        ctx.arc(cx - 3, cy - 4, radius * 0.5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
        }
    }

    _renderDecorations(ctx, map, camera, viewW, viewH) {
        for (const dec of map.decorations) {
            if (dec.x < camera.x - viewW / 2 - 20 || dec.x > camera.x + viewW / 2 + 20) continue;
            if (dec.y < camera.y - viewH / 2 - 20 || dec.y > camera.y + viewH / 2 + 20) continue;

            if (dec.type === 'crystal_shard') {
                ctx.fillStyle = dec.color;
                ctx.shadowColor = dec.color;
                ctx.shadowBlur = 5;
                ctx.beginPath();
                ctx.moveTo(dec.x, dec.y - dec.size * 1.8);
                ctx.lineTo(dec.x + dec.size, dec.y);
                ctx.lineTo(dec.x, dec.y + dec.size * 1.2);
                ctx.lineTo(dec.x - dec.size, dec.y);
                ctx.closePath();
                ctx.fill();
                ctx.shadowBlur = 0;
            } else if (dec.type === 'flower') {
                ctx.fillStyle = dec.color;
                ctx.beginPath();
                ctx.arc(dec.x, dec.y, dec.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffdd44';
                ctx.beginPath();
                ctx.arc(dec.x, dec.y, dec.size * 0.4, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Grass tuft / Litter
                ctx.fillStyle = dec.color;
                ctx.beginPath();
                ctx.moveTo(dec.x - dec.size, dec.y);
                ctx.lineTo(dec.x, dec.y - dec.size * 2);
                ctx.lineTo(dec.x + dec.size, dec.y);
                ctx.fill();
            }
        }
    }

    _renderPlayer(ctx, player, isLocal, gameMode) {
        if (!player.alive) return;

        const { x, y, angle, scale } = player;

        ctx.save();
        ctx.translate(x, y);
        if (scale < 1) ctx.scale(scale, scale);

        // --- 1. SHADOW ---
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(2, 5, BA.PLAYER_RADIUS * 1.1, BA.PLAYER_RADIUS * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- 2. NEON & TEAM COLOR CONFIGURATION ---
        let neonColor = '#00ffff'; // Default Cyan neon (FFA / local player)
        if (player.team === 1) neonColor = '#ff3333'; // Red Team neon
        else if (player.team === 2) neonColor = '#3388ff'; // Blue Team neon

        const isDamaged = player.damageFlash > 0;
        const mainColor = isDamaged ? '#ff3333' : '#1a1f26'; // Dark matte tactical armor
        const metalColor = isDamaged ? '#ff6666' : '#374151'; // Highlights / metallic grey
        const glowColor = isDamaged ? '#ff0000' : neonColor;

        // Apply dynamic canvas glowing shadow for visual neon emission
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = isLocal ? 10 : 5;

        // --- 3. TECH BACKPACK (Power Reactor) ---
        // Positioned directly behind the direction the player is facing
        const backX = Math.cos(angle + Math.PI) * 10;
        const backY = Math.sin(angle + Math.PI) * 10;
        ctx.save();
        ctx.translate(backX, backY);
        ctx.rotate(angle);
        ctx.fillStyle = mainColor;
        ctx.fillRect(-6, -8, 8, 16); // Backpack shell
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-6, -8, 8, 16); // Glowing trim
        
        // Power Core glowing diode
        ctx.fillStyle = glowColor;
        ctx.fillRect(-4, -3, 4, 6);
        ctx.restore();

        // --- 4. TACTICAL SHOULDERS & SWAY ANIMATION ---
        const shoulderDist = 11;
        const shoulderRadius = 5.5;
        // Sway shoulders dynamically based on walking frame
        const walkSway = player.isMoving ? Math.sin(player.walkFrame * (Math.PI / 2)) * 3 : 0;

        // Left Shoulder Armor
        ctx.save();
        const leftAngle = angle - Math.PI / 2;
        const leftX = Math.cos(leftAngle) * shoulderDist + Math.cos(angle) * walkSway;
        const leftY = Math.sin(leftAngle) * shoulderDist + Math.sin(angle) * walkSway;
        ctx.translate(leftX, leftY);
        ctx.rotate(angle);
        ctx.fillStyle = metalColor;
        ctx.beginPath();
        ctx.arc(0, 0, shoulderRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        // Right Shoulder Armor
        ctx.save();
        const rightAngle = angle + Math.PI / 2;
        const rightX = Math.cos(rightAngle) * shoulderDist - Math.cos(angle) * walkSway;
        const rightY = Math.sin(rightAngle) * shoulderDist - Math.sin(angle) * walkSway;
        ctx.translate(rightX, rightY);
        ctx.rotate(angle);
        ctx.fillStyle = metalColor;
        ctx.beginPath();
        ctx.arc(0, 0, shoulderRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        // --- 5. TACTICAL CHESTPLATE ---
        ctx.fillStyle = mainColor;
        ctx.beginPath();
        ctx.arc(0, 0, BA.PLAYER_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f1115';
        ctx.lineWidth = 2;
        ctx.stroke();

        // High-tech neon chest stripes
        ctx.save();
        ctx.rotate(angle);
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-4, -6);
        ctx.lineTo(2, 0);
        ctx.lineTo(-4, 6);
        ctx.stroke();
        ctx.restore();

        // --- 6. CYBER HELMET (Head Piece) ---
        const headRadius = BA.PLAYER_RADIUS * 0.7;
        ctx.fillStyle = metalColor;
        ctx.beginPath();
        ctx.arc(0, 0, headRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f1115';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Curved neon Visor - Matches the glowing cyan visor from your reference!
        ctx.save();
        ctx.rotate(angle);
        ctx.fillStyle = glowColor;
        ctx.beginPath();
        ctx.arc(2, 0, headRadius * 0.75, -Math.PI / 3.2, Math.PI / 3.2);
        ctx.lineTo(2.5, 0);
        ctx.closePath();
        ctx.fill();

        // Helmet panel lining
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(-2, 0, headRadius * 0.65, Math.PI * 0.7, Math.PI * 1.3);
        ctx.stroke();
        ctx.restore();

        // Disable glow specifically for the rifle/name drawing
        ctx.shadowBlur = 0;

        // --- 7. FUTURE SCI-FI LASER RIFLE ---
        ctx.save();
        ctx.rotate(angle);
        // Rifle handguard & barrel assembly
        ctx.fillStyle = '#2d3748';
        ctx.fillRect(8, -2, 14, 4); 
        ctx.fillStyle = '#1a202c';
        ctx.fillRect(12, -4.5, 5, 2.5); // Tech Scope
        ctx.fillRect(15, -3, 8, 5.5); // Receiver
        // Neon battery cell on rifle
        ctx.fillStyle = glowColor;
        ctx.fillRect(13, -1, 3.5, 2);
        // Gun barrel & laser target emitter
        ctx.fillStyle = '#4a5568';
        ctx.fillRect(22, -1.5, 8, 3);
        ctx.fillStyle = glowColor;
        ctx.fillRect(30, -1, 2.5, 2.2); // Glowing muzzle diode
        ctx.restore();

        // --- 8. UI LABELS (Names, Badges, Health) ---
        // Name display card
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.font = 'bold 11px Cairo, sans-serif';
        ctx.textAlign = 'center';
        const nameWidth = ctx.measureText(player.name).width;
        ctx.fillRect(-nameWidth / 2 - 4, -BA.PLAYER_RADIUS - 22, nameWidth + 8, 16);
        ctx.fillStyle = isLocal ? var_gold() : '#fff';
        ctx.fillText(player.name, 0, -BA.PLAYER_RADIUS - 10);

        // Health bar above player
        if (player.health < player.maxHealth) {
            const barW = 32;
            const barH = 5;
            const barY = -BA.PLAYER_RADIUS - 29;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(-barW / 2, barY, barW, barH);
            const healthPct = player.health / player.maxHealth;
            const hColor = healthPct > 0.5 ? '#10b981' : healthPct > 0.25 ? '#f59e0b' : '#ef4444';
            ctx.fillStyle = hColor;
            ctx.fillRect(-barW / 2, barY, barW * healthPct, barH);
            ctx.strokeStyle = 'rgba(0,0,0,0.85)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(-barW / 2, barY, barW, barH);
        }

        // Team indicator dot
        if (player.team > 0) {
            ctx.fillStyle = player.team === 1 ? '#ff4444' : '#4488ff';
            ctx.beginPath();
            ctx.arc(0, -BA.PLAYER_RADIUS - 5, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }

        ctx.restore();
    }

    _renderBullet(ctx, bullet) {
        let neonColor = '#00ffff'; // Default Cyan plasma
        if (bullet.team === 1) neonColor = '#ff3333'; // Red plasma
        else if (bullet.team === 2) neonColor = '#3388ff'; // Blue plasma

        // Plasma trail
        ctx.strokeStyle = `rgba(${bullet.team === 1 ? '255,51,51' : bullet.team === 2 ? '51,136,255' : '0,255,255'}, 0.25)`;
        ctx.lineWidth = 3.5;
        if (bullet.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(bullet.trail[0].x, bullet.trail[0].y);
            for (let i = 1; i < bullet.trail.length; i++) {
                ctx.lineTo(bullet.trail[i].x, bullet.trail[i].y);
            }
            ctx.lineTo(bullet.x, bullet.y);
            ctx.stroke();
        }

        // Plasma energy glow
        ctx.shadowColor = neonColor;
        ctx.shadowBlur = 8;
        ctx.fillStyle = neonColor;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Plasma hot-core
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
    }

    _renderEffect(ctx, effect) {
        const alpha = effect.lifetime / effect.maxLifetime;
        for (const p of effect.particles) {
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(effect.x + p.x, effect.y + p.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    _renderCrosshair(ctx, controls) {
        if (!controls) return;
        const x = controls.mouseX;
        const y = controls.mouseY;
        const size = 12;

        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;

        // Cross lines
        ctx.beginPath();
        ctx.moveTo(x - size, y);
        ctx.lineTo(x - 4, y);
        ctx.moveTo(x + 4, y);
        ctx.lineTo(x + size, y);
        ctx.moveTo(x, y - size);
        ctx.lineTo(x, y - 4);
        ctx.moveTo(x, y + 4);
        ctx.lineTo(x, y + size);
        ctx.stroke();

        // Center dot
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
    }
};

// Helper function for gold color reference
function var_gold() {
    return '#f59e0b';
}
