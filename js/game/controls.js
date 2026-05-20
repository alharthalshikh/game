/* ═══════════════════════════════════════════
   ساحة المعركة - Controls System
   Keyboard + Mouse + Touch Joystick
   ═══════════════════════════════════════════ */
window.BA = window.BA || {};

BA.Controls = class Controls {
    constructor(canvas) {
        this.canvas = canvas;

        // Keyboard state
        this.keys = { up: false, down: false, left: false, right: false };

        // Mouse state
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseDown = false;

        // Mobile detection
        this.isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

        // Joystick state (movement)
        this.joystick = { active: false, dx: 0, dy: 0 };
        this._joystickTouch = null;

        // Aim joystick state
        this.aimJoystick = { active: false, dx: 0, dy: 0 };
        this._aimTouch = null;

        // Derived
        this.aimAngle = 0;
        this.shooting = false;

        // Bind methods
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
        this._onTouchStart = this._onTouchStart.bind(this);
        this._onTouchMove = this._onTouchMove.bind(this);
        this._onTouchEnd = this._onTouchEnd.bind(this);
        this._onContextMenu = (e) => e.preventDefault();

        this._setupListeners();

        // Mobile controls stay hidden until game starts
        // Visibility is managed by App._onStateChange

        // Shoot button for mobile
        const shootBtn = document.getElementById('btnShoot');
        if (shootBtn) {
            shootBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.shooting = true;
            });
            shootBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.shooting = false;
            });
            shootBtn.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                this.shooting = false;
            });
        }
    }

    _setupListeners() {
        // Keyboard
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);

        // Mouse
        this.canvas.addEventListener('mousemove', this._onMouseMove);
        this.canvas.addEventListener('mousedown', this._onMouseDown);
        this.canvas.addEventListener('mouseup', this._onMouseUp);
        this.canvas.addEventListener('contextmenu', this._onContextMenu);

        // Touch (for joysticks)
        if (this.isMobile) {
            const joystickArea = document.getElementById('joystickArea');
            const aimArea = document.getElementById('aimArea');

            if (joystickArea) {
                joystickArea.addEventListener('touchstart', this._onTouchStart, { passive: false });
                joystickArea.addEventListener('touchmove', this._onTouchMove, { passive: false });
                joystickArea.addEventListener('touchend', this._onTouchEnd, { passive: false });
                joystickArea.addEventListener('touchcancel', this._onTouchEnd, { passive: false });
            }

            if (aimArea) {
                aimArea.addEventListener('touchstart', (e) => this._onAimTouchStart(e), { passive: false });
                aimArea.addEventListener('touchmove', (e) => this._onAimTouchMove(e), { passive: false });
                aimArea.addEventListener('touchend', (e) => this._onAimTouchEnd(e), { passive: false });
                aimArea.addEventListener('touchcancel', (e) => this._onAimTouchEnd(e), { passive: false });
            }
        }
    }

    // === Keyboard ===
    _onKeyDown(e) {
        switch (e.code) {
            case 'KeyW': case 'ArrowUp': this.keys.up = true; break;
            case 'KeyS': case 'ArrowDown': this.keys.down = true; break;
            case 'KeyA': case 'ArrowLeft': this.keys.left = true; break;
            case 'KeyD': case 'ArrowRight': this.keys.right = true; break;
        }
    }

    _onKeyUp(e) {
        switch (e.code) {
            case 'KeyW': case 'ArrowUp': this.keys.up = false; break;
            case 'KeyS': case 'ArrowDown': this.keys.down = false; break;
            case 'KeyA': case 'ArrowLeft': this.keys.left = false; break;
            case 'KeyD': case 'ArrowRight': this.keys.right = false; break;
        }
    }

    // === Mouse ===
    _onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;
    }

    _onMouseDown(e) {
        if (e.button === 0) this.mouseDown = true;
    }

    _onMouseUp(e) {
        if (e.button === 0) this.mouseDown = false;
    }

    // === Movement Joystick ===
    _onTouchStart(e) {
        e.preventDefault();
        if (this._joystickTouch !== null) return;
        const touch = e.changedTouches[0];
        this._joystickTouch = touch.identifier;
        this._joystickOrigin = { x: touch.clientX, y: touch.clientY };
        this.joystick.active = true;
    }

    _onTouchMove(e) {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === this._joystickTouch) {
                const dx = touch.clientX - this._joystickOrigin.x;
                const dy = touch.clientY - this._joystickOrigin.y;
                const maxDist = 50;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const clampedDist = Math.min(dist, maxDist);
                const angle = Math.atan2(dy, dx);
                this.joystick.dx = (Math.cos(angle) * clampedDist) / maxDist;
                this.joystick.dy = (Math.sin(angle) * clampedDist) / maxDist;

                // Move joystick thumb visually
                const thumb = document.getElementById('joystickThumb');
                if (thumb) {
                    const px = (Math.cos(angle) * clampedDist);
                    const py = (Math.sin(angle) * clampedDist);
                    thumb.style.transform = `translate(${px}px, ${py}px)`;
                }
            }
        }
    }

    _onTouchEnd(e) {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === this._joystickTouch) {
                this._joystickTouch = null;
                this.joystick.active = false;
                this.joystick.dx = 0;
                this.joystick.dy = 0;
                const thumb = document.getElementById('joystickThumb');
                if (thumb) thumb.style.transform = 'translate(0, 0)';
            }
        }
    }

    // === Aim Joystick ===
    _onAimTouchStart(e) {
        e.preventDefault();
        if (this._aimTouch !== null) return;
        const touch = e.changedTouches[0];
        this._aimTouch = touch.identifier;
        this._aimOrigin = { x: touch.clientX, y: touch.clientY };
        this.aimJoystick.active = true;
        this.shooting = true;
    }

    _onAimTouchMove(e) {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === this._aimTouch) {
                const dx = touch.clientX - this._aimOrigin.x;
                const dy = touch.clientY - this._aimOrigin.y;
                const maxDist = 50;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const clampedDist = Math.min(dist, maxDist);
                const angle = Math.atan2(dy, dx);
                this.aimJoystick.dx = Math.cos(angle) * clampedDist / maxDist;
                this.aimJoystick.dy = Math.sin(angle) * clampedDist / maxDist;
                this.aimAngle = angle;

                const thumb = document.getElementById('aimThumb');
                if (thumb) {
                    const px = Math.cos(angle) * clampedDist;
                    const py = Math.sin(angle) * clampedDist;
                    thumb.style.transform = `translate(${px}px, ${py}px)`;
                }
            }
        }
    }

    _onAimTouchEnd(e) {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === this._aimTouch) {
                this._aimTouch = null;
                this.aimJoystick.active = false;
                this.aimJoystick.dx = 0;
                this.aimJoystick.dy = 0;
                this.shooting = false;
                const thumb = document.getElementById('aimThumb');
                if (thumb) thumb.style.transform = 'translate(0, 0)';
            }
        }
    }

    // === Public API ===
    getMovement() {
        let dx = 0, dy = 0;

        if (this.isMobile && this.joystick.active) {
            dx = this.joystick.dx;
            dy = this.joystick.dy;
        } else {
            if (this.keys.left) dx -= 1;
            if (this.keys.right) dx += 1;
            if (this.keys.up) dy -= 1;
            if (this.keys.down) dy += 1;

            // Normalize diagonal movement
            if (dx !== 0 && dy !== 0) {
                const len = Math.sqrt(dx * dx + dy * dy);
                dx /= len;
                dy /= len;
            }
        }

        return { dx, dy };
    }

    getAimAngle(playerScreenX, playerScreenY) {
        // If we are on mobile/touch and they are actively using joysticks
        if (this.isMobile && (this.aimJoystick.active || this.joystick.active)) {
            if (this.aimJoystick.active) {
                // Keep the aimJoystick direction
                return this.aimAngle;
            } else if (this.joystick.active) {
                // Face the movement direction!
                this.aimAngle = Math.atan2(this.joystick.dy, this.joystick.dx);
            }
            return this.aimAngle;
        }

        // If it's a mobile device and they are not touching, keep the last aim angle
        if (this.isMobile && this.mouseX === 0 && this.mouseY === 0) {
            return this.aimAngle;
        }

        // Mouse aim for PC
        this.aimAngle = Math.atan2(
            this.mouseY - playerScreenY,
            this.mouseX - playerScreenX
        );
        return this.aimAngle;
    }

    isFiring() {
        if (this.isMobile) {
            return this.shooting;
        }
        return this.mouseDown;
    }

    destroy() {
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
        this.canvas.removeEventListener('mousemove', this._onMouseMove);
        this.canvas.removeEventListener('mousedown', this._onMouseDown);
        this.canvas.removeEventListener('mouseup', this._onMouseUp);
        this.canvas.removeEventListener('contextmenu', this._onContextMenu);
    }
};
