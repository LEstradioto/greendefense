import * as THREE from 'three';
import { ElementTypes } from '../elements.js';

/**
 * Manages instanced meshes for tower rendering optimization
 * Handles creation, positioning, and updating of tower instances
 */
export class TowerInstanceManager {
    constructor(renderer) {
        this.renderer = renderer;
        this.scene = renderer.scene;
        this.geometries = renderer.geometries;
        this.materials = renderer.materials;

        // Instanced meshes for static tower parts
        this.towerBases = {};
        this.towerFoundations = {};
        // Add instanced meshes for tower tops
        this.towerTops = {};
        this.towerTopTypes = {
            'default': this.geometries.defaultTop,
            'arrow': this.geometries.arrowTopBase,
            'doubleArrow': this.geometries.doubleArrowTopCone,
            'cannon': this.geometries.cannonTopSphere
        };

        // Instance tracking
        this.availableIndices = {};
        this.instanceCount = {};
        this.maxInstancesPerType = 200;

        // Rotation matrices for tops - used to rotate tops toward targets
        this.topRotations = {};

        // Initialize with all element types
        this.init();
    }

    init() {
        // Ensure we have all element types explicitly defined
        const elementTypes = {
            'neutral': ElementTypes.NEUTRAL,
            'fire': ElementTypes.FIRE,
            'water': ElementTypes.WATER,
            'earth': ElementTypes.EARTH,
            'air': ElementTypes.AIR,
            'shadow': ElementTypes.SHADOW
        };

        // Initialize instanced meshes for each element type
        for (const elementKey in elementTypes) {
            console.log(`Initializing instanced meshes for element: ${elementKey}`);

            // Create arrays to track available indices
            this.availableIndices[elementKey] = Array.from(Array(this.maxInstancesPerType).keys());
            this.instanceCount[elementKey] = 0;

            // Initialize rotation matrices array
            this.topRotations[elementKey] = Array(this.maxInstancesPerType).fill().map(() => new THREE.Matrix4());

            // Ensure the material exists for this element
            if (!this.materials.towerBases[elementKey]) {
                console.warn(`Missing material for element: ${elementKey}, using neutral`);
                if (elementKey !== 'neutral' && this.materials.towerBases['neutral']) {
                    this.materials.towerBases[elementKey] = this.materials.towerBases['neutral'];
                    this.materials.towerTops[elementKey] = this.materials.towerTops['neutral'];
                    this.materials.towerFoundations[elementKey] = this.materials.towerFoundations['neutral'];
                } else {
                    // Create default materials if needed
                    this.materials.towerBases[elementKey] = new THREE.MeshStandardMaterial({
                        color: 0x388E3C,
                        roughness: 0.5,
                        metalness: 0.7
                    });
                    this.materials.towerTops[elementKey] = new THREE.MeshStandardMaterial({
                        color: 0x388E3C,
                        roughness: 0.4,
                        metalness: 0.8
                    });
                    this.materials.towerFoundations[elementKey] = new THREE.MeshStandardMaterial({
                        color: 0x388E3C,
                        roughness: 0.5,
                        metalness: 0.7
                    });
                }
            }

            // Create instanced meshes for tower bases
            this.towerBases[elementKey] = new THREE.InstancedMesh(
                this.geometries.towerBase,
                this.materials.towerBases[elementKey],
                this.maxInstancesPerType
            );
            this.towerBases[elementKey].count = 0; // Start with 0 instances
            this.towerBases[elementKey].castShadow = true;
            this.towerBases[elementKey].receiveShadow = true;
            this.scene.add(this.towerBases[elementKey]);

            // Create instanced meshes for tower foundations
            this.towerFoundations[elementKey] = new THREE.InstancedMesh(
                this.geometries.towerFoundation,
                this.materials.towerFoundations[elementKey],
                this.maxInstancesPerType
            );
            this.towerFoundations[elementKey].count = 0;
            this.towerFoundations[elementKey].receiveShadow = true;
            this.scene.add(this.towerFoundations[elementKey]);

            // Create instanced meshes for tower tops - one for each top type
            this.towerTops[elementKey] = {};
            for (const topType in this.towerTopTypes) {
                this.towerTops[elementKey][topType] = new THREE.InstancedMesh(
                    this.towerTopTypes[topType],
                    this.materials.towerTops[elementKey],
                    this.maxInstancesPerType
                );
                this.towerTops[elementKey][topType].count = 0;
                this.towerTops[elementKey][topType].castShadow = true;
                this.towerTops[elementKey][topType].receiveShadow = true;
                this.scene.add(this.towerTops[elementKey][topType]);

                // Pre-create nose meshes for each top type that needs it
                if (topType === 'cannon' || topType === 'arrow' || topType === 'doubleArrow') {
                    let noseGeometry;
                    if (topType === 'arrow') {
                        noseGeometry = this.geometries.arrowNose;
                    } else if (topType === 'doubleArrow') {
                        noseGeometry = this.geometries.doubleArrowNose;
                    } else { // cannon
                        noseGeometry = this.geometries.cannonBarrel || new THREE.CylinderGeometry(0.12, 0.08, 0.5, 8);
                    }

                    const noseMaterial = topType === 'cannon' && this.materials.towerSpecial ?
                        this.materials.towerSpecial.cannonBarrel :
                        this.materials.towerTops[elementKey];

                    this.towerTops[elementKey][`${topType}_nose`] = new THREE.InstancedMesh(
                        noseGeometry,
                        noseMaterial,
                        this.maxInstancesPerType
                    );
                    this.towerTops[elementKey][`${topType}_nose`].count = 0;
                    this.towerTops[elementKey][`${topType}_nose`].castShadow = true;
                    this.scene.add(this.towerTops[elementKey][`${topType}_nose`]);
                }
            }
        }

        // Initialize all instances to be far away to avoid ghost towers
        const hiddenMatrix = new THREE.Matrix4();
        hiddenMatrix.setPosition(10000, 10000, 10000);

        // Initialize all instance positions to be far away
        for (const elementKey in elementTypes) {
            for (let i = 0; i < this.maxInstancesPerType; i++) {
                // Set all base and foundation positions far away
                this.towerBases[elementKey].setMatrixAt(i, hiddenMatrix);
                this.towerFoundations[elementKey].setMatrixAt(i, hiddenMatrix);

                // Set all top positions far away
                for (const topType in this.towerTopTypes) {
                    this.towerTops[elementKey][topType].setMatrixAt(i, hiddenMatrix);

                    // Also set nose positions far away if they exist
                    if (this.towerTops[elementKey][`${topType}_nose`]) {
                        this.towerTops[elementKey][`${topType}_nose`].setMatrixAt(i, hiddenMatrix);
                        this.towerTops[elementKey][`${topType}_nose`].instanceMatrix.needsUpdate = true;
                    }
                }
            }

            // Update matrix instances
            this.towerBases[elementKey].instanceMatrix.needsUpdate = true;
            this.towerFoundations[elementKey].instanceMatrix.needsUpdate = true;

            for (const topType in this.towerTopTypes) {
                this.towerTops[elementKey][topType].instanceMatrix.needsUpdate = true;
            }
        }
    }

    getNextIndex(elementKey) {
        // Normalize element key to lowercase for consistent lookup
        const normalizedElementKey = elementKey.toLowerCase();

        // Check if we have this element type initialized
        if (!this.availableIndices[normalizedElementKey]) {
            console.error(`Element type not initialized: ${elementKey}, available types:`, Object.keys(this.availableIndices));

            // Fall back to neutral element if available
            if (this.availableIndices['neutral'] && this.availableIndices['neutral'].length > 0) {
                console.log(`Falling back to neutral element for: ${elementKey}`);
                return this.getNextIndex('neutral');
            }
            return -1;
        }

        if (this.availableIndices[normalizedElementKey].length === 0) {
            console.error(`No available indices for element ${normalizedElementKey}`);
            return -1;
        }

        const index = this.availableIndices[normalizedElementKey].shift();

        // Update instance counts
        this.towerBases[normalizedElementKey].count = Math.max(this.towerBases[normalizedElementKey].count, index + 1);
        this.towerFoundations[normalizedElementKey].count = this.towerBases[normalizedElementKey].count;

        // Initialize rotation matrix for this tower
        this.topRotations[normalizedElementKey][index] = new THREE.Matrix4();

        this.instanceCount[normalizedElementKey]++;

        return index;
    }

    releaseIndex(elementKey, index) {
        if (!this.availableIndices[elementKey]) {
            this.availableIndices[elementKey] = [];
        }

        this.availableIndices[elementKey].push(index);
        this.instanceCount[elementKey]--;

        // No need to update .count property as we're just hiding the instance
    }

    updateBasePosition(elementKey, index, position) {
        const matrix = new THREE.Matrix4();
        matrix.setPosition(position.x, 0.3, position.z); // Base is positioned above ground
        this.towerBases[elementKey].setMatrixAt(index, matrix);
        this.towerBases[elementKey].instanceMatrix.needsUpdate = true;
    }

    updateFoundationPosition(elementKey, index, position) {
        const matrix = new THREE.Matrix4();
        matrix.setPosition(position.x, 0.05, position.z); // Foundation is at ground level
        this.towerFoundations[elementKey].setMatrixAt(index, matrix);
        this.towerFoundations[elementKey].instanceMatrix.needsUpdate = true;
    }

    updateTopPosition(elementKey, index, position, topType = 'default', rotation = 0) {
        // Skip if this element or top type doesn't exist
        if (!this.towerTops[elementKey] || !this.towerTops[elementKey][topType]) {
            return;
        }

        // Create matrix with position and rotation
        const matrix = new THREE.Matrix4();

        // Set position (slightly higher than base)
        matrix.setPosition(position.x, 0.9, position.z);

        // Apply rotation if needed
        if (rotation !== 0) {
            const rotationMatrix = new THREE.Matrix4().makeRotationY(rotation);
            matrix.multiply(rotationMatrix);
        }

        // Store the matrix for later updates
        this.topRotations[elementKey][index] = matrix.clone();

        // Update the instance
        this.towerTops[elementKey][topType].setMatrixAt(index, matrix);
        this.towerTops[elementKey][topType].instanceMatrix.needsUpdate = true;

        // Update the count if needed
        this.towerTops[elementKey][topType].count = Math.max(this.towerTops[elementKey][topType].count, index + 1);

        // For tower types that have a nose/barrel, immediately create and position it
        if (topType === 'cannon' || topType === 'arrow' || topType === 'doubleArrow') {
            // Create and attach the nose mesh if it doesn't exist
            if (!this.towerTops[elementKey][`${topType}_nose`]) {
                // Create nose instanced mesh
                let noseGeometry;
                if (topType === 'arrow') {
                    noseGeometry = this.geometries.arrowNose;
                } else if (topType === 'doubleArrow') {
                    noseGeometry = this.geometries.doubleArrowNose;
                } else { // cannon
                    noseGeometry = this.geometries.cannonBarrel || new THREE.CylinderGeometry(0.12, 0.08, 0.5, 8);
                }

                const noseMaterial = topType === 'cannon' && this.materials.towerSpecial ?
                    this.materials.towerSpecial.cannonBarrel :
                    this.materials.towerTops[elementKey];

                this.towerTops[elementKey][`${topType}_nose`] = new THREE.InstancedMesh(
                    noseGeometry,
                    noseMaterial,
                    this.maxInstancesPerType
                );
                this.towerTops[elementKey][`${topType}_nose`].count = this.towerTops[elementKey][topType].count;
                this.towerTops[elementKey][`${topType}_nose`].castShadow = true;
                this.scene.add(this.towerTops[elementKey][`${topType}_nose`]);
            }

            // Position the nose properly relative to the top
            const noseMatrix = matrix.clone();

            // Translate the nose based on tower type
            let noseOffset, noseRotation;
            if (topType === 'cannon') {
                // Translate the cannon barrel forward and rotate 90 degrees
                noseOffset = new THREE.Matrix4().makeTranslation(0, 0, 0.35);
                noseRotation = new THREE.Matrix4().makeRotationX(-Math.PI/2);
            } else if (topType === 'arrow') {
                // Position arrow nose at top of the cone
                noseOffset = new THREE.Matrix4().makeTranslation(0, 0.3, 0);
                noseRotation = new THREE.Matrix4(); // No rotation needed
            } else { // doubleArrow
                // Position double arrow noses
                noseOffset = new THREE.Matrix4().makeTranslation(0, 0.25, 0);
                noseRotation = new THREE.Matrix4(); // No rotation needed
            }

            // Apply transformations: position & rotation, then nose offset & rotation
            noseMatrix.multiply(noseOffset).multiply(noseRotation);

            // Update the nose instance
            this.towerTops[elementKey][`${topType}_nose`].setMatrixAt(index, noseMatrix);
            this.towerTops[elementKey][`${topType}_nose`].instanceMatrix.needsUpdate = true;

            // Update the count if needed
            this.towerTops[elementKey][`${topType}_nose`].count =
                Math.max(this.towerTops[elementKey][`${topType}_nose`].count, index + 1);
        }
    }

    updateTopRotation(elementKey, index, topType, targetPosition, towerPosition) {
        if (!this.towerTops[elementKey] || !this.towerTops[elementKey][topType]) {
            return;
        }

        // Calculate direction to target
        const direction = new THREE.Vector3()
            .subVectors(targetPosition, towerPosition)
            .normalize();

        // Calculate angle in XZ plane
        const angle = Math.atan2(direction.x, direction.z);

        // Create matrices for position and rotation
        const posMatrix = new THREE.Matrix4();
        posMatrix.setPosition(towerPosition.x, 0.9, towerPosition.z);

        // Create rotation matrix for the top
        const rotMatrix = new THREE.Matrix4().makeRotationY(angle);

        // Combine position and rotation
        const finalMatrix = posMatrix.multiply(rotMatrix);

        // Store the matrix for later updates
        this.topRotations[elementKey][index] = finalMatrix.clone();

        // Update the instance
        this.towerTops[elementKey][topType].setMatrixAt(index, finalMatrix);
        this.towerTops[elementKey][topType].instanceMatrix.needsUpdate = true;

        // Create and attach the nose mesh if it doesn't exist
        if (!this.towerTops[elementKey][`${topType}_nose`]) {
            // Create nose instanced mesh
            const noseGeometry = this.geometries.towerNose || new THREE.CylinderGeometry(0.12, 0.08, 0.5, 8);
            const noseMaterial = this.materials.towerSpecial ? this.materials.towerSpecial.cannonBarrel :
                new THREE.MeshStandardMaterial({ color: 0x212121, roughness: 0.3, metalness: 0.9 });

            this.towerTops[elementKey][`${topType}_nose`] = new THREE.InstancedMesh(
                noseGeometry,
                noseMaterial,
                this.maxInstancesPerType
            );
            this.towerTops[elementKey][`${topType}_nose`].count = this.towerTops[elementKey][topType].count;
            this.towerTops[elementKey][`${topType}_nose`].castShadow = true;
            this.scene.add(this.towerTops[elementKey][`${topType}_nose`]);
        }

        // Position the nose properly relative to the top
        const noseMatrix = finalMatrix.clone();

        // Translate the nose forward along the direction the tower is facing
        const noseOffset = new THREE.Matrix4().makeTranslation(0, 0, 0.35);

        // Rotate the nose to point outward (90 degrees around X axis)
        const noseRotation = new THREE.Matrix4().makeRotationX(-Math.PI/2);

        // Apply transformations: position & rotation, then nose offset & rotation
        noseMatrix.multiply(noseOffset).multiply(noseRotation);

        // Update the nose instance
        this.towerTops[elementKey][`${topType}_nose`].setMatrixAt(index, noseMatrix);
        this.towerTops[elementKey][`${topType}_nose`].instanceMatrix.needsUpdate = true;

        // Update the count if needed
        this.towerTops[elementKey][`${topType}_nose`].count =
            Math.max(this.towerTops[elementKey][`${topType}_nose`].count, index + 1);
    }

    hideInstance(elementKey, index, shadowIndex) {
        // Move far away to hide
        const hiddenMatrix = new THREE.Matrix4();
        hiddenMatrix.setPosition(10000, 10000, 10000);

        this.towerBases[elementKey].setMatrixAt(index, hiddenMatrix);
        this.towerBases[elementKey].instanceMatrix.needsUpdate = true;

        this.towerFoundations[elementKey].setMatrixAt(index, hiddenMatrix);
        this.towerFoundations[elementKey].instanceMatrix.needsUpdate = true;

        // Hide all top types
        for (const topType in this.towerTops[elementKey]) {
            this.towerTops[elementKey][topType].setMatrixAt(index, hiddenMatrix);
            this.towerTops[elementKey][topType].instanceMatrix.needsUpdate = true;

            // Also hide corresponding nose parts if they exist
            if (topType.includes('_nose')) {
                continue; // Skip nose parts, they're handled with their parent top
            }

            // Check if this top type has a nose part
            const noseKey = `${topType}_nose`;
            if (this.towerTops[elementKey][noseKey]) {
                this.towerTops[elementKey][noseKey].setMatrixAt(index, hiddenMatrix);
                this.towerTops[elementKey][noseKey].instanceMatrix.needsUpdate = true;
            }
        }
    }

    // Clean up resources
    dispose() {
        // Dispose of all instanced meshes and their materials
        for (const elementKey in this.towerBases) {
            this.towerBases[elementKey].dispose();
            this.towerFoundations[elementKey].dispose();

            for (const topType in this.towerTops[elementKey]) {
                this.towerTops[elementKey][topType].dispose();
            }
        }
    }

    reset() {
        console.log("Resetting TowerInstanceManager");

        // Reset instance counts
        for (const elementKey in this.instanceCount) {
            this.instanceCount[elementKey] = 0;

            // Reset base and foundation counts
            if (this.towerBases[elementKey]) {
                this.towerBases[elementKey].count = 0;
            }

            if (this.towerFoundations[elementKey]) {
                this.towerFoundations[elementKey].count = 0;
            }

            // Reset top counts for all types
            for (const topType in this.towerTops[elementKey]) {
                if (this.towerTops[elementKey][topType]) {
                    this.towerTops[elementKey][topType].count = 0;
                }
            }
        }

        // Reset available indices
        for (const elementKey in this.availableIndices) {
            this.availableIndices[elementKey] = Array.from(Array(this.maxInstancesPerType).keys());
        }

        // Move all instances far away to hide them
        const hiddenMatrix = new THREE.Matrix4();
        hiddenMatrix.setPosition(10000, 10000, 10000);

        for (const elementKey in this.towerBases) {
            // Initialize all base positions to be far away
            for (let i = 0; i < this.maxInstancesPerType; i++) {
                this.towerBases[elementKey].setMatrixAt(i, hiddenMatrix);
                this.towerFoundations[elementKey].setMatrixAt(i, hiddenMatrix);

                for (const topType in this.towerTops[elementKey]) {
                    this.towerTops[elementKey][topType].setMatrixAt(i, hiddenMatrix);

                    // Also hide nose meshes if they exist
                    if (this.towerTops[elementKey][`${topType}_nose`]) {
                        this.towerTops[elementKey][`${topType}_nose`].setMatrixAt(i, hiddenMatrix);
                    }
                }
            }

            // Update instance matrices
            this.towerBases[elementKey].instanceMatrix.needsUpdate = true;
            this.towerFoundations[elementKey].instanceMatrix.needsUpdate = true;

            for (const topType in this.towerTops[elementKey]) {
                this.towerTops[elementKey][topType].instanceMatrix.needsUpdate = true;

                if (this.towerTops[elementKey][`${topType}_nose`]) {
                    this.towerTops[elementKey][`${topType}_nose`].instanceMatrix.needsUpdate = true;
                }
            }
        }

        console.log("TowerInstanceManager reset complete");
    }
}