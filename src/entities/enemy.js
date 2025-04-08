import { ElementTypes, ElementStyles, ElementEffects } from '../elements.js';

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

        // Create 3D representation using the enemy instance manager
        this.enemyInstance = this.game.renderer.createEnemy(this);

        // Path recalculation timer
        this.lastPathRecalcTime = 0;
        this.pathRecalcInterval = 2000; // 2 seconds
    }

    setStats() {

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
        // Skip update if dead or already at end
        if (this.health <= 0 || this.reachedEnd) return;

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

            // Hide the enemy more effectively by moving it far away
            this.position.y = -100;
            this.position.x = 9999;
            this.position.z = 9999;

            // Update instance position immediately
            if (this.enemyInstance) {
                // Update the instance object's position
                this.enemyInstance.position.set(this.position.x, this.position.y, this.position.z);

                // Update the rendered position
                if (this.enemyInstance.baseType && this.enemyInstance.elementType &&
                    this.enemyInstance.instanceIndex !== undefined) {
                    this.game.renderer.enemyManager.updateEnemyPosition(
                        this.enemyInstance.baseType,
                        this.enemyInstance.elementType,
                        this.enemyInstance.instanceIndex,
                        this.position
                    );
                }

                // Hide effects and health bar
                if (this.enemyInstance.effectMeshes) {
                    for (const effect in this.enemyInstance.effectMeshes) {
                        if (this.enemyInstance.effectMeshes[effect]) {
                            this.enemyInstance.effectMeshes[effect].visible = false;
                        }
                    }
                }
                if (this.enemyInstance.healthBar && this.enemyInstance.healthBar.group) {
                    this.enemyInstance.healthBar.group.visible = false;
                }
            }
        }

        // Update instance position
        if (this.enemyInstance) {
            // Update the instance object's position (this is used by the EnemyInstanceManager)
            this.enemyInstance.position.set(this.position.x, this.position.y, this.position.z);

            // Update the actual rendered position in the instanced mesh
            if (this.enemyInstance.baseType && this.enemyInstance.elementType && this.enemyInstance.instanceIndex !== undefined) {
                this.game.renderer.enemyManager.updateEnemyPosition(
                    this.enemyInstance.baseType,
                    this.enemyInstance.elementType,
                    this.enemyInstance.instanceIndex,
                    this.position,
                    this.enemyInstance.shadowIndex
                );
            }

            // Update health bar
            const healthPercent = this.health / this.maxHealth;
            this.game.renderer.updateHealth(this, healthPercent);
        }
        // Legacy support for old mesh-based enemies
        else if (this.mesh) {
            this.mesh.position.set(this.position.x, this.position.y, this.position.z);

            // Update health bar
            const healthPercent = this.health / this.maxHealth;
            this.game.renderer.updateHealthBar(this.healthBar, healthPercent);
        }
    }

    // Simplified update method for performance optimization with distant enemies
    updateSimple(deltaTime) {
        // Check if reached the end
        if (this.reachedEnd) return;

        // Skip status effects for better performance

        // Move along path
        this.followPath(deltaTime);

        // Check if at the bottom edge of the map (reached end)
        if (!this.reachedEnd && this.position.z > (this.game.map.gridHeight / 2) - 1.5) {
            this.reachedEnd = true;
        }

        // Only update mesh position (no health bar update)
        if (this.enemyInstance) {
            this.enemyInstance.position.set(this.position.x, this.position.y, this.position.z);

            // Update the actual rendered position in the instanced mesh
            if (this.enemyInstance.baseType && this.enemyInstance.elementType && this.enemyInstance.instanceIndex !== undefined) {
                this.game.renderer.enemyManager.updateEnemyPosition(
                    this.enemyInstance.baseType,
                    this.enemyInstance.elementType,
                    this.enemyInstance.instanceIndex,
                    this.position,
                    this.enemyInstance.shadowIndex
                );
            }
        } else if (this.mesh) {
            this.mesh.position.set(this.position.x, this.position.y, this.position.z);
        }
    }

    updateStatusEffects(deltaTime) {
        // Skip status effect processing if FPS is low for performance
        if (this.game.fpsCounter && this.game.fpsCounter.value < 30 && Math.random() < 0.7) {
            // Process only 30% of the time at low FPS to improve performance
            return;
        }

        // Process all active status effects
        for (let i = this.statusEffects.length - 1; i >= 0; i--) {
            const effect = this.statusEffects[i];

            // Reduce remaining duration
            effect.remainingDuration -= deltaTime;

            // Process effect based on type - optimize processing
            switch (effect.type) {
                case 'burn':
                    // Apply periodic damage from burn
                    effect.timeSinceLastTick += deltaTime;
                    if (effect.timeSinceLastTick >= effect.tickInterval) {
                        this.takeDamage(effect.damagePerTick, true); // true = from DOT effect
                        effect.timeSinceLastTick = 0;

                        // Skip visual effects when FPS is low
                        if (!(this.game.fpsCounter && this.game.fpsCounter.value < 45)) {
                            this.createBurnEffectVisual();
                        }
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

                    // Hide the enemy by moving it far away - not just below ground
                    this.position.y = -100;
                    this.position.x = 10000; // Move far away horizontally too
                    this.position.z = 10000;

                    // Force update the renderer position immediately
                    if (this.enemyInstance) {
                        this.enemyInstance.position.set(this.position.x, this.position.y, this.position.z);
                        // Update the actual rendered position in the instanced mesh
                        if (this.enemyInstance.baseType && this.enemyInstance.elementType &&
                            this.enemyInstance.instanceIndex !== undefined) {
                            this.game.renderer.enemyManager.updateEnemyPosition(
                                this.enemyInstance.baseType,
                                this.enemyInstance.elementType,
                                this.enemyInstance.instanceIndex,
                                this.position
                            );
                        }
                        // Hide any effects too
                        if (this.enemyInstance.effectMeshes) {
                            for (const effect in this.enemyInstance.effectMeshes) {
                                if (this.enemyInstance.effectMeshes[effect]) {
                                    this.enemyInstance.effectMeshes[effect].visible = false;
                                }
                            }
                        }
                        // Hide health bar
                        if (this.enemyInstance.healthBar && this.enemyInstance.healthBar.group) {
                            this.enemyInstance.healthBar.group.visible = false;
                        }
                    }
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
        // Apply damage
        this.health -= amount;

        // Update health bar
        if (this.health > 0) {
            const healthPercent = this.health / this.maxHealth;
            this.game.renderer.updateHealth(this, healthPercent);
        }

        // Create damage indicator (smaller or no indicators for effect damage)
        if (!isFromEffect) {
            this.createHitEffect(amount);
        }

        // Check if defeated
        if (this.health <= 0) {
            this.game.defeatEnemy(this);
        }
    }

    applyStatusEffect(effectType, effectParams) {
        // Find existing effect of this type
        const existingEffect = this.statusEffects.find(effect => effect.type === effectType);

        if (existingEffect) {
            // Refresh duration and potentially update params
            existingEffect.duration = effectParams.duration || existingEffect.duration;
            // Update other params as needed
            Object.assign(existingEffect, effectParams);
        } else {
            // Add new effect
            this.statusEffects.push({
                type: effectType,
                ...effectParams
            });

            // Create visual effect based on type
            switch (effectType) {
                case 'burn':
                    this.createBurnEffectVisual();
                    break;
                case 'slow':
                    this.createSlowEffectVisual(effectParams.duration);
                    break;
                case 'weaken':
                    this.createWeakenEffectVisual(effectParams.duration);
                    break;
            }
        }

        // Recalculate speed (for slow effects)
        this.calculateCurrentSpeed();
    }

    // Method to recalculate the path when a tower is placed
    async recalculatePath() {
        // Clear the current path
        this.pathWaypoints = [];
        this.currentPathIndex = 0;

        // Skip recalculation if enemy has reached the end
        if (this.reachedEnd) return;

        // Track pathfinding calls for debugging
        if (this.game._pathfindingCalls !== undefined) {
            this.game._pathfindingCalls++;
        }

        // Check for a cached path first (based on start and end positions)
        const startX = Math.round(this.position.x);
        const startZ = Math.round(this.position.z);
        const endX = Math.round(this.targetPosition.x);
        const endZ = Math.round(this.targetPosition.z);

        const pathKey = `${startX},${startZ}-${endX},${endZ}`;

        // Make sure we're using a proper JavaScript Map object and not a regular object
        if (this.game.cachedPaths && typeof this.game.cachedPaths.has === 'function' && this.game.cachedPaths.has(pathKey)) {
            // Use cached path
            this.path = [...this.game.cachedPaths.get(pathKey)];
            return;
        }

        // Check if too many pathfinding calls recently - use simpler path if FPS is low
        if (this.game.fpsCounter && this.game.fpsCounter.value < 30) {
            // Simple direct path for performance
            this.path = [
                { x: this.position.x, y: this.position.z },
                { x: endX, y: endZ }
            ];
            return;
        }

        // Calculate a new path
        await this.calculatePath(0); // Start with recursion depth 0

        // Cache the path for reuse if we have a valid Map object
        if (this.path && this.path.length > 0 && this.game.cachedPaths && typeof this.game.cachedPaths.set === 'function') {
            try {
                // Store path copy in cache
                this.game.cachedPaths.set(pathKey, [...this.path]);

                // Limit cache size to prevent memory issues
                if (this.game.cachedPaths.size > 100 && typeof this.game.cachedPaths.keys === 'function') {
                    // Remove oldest entry (first key)
                    const keysIterator = this.game.cachedPaths.keys();
                    const firstItem = keysIterator.next();
                    if (firstItem && !firstItem.done && firstItem.value) {
                        this.game.cachedPaths.delete(firstItem.value);
                    }
                }
            } catch (e) {
                // If any error occurs with the cache, just ignore it
                // This is only an optimization, not critical functionality
            }
        }
    }

    createHitEffect(damageAmount) {
        // Completely disable hit effects for maximum performance
        // Just return immediately without creating any visual effects
        return;

        /* All hit effect code removed for performance */

    }

    createBurnEffectVisual() {
        if (!this.mesh) return;

        // Remove existing burn effect if any
        if (this.mesh.userData.burnEffect) {
            this.mesh.remove(this.mesh.userData.burnEffect);
        }

        // Create a fire/burn effect
        const burnGeometry = new THREE.SphereGeometry(0.55, 16, 16);
        const burnMaterial = new THREE.MeshBasicMaterial({
            color: ElementStyles[ElementTypes.FIRE].color,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending
        });

        const burnEffect = new THREE.Mesh(burnGeometry, burnMaterial);
        this.mesh.add(burnEffect);

        // Store reference
        this.mesh.userData.burnEffect = burnEffect;

        if (burnEffect) {
            // Animate pulsing
            let startTime = performance.now();

            // Add to game's animation system instead of creating a new loop
            const animationId = this.game.addAnimationEffect({
                startTime: startTime,
                duration: Infinity, // Runs until explicitly removed
                update: (progress) => {
                    if (!this.mesh || !this.mesh.userData.burnEffect) return true; // Complete if mesh or effect is gone

                    const time = performance.now() - startTime;
                    const scale = 1 + 0.2 * Math.sin(time * 0.005);

                    burnEffect.scale.set(scale, scale, scale);

                    // Check if the burn effect is still active
                    const hasBurnEffect = this.statusEffects.some(effect => effect.type === 'burn');

                    if (!hasBurnEffect) {
                        // Remove effect when burn wears off
                        this.mesh.remove(burnEffect);
                        delete this.mesh.userData.burnEffect;
                        delete this.mesh.userData.burnEffectAnimationId;
                        return true; // Animation complete
                    }

                    return false; // Animation still running
                }
            });

            // Store animation ID for potential early cancellation
            this.mesh.userData.burnEffectAnimationId = animationId;
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
        // Track pathfinding calls for debugging
        if (this.game._pathfindingCalls !== undefined) {
            this.game._pathfindingCalls++;
        }

        // Skip expensive pathfinding if FPS is low
        if (this.game.fpsCounter && this.game.fpsCounter.value < 25) {
            // Use simpler path calculation during performance issues
            this.findFallbackPath();
            return;
        }

        // Prevent stack overflow with a recursion limit
        const MAX_RECURSION_DEPTH = 3;
        if (recursionDepth >= MAX_RECURSION_DEPTH) {
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
                    // Pathfinding timed out, use direct path
                    this.findFallbackPath();
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
                // No path found, try alternate exit or use fallback
                if (this.game.fpsCounter && this.game.fpsCounter.value < 30) {
                    // Skip retries during low performance, use direct path
                    this.findFallbackPath();
                } else {
                    // Try a different exit point
                    this.targetPosition = this.findExitPoint();
                    this.isPathfinding = false;
                    // Call again with increased recursion depth
                    return this.calculatePath(recursionDepth + 1);
                }
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