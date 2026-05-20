/* ═══════════════════════════════════════════
   ساحة المعركة - Bullet System
   ═══════════════════════════════════════════ */
window.BA = window.BA || {};

BA.BULLET_SPEED = 10;
BA.BULLET_DAMAGE = 25;
BA.SHOOT_COOLDOWN = 12; // frames between shots

BA.Bullet = class Bullet {
    constructor(x, y, angle, ownerId, team) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * BA.BULLET_SPEED;
        this.vy = Math.sin(angle) * BA.BULLET_SPEED;
        this.angle = angle;
        this.ownerId = ownerId;
        this.team = team || 0;
        this.damage = BA.BULLET_DAMAGE;
        this.speed = BA.BULLET_SPEED;
        this.lifetime = 90; // frames (~1.5 sec at 60fps)
        this.active = true;
        this.trail = []; // for visual trail effect
    }

    update(map) {
        if (!this.active) return false;

        // Store trail position
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 5) this.trail.shift();

        // Move
        this.x += this.vx;
        this.y += this.vy;

        // Decrease lifetime
        this.lifetime--;
        if (this.lifetime <= 0) {
            this.active = false;
            return false;
        }

        // Check map collision
        if (map) {
            const tc = map.worldToTile(this.x, this.y);
            if (map.isBulletBlocking(tc.col, tc.row)) {
                this.active = false;
                return false;
            }
        }

        // Check world bounds
        const limitX = map ? map.width : (BA.MAP_COLS * BA.TILE_SIZE);
        const limitY = map ? map.height : (BA.MAP_ROWS * BA.TILE_SIZE);
        if (this.x < 0 || this.x > limitX ||
            this.y < 0 || this.y > limitY) {
            this.active = false;
            return false;
        }

        return true;
    }

    // Check collision with a circular target
    hitsPlayer(player) {
        if (!this.active || !player.alive) return false;
        if (player.id === this.ownerId) return false; // can't hit yourself
        const dx = this.x - player.x;
        const dy = this.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < (BA.PLAYER_RADIUS || 14);
    }

    serialize() {
        return {
            x: this.x,
            y: this.y,
            vx: this.vx,
            vy: this.vy,
            ownerId: this.ownerId,
            team: this.team,
            damage: this.damage,
            lifetime: this.lifetime
        };
    }

    static deserialize(data) {
        const b = new BA.Bullet(data.x, data.y, 0, data.ownerId, data.team);
        b.vx = data.vx;
        b.vy = data.vy;
        b.damage = data.damage;
        b.lifetime = data.lifetime;
        b.angle = Math.atan2(b.vy, b.vx);
        return b;
    }
};

// Visual effect for bullet impacts
BA.Effect = class Effect {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'hit', 'spark', 'blood'
        this.lifetime = 20;
        this.maxLifetime = 20;
        this.particles = [];

        const count = type === 'blood' ? 8 : 5;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3;
            this.particles.push({
                x: 0, y: 0,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 1 + Math.random() * 3,
                color: this._getColor(type)
            });
        }
    }

    _getColor(type) {
        switch (type) {
            case 'blood': return `hsl(0, 80%, ${30 + Math.random() * 30}%)`;
            case 'spark': return `hsl(${40 + Math.random() * 20}, 100%, ${60 + Math.random() * 30}%)`;
            case 'hit': return `hsl(0, 0%, ${60 + Math.random() * 30}%)`;
            default: return '#fff';
        }
    }

    update() {
        this.lifetime--;
        for (const p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.92;
            p.vy *= 0.92;
        }
        return this.lifetime > 0;
    }
};
