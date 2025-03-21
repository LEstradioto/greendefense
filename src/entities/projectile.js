export class Projectile {
    constructor(game, type, startPosition, target, damage, areaOfEffect = 0) {
        this.game = game;
        this.type = type;
        this.position = { ...startPosition };
        this.target = target;
        this.damage = damage;
        this.areaOfEffect = areaOfEffect;
        
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
        if (this.type === 'arrow') {
            this.rotateToDirection();
        }
    }
    
    setStats() {
        // Set stats based on projectile type
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
                
            default:
                this.speed = 15;
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
            
            // Rotate if it's an arrow (makes it spin)
            if (this.type === 'cannon') {
                this.mesh.rotation.x += 5 * deltaTime;
                this.mesh.rotation.z += 5 * deltaTime;
            }
        }
        
        // Check for collision with target
        this.checkCollision();
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
            }
            
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
            }
        }
        
        // Create explosion effect
        this.createExplosionEffect();
    }
    
    createExplosionEffect() {
        // Create a simple explosion effect
        const explosionGeometry = new THREE.SphereGeometry(this.areaOfEffect, 16, 16);
        const explosionMaterial = new THREE.MeshBasicMaterial({
            color: 0xFF6600,
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
        // Check if projectile is outside of map bounds
        const mapWidth = this.game.map.gridWidth;
        const mapHeight = this.game.map.gridHeight;
        
        return (
            this.position.x < -mapWidth / 2 - 5 ||
            this.position.x > mapWidth / 2 + 5 ||
            this.position.z < -mapHeight / 2 - 5 ||
            this.position.z > mapHeight / 2 + 5
        );
    }
}