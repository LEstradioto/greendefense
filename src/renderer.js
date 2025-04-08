import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ElementTypes, ElementStyles } from './elements.js';
import { TowerInstanceManager } from './managers/TowerInstanceManager.js';
import { EnemyInstanceManager } from './managers/EnemyInstanceManager.js';

// Tower instance manager to handle instanced meshes
// Tower instance manager to handle instanced meshes
// Moved to src/managers/TowerInstanceManager.js

export class Renderer {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.game = game; // Store reference to game object
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(25, window.innerWidth / window.innerHeight, 0.1, 1000);

        // For performance optimizations
        this.distanceVector = new THREE.Vector3(); // Reusable vector for distance calculations

        // Shared matrices for animation to reduce object creation
        this._tempMatrix1 = new THREE.Matrix4();
        this._tempMatrix2 = new THREE.Matrix4();
        this._tempMatrix3 = new THREE.Matrix4();
        this._rotationMatrix = new THREE.Matrix4();
        this._scaleMatrix = new THREE.Matrix4();
        this._positionMatrix = new THREE.Matrix4();

        // Shared vectors
        this._tempVector1 = new THREE.Vector3();
        this._tempVector2 = new THREE.Vector3();
        this._tempVector3 = new THREE.Vector3();

        // Set up renderer with enhanced quality settings
        // Enable stencil buffer to prevent unwanted rendering artifacts with ground plane
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            powerPreference: 'high-performance',
            alpha: true,
            // preserveDrawingBuffer: true,
            // stencil: true // Enable stencil buffer
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000); // Black background

        // Enhanced shadow settings
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadow edges
        this.renderer.physicallyCorrectLights = true; // More accurate light attenuation
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        // Set specific renderer sorting parameters to help with transparent objects
        this.renderer.sortObjects = true; // Force manual sorting for transparent objects
        this.renderer.autoClear = false; // We'll handle clearing manually

        // Set up camera
        this.camera.position.set(0, 50, 40);
        this.camera.lookAt(0, 0, 0);

        // Adjust initial camera for mobile (zoom out and higher angle)
        if (window.innerWidth <= 768) {
            this.camera.position.set(0, 65, 55); // Further away (z: 40->55), higher angle (y: 50->65)
            this.camera.lookAt(0, 0, 0); // Ensure it still looks at the center
        }

        // Set up controls for camera movement
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.25;
        this.controls.maxPolarAngle = Math.PI / 2.5; // Limit camera angle

        // Set up zoom constraints and initial state
        this.controls.minDistance = 10;
        this.controls.maxDistance = 150;
        this.controls.enableDamping = true; // Smooth camera movement
        this.controls.dampingFactor = 0.05; // More fluid zooming
        this.isZoomedOut = false; // Track zoom state

        // Add a lower zoom threshold for a less abrupt transition
        this.zoomInThreshold = 80; // Threshold to consider "zoomed in" again
        this.zoomOutThreshold = 100; // Threshold to consider "zoomed out"

        // Add rotation tracking to prevent tower placement during rotation
        this.isRotating = false;
        this.lastControlsUpdate = Date.now();

        // Add event listeners to track when rotation starts and ends
        this.controls.addEventListener('start', () => {
            this.isRotating = true;
            this.lastControlsUpdate = Date.now();
            // console.log("Camera controls started");

            // Disable raycasting during rotation
            this.scene.traverse(obj => {
                if (obj.isMesh && !obj.userData.isGround) {
                    obj.userData.oldRaycast = obj.raycast;
                    obj.raycast = function() {}; // Empty raycast function
                }
            });
        });

        this.controls.addEventListener('end', () => {
            // End rotation state immediately - allows for quicker tower placement
            this.isRotating = false;
            // console.log("Camera controls ended");

            // Re-enable raycasting
            this.scene.traverse(obj => {
                if (obj.isMesh && obj.userData.oldRaycast) {
                    obj.raycast = obj.userData.oldRaycast;
                    delete obj.userData.oldRaycast;
                }
            });
        });

        // Also track control updates to detect rotation
        this.controls.addEventListener('change', () => {
            this.isRotating = true;
            this.lastControlsUpdate = Date.now();
        });

        // Set up lights
        this.setupLights();

        // Keep a reference to this for scope reasons
        this.canvasRef = canvas;

        // Create vibeverse portal HTML button (will be shown when zoomed out)
        this.createVibeVersePortal();

        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));

        // Materials cache for reuse
        this.materials = {
            // Create grass material with texture simulation
            ground: new THREE.MeshStandardMaterial({
                color: 0x2E8B57, // Sea green
                roughness: 0.8,
                metalness: 0.1
            }),
            path: new THREE.MeshStandardMaterial({
                color: 0x8B4513, // SaddleBrown - darker path
                roughness: 1.0,
                metalness: 0.0
            }),
            water: new THREE.MeshStandardMaterial({
                color: 0x1E90FF, // Dodger blue
                transparent: true,
                opacity: 0.8,
                roughness: 0.1,
                metalness: 0.3
            }),
            // Tower materials will be populated below based on elements/types
            towerBases: {},
            towerTops: {},
            towerFoundations: {},
            towerSpecial: {}, // For unique parts like cannon barrel, fire core

            // Enemy materials (assuming reuse is good here too)
            simpleEnemy: new THREE.MeshStandardMaterial({ color: 0xCCCCCC }), // Neutral default
            fireEnemy: new THREE.MeshStandardMaterial({ color: 0xFF7043, emissive: 0xE64A19, emissiveIntensity: 0.4 }),
            waterEnemy: new THREE.MeshStandardMaterial({ color: 0x4FC3F7, emissive: 0x29B6F6, emissiveIntensity: 0.4 }),
            earthEnemy: new THREE.MeshStandardMaterial({ color: 0xA1887F, emissive: 0x795548, emissiveIntensity: 0.4 }),
            airEnemy: new THREE.MeshStandardMaterial({ color: 0xE0E0E0, emissive: 0xBDBDBD, emissiveIntensity: 0.4 }), // Added missing 0x prefix
            shadowEnemy: new THREE.MeshStandardMaterial({ color: 0x7E57C2, emissive: 0x5E35B1, emissiveIntensity: 0.4 }),

            projectile: new THREE.MeshBasicMaterial({
                color: 0x76FF03, // Light green
            }),
            gridHighlight: new THREE.LineBasicMaterial({
                color: 0x4CAF50,
                transparent: true,
                opacity: 0.9,
                linewidth: 3
            }),
            grid: new THREE.LineBasicMaterial({
                color: 0x4CAF50,
                transparent: true,
                opacity: 0.3
            }),
            // Shadow plane material (reused for all towers)
            towerShadow: new THREE.MeshBasicMaterial({
                color: 0x000000,
                transparent: true,
                opacity: 0.25,
                depthWrite: false,
                polygonOffset: true,
                polygonOffsetFactor: -1,
                polygonOffsetUnits: -1
            }),
            // Glow material base (color set per tower)
            towerGlow: new THREE.MeshBasicMaterial({
                // Color will be set dynamically, but other props are shared
                transparent: true,
                opacity: 0.3,
                side: THREE.BackSide,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        };

        // Geometries cache for reuse
        this.geometries = {
            // Tower Geometries
            towerBase: new THREE.CylinderGeometry(0.4, 0.5, 0.6, 8),
            towerFoundation: new THREE.CylinderGeometry(0.55, 0.6, 0.1, 8),
            towerShadow: new THREE.ShapeGeometry(new THREE.Shape().moveTo(0, 0).absarc(0, 0, 0.5, 0, Math.PI * 2, false)), // 1.0 diameter -> 0.5 radius
            towerGlow: new THREE.SphereGeometry(0.9, 16, 16),

            // Fire Tower Specific
            fireBasicTop: new THREE.ConeGeometry(0.35, 0.7, 8),
            fireAdvancedCore: new THREE.ConeGeometry(0.15, 0.4, 8),

            // Water Tower Specific
            waterBasicTop: new THREE.SphereGeometry(0.35, 12, 12),
            // Tube geometry depends on curve, cannot easily pre-cache here if curve changes.
            // Will create TubeGeometry dynamically for now. Consider optimizing later if needed.

            // Earth Tower Specific
            earthBasicTop: new THREE.DodecahedronGeometry(0.35, 0),
            earthAdvancedRock: new THREE.DodecahedronGeometry(0.15, 0),

            // Air Tower Specific
            airOrb: new THREE.SphereGeometry(0.25, 12, 12),
            airRing: new THREE.TorusGeometry(0.3, 0.05, 8, 24),

            // Shadow Tower Specific
            shadowBasicTop: new THREE.OctahedronGeometry(0.3, 0),
            shadowAdvancedVoid: new THREE.SphereGeometry(0.4, 12, 12),

            // Standard Tower Specific
            arrowTopBase: new THREE.ConeGeometry(0.3, 0.6, 8),
            arrowNose: new THREE.ConeGeometry(0.15, 0.5, 8),
            doubleArrowTopCone: new THREE.ConeGeometry(0.25, 0.5, 8),
            doubleArrowNose: new THREE.ConeGeometry(0.12, 0.4, 8),
            cannonTopSphere: new THREE.SphereGeometry(0.35, 12, 12),
            cannonBarrel: new THREE.CylinderGeometry(0.2, 0.2, 0.6, 12),
            defaultTop: new THREE.BoxGeometry(0.4, 0.4, 0.4),

            // Projectile Geometry
            projectileSphere: new THREE.SphereGeometry(0.1, 8, 8),

            // Enemy Geometries (Example - adjust complexity as needed)
            enemyBasic: new THREE.BoxGeometry(0.6, 0.6, 0.6), // Simple cube for basic enemies
            enemySphere: new THREE.SphereGeometry(0.4, 8, 8), // Sphere for others
            enemyCone: new THREE.ConeGeometry(0.4, 0.8, 8), // Cone for bosses?
        };

        // Populate tower materials based on ElementStyles
        for (const element in ElementStyles) {
            const style = ElementStyles[element];
            this.materials.towerBases[element] = new THREE.MeshStandardMaterial({
                color: style.color,
                roughness: 0.5,
                metalness: 0.7,
                emissive: style.emissive,
                emissiveIntensity: 0.3
            });
            this.materials.towerTops[element] = new THREE.MeshStandardMaterial({
                color: style.color,
                roughness: 0.4,
                metalness: 0.8,
                emissive: style.emissive,
                emissiveIntensity: 0.5
            });
            // Foundation uses a clone to allow polygon offset without affecting base
            this.materials.towerFoundations[element] = new THREE.MeshStandardMaterial({
                 color: style.color,
                 roughness: 0.5,
                 metalness: 0.7,
                 emissive: style.emissive,
                 emissiveIntensity: 0.3,
                 polygonOffset: true,
                 polygonOffsetFactor: 1,
                 polygonOffsetUnits: 1
             });
        }
        // Add neutral materials explicitly if not in ElementStyles
        if (!this.materials.towerBases[ElementTypes.NEUTRAL]) {
            const neutralColor = 0x388E3C; // Default green from original code
            const neutralEmissive = 0x2E7D32;
            this.materials.towerBases[ElementTypes.NEUTRAL] = new THREE.MeshStandardMaterial({
                color: neutralColor, roughness: 0.5, metalness: 0.7, emissive: neutralEmissive, emissiveIntensity: 0.3
            });
            this.materials.towerTops[ElementTypes.NEUTRAL] = new THREE.MeshStandardMaterial({
                color: neutralColor, roughness: 0.4, metalness: 0.8, emissive: neutralEmissive, emissiveIntensity: 0.5
            });
            this.materials.towerFoundations[ElementTypes.NEUTRAL] = new THREE.MeshStandardMaterial({
                 color: neutralColor, roughness: 0.5, metalness: 0.7, emissive: neutralEmissive, emissiveIntensity: 0.3,
                 polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
             });
        }

        // Specific materials for unique parts
        this.materials.towerSpecial['fireAdvancedCore'] = new THREE.MeshStandardMaterial({
            color: 0xFF9800, emissive: 0xFF5722, emissiveIntensity: 0.8
        });
        this.materials.towerSpecial['waterAdvancedTube'] = new THREE.MeshStandardMaterial({
            color: 0x4FC3F7, transparent: true, opacity: 0.8
        });
         this.materials.towerSpecial['airOrb'] = new THREE.MeshStandardMaterial({
            color: 0xECEFF1, transparent: true, opacity: 0.8, emissive: 0xCFD8DC, emissiveIntensity: 0.5
        });
         this.materials.towerSpecial['airRing'] = new THREE.MeshStandardMaterial({
            color: 0xB0BEC5, transparent: true, opacity: 0.7
        });
        this.materials.towerSpecial['shadowCore'] = new THREE.MeshStandardMaterial({
             color: 0x4A148C, emissive: 0x311B92, emissiveIntensity: 0.7
        });
        this.materials.towerSpecial['shadowAdvancedVoid'] = new THREE.MeshBasicMaterial({
             color: 0x7E57C2, transparent: true, opacity: 0.3, side: THREE.BackSide
        });
        this.materials.towerSpecial['cannonBarrel'] = new THREE.MeshStandardMaterial({
            color: 0x212121, roughness: 0.3, metalness: 0.9
        });

        // Create helper objects
        this.gridHelper = new THREE.GridHelper(25, 25);
        this.gridHelper.position.y = 0.01; // Slight offset to prevent z-fighting
        this.gridHelper.visible = false; // Hidden by default (debug mode)
        this.scene.add(this.gridHelper);

        // Tower placement preview mesh
        this.previewMesh = null;

        // Create a different style of grid highlighter that won't cause shading issues
        // Instead of a flat plane, we'll use a wireframe square outline
        const highlightGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.05, 0.01, 1.05));
        const highlightMaterial = new THREE.LineBasicMaterial({
            color: 0x4CAF50,
            linewidth: 3,
            transparent: true,
            opacity: 0.9,
        });

        this.gridHighlight = new THREE.LineSegments(highlightGeometry, highlightMaterial);
        this.gridHighlight.position.y = 0.01; // Just above ground
        this.gridHighlight.visible = false;
        this.gridHighlight.renderOrder = 100; // Very high render order to ensure it's on top
        this.scene.add(this.gridHighlight);

        // Tower instances tracking
        this.towerInstances = [];
        this.nextShadowIndex = 0;

        // Initialize after materials and geometries are set up
        // After all materials and geometries are defined, initialize the tower instance manager
        this.towerManager = new TowerInstanceManager(this);

        // Initialize enemy instance manager
        this.enemyManager = new EnemyInstanceManager(this);

        // Initialize performance optimizations
        this.quality = 'normal';
        this._frameCount = 0;
        this.frustum = new THREE.Frustum();
        this.particleSystems = [];

        // Keep a reference to the game instance
        this.game = game;
    }

    setupLights() {
        // Create a more dramatic lighting setup for better shadows

        // Very low ambient light - for stronger shadows
        const ambientLight = new THREE.AmbientLight(0xc0ffc0, 0.2); // Reduced intensity for stronger shadows
        this.scene.add(ambientLight);

        // Main directional light (sunlight) with very strong intensity
        const directionalLight = new THREE.DirectionalLight(0xfffaf0, 1.5); // Higher intensity
        directionalLight.position.set(15, 40, 15); // Higher and more angled for longer shadows
        directionalLight.castShadow = true;

        // Optimize shadow properties for better performance
        directionalLight.shadow.mapSize.width = 512; // Reduced from 1024 for better performance
        directionalLight.shadow.mapSize.height = 512; // Reduced from 1024 for better performance
        directionalLight.shadow.camera.near = 1;
        directionalLight.shadow.camera.far = 60; // Reduced from 80 - still covers the scene
        directionalLight.shadow.camera.left = -20; // Smaller shadow camera frustum
        directionalLight.shadow.camera.right = 20;
        directionalLight.shadow.camera.top = 20;
        directionalLight.shadow.camera.bottom = -20;

        // Optimize shadow quality and bias for performance
        directionalLight.shadow.bias = -0.001; // Slightly increased to reduce artifacts with fewer samples
        directionalLight.shadow.normalBias = 0.01;
        if (directionalLight.shadow.darkness !== undefined) {
            directionalLight.shadow.darkness = 0.8;
        }

        // Make shadows update less frequently if FPS gets low
        if (this.game && this.game.fpsCounter && this.game.fpsCounter.value < 30) {
            directionalLight.shadow.autoUpdate = false;
            // Update manually at a lower frequency
            setInterval(() => {
                directionalLight.shadow.needsUpdate = true;
            }, 500); // Update shadow map every 500ms instead of every frame
        }

        this.scene.add(directionalLight);

        // Store for debugging purposes
        this.mainLight = directionalLight;

        // Add a helper to visualize the light (only in debug mode)
        const helper = new THREE.CameraHelper(directionalLight.shadow.camera);
        helper.visible = false;
        this.scene.add(helper);
        this.shadowHelper = helper;

        // Add a secondary fill light from the opposite side (cooler tone)
        const fillLight = new THREE.DirectionalLight(0xc0e0ff, 0.4);
        fillLight.position.set(-15, 20, -15);
        // Don't add shadows for fill light (simplifies shadow rendering)
        this.scene.add(fillLight);
    }

    // Helper method to get distance from camera to a position
    getDistanceToCamera(position) {
        this.distanceVector.copy(position).sub(this.camera.position);
        return this.distanceVector.length();
    }

    // Set the quality level of the renderer
    setQualityLevel(level) {
        // Convert numeric levels if needed (for backward compatibility)
        let qualityLevel = level;
        if (typeof level === 'number') {
            switch(level) {
                case 0: qualityLevel = 'critical'; break;
                case 1: qualityLevel = 'low'; break;
                default: qualityLevel = 'normal'; break;
            }
        }

        // Store current quality level
        this.quality = qualityLevel;

        // Adjust renderer settings based on quality level
        switch(qualityLevel) {
            case 'critical':
                // Critical performance mode - minimize everything
                this.renderer.setPixelRatio(window.devicePixelRatio * 0.5);
                this.renderer.shadowMap.enabled = false;

                // Disable post-processing if any
                if (this.composer) {
                    this.composer.enabled = false;
                }

                // Switch all materials to basic materials to save performance
                this.scene.traverse(object => {
                    if (object.isMesh && object.material) {
                        // Skip if already basic or has userData flag
                        if (object.userData.preserveMaterial ||
                            object.material instanceof THREE.MeshBasicMaterial) {
                            return;
                        }

                        // Store original material for later restoration
                        if (!object.userData.originalMaterial) {
                            object.userData.originalMaterial = object.material;
                        }

                        // Create basic material that approximates the original
                        const color = object.material.color ?
                            object.material.color.clone() :
                            new THREE.Color(0xCCCCCC);

                        object.material = new THREE.MeshBasicMaterial({
                            color: color,
                            transparent: object.material.transparent,
                            opacity: object.material.opacity,
                            wireframe: false,
                            side: object.material.side
                        });
                    }
                });
                break;

            case 'low':
                // Low quality mode - reduce settings
                this.renderer.setPixelRatio(window.devicePixelRatio * 0.75);
                this.renderer.shadowMap.enabled = true;
                this.renderer.shadowMap.type = THREE.BasicShadowMap;

                // Simplified shadows and limited effects
                if (this.composer) {
                    this.composer.enabled = true;
                    // Disable expensive effects if any
                }

                // Restore materials if coming from critical mode
                this.scene.traverse(object => {
                    if (object.isMesh && object.userData.originalMaterial &&
                        !(object.material instanceof THREE.MeshStandardMaterial)) {
                        object.material = object.userData.originalMaterial;
                    }
                });
                break;

            case 'normal':
            default:
                // Normal quality - full features
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.renderer.shadowMap.enabled = true;
                this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

                // Enable post-processing if any
                if (this.composer) {
                    this.composer.enabled = true;
                }

                // Restore all original materials
                this.scene.traverse(object => {
                    if (object.isMesh && object.userData.originalMaterial) {
                        object.material = object.userData.originalMaterial;
                        // No need to keep reference anymore
                        delete object.userData.originalMaterial;
                    }
                });
                break;
        }
    }

    render(game) {
        // Update camera controls
        this.controls.update();

        // Update rotation state - if it's been more than 50ms since a control update,
        // we can consider the rotation to have stopped (much more responsive)
        if (this.isRotating && (Date.now() - this.lastControlsUpdate > 50)) {
            this.isRotating = false;
        }

        // Check camera distance for zoom level
        const cameraDistance = this.camera.position.distanceTo(new THREE.Vector3(0, 0, 0));

        // Use different thresholds for zooming in and out to create hysteresis
        // This prevents rapid toggling of the portal button when at the threshold
        const wasZoomedOut = this.isZoomedOut;

        if (wasZoomedOut) {
            // When already zoomed out, require moving closer to zoom back in
            this.isZoomedOut = cameraDistance > this.zoomInThreshold;
        } else {
            // When zoomed in, require moving farther to trigger zoom out
            this.isZoomedOut = cameraDistance > this.zoomOutThreshold;
        }

        // Handle HTML portal button visibility based on zoom state
        if (!wasZoomedOut && this.isZoomedOut) {
            // Just zoomed out, show the HTML button
            this.showPortalButton();
        } else if (wasZoomedOut && !this.isZoomedOut) {
            // Just zoomed in, hide the HTML button
            this.hidePortalButton();
        }

        // Toggle debug helpers
        this.gridHelper.visible = game.debugMode;

        // Toggle shadow camera helper in debug mode
        if (this.shadowHelper) {
            this.shadowHelper.visible = game.debugMode;
        }

        // Get current time
        const currentTime = performance.now() / 1000; // Convert to seconds for easier animation timing

        // Update frustum for culling every few frames to improve performance
        this._frameCount++;
        if (this._frameCount % 5 === 0) { // Only recalculate every 5 frames
            this.camera.updateMatrixWorld(); // Ensure matrix is updated
            const projScreenMatrix = new THREE.Matrix4();
            projScreenMatrix.multiplyMatrices(
                this.camera.projectionMatrix,
                this.camera.matrixWorldInverse
            );
            this.frustum.setFromProjectionMatrix(projScreenMatrix);
        }

        // Update LOD for towers based on camera distance
        this.updateTowerLOD();

        // Animate tower glows and particles with frustum culling
        this.towerInstances.forEach(towerInstance => {
            // Skip animation updates for off-screen towers
            if (towerInstance.position) {
                // Create a bounding sphere for culling test (reuse object to reduce garbage)
                const boundingSphere = new THREE.Sphere(
                    new THREE.Vector3(towerInstance.position.x, towerInstance.position.y, towerInstance.position.z),
                    2.0 // Radius large enough to cover the tower
                );

                // Skip if not in view frustum
                if (!this.frustum.intersectsSphere(boundingSphere)) {
                    return;
                }
            }

            if (towerInstance.topGroup) {
                // Find the glow and particles in the tower top group
                towerInstance.topGroup.traverse(child => {
                    // Animate glow effect
                    if (child.isMesh && child.material && child.material.side === THREE.BackSide) {
                        // Pulse the glow
                        const pulseSpeed = 2; // Pulse 2 times per second
                        const pulseAmount = 0.2; // Amount to pulse by
                        const baseOpacity = 0.3;

                        // Calculate pulsing opacity
                        child.material.opacity = baseOpacity + pulseAmount * Math.sin(currentTime * pulseSpeed * Math.PI);

                        // If tower is empowered, make glow stronger
                        if (towerInstance.tower && towerInstance.tower.empowered) {
                            child.material.opacity += 0.2;
                            child.scale.set(1.2, 1.2, 1.2);
                        } else {
                            child.scale.set(1, 1, 1);
                        }
                    }

                    // Animate particle effects
                    if (child.isPoints) {
                        // Rotate particles around the tower
                        const particlePhase = towerInstance.topGroup.userData.particleAnimationPhase || 0;
                        const positions = child.geometry.attributes.position.array;
                        const particleCount = positions.length / 3;

                        for (let i = 0; i < particleCount; i++) {
                            const i3 = i * 3;
                            const radius = 0.6 + 0.2 * Math.sin(currentTime + i * 0.5);
                            const angle = currentTime * 0.5 + particlePhase + i * (Math.PI * 2 / particleCount);

                            positions[i3] = radius * Math.cos(angle);
                            positions[i3 + 2] = radius * Math.sin(angle);

                            // Make particles float up and down slightly
                            positions[i3 + 1] = 0.5 + 0.2 * Math.sin(currentTime * 2 + i);
                        }

                        child.geometry.attributes.position.needsUpdate = true;
                    }
                });
            }
        });

        // Animate projectile trails with culling
        game.projectiles.forEach(projectile => {
            // Skip animation for off-screen projectiles
            if (projectile.position) {
                // Create a bounding sphere for the projectile
                const boundingSphere = new THREE.Sphere(
                    new THREE.Vector3(projectile.position.x, projectile.position.y, projectile.position.z),
                    1.0 // Radius for the projectile
                );

                // Skip if not in view frustum
                if (!this.frustum.intersectsSphere(boundingSphere)) {
                    return;
                }
            }

            // First update the shadow projector if it exists
            if (projectile.mesh && projectile.mesh.userData.shadowProjector) {
                const shadowPlane = projectile.mesh.userData.shadowProjector;
                const currentPos = projectile.mesh.position;

                // Project the shadow onto the ground
                shadowPlane.position.x = currentPos.x;
                shadowPlane.position.y = 0.01; // Just above ground
                shadowPlane.position.z = currentPos.z;

                // Scale shadow based on height (further = smaller shadow)
                const distance = Math.max(0.5, currentPos.y);
                const scale = 0.3 + (0.7 / distance); // Inverse scale with height
                shadowPlane.scale.set(scale, scale, 1);

                // Fade shadow with height
                const opacity = Math.min(0.5, 0.5 / distance);
                shadowPlane.material.opacity = opacity;
            }

            // Additional projectile trail optimizations
            if (this.quality === 'low' || this.quality === 'critical') {
                // Skip trails completely for low quality modes
                return;
            }

            // Then update particles if they exist and we're in normal quality mode
            if (projectile.mesh && projectile.mesh.userData.particles) {
                const particles = projectile.mesh.userData.particles;
                const positions = particles.geometry.attributes.position.array;
                const particleCount = positions.length / 3;
                const particleAges = projectile.mesh.userData.particleAge;
                const maxAge = projectile.mesh.userData.particleMaxAge;
                const lastPos = projectile.mesh.userData.lastPosition;
                const currentPos = projectile.mesh.position;

                // Calculate delta time (assume ~60fps for simplicity)
                const deltaTime = 1/60;

                // Update each particle
                for (let i = 0; i < particleCount; i++) {
                    const i3 = i * 3;

                    // Age the particle
                    particleAges[i] += deltaTime;

                    // If particle is too old, reset it to current position with a small random offset
                    if (particleAges[i] > maxAge) {
                        positions[i3] = (Math.random() - 0.5) * 0.1;
                        positions[i3 + 1] = (Math.random() - 0.5) * 0.1;
                        positions[i3 + 2] = (Math.random() - 0.5) * 0.1;
                        particleAges[i] = 0;
                    }
                }

                // Update last position
                projectile.mesh.userData.lastPosition = {
                    x: currentPos.x,
                    y: currentPos.y,
                    z: currentPos.z
                };

                // Update geometry
                particles.geometry.attributes.position.needsUpdate = true;
            }
        });

        // Animate enemies
        game.enemies.forEach(enemy => {
            if (enemy.mesh) {
                // Basic animation based on enemy type
                const baseType = enemy.type.split('_').pop();
                switch (baseType) {
                    case 'simple':
                        // Simple enemies wobble
                        enemy.mesh.rotation.x = 0.2 * Math.sin(currentTime * 2);
                        enemy.mesh.rotation.z = 0.2 * Math.cos(currentTime * 2);
                        break;
                    case 'elephant':
                        // Elephants sway
                        enemy.mesh.rotation.y = 0.1 * Math.sin(currentTime);
                        break;
                    case 'pirate':
                        // Pirates spin slowly
                        enemy.mesh.rotation.y += 0.01;
                        break;
                    case 'golem':
                        // Golems pulse
                        const scale = 1 + 0.05 * Math.sin(currentTime * 1.5);
                        enemy.mesh.scale.set(scale, scale, scale);
                        break;
                }

                // Animate elemental particles if present
                if (enemy.mesh.userData.elementParticles) {
                    const particles = enemy.mesh.userData.elementParticles;
                    const positions = particles.geometry.attributes.position.array;
                    const particleCount = positions.length / 3;

                    for (let i = 0; i < particleCount; i++) {
                        const i3 = i * 3;
                        const angle = (currentTime + i) * 2;
                        const radius = 0.4 + 0.1 * Math.sin(currentTime * 3 + i);

                        // Update particle positions based on element type
                        switch (enemy.mesh.userData.elementType) {
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

                    particles.geometry.attributes.position.needsUpdate = true;
                }

                // Enemies with status effects get visual indicators
                if (enemy.statusEffects && enemy.statusEffects.length > 0) {
                    // If enemy doesn't have an effect indicator, create one
                    if (!enemy.mesh.userData.effectIndicator) {
                        // Create effect indicator based on first status effect
                        const effect = enemy.statusEffects[0];
                        let effectColor = 0xFFFFFF;

                        // Choose color based on effect type
                        if (effect.type === 'burn') effectColor = 0xFF5722;
                        else if (effect.type === 'slow') effectColor = 0x2196F3;
                        else if (effect.type === 'weaken') effectColor = 0x9C27B0;

                        // Create glow effect
                        const effectGeometry = new THREE.SphereGeometry(0.4, 12, 12);
                        const effectMaterial = new THREE.MeshBasicMaterial({
                            color: effectColor,
                            transparent: true,
                            opacity: 0.3,
                            side: THREE.BackSide,
                            blending: THREE.AdditiveBlending
                        });

                        const effectMesh = new THREE.Mesh(effectGeometry, effectMaterial);
                        enemy.mesh.add(effectMesh);
                        enemy.mesh.userData.effectIndicator = effectMesh;
                    }

                    // Pulse the effect indicator
                    const effectIndicator = enemy.mesh.userData.effectIndicator;
                    if (effectIndicator) {
                        const pulseAmount = 0.2;
                        effectIndicator.material.opacity = 0.3 + pulseAmount * Math.sin(currentTime * 4);
                    }
                } else if (enemy.mesh.userData.effectIndicator) {
                    // Remove effect indicator if no active effects
                    enemy.mesh.remove(enemy.mesh.userData.effectIndicator);
                    enemy.mesh.userData.effectIndicator = null;
                }
            }
        });

        // Animate map glow effects
        if (game.map && game.map.mapGroup && game.map.mapGroup.userData.glowLayer) {
            const glowLayer = game.map.mapGroup.userData.glowLayer;

            // More pronounced pulsing for the ground glow
            const pulseAmount = 0.05;
            const pulseSpeed = 0.3; // Slightly faster pulse
            glowLayer.material.opacity = 0.12 + pulseAmount * Math.sin(currentTime * pulseSpeed);

            // Also pulse the color slightly to enhance the effect
            const hue = 0.35 + 0.02 * Math.sin(currentTime * pulseSpeed * 0.7); // Subtle hue shift around green
            glowLayer.material.color.setHSL(hue, 0.8, 0.6);
        }

        // Adjust any dynamic shadow parameters
        if (this.mainLight && this.mainLight.shadow) {
            // Keep shadows strong and crisp
            this.mainLight.shadow.bias = -0.0001;

            // Optional: adjust shadow strength dynamically
            const shadowStrength = 0.8; // Higher values = stronger shadows (0-1)
            if (this.mainLight.shadow.darkness !== undefined) { // Some THREE.js versions use this
                this.mainLight.shadow.darkness = shadowStrength;
            }
        }

        // Custom render process with stencil buffer to fix ground rendering issues

        // 1. Clear everything
        this.renderer.clear(true, true, true);

        // 2. First pass: render only the ground to set up stencil buffer
        // Find the ground objects
        let groundObjects = [];
        if (game.map && game.map.mapGroup) {
            if (game.map.mapGroup.userData.ground) {
                groundObjects.push(game.map.mapGroup.userData.ground);
            }
            if (game.map.mapGroup.userData.bottomCover) {
                groundObjects.push(game.map.mapGroup.userData.bottomCover);
            }
        }

        // Set visibility for ground-only pass
        const originalVisibility = new Map();
        this.scene.traverse(obj => {
            if (obj.isMesh && !groundObjects.includes(obj)) {
                originalVisibility.set(obj, obj.visible);
                obj.visible = false;
            }
        });

        // Render only ground objects to set up stencil
        this.renderer.render(this.scene, this.camera);

        // 3. Restore visibility for all objects
        originalVisibility.forEach((visible, obj) => {
            obj.visible = visible;
        });

        // 4. Final pass: render the entire scene
        this.renderer.render(this.scene, this.camera);
    }

    createMap(mapData, gridSize) {
        const mapGroup = new THREE.Group();

        // Create a single seamless ground plane - no segments to avoid the middle line
        const groundGeometry = new THREE.PlaneGeometry(gridSize.width, gridSize.height, 1, 1); // Use just 1 segment

        // Create a composite ground solution to solve rendering issues

        // First layer: Main ground with standard material
        // Using special material properties to work with our stencil buffer
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a6b30, // Darker green (adjusted to be less bright)
            roughness: 1.0,  // Maximum roughness for shadow visibility
            metalness: 0.0,  // No metalness
            emissive: 0x0, // No emissive
            emissiveIntensity: 0, // No emissive glow
            side: THREE.DoubleSide, // Render BOTH sides to prevent one-sided visibility issues
            depthWrite: true, // Ensure proper depth writing
            polygonOffset: true, // Enable polygon offset
            polygonOffsetFactor: -1, // Pull ground towards camera slightly
            polygonOffsetUnits: -1, // This helps prevent z-fighting with explosion effects
            stencilWrite: true, // Enable stencil buffer writing
            stencilRef: 1, // Set stencil reference value
            stencilFunc: THREE.AlwaysStencilFunc, // Always write to stencil buffer
            stencilZPass: THREE.ReplaceStencilOp // Replace stencil value on z-pass
        });

        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2; // Rotate to horizontal
        ground.position.y = 0; // EXACTLY at zero - critical for proper shading
        ground.receiveShadow = true; // Make ground receive shadows
        ground.userData.isGround = true; // Mark as ground for raycasting

        // Second layer: Invisible collision plane to ensure projectiles don't go through ground
        // This helps prevent the backface visibility issue during explosions
        const collisionPlaneGeometry = new THREE.PlaneGeometry(gridSize.width + 2, gridSize.height + 2, 1, 1);
        const collisionPlaneMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.0,
            side: THREE.DoubleSide,
            depthWrite: true
        });

        const collisionPlane = new THREE.Mesh(collisionPlaneGeometry, collisionPlaneMaterial);
        collisionPlane.rotation.x = -Math.PI / 2;
        collisionPlane.position.y = -0.01; // Slightly below ground to prevent z-fighting
        collisionPlane.userData.isGroundCollider = true;

        // Third layer: Bottom cover to prevent seeing "through" the ground
        // This solves the issue of seeing through the ground during explosions
        const bottomCoverGeometry = new THREE.PlaneGeometry(gridSize.width + 4, gridSize.height + 4, 1, 1);
        const bottomCoverMaterial = new THREE.MeshBasicMaterial({
            color: 0x0a2212, // Even darker version of the ground color
            side: THREE.FrontSide,
            depthWrite: true,
            transparent: false, // Not transparent
            polygonOffset: true, // Enable polygon offset
            polygonOffsetFactor: -2, // Higher offset than ground
            polygonOffsetUnits: -2,
            stencilWrite: true, // Enable stencil buffer writing
            stencilRef: 2, // Different stencil reference value
            stencilFunc: THREE.AlwaysStencilFunc,
            stencilZPass: THREE.ReplaceStencilOp
        });

        const bottomCover = new THREE.Mesh(bottomCoverGeometry, bottomCoverMaterial);
        bottomCover.rotation.x = Math.PI / 2; // Facing UPWARD from below
        bottomCover.position.y = -0.05; // Below the ground

        // Add all layers to the mapGroup
        mapGroup.add(ground);
        mapGroup.add(collisionPlane);
        mapGroup.add(bottomCover);

        // Store references for easy access
        mapGroup.userData.ground = ground;
        mapGroup.userData.collisionPlane = collisionPlane;
        mapGroup.userData.bottomCover = bottomCover;

        // Add a subtle green glow layer above the ground, very faint to not interfere with shadows
        const glowGeometry = new THREE.PlaneGeometry(gridSize.width, gridSize.height);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x2ABF68, // Less bright mint green color
            transparent: true,
            opacity: 0.03, // Reduced opacity to be more subtle
            blending: THREE.AdditiveBlending
        });

        const glowLayer = new THREE.Mesh(glowGeometry, glowMaterial);
        glowLayer.rotation.x = -Math.PI / 2; // Rotate to horizontal
        glowLayer.position.y = 0.05; // Higher above ground to avoid interference
        glowLayer.renderOrder = 1; // Ensure it renders after the ground
        mapGroup.add(glowLayer);

        // Store reference for animation
        mapGroup.userData.glowLayer = glowLayer;

        // Create a dark gray overlay for the play area
        const playAreaGeometry = new THREE.PlaneGeometry(gridSize.width, gridSize.height);
        const playAreaMaterial = new THREE.MeshBasicMaterial({
            color: 0x222222, // Dark gray
            transparent: true,
            opacity: 0.3,    // Lighter overlay to allow shadows to be visible
            side: THREE.DoubleSide,
            depthWrite: false // Don't write to depth buffer - important for shadow visibility
        });

        const playArea = new THREE.Mesh(playAreaGeometry, playAreaMaterial);
        playArea.rotation.x = -Math.PI / 2; // Rotate to horizontal
        playArea.position.y = 0.1; // Higher above ground to prevent z-fighting
        playArea.renderOrder = 2; // Ensure proper rendering order
        mapGroup.add(playArea);

        // Create a neon green border around the play area
        const borderGroup = new THREE.Group();
        mapGroup.userData.gridLines = borderGroup; // Store for style updates

        // Border line parameters
        const borderColor = 0x1aff6e; // Bright neon green
        const borderOpacity = 0.7;    // Very visible
        const borderWidth = 3;        // Thicker for visibility

        // Create border lines for each edge
        const edges = [
            // Bottom edge
            [
                new THREE.Vector3(-gridSize.width/2, 0.06, -gridSize.height/2),
                new THREE.Vector3(gridSize.width/2, 0.06, -gridSize.height/2)
            ],
            // Right edge
            [
                new THREE.Vector3(gridSize.width/2, 0.06, -gridSize.height/2),
                new THREE.Vector3(gridSize.width/2, 0.06, gridSize.height/2)
            ],
            // Top edge
            [
                new THREE.Vector3(gridSize.width/2, 0.06, gridSize.height/2),
                new THREE.Vector3(-gridSize.width/2, 0.06, gridSize.height/2)
            ],
            // Left edge
            [
                new THREE.Vector3(-gridSize.width/2, 0.06, gridSize.height/2),
                new THREE.Vector3(-gridSize.width/2, 0.06, -gridSize.height/2)
            ]
        ];

        // Create all border lines
        edges.forEach(points => {
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
            const lineMaterial = new THREE.LineBasicMaterial({
                color: borderColor,
                transparent: true,
                opacity: borderOpacity,
                linewidth: borderWidth // Note: linewidth has limited browser support
            });

            const line = new THREE.Line(lineGeometry, lineMaterial);
            borderGroup.add(line);
        });

        mapGroup.add(borderGroup);

        // Create a glow effect for the border
        const borderGlowGeometry = new THREE.PlaneGeometry(gridSize.width + 0.2, gridSize.height + 0.2);
        const borderGlowMaterial = new THREE.MeshBasicMaterial({
            color: borderColor,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide
        });

        const borderGlow = new THREE.Mesh(borderGlowGeometry, borderGlowMaterial);
        borderGlow.rotation.x = -Math.PI / 2; // Rotate to horizontal
        borderGlow.position.y = 0.04; // Just below the border lines
        mapGroup.userData.borderGlow = borderGlow;
        mapGroup.add(borderGlow);

        // Store style properties for border effect modification
        mapGroup.userData.gridStyleProperties = {
            defaultColor: borderColor,
            defaultOpacity: borderOpacity,
            currentStyle: 'default',
            brightness: 0.7
        };

        // This material definition is unused now that we're using strips

        // Only create special indicator tiles for entry, exit and restricted areas
        // Create horizontal strips for entry and exit points instead of individual tiles

        // Entry strip (top)
        const entryMaterial = new THREE.MeshStandardMaterial({
            color: 0x4169E1, // Royal Blue
            transparent: true,
            opacity: 0.3,
            roughness: 0.7,
            metalness: 0.1
        });

        // Create a single horizontal strip for the entry area
        const entryStripGeometry = new THREE.BoxGeometry(gridSize.width, 0.05, 1);
        const entryStrip = new THREE.Mesh(entryStripGeometry, entryMaterial);
        entryStrip.position.set(
            0, // Centered horizontally
            0.03, // Very close to ground
            -gridSize.height / 2 + 0.5 // Top of the grid
        );
        entryStrip.receiveShadow = true;
        mapGroup.add(entryStrip);

        // Exit strip (bottom)
        const exitMaterial = new THREE.MeshStandardMaterial({
            color: 0x9932CC, // Dark Orchid
            transparent: true,
            opacity: 0.3,
            roughness: 0.7,
            metalness: 0.1
        });

        // Create a single horizontal strip for the exit area
        const exitStripGeometry = new THREE.BoxGeometry(gridSize.width, 0.05, 1);
        const exitStrip = new THREE.Mesh(exitStripGeometry, exitMaterial);
        exitStrip.position.set(
            0, // Centered horizontally
            0.03, // Very close to ground
            gridSize.height / 2 - 0.5 // Bottom of the grid
        );
        exitStrip.receiveShadow = true;
        mapGroup.add(exitStrip);

        // Restricted area - create a strip for each row in the restricted zone instead of individual tiles
        const restrictedZoneMaterial = new THREE.MeshStandardMaterial({
            color: 0xFF6347, // Tomato red
            transparent: true,
            opacity: 0.25, // More subtle
            roughness: 0.7,
            metalness: 0.1
        });

        // Create strips for each row in the restricted area (last 3 rows before the bottom)
        for (let i = 1; i <= 3; i++) {
            const restrictedStripGeometry = new THREE.BoxGeometry(gridSize.width, 0.05, 1);
            const restrictedStrip = new THREE.Mesh(restrictedStripGeometry, restrictedZoneMaterial);
            restrictedStrip.position.set(
                0, // Centered horizontally
                0.03, // Very close to ground
                gridSize.height / 2 - 0.5 - i // Position from bottom (skipping bottom row which is exit)
            );
            restrictedStrip.receiveShadow = true;
            mapGroup.add(restrictedStrip);
        }

        this.scene.add(mapGroup);
        return mapGroup;
    }

    createEnemy(enemy) {
        // Use our new enemy manager to create the enemy
        return this.enemyManager.createEnemy(enemy);
    }

    removeEnemy(enemy) {
        // If the enemy has an enemyInstance, use that to remove it
        if (enemy.enemyInstance) {
            this.enemyManager.removeEnemy(enemy.enemyInstance);
            enemy.enemyInstance = null;
            return;
        }

        // Fallback to old method for any existing enemies
        if (enemy.mesh) {
            // Remove mesh from scene
            this.scene.remove(enemy.mesh);

            // Properly dispose of all geometries and materials
            if (enemy.mesh.geometry) {
                enemy.mesh.geometry.dispose();
            }

            if (enemy.mesh.material) {
                if (Array.isArray(enemy.mesh.material)) {
                    enemy.mesh.material.forEach(m => m.dispose());
                } else {
                    enemy.mesh.material.dispose();
                }
            }

            // Clean up any child meshes
            if (enemy.mesh.children) {
                enemy.mesh.children.forEach(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
            }

            // Remove reference
            enemy.mesh = null;
        }

        // Also remove any health bars
        if (enemy.healthBar && enemy.healthBar.group) {
            this.scene.remove(enemy.healthBar.group);
            enemy.healthBar = null;
        }
    }

    updateHealth(entity, healthPercent) {
        // Check if this is an enemy with the new instance system
        if (entity.enemyInstance) {
            this.enemyManager.updateHealthBar(entity.enemyInstance, healthPercent);
            return;
        }

        // Legacy implementation for compatibility
        if (entity.healthBar) {
            this.updateHealthBar(entity.healthBar, healthPercent);
        }
    }

    createHealthBar() {
        const group = new THREE.Group();

        // Background bar
        const bgGeometry = new THREE.PlaneGeometry(1, 0.1);
        const bgMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const background = new THREE.Mesh(bgGeometry, bgMaterial);

        // Health bar
        const healthGeometry = new THREE.PlaneGeometry(1, 0.1);
        const healthMaterial = new THREE.MeshBasicMaterial({ color: 0x00FF00 });
        const healthBar = new THREE.Mesh(healthGeometry, healthMaterial);
        healthBar.position.z = 0.01; // Slightly in front of background

        // Position the health bar above the enemy
        group.position.set(0, 1, 0);
        group.rotation.x = -Math.PI / 4; // Angle towards camera

        // Add to group
        group.add(background);
        group.add(healthBar);

        return {
            group: group,
            bar: healthBar
        };
    }

    updateHealthBar(healthBarObject, healthPercent) {
        const bar = healthBarObject.bar;

        // Scale the health bar based on health percentage
        bar.scale.x = Math.max(0.01, healthPercent);

        // Position the bar so it shrinks from right to left
        bar.position.x = (1 - bar.scale.x) / 2;

        // Change color based on health level
        if (healthPercent > 0.6) {
            bar.material.color.setHex(0x00FF00); // Green
        } else if (healthPercent > 0.3) {
            bar.material.color.setHex(0xFFFF00); // Yellow
        } else {
            bar.material.color.setHex(0xFF0000); // Red
        }
    }

    createTower(tower) {
        // Get element key and ensure it exists
        const elementKey = tower.element || ElementTypes.NEUTRAL;

        // Get instance indices from the manager
        const instanceIndex = this.towerManager.getNextIndex(elementKey);
        if (instanceIndex === -1) {
            console.error("Failed to get instance index for tower");
            return null;
        }

        // Get shadow index
        const shadowIndex = this.nextShadowIndex++;

        // Update positions for instanced parts
        this.towerManager.updateBasePosition(elementKey, instanceIndex, tower.position);
        this.towerManager.updateFoundationPosition(elementKey, instanceIndex, tower.position);

        // Determine tower top type based on tower type
        let topType = 'default';
        if (tower.type === 'arrow') {
            topType = 'arrow';
        } else if (tower.type === 'doubleArrow') {
            topType = 'doubleArrow';
        } else if (tower.type === 'cannon') {
            topType = 'cannon';
        } else if (tower.element !== ElementTypes.NEUTRAL) {
            // For elemental towers, use element-specific tops
            topType = tower.element.toLowerCase();
        }

        // Update the top position using instanced rendering
        this.towerManager.updateTopPosition(elementKey, instanceIndex, tower.position, topType);

        // Create a range indicator (hidden by default)
        const rangeGeometry = new THREE.CircleGeometry(tower.range, 32);
        const rangeMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide
        });

        const rangeIndicator = new THREE.Mesh(rangeGeometry, rangeMaterial);
        rangeIndicator.rotation.x = -Math.PI / 2; // Align with ground
        rangeIndicator.position.y = 0.02; // Just above ground
        rangeIndicator.visible = false; // Hidden by default

        // Create the nose part (needed for proper rotation targeting)
        const noseMaterial = this.materials.towerTops[elementKey] || this.materials.towerTops['neutral'];
        const noseGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.4);
        const noseMesh = new THREE.Mesh(noseGeometry, noseMaterial);
        noseMesh.position.set(0, 0.9, 0.2); // Position it at the top of the tower and forward
        noseMesh.visible = true;

        // Create an empty group for the range indicator, nose, and other metadata
        // This maintains compatibility with existing code
        const topGroup = new THREE.Group();
        topGroup.position.copy(tower.position);
        topGroup.userData.rangeIndicator = rangeIndicator;
        topGroup.userData.nose = noseMesh; // Store reference to nose for rotation
        topGroup.add(rangeIndicator);
        topGroup.add(noseMesh);

        // Add to scene
        this.scene.add(topGroup);

        // Create tower instance object to track everything
        const towerInstance = {
            elementKey,
            instanceIndex,
            shadowIndex,
            topType,
            topGroup, // Keep this for compatibility with existing code
            position: new THREE.Vector3(tower.position.x, 0, tower.position.z),
            type: tower.type,
            // Store reference back to the original tower for updates
            tower: tower
        };

        // Store in the instances array
        this.towerInstances.push(towerInstance);

        // Return the tower instance
        return towerInstance;
    }

    createProjectile(projectile) {
        // Create extremely simple, high-visibility projectiles
        // Get element style if projectile has an element
        const elementStyle = projectile.element && ElementStyles[projectile.element] ?
            ElementStyles[projectile.element] :
            { color: 0x76FF03, emissive: 0x33691E, particleColor: 0xA0FF4C };

        // Make projectiles MUCH larger for maximum visibility
        const size = 0.12; // Significantly larger for guaranteed visibility
        const geometry = new THREE.BoxGeometry(size, size, size);

        // Use extremely bright, high-contrast material
        const material = new THREE.MeshBasicMaterial({
            color: 0xFFFF00, // Bright yellow - easiest to see
            opacity: 1.0,
            transparent: false
        });

        // Create a simple, performant mesh without extra effects
        const mesh = new THREE.Mesh(geometry, material);

        // Enable rendering on both sides to ensure visibility
        material.side = THREE.DoubleSide;

        // Make sure it renders above other objects - IMPORTANT for visibility
        mesh.renderOrder = 100; // Much higher renderOrder to absolutely ensure it's drawn on top

        // No shadows for performance
        mesh.castShadow = false;
        mesh.receiveShadow = false;

        // Keep projectiles extremely simple - no indicator or other meshes
        // This helps ensure they render consistently

        // Set initial position for tracking
        mesh.userData.lastPosition = { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };

        // CRITICAL: Must add to scene here!
        console.log(`Created projectile mesh at ${mesh.position.x}, ${mesh.position.y}, ${mesh.position.z}`);
        this.scene.add(mesh);

        return mesh;
    }

    createTowerPreview(towerType) {
        // console.log("Creating tower preview for type:", towerType);

        // Remove existing preview if any
        if (this.previewMesh) {
            this.scene.remove(this.previewMesh);
            this.previewMesh = null;
        }

        // Create a group for the preview tower
        const previewGroup = new THREE.Group();
        let baseMaterial, topMaterial;

        // Set transparent materials for preview with wireframe style to make it
        // more visible and avoid any ground shading issues
        switch (towerType) {
            case 'arrow':
                baseMaterial = new THREE.MeshBasicMaterial({
                    color: 0x4CAF50,
                    transparent: true,
                    opacity: 0.7,
                    wireframe: true, // Use wireframe to avoid shading issues
                    wireframeLinewidth: 2
                });
                topMaterial = new THREE.MeshBasicMaterial({
                    color: 0x388E3C,
                    transparent: true,
                    opacity: 0.7,
                    wireframe: true, // Use wireframe to avoid shading issues
                    wireframeLinewidth: 2
                });
                break;
            case 'doubleArrow':
                baseMaterial = new THREE.MeshBasicMaterial({
                    color: 0x66BB6A,
                    transparent: true,
                    opacity: 0.7,
                    wireframe: true,
                    wireframeLinewidth: 2
                });
                topMaterial = new THREE.MeshBasicMaterial({
                    color: 0x4CAF50,
                    transparent: true,
                    opacity: 0.7,
                    wireframe: true,
                    wireframeLinewidth: 2
                });
                break;
            case 'cannon':
                baseMaterial = new THREE.MeshBasicMaterial({
                    color: 0x388E3C,
                    transparent: true,
                    opacity: 0.7,
                    wireframe: true,
                    wireframeLinewidth: 2
                });
                topMaterial = new THREE.MeshBasicMaterial({
                    color: 0x2E7D32,
                    transparent: true,
                    opacity: 0.7,
                    wireframe: true,
                    wireframeLinewidth: 2
                });
                break;
            default:
                baseMaterial = new THREE.MeshBasicMaterial({
                    color: 0x4CAF50,
                    transparent: true,
                    opacity: 0.7,
                    wireframe: true,
                    wireframeLinewidth: 2
                });
                topMaterial = baseMaterial;
        }

        // Create base - similar to real tower but with transparent materials
        const baseGeometry = new THREE.CylinderGeometry(0.4, 0.5, 0.4, 8);
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = 0.2;
        previewGroup.add(base);

        // Add top part based on tower type
        let top;
        switch (towerType) {
            case 'arrow':
                const topGeometry = new THREE.ConeGeometry(0.3, 0.6, 8);
                top = new THREE.Mesh(topGeometry, topMaterial);
                top.position.y = 0.9;
                break;

            case 'doubleArrow':
                // Create simpler double arrow preview
                const doubleTopGroup = new THREE.Group();

                const cone1 = new THREE.Mesh(
                    new THREE.ConeGeometry(0.25, 0.5, 8),
                    topMaterial
                );
                cone1.position.set(0.2, 0.7, 0);
                cone1.rotation.z = Math.PI/10;

                const cone2 = new THREE.Mesh(
                    new THREE.ConeGeometry(0.25, 0.5, 8),
                    topMaterial
                );
                cone2.position.set(-0.2, 0.7, 0);
                cone2.rotation.z = -Math.PI/10;

                doubleTopGroup.add(cone1, cone2);
                top = doubleTopGroup;
                break;

            case 'cannon':
                // Simpler cannon preview
                const cannonTop = new THREE.Group();

                const sphere = new THREE.Mesh(
                    new THREE.SphereGeometry(0.35, 12, 12),
                    topMaterial
                );
                sphere.position.y = 0.9;

                const barrel = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.2, 0.2, 0.6, 12),
                    new THREE.MeshBasicMaterial({
                        color: 0x212121,
                        transparent: true,
                        opacity: 0.6
                    })
                );
                barrel.position.set(0, 0.7, 0.4);
                barrel.rotation.x = Math.PI/2;

                cannonTop.add(sphere, barrel);
                top = cannonTop;
                break;

            default:
                top = new THREE.Mesh(
                    new THREE.BoxGeometry(0.4, 0.4, 0.4),
                    topMaterial
                );
                top.position.y = 0.9;
        }

        previewGroup.add(top);

        // Add a subtle glow effect to show it's a preview
        const glowGeometry = new THREE.SphereGeometry(0.8, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x4CAF50,
            transparent: true,
            opacity: 0.2,
            side: THREE.BackSide
        });

        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.y = 0.5;
        previewGroup.add(glow);

        this.previewMesh = previewGroup;
        this.scene.add(this.previewMesh);
        return this.previewMesh;
    }

    updateTowerPreview(position, isValidPlacement) {
        if (!this.previewMesh) return;

        // Update position
        this.previewMesh.position.copy(position);
        this.previewMesh.position.y = 0.0; // Base at ground level

        // If for some reason the position is at the center of the map (0,0,0) and we're on mobile,
        // this is likely a phantom preview we should hide
        if (window.innerWidth <= 768 &&
            Math.abs(position.x) < 0.01 &&
            Math.abs(position.z) < 0.01) {
            this.previewMesh.visible = false;
            return;
        }

        // Otherwise make sure it's visible
        this.previewMesh.visible = true;

        // Update all materials in the preview to reflect valid/invalid placement
        const color = isValidPlacement ? 0x4CAF50 : 0xFF5252;

        // Update all child meshes recursively
        this.previewMesh.traverse((child) => {
            if (child.isMesh && child.material) {
                try {
                    // Check if material is an array
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => {
                            if (mat.color) mat.color.setHex(color);
                        });
                    } else if (child.material.color) {
                        // Only change non-glow materials (skip the backside glow)
                        if (child.material.side !== THREE.BackSide) {
                            child.material.color.setHex(color);
                        }
                    }
                } catch (e) {
                    console.warn("Error updating material color:", e);
                }
            }
        });

        // Update the glow color based on validity
        const glowColor = isValidPlacement ? 0x4CAF50 : 0xFF5252;
        this.previewMesh.children.forEach(child => {
            if (child.isMesh && child.material && child.material.side === THREE.BackSide) {
                try {
                    child.material.color.setHex(glowColor);
                    // Make the glow more visible for invalid placement
                    child.material.opacity = isValidPlacement ? 0.2 : 0.3;
                } catch (e) {
                    console.warn("Error updating glow material:", e);
                }
            }
        });
    }

    removeTowerPreview() {
        // console.log("Removing tower preview");
        if (this.previewMesh) {
            this.scene.remove(this.previewMesh);
            this.previewMesh = null;
        } else {
            // console.log("No preview mesh to remove");
        }

        // Hide grid highlight
        this.gridHighlight.visible = false;
    }

    showGridHighlight(gridX, gridY, gridSize, isValid) {
        // Update position
        this.gridHighlight.position.x = gridX - gridSize.width / 2 + 0.5;
        this.gridHighlight.position.z = gridY - gridSize.height / 2 + 0.5;

        // Update color
        this.gridHighlight.material.color.setHex(isValid ? 0x4CAF50 : 0xFF5252);

        // Make it very visible and bright
        this.gridHighlight.material.opacity = isValid ? 0.9 : 1.0;

        // Size is fixed by the BoxGeometry we're using
        this.gridHighlight.scale.set(1, 1, 1);

        // Hide grid highlight if position is at the center of the map (0,0) and we're on mobile,
        // Similar to what we do with the preview mesh to prevent phantom highlights
        if (window.innerWidth <= 768 &&
            Math.abs(gridX - gridSize.width / 2 + 0.5) < 0.01 &&
            Math.abs(gridY - gridSize.height / 2 + 0.5) < 0.01) {
            this.gridHighlight.visible = false;
            return;
        }

        // Show highlight
        this.gridHighlight.visible = true;
    }

    hideGridHighlight() {
        this.gridHighlight.visible = false;
    }

    updateMapColors(mapGroup, pathColor = null, groundColor = null) {
        if (!mapGroup) return;

        // Update path color if provided
        if (pathColor) {
            const pathColorValue = parseInt(pathColor.replace('#', '0x'), 16);

            // Update all children that represent the path
            mapGroup.traverse((child) => {
                // Find all meshes that are path tiles
                if (child.isMesh &&
                    child.material &&
                    !child.material.name &&
                    child.position.y === 0.05 // This is a path tile (sits above ground)
                ) {
                    // Skip special tiles (entry/exit points which have special colors)
                    if (child.material.color.getHex() !== 0x4169E1 && // Entry blue
                        child.material.color.getHex() !== 0x9932CC && // Exit purple
                        child.material.color.getHex() !== 0xFF6347) { // Restricted red

                        // Set the material color
                        child.material.color.setHex(pathColorValue);

                        // Store the material for reuse
                        if (this.materials.path) {
                            this.materials.path.color.setHex(pathColorValue);
                        }
                    }
                }
            });
        }

        // Update ground color if provided
        if (groundColor) {
            const groundColorValue = parseInt(groundColor.replace('#', '0x'), 16);

            // Find the ground plane
            mapGroup.traverse((child) => {
                if (child.isMesh &&
                    child.material &&
                    child.rotation.x === -Math.PI / 2 && // Rotated to be horizontal
                    child.position.y === 0) { // This is the ground

                    // Set the material color
                    child.material.color.setHex(groundColorValue);

                    // Also adjust emissive color to match
                    if (child.material.emissive) {
                        // Set emissive to a darker version of the ground color
                        const color = new THREE.Color(groundColorValue);
                        color.multiplyScalar(0.7); // Darken
                        child.material.emissive.copy(color);
                    }
                }
            });
        }
    }

    updateGridStyle(styleName, brightness = 0.5, pathColor = null, groundColor = null) {
        // Find the map group
        if (!this.scene) return;

        // Find the first map group in the scene
        let mapGroup = null;
        for (const child of this.scene.children) {
            if (child.userData && child.userData.gridLines) {
                mapGroup = child;
                break;
            }
        }

        if (!mapGroup || !mapGroup.userData.gridLines) return;

        const gridLines = mapGroup.userData.gridLines;
        const styleProps = mapGroup.userData.gridStyleProperties;
        styleProps.currentStyle = styleName;
        styleProps.brightness = brightness;

        // Update path and ground colors if provided
        this.updateMapColors(mapGroup, pathColor, groundColor);

        // Normalize brightness (0-1)
        const brightnessFactor = brightness;

        // Update all lines based on style
        switch (styleName) {
            case 'borders':
                // Only show border lines
                gridLines.children.forEach((line, index) => {
                    // Only make visible the outermost grid lines
                    const isHorizontalBorder = (index === 0 || index === Math.floor(gridLines.children.length / 2) - 1);
                    const isVerticalBorder = (index === Math.floor(gridLines.children.length / 2) || index === gridLines.children.length - 1);

                    if (isHorizontalBorder || isVerticalBorder) {
                        line.material.opacity = 0.8 * brightnessFactor;
                        line.material.color.setHex(0x00ff44); // Bright green
                        line.material.linewidth = 2; // Thicker lines (note: limited browser support)
                        line.visible = true;
                    } else {
                        line.visible = false;
                    }
                });
                break;

            case 'opacity':
                // High opacity green grid
                gridLines.children.forEach(line => {
                    line.material.opacity = 0.4 * brightnessFactor; // Higher opacity
                    line.material.color.setHex(0x00ff00); // Standard green
                    line.visible = true;
                });

                // Update ground glow too
                if (mapGroup.userData.glowLayer) {
                    mapGroup.userData.glowLayer.material.opacity = 0.2 * brightnessFactor;
                }
                break;

            case 'neon':
                // Neon green effect
                gridLines.children.forEach(line => {
                    line.material.opacity = 0.7 * brightnessFactor;
                    line.material.color.setHex(0x39ff14); // Neon green
                    line.visible = true;
                });

                // Update ground color for neon effect
                if (mapGroup.userData.glowLayer) {
                    mapGroup.userData.glowLayer.material.color.setHex(0x39ff14);
                    mapGroup.userData.glowLayer.material.opacity = 0.15 * brightnessFactor;
                }
                break;

            default: // 'default'
                // Reset to default style
                const defaultColor = styleProps.defaultColor;
                const defaultOpacity = styleProps.defaultOpacity;

                gridLines.children.forEach(line => {
                    line.material.opacity = defaultOpacity * brightnessFactor;
                    line.material.color.setHex(defaultColor);
                    line.visible = true;
                });

                // Reset ground glow
                if (mapGroup.userData.glowLayer) {
                    mapGroup.userData.glowLayer.material.color.setHex(0x4AFF8D);
                    mapGroup.userData.glowLayer.material.opacity = 0.12 * brightnessFactor;
                }
                break;
        }
    }

    cleanupScene() {
        console.log("Cleaning up scene...");
        console.log("Initial scene children count:", this.scene.children.length);

        // Instead of keeping objects, let's just remove everything but create a new clean scene
        // This is more reliable for preventing duplicate objects

        // Clear the entire scene
        while (this.scene.children.length > 0) {
            const obj = this.scene.children[0];
            this.scene.remove(obj);
        }

        // Reset the scene to initial state
        this.setupLights();

        // Add grid helper back
        this.gridHelper = new THREE.GridHelper(25, 25);
        this.gridHelper.position.y = 0.01;
        this.gridHelper.visible = false;
        this.scene.add(this.gridHelper);

        // Add grid highlight back
        this.gridHighlight = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            this.materials.gridHighlight
        );
        this.gridHighlight.rotation.x = -Math.PI / 2;
        this.gridHighlight.position.y = 0.02;
        this.gridHighlight.visible = false;
        this.scene.add(this.gridHighlight);

        console.log("Scene cleanup complete. Scene children count:", this.scene.children.length);
    }

    createSpecialEffect(type, position) {
        let effect;

        switch (type) {
            case 'meteor':
                effect = this.createMeteorEffect(position);
                break;
            case 'freeze':
                effect = this.createFreezeEffect(position);
                break;
            case 'goldRush':
                effect = this.createGoldRushEffect(position);
                break;
            case 'empower':
                effect = this.createEmpowerEffect(position);
                break;
            default:
                return null;
        }

        return effect;
    }

    createMeteorEffect(position) {
        // Create a group for the meteor effect
        const group = new THREE.Group();

        // Create meteor
        const meteorGeometry = new THREE.SphereGeometry(0.5, 16, 16);
        const meteorMaterial = new THREE.MeshStandardMaterial({
            color: 0xFF5500,
            emissive: 0xFF2200,
            emissiveIntensity: 1
        });

        const meteor = new THREE.Mesh(meteorGeometry, meteorMaterial);

        // Create fire particles
        const particlesCount = 50;
        const particlesGeometry = new THREE.BufferGeometry();
        const particlePositions = new Float32Array(particlesCount * 3);

        for (let i = 0; i < particlesCount; i++) {
            const i3 = i * 3;
            particlePositions[i3] = (Math.random() - 0.5) * 0.3;
            particlePositions[i3 + 1] = (Math.random() - 0.5) * 0.3;
            particlePositions[i3 + 2] = (Math.random() - 0.5) * 0.3;
        }

        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

        const particlesMaterial = new THREE.PointsMaterial({
            color: 0xFF8800,
            size: 0.1,
            transparent: true
        });

        const particles = new THREE.Points(particlesGeometry, particlesMaterial);
        meteor.add(particles);

        // Add to group and position
        group.add(meteor);
        group.position.copy(position);
        group.position.y = 10; // Start high

        this.scene.add(group);

        // Animation data
        const animation = {
            group: group,
            startTime: performance.now(),
            duration: 1000,
            impactTime: 0,
            hasImpacted: false,
            update: (currentTime) => {
                const elapsed = currentTime - animation.startTime;
                const progress = Math.min(elapsed / animation.duration, 1);

                // Move meteor down
                group.position.y = 10 * (1 - progress);

                // Rotate slightly
                meteor.rotation.x += 0.01;
                meteor.rotation.z += 0.01;

                // Check for impact
                if (progress >= 1 && !animation.hasImpacted) {
                    animation.hasImpacted = true;
                    animation.impactTime = currentTime;

                    // Create impact explosion
                    this.createExplosion(position);

                    // Remove meteor
                    this.scene.remove(group);

                    return true; // Effect completed
                }

                return false; // Effect still running
            }
        };

        return animation;
    }

    createExplosion(position) {
        // Create a group for the explosion effect
        const group = new THREE.Group();

        // Create explosion sphere
        const explosionGeometry = new THREE.SphereGeometry(0.2, 16, 16);
        const explosionMaterial = new THREE.MeshBasicMaterial({
            color: 0xFF4500,
            transparent: true
        });

        const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
        group.add(explosion);

        // Position at impact site
        group.position.copy(position);
        group.position.y = 0.1; // Just above ground

        this.scene.add(group);

        // Animation data
        const animation = {
            group: group,
            startTime: performance.now(),
            duration: 1000,
            update: (currentTime) => {
                const elapsed = currentTime - animation.startTime;
                const progress = Math.min(elapsed / animation.duration, 1);

                // Grow and fade explosion
                const size = 0.2 + progress * 3;
                explosion.scale.set(size, size, size);
                explosionMaterial.opacity = 1 - progress;

                if (progress >= 1) {
                    this.scene.remove(group);
                    return true; // Effect completed
                }

                return false; // Effect still running
            }
        };

        return animation;
    }

    createFreezeEffect(position) {
        // Create ice particles across the map
        const particlesCount = 200;
        const particlesGeometry = new THREE.BufferGeometry();
        const particlePositions = new Float32Array(particlesCount * 3);

        // Distribute particles across the map
        for (let i = 0; i < particlesCount; i++) {
            const i3 = i * 3;
            particlePositions[i3] = (Math.random() - 0.5) * 20;     // X
            particlePositions[i3 + 1] = Math.random() * 2;          // Y
            particlePositions[i3 + 2] = (Math.random() - 0.5) * 20; // Z
        }

        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

        const particlesMaterial = new THREE.PointsMaterial({
            color: 0x88CCFF,
            size: 0.2,
            transparent: true,
            opacity: 0.7
        });

        const particles = new THREE.Points(particlesGeometry, particlesMaterial);
        this.scene.add(particles);

        // Animation data
        const animation = {
            particles: particles,
            startTime: performance.now(),
            duration: 2000,
            update: (currentTime) => {
                const elapsed = currentTime - animation.startTime;
                const progress = Math.min(elapsed / animation.duration, 1);

                // Fade out particles
                particlesMaterial.opacity = 0.7 * (1 - progress);

                // Move particles down slowly
                particles.position.y -= 0.01;

                if (progress >= 1) {
                    this.scene.remove(particles);
                    return true; // Effect completed
                }

                return false; // Effect still running
            }
        };

        return animation;
    }

    createGoldRushEffect(position) {
        // Create a shower of gold coins
        const group = new THREE.Group();
        const coinsCount = 30;

        // Create individual coins
        for (let i = 0; i < coinsCount; i++) {
            const coinGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16);
            const coinMaterial = new THREE.MeshStandardMaterial({
                color: 0xFFD700,
                metalness: 0.8,
                roughness: 0.3
            });

            const coin = new THREE.Mesh(coinGeometry, coinMaterial);

            // Set random position around center
            coin.position.set(
                (Math.random() - 0.5) * 5,
                5 + Math.random() * 2,
                (Math.random() - 0.5) * 5
            );

            // Set random rotation
            coin.rotation.set(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );

            // Set random velocity
            coin.userData.velocity = {
                x: (Math.random() - 0.5) * 2,
                y: -2 - Math.random() * 2,
                z: (Math.random() - 0.5) * 2,
                rotX: Math.random() * 5,
                rotY: Math.random() * 5
            };

            group.add(coin);
        }

        this.scene.add(group);

        // Animation data
        const animation = {
            group: group,
            coins: group.children,
            startTime: performance.now(),
            duration: 3000,
            update: (currentTime) => {
                const elapsed = currentTime - animation.startTime;
                const progress = Math.min(elapsed / animation.duration, 1);

                // Update each coin
                for (const coin of animation.coins) {
                    // Move coin based on velocity
                    coin.position.x += coin.userData.velocity.x * 0.05;
                    coin.position.y += coin.userData.velocity.y * 0.05;
                    coin.position.z += coin.userData.velocity.z * 0.05;

                    // Rotate coin
                    coin.rotation.x += coin.userData.velocity.rotX * 0.05;
                    coin.rotation.y += coin.userData.velocity.rotY * 0.05;

                    // Bounce off ground
                    if (coin.position.y < 0.1) {
                        coin.position.y = 0.1;
                        coin.userData.velocity.y *= -0.6; // Reduce bounce height
                    }

                    // Apply gravity
                    coin.userData.velocity.y += -0.05;
                }

                // Fade out at the end
                if (progress > 0.7) {
                    const fadeProgress = (progress - 0.7) / 0.3;
                    group.traverse(object => {
                        if (object.isMesh) {
                            object.material.opacity = 1 - fadeProgress;
                            object.material.transparent = true;
                        }
                    });
                }

                if (progress >= 1) {
                    this.scene.remove(group);
                    return true; // Effect completed
                }

                return false; // Effect still running
            }
        };

        return animation;
    }

    createEmpowerEffect(position) {
        // Effect for all towers
        const empowerEffects = [];

        // Get all tower meshes
        this.scene.traverse(object => {
            if (object.isMesh &&
                (object.material === this.materials.towerBases[ElementTypes.ARROW] ||
                 object.material === this.materials.towerTops[ElementTypes.DOUBLE_ARROW] ||
                 object.material === this.materials.towerTops[ElementTypes.CANNON])) {

                // Create glow effect for this tower
                const glowGeometry = new THREE.SphereGeometry(0.8, 16, 16);
                const glowMaterial = new THREE.MeshBasicMaterial({
                    color: 0xFFFF00,
                    transparent: true,
                    opacity: 0.5
                });

                const glow = new THREE.Mesh(glowGeometry, glowMaterial);
                glow.position.copy(object.position);
                this.scene.add(glow);

                empowerEffects.push(glow);
            }
        });

        // Animation data
        const animation = {
            effects: empowerEffects,
            startTime: performance.now(),
            duration: 15000, // 15 seconds of empowerment
            update: (currentTime) => {
                const elapsed = currentTime - animation.startTime;
                const progress = Math.min(elapsed / animation.duration, 1);

                // Pulse effect
                const pulse = 0.7 + 0.3 * Math.sin(elapsed / 200);

                for (const effect of animation.effects) {
                    effect.scale.set(pulse, pulse, pulse);

                    // Fade out at the end
                    if (progress > 0.8) {
                        const fadeProgress = (progress - 0.8) / 0.2;
                        effect.material.opacity = 0.5 * (1 - fadeProgress);
                    }
                }

                if (progress >= 1) {
                    for (const effect of animation.effects) {
                        this.scene.remove(effect);
                    }
                    return true; // Effect completed
                }

                return false; // Effect still running
            }
        };

        return animation;
    }

    onWindowResize() {
        // Update camera aspect ratio
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        // Update renderer size
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Vibeverse Portal methods
    createVibeVersePortal() {
        // Create the HTML button for the portal instead of 3D objects
        this.createHtmlPortalButton();
    }

    createHtmlPortalButton() {
        // Create a div for the portal button if it doesn't already exist
        if (!this.portalButtonElement) {
            // Create main container
            const buttonContainer = document.createElement('div');
            buttonContainer.id = 'portal-button-container';

            // Apply styles
            Object.assign(buttonContainer.style, {
                position: 'fixed',
                zIndex: '1000',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'none', // Initially hidden
                textAlign: 'center'
            });

            // Create button element
            const button = document.createElement('button');
            button.id = 'portal-button';
            button.textContent = 'ENTER PORTAL';

            // Apply styles to the button
            Object.assign(button.style, {
                background: 'linear-gradient(to bottom, #00ff00, #008800)',
                color: 'white',
                border: 'none',
                borderRadius: '50px',
                padding: '20px 40px',
                fontSize: '20px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 0 20px #00ff00, 0 0 40px rgba(0, 255, 0, 0.5)',
                transition: 'all 0.3s ease',
                outline: 'none',
                fontFamily: 'Arial, sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                position: 'relative',
                overflow: 'hidden'
            });

            // Pulsing animation using CSS
            const keyframes = `
                @keyframes pulse {
                    0% { transform: scale(1); box-shadow: 0 0 20px #00ff00, 0 0 40px rgba(0, 255, 0, 0.5); }
                    50% { transform: scale(1.05); box-shadow: 0 0 30px #00ff00, 0 0 50px rgba(0, 255, 0, 0.7); }
                    100% { transform: scale(1); box-shadow: 0 0 20px #00ff00, 0 0 40px rgba(0, 255, 0, 0.5); }
                }
            `;

            // Create style element for the animation
            const style = document.createElement('style');
            style.type = 'text/css';
            style.appendChild(document.createTextNode(keyframes));
            document.head.appendChild(style);

            // Add animation to button
            button.style.animation = 'pulse 1.5s infinite';

            // Add label above the button
            const label = document.createElement('div');
            label.textContent = 'VIBEVERSE PORTAL';

            // Apply styles to the label
            Object.assign(label.style, {
                color: '#00ff00',
                fontSize: '24px',
                fontWeight: 'bold',
                marginBottom: '20px',
                textShadow: '0 0 10px #00ff00, 0 0 20px #00ff00',
                fontFamily: 'Arial, sans-serif'
            });

            // Add event listener for click
            button.addEventListener('click', () => {
                // Click animation
                button.style.transform = 'scale(1.2)';
                button.style.opacity = '0';
                setTimeout(() => this.redirectToVibeverse(), 300);
            });

            // Add hover effect
            button.addEventListener('mouseenter', () => {
                button.style.backgroundColor = '#00cc00';
                button.style.transform = 'translateY(-5px)';
                button.style.boxShadow = '0 0 30px #00ff00, 0 0 60px rgba(0, 255, 0, 0.7)';
            });

            button.addEventListener('mouseleave', () => {
                button.style.backgroundColor = '';
                button.style.transform = '';
                button.style.boxShadow = '0 0 20px #00ff00, 0 0 40px rgba(0, 255, 0, 0.5)';
            });

            // Add elements to the DOM
            buttonContainer.appendChild(label);
            buttonContainer.appendChild(button);
            document.body.appendChild(buttonContainer);

            // Store reference to the button container
            this.portalButtonElement = buttonContainer;
        }
    }

    // Show the HTML portal button
    showPortalButton() {
        if (this.portalButtonElement) {
            // Fade in the button with animation
            this.portalButtonElement.style.display = 'block';
            this.portalButtonElement.style.opacity = '0';

            // Trigger reflow
            void this.portalButtonElement.offsetWidth;

            // Add transition for smooth appearance
            this.portalButtonElement.style.transition = 'opacity 0.5s ease';
            this.portalButtonElement.style.opacity = '1';

            // Add entrance animation - scale up from smaller size
            const button = document.getElementById('portal-button');
            if (button) {
                button.style.transform = 'scale(0.8)';

                // Trigger reflow
                void button.offsetWidth;

                button.style.transition = 'transform 0.5s ease-out';
                button.style.transform = 'scale(1)';
            }
        }
    }

    // Hide the HTML portal button
    hidePortalButton() {
        if (this.portalButtonElement) {
            // Fade out the button
            this.portalButtonElement.style.transition = 'opacity 0.5s ease';
            this.portalButtonElement.style.opacity = '0';

            // After animation completes, set display to none
            setTimeout(() => {
                this.portalButtonElement.style.display = 'none';
            }, 500);
        }
    }

    redirectToVibeverse() {
        // Gather player information for the portal
        const username = window.game && window.game.player ? window.game.player.username : 'Player';

        // Build URL with player parameters
        const params = new URLSearchParams();
        params.append('portal', 'true');
        params.append('username', username);
        params.append('color', 'green'); // Color theme of our game
        params.append('ref', window.location.hostname);

        // Redirect to the Vibeverse portal with updated URL
        window.location.href = `http://portal.pieter.com?${params.toString()}`;
    }

    // Add these methods after createTower

    // Remove a tower and release its instance
    removeTower(towerInstance) {
        if (!towerInstance) return;

        // Release instance index
        this.towerManager.releaseIndex(towerInstance.elementKey, towerInstance.instanceIndex);

        // Hide instanced parts
        this.towerManager.hideInstance(towerInstance.elementKey, towerInstance.instanceIndex, towerInstance.shadowIndex);

        // Remove top group from scene
        if (towerInstance.topGroup) {
            this.scene.remove(towerInstance.topGroup);

            // Dispose any geometries and materials created for this tower
            towerInstance.topGroup.traverse(child => {
                if (child.geometry) {
                    child.geometry.dispose();
                }

                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => material.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        }

        // Remove from instances array
        const index = this.towerInstances.indexOf(towerInstance);
        if (index !== -1) {
            this.towerInstances.splice(index, 1);
        }
    }

    // Update the position of a tower
    updateTowerPosition(towerInstance, position) {
        if (!towerInstance) return;

        // Update positions for instanced parts
        this.towerManager.updateBasePosition(towerInstance.elementKey, towerInstance.instanceIndex, position);
        this.towerManager.updateFoundationPosition(towerInstance.elementKey, towerInstance.instanceIndex, position);

        // Update top group position
        if (towerInstance.topGroup) {
            towerInstance.topGroup.position.set(position.x, 0, position.z);
        }

        // Update stored position
        towerInstance.position.set(position.x, 0, position.z);
    }

    // Rotate tower to target an enemy
    rotateTowerToTarget(towerInstance, targetPosition) {
        if (!towerInstance || !towerInstance.topGroup || !towerInstance.topGroup.userData.nose) return;

        // Calculate angle to target
        const dx = targetPosition.x - towerInstance.position.x;
        const dz = targetPosition.z - towerInstance.position.z;
        const angle = Math.atan2(dz, dx);

        // Rotate nose to face target
        towerInstance.topGroup.userData.nose.rotation.y = angle;
    }

    // Add LOD system for towers
    updateTowerLOD() {
        const cameraPosition = this.camera.position;

        this.towerInstances.forEach(towerInstance => {
            if (!towerInstance.topGroup) return;

            // Calculate distance to camera
            const distanceToCamera = this.getDistanceToCamera(towerInstance.position);

            // Apply different LOD levels based on distance
            if (distanceToCamera > 50) {
                // Very far away - simplify drastically
                // Hide particles and glow effects
                towerInstance.topGroup.traverse(child => {
                    if (child.isPoints || (child.isMesh && child.material && child.material.side === THREE.BackSide)) {
                        child.visible = false;
                    }
                });
            } else if (distanceToCamera > 30) {
                // Medium distance - show only basic effects
                towerInstance.topGroup.traverse(child => {
                    // Hide particles but keep glow
                    if (child.isPoints) {
                        child.visible = false;
                    } else if (child.isMesh && child.material && child.material.side === THREE.BackSide) {
                        child.visible = true;
                    }
                });
            } else {
                // Close to camera - show everything
                towerInstance.topGroup.traverse(child => {
                    child.visible = true;
                });
            }
        });
    }

    // Animation loop (call this in your game loop)
    animate(currentTime, game) {
        if (!this.renderer || !game) return;

        // Early-out if the game is paused or hidden (tab not active)
        if (document.hidden || game.gameOver) {
            return;
        }

        // Update game camera
        this.updateCamera();

        // Skip animation updates when FPS is very low (emergency performance mode)
        const lowFPS = game.fpsCounter && game.fpsCounter.value < 20;

        // Use shared vectors for calculations
        const currentPos = this._tempVector1;
        const lastPos = this._tempVector2;

        // Only animate visible projectiles in camera frustum
        const frustum = this._frustum || new THREE.Frustum();
        this._frustum = frustum;
        const projScreenMatrix = this._projScreenMatrix || new THREE.Matrix4();
        this._projScreenMatrix = projScreenMatrix;

        // Update frustum for visibility checks
        this.camera.updateMatrixWorld();
        projScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(projScreenMatrix);

        // Throttle animation at low FPS
        const animateEveryNth = lowFPS ? 3 : 1; // Only animate 1/3 of objects at very low FPS
        let animationCounter = 0;

        // Animate projectiles with culling
        game.projectiles.forEach(projectile => {
            if (!projectile.mesh) return;

            // Skip animation based on counter for extreme low FPS scenarios
            animationCounter++;
            if (lowFPS && animationCounter % animateEveryNth !== 0) {
                return;
            }

            // Only update position
                projectile.mesh.position.copy(projectile.position);

            // Skip trail animation if FPS is very low or no particle system
            if (lowFPS || !projectile.mesh.userData.particleSystem) return;

            // Skip trail animation if offscreen (outside frustum)
            currentPos.copy(projectile.position);
            if (!frustum.containsPoint(currentPos)) return;

                // Animate projectile trail
                    const particles = projectile.mesh.userData.particleSystem;
                    const positions = particles.geometry.attributes.position.array;
                    const particleAges = particles.userData.particleAges || [];

            currentPos.set(
                        projectile.position.x,
                        projectile.position.y,
                        projectile.position.z
                    );

                    // If this is not the first update, add current position to trail
                    if (projectile.mesh.userData.lastPosition) {
                lastPos.set(
                    projectile.mesh.userData.lastPosition.x,
                    projectile.mesh.userData.lastPosition.y,
                    projectile.mesh.userData.lastPosition.z
                        );

                        const particleCount = positions.length / 3;
                        for (let i = 0; i < particleCount; i++) {
                            const i3 = i * 3;
                            // Age particles
                            particleAges[i] = (particleAges[i] || 0) + 1;

                            // Fade out older particles
                            if (particleAges[i] > 10) {
                                // Reset this particle to near the projectile
                                positions[i3] = (Math.random() - 0.5) * 0.1;
                                positions[i3 + 1] = (Math.random() - 0.5) * 0.1;
                                positions[i3 + 2] = (Math.random() - 0.5) * 0.1;
                                particleAges[i] = 0;
                            }
                        }
                    }

                    // Update last position
            if (!projectile.mesh.userData.lastPosition) {
                projectile.mesh.userData.lastPosition = {};
            }
            projectile.mesh.userData.lastPosition.x = currentPos.x;
            projectile.mesh.userData.lastPosition.y = currentPos.y;
            projectile.mesh.userData.lastPosition.z = currentPos.z;

                    // Update geometry
                    particles.geometry.attributes.position.needsUpdate = true;
        });

        // Throttle enemy animations based on FPS
        if (!lowFPS) {
        // Animate enemies using the enemy manager
        this.enemyManager.animateEnemies(currentTime);
        } else {
            // Only animate visible enemies when FPS is low
            this.enemyManager.animateVisibleEnemies(currentTime, frustum);
        }

        // Update LOD for enemies based on camera distance - only do this every few frames at low FPS
        if (!lowFPS || (game.frameCount % 10 === 0)) {
        this.enemyManager.updateLOD(this.camera.position);
        }

        // Animate map glow effects (throttle during low FPS)
        if (game.map && game.map.mapGroup && game.map.mapGroup.userData.glowLayer && (!lowFPS || game.frameCount % 5 === 0)) {
            const glowLayer = game.map.mapGroup.userData.glowLayer;

            // More pronounced pulsing for the ground glow
            const pulseAmount = 0.05;
            const pulseSpeed = 0.3; // Slightly faster pulse
            glowLayer.material.opacity = 0.12 + pulseAmount * Math.sin(currentTime * pulseSpeed);

            // Also pulse the color slightly to enhance the effect
            const hue = 0.35 + 0.02 * Math.sin(currentTime * pulseSpeed * 0.7); // Subtle hue shift around green
            glowLayer.material.color.setHSL(hue, 0.8, 0.6);
        }

        // Adjust any dynamic shadow parameters - only update when needed
        if (this.mainLight && this.mainLight.shadow && this.mainLight.shadow.autoUpdate) {
            // Keep shadows strong and crisp
            this.mainLight.shadow.bias = -0.0001;

            // Optional: adjust shadow strength dynamically
            const shadowStrength = 0.8; // Higher values = stronger shadows (0-1)
            if (this.mainLight.shadow.darkness !== undefined) { // Some THREE.js versions use this
                this.mainLight.shadow.darkness = shadowStrength;
            }

            // Disable shadow auto-updates at very low FPS
            if (lowFPS && this.mainLight.shadow.autoUpdate) {
                this.mainLight.shadow.autoUpdate = false;
                // Force update every 500ms instead
                if (!this._shadowInterval) {
                    this._shadowInterval = setInterval(() => {
                        if (this.mainLight) {
                            this.mainLight.shadow.needsUpdate = true;
                        }
                    }, 500);
                }
            }
        }

        // Single render pass instead of multiple passes
        this.renderer.render(this.scene, this.camera);
    }

    // Create the tower turret part (the rotating top part)
    createTowerTurret(tower, elementKey) {
        // Get material for this element
        const material = this.materials.towerTops[elementKey] || this.materials.towerTops['neutral'];

        // Base turret geometry - a simple cylinder
        const turretGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 8);
        const turretMesh = new THREE.Mesh(turretGeometry, material);

        // Create a group to hold the turret and nose
        const turretGroup = new THREE.Group();
        turretGroup.add(turretMesh);

        // Create the "nose" part that will point at enemies
        const noseGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.4);
        const noseMesh = new THREE.Mesh(noseGeometry, material);
        noseMesh.position.z = 0.2; // Position it forward

        // Add nose to group
        turretGroup.add(noseMesh);

        // Store the nose for rotation
        turretGroup.userData.nose = noseMesh;

        // Add special effects based on element type
        if (elementKey !== 'neutral') {
            // Create glow effect for elemental towers
            const glowGeometry = new THREE.SphereGeometry(0.3, 8, 8);
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: this.getElementColor(elementKey),
                transparent: true,
                opacity: 0.3,
                side: THREE.BackSide
            });

            const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
            glowMesh.position.y = 0.1;
            turretGroup.add(glowMesh);
        }

        // Add range indicator (hidden by default)
        const rangeGeometry = new THREE.CircleGeometry(tower.range, 32);
        const rangeMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide
        });

        const rangeIndicator = new THREE.Mesh(rangeGeometry, rangeMaterial);
        rangeIndicator.rotation.x = -Math.PI / 2; // Make it horizontal
        rangeIndicator.position.y = 0.02; // Just above ground
        rangeIndicator.visible = false; // Hidden by default

        turretGroup.add(rangeIndicator);
        turretGroup.userData.rangeIndicator = rangeIndicator;

        return turretGroup;
    }

    // Helper method to get color from element type
    getElementColor(elementKey) {
        const colors = {
            'fire': 0xff5500,
            'water': 0x0088ff,
            'earth': 0x8b4513,
            'air': 0xccffff,
            'shadow': 0x9932cc,
            'neutral': 0xaaaaaa
        };

        return colors[elementKey.toLowerCase()] || colors.neutral;
    }

    // Add a new update method to be called from the game loop
    update(deltaTime) {
        // Quality level setting based on performance mode
        if (this.game.performanceMode === 'critical') {
            this.setQualityLevel(0); // Low quality
        } else if (this.game.performanceMode === 'low') {
            this.setQualityLevel(1); // Medium quality
        } else {
            this.setQualityLevel(2); // Full quality
        }

        // Adaptive LOD updates - more frequent at higher framerate
        if (this.game.fpsAverage > 45 || this._frameCount % 2 === 0) {
            // Update LOD for all entities at higher framerates or every other frame
            if (this.enemyManager) {
                this.enemyManager.updateLOD(this.camera.position);
            }
        }

        // Update animations and effects
        this.updateAnimations(deltaTime);

        // Render the scene
        this.render(this.game);
    }

    // Update animations for towers, particles, and effects
    updateAnimations(deltaTime) {
        const currentTime = performance.now() / 1000; // Convert to seconds for animation

        // Update tower rotations if needed
        if (this.game.towers) {
            for (const tower of this.game.towers) {
                if (tower.meshGroup) {
                    // Apply rotation to tower top if targeting
                    if (tower.currentTarget) {
                        this.updateTowerRotation(tower);
                    }
                }
            }
        }

        // Update particle effects if any
        for (const particleSystem of this.particleSystems) {
            if (particleSystem.isActive) {
                particleSystem.update(deltaTime);
            }
        }

        // Animate all enemies - either visible only or all, depending on performance mode
        if (this.enemyManager) {
            if (this.game.performanceMode === 'normal') {
                // Get camera frustum for visibility testing
                this.frustum.setFromProjectionMatrix(
                    new THREE.Matrix4().multiplyMatrices(
                        this.camera.projectionMatrix,
                        this.camera.matrixWorldInverse
                    )
                );
                // Only animate enemies within the camera frustum
                this.enemyManager.animateVisibleEnemies(currentTime, this.frustum);
            } else {
                // In low/critical performance mode, just animate a subset or none
                const animateNone = this.game.performanceMode === 'critical';
                if (!animateNone && this._frameCount % 2 === 0) {
                    // In low performance mode, animate every other frame
                    this.enemyManager.animateEnemies(currentTime);
                }
            }
        }

        // Update damage numbers
        this.updateDamageNumbers(deltaTime);

        // Increment frame counter
        this._frameCount++;
    }

    // Add this new method to the Renderer class to display damage numbers
    createDamageNumber(position, amount, damageType) {
        // Create damage number as HTML element for better performance than THREE.js text
        const damageEl = document.createElement('div');
        damageEl.className = 'damage-number';

        // Set the text content to the damage amount
        damageEl.textContent = Math.floor(amount);

        // Add elemental styling based on damageType
        if (damageType) {
            damageEl.classList.add(`damage-${damageType}`);

            // Apply specific color based on damage type
            switch(damageType) {
                case 'fire':
                    damageEl.style.color = '#FF5722';
                    break;
                case 'water':
                    damageEl.style.color = '#2196F3';
                    break;
                case 'earth':
                    damageEl.style.color = '#795548';
                    break;
                case 'air':
                    damageEl.style.color = '#ECEFF1';
                    break;
                case 'shadow':
                    damageEl.style.color = '#673AB7';
                    break;
                default:
                    damageEl.style.color = '#FFF';
            }
        }

        // Apply critical hit styling for large amounts
        if (amount > 50) {
            damageEl.classList.add('damage-critical');
            damageEl.style.fontSize = '24px';
        }

        // Position the element in 3D space
        const screenPosition = this.worldToScreen(position);
        damageEl.style.left = `${screenPosition.x}px`;
        damageEl.style.top = `${screenPosition.y}px`;

        // Add to document
        document.body.appendChild(damageEl);

        // Animate and remove
        setTimeout(() => {
            damageEl.style.opacity = '0';
            damageEl.style.transform = 'translateY(-50px)';

            // Remove from DOM after animation
            setTimeout(() => {
                document.body.removeChild(damageEl);
            }, 1000);
        }, 10);
    }

    // Helper method to convert world position to screen position
    worldToScreen(position) {
        // Clone position to avoid modifying the original
        const pos = new THREE.Vector3(position.x, position.y + 1, position.z); // Offset Y to show above enemy

        // Project position to screen space
        pos.project(this.camera);

        // Convert to pixel coordinates
        return {
            x: (pos.x * 0.5 + 0.5) * this.renderer.domElement.clientWidth,
            y: (-pos.y * 0.5 + 0.5) * this.renderer.domElement.clientHeight
        };
    }

    // Update damage numbers
    updateDamageNumbers(deltaTime) {
        if (!this.damageNumbers) {
            this.damageNumbers = [];
            return;
        }

        for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
            const damageNumber = this.damageNumbers[i];

            // Update the damage number
            if (damageNumber.update) {
                const shouldRemove = damageNumber.update(deltaTime);

                // If update returns true, remove the damage number
                if (shouldRemove) {
                    if (damageNumber.element) {
                        // Remove the DOM element
                        document.body.removeChild(damageNumber.element);
                    }
                    this.damageNumbers.splice(i, 1);
                }
            }
        }
    }

    // Update tower rotation to face target
    updateTowerRotation(towerInstance, targetPosition) {
        if (!towerInstance) return;

        // Use the towerManager to update top rotation
        this.towerManager.updateTopRotation(
            towerInstance.elementKey,
            towerInstance.instanceIndex,
            towerInstance.topType,
            targetPosition,
            towerInstance.position
        );
    }

    // Add this method to the Renderer class

    /**
     * Rotates a tower to face a target
     * @param {Object} towerInstance - The tower instance object
     * @param {THREE.Vector3} targetPosition - The position to rotate toward
     */
    rotateTowerToTarget(towerInstance, targetPosition) {
        if (!towerInstance) return;

        // For instanced towers, use the instance manager
        if (towerInstance.elementKey !== undefined &&
            towerInstance.instanceIndex !== undefined &&
            towerInstance.topType !== undefined) {

            this.towerManager.updateTopRotation(
                towerInstance.elementKey,
                towerInstance.instanceIndex,
                towerInstance.topType,
                targetPosition,
                towerInstance.position
            );
        }
        // For legacy non-instanced towers with top groups
        else if (towerInstance.topGroup) {
            // Calculate direction to target
            const direction = new THREE.Vector3()
                .subVectors(targetPosition, towerInstance.position)
                .normalize();

            // Calculate angle in XZ plane
            const angle = Math.atan2(direction.x, direction.z);

            // Apply rotation to the nose part
            if (towerInstance.topGroup.userData.nose) {
                towerInstance.topGroup.userData.nose.rotation.y = angle;
            }
        }
    }
}