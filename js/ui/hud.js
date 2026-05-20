/* ═══════════════════════════════════════════
   ساحة المعركة - HUD System
   In-game UI: health, score, timer, kills
   ═══════════════════════════════════════════ */
window.BA = window.BA || {};

BA.HUD = class HUD {
    constructor() {
        this.elements = {
            hud: document.getElementById('hud'),
            healthFill: document.getElementById('healthFill'),
            healthText: document.getElementById('healthText'),
            prepTimer: document.getElementById('prepTimer'),
            prepCount: document.getElementById('prepCount'),
            prepRingFill: document.getElementById('prepRingFill'),
            killCount: document.getElementById('killCount'),
            deathCount: document.getElementById('deathCount'),
            aliveCount: document.getElementById('aliveCount'),
            aliveNum: document.getElementById('aliveNum'),
            killFeed: document.getElementById('killFeed'),
            respawnOverlay: document.getElementById('respawnOverlay'),
            respawnTimer: document.getElementById('respawnTimer'),
            scoreBoard: document.getElementById('scoreBoard'),
            gameTimerDisplay: document.getElementById('gameTimerDisplay'),
        };

        this.killFeedEntries = [];
        this._lastPrepSecond = -1;
    }

    show() {
        if (this.elements.hud) this.elements.hud.classList.remove('hidden');
        if (this.elements.killFeed) this.elements.killFeed.classList.remove('hidden');
    }

    hide() {
        if (this.elements.hud) this.elements.hud.classList.add('hidden');
        if (this.elements.killFeed) this.elements.killFeed.classList.add('hidden');
        this.hideRespawnOverlay();
        this.hidePrepTimer();
    }

    update(engine) {
        if (!engine.localPlayer) return;

        const player = engine.localPlayer;

        // Health
        this.updateHealth(player.health, player.maxHealth);

        // Score
        this.updateScore(player.kills, player.deaths);

        // Alive count
        this.updateAliveCount(engine.getAliveCount(), engine.players.size);

        // Game timer
        if (engine.state === BA.STATE.PLAYING) {
            this.updateGameTimer(engine.getGameTimeRemaining());
        }

        // Prep timer
        if (engine.state === BA.STATE.PREP) {
            this.showPrepTimer(engine.prepSeconds);
        } else {
            this.hidePrepTimer();
        }

        // Respawn overlay
        if (!player.alive) {
            this.showRespawnOverlay(Math.ceil(player.respawnTimer / 60));
        } else {
            this.hideRespawnOverlay();
        }

        // Clean old kill feed entries
        this._cleanKillFeed();
    }

    updateHealth(current, max) {
        const pct = Math.max(0, Math.min(100, (current / max) * 100));

        if (this.elements.healthFill) {
            this.elements.healthFill.style.width = pct + '%';
            // Color changes based on health
            if (pct > 60) {
                this.elements.healthFill.style.background = 'linear-gradient(90deg, #10b981, #34d399)';
            } else if (pct > 30) {
                this.elements.healthFill.style.background = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
            } else {
                this.elements.healthFill.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
            }
        }

        if (this.elements.healthText) {
            this.elements.healthText.textContent = Math.ceil(current);
        }
    }

    updateScore(kills, deaths) {
        if (this.elements.killCount) {
            this.elements.killCount.textContent = kills;
        }
        if (this.elements.deathCount) {
            this.elements.deathCount.textContent = deaths;
        }
    }

    updateAliveCount(alive, total) {
        if (this.elements.aliveNum) {
            this.elements.aliveNum.textContent = `${alive}/${total}`;
        }
    }

    updateGameTimer(seconds) {
        if (this.elements.gameTimerDisplay) {
            const min = Math.floor(seconds / 60);
            const sec = seconds % 60;
            this.elements.gameTimerDisplay.textContent = `${min}:${sec.toString().padStart(2, '0')}`;

            // Flash red when low on time
            if (seconds <= 30) {
                this.elements.gameTimerDisplay.style.color = '#ef4444';
            } else {
                this.elements.gameTimerDisplay.style.color = '';
            }
        }
    }

    showPrepTimer(seconds) {
        if (this.elements.prepTimer) {
            this.elements.prepTimer.classList.remove('hidden');
        }
        if (this.elements.prepCount) {
            this.elements.prepCount.textContent = seconds;
        }
        // Ring animation
        if (this.elements.prepRingFill) {
            const circumference = 2 * Math.PI * 45; // r=45 from SVG
            const progress = seconds / BA.PREP_TIME;
            const offset = circumference * (1 - progress);
            this.elements.prepRingFill.style.strokeDasharray = circumference;
            this.elements.prepRingFill.style.strokeDashoffset = offset;
        }
    }

    hidePrepTimer() {
        if (this.elements.prepTimer) {
            this.elements.prepTimer.classList.add('hidden');
        }
    }

    showRespawnOverlay(seconds) {
        if (this.elements.respawnOverlay) {
            this.elements.respawnOverlay.classList.remove('hidden');
        }
        if (this.elements.respawnTimer) {
            this.elements.respawnTimer.textContent = Math.max(0, seconds);
        }
    }

    hideRespawnOverlay() {
        if (this.elements.respawnOverlay) {
            this.elements.respawnOverlay.classList.add('hidden');
        }
    }

    addKillFeedEntry(killerName, victimName) {
        const feedEl = this.elements.killFeed;
        if (!feedEl) return;

        const entry = document.createElement('div');
        entry.className = 'kill-entry';
        entry.innerHTML = `<strong>${killerName}</strong> قتل <strong>${victimName}</strong>`;
        feedEl.appendChild(entry);

        this.killFeedEntries.push({
            element: entry,
            time: Date.now()
        });

        // Limit feed length
        while (this.killFeedEntries.length > 5) {
            const old = this.killFeedEntries.shift();
            if (old.element.parentNode) old.element.remove();
        }
    }

    _cleanKillFeed() {
        const now = Date.now();
        while (this.killFeedEntries.length > 0 && now - this.killFeedEntries[0].time > 4000) {
            const old = this.killFeedEntries.shift();
            if (old.element.parentNode) {
                old.element.style.opacity = '0';
                old.element.style.transform = 'translateX(50px)';
                old.element.style.transition = 'all 0.3s ease';
                setTimeout(() => old.element.remove(), 300);
            }
        }
    }
};
