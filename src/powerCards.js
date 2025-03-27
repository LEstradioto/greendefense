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
        const meteorEffect = this.createMeteorEffect(targetPosition);
        this.activeEffects.push(meteorEffect);
        
        // Damage enemies in area when meteor impacts
        setTimeout(() => {
            this.applyMeteorDamage(targetPosition);
        }, 1000); // Delay damage until meteor impacts
    }
    
    createShieldEffect(position) {
        // Create shield visual effect
        const THREE = this.game.renderer.THREE;
        const radius = 0.6;
        const geometry = new THREE.SphereGeometry(radius, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color: 0x8BC34A,
            transparent: true,
            opacity: 0.5,
            wireframe: true
        });
        
        const shield = new THREE.Mesh(geometry, material);
        shield.position.set(position.x, position.y, position.z);
        this.game.renderer.scene.add(shield);
        
        const startTime = performance.now();
        const duration = 5000; // 5 seconds
        
        // Return effect object with update method
        return {
            update: (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = elapsed / duration;
                
                if (progress >= 1.0) {
                    // Remove effect when done
                    this.game.renderer.scene.remove(shield);
                    return true;
                }
                
                // Pulse effect
                const scale = 1.0 + 0.2 * Math.sin(progress * Math.PI * 10);
                shield.scale.set(scale, scale, scale);
                
                // Fade out at the end
                if (progress > 0.7) {
                    material.opacity = 0.5 * (1.0 - (progress - 0.7) / 0.3);
                }
                
                return false;
            }
        };
    }
    
    createWindEffect(position) {
        // Create wind rush visual effect
        const THREE = this.game.renderer.THREE;
        
        // Create spiral particles
        const particleCount = 20;
        const particles = new THREE.Group();
        
        for (let i = 0; i < particleCount; i++) {
            const particleGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: 0x81D4FA,
                transparent: true,
                opacity: 0.7
            });
            
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            
            // Position particles in a spiral
            const angle = (i / particleCount) * Math.PI * 2;
            const radius = 0.3 + (i / particleCount) * 0.5;
            
            particle.position.set(
                position.x + Math.cos(angle) * radius,
                position.y,
                position.z + Math.sin(angle) * radius
            );
            
            // Store original position and angle for animation
            particle.userData.angle = angle;
            particle.userData.radius = radius;
            particle.userData.speed = 0.05 + Math.random() * 0.1;
            particle.userData.ySpeed = 0.02 + Math.random() * 0.03;
            
            particles.add(particle);
        }
        
        this.game.renderer.scene.add(particles);
        
        const startTime = performance.now();
        const duration = 4000; // 4 seconds
        
        // Return effect object with update method
        return {
            update: (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = elapsed / duration;
                
                if (progress >= 1.0) {
                    // Remove effect when done
                    this.game.renderer.scene.remove(particles);
                    return true;
                }
                
                // Animate particles in a spiral motion
                particles.children.forEach((particle, i) => {
                    // Rotate around center
                    particle.userData.angle += particle.userData.speed;
                    
                    // Expand radius and rise up
                    const newRadius = particle.userData.radius * (1 + progress * 2);
                    const height = position.y + progress * 2 * particle.userData.ySpeed * elapsed;
                    
                    particle.position.set(
                        position.x + Math.cos(particle.userData.angle) * newRadius,
                        height,
                        position.z + Math.sin(particle.userData.angle) * newRadius
                    );
                    
                    // Fade out
                    if (progress > 0.7) {
                        particle.material.opacity = 0.7 * (1.0 - (progress - 0.7) / 0.3);
                    }
                });
                
                return false;
            }
        };
    }
    
    createDrainEffect(position) {
        // Create void drain visual effect
        const THREE = this.game.renderer.THREE;
        
        // Create dark particles that converge
        const particleCount = 15;
        const particles = new THREE.Group();
        
        for (let i = 0; i < particleCount; i++) {
            const particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: 0x7E57C2,
                transparent: true,
                opacity: 0.8
            });
            
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            
            // Position particles randomly around the position
            const angle = Math.random() * Math.PI * 2;
            const radius = 0.5 + Math.random() * 1.0;
            const height = position.y + Math.random() * 1.0;
            
            particle.position.set(
                position.x + Math.cos(angle) * radius,
                height,
                position.z + Math.sin(angle) * radius
            );
            
            // Store target position for animation
            particle.userData.startPos = { 
                x: particle.position.x,
                y: particle.position.y,
                z: particle.position.z
            };
            
            particles.add(particle);
        }
        
        this.game.renderer.scene.add(particles);
        
        const startTime = performance.now();
        const duration = 3000; // 3 seconds
        
        // Return effect object with update method
        return {
            update: (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = elapsed / duration;
                
                if (progress >= 1.0) {
                    // Remove effect when done
                    this.game.renderer.scene.remove(particles);
                    return true;
                }
                
                // Move particles toward center in a spiral
                particles.children.forEach((particle) => {
                    // Get closer to target (converge)
                    const startPos = particle.userData.startPos;
                    
                    particle.position.set(
                        startPos.x + (position.x - startPos.x) * progress,
                        startPos.y + (position.y - startPos.y) * progress,
                        startPos.z + (position.z - startPos.z) * progress
                    );
                    
                    // Add some spiral motion
                    const spiralAngle = progress * Math.PI * 4;
                    const spiralRadius = (1 - progress) * 0.4;
                    
                    particle.position.x += Math.cos(spiralAngle) * spiralRadius;
                    particle.position.z += Math.sin(spiralAngle) * spiralRadius;
                    
                    // Shrink particles as they converge
                    const scale = 1.0 - progress * 0.7;
                    particle.scale.set(scale, scale, scale);
                    
                    // Pulse opacity
                    particle.material.opacity = 0.8 * (1 - 0.5 * Math.sin(progress * Math.PI * 8));
                });
                
                return false;
            }
        };
    }
    
    createMeteorEffect(position, element = 'fire') {
        // Create a meteor visual effect
        const meteorRadius = 0.5;
        const meteorGeometry = new THREE.SphereGeometry(meteorRadius, 8, 8);
        const meteorMaterial = new THREE.MeshPhongMaterial({
            color: element === 'fire' ? 0xFF5722 : 0xFF9800,
            emissive: 0xE64A19,
            emissiveIntensity: 0.5
        });
        
        const meteor = new THREE.Mesh(meteorGeometry, meteorMaterial);
        
        // Start position high above the target
        meteor.position.set(position.x, position.y + 20, position.z);
        this.game.renderer.scene.add(meteor);
        
        // Create trail particles
        const particleCount = 20;
        const particleGeometry = new THREE.BufferGeometry();
        const particleMaterial = new THREE.PointsMaterial({
            color: 0xFF9800,
            size: 0.2,
            transparent: true,
            opacity: 0.8
        });
        
        const particles = new THREE.Points(particleGeometry, particleMaterial);
        this.game.renderer.scene.add(particles);
        
        // Create effect object with update method
        const startTime = performance.now();
        const impactTime = startTime + 1000; // 1 second to impact
        
        return {
            update: (currentTime) => {
                // Calculate progress
                const elapsed = currentTime - startTime;
                const duration = 2000; // 2 seconds total effect duration
                
                if (elapsed > duration) {
                    // Remove meteor and particles
                    this.game.renderer.scene.remove(meteor);
                    this.game.renderer.scene.remove(particles);
                    return true; // Effect completed
                }
                
                // Before impact
                if (currentTime < impactTime) {
                    const fallProgress = (currentTime - startTime) / (impactTime - startTime);
                    
                    // Move meteor towards impact point
                    meteor.position.y = position.y + 20 * (1 - fallProgress);
                    
                    // Create trail effect
                    const positions = new Float32Array(particleCount * 3);
                    
                    for (let i = 0; i < particleCount; i++) {
                        const i3 = i * 3;
                        const offset = Math.random() * 0.2;
                        
                        positions[i3] = meteor.position.x + (Math.random() - 0.5) * 0.5;
                        positions[i3 + 1] = meteor.position.y + (Math.random() + 0.5) * offset;
                        positions[i3 + 2] = meteor.position.z + (Math.random() - 0.5) * 0.5;
                    }
                    
                    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                } 
                // After impact
                else {
                    const impactProgress = (currentTime - impactTime) / (duration - (impactTime - startTime));
                    
                    if (impactProgress < 0.1) {
                        // Initial impact - create explosion particles
                        const positions = new Float32Array(particleCount * 3);
                        
                        for (let i = 0; i < particleCount; i++) {
                            const i3 = i * 3;
                            const angle = Math.random() * Math.PI * 2;
                            const radius = Math.random() * 5;
                            
                            positions[i3] = position.x + Math.cos(angle) * radius * impactProgress * 10;
                            positions[i3 + 1] = position.y + Math.random() * 2;
                            positions[i3 + 2] = position.z + Math.sin(angle) * radius * impactProgress * 10;
                        }
                        
                        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                    }
                    
                    // Hide meteor after impact
                    meteor.visible = false;
                    
                    // Fade out particles
                    if (impactProgress > 0.5) {
                        particleMaterial.opacity = 0.8 * (1 - (impactProgress - 0.5) * 2);
                    }
                }
                
                return false; // Effect still active
            }
        };
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
        const freezeEffect = this.createFreezeEffect(centerPosition);
        this.activeEffects.push(freezeEffect);
        
        // Apply slow effect to all enemies
        for (const enemy of this.game.enemies) {
            enemy.applyStatusEffect('slow', {
                duration: 10,
                speedModifier: 0.5 // 50% slow for 10 seconds
            });
        }
    }
    
    createFreezeEffect(position) {
        // Create a freeze wave visual effect
        const waveRadius = 0.5;
        const waveGeometry = new THREE.RingGeometry(0, waveRadius, 32);
        const waveMaterial = new THREE.MeshBasicMaterial({
            color: 0x2196F3, // Blue
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        
        const wave = new THREE.Mesh(waveGeometry, waveMaterial);
        wave.rotation.x = Math.PI / 2; // Lay flat on the ground
        wave.position.set(position.x, position.y + 0.1, position.z);
        this.game.renderer.scene.add(wave);
        
        // Create ice crystal particles
        const particleCount = 50;
        const particleGeometry = new THREE.BufferGeometry();
        const particleMaterial = new THREE.PointsMaterial({
            color: 0x4FC3F7, // Light blue
            size: 0.2,
            transparent: true,
            opacity: 0.8
        });
        
        const particles = new THREE.Points(particleGeometry, particleMaterial);
        this.game.renderer.scene.add(particles);
        
        // Create effect object with update method
        const startTime = performance.now();
        
        return {
            update: (currentTime) => {
                // Calculate progress
                const elapsed = currentTime - startTime;
                const duration = 3000; // 3 seconds total effect duration
                const progress = Math.min(elapsed / duration, 1);
                
                if (progress >= 1) {
                    // Remove wave and particles
                    this.game.renderer.scene.remove(wave);
                    this.game.renderer.scene.remove(particles);
                    return true; // Effect completed
                }
                
                // Expand the wave
                const expandedRadius = waveRadius + (progress * 10);
                wave.scale.set(expandedRadius, expandedRadius, 1);
                
                // Fade out wave as it expands
                if (progress > 0.5) {
                    waveMaterial.opacity = 0.7 * (1 - (progress - 0.5) * 2);
                }
                
                // Create ice crystal particle effect
                const positions = new Float32Array(particleCount * 3);
                
                for (let i = 0; i < particleCount; i++) {
                    const i3 = i * 3;
                    const angle = Math.random() * Math.PI * 2;
                    const radius = Math.random() * expandedRadius;
                    
                    positions[i3] = position.x + Math.cos(angle) * radius;
                    positions[i3 + 1] = position.y + Math.random() * 0.5; // Slight height variation
                    positions[i3 + 2] = position.z + Math.sin(angle) * radius;
                }
                
                particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                
                // Fade out particles near the end
                if (progress > 0.7) {
                    particleMaterial.opacity = 0.8 * (1 - (progress - 0.7) / 0.3);
                }
                
                return false; // Effect still active
            }
        };
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