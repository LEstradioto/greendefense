import * as THREE from 'three';

/**
 * Manages instanced meshes for enemy rendering optimization
 * Handles creation, positioning, and updating of large numbers of enemies efficiently
 */
export class EnemyInstanceManager {
    constructor(renderer) {
        this.renderer = renderer;
        this.scene = renderer.scene;
        this.geometries = renderer.geometries;
        this.materials = renderer.materials;

        // Track instanced meshes by enemy type and element
        this.enemyMeshes = {};

        // Instance tracking
        this.availableIndices = {};
        this.instanceCount = {};
        this.maxInstancesPerType = 200;

        // Store enemy instances
        this.enemyInstances = [];

        // Performance optimizations - shared objects
        this._tempVector = new THREE.Vector3();
        this._tempMatrix = new THREE.Matrix4();
        this._rotationMatrix = new THREE.Matrix4();
        this._scaleMatrix = new THREE.Matrix4();
        this._positionMatrix = new THREE.Matrix4();

        // Animation performance tracking
        this._animatedTypes = {}; // Track which types need matrix updates
        this._lastBatchUpdateTime = 0;
        this._batchUpdateInterval = 16; // ms - batch updates on roughly 60fps rate

        // Base enemy types
        this.enemyTypes = [
            'simple',
            'elephant',
            'pirate',
            'golem'
        ];

        // Element types
        this.elementTypes = [
            'neutral',
            'fire',
            'water',
            'earth',
            'air',
            'shadow'
        ];

        // Initialize instanced meshes
        this.init();
    }

    init() {
        // Create instanced meshes for each enemy type and element combination
        for (const baseType of this.enemyTypes) {
            if (!this.enemyMeshes[baseType]) {
                this.enemyMeshes[baseType] = {};
                this.availableIndices[baseType] = {};
                this.instanceCount[baseType] = {};
            }

            for (const elementType of this.elementTypes) {
                // Track available indices
                this.availableIndices[baseType][elementType] = Array.from(Array(this.maxInstancesPerType).keys());
                this.instanceCount[baseType][elementType] = 0;

                // Create geometry based on enemy type
                let geometry;
                switch (baseType) {
                    case 'simple':
                        geometry = new THREE.SphereGeometry(0.3, 16, 16);
                        break;
                    case 'elephant':
                        geometry = new THREE.BoxGeometry(0.5, 0.5, 0.7);
                        break;
                    case 'pirate':
                        geometry = new THREE.ConeGeometry(0.3, 0.8, 5);
                        break;
                    case 'golem':
                        geometry = new THREE.DodecahedronGeometry(0.4, 0);
                        break;
                    default:
                        geometry = new THREE.SphereGeometry(0.3, 16, 16);
                }

                // Create material based on element
                let material;
                switch (elementType) {
                    case 'fire':
                        material = new THREE.MeshStandardMaterial({
                            color: 0xe74c3c,
                            emissive: 0xc0392b,
                            emissiveIntensity: 0.5,
                            roughness: 0.7,
                            metalness: 0.3
                        });
                        break;
                    case 'water':
                        material = new THREE.MeshStandardMaterial({
                            color: 0x3498db,
                            emissive: 0x2980b9,
                            emissiveIntensity: 0.3,
                            roughness: 0.3,
                            metalness: 0.7,
                            transparent: true,
                            opacity: 0.9
                        });
                        break;
                    case 'earth':
                        material = new THREE.MeshStandardMaterial({
                            color: 0x27ae60,
                            emissive: 0x229954,
                            emissiveIntensity: 0.2,
                            roughness: 0.9,
                            metalness: 0.1
                        });
                        break;
                    case 'air':
                        material = new THREE.MeshStandardMaterial({
                            color: 0xecf0f1,
                            emissive: 0xbdc3c7,
                            emissiveIntensity: 0.3,
                            roughness: 0.4,
                            metalness: 0.6,
                            transparent: true,
                            opacity: 0.8
                        });
                        break;
                    case 'shadow':
                        material = new THREE.MeshStandardMaterial({
                            color: 0x9b59b6,
                            emissive: 0x8e44ad,
                            emissiveIntensity: 0.4,
                            roughness: 0.5,
                            metalness: 0.5
                        });
                        break;
                    default:
                        // Different colors for different enemy types
                        switch (baseType) {
                            case 'simple':
                                material = new THREE.MeshStandardMaterial({
                                    color: 0x95a5a6,
                                    roughness: 0.5,
                                    metalness: 0.3
                                });
                                break;
                            case 'elephant':
                                material = new THREE.MeshStandardMaterial({
                                    color: 0x7f8c8d,
                                    roughness: 0.8,
                                    metalness: 0.1
                                });
                                break;
                            case 'pirate':
                                material = new THREE.MeshStandardMaterial({
                                    color: 0x34495e,
                                    roughness: 0.6,
                                    metalness: 0.4
                                });
                                break;
                            case 'golem':
                                material = new THREE.MeshStandardMaterial({
                                    color: 0x2c3e50,
                                    roughness: 0.9,
                                    metalness: 0.2
                                });
                                break;
                            default:
                                material = new THREE.MeshStandardMaterial({
                                    color: 0x95a5a6,
                                    roughness: 0.5,
                                    metalness: 0.3
                                });
                        }
                }

                // Set shadow properties
                material.shadowSide = THREE.FrontSide;
                material.transparent = true;
                material.opacity = 0.95;

                // Create instanced mesh
                const instancedMesh = new THREE.InstancedMesh(
                    geometry,
                    material,
                    this.maxInstancesPerType
                );
                instancedMesh.count = 0;
                instancedMesh.castShadow = true;
                instancedMesh.receiveShadow = true;

                // Add to scene
                this.scene.add(instancedMesh);

                // Store reference
                this.enemyMeshes[baseType][elementType] = instancedMesh;
            }
        }
    }

    createEnemy(enemy) {
        // Extract base type and element
        let baseType = enemy.type;
        let elementType = 'neutral';

        // Check if enemy type contains an element
        const elements = ['fire', 'water', 'earth', 'air', 'shadow'];
        for (const element of elements) {
            if (enemy.type.startsWith(element + '_')) {
                elementType = element;
                baseType = enemy.type.substring(element.length + 1);
                break;
            }
        }

        // Ensure base type is one we support
        if (!this.enemyTypes.includes(baseType)) {
            baseType = 'simple'; // Default to simple enemy type
        }

        // Get instance index
        const instanceIndex = this.getNextInstanceIndex(baseType, elementType);
        if (instanceIndex === -1) {
            console.error(`Failed to get instance index for enemy type: ${baseType}, element: ${elementType}`);
            return null;
        }

        // Create health bar as individual mesh (not instanced)
        const healthBarData = this.renderer.createHealthBar();

        // Set initial position
        this.updateEnemyPosition(baseType, elementType, instanceIndex, enemy.position);

        // Add health bar mesh to scene
        healthBarData.group.position.set(enemy.position.x, enemy.position.y + 1, enemy.position.z);
        this.scene.add(healthBarData.group);

        // Create enemy instance object to track everything
        const enemyInstance = {
            baseType,
            elementType,
            instanceIndex,
            healthBar: healthBarData,
            position: new THREE.Vector3(enemy.position.x, enemy.position.y, enemy.position.z),
            // Additional effects - these need individual meshes
            effectMeshes: {},
            // Reference to original enemy
            enemy: enemy
        };

        // Add elemental effects if needed
        if (elementType !== 'neutral') {
            // We'll create these on demand with separate meshes
            // because they involve animation and can't be easily instanced
            this.addElementalEffects(enemyInstance);
        }

        // Store instance
        this.enemyInstances.push(enemyInstance);

        // Return the instance object
        return enemyInstance;
    }

    getNextInstanceIndex(baseType, elementType) {
        if (!this.availableIndices[baseType] ||
            !this.availableIndices[baseType][elementType] ||
            this.availableIndices[baseType][elementType].length === 0) {
            console.error(`No available indices for enemy type: ${baseType}, element: ${elementType}`);
            return -1;
        }

        const index = this.availableIndices[baseType][elementType].shift();

        // Update count for this instanced mesh
        const mesh = this.enemyMeshes[baseType][elementType];
        mesh.count = Math.max(mesh.count, index + 1);

        // Increment instance count
        this.instanceCount[baseType][elementType]++;

        return index;
    }

    updateEnemyPosition(baseType, elementType, instanceIndex, position) {
        // Update enemy mesh position
        const matrix = new THREE.Matrix4();
        matrix.setPosition(position.x, position.y, position.z);
        this.enemyMeshes[baseType][elementType].setMatrixAt(instanceIndex, matrix);
        this.enemyMeshes[baseType][elementType].instanceMatrix.needsUpdate = true;
    }

    updateHealthBar(enemyInstance, healthPercent) {
        // Skip if no health bar
        if (!enemyInstance || !enemyInstance.healthBar) return;

        // Use the renderer's health bar update function
        this.renderer.updateHealthBar(enemyInstance.healthBar, healthPercent);

        // Make sure the health bar is visible
        if (enemyInstance.healthBar.group) {
            enemyInstance.healthBar.group.visible = true;
        }

        // Update position to match the enemy's current position
        if (enemyInstance.position) {
            enemyInstance.healthBar.group.position.set(
                enemyInstance.position.x,
                enemyInstance.position.y + 1, // Position above enemy
                enemyInstance.position.z
            );
        }
    }

    addElementalEffects(enemyInstance) {
        // Create separate mesh for glow effect
        const glowGeometry = new THREE.SphereGeometry(0.4, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: this.enemyMeshes[enemyInstance.baseType][enemyInstance.elementType].material.color,
            transparent: true,
            opacity: 0.3,
            side: THREE.BackSide
        });

        const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        glowMesh.position.copy(enemyInstance.position);

        // Start invisible until first properly positioned update
        glowMesh.visible = false;

        this.scene.add(glowMesh);

        // Store in enemy instance
        enemyInstance.effectMeshes.glow = glowMesh;

        // Add elemental particles - if we need them
        if (enemyInstance.elementType !== 'neutral') {
            // Create particle system
            const particleCount = 5;
            const particleGeometry = new THREE.BufferGeometry();
            const particlePositions = new Float32Array(particleCount * 3);

            for (let i = 0; i < particleCount; i++) {
                const i3 = i * 3;
                const angle = Math.random() * Math.PI * 2;
                const radius = 0.4;

                particlePositions[i3] = Math.cos(angle) * radius;
                particlePositions[i3+1] = (Math.random() - 0.5) * 0.5;
                particlePositions[i3+2] = Math.sin(angle) * radius;
            }

            particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

            const particleMaterial = new THREE.PointsMaterial({
                color: glowMaterial.color,
                size: 0.08,
                transparent: true,
                opacity: 0.7
            });

            const particles = new THREE.Points(particleGeometry, particleMaterial);
            particles.position.copy(enemyInstance.position);

            // Start invisible until first properly positioned update
            particles.visible = false;

            this.scene.add(particles);

            // Store for animation
            enemyInstance.effectMeshes.particles = particles;

            // Track if effects have been properly initialized
            enemyInstance.effectsInitialized = false;
        }
    }

    updateEnemyEffects(enemyInstance, currentTime) {
        // Skip effects for enemies that have reached the end
        if (enemyInstance.enemy && enemyInstance.enemy.reachedEnd) {
            // Ensure all effects are hidden for enemies that reached the end
            if (enemyInstance.effectMeshes) {
                for (const effectType in enemyInstance.effectMeshes) {
                    if (enemyInstance.effectMeshes[effectType]) {
                        enemyInstance.effectMeshes[effectType].visible = false;

                        // Move far away from scene
                        enemyInstance.effectMeshes[effectType].position.set(9999, -9999, 9999);

                        // For particles, also reset positions
                        if (effectType === 'particles' &&
                            enemyInstance.effectMeshes[effectType].geometry &&
                            enemyInstance.effectMeshes[effectType].geometry.attributes &&
                            enemyInstance.effectMeshes[effectType].geometry.attributes.position) {

                            const positions = enemyInstance.effectMeshes[effectType].geometry.attributes.position.array;
                            for (let i = 0; i < positions.length; i += 3) {
                                positions[i] = 9999;
                                positions[i+1] = -9999;
                                positions[i+2] = 9999;
                            }
                            enemyInstance.effectMeshes[effectType].geometry.attributes.position.needsUpdate = true;
                        }
                    }
                }
            }
            return;
        }

        // Check if the enemy has a valid position - don't show effects if not
        // Positions around 0,0 on first spawn might not be valid - check for enemy having a path
        const hasValidPosition = enemyInstance.enemy &&
                                 enemyInstance.enemy.pathWaypoints &&
                                 enemyInstance.enemy.pathWaypoints.length > 0;

        // Skip if enemy doesn't have a valid position yet
        if (!hasValidPosition) {
            // Make sure all effects are hidden
            if (enemyInstance.effectMeshes) {
                for (const effectType in enemyInstance.effectMeshes) {
                    if (enemyInstance.effectMeshes[effectType]) {
                        enemyInstance.effectMeshes[effectType].visible = false;
                    }
                }
            }
            return;
        }

        // Enemy has valid position, we can show and update effects

        // If first time with valid position, mark as initialized and make visible
        if (!enemyInstance.effectsInitialized) {
            if (enemyInstance.effectMeshes) {
                for (const effectType in enemyInstance.effectMeshes) {
                    if (enemyInstance.effectMeshes[effectType]) {
                        enemyInstance.effectMeshes[effectType].visible = true;
                    }
                }
            }
            enemyInstance.effectsInitialized = true;
        }

        // Update elemental effects
        if (enemyInstance.effectMeshes.glow) {
            // Update glow position
            enemyInstance.effectMeshes.glow.position.copy(enemyInstance.position);
        }

        if (enemyInstance.effectMeshes.particles) {
            // Update particles position
            enemyInstance.effectMeshes.particles.position.copy(enemyInstance.position);

            // Animate particles
            const positions = enemyInstance.effectMeshes.particles.geometry.attributes.position.array;
            const particleCount = positions.length / 3;

            for (let i = 0; i < particleCount; i++) {
                const i3 = i * 3;
                const angle = (currentTime + i) * 2;
                const radius = 0.4 + 0.1 * Math.sin(currentTime * 3 + i);

                // Update particle positions based on element type
                switch (enemyInstance.elementType) {
                    case 'fire':
                        // Fire particles move up and outward
                        positions[i3] = radius * Math.cos(angle);
                        positions[i3+1] = 0.1 + 0.2 * Math.sin(currentTime * 4 + i);
                        positions[i3+2] = radius * Math.sin(angle);
                        break;
                    case 'water':
                        // Water particles flow in circles
                        positions[i3] = radius * Math.cos(angle * 0.5);
                        positions[i3+1] = 0.1 * Math.sin(currentTime * 2 + i);
                        positions[i3+2] = radius * Math.sin(angle * 0.5);
                        break;
                    case 'earth':
                        // Earth particles orbit slowly
                        positions[i3] = radius * Math.cos(angle * 0.3);
                        positions[i3+1] = 0.05 * Math.sin(currentTime + i);
                        positions[i3+2] = radius * Math.sin(angle * 0.3);
                        break;
                    case 'air':
                        // Air particles move quickly and chaotically
                        positions[i3] = radius * Math.cos(angle * 2);
                        positions[i3+1] = 0.2 * Math.sin(currentTime * 5 + i);
                        positions[i3+2] = radius * Math.sin(angle * 2);
                        break;
                    case 'shadow':
                        // Shadow particles pulse in and out
                        const pulseRadius = 0.3 + 0.3 * Math.sin(currentTime + i);
                        positions[i3] = pulseRadius * Math.cos(angle * 0.7);
                        positions[i3+1] = 0.1 * Math.sin(currentTime * 1.5 + i);
                        positions[i3+2] = pulseRadius * Math.sin(angle * 0.7);
                        break;
                }
            }

            enemyInstance.effectMeshes.particles.geometry.attributes.position.needsUpdate = true;
        }
    }

    removeEnemy(enemyInstance) {
        if (!enemyInstance) return;

        try {
            // Apply a position far away from the scene to make sure it's not visible
            // This prevents "ghost" enemies when enemies are removed but indices reused
            const farAwayPosition = new THREE.Vector3(-10000, -10000, -10000);

            // Update the mesh matrix to move it far away
            if (this.enemyMeshes[enemyInstance.baseType] &&
                this.enemyMeshes[enemyInstance.baseType][enemyInstance.elementType]) {

                const matrix = new THREE.Matrix4();
                matrix.setPosition(farAwayPosition);

                this.enemyMeshes[enemyInstance.baseType][enemyInstance.elementType]
                    .setMatrixAt(enemyInstance.instanceIndex, matrix);
                this.enemyMeshes[enemyInstance.baseType][enemyInstance.elementType]
                    .instanceMatrix.needsUpdate = true;
            }

            // Make instance available for reuse
            if (this.availableIndices[enemyInstance.baseType] &&
                this.availableIndices[enemyInstance.baseType][enemyInstance.elementType]) {
                this.availableIndices[enemyInstance.baseType][enemyInstance.elementType]
                    .push(enemyInstance.instanceIndex);

                // Decrement instance count
                if (this.instanceCount[enemyInstance.baseType] &&
                    this.instanceCount[enemyInstance.baseType][enemyInstance.elementType]) {
                    this.instanceCount[enemyInstance.baseType][enemyInstance.elementType]--;
                }
            }

            // Remove health bar
            if (enemyInstance.healthBar && enemyInstance.healthBar.group) {
                this.scene.remove(enemyInstance.healthBar.group);
                enemyInstance.healthBar = null;
            }

            // Remove effect meshes
            for (const type in enemyInstance.effectMeshes) {
                if (enemyInstance.effectMeshes[type]) {
                    this.scene.remove(enemyInstance.effectMeshes[type]);

                    // Dispose of resources
                    if (enemyInstance.effectMeshes[type].geometry) {
                        enemyInstance.effectMeshes[type].geometry.dispose();
                    }

                    if (enemyInstance.effectMeshes[type].material) {
                        if (Array.isArray(enemyInstance.effectMeshes[type].material)) {
                            enemyInstance.effectMeshes[type].material.forEach(m => m.dispose());
                        } else {
                            enemyInstance.effectMeshes[type].material.dispose();
                        }
                    }

                    enemyInstance.effectMeshes[type] = null;
                }
            }

            // Clear reference to original enemy to prevent memory leaks
            if (enemyInstance.enemy) {
                // Break circular reference
                enemyInstance.enemy.enemyInstance = null;
                enemyInstance.enemy = null;
            }

            // Remove from instances array
            const index = this.enemyInstances.indexOf(enemyInstance);
            if (index !== -1) {
                this.enemyInstances.splice(index, 1);
            }
        } catch (error) {
            console.error('Error removing enemy instance:', error);
        }
    }

    // Update the batch update positions method
    batchUpdatePositions(updates) {
        if (!updates || updates.length === 0) return;

        // Track which mesh types need updates
        const updatedMeshes = new Set();

        // Process all position updates in a single batch
        for (const update of updates) {
            const { enemy, position } = update;
            if (!enemy || !position) continue;

            // Update instance position in the main mesh
            if (enemy.enemyInstance &&
                enemy.enemyInstance.baseType &&
                enemy.enemyInstance.elementType &&
                enemy.enemyInstance.instanceIndex !== undefined) {

                const instanceIndex = enemy.enemyInstance.instanceIndex;
                const baseType = enemy.enemyInstance.baseType;
                const elementType = enemy.enemyInstance.elementType;

                // Update the enemy instance position for reference
                enemy.enemyInstance.position.copy(position);

                // Create matrix for the main mesh
                const matrix = new THREE.Matrix4();
                matrix.setPosition(position.x, position.y, position.z);

                // Update mesh matrix
                if (this.enemyMeshes[baseType] && this.enemyMeshes[baseType][elementType]) {
                    this.enemyMeshes[baseType][elementType].setMatrixAt(instanceIndex, matrix);
                    updatedMeshes.add(`${baseType}:${elementType}`);
                }

                // Update health bar position if it exists
                if (enemy.enemyInstance.healthBar && enemy.enemyInstance.healthBar.group) {
                    enemy.enemyInstance.healthBar.group.position.set(
                        position.x, position.y + 1, position.z
                    );
                }

                // Update effect meshes positions
                for (const type in enemy.enemyInstance.effectMeshes) {
                    if (enemy.enemyInstance.effectMeshes[type]) {
                        enemy.enemyInstance.effectMeshes[type].position.copy(position);
                    }
                }
            }
        }

        // Apply all updates at once for better performance
        for (const meshKey of updatedMeshes) {
                const [baseType, elementType] = meshKey.split(':');
                if (this.enemyMeshes[baseType] && this.enemyMeshes[baseType][elementType]) {
                    this.enemyMeshes[baseType][elementType].instanceMatrix.needsUpdate = true;
                }
        }
    }

    // Add a method to perform garbage collection
    performGarbageCollection() {
        // Clean up unused materials and geometries
        THREE.Cache.clear();

        // Reset the free instances pool if it's too large
        if (this.freeInstances.length > 200) {
            console.log(`Resetting free instances pool. Size: ${this.freeInstances.length}`);

            // Keep only the first 50 instances
            this.freeInstances = this.freeInstances.slice(0, 50);
        }
    }

    // Animate all enemies
    animateEnemies(currentTime) {
        // Reset animation tracking
        this._animatedTypes = {};

        // Process all enemies
        for (const enemyInstance of this.enemyInstances) {
            this._animateSingleEnemy(enemyInstance, currentTime);
        }

        // Apply all matrix updates at once
        this._applyMatrixUpdates();
    }

    // Helper method to animate a single enemy
    _animateSingleEnemy(enemyInstance, currentTime) {
        // Skip animation for enemies that have reached the end
        if (enemyInstance.enemy && enemyInstance.enemy.reachedEnd) {
            return;
        }

        // Initialize needsUpdate tracking for this type/element if needed
        if (!this._animatedTypes[enemyInstance.baseType]) {
            this._animatedTypes[enemyInstance.baseType] = {};
        }

        // Animation logic by type
        switch (enemyInstance.baseType) {
            case 'simple':
                // Calculate rotations for simple enemies
                const rotationX = 0.2 * Math.sin(currentTime * 2);
                const rotationZ = 0.2 * Math.cos(currentTime * 2);

                // Reuse the rotation matrix
                this._rotationMatrix.identity().makeRotationX(rotationX);
                this._tempMatrix.identity().makeRotationZ(rotationZ);
                this._rotationMatrix.multiply(this._tempMatrix);

                // Add translation using position matrix
                this._positionMatrix.identity().setPosition(
                    enemyInstance.position.x,
                    enemyInstance.position.y,
                    enemyInstance.position.z
                );

                // Combine rotation and position (reusing temp matrix)
                this._tempMatrix.copy(this._rotationMatrix).multiply(this._positionMatrix);

                // Update matrix in the instanced mesh
                this.enemyMeshes[enemyInstance.baseType][enemyInstance.elementType]
                    .setMatrixAt(enemyInstance.instanceIndex, this._tempMatrix);

                // Mark this type as needing update
                this._animatedTypes[enemyInstance.baseType][enemyInstance.elementType] = true;
                break;

            case 'elephant':
                // Elephants sway with rotation around Y axis
                const rotationY = 0.1 * Math.sin(currentTime);

                // Apply rotation and translation, reusing matrices
                this._rotationMatrix.identity().makeRotationY(rotationY);
                this._positionMatrix.identity().setPosition(
                    enemyInstance.position.x,
                    enemyInstance.position.y,
                    enemyInstance.position.z
                );

                // Combine matrices
                this._tempMatrix.copy(this._rotationMatrix).multiply(this._positionMatrix);

                // Update matrix
                this.enemyMeshes[enemyInstance.baseType][enemyInstance.elementType]
                    .setMatrixAt(enemyInstance.instanceIndex, this._tempMatrix);

                // Mark this type as needing update
                this._animatedTypes[enemyInstance.baseType][enemyInstance.elementType] = true;
                break;

            case 'pirate':
                // Pirates spin slowly - continuously increasing rotation
                // For continuous spinning, store rotation in instance
                enemyInstance.rotation = (enemyInstance.rotation || 0) + 0.01;

                // Reuse matrices
                this._rotationMatrix.identity().makeRotationY(enemyInstance.rotation);
                this._positionMatrix.identity().setPosition(
                    enemyInstance.position.x,
                    enemyInstance.position.y,
                    enemyInstance.position.z
                );

                // Combine matrices
                this._tempMatrix.copy(this._rotationMatrix).multiply(this._positionMatrix);

                // Update matrix
                this.enemyMeshes[enemyInstance.baseType][enemyInstance.elementType]
                    .setMatrixAt(enemyInstance.instanceIndex, this._tempMatrix);

                // Mark this type as needing update
                this._animatedTypes[enemyInstance.baseType][enemyInstance.elementType] = true;
                break;

            case 'golem':
                // Golems pulse - scale in and out
                const scale = 1 + 0.05 * Math.sin(currentTime * 1.5);

                // Create matrix with scale and position, reusing matrices
                this._scaleMatrix.identity().makeScale(scale, scale, scale);
                this._positionMatrix.identity().setPosition(
                    enemyInstance.position.x,
                    enemyInstance.position.y,
                    enemyInstance.position.z
                );

                // Combine matrices
                this._tempMatrix.copy(this._scaleMatrix).multiply(this._positionMatrix);

                // Update matrix
                this.enemyMeshes[enemyInstance.baseType][enemyInstance.elementType]
                    .setMatrixAt(enemyInstance.instanceIndex, this._tempMatrix);

                // Mark this type as needing update
                this._animatedTypes[enemyInstance.baseType][enemyInstance.elementType] = true;
                break;
        }

        // Update elemental effects selectively based on frame rate
        // (This is handled later in the game loop)
        if (enemyInstance.effectMeshes) {
            this.updateEnemyEffects(enemyInstance, currentTime);
        }
    }

    // Apply all matrix updates at once to reduce needsUpdate calls
    _applyMatrixUpdates() {
        // Small batching optimization - only update matrices periodically to reduce needsUpdate calls
        const now = performance.now();
        const shouldUpdate = now - this._lastBatchUpdateTime >= this._batchUpdateInterval;

        if (shouldUpdate) {
            // Apply all instance matrix updates at once for each type/element
            for (const baseType in this._animatedTypes) {
                for (const elementType in this._animatedTypes[baseType]) {
                    if (this._animatedTypes[baseType][elementType] &&
                        this.enemyMeshes[baseType] &&
                        this.enemyMeshes[baseType][elementType]) {
                        this.enemyMeshes[baseType][elementType].instanceMatrix.needsUpdate = true;
                    }
                }
            }
            this._lastBatchUpdateTime = now;

            // Ensure shader materials get updated on next frame
            if (this.renderer && this.renderer.renderer) {
                this.renderer.renderer.compile(this.scene, this.renderer.camera);
            }
        }
    }

    // Animate only enemies within the camera frustum for better performance
    animateVisibleEnemies(currentTime, frustum) {
        // Reset animation tracking
        this._animatedTypes = {};

        // Reuse a vector for position checking
        const position = this._tempVector;

        for (const enemyInstance of this.enemyInstances) {
            // Set position vector from instance position
            position.set(
                enemyInstance.position.x,
                enemyInstance.position.y,
                enemyInstance.position.z
            );

            // Skip animation if not in frustum
            if (!frustum.containsPoint(position)) {
                continue;
            }

            // Animate this enemy
            this._animateSingleEnemy(enemyInstance, currentTime);
        }

        // Apply all matrix updates at once
        this._applyMatrixUpdates();
    }

    // Cleanup resources
    dispose() {
        // Dispose of all instanced meshes
        for (const baseType in this.enemyMeshes) {
            for (const elementType in this.enemyMeshes[baseType]) {
                const mesh = this.enemyMeshes[baseType][elementType];
                if (mesh) {
                    this.scene.remove(mesh);
                    mesh.geometry.dispose();
                    mesh.material.dispose();
                }
            }
        }

        // Clear references
        this.enemyMeshes = {};
        this.availableIndices = {};
        this.instanceCount = {};
        this.enemyInstances = [];
    }

    reset() {
        console.log("Resetting EnemyInstanceManager");

        // Reset all instance counts
        for (const baseType in this.instanceCount) {
            for (const elementType in this.instanceCount[baseType]) {
                this.instanceCount[baseType][elementType] = 0;

                // Reset the instance mesh count
                if (this.enemyMeshes[baseType] && this.enemyMeshes[baseType][elementType]) {
                    this.enemyMeshes[baseType][elementType].count = 0;
                }
            }
        }

        // Reset all instance availability indices
        for (const baseType in this.availableIndices) {
            for (const elementType in this.availableIndices[baseType]) {
                this.availableIndices[baseType][elementType] = Array.from(Array(this.maxInstancesPerType).keys());
            }
        }

        // Reset animation tracking
        this._animatedTypes = {};

        // Clear all enemy instances but don't dispose the meshes
        this.enemyInstances = [];

        // Make all instances invisible by moving them far away
        const hiddenMatrix = new THREE.Matrix4();
        hiddenMatrix.setPosition(10000, 10000, 10000);

        for (const baseType in this.enemyMeshes) {
            for (const elementType in this.enemyMeshes[baseType]) {
                const mesh = this.enemyMeshes[baseType][elementType];

                // Set all instances to hidden position
                for (let i = 0; i < this.maxInstancesPerType; i++) {
                    mesh.setMatrixAt(i, hiddenMatrix);
                }

                // Update instance matrices
                mesh.instanceMatrix.needsUpdate = true;
            }
        }

        console.log("EnemyInstanceManager reset complete");
    }
}