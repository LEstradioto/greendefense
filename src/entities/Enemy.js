import * as THREE from 'three';

export class Enemy {
    constructor(game, position, type, waveNumber, elementType = 'normal') {
        this.game = game;

        // Handle position safely, accounting for various input types
        if (position) {
            if (typeof position.clone === 'function') {
                this.position = position.clone();
            } else if (position.x !== undefined && position.z !== undefined) {
                // If it's a plain object with x,z properties
                this.position = new THREE.Vector3(position.x, position.y || 0, position.z);
            } else {
                // Fallback to a default position
                this.position = new THREE.Vector3(0, 0, 0);
                console.warn('Enemy created with invalid position object');
            }
        } else {
            this.position = new THREE.Vector3(0, 0, 0);
        }

        this.type = type || 'basic';
        this.elementType = elementType || 'normal';
        this.waveNumber = waveNumber || 1;

        // Add distance to exit tracking for performance optimization
        this.distanceToExit = Infinity;

        // Set up pathfinding properties
        this.pathWaypoints = [];
        this.currentPathIndex = 0;
        this.lastPathCalcTime = 0;
        this.pathRecalcTimeout = 1000; // ms between path recalculations
        this.reachedEnd = false;

        // Movement properties
        this.speed = this.getBaseSpeed();
        this.direction = new THREE.Vector3(0, 0, 0);
        this.nextWaypoint = null;
        this.lastMovementUpdate = performance.now();

        // Set up basic properties based on type
        this.setupEnemyProperties();

        // Create a visual representation
        this.createVisuals();
    }

    // After creating an enemy, set its target exit position
    setTargetPosition(targetPosition) {
        this.targetPosition = targetPosition;

        // Calculate initial distance to exit
        if (targetPosition) {
            this.distanceToExit = this.calculateDistance(this.position, targetPosition);
        }
    }

    // Calculate distance between two points (for path optimization)
    calculateDistance(point1, point2) {
        return Math.sqrt(
            Math.pow(point2.x - point1.x, 2) +
            Math.pow(point2.z - point1.z, 2)
        );
    }

    // Get base speed according to enemy type (can be overriden by specific enemies)
    getBaseSpeed() {
        const baseSpeed = {
            'basic': 1.6,
            'fast': 2.4,
            'armored': 1.0,
            'flying': 2.0,
            'boss': 0.8
        };

        // Default to basic if type not found
        return baseSpeed[this.type] || 1.5;
    }

    // Set up enemy properties based on type
    setupEnemyProperties() {
        // Set base properties according to enemy type
        switch (this.type) {
            case 'basic':
                this.maxHealth = 100;
                this.goldValue = 5;
                break;
            case 'fast':
                this.maxHealth = 70;
                this.goldValue = 8;
                break;
            case 'armored':
                this.maxHealth = 200;
                this.goldValue = 12;
                break;
            case 'flying':
                this.maxHealth = 80;
                this.goldValue = 10;
                this.isFlying = true;
                break;
            case 'boss':
                this.maxHealth = 1000;
                this.goldValue = 50;
                break;
            default:
                this.maxHealth = 100;
                this.goldValue = 5;
        }

        // Apply element type modifiers
        switch (this.elementType) {
            case 'fire':
                this.maxHealth *= 1.1;
                this.speed *= 1.1;
                break;
            case 'water':
                this.maxHealth *= 1.2;
                this.speed *= 0.9;
                break;
            case 'earth':
                this.maxHealth *= 1.3;
                this.speed *= 0.8;
                break;
            case 'air':
                this.maxHealth *= 0.9;
                this.speed *= 1.2;
                break;
            case 'dark':
                this.maxHealth *= 1.5;
                this.speed *= 0.7;
                break;
            case 'light':
                this.maxHealth *= 0.8;
                this.speed *= 1.3;
                break;
        }

        // Apply wave scaling
        this.maxHealth *= 1 + ((this.waveNumber - 1) * 0.1);
        this.goldValue = Math.floor(this.goldValue * (1 + ((this.waveNumber - 1) * 0.05)));

        // Initialize current health
        this.health = this.maxHealth;
    }

    // Create visual representation (minimal, real model handled by Renderer/EnemyManager)
    createVisuals() {
        // We'll only store key information here - actual mesh creation is handled by the renderer
        this.radius = 0.5; // For collision detection

        // For status effects
        this.statusEffects = {};
        this.effectMeshes = [];
    }

    // Update position and behavior based on current path
    update(deltaTime) {
        // Skip update if dead or already at end
        if (this.health <= 0 || this.reachedEnd) return;

        // Update status effects
        this.updateStatusEffects(deltaTime);

        // If we need to get a new path, request one
        if (!this.pathWaypoints || this.pathWaypoints.length === 0) {
            // Set a fallback position to make enemy visible while waiting for path
            // Keep Y position at ground level (0.5 units above ground)
            this.position.y = 0.5;

            // Request a path from the game if possible
            if (this.game) {
                this.game.getPathForEnemy(this).then(path => {
                    if (path && path.length > 0) {
                        this.pathWaypoints = path;
                        this.currentPathIndex = 0;
                    }
                });
            }
            return;
        }

        // Get current target waypoint
        const currentTarget = this.pathWaypoints[this.currentPathIndex];
        if (!currentTarget) return;

        // Calculate direction to target
        const dx = currentTarget.x - this.position.x;
        const dz = currentTarget.z - this.position.z;
        const distanceToTarget = Math.sqrt(dx * dx + dz * dz);

        // Check if we've reached the waypoint
        if (distanceToTarget < 0.2) {
            // Move to next waypoint
            this.currentPathIndex++;

            // Check if we've reached the end of the path
            if (this.currentPathIndex >= this.pathWaypoints.length) {
                // We've reached the end of the path
                this.reachedEnd = true;

                // Hide the enemy by moving it below ground
                this.position.y = -10;
                return;
            }
        }

        // Move towards the target
        const movementSpeed = this.speed * deltaTime;

        // Ensure we don't overshoot the target
        const moveFraction = distanceToTarget > 0 ? Math.min(movementSpeed / distanceToTarget, 1.0) : 0;

        this.position.x += dx * moveFraction;
        this.position.z += dz * moveFraction;

        // Keep Y position at ground level with slight bounce effect based on movement
        // This gives a more natural walking/bouncing appearance
        const bounceFactor = 0.05;
        const bounceSpeed = 4;
        this.position.y = 0.5 + Math.sin(this._totalDistance * bounceSpeed) * bounceFactor;

        // Track total distance moved for animation purposes
        this._totalDistance = (this._totalDistance || 0) + movementSpeed;

        // Calculate distance to exit for prioritization in cleanup
        if (this.pathWaypoints.length > 0) {
            const exitPoint = this.pathWaypoints[this.pathWaypoints.length - 1];
            this.distanceToExit = Math.sqrt(
                Math.pow(exitPoint.x - this.position.x, 2) +
                Math.pow(exitPoint.z - this.position.z, 2)
            );
        }
    }

    // Apply damage to enemy, return true if enemy dies
    takeDamage(amount, damageType) {
        // Skip if already dead
        if (this.health <= 0) return false;

        // Calculate actual damage based on resistances and damage type
        let actualDamage = amount;

        // Apply type effectiveness (e.g., water is strong against fire)
        if (damageType && this.elementType) {
            const effectiveness = this.getTypeEffectiveness(damageType, this.elementType);
            actualDamage *= effectiveness;
        }

        // Apply damage
        this.health -= actualDamage;

        // Create damage popup
        if (this.game && this.game.renderer) {
            this.game.renderer.createDamageNumber(
                this.position,
                Math.floor(actualDamage),
                damageType
            );
        }

        // Update health bar
        this.updateHealthBar();

        // Check if enemy is dead
        if (this.health <= 0) {
            this.die();
            return true;
        }

        return false;
    }

    // Get type effectiveness multiplier
    getTypeEffectiveness(attackType, defenseType) {
        const effectivenessChart = {
            'fire': { 'water': 0.5, 'air': 1.5, 'earth': 1.0, 'fire': 0.5, 'light': 1.0, 'dark': 1.0, 'normal': 1.0 },
            'water': { 'fire': 1.5, 'air': 0.5, 'earth': 0.5, 'water': 0.5, 'light': 1.0, 'dark': 1.0, 'normal': 1.0 },
            'earth': { 'fire': 1.0, 'air': 0.5, 'water': 1.5, 'earth': 0.5, 'light': 1.0, 'dark': 1.0, 'normal': 1.0 },
            'air': { 'fire': 0.5, 'water': 1.5, 'earth': 1.5, 'air': 0.5, 'light': 1.0, 'dark': 1.0, 'normal': 1.0 },
            'light': { 'dark': 1.5, 'light': 0.5, 'fire': 1.0, 'water': 1.0, 'earth': 1.0, 'air': 1.0, 'normal': 1.0 },
            'dark': { 'light': 1.5, 'dark': 0.5, 'fire': 1.0, 'water': 1.0, 'earth': 1.0, 'air': 1.0, 'normal': 1.0 },
            'normal': { 'normal': 1.0, 'fire': 1.0, 'water': 1.0, 'earth': 1.0, 'air': 1.0, 'light': 1.0, 'dark': 1.0 }
        };

        // Default to 1.0 if types not found
        if (!effectivenessChart[attackType] || !effectivenessChart[attackType][defenseType]) {
            return 1.0;
        }

        return effectivenessChart[attackType][defenseType];
    }

    // Handle enemy death
    die() {
        // Enemy is dead - clear active effects
        this.clearAllEffects();

        // Give gold to player
        if (this.game && this.game.player) {
            this.game.player.gold += this.goldValue;

            // Update UI
            this.game.updateUI();
        }

        // Create death effect (now handled by Game class for performance)
        // Let the game class handle this with optimized particle effects
    }

    // Update enemy health bar
    updateHealthBar() {
        if (this.enemyInstance && this.enemyInstance.healthBar) {
            const healthPercent = Math.max(0, this.health / this.maxHealth);

            // Use the correct API - in the renderer or enemyManager
            if (this.game && this.game.renderer) {
                this.game.renderer.updateHealthBar(this.enemyInstance.healthBar, healthPercent);
            }
        }
    }

    // Add a status effect to the enemy
    addStatusEffect(type, duration, params = {}) {
        // Skip if dead
        if (this.health <= 0) return;

        // Create or update status effect
        this.statusEffects[type] = {
            type: type,
            duration: duration,
            startTime: performance.now(),
            params: params,
            // Store original values for restoration after effect ends
            originalValues: {
                speed: this.speed
            }
        };

        // Apply immediate effect
        switch (type) {
            case 'slow':
                // Reduce speed
                const slowFactor = params.factor || 0.5;
                this.speed = this.getBaseSpeed() * slowFactor;
                break;
            case 'poison':
                // No immediate effect, damage applied over time
                break;
            case 'stun':
                // Stop movement completely
                this.speed = 0;
                break;
        }

        // Add visual effect if not already present
        if (this.game && this.game.renderer) {
            this.game.renderer.addStatusEffect(this, type);
        }
    }

    // Update status effects
    updateStatusEffects(deltaTime) {
        const currentTime = performance.now();

        for (const type in this.statusEffects) {
            const effect = this.statusEffects[type];

            // Skip if no effect
            if (!effect) continue;

            // Check if effect has expired
            const elapsed = currentTime - effect.startTime;
            if (elapsed >= effect.duration) {
                // Remove expired effect
                this.removeStatusEffect(type);
                continue;
            }

            // Apply ongoing effects
            switch (type) {
                case 'poison':
                    // Apply damage over time
                    const damagePerSecond = effect.params.damagePerSecond || 10;
                    this.takeDamage(damagePerSecond * deltaTime, 'poison');
                    break;
                // Other ongoing effects...
            }
        }
    }

    // Remove a specific status effect
    removeStatusEffect(type) {
        if (!this.statusEffects[type]) return;

        // Restore original values
        const effect = this.statusEffects[type];

        // Restore original speed (unless affected by other effects)
        if (type === 'slow' || type === 'stun') {
            // Check if other effects are still active that affect speed
            const hasOtherSpeedEffects =
                (this.statusEffects['slow'] && type !== 'slow') ||
                (this.statusEffects['stun'] && type !== 'stun');

            if (!hasOtherSpeedEffects) {
                this.speed = effect.originalValues.speed;
            }
        }

        // Remove the effect from active effects
        delete this.statusEffects[type];

        // Remove visual effect
        if (this.game && this.game.renderer) {
            this.game.renderer.removeStatusEffect(this, type);
        }
    }

    // Clear all status effects
    clearAllEffects() {
        for (const type in this.statusEffects) {
            this.removeStatusEffect(type);
        }

        // Reset to base values just in case
        this.speed = this.getBaseSpeed();
    }
}