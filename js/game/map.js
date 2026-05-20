/* ═══════════════════════════════════════════
   ساحة المعركة - Map System
   Procedural map with buildings, trees, rocks
   ═══════════════════════════════════════════ */
window.BA = window.BA || {};

BA.TILE_SIZE = 40;
BA.MAP_COLS = 120;
BA.MAP_ROWS = 90;
BA.TILE = {
    GRASS: 0,
    TREE: 1,
    WALL: 2,
    ROCK: 3,
    WATER: 4,
    SAND: 5,
    FLOOR: 6,
    DOOR: 7
};

BA.GameMap = class GameMap {
    constructor(mapType = 'farm', seed = 0.5, playerCount = 2) {
        this.mapType = mapType;
        this.seed = seed;
        this.playerCount = playerCount;

        // Set cols & rows dynamically based on the player count
        if (this.playerCount <= 4) {
            this.cols = 60;
            this.rows = 45;
        } else if (this.playerCount <= 8) {
            this.cols = 90;
            this.rows = 65;
        } else {
            this.cols = BA.MAP_COLS;
            this.rows = BA.MAP_ROWS;
        }

        this.tileSize = BA.TILE_SIZE;
        this.width = this.cols * this.tileSize;
        this.height = this.rows * this.tileSize;
        this.data = [];
        this.spawnPoints = [];
        this.decorations = []; // visual-only decorations

        // Seed-based pseudo-random number generator
        let s = this.seed;
        this.random = () => {
            const x = Math.sin(s++) * 10000;
            return x - Math.floor(x);
        };

        this.generate();
    }

    generate() {
        if (this.mapType === 'cave') {
            this._generateCave();
        } else if (this.mapType === 'village') {
            this._generateVillage();
        } else if (this.mapType === 'city') {
            this._generateCity();
        } else {
            this._generateFarm();
        }
    }

    _generateFarm() {
        // Fill with grass
        this.data = [];
        for (let r = 0; r < this.rows; r++) {
            this.data[r] = [];
            for (let c = 0; c < this.cols; c++) {
                this.data[r][c] = BA.TILE.GRASS;
            }
        }

        // Border walls
        for (let c = 0; c < this.cols; c++) {
            this.data[0][c] = BA.TILE.WALL;
            this.data[this.rows - 1][c] = BA.TILE.WALL;
        }
        for (let r = 0; r < this.rows; r++) {
            this.data[r][0] = BA.TILE.WALL;
            this.data[r][this.cols - 1] = BA.TILE.WALL;
        }

        const mapAreaRatio = (this.cols * this.rows) / (BA.MAP_COLS * BA.MAP_ROWS);

        // === BUILDINGS ===
        // Central fortress
        const cfX = Math.floor(this.cols / 2) - 7;
        const cfY = Math.floor(this.rows / 2) - 6;
        const cfW = 14;
        const cfH = 12;
        this._buildRoom(cfX, cfY, cfW, cfH);

        const divX = cfX + 7;
        this._buildWall(divX, cfY + 1, divX, cfY + cfH - 2); // vertical divider
        
        const doorY1 = cfY + Math.floor(cfH / 2) - 2;
        const doorY2 = cfY + Math.floor(cfH / 2) - 1;
        if (this.data[doorY1] && this.data[doorY1][divX] !== undefined) this.data[doorY1][divX] = BA.TILE.DOOR;
        if (this.data[doorY2] && this.data[doorY2][divX] !== undefined) this.data[doorY2][divX] = BA.TILE.DOOR;

        // More rooms spread out
        this._buildRoom(10, 10, 10, 8);
        this._buildRoom(this.cols - 25, 10, 12, 9);
        this._buildRoom(12, this.rows - 20, 10, 8);
        this._buildRoom(this.cols - 28, this.rows - 22, 14, 10);

        // Sub buildings
        this._buildRoom(Math.floor(this.cols * 0.25), Math.floor(this.rows * 0.22), 8, 6);
        this._buildRoom(Math.floor(this.cols * 0.65), Math.floor(this.rows * 0.24), 8, 6);
        this._buildRoom(Math.floor(this.cols * 0.27), Math.floor(this.rows * 0.66), 9, 7);
        this._buildRoom(Math.floor(this.cols * 0.62), Math.floor(this.rows * 0.64), 8, 6);

        // Mid perimeter shelters
        this._buildRoom(4, Math.floor(this.rows / 2) - 3, 6, 6);
        this._buildRoom(this.cols - 10, Math.floor(this.rows / 2) - 3, 6, 6);

        // === TREE CLUSTERS (Forests to hide in) ===
        // Large forest zones
        this._placeCluster(BA.TILE.TREE, Math.floor(this.cols * 0.2), 4, Math.min(18, Math.floor(this.cols * 0.15)), Math.min(12, Math.floor(this.rows * 0.13)), 0.45);
        this._placeCluster(BA.TILE.TREE, Math.floor(this.cols * 0.62), 4, Math.min(16, Math.floor(this.cols * 0.13)), Math.min(12, Math.floor(this.rows * 0.13)), 0.45);
        this._placeCluster(BA.TILE.TREE, 4, Math.floor(this.rows * 0.57), Math.min(14, Math.floor(this.cols * 0.12)), Math.min(14, Math.floor(this.rows * 0.15)), 0.4);
        this._placeCluster(BA.TILE.TREE, this.cols - 18, Math.floor(this.rows * 0.57), Math.min(14, Math.floor(this.cols * 0.12)), Math.min(14, Math.floor(this.rows * 0.15)), 0.4);
        this._placeCluster(BA.TILE.TREE, Math.floor(this.cols * 0.4), Math.floor(this.rows * 0.24), Math.min(22, Math.floor(this.cols * 0.18)), Math.min(10, Math.floor(this.rows * 0.11)), 0.35); // center-top
        this._placeCluster(BA.TILE.TREE, Math.floor(this.cols * 0.4), Math.floor(this.rows * 0.68), Math.min(22, Math.floor(this.cols * 0.18)), Math.min(10, Math.floor(this.rows * 0.11)), 0.35); // center-bottom

        // Scattered clusters
        this._placeCluster(BA.TILE.TREE, Math.floor(this.cols * 0.16), Math.floor(this.rows * 0.38), 10, 8, 0.3);
        this._placeCluster(BA.TILE.TREE, Math.floor(this.cols * 0.73), Math.floor(this.rows * 0.38), 10, 8, 0.3);
        this._placeCluster(BA.TILE.TREE, Math.floor(this.cols * 0.45), Math.floor(this.rows * 0.86), 12, 8, 0.3);

        // Single tree scatter
        const treeScatterCount = Math.floor(120 * mapAreaRatio);
        this._scatterTiles(BA.TILE.TREE, treeScatterCount, 2, this.cols - 4, 2, this.rows - 4);

        // === ROCKS ===
        this._placeCluster(BA.TILE.ROCK, Math.floor(this.cols * 0.33), Math.floor(this.rows * 0.13), 6, 4, 0.45);
        this._placeCluster(BA.TILE.ROCK, Math.floor(this.cols * 0.61), Math.floor(this.rows * 0.13), 6, 4, 0.45);
        this._placeCluster(BA.TILE.ROCK, Math.floor(this.cols * 0.16), Math.floor(this.rows * 0.68), 5, 5, 0.4);
        this._placeCluster(BA.TILE.ROCK, Math.floor(this.cols * 0.76), Math.floor(this.rows * 0.68), 5, 5, 0.4);
        this._placeCluster(BA.TILE.ROCK, Math.floor(this.cols * 0.48), Math.floor(this.rows * 0.37), 4, 3, 0.5);
        this._placeCluster(BA.TILE.ROCK, Math.floor(this.cols * 0.48), Math.floor(this.rows * 0.61), 4, 3, 0.5);
        
        const rockScatterCount = Math.floor(60 * mapAreaRatio);
        this._scatterTiles(BA.TILE.ROCK, rockScatterCount, 2, this.cols - 4, 2, this.rows - 4);

        // === WATER ===
        // Giant lake/ponds
        this._placeOval(BA.TILE.WATER, Math.floor(this.cols * 0.16), Math.floor(this.rows * 0.28), 6, 4);
        this._placeOval(BA.TILE.WATER, Math.floor(this.cols * 0.83), Math.floor(this.rows * 0.28), 6, 4);
        this._placeOval(BA.TILE.WATER, Math.floor(this.cols * 0.5), Math.floor(this.rows * 0.11), 7, 3);
        this._placeOval(BA.TILE.WATER, Math.floor(this.cols * 0.5), Math.floor(this.rows * 0.86), 7, 3);
        this._surroundWith(BA.TILE.WATER, BA.TILE.SAND);

        // === SPAWN POINTS ===
        this._generateSpawns();

        // Generate decorations (flowers, grass tufts)
        this.decorations = [];
        const decorationCount = Math.floor(600 * mapAreaRatio);
        for (let i = 0; i < decorationCount; i++) {
            const x = this.random() * this.width;
            const y = this.random() * this.height;
            const tc = this.worldToTile(x, y);
            if (this.data[tc.row] && this.data[tc.row][tc.col] === BA.TILE.GRASS) {
                this.decorations.push({
                    x, y,
                    type: this.random() > 0.5 ? 'flower' : 'grass_tuft',
                    color: `hsl(${90 + this.random() * 40}, ${50 + this.random() * 30}%, ${30 + this.random() * 20}%)`,
                    size: 2 + this.random() * 4
                });
            }
        }
    }

    _generateCave() {
        this.data = [];
        for (let r = 0; r < this.rows; r++) {
            this.data[r] = [];
            for (let c = 0; c < this.cols; c++) {
                this.data[r][c] = BA.TILE.GRASS; // Reused as rocky ground
            }
        }

        // Border walls
        for (let c = 0; c < this.cols; c++) {
            this.data[0][c] = BA.TILE.WALL;
            this.data[this.rows - 1][c] = BA.TILE.WALL;
        }
        for (let r = 0; r < this.rows; r++) {
            this.data[r][0] = BA.TILE.WALL;
            this.data[r][this.cols - 1] = BA.TILE.WALL;
        }

        const mapAreaRatio = (this.cols * this.rows) / (BA.MAP_COLS * BA.MAP_ROWS);

        // Cave rock pillars & natural walls
        const pillarCount = Math.floor(28 * mapAreaRatio);
        for (let i = 0; i < pillarCount; i++) {
            const cx = Math.floor(10 + this.random() * (this.cols - 20));
            const cy = Math.floor(10 + this.random() * (this.rows - 20));
            const rx = Math.floor(4 + this.random() * 8);
            const ry = Math.floor(4 + this.random() * 8);
            this._placeOval(BA.TILE.ROCK, cx, cy, rx, ry);
        }

        // Crystal vaults (Chambers inside the cave)
        const vaultCount = Math.max(2, Math.floor(6 * mapAreaRatio));
        for (let i = 0; i < vaultCount; i++) {
            const x = Math.floor(15 + this.random() * (this.cols - 35));
            const y = Math.floor(15 + this.random() * (this.rows - 35));
            this._buildRoom(x, y, 10, 10);
        }

        // Crystalline columns/glowing stalagmites (reusing TREE)
        const stalagmiteCount = Math.max(4, Math.floor(15 * mapAreaRatio));
        for (let i = 0; i < stalagmiteCount; i++) {
            const cx = Math.floor(5 + this.random() * (this.cols - 10));
            const cy = Math.floor(5 + this.random() * (this.rows - 10));
            this._placeCluster(BA.TILE.TREE, cx, cy, 10, 10, 0.45);
        }
        const treeScatterCave = Math.floor(160 * mapAreaRatio);
        this._scatterTiles(BA.TILE.TREE, treeScatterCave, 2, this.cols - 4, 2, this.rows - 4);

        // Acid/crystal pools (reusing WATER/SAND)
        const poolCount = Math.max(2, Math.floor(6 * mapAreaRatio));
        for (let i = 0; i < poolCount; i++) {
            const cx = Math.floor(10 + this.random() * (this.cols - 20));
            const cy = Math.floor(10 + this.random() * (this.rows - 20));
            this._placeOval(BA.TILE.WATER, cx, cy, 8, 5);
        }
        this._surroundWith(BA.TILE.WATER, BA.TILE.SAND);

        this._generateSpawns();

        // Cave crystals decorations
        this.decorations = [];
        const caveDecoCount = Math.floor(500 * mapAreaRatio);
        for (let i = 0; i < caveDecoCount; i++) {
            const x = this.random() * this.width;
            const y = this.random() * this.height;
            const tc = this.worldToTile(x, y);
            if (this.data[tc.row] && this.data[tc.row][tc.col] === BA.TILE.GRASS) {
                this.decorations.push({
                    x, y,
                    type: 'crystal_shard',
                    color: `hsl(${260 + this.random() * 60}, 90%, ${65 + this.random() * 20}%)`,
                    size: 2 + this.random() * 3
                });
            }
        }
    }

    _generateVillage() {
        this.data = [];
        for (let r = 0; r < this.rows; r++) {
            this.data[r] = [];
            for (let c = 0; c < this.cols; c++) {
                this.data[r][c] = BA.TILE.GRASS;
            }
        }

        // Border walls
        for (let c = 0; c < this.cols; c++) {
            this.data[0][c] = BA.TILE.WALL;
            this.data[this.rows - 1][c] = BA.TILE.WALL;
        }
        for (let r = 0; r < this.rows; r++) {
            this.data[r][0] = BA.TILE.WALL;
            this.data[r][this.cols - 1] = BA.TILE.WALL;
        }

        const mapAreaRatio = (this.cols * this.rows) / (BA.MAP_COLS * BA.MAP_ROWS);

        // Center square
        const sqW = Math.max(6, Math.floor(12 * Math.sqrt(mapAreaRatio)));
        const sqH = Math.max(4, Math.floor(9 * Math.sqrt(mapAreaRatio)));
        this._placeOval(BA.TILE.SAND, Math.floor(this.cols / 2), Math.floor(this.rows / 2), sqW, sqH);

        // Build grid of small cottages
        const houseWidth = 8;
        const houseHeight = 6;
        for (let r = 10; r < this.rows - 15; r += 18) {
            for (let c = 10; c < this.cols - 15; c += 22) {
                const ox = c + Math.floor(this.random() * 6);
                const oy = r + Math.floor(this.random() * 4);
                this._buildRoom(ox, oy, houseWidth, houseHeight);
            }
        }

        // Gardens and outer forests
        const fW = Math.max(8, Math.floor(15 * Math.sqrt(mapAreaRatio)));
        const fH = Math.max(7, Math.floor(14 * Math.sqrt(mapAreaRatio)));
        this._placeCluster(BA.TILE.TREE, 4, 4, fW, fH, 0.4);
        this._placeCluster(BA.TILE.TREE, this.cols - (fW + 5), 4, fW, fH, 0.4);
        this._placeCluster(BA.TILE.TREE, 4, this.rows - (fH + 5), fW, fH, 0.4);
        this._placeCluster(BA.TILE.TREE, this.cols - (fW + 5), this.rows - (fH + 5), fW, fH, 0.4);
        
        const scatteredTreesVillage = Math.floor(180 * mapAreaRatio);
        this._scatterTiles(BA.TILE.TREE, scatteredTreesVillage, 2, this.cols - 4, 2, this.rows - 4);

        // Water ponds
        const villagePondsCount = Math.max(2, Math.floor(5 * mapAreaRatio));
        for (let i = 0; i < villagePondsCount; i++) {
            const cx = Math.floor(15 + this.random() * (this.cols - 30));
            const cy = Math.floor(15 + this.random() * (this.rows - 30));
            this._placeOval(BA.TILE.WATER, cx, cy, 6, 4);
        }
        this._surroundWith(BA.TILE.WATER, BA.TILE.SAND);

        this._generateSpawns();

        // Village decorations (red/yellow flowers)
        this.decorations = [];
        const villageDecoCount = Math.floor(500 * mapAreaRatio);
        for (let i = 0; i < villageDecoCount; i++) {
            const x = this.random() * this.width;
            const y = this.random() * this.height;
            const tc = this.worldToTile(x, y);
            if (this.data[tc.row] && this.data[tc.row][tc.col] === BA.TILE.GRASS) {
                this.decorations.push({
                    x, y,
                    type: this.random() > 0.4 ? 'flower' : 'grass_tuft',
                    color: this.random() > 0.5 ? '#f43f5e' : '#eab308',
                    size: 2 + this.random() * 4
                });
            }
        }
    }

    _generateCity() {
        this.data = [];
        for (let r = 0; r < this.rows; r++) {
            this.data[r] = [];
            for (let c = 0; c < this.cols; c++) {
                this.data[r][c] = BA.TILE.GRASS; // Reused as road asphalt
            }
        }

        // Border walls
        for (let c = 0; c < this.cols; c++) {
            this.data[0][c] = BA.TILE.WALL;
            this.data[this.rows - 1][c] = BA.TILE.WALL;
        }
        for (let r = 0; r < this.rows; r++) {
            this.data[r][0] = BA.TILE.WALL;
            this.data[r][this.cols - 1] = BA.TILE.WALL;
        }

        const mapAreaRatio = (this.cols * this.rows) / (BA.MAP_COLS * BA.MAP_ROWS);

        // Blocks columns & rows coordinates generated dynamically
        const colBlocks = [];
        const numColBlocks = this.playerCount <= 4 ? 3 : 5; // fewer blocks for smaller maps to keep roads wide enough!
        const colMargin = 5;
        const colStep = (this.cols - colMargin * 2) / (numColBlocks - 1);
        for (let i = 0; i < numColBlocks; i++) {
            colBlocks.push(Math.floor(colMargin + i * colStep));
        }

        const rowBlocks = [];
        const numRowBlocks = this.playerCount <= 4 ? 3 : 5;
        const rowMargin = 5;
        const rowStep = (this.rows - rowMargin * 2) / (numRowBlocks - 1);
        for (let i = 0; i < numRowBlocks; i++) {
            rowBlocks.push(Math.floor(rowMargin + i * rowStep));
        }

        for (let r = 0; r < rowBlocks.length - 1; r++) {
            for (let c = 0; c < colBlocks.length - 1; c++) {
                const bx = colBlocks[c] + 3;
                const by = rowBlocks[r] + 3;
                const bw = colBlocks[c+1] - colBlocks[c] - 6;
                const bh = rowBlocks[r+1] - rowBlocks[r] - 6;
                
                if (bw > 4 && bh > 4) {
                    this._buildRoom(bx, by, bw, bh);
                    if (bw > 12) {
                        this._buildWall(bx + Math.floor(bw/2), by + 1, bx + Math.floor(bw/2), by + bh - 2);
                        // Make vertical divider door 2 tiles tall for seamless passage
                        const dividerDoorRow = by + Math.floor(bh/2);
                        const dividerCol = bx + Math.floor(bw/2);
                        this.data[dividerDoorRow][dividerCol] = BA.TILE.DOOR;
                        if (dividerDoorRow + 1 < by + bh - 1) {
                            this.data[dividerDoorRow + 1][dividerCol] = BA.TILE.DOOR;
                        }
                    }
                }
            }
        }

        // Central park block
        const cx = Math.floor(this.cols / 2);
        const cy = Math.floor(this.rows / 2);
        const parkW = Math.max(7, Math.floor(14 * Math.sqrt(mapAreaRatio)));
        const parkH = Math.max(5, Math.floor(10 * Math.sqrt(mapAreaRatio)));
        this._placeOval(BA.TILE.SAND, cx, cy, parkW, parkH);
        this._placeCluster(BA.TILE.TREE, cx - Math.floor(parkW * 0.57), cy - Math.floor(parkH * 0.6), parkW + 2, parkH + 2, 0.55);

        // Concrete barriers/street obstacles (reusing ROCK)
        const cityBarriersCount = Math.floor(85 * mapAreaRatio);
        this._scatterTiles(BA.TILE.ROCK, cityBarriersCount, 2, this.cols - 4, 2, this.rows - 4);
        
        // Puddles
        this._placeOval(BA.TILE.WATER, Math.floor(this.cols * 0.125), Math.floor(this.rows * 0.5), 6, 3);
        this._placeOval(BA.TILE.WATER, Math.floor(this.cols * 0.875), Math.floor(this.rows * 0.5), 6, 3);

        this._generateSpawns();

        // City garbage/debris decorations
        this.decorations = [];
        const cityDecoCount = Math.floor(300 * mapAreaRatio);
        for (let i = 0; i < cityDecoCount; i++) {
            const x = this.random() * this.width;
            const y = this.random() * this.height;
            const tc = this.worldToTile(x, y);
            if (this.data[tc.row] && this.data[tc.row][tc.col] === BA.TILE.GRASS) {
                this.decorations.push({
                    x, y,
                    type: 'litter',
                    color: this.random() > 0.5 ? '#94a3b8' : '#cbd5e1',
                    size: 1 + this.random() * 2
                });
            }
        }
    }

    _isNearDoor(c, r) {
        const dirs = [
            [-1, 0], [1, 0], [0, -1], [0, 1],
            [-1, -1], [-1, 1], [1, -1], [1, 1],
            [-2, 0], [2, 0], [0, -2], [0, 2],
            [-2, -1], [-2, 1], [2, -1], [2, 1],
            [-1, -2], [1, -2], [-1, 2], [1, 2]
        ];
        if (this.getTile(c, r) === BA.TILE.DOOR) return true;
        for (const [dc, dr] of dirs) {
            if (this.getTile(c + dc, r + dr) === BA.TILE.DOOR) {
                return true;
            }
        }
        return false;
    }

    _isSpawnPointSafe(startCol, startRow) {
        // Run a fast BFS to count reachable tiles.
        // If it can reach at least 500 tiles, it's connected to the main open world and not trapped.
        const visited = Array(this.rows).fill(null).map(() => Array(this.cols).fill(false));
        const queue = [{ c: startCol, r: startRow }];
        visited[startRow][startCol] = true;
        let count = 0;
        
        while (queue.length > 0) {
            const curr = queue.shift();
            count++;
            if (count >= 500) return true; // Safe, connected to main world!
            
            const neighbors = [
                { c: curr.c - 1, r: curr.r },
                { c: curr.c + 1, r: curr.r },
                { c: curr.c, r: curr.r - 1 },
                { c: curr.c, r: curr.r + 1 }
            ];
            
            for (const n of neighbors) {
                if (n.r >= 0 && n.r < this.rows && n.c >= 0 && n.c < this.cols) {
                    if (!visited[n.r][n.c] && !this.isSolid(n.c, n.r)) {
                        visited[n.r][n.c] = true;
                        queue.push(n);
                    }
                }
            }
        }
        
        return false; // Trapped!
    }

    _generateSpawns() {
        this.spawnPoints = [];
        const spawnCandidates = [
            // Corners
            { x: 3, y: 3 }, { x: this.cols - 4, y: 3 },
            { x: 3, y: this.rows - 4 }, { x: this.cols - 4, y: this.rows - 4 },
            // Edges mid
            { x: Math.floor(this.cols / 2), y: 3 },
            { x: Math.floor(this.cols / 2), y: this.rows - 4 },
            { x: 3, y: Math.floor(this.rows / 2) },
            { x: this.cols - 4, y: Math.floor(this.rows / 2) },
            // Quarters
            { x: Math.floor(this.cols * 0.16), y: Math.floor(this.rows * 0.22) },
            { x: Math.floor(this.cols * 0.83), y: Math.floor(this.rows * 0.22) },
            { x: Math.floor(this.cols * 0.16), y: Math.floor(this.rows * 0.77) },
            { x: Math.floor(this.cols * 0.83), y: Math.floor(this.rows * 0.77) },
            { x: Math.floor(this.cols * 0.33), y: Math.floor(this.rows * 0.33) },
            { x: Math.floor(this.cols * 0.66), y: Math.floor(this.rows * 0.33) },
            { x: Math.floor(this.cols * 0.33), y: Math.floor(this.rows * 0.66) },
            { x: Math.floor(this.cols * 0.66), y: Math.floor(this.rows * 0.66) },
            // Outer mids
            { x: Math.floor(this.cols * 0.08), y: Math.floor(this.rows * 0.5) },
            { x: Math.floor(this.cols * 0.91), y: Math.floor(this.rows * 0.5) },
            { x: Math.floor(this.cols * 0.5), y: Math.floor(this.rows * 0.2) },
            { x: Math.floor(this.cols * 0.5), y: Math.floor(this.rows * 0.8) },
            // Center ring
            { x: Math.floor(this.cols * 0.41), y: Math.floor(this.rows * 0.5) },
            { x: Math.floor(this.cols * 0.58), y: Math.floor(this.rows * 0.5) },
            { x: Math.floor(this.cols * 0.5), y: Math.floor(this.rows * 0.4) },
            { x: Math.floor(this.cols * 0.5), y: Math.floor(this.rows * 0.6) },
            { x: Math.floor(this.cols * 0.25), y: Math.floor(this.rows * 0.5) },
            { x: Math.floor(this.cols * 0.75), y: Math.floor(this.rows * 0.5) },
        ];

        for (const sp of spawnCandidates) {
            let found = false;
            // Search nearby for a walkable spot that is also in the main open world
            for (let dr = -3; dr <= 3 && !found; dr++) {
                for (let dc = -3; dc <= 3 && !found; dc++) {
                    const tcCol = Math.floor(sp.x + dc);
                    const tcRow = Math.floor(sp.y + dr);
                    if (tcRow >= 0 && tcRow < this.rows && tcCol >= 0 && tcCol < this.cols) {
                        const wx = tcCol * this.tileSize + this.tileSize / 2;
                        const wy = tcRow * this.tileSize + this.tileSize / 2;
                        if (this.isWalkable(wx, wy, 14) && this._isSpawnPointSafe(tcCol, tcRow)) {
                            this.spawnPoints.push({ x: wx, y: wy });
                            found = true;
                        }
                    }
                }
            }
        }
    }

    _buildRoom(x, y, w, h) {
        for (let r = y; r < y + h && r < this.rows; r++) {
            for (let c = x; c < x + w && c < this.cols; c++) {
                if (r === y || r === y + h - 1 || c === x || c === x + w - 1) {
                    this.data[r][c] = BA.TILE.WALL;
                } else {
                    this.data[r][c] = BA.TILE.FLOOR;
                }
            }
        }
        // Add doors
        const doorPositions = [
            { r: y, c: x + Math.floor(w / 3) },           // top (shifted away from divider col)
            { r: y + h - 1, c: x + Math.floor(2 * w / 3) },   // bottom (shifted away from divider col)
            { r: y + Math.floor(h / 2), c: x },            // left
            { r: y + Math.floor(h / 2), c: x + w - 1 },   // right
        ];
        // Add 2 random doors
        const shuffled = doorPositions.sort(() => this.random() - 0.5);
        for (let i = 0; i < 2; i++) {
            const d = shuffled[i];
            if (d.r >= 0 && d.r < this.rows && d.c >= 0 && d.c < this.cols) {
                this.data[d.r][d.c] = BA.TILE.DOOR;
                
                // Expand to 2-tile wide/tall doors for double doors & fluid movement
                if (d.r === y || d.r === y + h - 1) {
                    // Top or bottom door: expand horizontally
                    if (d.c + 1 < x + w - 1) {
                        this.data[d.r][d.c + 1] = BA.TILE.DOOR;
                    } else if (d.c - 1 > x) {
                        this.data[d.r][d.c - 1] = BA.TILE.DOOR;
                    }
                } else {
                    // Left or right door: expand vertically
                    if (d.r + 1 < y + h - 1) {
                        this.data[d.r + 1][d.c] = BA.TILE.DOOR;
                    } else if (d.r - 1 > y) {
                        this.data[d.r - 1][d.c] = BA.TILE.DOOR;
                    }
                }
            }
        }
    }

    _buildWall(x1, y1, x2, y2) {
        if (x1 === x2) {
            for (let r = Math.min(y1, y2); r <= Math.max(y1, y2); r++) {
                if (r >= 0 && r < this.rows && x1 >= 0 && x1 < this.cols) {
                    this.data[r][x1] = BA.TILE.WALL;
                }
            }
        } else {
            for (let c = Math.min(x1, x2); c <= Math.max(x1, x2); c++) {
                if (y1 >= 0 && y1 < this.rows && c >= 0 && c < this.cols) {
                    this.data[y1][c] = BA.TILE.WALL;
                }
            }
        }
    }

    _placeCluster(tile, x, y, w, h, density) {
        for (let r = y; r < y + h && r < this.rows; r++) {
            for (let c = x; c < x + w && c < this.cols; c++) {
                if (r > 0 && r < this.rows - 1 && c > 0 && c < this.cols - 1) {
                    if (this.data[r][c] === BA.TILE.GRASS && this.random() < density && !this._isNearDoor(c, r)) {
                        this.data[r][c] = tile;
                    }
                }
            }
        }
    }

    _placeOval(tile, cx, cy, rx, ry) {
        for (let r = cy - ry; r <= cy + ry; r++) {
            for (let c = cx - rx; c <= cx + rx; c++) {
                if (r > 0 && r < this.rows - 1 && c > 0 && c < this.cols - 1) {
                    const dx = (c - cx) / rx;
                    const dy = (r - cy) / ry;
                    if (dx * dx + dy * dy <= 1) {
                        const isSolidTile = tile === BA.TILE.ROCK || tile === BA.TILE.WATER || tile === BA.TILE.WALL || tile === BA.TILE.TREE;
                        if (isSolidTile && this._isNearDoor(c, r)) {
                            continue;
                        }
                        this.data[r][c] = tile;
                    }
                }
            }
        }
    }

    _surroundWith(targetTile, borderTile) {
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
        const toChange = [];
        for (let r = 1; r < this.rows - 1; r++) {
            for (let c = 1; c < this.cols - 1; c++) {
                if (this.data[r][c] === targetTile) {
                    for (const [dr, dc] of dirs) {
                        const nr = r + dr, nc = c + dc;
                        if (this.data[nr][nc] === BA.TILE.GRASS) {
                            toChange.push([nr, nc]);
                        }
                    }
                }
            }
        }
        for (const [r, c] of toChange) {
            this.data[r][c] = borderTile;
        }
    }

    _scatterTiles(tile, count, minC, maxC, minR, maxR) {
        for (let i = 0; i < count; i++) {
            const c = Math.floor(minC + this.random() * (maxC - minC));
            const r = Math.floor(minR + this.random() * (maxR - minR));
            if (this.data[r] && this.data[r][c] === BA.TILE.GRASS && !this._isNearDoor(c, r)) {
                this.data[r][c] = tile;
            }
        }
    }

    getTile(col, row) {
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return BA.TILE.WALL;
        return this.data[row][col];
    }

    isSolid(col, row) {
        const tile = this.getTile(col, row);
        return tile === BA.TILE.WALL || tile === BA.TILE.ROCK || tile === BA.TILE.TREE || tile === BA.TILE.WATER;
    }

    isWalkable(worldX, worldY, radius) {
        radius = radius || 12; // default to new optimal radius
        const inset = radius * 0.7071; // cos(45deg) for precise diagonal circle collision
        // 8-point circle approximation check for flawless sliding & door entry
        const checks = [
            { x: worldX, y: worldY },
            // Cardinal directions (at full radius)
            { x: worldX - radius, y: worldY },
            { x: worldX + radius, y: worldY },
            { x: worldX, y: worldY - radius },
            { x: worldX, y: worldY + radius },
            // Diagonals (at radius * cos(45))
            { x: worldX - inset, y: worldY - inset },
            { x: worldX + inset, y: worldY - inset },
            { x: worldX - inset, y: worldY + inset },
            { x: worldX + inset, y: worldY + inset }
        ];
        for (const pt of checks) {
            const tc = this.worldToTile(pt.x, pt.y);
            if (this.isSolid(tc.col, tc.row)) return false;
        }
        return true;
    }

    worldToTile(worldX, worldY) {
        return {
            col: Math.floor(worldX / this.tileSize),
            row: Math.floor(worldY / this.tileSize)
        };
    }

    getSpawnPoints() {
        return [...this.spawnPoints];
    }

    getRandomSpawn() {
        const sp = this.spawnPoints;
        return sp[Math.floor(this.random() * sp.length)];
    }

    // Check if a bullet can pass through a tile
    isBulletBlocking(col, row) {
        const tile = this.getTile(col, row);
        return tile === BA.TILE.WALL || tile === BA.TILE.ROCK;
        // Trees and doors don't block bullets
    }
};
