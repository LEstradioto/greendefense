import { ElementTypes, ElementStyles, ElementEffects } from '../../elements.js';

export class Enemy {
    constructor(game, type, startPosition, element = ElementTypes.NEUTRAL, stats = null) {
        this.game = game;
        this.type = type;
        this.position = { ...startPosition };
        this.position.y = 0.3; // Slight offset from ground
        this.element = element;

        // Set stats based on enemy type or from provided stats (for card-based enemies)
        if (stats) {
            this.health = stats.health || 100;
            this.maxHealth = stats.health || 100;
            this.baseSpeed = stats.speed || 3;
            this.reward = stats.reward || 10;
        } else {
            this.setStats();
        }

        // Enemy state
        this.currentPathIndex = 0;
        this.reachedEnd = false;
        this.pathWaypoints = [];
        this.isPathfinding = false;

        // Target is the bottom of the map (any valid exit point)
        this.targetPosition = this.findExitPoint();

        // Calculate initial path
        this.calculatePath();

        // Movement and effects
        this.speed = this.baseSpeed;
        
        // Status effects
        this.statusEffects = [];

        // Create 3D representation
        this.mesh = this.game.renderer.createEnemy(this);
        this.mesh.position.set(this.position.x, this.position.y, this.position.z);

        // Setup health bar - access the data stored in userData
        this.healthBar = this.mesh.userData.healthBar;

        // Path recalculation timer
        this.lastPathRecalcTime = 0;
        this.pathRecalcInterval = 2000; // 2 seconds
    }

    setStats() {
        // Base stats depending on enemy type
        console.log("[ENEMY DEBUG] Setting stats for enemy type:", this.type);
        
        // Ensure type is a string before doing string operations
        const enemyType = String(this.type);
        
        switch (enemyType) {
            case 'simple':
                this.health = 100;
                this.maxHealth = 100;
                this.baseSpeed = 3; // Units per second
                this.reward = 10;
                this.element = ElementTypes.NEUTRAL;
                break;

            case 'elephant':
                this.health = 250;
                this.maxHealth = 250;
                this.baseSpeed = 1.5; // Units per second
                this.reward = 25;
                this.element = ElementTypes.EARTH;
                break;

            case 'pirate':
                this.health = 400;
                this.maxHealth = 400;
                this.baseSpeed = 1; // Units per second
                this.reward = 50;
                this.element = ElementTypes.WATER;
                break;
                
            // Elemental enemy types
            case 'fire_imp':
                this.health = 80;
                this.maxHealth = 80;
                this.baseSpeed = 4; // Fast
                this.reward = 15;
                this.element = ElementTypes.FIRE;
                break;
                
            case 'water_elemental':
                this.health = 150;
                this.maxHealth = 150;
                this.baseSpeed = 2;
                this.reward = 20;
                this.element = ElementTypes.WATER;
                break;
                
            case 'earth_golem':
                this.health = 300;
                this.maxHealth = 300;
                this.baseSpeed = 1;
                this.reward = 30;
                this.element = ElementTypes.EARTH;
                break;
                
            case 'air_wisp':
                this.health = 50;
                this.maxHealth = 50;
                this.baseSpeed = 5; // Very fast
                this.reward = 25;
                this.element = ElementTypes.AIR;
                break;
                
            case 'shadow_wraith':
                this.health = 200;
                this.maxHealth = 200;
                this.baseSpeed = 2.5;
                this.reward = 35;
                this.element = ElementTypes.SHADOW;
                break;

            default:
                this.health = 100;
                this.maxHealth = 100;
                this.baseSpeed = 3;
                this.reward = 10;
                this.element = ElementTypes.NEUTRAL;
        }
        
        // Apply per-wave and global difficulty settings to scale enemy stats
        if (this.game.waveSettings && this.game.currentWave > 0 && 
            this.game.currentWave <= this.game.waveSettings.length) {
            
            // Apply per-wave multipliers
            const waveSettings = this.game.waveSettings[this.game.currentWave - 1];
            this.health *= waveSettings.enemyHealth;
            this.maxHealth *= waveSettings.enemyHealth;
            this.baseSpeed *= waveSettings.enemySpeed;
        }
        
        // Apply global difficulty settings
        if (this.game.difficultySettings) {
            // Apply health multiplier
            this.health *= this.game.difficultySettings.enemyHealthMultiplier;
            this.maxHealth *= this.game.difficultySettings.enemyHealthMultiplier;
            
            // Apply speed multiplier
            this.baseSpeed *= this.game.difficultySettings.enemySpeedMultiplier;
            
            // REMOVED gold multiplier from here - it will be applied when enemy is defeated
        }
        
        // Final sanity check to ensure reward is valid no matter what
        if (isNaN(this.reward) || !isFinite(this.reward) || this.reward <= 0) {
            console.warn("Invalid enemy reward detected, resetting to default value");
            this.reward = this.type.includes('golem') ? 50 : 
                         this.type.includes('pirate') ? 25 : 
                         this.type.includes('elephant') ? 15 : 10; // Default fallback values by type
        }
    }

    update(deltaTime) {
        // Check if reached the end
        if (this.reachedEnd) return;
        
        // Update status effects
        this.updateStatusEffects(deltaTime);

        // Periodically recalculate path to account for new tower placements
        const now = performance.now();
        if (now - this.lastPathRecalcTime > this.pathRecalcInterval) {
            this.lastPathRecalcTime = now;
            this.calculatePath();
        }

        // Move along path
        this.followPath(deltaTime);

        // Check if at the bottom edge of the map (reached end)
        if (!this.reachedEnd && this.position.z > (this.game.map.gridHeight / 2) - 1.5) {
            this.reachedEnd = true;
            console.log("Enemy reached the end!");
        }

        // Update mesh position
        if (this.mesh) {
            this.mesh.position.set(this.position.x, this.position.y, this.position.z);

            // Update health bar
            const healthPercent = this.health / this.maxHealth;
            this.game.renderer.updateHealthBar(this.healthBar, healthPercent);
        }
    }
    
    updateStatusEffects(deltaTime) {
        // Process all active status effects
        for (let i = this.statusEffects.length - 1; i >= 0; i--) {
            const effect = this.statusEffects[i];
            
            // Reduce remaining duration
            effect.remainingDuration -= deltaTime;
            
            // Process effect based on type
            switch (effect.type) {
                case 'burn':
                    // Apply periodic damage from burn
                    effect.timeSinceLastTick += deltaTime;
                    if (effect.timeSinceLastTick >= effect.tickInterval) {
                        this.takeDamage(effect.damagePerTick, true); // true = from DOT effect
                        effect.timeSinceLastTick = 0;
                        
                        // Create burn visual
                        this.createBurnEffect();
                    }
                    break;
                    
                case 'slow':
                    // Speed reduction is applied when calculating movement speed
                    // Visual effect is handled when the effect is applied
                    break;
                    
                case 'weaken':
                    // Damage reduction is applied when taking damage
                    break;
            }
            
            // Remove expired effects
            if (effect.remainingDuration <= 0) {
                // Handle cleanup when effect expires
                if (effect.type === 'slow') {
                    // Remove slow effect visual
                    if (this.mesh && this.mesh.userData.slowEffect) {
                        this.mesh.remove(this.mesh.userData.slowEffect);
                        delete this.mesh.userData.slowEffect;
                    }
                }
                
                // Remove the effect
                this.statusEffects.splice(i, 1);
            }
        }
        
        // Recalculate current speed after all effects
        this.calculateCurrentSpeed();
    }
    
    calculateCurrentSpeed() {
        // Start with base speed
        let currentSpeed = this.baseSpeed;
        
        // Apply all slow effects (they stack multiplicatively)
        for (const effect of this.statusEffects) {
            if (effect.type === 'slow') {
                currentSpeed *= effect.speedModifier;
            }
        }
        
        // Set the current speed
        this.speed = currentSpeed;
    }

    followPath(deltaTime) {
        // Check if we have a path
        if (!this.pathWaypoints || this.pathWaypoints.length === 0) {
            return;
        }

        // Get current target waypoint
        if (this.currentPathIndex >= this.pathWaypoints.length) {
            // We've reached the end of the path
            this.targetPosition = this.findExitPoint();
            this.calculatePath(0);
            return;
        }

        const targetWaypoint = this.pathWaypoints[this.currentPathIndex];

        // Calculate direction to target
        const direction = {
            x: targetWaypoint.x - this.position.x,
            z: targetWaypoint.z - this.position.z
        };

        // Calculate distance to target
        const distance = Math.sqrt(direction.x * direction.x + direction.z * direction.z);

        // Check if we've reached the waypoint
        if (distance < 0.1) {
            this.currentPathIndex++;

            // Check if we've reached the end of the path
            if (this.currentPathIndex >= this.pathWaypoints.length) {
                // We've reached the end of the path - check if at bottom edge
                if (Math.floor(this.position.z) >= this.game.map.gridHeight - 2) {
                    this.reachedEnd = true;
                } else {
                    // Not at bottom yet, recalculate path
                    this.calculatePath(0);
                }
                return;
            }

            return;
        }

        // Normalize direction
        direction.x /= distance;
        direction.z /= distance;

        // Move towards waypoint
        const moveSpeed = this.speed * deltaTime;
        const moveDistance = Math.min(moveSpeed, distance);

        // Update position
        const newPosition = {
            x: this.position.x + direction.x * moveDistance,
            y: this.position.y,
            z: this.position.z + direction.z * moveDistance
        };

        // Ensure the new position is within bounds
        const validPosition = this.ensurePositionWithinGrid(newPosition);

        // Set the new position
        this.position.x = validPosition.x;
        this.position.y = validPosition.y;
        this.position.z = validPosition.z;
        
        // Rotate enemy to face movement direction (for diagonal movement)
        if (this.mesh && (direction.x !== 0 || direction.z !== 0)) {
            // Calculate angle from direction vector (in radians)
            const angle = Math.atan2(direction.x, direction.z);
            
            // Set the y-rotation of the mesh to face the movement direction
            this.mesh.rotation.y = angle;
        }
    }

    // Alternative version of ensurePositionInBounds that takes a new position
    // and returns a position that is within the grid bounds
    ensurePositionWithinGrid(newPosition) {
        const buffer = 0.5; // Buffer to keep enemy away from the edges
        const validPosition = { ...newPosition };

        // Clamp position to grid bounds
        const minX = -(this.game.map.gridWidth / 2) + buffer;
        const maxX = (this.game.map.gridWidth / 2) - buffer;
        const minZ = -(this.game.map.gridHeight / 2) + buffer;
        const maxZ = (this.game.map.gridHeight / 2) - buffer;

        validPosition.x = Math.max(minX, Math.min(maxX, validPosition.x));
        validPosition.z = Math.max(minZ, Math.min(maxZ, validPosition.z));

        return validPosition;
    }

    takeDamage(amount, isFromEffect = false) {
        // Apply damage reduction from weaken effect
        let actualDamage = amount;
        
        // Apply damage modifiers from status effects
        for (const effect of this.statusEffects) {
            if (effect.type === 'weaken') {
                actualDamage *= effect.damageModifier;
            }
        }
        
        // Apply damage
        this.health -= actualDamage;

        // Ensure health doesn't go below 0
        if (this.health < 0) this.health = 0;

        // Create hit effect if not from a DOT effect (to avoid visual spam)
        if (!isFromEffect) {
            this.createHitEffect(actualDamage);
        }
    }
    
    applyStatusEffect(effectType, effectParams) {
        // Check if this enemy already has this effect type
        const existingEffectIndex = this.statusEffects.findIndex(effect => effect.type === effectType);
        
        if (existingEffectIndex !== -1) {
            // If effect exists, just refresh duration
            this.statusEffects[existingEffectIndex].remainingDuration = Math.max(
                this.statusEffects[existingEffectIndex].remainingDuration,
                effectParams.duration
            );
        } else {
            // Add new effect
            const newEffect = {
                type: effectType,
                remainingDuration: effectParams.duration,
                ...effectParams
            };
            
            // Add additional properties based on effect type
            switch (effectType) {
                case 'burn':
                    newEffect.timeSinceLastTick = 0;
                    this.createBurnEffectVisual();
                    break;
                    
                case 'slow':
                    this.createSlowEffectVisual(effectParams.duration);
                    break;
                    
                case 'weaken':
                    this.createWeakenEffectVisual(effectParams.duration);
                    break;
            }
            
            this.statusEffects.push(newEffect);
        }
        
        // Update speed immediately if it's a slow effect
        if (effectType === 'slow') {
            this.calculateCurrentSpeed();
        }
    }

    // Method to recalculate the path when a tower is placed
    async recalculatePath() {
        // Clear the current path
        this.pathWaypoints = [];
        this.currentPathIndex = 0;

        // Skip recalculation if enemy has reached the end
        if (this.reachedEnd) return;

        // Calculate a new path
        await this.calculatePath(0); // Start with recursion depth 0
    }

    createHitEffect(damageAmount) {
        if (!this.game.renderer || !this.mesh) return;
        
        // Get color based on element
        let color = 0xFF0000; // Default red
        
        // Choose a different color for critical hits
        const isCritical = Math.random() < 0.1; // 10% chance for visual variation
        
        if (isCritical) {
            color = 0xFFFF00; // Yellow for crits
        }
        
        // Create hit effect
        const hitGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const hitMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.7
        });

        const hitEffect = new THREE.Mesh(hitGeometry, hitMaterial);
        hitEffect.position.copy(this.mesh.position);
        hitEffect.position.y += 0.5; // Position above enemy

        this.game.renderer.scene.add(hitEffect);
        
        // Optional: Display damage number
        if (this.game.debugMode) {
            const damageText = Math.round(damageAmount).toString();
            
            // Create text sprite
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 64;
            canvas.height = 32;
            
            context.font = 'Bold 24px Arial';
            context.fillStyle = isCritical ? 'yellow' : 'white';
            context.textAlign = 'center';
            context.fillText(damageText, 32, 24);
            
            const texture = new THREE.Texture(canvas);
            texture.needsUpdate = true;
            
            const spriteMaterial = new THREE.SpriteMaterial({ 
                map: texture,
                transparent: true
            });
            
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.copy(hitEffect.position);
            sprite.position.y += 0.3;
            sprite.scale.set(0.5, 0.25, 1);
            
            this.game.renderer.scene.add(sprite);
            
            // Animate damage text upward
            const startY = sprite.position.y;
            
            const animateText = () => {
                const elapsed = performance.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                if (progress < 1) {
                    sprite.position.y = startY + progress * 0.5;
                    spriteMaterial.opacity = 1 - progress;
                    
                    requestAnimationFrame(animateText);
                } else {
                    this.game.renderer.scene.remove(sprite);
                }
            };
            
            const startTime = performance.now();
            const duration = 800; // 0.8 seconds
            animateText();
        }

        // Animate and remove hit effect
        const startTime = performance.now();
        const duration = 300; // 0.3 seconds

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            if (progress < 1) {
                // Grow and fade out
                const scale = 1 + progress;
                hitEffect.scale.set(scale, scale, scale);
                hitMaterial.opacity = 0.7 * (1 - progress);

                requestAnimationFrame(animate);
            } else {
                // Remove hit effect
                this.game.renderer.scene.remove(hitEffect);
            }
        };

        animate();
    }
    
    createBurnEffect() {
        if (!this.game.renderer || !this.mesh) return;
        
        // Create a small flame particle
        const flameGeometry = new THREE.SphereGeometry(0.15, 8, 8);
        const flameMaterial = new THREE.MeshBasicMaterial({
            color: ElementStyles[ElementTypes.FIRE].particleColor,
            transparent: true,
            opacity: 0.7
        });
        
        const flame = new THREE.Mesh(flameGeometry, flameMaterial);
        
        // Random position around the enemy
        const angle = Math.random() * Math.PI * 2;
        const radius = 0.2 + Math.random() * 0.2;
        flame.position.set(
            this.mesh.position.x + Math.cos(angle) * radius,
            this.mesh.position.y + 0.2 + Math.random() * 0.4,
            this.mesh.position.z + Math.sin(angle) * radius
        );
        
        this.game.renderer.scene.add(flame);
        
        // Animate flame rising and fading
        const startTime = performance.now();
        const duration = 500; // 0.5 seconds
        
        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            if (progress < 1) {
                // Rise up and fade out
                flame.position.y += 0.01;
                flameMaterial.opacity = 0.7 * (1 - progress);
                
                requestAnimationFrame(animate);
            } else {
                this.game.renderer.scene.remove(flame);
            }
        };
        
        animate();
    }
    
    createBurnEffectVisual() {
        // This creates the persistent burn effect visual when the status is first applied
        if (!this.mesh) return;
        
        // Create a fire aura effect if it doesn't exist
        if (!this.mesh.userData.burnEffect) {
            const burnGeometry = new THREE.SphereGeometry(0.4, 16, 16);
            const burnMaterial = new THREE.MeshBasicMaterial({
                color: ElementStyles[ElementTypes.FIRE].emissive,
                transparent: true,
                opacity: 0.3
            });
            
            const burnEffect = new THREE.Mesh(burnGeometry, burnMaterial);
            this.mesh.add(burnEffect);
            
            // Store reference
            this.mesh.userData.burnEffect = burnEffect;
            
            // Animate pulsing
            let startTime = performance.now();
            
            const animatePulse = () => {
                if (!this.mesh || !this.mesh.userData.burnEffect) return;
                
                const time = performance.now() - startTime;
                const scale = 1 + 0.2 * Math.sin(time * 0.005);
                
                burnEffect.scale.set(scale, scale, scale);
                
                // Check if the burn effect is still active
                const hasBurnEffect = this.statusEffects.some(effect => effect.type === 'burn');
                
                if (hasBurnEffect) {
                    requestAnimationFrame(animatePulse);
                } else {
                    // Remove effect when burn wears off
                    this.mesh.remove(burnEffect);
                    delete this.mesh.userData.burnEffect;
                }
            };
            
            animatePulse();
        }
    }
    
    createSlowEffectVisual(duration) {
        if (!this.mesh) return;
        
        // Remove existing slow effect if any
        if (this.mesh.userData.slowEffect) {
            this.mesh.remove(this.mesh.userData.slowEffect);
        }
        
        // Create a blue aura to indicate slow effect
        const slowGeometry = new THREE.SphereGeometry(0.5, 16, 16);
        const slowMaterial = new THREE.MeshBasicMaterial({
            color: ElementStyles[ElementTypes.WATER].color,
            transparent: true,
            opacity: 0.3,
            wireframe: true
        });
        
        const slowEffect = new THREE.Mesh(slowGeometry, slowMaterial);
        this.mesh.add(slowEffect);
        
        // Store reference
        this.mesh.userData.slowEffect = slowEffect;
    }
    
    createWeakenEffectVisual(duration) {
        if (!this.mesh) return;
        
        // Create a purple aura to indicate weaken effect
        const weakenGeometry = new THREE.SphereGeometry(0.45, 16, 16);
        const weakenMaterial = new THREE.MeshBasicMaterial({
            color: ElementStyles[ElementTypes.SHADOW].color,
            transparent: true,
            opacity: 0.3
        });
        
        const weakenEffect = new THREE.Mesh(weakenGeometry, weakenMaterial);
        this.mesh.add(weakenEffect);
        
        // Remove effect after duration
        setTimeout(() => {
            if (this.mesh) {
                this.mesh.remove(weakenEffect);
            }
        }, duration * 1000);
    }

    findExitPoint() {
        // Find all valid exit points at the bottom of the map
        const validExitPoints = [];
        const bottomRow = this.game.map.gridHeight - 1;

        for (let x = 0; x < this.game.map.gridWidth; x++) {
            if (this.game.map.grid[bottomRow][x] === 1) {
                validExitPoints.push({ x, z: bottomRow });
            }
        }

        // If no exit points found, return a default one
        if (validExitPoints.length === 0) {
            return { x: Math.floor(this.game.map.gridWidth / 2), z: bottomRow };
        }

        // Choose a random exit point
        const randomIndex = Math.floor(Math.random() * validExitPoints.length);
        return validExitPoints[randomIndex];
    }

    async calculatePath(recursionDepth = 0) {
        // Prevent stack overflow with a recursion limit
        const MAX_RECURSION_DEPTH = 3;
        if (recursionDepth >= MAX_RECURSION_DEPTH) {
            console.log("Max recursion depth reached in path calculation, giving up");
            // Assign a direct path to the nearest exit as a fallback
            this.findFallbackPath();
            return;
        }

        // If already pathfinding, don't start another calculation
        if (this.isPathfinding) return;

        this.isPathfinding = true;

        try {
            // Make sure the enemy is inside the grid bounds
            const validPosition = this.ensurePositionInBounds();

            // Get current grid position
            const gridPos = this.game.map.worldToGrid(validPosition.x, validPosition.z);

            // Set timeout for pathfinding to avoid getting stuck
            let pathFound = false;
            const pathfindingTimeout = setTimeout(() => {
                if (!pathFound) {
                    this.isPathfinding = false;
                    console.log("Pathfinding timed out for enemy");
                }
            }, 3000); // 3 seconds timeout

            // Calculate a path to the target
            const path = await this.game.map.pathfindingHelper.findPath(
                { x: gridPos.x, z: gridPos.y },
                this.targetPosition
            );

            // Clear timeout
            clearTimeout(pathfindingTimeout);
            pathFound = true;

            // If no path is found, try a different exit point
            if (!path || path.length === 0) {
                console.log("No path found for enemy, trying alternate exit");
                this.targetPosition = this.findExitPoint();
                this.isPathfinding = false;
                // Call again with increased recursion depth
                return this.calculatePath(recursionDepth + 1);
            }

            // Convert grid positions to world positions
            this.pathWaypoints = path.map(point =>
                this.game.map.gridToWorld(point.x, point.z)
            );

            // Reset path following
            this.currentPathIndex = 0;

            // Update path debug visualization if in debug mode
            if (this.game.debugMode && this.pathVisualization) {
                this.updatePathVisualization();
            }
        } catch (error) {
            console.error("Error calculating path:", error);
        } finally {
            this.isPathfinding = false;
        }
    }

    // Ensure the enemy position is within valid bounds
    ensurePositionInBounds() {
        const buffer = 0.5; // Buffer to keep enemy away from the edges
        const validPosition = { ...this.position };

        // Clamp position to grid bounds
        const minX = -(this.game.map.gridWidth / 2) + buffer;
        const maxX = (this.game.map.gridWidth / 2) - buffer;
        const minZ = -(this.game.map.gridHeight / 2) + buffer;
        const maxZ = (this.game.map.gridHeight / 2) - buffer;

        validPosition.x = Math.max(minX, Math.min(maxX, validPosition.x));
        validPosition.z = Math.max(minZ, Math.min(maxZ, validPosition.z));

        // If position was changed, update the actual position
        if (validPosition.x !== this.position.x || validPosition.z !== this.position.z) {
            console.log(`Corrected enemy position from (${this.position.x}, ${this.position.z}) to (${validPosition.x}, ${validPosition.z})`);
            this.position.x = validPosition.x;
            this.position.z = validPosition.z;
        }

        return validPosition;
    }

    // Create a fallback path when pathfinding fails
    findFallbackPath() {
        // Find the nearest exit point
        const exitPoint = this.findExitPoint();
        const exitWorldPos = this.game.map.gridToWorld(exitPoint.x, exitPoint.z);

        // Just create a direct path to the exit
        this.pathWaypoints = [
            { x: this.position.x, y: this.position.y, z: this.position.z },
            exitWorldPos
        ];

        this.currentPathIndex = 0;
        console.log("Created fallback direct path to exit");
    }
}