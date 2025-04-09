import { ElementTypes, ElementStyles } from '../elements.js';

export class Projectile {
    constructor(game, type, startPosition, target, damage, areaOfEffect = 0, element = ElementTypes.NEUTRAL) {
        this.game = game;
        this.type = type;
        this.position = { ...startPosition };
        this.target = target;
        this.damage = damage;
        this.areaOfEffect = areaOfEffect;
        this.element = element;

        // Projectile stats
        this.setStats();

        // Projectile state
        this.hit = false;
        this.timeAlive = 0;
        this.maxLifetime = 5; // Maximum 5 seconds before auto-destruction

        // Calculate direction to target
        this.calculateDirection();

        // Create 3D representation
        this.mesh = this.game.renderer.createProjectile(this);
        this.mesh.position.set(startPosition.x, startPosition.y, startPosition.z);

        // Rotate projectile to face target direction
        if (this.type === 'arrow' ||
            this.type === 'fire' ||
            this.type === 'water' ||
            this.type === 'earth' ||
            this.type === 'air' ||
            this.type === 'shadow') {
            this.rotateToDirection();
        }
    }

    // Reset method for object pooling
    reset() {
        this.hit = false;
        this.timeAlive = 0;
        // Don't reset mesh as we'll reuse it
    }

    // Static method to get a projectile from pool or create new
    static fromPool(game, type, startPosition, target, damage, areaOfEffect = 0, element = ElementTypes.NEUTRAL) {
        // TEMPORARY: Disable pooling entirely to fix visibility issues
        // Creating a fresh projectile every time is more reliable
        return new Projectile(game, type, startPosition, target, damage, areaOfEffect, element);

        /* Original pooling code disabled for debugging
        // Check if there's a projectile of the right type in the pool
        if (game.projectilePool && game.projectilePool.length > 0) {
            for (let i = 0; i < game.projectilePool.length; i++) {
                if (game.projectilePool[i].type === type) {
                    // Found a matching projectile, reuse it
                    const projectile = game.projectilePool.splice(i, 1)[0];

                    // Reset and update properties
                    projectile.position = { ...startPosition };
                    projectile.target = target;
                    projectile.damage = damage;
                    projectile.areaOfEffect = areaOfEffect;
                    projectile.element = element;
                    projectile.timeAlive = 0;
                    projectile.hit = false;

                    // Update mesh position
                    if (projectile.mesh) {
                        projectile.mesh.position.set(startPosition.x, startPosition.y, startPosition.z);
                    }

                    // Recalculate direction to new target
                    projectile.calculateDirection();

                    // Re-rotate to face new direction
                    projectile.rotateToDirection();

                    return projectile;
                }
            }
        }

        // No matching projectile in pool, create new
        return new Projectile(game, type, startPosition, target, damage, areaOfEffect, element);
        */
    }

    setStats() {
        // Set stats based on projectile type and element
        switch (this.type) {
            case 'arrow':
                this.speed = 15;
                break;

            case 'doubleArrow':
                this.speed = 18;
                break;

            case 'cannon':
                this.speed = 10;
                break;

            // Elemental projectiles
            case 'fire':
                this.speed = 14;
                this.trailEffect = true;
                this.trailColor = ElementStyles[ElementTypes.FIRE].particleColor;
                break;

            case 'water':
                this.speed = 12;
                this.trailEffect = true;
                this.trailColor = ElementStyles[ElementTypes.WATER].particleColor;
                break;

            case 'earth':
                this.speed = 9;
                this.trailEffect = false;
                break;

            case 'air':
                this.speed = 20;
                this.trailEffect = true;
                this.trailColor = ElementStyles[ElementTypes.AIR].particleColor;
                break;

            case 'shadow':
                this.speed = 13;
                this.trailEffect = true;
                this.trailColor = ElementStyles[ElementTypes.SHADOW].particleColor;
                break;

            default:
                this.speed = 15;
                this.trailEffect = false;
        }
    }

    calculateDirection() {
        // Direction from current position to target
        this.direction = {
            x: this.target.position.x - this.position.x,
            y: (this.target.position.y + 0.5) - this.position.y, // Target slightly above center
            z: this.target.position.z - this.position.z
        };

        // Normalize direction
        const length = Math.sqrt(
            this.direction.x * this.direction.x +
            this.direction.y * this.direction.y +
            this.direction.z * this.direction.z
        );

        this.direction.x /= length;
        this.direction.y /= length;
        this.direction.z /= length;
    }

    rotateToDirection() {
        // Skip rotation for simple projectiles - rotation code caused issues
        // This also improves performance
    }

    // Check if projectile is out of map bounds
    isOutOfBounds() {
        // Get map dimensions from game object
        const mapWidth = this.game.map ? this.game.map.gridWidth : 20;
        const mapHeight = this.game.map ? this.game.map.gridHeight : 20;

        // Add some margin to allow for projectiles slightly outside bounds
        const margin = 5;

        // Check if position is far outside map bounds
        return (
            this.position.x < -mapWidth/2 - margin ||
            this.position.x > mapWidth/2 + margin ||
            this.position.z < -mapHeight/2 - margin ||
            this.position.z > mapHeight/2 + margin ||
            this.position.y < -5 ||
            this.position.y > 20
        );
    }

    update(deltaTime) {
        // IMPORTANT DEBUG: Mark each update call to track frequency
        this._lastUpdateTime = performance.now();

        // DEBUG: Log mesh visibility status once every second
        if (!this._lastDebugTime || performance.now() - this._lastDebugTime > 1000) {
            this._lastDebugTime = performance.now();
        }

        if (this.hit) return;

        // Update time alive
        this.timeAlive += deltaTime;

        // Check if projectile has exceeded its lifetime
        if (this.timeAlive > this.maxLifetime) {
            this.hit = true;
            return;
        }

        // Move projectile faster for better visibility
        const speedMultiplier = 1.0; // Normal speed
        this.position.x += this.direction.x * this.speed * speedMultiplier * deltaTime;
        this.position.y += this.direction.y * this.speed * speedMultiplier * deltaTime;
        this.position.z += this.direction.z * this.speed * speedMultiplier * deltaTime;

        // ALWAYS update mesh position to make sure it's visible
        if (this.mesh) {
            this.mesh.position.set(this.position.x, this.position.y, this.position.z);

            // Add more aggressive rotation to make it MUCH more noticeable
            this.mesh.rotation.x += 5 * deltaTime;
            this.mesh.rotation.y += 7 * deltaTime;
            this.mesh.rotation.z += 3 * deltaTime;

            // Alternative: Make it grow/shrink slightly for better visibility
            const pulseScale = 1 + 0.3 * Math.sin(this.timeAlive * 10);
            this.mesh.scale.set(pulseScale, pulseScale, pulseScale);
        } else {
            // If mesh somehow got lost, try to recreate it
            console.warn(`Projectile lost its mesh! Recreating...`);
            this.mesh = this.game.renderer.createProjectile(this);
            this.mesh.position.set(this.position.x, this.position.y, this.position.z);
        }

        // Completely disable all trail effects for maximum performance
        // No trail particles will be created regardless of performance

        // Check for collision with target
        this.checkCollision();

        // Check if projectile is too far from the original tower
        this.checkDistance();
    }

    // New method to check distance from firing tower
    checkDistance() {
        // Skip if we don't have an origin position
        if (!this.originTower || !this.originTower.position) return;

        // Calculate distance from origin tower
        const distance = this.game.calculateDistance(this.position, this.originTower.position);

        // Self-destruct if beyond range + some margin
        if (distance > this.originTower.range * 1.2) {
            this.hit = true;

            // Fade out quickly instead of just disappearing
            if (this.mesh) {
                // Create a quick fade out animation
                const startTime = performance.now();
                const duration = 150; // Very quick fade out (150ms)

                this.game.addAnimationEffect({
                    startTime: startTime,
                    duration: duration,
                    update: (progress) => {
                        // Fade out and shrink
                        if (this.mesh.material) {
                            this.mesh.material.opacity = 1 - progress;
                        }
                        const scale = 1 - (progress * 0.8);
                        this.mesh.scale.set(scale, scale, scale);

                        // When complete
                        if (progress >= 1) {
                            return true; // Animation complete
                        }
                        return false; // Animation still running
                    }
                });
            }

            // For projectiles with area effect, create a small impact effect
            if (this.areaOfEffect > 0 && Math.random() < 0.5) {
                this.createSimpleExplosionEffect();
            }
        }
    }

    // Simplified explosion effect for low performance mode
    createSimpleExplosionEffect() {
        if (!this.game.renderer || this.game.lowQualityMode && Math.random() > 0.6) {
            return; // Skip creating any particles
        }

        // Get color based on element
        let color = 0xFF6600;
        if (this.element && ElementStyles[this.element]) {
            color = ElementStyles[this.element].color;
        }

        // Create a very simple explosion (just a few particles)
        const particleCount = 6; // Very few particles
        const explosionGroup = new THREE.Group();
        explosionGroup.position.set(this.position.x, this.position.y + 0.1, this.position.z);
        explosionGroup.renderOrder = 10;

        // Create a few simple particles
        for (let i = 0; i < particleCount; i++) {
            // Simpler geometry with fewer vertices
            const particleGeometry = new THREE.SphereGeometry(0.1 + Math.random() * 0.1, 4, 4);

            // Simple material without special effects
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.3
            });

            const particle = new THREE.Mesh(particleGeometry, particleMaterial);

            // Random position within smaller explosion radius
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const radius = 0.2 + Math.random() * 0.4;

            particle.position.x = radius * Math.sin(phi) * Math.cos(theta);
            particle.position.y = 0.1 + radius * Math.sin(phi) * Math.sin(theta);
            particle.position.z = radius * Math.cos(phi);

            // Store initial scale for animation
            const initialScale = 0.2 + Math.random() * 0.2;
            const finalScale = initialScale * (1.2 + Math.random() * 0.5);

            particle.scale.set(initialScale, initialScale, initialScale);

            // Store animation parameters
            particle.userData = {
                initialScale: initialScale,
                finalScale: finalScale,
                speed: 0.5 + Math.random() * 0.5
            };

            explosionGroup.add(particle);
        }

        this.game.renderer.scene.add(explosionGroup);

        // Very short animation
        const startTime = performance.now();
        const duration = 300; // Just 0.3 seconds

        // Add to game's animation system instead of creating a new loop
        this.game.addAnimationEffect({
            startTime: startTime,
            duration: duration,
            update: (progress) => {
                explosionGroup.children.forEach(particle => {
                    const { initialScale, finalScale, speed } = particle.userData;

                    // Simple scale change
                    const currentScale = initialScale + (finalScale - initialScale) * progress;
                    particle.scale.set(currentScale, currentScale, currentScale);

                    // Simple fade out
                    particle.material.opacity = 0.3 * (1 - progress);
                });

                // When complete
                if (progress >= 1) {
                    // Quick cleanup
                    while (explosionGroup.children.length > 0) {
                        const particle = explosionGroup.children[0];
                        explosionGroup.remove(particle);
                        if (particle.geometry) particle.geometry.dispose();
                        if (particle.material) particle.material.dispose();
                    }

                    this.game.renderer.scene.remove(explosionGroup);
                    return true; // Animation complete
                }
                return false; // Animation still running
            }
        });
    }

    // Simpler trail effect for low performance mode
    createSimpleTrailEffect() {
        // Skip if no mesh or not in renderer
        if (!this.mesh || !this.game.renderer) return;

        // Create a simplified trail particle with fewer vertices and simpler materials
        const particleGeometry = new THREE.SphereGeometry(0.12, 4, 4); // Fewer segments
        const particleMaterial = new THREE.MeshBasicMaterial({
            color: this.trailColor || 0xFFFFFF,
            transparent: true,
            opacity: 0.5
            // No special blending or depth settings to save on performance
        });

        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        particle.position.copy(this.mesh.position);
        particle.renderOrder = 5;

        this.game.renderer.scene.add(particle);

        // Simplified animation with shorter duration
        const startTime = performance.now();
        const duration = 300; // 0.3 seconds - shorter lifetime

        // Add to game's animation system instead of creating a new loop
        this.game.addAnimationEffect({
            startTime: startTime,
            duration: duration,
            update: (progress) => {
                // Only animate opacity, not scale
                particleMaterial.opacity = 0.5 * (1 - progress);

                // When complete
                if (progress >= 1) {
                    this.game.renderer.scene.remove(particle);
                    particleGeometry.dispose();
                    particleMaterial.dispose();
                    return true; // Animation complete
                }
                return false; // Animation still running
            }
        });
    }

    createTrailEffect() {
        // Skip if no mesh or not in renderer
        if (!this.mesh || !this.game.renderer) return;

        // Create a single, simple trail element
        const particleGeometry = new THREE.SphereGeometry(0.1, 4, 4); // Reduced segments
        const particleMaterial = new THREE.MeshBasicMaterial({
            color: this.trailColor || 0xFFFFFF,
            transparent: true,
            opacity: 0.5 // Reduced opacity
        });

        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        particle.position.copy(this.mesh.position);

        // Ensure particles render above the ground by setting renderOrder
        particle.renderOrder = 5;

        // No random offsets - simplify positioning
        this.game.renderer.scene.add(particle);

        // Animate and remove particle - much shorter duration
        const startTime = performance.now();
        const duration = 250; // 0.25 seconds (halved from 0.5)

        // Add to game's animation system instead of creating a new loop
        this.game.addAnimationEffect({
            startTime: startTime,
            duration: duration,
            update: (progress) => {
                // Simple fade out only - no scaling to reduce calculations
                particleMaterial.opacity = 0.5 * (1 - progress);

                // When complete
                if (progress >= 1) {
                    // Clean up resources
                    if (particle.geometry) particle.geometry.dispose();
                    if (particle.material) particle.material.dispose();

                    // Remove particle
                    this.game.renderer.scene.remove(particle);
                    return true; // Animation complete
                }
                return false; // Animation still running
            }
        });
    }

    checkCollision() {
        // Skip collision detection if target doesn't exist anymore
        if (!this.target || !this.target.position) {
            // Target is gone, mark as hit to remove
            this.hit = true;
            return;
        }

        // Calculate distance to target
        const distance = this.game.calculateDistance(this.position, this.target.position);

        // Check if projectile is close enough to hit
        const hitThreshold = 0.4; // Larger collision radius for better hit detection

        if (distance <= hitThreshold) {
            this.hit = true;

            // Apply damage to target
            if (this.areaOfEffect > 0) {
                // Area of effect damage
                this.applyAreaDamage();
            } else {
                // Direct damage
                this.target.takeDamage(this.damage);

                // Apply element effects
                if (this.element && this.target.applyStatusEffect) {
                    // Different effects based on element
                    switch (this.element) {
                        case ElementTypes.FIRE:
                            if (Math.random() < 0.3) {
                                this.target.applyStatusEffect('burn', {
                                    duration: 3,
                                    damagePerTick: this.damage * 0.1,
                                    tickInterval: 1
                                });
                            }
                            break;

                        case ElementTypes.WATER:
                            if (Math.random() < 0.4) {
                                this.target.applyStatusEffect('slow', {
                                    duration: 2,
                                    speedModifier: 0.6
                                });
                            }
                            break;

                        case ElementTypes.SHADOW:
                            if (Math.random() < 0.3) {
                                this.target.applyStatusEffect('weaken', {
                                    duration: 3,
                                    damageModifier: 0.8
                                });
                            }
                            break;
                    }
                }
            }

            // Create hit effect based on element
            this.createHitEffect();

            // Remove projectile mesh
            if (this.mesh) {
                this.game.renderer.scene.remove(this.mesh);
            }
        }
    }

    applyAreaDamage() {
        for (const enemy of this.game.enemies) {
            const distance = this.game.calculateDistance(this.position, enemy.position);

            if (distance <= this.areaOfEffect) {
                // Calculate damage based on distance from center of explosion
                const damageMultiplier = 1 - (distance / this.areaOfEffect);
                const damage = Math.floor(this.damage * damageMultiplier);

                enemy.takeDamage(damage);

                // Apply element effects to all enemies in area
                if (this.element && enemy.applyStatusEffect) {
                    // Apply with reduced chance based on distance
                    const effectChance = 0.3 * (1 - distance / this.areaOfEffect);

                    switch (this.element) {
                        case ElementTypes.FIRE:
                            if (Math.random() < effectChance) {
                                enemy.applyStatusEffect('burn', {
                                    duration: 3,
                                    damagePerTick: this.damage * 0.1,
                                    tickInterval: 1
                                });
                            }
                            break;

                        case ElementTypes.WATER:
                            if (Math.random() < effectChance) {
                                enemy.applyStatusEffect('slow', {
                                    duration: 2,
                                    speedModifier: 0.6
                                });
                            }
                            break;

                        case ElementTypes.SHADOW:
                            if (Math.random() < effectChance) {
                                enemy.applyStatusEffect('weaken', {
                                    duration: 3,
                                    damageModifier: 0.8
                                });
                            }
                            break;
                    }
                }
            }
        }

        // Visual effects completely disabled for performance
    }

    createHitEffect() {
        // Completely disabled for performance reasons
        return;
                explosionGeometry.dispose();
                explosionMaterial.dispose();



        animate();
    }
}