import { Projectile } from './projectile.js';

export class Tower {
    constructor(game, type, position, gridPosition) {
        this.game = game;
        this.type = type;
        this.position = position;
        this.gridPosition = gridPosition;

        // Tower stats
        this.setStats();

        // Tower state
        this.lastFireTime = 0;
        this.empowered = false;
        this.empowermentMultiplier = 1;
        this.empowermentEndTime = 0;

        // Create 3D representation
        this.mesh = this.game.renderer.createTower(this);

        // Set the position of the tower mesh
        // Position the tower with the base at ground level (y=0)
        // and center of tower at grid position
        this.mesh.position.set(
            position.x,
            this.height / 2, // Place the tower so its bottom is at ground level
            position.z
        );

        // For debugging
        console.log("Tower created at:", position, "with height:", this.height);
    }

    setStats() {
        // Set stats based on tower type
        switch (this.type) {
            case 'arrow':
                this.damage = 20;
                this.range = 3;
                this.fireRate = 1; // Shots per second
                this.height = 0.8;
                this.projectileType = 'arrow';
                this.areaOfEffect = false;
                this.specialAbility = null;
                break;

            case 'doubleArrow':
                this.damage = 15;
                this.range = 4;
                this.fireRate = 2; // Shots per second
                this.height = 1;
                this.projectileType = 'doubleArrow';
                this.areaOfEffect = false;
                this.specialAbility = 'doubleShot'; // 30% chance of firing 2 shots
                break;

            case 'cannon':
                this.damage = 50;
                this.range = 2.5;
                this.fireRate = 0.5; // Shots per second
                this.height = 0.7;
                this.projectileType = 'cannon';
                this.areaOfEffect = true;
                this.aoeRadius = 1.2;
                this.specialAbility = null;
                break;

            default:
                this.damage = 20;
                this.range = 3;
                this.fireRate = 1;
                this.height = 0.8;
                this.projectileType = 'arrow';
                this.areaOfEffect = false;
                this.specialAbility = null;
        }
    }

    update(deltaTime) {
        // Check if empowerment has ended
        if (this.empowered && performance.now() > this.empowermentEndTime) {
            this.empowered = false;
            this.empowermentMultiplier = 1;
        }

        // Update visual effects
        if (this.mesh.userData.rangeIndicator) {
            this.mesh.userData.rangeIndicator.visible = this.game.debugMode;
        }
    }

    canFire() {
        const now = performance.now();
        const fireInterval = 1000 / this.fireRate; // Convert rate to interval in ms

        return now - this.lastFireTime >= fireInterval;
    }

    fire(target) {
        // Record fire time
        this.lastFireTime = performance.now();

        // Create projectile
        this.createProjectile(target);

        // Apply special abilities
        if (this.specialAbility === 'doubleShot' && Math.random() < 0.3) {
            // 30% chance of firing second shot
            setTimeout(() => {
                if (target.health > 0 && !target.reachedEnd) {
                    this.createProjectile(target);
                }
            }, 150); // Small delay between shots
        }
    }

    createProjectile(target) {
        // Calculate projectile starting position
        const startPosition = {
            x: this.position.x,
            y: this.position.y + this.height / 2,
            z: this.position.z
        };

        // Calculate applied damage
        const damage = this.damage * this.empowermentMultiplier;

        // Create projectile
        const projectile = new Projectile(
            this.game,
            this.projectileType,
            startPosition,
            target,
            damage,
            this.areaOfEffect ? this.aoeRadius : 0
        );

        this.game.projectiles.push(projectile);
    }

    applyEmpowerment(multiplier, duration) {
        this.empowered = true;
        this.empowermentMultiplier = multiplier;
        this.empowermentEndTime = performance.now() + (duration * 1000);

        // Visual effect
        if (this.mesh) {
            // Could add visual empowerment effect here if needed
        }
    }
}