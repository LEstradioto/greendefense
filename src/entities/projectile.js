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
        if (!this.mesh) return;
        
        // Create a quaternion rotation from the direction vector
        const dirVector = new THREE.Vector3(this.direction.x, this.direction.y, this.direction.z);
        const quaternion = new THREE.Quaternion();
        
        // Default forward orientation for a cone is along the Y axis
        const defaultForward = new THREE.Vector3(0, 1, 0);
        
        // First, figure out the rotation from default forward to the target direction
        quaternion.setFromUnitVectors(defaultForward, dirVector.normalize());
        
        // Apply the quaternion to the mesh
        this.mesh.quaternion.copy(quaternion);
    }
    
    update(deltaTime) {
        if (this.hit) return;
        
        // Update time alive
        this.timeAlive += deltaTime;
        
        // Check if projectile has exceeded its lifetime
        if (this.timeAlive > this.maxLifetime) {
            this.hit = true;
            return;
        }
        
        // Move projectile
        this.position.x += this.direction.x * this.speed * deltaTime;
        this.position.y += this.direction.y * this.speed * deltaTime;
        this.position.z += this.direction.z * this.speed * deltaTime;
        
        // Update mesh position
        if (this.mesh) {
            this.mesh.position.set(this.position.x, this.position.y, this.position.z);
            
            // Add rotations for certain projectiles
            if (this.type === 'cannon') {
                this.mesh.rotation.x += 5 * deltaTime;
                this.mesh.rotation.z += 5 * deltaTime;
            } else if (this.type === 'air') {
                // Air projectiles spin fast
                this.mesh.rotation.y += 10 * deltaTime;
            }
        }
        
        // Create trail effects for elemental projectiles
        if (this.trailEffect && this.timeAlive % 0.1 < deltaTime) {
            this.createTrailEffect();
        }
        
        // Check for collision with target
        this.checkCollision();
    }
    
    createTrailEffect() {
        // Skip if no mesh or not in renderer
        if (!this.mesh || !this.game.renderer) return;
        
        // Create a trail particle
        const particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const particleMaterial = new THREE.MeshBasicMaterial({
            color: this.trailColor || 0xFFFFFF,
            transparent: true,
            opacity: 0.7
        });
        
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        particle.position.copy(this.mesh.position);
        
        this.game.renderer.scene.add(particle);
        
        // Animate and remove particle
        const startTime = performance.now();
        const duration = 500; // 0.5 seconds
        
        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            if (progress < 1) {
                // Fade out and shrink particle
                particleMaterial.opacity = 0.7 * (1 - progress);
                particle.scale.set(1 - progress, 1 - progress, 1 - progress);
                
                requestAnimationFrame(animate);
            } else {
                // Remove particle
                this.game.renderer.scene.remove(particle);
            }
        };
        
        animate();
    }
    
    checkCollision() {
        // Calculate distance to target
        const distance = this.game.calculateDistance(this.position, this.target.position);
        
        // Check if projectile is close enough to hit
        const hitThreshold = 0.3; // Collision radius
        
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
        
        // Create explosion effect
        this.createExplosionEffect();
    }
    
    createHitEffect() {
        if (!this.game.renderer) return;
        
        // Get color based on element
        let color = 0xFFFFFF;
        if (this.element && ElementStyles[this.element]) {
            color = ElementStyles[this.element].particleColor;
        }
        
        // Create a simple hit effect
        const hitGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const hitMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.8
        });
        
        const hit = new THREE.Mesh(hitGeometry, hitMaterial);
        hit.position.set(this.position.x, this.position.y, this.position.z);
        
        this.game.renderer.scene.add(hit);
        
        // Animate and remove hit effect
        const startTime = performance.now();
        const duration = 300; // 0.3 seconds
        
        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            if (progress < 1) {
                // Expand and fade out
                const scale = 1 + progress * 2;
                hit.scale.set(scale, scale, scale);
                hitMaterial.opacity = 0.8 * (1 - progress);
                
                requestAnimationFrame(animate);
            } else {
                // Remove hit effect
                this.game.renderer.scene.remove(hit);
            }
        };
        
        animate();
    }
    
    createExplosionEffect() {
        if (!this.game.renderer) return;
        
        // Get color based on element
        let color = 0xFF6600;
        if (this.element && ElementStyles[this.element]) {
            color = ElementStyles[this.element].color;
        }
        
        // Create a simple explosion effect
        const explosionGeometry = new THREE.SphereGeometry(this.areaOfEffect, 16, 16);
        const explosionMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.7
        });
        
        const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
        explosion.position.set(this.position.x, this.position.y, this.position.z);
        
        this.game.renderer.scene.add(explosion);
        
        // Animate and remove explosion
        const startTime = performance.now();
        const duration = 500; // 0.5 seconds
        
        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            if (progress < 1) {
                // Fade out explosion
                explosionMaterial.opacity = 0.7 * (1 - progress);
                
                requestAnimationFrame(animate);
            } else {
                // Remove explosion
                this.game.renderer.scene.remove(explosion);
            }
        };
        
        animate();
    }
    
    isOutOfBounds() {
        // Check if projectile is outside of map bounds (more strict boundaries)
        const mapWidth = this.game.map.gridWidth;
        const mapHeight = this.game.map.gridHeight;
        
        // Also check if the projectile has gone too far vertically (up or down)
        const outOfBounds = (
            this.position.x < -mapWidth / 2 - 2 ||
            this.position.x > mapWidth / 2 + 2 ||
            this.position.z < -mapHeight / 2 - 2 ||
            this.position.z > mapHeight / 2 + 2 ||
            this.position.y < -5 ||
            this.position.y > 20
        );
        
        // If out of bounds, clean up the mesh
        if (outOfBounds && this.mesh) {
            this.game.renderer.scene.remove(this.mesh);
            this.mesh = null;
        }
        
        return outOfBounds;
    }
}