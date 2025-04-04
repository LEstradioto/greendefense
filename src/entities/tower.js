import { Projectile } from './projectile.js';
import { ElementTypes, ElementalAdvantages, ElementEffects } from '../elements.js';
import * as THREE from 'three';

export class Tower {
    // Static method to get the cost of a tower type
    static getCost(towerType) {
        const costs = {
            // Basic towers
            'arrow': 10,
            'doubleArrow': 25,
            'cannon': 50,

            // Elemental basic towers
            'fire_basic': 15,
            'water_basic': 15,
            'earth_basic': 20,
            'air_basic': 15,
            'shadow_basic': 20,

            // Elemental advanced towers
            'fire_advanced': 35,
            'water_advanced': 35,
            'earth_advanced': 45,
            'air_advanced': 30,
            'shadow_advanced': 40
        };

        return costs[towerType] || 20; // Default cost if tower type not found
    }

    // Static method to create a tower
    static async create(game, towerType, gridX, gridY) {
        // Determine default element based on tower type
        let element = ElementTypes.NEUTRAL;
        if (towerType.startsWith('fire_')) {
            element = ElementTypes.FIRE;
        } else if (towerType.startsWith('water_')) {
            element = ElementTypes.WATER;
        } else if (towerType.startsWith('earth_')) {
            element = ElementTypes.EARTH;
        } else if (towerType.startsWith('air_')) {
            element = ElementTypes.AIR;
        } else if (towerType.startsWith('shadow_')) {
            element = ElementTypes.SHADOW;
        }

        const position = game.map.gridToWorld(gridX, gridY);
        const tower = new Tower(game, towerType, position, { gridX, gridY }, element);

        // Update map grid
        game.map.placeTower(gridX, gridY);

        return tower;
    }

    constructor(game, type, position, gridPosition, element = ElementTypes.NEUTRAL, stats = null) {
        this.game = game;
        this.type = type;
        this.position = position;
        this.gridPosition = gridPosition;
        this.element = element;

        // Tower stats - can be overridden by card stats
        if (stats) {
            this.damage = stats.damage || 20;
            this.range = stats.range || 3;
            this.fireRate = stats.fireRate || 1;
            this.specialAbility = stats.specialAbility || null;
            // Use default height and other properties based on type
            this.setAdditionalStats();
        } else {
            // Legacy behavior - set stats based on tower type
            this.setStats();
        }

        // Tower state
        this.lastFireTime = 0;
        this.empowered = false;
        this.empowermentMultiplier = 1;
        this.empowermentEndTime = 0;

        // Element effects tracker
        this.appliedEffects = [];

        // Tower effect state
        this.shield = 0; // Damage reduction percentage (0.5 = 50% reduction)
        this.hasteMultiplier = 1.0; // Attack speed multiplier (1.5 = 50% faster)

        // Create 3D representation using instanced meshes
        this.towerInstance = this.game.renderer.createTower(this);

        if (!this.towerInstance) {
            console.error(`Failed to create tower instance for type: ${this.type}`);
        } else {
            console.log(`Tower instance created for type: ${this.type}`);
        }

        // For debugging
        // console.log("Tower created at:", position, "with height:", this.height, "element:", this.element);
    }

    setStats() {
        // Legacy method to set stats based on tower type
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

        // Set additional properties based on type
        this.setAdditionalStats();
    }

    setAdditionalStats() {
        // Set visual and projectile properties based on tower type
        switch (this.type) {
            case 'arrow':
                this.height = 0.8;
                this.projectileType = 'arrow';
                this.areaOfEffect = false;
                break;

            case 'doubleArrow':
                this.height = 1;
                this.projectileType = 'doubleArrow';
                this.areaOfEffect = false;
                break;

            case 'cannon':
                this.height = 0.7;
                this.projectileType = 'cannon';
                this.areaOfEffect = true;
                this.aoeRadius = 1.2;
                break;

            // Add cases for elemental tower types
            case 'fire_basic':
            case 'fire_advanced':
                this.height = 0.9;
                this.projectileType = 'fire';
                this.areaOfEffect = (this.type === 'fire_advanced');
                this.aoeRadius = (this.type === 'fire_advanced') ? 1.0 : 0;
                this.element = ElementTypes.FIRE;
                break;

            case 'water_basic':
            case 'water_advanced':
                this.height = 0.85;
                this.projectileType = 'water';
                this.areaOfEffect = false;
                this.element = ElementTypes.WATER;
                break;

            case 'earth_basic':
            case 'earth_advanced':
                this.height = 1.1;
                this.projectileType = 'earth';
                this.areaOfEffect = false;
                this.element = ElementTypes.EARTH;
                break;

            case 'air_basic':
            case 'air_advanced':
                this.height = 0.75;
                this.projectileType = 'air';
                this.areaOfEffect = false;
                this.element = ElementTypes.AIR;
                break;

            case 'shadow_basic':
            case 'shadow_advanced':
                this.height = 0.8;
                this.projectileType = 'shadow';
                this.areaOfEffect = false;
                this.element = ElementTypes.SHADOW;
                break;

            default:
                this.height = 0.8;
                this.projectileType = 'neutral';
                this.areaOfEffect = false;
        }
    }

    update(deltaTime) {
        // Check if empowerment has ended
        if (this.empowered && performance.now() > this.empowermentEndTime) {
            this.empowered = false;
            this.empowermentMultiplier = 1;
        }

        // Update applied effects
        this.updateEffects(deltaTime);

        // Update visual effects
        if (this.towerInstance && this.towerInstance.topGroup &&
            this.towerInstance.topGroup.userData.rangeIndicator) {
            this.towerInstance.topGroup.userData.rangeIndicator.visible = this.game.debugMode;
        }

        // Always update nose rotation if an enemy is in range, regardless of fire state
        if (this.towerInstance && this.towerInstance.topGroup &&
            this.towerInstance.topGroup.userData.nose) {
            // Find the closest enemy in range
            const target = this.game.findClosestEnemyInRange(this.position, this.range);
            if (target) {
                this.rotateTowardTarget(target);
            }
        }
    }

    updateEffects(deltaTime) {
        // Update duration of applied effects and remove expired ones
        for (let i = this.appliedEffects.length - 1; i >= 0; i--) {
            const effect = this.appliedEffects[i];
            effect.remainingDuration -= deltaTime;

            if (effect.remainingDuration <= 0) {
                // Remove effect
                switch (effect.type) {
                    case 'shield':
                        this.shield = 0;
                        break;

                    case 'haste':
                        this.hasteMultiplier = 1.0;
                        break;
                }

                this.appliedEffects.splice(i, 1);
            }
        }

        // Process any active effects
        this.processEffects(deltaTime);
    }

    canFire() {
        const now = performance.now();
        const fireInterval = 1000 / this.getModifiedFireRate(); // Convert rate to interval in ms

        return now - this.lastFireTime >= fireInterval;
    }

    getModifiedFireRate() {
        let rate = this.fireRate * this.empowermentMultiplier;

        // Apply effect modifiers
        this.appliedEffects.forEach(effect => {
            if (effect.type === 'attackSpeed') {
                rate *= effect.value;
            }
        });

        // Apply haste effect
        if (this.hasteMultiplier > 1.0) {
            rate *= this.hasteMultiplier;
        }

        return rate;
    }

    fire(target) {
        // Record fire time
        this.lastFireTime = performance.now();

        // Rotate tower nose toward the target
        this.rotateTowardTarget(target);

        // Create projectile
        this.createProjectile(target);

        // Play tower shoot sound effect if available
        if (window.playSound) {
            window.playSound('towerShoot');
        }

        // Apply special abilities
        if (this.specialAbility === 'doubleShot' && Math.random() < 0.3) {
            // 30% chance of firing second shot
            setTimeout(() => {
                if (target.health > 0 && !target.reachedEnd) {
                    this.createProjectile(target);
                    // Play sound for second shot too
                    if (window.playSound) {
                        window.playSound('towerShoot');
                    }
                }
            }, 150); // Small delay between shots
        }

        // Apply element-specific effects
        this.applyElementalSpecialEffects(target);
    }

    rotateTowardTarget(target) {
        if (!target || !this.towerInstance) return;

        const targetPosition = target.position;

        // Use renderer's method to rotate tower
        this.game.renderer.rotateTowerToTarget(this.towerInstance, targetPosition);
    }

    applyElementalSpecialEffects(target) {
        // Check for element-specific special effects
        switch (this.element) {
            case ElementTypes.FIRE:
                // Fire towers have a chance to apply burn effect
                if (Math.random() < 0.2) {
                    target.applyStatusEffect('burn', ElementEffects[ElementTypes.FIRE]);
                }
                break;

            case ElementTypes.WATER:
                // Water towers have a chance to apply slow effect
                if (Math.random() < 0.3) {
                    target.applyStatusEffect('slow', ElementEffects[ElementTypes.WATER]);
                }
                break;

            case ElementTypes.EARTH:
                // Earth towers provide armor buff to nearby towers
                if (Math.random() < 0.15) {
                    this.applyEarthArmorBuff();
                }
                break;

            case ElementTypes.AIR:
                // Air towers have a chance for critical hits (handled in calculateDamage)
                break;

            case ElementTypes.SHADOW:
                // Shadow towers have a chance to apply weaken effect
                if (Math.random() < 0.2) {
                    target.applyStatusEffect('weaken', ElementEffects[ElementTypes.SHADOW]);
                }
                break;
        }
    }

    applyEarthArmorBuff() {
        // Find nearby towers and buff them
        const earthEffect = ElementEffects[ElementTypes.EARTH];
        const buffRadius = earthEffect.radius;

        for (const tower of this.game.towers) {
            if (tower !== this) {
                const distance = this.game.calculateDistance(this.position, tower.position);
                if (distance <= buffRadius) {
                    // Apply armor buff
                    tower.appliedEffects.push({
                        type: 'armor',
                        value: 1 - earthEffect.damageReduction, // Convert to damage multiplier
                        remainingDuration: earthEffect.duration
                    });

                    // Visual effect could be added here
                }
            }
        }
    }

    createProjectile(target) {
        // Skip creating projectile if too many exist and FPS is low
        if (this.game.projectiles.length > this.game.maxActiveProjectiles &&
            this.game.fpsCounter && this.game.fpsCounter.value < 30) {
            return; // Skip firing during performance issues
        }

        // Calculate projectile starting position
        const startPosition = {
            x: this.position.x,
            y: this.position.y + this.height / 2,
            z: this.position.z
        };

        // Calculate applied damage with elemental advantage
        const damage = this.calculateDamage(target);

        // Get projectile from the pool using our new method
        const projectile = this.game.getProjectileFromPool(
            this.projectileType,
            startPosition,
            target,
            damage,
            this.areaOfEffect,
            this.element
        );

        // Set the tower as the origin tower for range checking
        if (projectile) {
            projectile.originTower = this;
        }

        return projectile;
    }

    calculateDamage(target) {
        let damage = this.damage * this.empowermentMultiplier;

        // Apply game difficulty multiplier
        if (this.game.difficultySettings) {
            damage *= this.game.difficultySettings.towerDamageMultiplier;
        }

        // Apply effect modifiers
        this.appliedEffects.forEach(effect => {
            if (effect.type === 'damage') {
                damage *= effect.value;
            }
        });

        // Apply armor effects if target has any
        if (target.appliedEffects) {
            target.appliedEffects.forEach(effect => {
                if (effect.type === 'armor') {
                    damage *= effect.value;
                }
            });
        }

        // Apply elemental advantage modifier
        if (target.element && this.element) {
            const advantageMultiplier = ElementalAdvantages[this.element][target.element] || 1.0;
            damage *= advantageMultiplier;

            // Show visual feedback for advantage
            if (advantageMultiplier > 1.0) {
                // Could add super effective visual
            } else if (advantageMultiplier < 1.0) {
                // Could add not very effective visual
            }
        }

        // Air towers have a chance for critical hits
        if (this.element === ElementTypes.AIR && Math.random() < 0.15) {
            damage *= 2; // Critical hit
            // Could add critical hit visual
        }

        return damage;
    }

    applyEmpowerment(multiplier, duration) {
        this.empowered = true;
        this.empowermentMultiplier = multiplier;
        this.empowermentEndTime = performance.now() + (duration * 1000);

        // Visual effects handled by renderer in the render loop
    }

    applyEffect(effectType, value, duration) {
        // Add effect to tower
        this.appliedEffects.push({
            type: effectType,
            value: value,
            remainingDuration: duration
        });

        // Apply effect immediately
        switch (effectType) {
            case 'shield':
                // Damage reduction
                this.shield = value; // 0.5 = 50% damage reduction
                break;

            case 'haste':
                // Attack speed boost
                this.hasteMultiplier = value; // 1.5 = 50% faster attacks
                break;

            // Add more effect types as needed
        }
    }

    // Process active effects (call in update method)
    processEffects(deltaTime) {
        // Process each effect and remove expired ones
        for (let i = this.appliedEffects.length - 1; i >= 0; i--) {
            const effect = this.appliedEffects[i];

            // Decrease duration
            effect.remainingDuration -= deltaTime;

            if (effect.remainingDuration <= 0) {
                // Effect expired, remove it
                switch (effect.type) {
                    case 'shield':
                        this.shield = 0;
                        break;

                    case 'haste':
                        this.hasteMultiplier = 1.0;
                        break;
                }

                this.appliedEffects.splice(i, 1);
            }
        }
    }

    // Add cleanup method to properly remove tower
    cleanup() {
        if (this.towerInstance) {
            this.game.renderer.removeTower(this.towerInstance);
            this.towerInstance = null;
        }
    }
}