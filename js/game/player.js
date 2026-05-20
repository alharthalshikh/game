/* ═══════════════════════════════════════════
   ساحة المعركة - Player System
   ═══════════════════════════════════════════ */
window.BA = window.BA || {};

BA.PLAYER_SPEED = 3;
BA.PLAYER_RADIUS = 12;
BA.RESPAWN_TIME = 180; // 3 seconds at 60fps

BA.Player = class Player {
    constructor(id, name, x, y, team) {
        this.id = id;
        this.name = name || 'مقاتل';
        this.x = x || 100;
        this.y = y || 100;
        this.angle = 0; // facing direction
        this.speed = BA.PLAYER_SPEED;
        this.health = 100;
        this.maxHealth = 100;
        this.team = team || 0; // 0=FFA, 1=Red, 2=Blue
        this.alive = true;
        this.kills = 0;
        this.deaths = 0;
        this.canShoot = false; // disabled during prep phase
        this.shootCooldown = 0;
        this.respawnTimer = 0;
        this.lastHitBy = null;

        // Visual
        this.bodyColor = this._getTeamColor();
        this.gunLength = 18;

        // Animation
        this.walkFrame = 0;
        this.walkTimer = 0;
        this.isMoving = false;
        this.damageFlash = 0; // frames of red flash when hit
        this.scale = 1; // for spawn animation
    }

    _getTeamColor() {
        switch (this.team) {
            case 1: return '#ff4444'; // Red team
            case 2: return '#4488ff'; // Blue team
            default: return '#00cc66'; // FFA green
        }
    }

    update(moveX, moveY, angle, map) {
        if (!this.alive) {
            this.respawnTimer--;
            return;
        }

        // Update angle
        this.angle = angle;

        // Movement
        const moving = moveX !== 0 || moveY !== 0;
        this.isMoving = moving;

        if (moving) {
            const newX = this.x + moveX * this.speed;
            const newY = this.y + moveY * this.speed;

            // Try X movement
            if (map.isWalkable(newX, this.y, BA.PLAYER_RADIUS)) {
                this.x = newX;
            }
            // Try Y movement
            if (map.isWalkable(this.x, newY, BA.PLAYER_RADIUS)) {
                this.y = newY;
            }

            // Walk animation
            this.walkTimer++;
            if (this.walkTimer >= 8) {
                this.walkTimer = 0;
                this.walkFrame = (this.walkFrame + 1) % 4;
            }
        } else {
            this.walkFrame = 0;
            this.walkTimer = 0;
        }

        // Shoot cooldown
        if (this.shootCooldown > 0) this.shootCooldown--;

        // Damage flash
        if (this.damageFlash > 0) this.damageFlash--;

        // Spawn scale animation
        if (this.scale < 1) {
            this.scale = Math.min(1, this.scale + 0.05);
        }
    }

    shoot() {
        if (!this.alive || !this.canShoot || this.shootCooldown > 0) return null;

        this.shootCooldown = BA.SHOOT_COOLDOWN;

        // Bullet spawns from gun tip
        const gunTipX = this.x + Math.cos(this.angle) * this.gunLength;
        const gunTipY = this.y + Math.sin(this.angle) * this.gunLength;

        return new BA.Bullet(gunTipX, gunTipY, this.angle, this.id, this.team);
    }

    takeDamage(amount, attackerId) {
        if (!this.alive) return false;

        this.health -= amount;
        this.damageFlash = 8;
        this.lastHitBy = attackerId;

        if (this.health <= 0) {
            this.health = 0;
            this.alive = false;
            this.deaths++;
            this.respawnTimer = BA.RESPAWN_TIME;
            return true; // died
        }
        return false;
    }

    respawn(x, y) {
        this.x = x;
        this.y = y;
        this.health = this.maxHealth;
        this.alive = true;
        this.respawnTimer = 0;
        this.shootCooldown = 0;
        this.damageFlash = 0;
        this.scale = 0.3; // spawn animation
        this.lastHitBy = null;
    }

    canAttack(other) {
        if (!this.alive || !other.alive) return false;
        if (this.id === other.id) return false;
        // In team mode, can't attack teammates
        if (this.team > 0 && this.team === other.team) return false;
        return true;
    }

    serialize() {
        return {
            id: this.id,
            name: this.name,
            x: Math.round(this.x * 10) / 10,
            y: Math.round(this.y * 10) / 10,
            angle: Math.round(this.angle * 100) / 100,
            health: this.health,
            team: this.team,
            alive: this.alive,
            kills: this.kills,
            deaths: this.deaths,
            isMoving: this.isMoving
        };
    }

    static deserialize(data) {
        const p = new BA.Player(data.id, data.name, data.x, data.y, data.team);
        p.angle = data.angle;
        p.health = data.health;
        p.alive = data.alive;
        p.kills = data.kills;
        p.deaths = data.deaths;
        p.isMoving = data.isMoving;
        return p;
    }

    updateFromData(data) {
        // Smooth interpolation for remote players
        this.x += (data.x - this.x) * 0.3;
        this.y += (data.y - this.y) * 0.3;
        this.angle = data.angle;
        this.health = data.health;
        this.alive = data.alive;
        this.kills = data.kills;
        this.deaths = data.deaths;
        this.isMoving = data.isMoving;
        this.team = data.team;
        this.bodyColor = this._getTeamColor();
    }
};
