export class Enemy {
    constructor(game, type, startPosition) {
        this.game = game;
        this.type = type;
        this.position = { ...startPosition };
        this.position.y = 0.3; // Slight offset from ground

        // Set stats based on enemy type
        this.setStats();

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
        this.slowEffect = false;
        this.slowFactor = 1;
        this.slowEndTime = 0;

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
        switch (this.type) {
            case 'simple':
                this.health = 100;
                this.maxHealth = 100;
                this.baseSpeed = 3; // Units per second
                this.reward = 10;
                break;

            case 'elephant':
                this.health = 250;
                this.maxHealth = 250;
                this.baseSpeed = 1.5; // Units per second
                this.reward = 25;
                break;

            case 'pirate':
                this.health = 400;
                this.maxHealth = 400;
                this.baseSpeed = 1; // Units per second
                this.reward = 50;
                break;

            default:
                this.health = 100;
                this.maxHealth = 100;
                this.baseSpeed = 3;
                this.reward = 10;
        }
    }

    update(deltaTime) {
        // Check if reached the end
        if (this.reachedEnd) return;

        // Check if slow effect has ended
        if (this.slowEffect && performance.now() > this.slowEndTime) {
            this.slowEffect = false;
            this.slowFactor = 1;
            this.speed = this.baseSpeed;
        }

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
        const moveSpeed = this.speed * this.slowFactor * deltaTime;
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

    takeDamage(amount) {
        this.health -= amount;

        // Ensure health doesn't go below 0
        if (this.health < 0) this.health = 0;

        // Create hit effect
        this.createHitEffect();
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

    createHitEffect() {
        // Simple hit effect
        const hitGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const hitMaterial = new THREE.MeshBasicMaterial({
            color: 0xFF0000,
            transparent: true,
            opacity: 0.7
        });

        const hitEffect = new THREE.Mesh(hitGeometry, hitMaterial);
        hitEffect.position.copy(this.mesh.position);
        hitEffect.position.y += 0.5; // Position above enemy

        this.game.renderer.scene.add(hitEffect);

        // Animate and remove
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

    applySlowEffect(slowAmount, duration) {
        this.slowEffect = true;
        this.slowFactor = 1 - slowAmount; // e.g. 0.5 for 50% slow
        this.speed = this.baseSpeed * this.slowFactor;
        this.slowEndTime = performance.now() + (duration * 1000);

        // Visual effect for slow
        if (this.mesh) {
            // Add a blue glow to indicate slow effect
            const slowGeometry = new THREE.SphereGeometry(0.4, 16, 16);
            const slowMaterial = new THREE.MeshBasicMaterial({
                color: 0x00FFFF,
                transparent: true,
                opacity: 0.3
            });

            const slowEffect = new THREE.Mesh(slowGeometry, slowMaterial);
            this.mesh.add(slowEffect);

            // Remove slow effect when it ends
            setTimeout(() => {
                if (this.mesh) {
                    this.mesh.remove(slowEffect);
                }
            }, duration * 1000);
        }
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