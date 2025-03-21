export class PowerCards {
    constructor(game) {
        this.game = game;
        this.activeEffects = [];
        
        // Power card cooldowns
        this.cooldowns = {
            meteor: false,
            freeze: false,
            hero: false,
            gold: false,
            empower: false
        };
        
        // Cooldown times in milliseconds
        this.cooldownTimes = {
            meteor: 45000,   // 45 seconds
            freeze: 60000,   // 60 seconds
            hero: 90000,     // 90 seconds
            gold: 30000,     // 30 seconds
            empower: 75000   // 75 seconds
        };
    }
    
    update(deltaTime) {
        // Update active effects
        for (let i = this.activeEffects.length - 1; i >= 0; i--) {
            const effect = this.activeEffects[i];
            const completed = effect.update(performance.now());
            
            if (completed) {
                this.activeEffects.splice(i, 1);
            }
        }
    }
    
    activate(cardType) {
        // Check cooldown
        if (this.cooldowns[cardType]) {
            return false;
        }
        
        // Activate card effect
        switch (cardType) {
            case 'meteor':
                this.activateMeteorStrike();
                break;
            case 'freeze':
                this.activateFreezeWave();
                break;
            case 'hero':
                this.activateSummonHero();
                break;
            case 'gold':
                this.activateGoldRush();
                break;
            case 'empower':
                this.activateTowerEmpowerment();
                break;
            default:
                return false;
        }
        
        // Start cooldown
        this.startCooldown(cardType);
        
        return true;
    }
    
    startCooldown(cardType) {
        this.cooldowns[cardType] = true;
        
        // Reset cooldown after time
        setTimeout(() => {
            this.cooldowns[cardType] = false;
        }, this.cooldownTimes[cardType]);
    }
    
    activateMeteorStrike() {
        // Target the most enemies with a meteor strike
        const targetPosition = this.findBestMeteorTarget();
        
        // Create meteor strike effect
        const meteorEffect = this.game.renderer.createSpecialEffect('meteor', targetPosition);
        this.activeEffects.push(meteorEffect);
        
        // Damage enemies in area when meteor impacts
        setTimeout(() => {
            this.applyMeteorDamage(targetPosition);
        }, 1000); // Delay damage until meteor impacts
    }
    
    findBestMeteorTarget() {
        const enemies = this.game.enemies;
        
        if (enemies.length === 0) {
            // If no enemies, target the center of the map
            return { x: 0, y: 0, z: 0 };
        }
        
        // Simple strategy: target the group with most enemies
        const meteorRadius = 5;
        let bestTarget = null;
        let maxEnemiesHit = 0;
        
        for (const enemy of enemies) {
            let enemiesHit = 0;
            
            // Count how many enemies would be hit if we target this enemy
            for (const otherEnemy of enemies) {
                const distance = this.game.calculateDistance(enemy.position, otherEnemy.position);
                if (distance <= meteorRadius) {
                    enemiesHit++;
                }
            }
            
            if (enemiesHit > maxEnemiesHit) {
                maxEnemiesHit = enemiesHit;
                bestTarget = enemy.position;
            }
        }
        
        return bestTarget || enemies[0].position;
    }
    
    applyMeteorDamage(position) {
        const enemies = this.game.enemies;
        const meteorRadius = 5;
        const meteorDamage = 100;
        
        for (const enemy of enemies) {
            const distance = this.game.calculateDistance(position, enemy.position);
            
            if (distance <= meteorRadius) {
                // Deal damage based on distance from center of impact
                const damageMultiplier = 1 - (distance / meteorRadius);
                const damage = Math.floor(meteorDamage * damageMultiplier);
                
                enemy.takeDamage(damage);
            }
        }
    }
    
    activateFreezeWave() {
        // Center of the map
        const centerPosition = { x: 0, y: 0, z: 0 };
        
        // Create freeze effect
        const freezeEffect = this.game.renderer.createSpecialEffect('freeze', centerPosition);
        this.activeEffects.push(freezeEffect);
        
        // Apply slow effect to all enemies
        for (const enemy of this.game.enemies) {
            enemy.applySlowEffect(0.5, 10); // 50% slow for 10 seconds
        }
    }
    
    activateSummonHero() {
        // Find position for hero near the start of the path
        const spawnPosition = { ...this.game.map.getStartPoint() };
        spawnPosition.x += 1; // Slight offset from path
        
        // Create hero entity (a specialized enemy that fights for the player)
        this.createHero(spawnPosition);
    }
    
    createHero(position) {
        // Hero is implemented as a special enemy type that targets other enemies
        const hero = {
            position: { ...position },
            health: 500,
            maxHealth: 500,
            damage: 40,
            attackRadius: 3,
            attackInterval: 1,
            lastAttackTime: 0,
            lifespan: 30, // 30 seconds
            creationTime: performance.now(),
            
            update: (deltaTime) => {
                // Check if hero's lifespan is over
                const now = performance.now();
                if (now - hero.creationTime > hero.lifespan * 1000) {
                    return true; // Hero should be removed
                }
                
                // Find closest enemy to attack
                let closestEnemy = null;
                let closestDistance = Infinity;
                
                for (const enemy of this.game.enemies) {
                    const distance = this.game.calculateDistance(hero.position, enemy.position);
                    
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestEnemy = enemy;
                    }
                }
                
                // Attack enemy if in range and attack is off cooldown
                if (closestEnemy && closestDistance <= hero.attackRadius) {
                    if (now - hero.lastAttackTime > hero.attackInterval * 1000) {
                        // Attack enemy
                        closestEnemy.takeDamage(hero.damage);
                        hero.lastAttackTime = now;
                    }
                } else if (closestEnemy) {
                    // Move towards closest enemy
                    const direction = {
                        x: closestEnemy.position.x - hero.position.x,
                        z: closestEnemy.position.z - hero.position.z
                    };
                    
                    // Normalize direction
                    const length = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
                    direction.x /= length;
                    direction.z /= length;
                    
                    // Move hero
                    const moveSpeed = 5 * deltaTime;
                    hero.position.x += direction.x * moveSpeed;
                    hero.position.z += direction.z * moveSpeed;
                    
                    // Update hero mesh position
                    if (hero.mesh) {
                        hero.mesh.position.set(hero.position.x, hero.position.y, hero.position.z);
                    }
                }
                
                return false; // Hero should stay active
            }
        };
        
        // Create hero visual representation
        const geometry = new THREE.SphereGeometry(0.4, 16, 16);
        const material = new THREE.MeshStandardMaterial({ color: 0xFFD700 }); // Gold color
        const heroMesh = new THREE.Mesh(geometry, material);
        
        heroMesh.position.set(position.x, 0.4, position.z);
        heroMesh.castShadow = true;
        
        this.game.renderer.scene.add(heroMesh);
        hero.mesh = heroMesh;
        
        // Add hero to active effects
        this.activeEffects.push({
            update: (currentTime) => {
                const result = hero.update(this.game.deltaTime);
                
                if (result) {
                    // Hero's lifespan is over, remove mesh
                    this.game.renderer.scene.remove(hero.mesh);
                    return true;
                }
                
                return false;
            }
        });
    }
    
    activateGoldRush() {
        // Center of the map
        const centerPosition = { x: 0, y: 1, z: 0 };
        
        // Create gold rush effect
        const goldRushEffect = this.game.renderer.createSpecialEffect('goldRush', centerPosition);
        this.activeEffects.push(goldRushEffect);
        
        // Give player gold
        this.game.player.gold += 50;
        this.game.updateUI();
    }
    
    activateTowerEmpowerment() {
        // Create empowerment effect for all towers
        const centerPosition = { x: 0, y: 0, z: 0 };
        const empowerEffect = this.game.renderer.createSpecialEffect('empower', centerPosition);
        this.activeEffects.push(empowerEffect);
        
        // Boost all towers
        for (const tower of this.game.towers) {
            tower.applyEmpowerment(2, 15); // Double damage for 15 seconds
        }
    }
}