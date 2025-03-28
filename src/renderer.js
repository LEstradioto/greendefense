
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ElementTypes, ElementStyles } from './elements.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(25, window.innerWidth / window.innerHeight, 0.1, 1000);

        // Set up renderer with enhanced quality settings
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            powerPreference: 'high-performance',
            alpha: true,
            preserveDrawingBuffer: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000); // Black background
        
        // Enhanced shadow settings
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadow edges
        this.renderer.physicallyCorrectLights = true; // More accurate light attenuation
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        // Set up camera
        this.camera.position.set(0, 50, 40);
        this.camera.lookAt(0, 0, 0);

        // Set up controls for camera movement
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.25;
        this.controls.maxPolarAngle = Math.PI / 2.5; // Limit camera angle
        
        // Add rotation tracking to prevent tower placement during rotation
        this.isRotating = false;
        this.lastControlsUpdate = Date.now();
        
        // Add event listeners to track when rotation starts and ends
        this.controls.addEventListener('start', () => {
            this.isRotating = true;
            this.lastControlsUpdate = Date.now();
            console.log("Camera controls started");
            
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
            console.log("Camera controls ended");
            
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
        
        // Create vibeverse portal
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
            arrow: new THREE.MeshStandardMaterial({ 
                color: 0x4CAF50, // Green
                roughness: 0.5,
                metalness: 0.7
            }),
            doubleArrow: new THREE.MeshStandardMaterial({ 
                color: 0x66BB6A, // Light green
                roughness: 0.5,
                metalness: 0.8
            }),
            cannon: new THREE.MeshStandardMaterial({ 
                color: 0x388E3C, // Dark green
                roughness: 0.3,
                metalness: 0.9
            }),
            simple: new THREE.MeshStandardMaterial({ color: 0x43A047 }),
            elephant: new THREE.MeshStandardMaterial({ color: 0x43A047 }),
            pirate: new THREE.MeshStandardMaterial({ color: 0x43A047 }),
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
            })
        };

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

        // Adjust shadow properties for maximum quality
        directionalLight.shadow.mapSize.width = 4096; // Very high resolution shadow map
        directionalLight.shadow.mapSize.height = 4096;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 80; // Extended range
        directionalLight.shadow.camera.left = -30;
        directionalLight.shadow.camera.right = 30;
        directionalLight.shadow.camera.top = 30;
        directionalLight.shadow.camera.bottom = -30;
        
        // Improve shadow quality and darkness
        directionalLight.shadow.bias = -0.0001; // Reduces shadow acne
        directionalLight.shadow.normalBias = 0.01; // Helps with thin objects 
        directionalLight.shadow.darkness = 0.8; // More intense shadow darkness
        
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
        
        // Add spot light for dramatic tower shadows
        const spotLight = new THREE.SpotLight(0xffffff, 0.8);
        spotLight.position.set(0, 25, 5);
        spotLight.angle = Math.PI / 4;
        spotLight.penumbra = 0.1;
        spotLight.decay = 1;
        spotLight.distance = 80;
        spotLight.castShadow = true;
        spotLight.shadow.mapSize.width = 2048;
        spotLight.shadow.mapSize.height = 2048;
        spotLight.shadow.camera.near = 1;
        spotLight.shadow.camera.far = 80;
        this.scene.add(spotLight);
        
        // Add subtle rim light for cartoon effect
        const rimLight = new THREE.DirectionalLight(0x80ff80, 0.3);
        rimLight.position.set(0, 10, -20);
        this.scene.add(rimLight);
    }

    render(game) {
        // Update camera controls
        this.controls.update();
        
        // Update rotation state - if it's been more than 50ms since a control update,
        // we can consider the rotation to have stopped (much more responsive)
        if (this.isRotating && (Date.now() - this.lastControlsUpdate > 50)) {
            this.isRotating = false;
        }

        // Toggle debug helpers
        this.gridHelper.visible = game.debugMode;
        
        // Toggle shadow camera helper in debug mode
        if (this.shadowHelper) {
            this.shadowHelper.visible = game.debugMode;
        }
        
        // Get current time
        const currentTime = performance.now() / 1000; // Convert to seconds for easier animation timing
        
        // Animate tower glows and particles
        game.towers.forEach(tower => {
            if (tower.mesh) {
                // Find the glow and particles in the tower mesh
                tower.mesh.traverse(child => {
                    // Animate glow effect
                    if (child.isMesh && child.material && child.material.side === THREE.BackSide) {
                        // Pulse the glow
                        const pulseSpeed = 2; // Pulse 2 times per second
                        const pulseAmount = 0.2; // Amount to pulse by
                        const baseOpacity = 0.3;
                        
                        // Calculate pulsing opacity
                        child.material.opacity = baseOpacity + pulseAmount * Math.sin(currentTime * pulseSpeed * Math.PI);
                        
                        // If tower is empowered, make glow stronger
                        if (tower.empowered) {
                            child.material.opacity += 0.2;
                            child.scale.set(1.2, 1.2, 1.2);
                        } else {
                            child.scale.set(1, 1, 1);
                        }
                    }
                    
                    // Animate particle effects
                    if (child.isPoints) {
                        // Rotate particles around the tower
                        const particlePhase = tower.mesh.userData.particleAnimationPhase || 0;
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
        
        // Animate projectile trails
        game.projectiles.forEach(projectile => {
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
            
            // Then update particles if they exist
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
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    createMap(mapData, gridSize) {
        const mapGroup = new THREE.Group();

        // Create a single seamless ground plane - no segments to avoid the middle line
        const groundGeometry = new THREE.PlaneGeometry(gridSize.width, gridSize.height, 1, 1); // Use just 1 segment
        
        // Create ground mesh with darker material for better shadow visibility
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2c8e43, // Darker green to show shadows better
            roughness: 1.0,  // Maximum roughness for shadow visibility
            metalness: 0.0,  // No metalness
            emissive: 0x0, // No emissive
            emissiveIntensity: 0, // No emissive glow
            side: THREE.FrontSide, // Only render front side
            depthWrite: true // Ensure proper depth writing
        });
        
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        
        // No vertex displacement - keeping it flat helps with shadow rendering
        
        ground.rotation.x = -Math.PI / 2; // Rotate to horizontal
        ground.position.y = 0; // EXACTLY at zero - critical for proper shading
        ground.receiveShadow = true; // Make ground receive shadows
        ground.userData.isGround = true; // Mark as ground for raycasting
        
        mapGroup.add(ground);
        
        // Add a subtle green glow layer above the ground, very faint to not interfere with shadows
        const glowGeometry = new THREE.PlaneGeometry(gridSize.width, gridSize.height);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x4AFF8D, // Bright mint green color
            transparent: true,
            opacity: 0.05, // Very faint glow to ensure shadows are visible
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
        let geometry;
        let material;
        
        // Extract base type and element
        let baseType = enemy.type;
        let elementType = 'neutral';
        
        // Set up shadow properties for all enemies
        this.enemyShadowIntensity = 0.95; // Make shadows very strong
        
        // Check if enemy type contains an element
        const elements = ['fire', 'water', 'earth', 'air', 'shadow'];
        for (const element of elements) {
            if (enemy.type.startsWith(element + '_')) {
                elementType = element;
                baseType = enemy.type.substring(element.length + 1);
                break;
            }
        }
        
        // Create mesh based on enemy type
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
                // Create a more complex shape for golem
                geometry = new THREE.DodecahedronGeometry(0.4, 0);
                break;
            default:
                geometry = new THREE.SphereGeometry(0.3, 16, 16);
        }
        
        // Create material based on element
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
                        material = this.materials.simple;
                }
        }

        // Force shadow casting on all enemy materials
        if (material) {
            material.shadowSide = THREE.FrontSide; // Force proper shadow rendering
            material.transparent = true; // Ensure transparency works with shadows
            material.opacity = 0.95; // Very subtle transparency to improve shadow quality
        }
        
        const mesh = new THREE.Mesh(geometry, material);
        // Enhanced shadow settings for enemies
        mesh.castShadow = true;
        mesh.receiveShadow = true; // Allow enemies to receive shadows from other objects
        
        // Add a dark shadow plane below the enemy that moves with it
        const shadowSize = 0.6; // Size of shadow plane
        const shadowPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(shadowSize, shadowSize),
            new THREE.MeshBasicMaterial({
                color: 0x000000,
                transparent: true,
                opacity: 0.4, // Dark but see-through shadow
                depthWrite: false // Prevent z-fighting
            })
        );
        shadowPlane.rotation.x = -Math.PI / 2; // Align with ground
        shadowPlane.position.y = -0.49; // Just above ground level
        mesh.add(shadowPlane); // Add to enemy so it moves with it
        
        // Add some decorative features based on enemy type
        if (baseType === 'elephant') {
            // Add "tusks" to elephant
            const tuskGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8);
            
            const tusk1 = new THREE.Mesh(
                tuskGeometry, 
                new THREE.MeshStandardMaterial({ 
                    color: 0xecf0f1, 
                    roughness: 0.5 
                })
            );
            tusk1.position.set(0.15, -0.1, 0.3);
            tusk1.rotation.x = Math.PI / 3;
            
            const tusk2 = tusk1.clone();
            tusk2.position.set(-0.15, -0.1, 0.3);
            
            mesh.add(tusk1, tusk2);
        } else if (baseType === 'pirate') {
            // Add "hat" to pirate
            const hatGeometry = new THREE.CylinderGeometry(0.2, 0.4, 0.1, 8);
            const hat = new THREE.Mesh(
                hatGeometry, 
                new THREE.MeshStandardMaterial({ 
                    color: 0x2c3e50, 
                    roughness: 0.7 
                })
            );
            hat.position.set(0, 0.3, 0);
            
            mesh.add(hat);
        } else if (baseType === 'golem') {
            // Add glowing eyes to golem
            const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 8);
            const eyeMaterial = new THREE.MeshBasicMaterial({ 
                color: elementType === 'neutral' ? 0xff0000 : material.color,
                emissive: material.emissive,
                emissiveIntensity: 1.0
            });
            
            const eye1 = new THREE.Mesh(eyeGeometry, eyeMaterial);
            eye1.position.set(0.15, 0.1, 0.3);
            
            const eye2 = eye1.clone();
            eye2.position.set(-0.15, 0.1, 0.3);
            
            mesh.add(eye1, eye2);
        }
        
        // Add elemental effect based on type
        if (elementType !== 'neutral') {
            // Add glow effect
            const glowGeometry = new THREE.SphereGeometry(0.4, 16, 16);
            const glowColor = material.color.clone();
            
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: glowColor,
                transparent: true,
                opacity: 0.3,
                side: THREE.BackSide
            });
            
            const glow = new THREE.Mesh(glowGeometry, glowMaterial);
            mesh.add(glow);
            
            // Add elemental particles
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
                color: glowColor,
                size: 0.08,
                transparent: true,
                opacity: 0.7
            });
            
            const particles = new THREE.Points(particleGeometry, particleMaterial);
            mesh.add(particles);
            
            // Store for animation
            mesh.userData.elementParticles = particles;
            mesh.userData.elementType = elementType;
        }

        // Add health bar
        const healthBarData = this.createHealthBar();
        mesh.add(healthBarData.group);

        // Store the health bar data in the mesh's userData for later access
        mesh.userData.healthBar = healthBarData;

        this.scene.add(mesh);
        return mesh;
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
        // Create a group for the tower and its components
        const towerGroup = new THREE.Group();
        let baseMaterial, topMaterial;
        
        // Determine if this is a special tower or basic tower
        // Special towers: any tower with elemental type or cannon/doubleArrow
        const isSpecialTower = tower.element !== ElementTypes.NEUTRAL || 
                              tower.type === 'cannon' || 
                              tower.type === 'doubleArrow';

        // Get element style if tower has an element
        const elementStyle = tower.element && ElementStyles[tower.element] ? 
            ElementStyles[tower.element] : 
            { color: 0x388E3C, emissive: 0x2E7D32, particleColor: 0x4CAF50 };
        
        // Create materials based on element
        baseMaterial = new THREE.MeshStandardMaterial({ 
            color: elementStyle.color, 
            roughness: 0.5,
            metalness: 0.7,
            emissive: elementStyle.emissive,
            emissiveIntensity: 0.3
        });
        
        topMaterial = new THREE.MeshStandardMaterial({ 
            color: elementStyle.color, 
            roughness: 0.4,
            metalness: 0.8,
            emissive: elementStyle.emissive,
            emissiveIntensity: 0.5
        });

        // Create the tower base - taller for better visibility
        const baseGeometry = new THREE.CylinderGeometry(0.4, 0.5, 0.6, 8);
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = 0.3; // Position above ground, higher now
        
        // Add a wider foundation base connecting to the ground - thicker and wider
        const foundationGeometry = new THREE.CylinderGeometry(0.55, 0.6, 0.1, 8);
        const foundationMaterial = new THREE.MeshStandardMaterial({
            color: baseMaterial.color.clone(),
            roughness: baseMaterial.roughness,
            metalness: baseMaterial.metalness,
            emissive: baseMaterial.emissive,
            emissiveIntensity: baseMaterial.emissiveIntensity,
            polygonOffset: true,      // Enable polygon offset
            polygonOffsetFactor: 1,   // Move geometry away from camera
            polygonOffsetUnits: 1     // Further reduce z-fighting
        });
        const foundation = new THREE.Mesh(foundationGeometry, foundationMaterial);
        foundation.position.y = 0.05; // Slightly above ground level to prevent z-fighting
        
        // Enhanced shadow settings for tower base
        base.castShadow = true;
        base.receiveShadow = true;
        
        // Create a shadow effect using a blob decal instead of a plane
        // This prevents z-fighting with the ground
        const shadowSize = 1.0; // Size of shadow
        
        // Create points for a circular shadow (more natural looking than a square)
        const shadowShape = new THREE.Shape();
        shadowShape.moveTo(0, 0);
        shadowShape.absarc(0, 0, shadowSize/2, 0, Math.PI * 2, false);
        
        const shadowGeometry = new THREE.ShapeGeometry(shadowShape);
        const shadowMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.25, // More subtle shadow
            depthWrite: false, // Prevent z-fighting
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1
        });
        
        const shadowPlane = new THREE.Mesh(shadowGeometry, shadowMaterial);
        shadowPlane.rotation.x = -Math.PI / 2; // Align with ground
        shadowPlane.position.y = 0.02; // Just above ground level
        shadowPlane.renderOrder = -1; // Render before other objects
        towerGroup.add(shadowPlane); // Add shadow
        
        towerGroup.add(base);
        towerGroup.add(foundation); // Add foundation to connect tower to ground

        // Add top part - different for each tower type
        let top;
        
        // Check if it's an elemental tower type
        if (tower.type.includes('_')) {
            // It's an elemental tower, extract the element and level
            const [element, level] = tower.type.split('_');
            
            // Create more visually unique towers based on element
            switch (element) {
                case 'fire':
                    // Fire tower - flame or volcano-like shape with particles
                    const fireGroup = new THREE.Group();
                    
                    // Base shape for fire tower (tapered cylinder)
                    const fireCone = new THREE.Mesh(
                        new THREE.ConeGeometry(0.35, 0.7, 8),
                        topMaterial
                    );
                    fireCone.position.y = 0.9; // Higher to match taller base
                    fireGroup.add(fireCone);
                    
                    // For advanced fire tower, add extra details
                    if (level === 'advanced') {
                        // Add a center flame
                        const flameCore = new THREE.Mesh(
                            new THREE.ConeGeometry(0.15, 0.4, 8),
                            new THREE.MeshStandardMaterial({ 
                                color: 0xFF9800, // More orange center
                                emissive: 0xFF5722,
                                emissiveIntensity: 0.8
                            })
                        );
                        flameCore.position.y = 1.0;
                        fireGroup.add(flameCore);
                    }
                    
                    top = fireGroup;
                    break;
                    
                case 'water':
                    // Water tower - flowing, curved shape
                    const waterGroup = new THREE.Group();
                    
                    // Sphere base for water tower
                    const waterSphere = new THREE.Mesh(
                        new THREE.SphereGeometry(0.35, 12, 12),
                        topMaterial
                    );
                    waterSphere.position.y = 0.9;
                    waterGroup.add(waterSphere);
                    
                    // Add water jets/fountains for advanced tower
                    if (level === 'advanced') {
                        // Create multiple curved tubes
                        for (let i = 0; i < 3; i++) {
                            const curve = new THREE.QuadraticBezierCurve3(
                                new THREE.Vector3(0, 0.7, 0),
                                new THREE.Vector3(Math.cos(i * Math.PI * 2/3) * 0.3, 1.0, Math.sin(i * Math.PI * 2/3) * 0.3),
                                new THREE.Vector3(Math.cos(i * Math.PI * 2/3) * 0.2, 1.2, Math.sin(i * Math.PI * 2/3) * 0.2)
                            );
                            
                            const tubeGeometry = new THREE.TubeGeometry(curve, 8, 0.05, 8, false);
                            const tubeMaterial = new THREE.MeshStandardMaterial({
                                color: 0x4FC3F7,
                                transparent: true,
                                opacity: 0.8
                            });
                            
                            const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
                            waterGroup.add(tube);
                        }
                    }
                    
                    top = waterGroup;
                    break;
                    
                case 'earth':
                    // Earth tower - rocky, solid shape
                    const earthGroup = new THREE.Group();
                    
                    // Create a base rock formation
                    const rockBase = new THREE.Mesh(
                        new THREE.DodecahedronGeometry(0.35, 0),
                        topMaterial
                    );
                    rockBase.position.y = 0.9;
                    earthGroup.add(rockBase);
                    
                    // For advanced, add extra rock formations
                    if (level === 'advanced') {
                        // Add smaller rocks on top
                        for (let i = 0; i < 3; i++) {
                            const smallRock = new THREE.Mesh(
                                new THREE.DodecahedronGeometry(0.15, 0),
                                topMaterial
                            );
                            
                            // Position randomly on top of base
                            smallRock.position.set(
                                (Math.random() - 0.5) * 0.3,
                                0.9 + Math.random() * 0.2,
                                (Math.random() - 0.5) * 0.3
                            );
                            
                            // Random rotation
                            smallRock.rotation.set(
                                Math.random() * Math.PI,
                                Math.random() * Math.PI,
                                Math.random() * Math.PI
                            );
                            
                            earthGroup.add(smallRock);
                        }
                    }
                    
                    top = earthGroup;
                    break;
                    
                case 'air':
                    // Air tower - light, airy design with motion
                    const airGroup = new THREE.Group();
                    
                    // Create a central floating orb
                    const airOrb = new THREE.Mesh(
                        new THREE.SphereGeometry(0.25, 12, 12),
                        new THREE.MeshStandardMaterial({ 
                            color: 0xECEFF1,
                            transparent: true,
                            opacity: 0.8,
                            emissive: 0xCFD8DC,
                            emissiveIntensity: 0.5
                        })
                    );
                    airOrb.position.y = 0.8;
                    airGroup.add(airOrb);
                    
                    // Add floating rings for both basic and advanced
                    const ringCount = level === 'advanced' ? 3 : 1;
                    for (let i = 0; i < ringCount; i++) {
                        const ring = new THREE.Mesh(
                            new THREE.TorusGeometry(0.3, 0.05, 8, 24),
                            new THREE.MeshStandardMaterial({ 
                                color: 0xB0BEC5,
                                transparent: true,
                                opacity: 0.7
                            })
                        );
                        
                        // Position around orb
                        ring.position.y = 0.8;
                        
                        // Set different orientations
                        if (i === 0) {
                            ring.rotation.x = Math.PI/2;
                        } else if (i === 1) {
                            ring.rotation.y = Math.PI/2;
                        }
                        
                        airGroup.add(ring);
                        
                        // Store in userData for animation
                        airGroup.userData.rings = airGroup.userData.rings || [];
                        airGroup.userData.rings.push(ring);
                    }
                    
                    top = airGroup;
                    break;
                    
                case 'shadow':
                    // Shadow tower - dark, mysterious with void effects
                    const shadowGroup = new THREE.Group();
                    
                    // Create a dark core
                    const shadowCore = new THREE.Mesh(
                        new THREE.OctahedronGeometry(0.3, 0),
                        new THREE.MeshStandardMaterial({ 
                            color: 0x4A148C,
                            emissive: 0x311B92,
                            emissiveIntensity: 0.7
                        })
                    );
                    shadowCore.position.y = 0.9;
                    shadowGroup.add(shadowCore);
                    
                    // Add floating dark matter particles
                    if (level === 'advanced') {
                        // Add extra void sphere
                        const voidSphere = new THREE.Mesh(
                            new THREE.SphereGeometry(0.4, 12, 12),
                            new THREE.MeshBasicMaterial({
                                color: 0x7E57C2,
                                transparent: true,
                                opacity: 0.3,
                                side: THREE.BackSide
                            })
                        );
                        voidSphere.position.y = 0.9;
                        shadowGroup.add(voidSphere);
                    }
                    
                    top = shadowGroup;
                    break;
                    
                default:
                    // Fallback to basic tower shape
                    top = new THREE.Mesh(
                        new THREE.ConeGeometry(0.3, 0.6, 8),
                        topMaterial
                    );
                    top.position.y = 0.9;
            }
        } else {
            // Standard tower types
            switch (tower.type) {
                case 'arrow':
                    // Cone-shaped top for arrow tower
                    const topGeometry = new THREE.ConeGeometry(0.3, 0.6, 8);
                    top = new THREE.Mesh(topGeometry, topMaterial);
                    top.position.y = 0.9; // Position above the base
                    break;
                    
                case 'doubleArrow':
                    // Double-pointed top for double arrow tower
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
                    // Sphere and cylinder for cannon tower
                    const cannonGroup = new THREE.Group();
                    
                    const sphere = new THREE.Mesh(
                        new THREE.SphereGeometry(0.35, 12, 12),
                        topMaterial
                    );
                    sphere.position.y = 0.9;
                    
                    const barrel = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.2, 0.2, 0.6, 12),
                        new THREE.MeshStandardMaterial({ 
                            color: 0x212121,
                            roughness: 0.3,
                            metalness: 0.9
                        })
                    );
                    barrel.position.set(0, 0.7, 0.4);
                    barrel.rotation.x = Math.PI/2;
                    
                    cannonGroup.add(sphere, barrel);
                    top = cannonGroup;
                    break;
                    
                default:
                    // Default simple top
                    top = new THREE.Mesh(
                        new THREE.BoxGeometry(0.4, 0.4, 0.4),
                        topMaterial
                    );
                    top.position.y = 0.9;
            }
        }
        
        // Enhanced shadow settings for tower tops
        top.castShadow = true;
        top.receiveShadow = true;
        
        // Make sure all parts of nested groups can cast shadows
        if (top.isGroup) {
            top.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
        }
        
        towerGroup.add(top);
        
        // Add a glow effect only to special towers
        if (isSpecialTower) {
            // Create glow mesh
            const glowGeometry = new THREE.SphereGeometry(0.9, 16, 16);
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: elementStyle.particleColor,
                transparent: true,
                opacity: 0.3,
                side: THREE.BackSide,
                depthWrite: false, // Don't write to depth buffer for better shadow rendering
                blending: THREE.AdditiveBlending // Enhanced glow effect
            });
            
            const glow = new THREE.Mesh(glowGeometry, glowMaterial);
            glow.position.y = 1.0; // Position at the top part - higher now for taller towers
            glow.renderOrder = 5; // Ensure proper rendering order
            towerGroup.add(glow);
        }
        
        // For more powerful towers or elemental types, add particle effects
        if (isSpecialTower) {
            const particleGeometry = new THREE.BufferGeometry();
            const particleCount = 10;
            const particlePositions = new Float32Array(particleCount * 3);
            
            // Create particles around the tower
            for (let i = 0; i < particleCount; i++) {
                const i3 = i * 3;
                // Random position in a sphere
                const radius = 0.6 + Math.random() * 0.3;
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.random() * Math.PI;
                
                particlePositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
                particlePositions[i3 + 1] = 0.5 + Math.random() * 0.5; // Y position
                particlePositions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
            }
            
            particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
            
            const particleMaterial = new THREE.PointsMaterial({
                color: elementStyle.particleColor,
                size: 0.1,
                transparent: true,
                opacity: 0.7,
                blending: THREE.AdditiveBlending
            });
            
            const particles = new THREE.Points(particleGeometry, particleMaterial);
            towerGroup.add(particles);
            
            // Store animation data
            towerGroup.userData.particles = particles;
            towerGroup.userData.particleAnimationPhase = Math.random() * Math.PI * 2;
        }

        // Add tower range indicator (circle with better visibility)
        const rangeGeometry = new THREE.RingGeometry(tower.range - 0.05, tower.range, 32);
        const rangeMaterial = new THREE.MeshBasicMaterial({
            color: elementStyle.particleColor,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });

        const rangeIndicator = new THREE.Mesh(rangeGeometry, rangeMaterial);
        rangeIndicator.rotation.x = -Math.PI / 2; // Rotate to horizontal
        rangeIndicator.position.y = 0.02; // Slightly above ground
        rangeIndicator.visible = false; // Hidden by default

        towerGroup.add(rangeIndicator);
        towerGroup.userData.rangeIndicator = rangeIndicator;

        this.scene.add(towerGroup);
        return towerGroup;
    }

    createProjectile(projectile) {
        let geometry;
        let material;
        
        // Get element style if projectile has an element
        const elementStyle = projectile.element && ElementStyles[projectile.element] ? 
            ElementStyles[projectile.element] : 
            { color: 0x76FF03, emissive: 0x33691E, particleColor: 0xA0FF4C };

        // Create geometry and material based on projectile type
        switch (projectile.type) {
            case 'arrow':
                // Arrow-like projectile
                geometry = new THREE.ConeGeometry(0.08, 0.4, 8);
                material = new THREE.MeshStandardMaterial({ 
                    color: elementStyle.color,
                    emissive: elementStyle.emissive,
                    emissiveIntensity: 0.8,
                    roughness: 0.3,
                    metalness: 0.8
                });
                break;
                
            case 'doubleArrow':
                // Energy ball for double arrow
                geometry = new THREE.SphereGeometry(0.15, 12, 12);
                material = new THREE.MeshStandardMaterial({ 
                    color: elementStyle.color,
                    emissive: elementStyle.emissive,
                    emissiveIntensity: 0.9,
                    roughness: 0.2,
                    metalness: 0.9,
                    transparent: true,
                    opacity: 0.9
                });
                break;
                
            case 'cannon':
                // Cannonball with trail effect
                geometry = new THREE.SphereGeometry(0.2, 12, 12);
                material = new THREE.MeshStandardMaterial({ 
                    color: elementStyle.color,
                    emissive: elementStyle.emissive,
                    emissiveIntensity: 0.7,
                    roughness: 0.1,
                    metalness: 1.0
                });
                break;
                
            case 'fire':
                // Fire projectile
                geometry = new THREE.SphereGeometry(0.15, 12, 12);
                material = new THREE.MeshStandardMaterial({ 
                    color: elementStyle.color,
                    emissive: elementStyle.emissive,
                    emissiveIntensity: 1.0,
                    roughness: 0.2,
                    metalness: 0.7,
                    transparent: true,
                    opacity: 0.9
                });
                break;
            
            case 'water':
                // Water projectile
                geometry = new THREE.SphereGeometry(0.15, 12, 12);
                material = new THREE.MeshStandardMaterial({ 
                    color: elementStyle.color,
                    emissive: elementStyle.emissive,
                    emissiveIntensity: 0.8,
                    roughness: 0.1,
                    metalness: 0.9,
                    transparent: true,
                    opacity: 0.8
                });
                break;
                
            case 'earth':
                // Earth projectile
                geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
                material = new THREE.MeshStandardMaterial({ 
                    color: elementStyle.color,
                    emissive: elementStyle.emissive,
                    emissiveIntensity: 0.5,
                    roughness: 0.8,
                    metalness: 0.3
                });
                break;
                
            case 'air':
                // Air projectile
                geometry = new THREE.TorusGeometry(0.12, 0.04, 8, 16);
                material = new THREE.MeshStandardMaterial({ 
                    color: elementStyle.color,
                    emissive: elementStyle.emissive,
                    emissiveIntensity: 0.7,
                    roughness: 0.2,
                    metalness: 0.8,
                    transparent: true,
                    opacity: 0.7
                });
                break;
                
            case 'shadow':
                // Shadow projectile
                geometry = new THREE.TetrahedronGeometry(0.15);
                material = new THREE.MeshStandardMaterial({ 
                    color: elementStyle.color,
                    emissive: elementStyle.emissive,
                    emissiveIntensity: 0.8,
                    roughness: 0.3,
                    metalness: 0.9,
                    transparent: true,
                    opacity: 0.8
                });
                break;
                
            default:
                geometry = new THREE.SphereGeometry(0.1, 8, 8);
                material = new THREE.MeshStandardMaterial({
                    color: elementStyle.color,
                    emissive: elementStyle.emissive,
                    emissiveIntensity: 0.5
                });
        }

        // Force shadow properties on projectile materials
        if (material) {
            material.shadowSide = THREE.FrontSide;
        }
        
        const mesh = new THREE.Mesh(geometry, material);
        // Enhanced shadow settings for projectiles
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // Optional: Add a small shadow projector that follows below the projectile
        if (projectile.type === 'cannon') { // Only for larger projectiles
            const shadowSize = 0.4;
            const shadowPlane = new THREE.Mesh(
                new THREE.PlaneGeometry(shadowSize, shadowSize),
                new THREE.MeshBasicMaterial({
                    color: 0x000000,
                    transparent: true,
                    opacity: 0.3,
                    depthWrite: false
                })
            );
            shadowPlane.rotation.x = -Math.PI / 2; // Align with ground
            shadowPlane.position.y = -100; // Start far away, will be updated in animation
            // Store for updating in animation
            mesh.userData.shadowProjector = shadowPlane;
            this.scene.add(shadowPlane);
        }
        
        // Add glowing halo to all projectiles
        const glowSize = (projectile.type === 'cannon') ? 0.35 : 
                        (projectile.type === 'arrow') ? 0.2 : 0.25;
        
        const glowGeometry = new THREE.SphereGeometry(glowSize, 12, 12);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: elementStyle.particleColor,
            transparent: true,
            opacity: 0.5,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending
        });
        
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        mesh.add(glow);
        
        // Add particle trail for special projectiles
        if (projectile.element !== ElementTypes.NEUTRAL || 
            projectile.type === 'doubleArrow' || 
            projectile.type === 'cannon') {
            
            // Create trail particle system
            const particleCount = 15;
            const particleGeometry = new THREE.BufferGeometry();
            const particlePositions = new Float32Array(particleCount * 3);
            
            // Initialize all particles at the center
            for (let i = 0; i < particleCount * 3; i++) {
                particlePositions[i] = 0;
            }
            
            particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
            
            const particleMaterial = new THREE.PointsMaterial({
                color: elementStyle.particleColor,
                size: 0.08,
                transparent: true,
                opacity: 0.7,
                blending: THREE.AdditiveBlending
            });
            
            const particles = new THREE.Points(particleGeometry, particleMaterial);
            mesh.add(particles);
            
            // Store particle system for animation
            mesh.userData.particles = particles;
            mesh.userData.particleAge = Array(particleCount).fill(0);
            mesh.userData.particleMaxAge = 0.5; // seconds
            mesh.userData.lastPosition = { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };
        }
        
        this.scene.add(mesh);
        return mesh;
    }

    createTowerPreview(towerType) {
        console.log("Creating tower preview for type:", towerType);
        
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
        console.log("Removing tower preview");
        if (this.previewMesh) {
            this.scene.remove(this.previewMesh);
            this.previewMesh = null;
        } else {
            console.log("No preview mesh to remove");
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
                (object.material === this.materials.arrow ||
                 object.material === this.materials.doubleArrow ||
                 object.material === this.materials.cannon)) {

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
        // Create portal group to contain all portal elements
        this.portalGroup = new THREE.Group();
        this.portalGroup.position.set(60, 5, 60); // Position it away from the main map
        this.portalGroup.rotation.x = Math.PI / 2; // Lay flat to be visible from above
        
        // Create portal effect (green torus)
        const portalGeometry = new THREE.TorusGeometry(7, 1, 16, 100);
        const portalMaterial = new THREE.MeshPhongMaterial({
            color: 0x00ff00,
            emissive: 0x00ff00,
            transparent: true,
            opacity: 0.8
        });
        const portal = new THREE.Mesh(portalGeometry, portalMaterial);
        portal.userData.isPortal = true;
        this.portalGroup.add(portal);
        
        // Create portal inner surface (green circle)
        const portalInnerGeometry = new THREE.CircleGeometry(6, 32);
        const portalInnerMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const portalInner = new THREE.Mesh(portalInnerGeometry, portalInnerMaterial);
        portalInner.position.z = 0.1; // Slight offset to avoid z-fighting
        portalInner.userData.isPortal = true;
        this.portalGroup.add(portalInner);
        
        // Add portal label
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 64;
        context.fillStyle = '#00ff00';
        context.font = 'bold 32px Arial';
        context.textAlign = 'center';
        context.fillText('VIBEVERSE PORTAL', canvas.width/2, canvas.height/2);
        const texture = new THREE.CanvasTexture(canvas);
        const labelGeometry = new THREE.PlaneGeometry(15, 2.5);
        const labelMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });
        const label = new THREE.Mesh(labelGeometry, labelMaterial);
        label.position.y = 10;
        label.rotation.x = -Math.PI / 2; // Rotate to face upward
        this.portalGroup.add(label);
        
        // Create particle system for portal effect
        const particleCount = 500;
        const particles = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount * 3; i += 3) {
            // Create particles in a ring around the portal
            const angle = Math.random() * Math.PI * 2;
            const radius = 7 + (Math.random() - 0.5) * 2;
            positions[i] = Math.cos(angle) * radius;
            positions[i + 1] = Math.sin(angle) * radius;
            positions[i + 2] = (Math.random() - 0.5) * 2;
            
            // Green color with slight variation
            colors[i] = 0;
            colors[i + 1] = 0.8 + Math.random() * 0.2;
            colors[i + 2] = 0;
        }
        
        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const particleMaterial = new THREE.PointsMaterial({
            size: 0.2,
            vertexColors: true,
            transparent: true,
            opacity: 0.6
        });
        
        this.portalParticleSystem = new THREE.Points(particles, particleMaterial);
        this.portalGroup.add(this.portalParticleSystem);
        
        // Add portal group to scene
        this.scene.add(this.portalGroup);
        
        // Start animation
        this.animatePortal();
        
        // Create raycaster for detecting clicks on portal
        this.setupPortalClickHandler();
    }
    
    animatePortal() {
        const animate = () => {
            if (this.portalParticleSystem) {
                const positions = this.portalParticleSystem.geometry.attributes.position.array;
                for (let i = 0; i < positions.length; i += 3) {
                    positions[i + 2] = 0.1 * Math.sin(Date.now() * 0.001 + i);
                }
                this.portalParticleSystem.geometry.attributes.position.needsUpdate = true;
            }
            
            if (this.portalGroup) {
                this.portalGroup.rotation.z += 0.005;
            }
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    setupPortalClickHandler() {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        
        // Handle both mouse clicks and touch events
        const handleInteraction = (event) => {
            // Prevent default behavior for touches
            if (event.preventDefault) event.preventDefault();
            
            // Get coordinates based on event type
            let clientX, clientY;
            
            if (event.type === 'touchstart' || event.type === 'touchend') {
                // Handle touch event
                const touch = event.changedTouches[0];
                clientX = touch.clientX;
                clientY = touch.clientY;
            } else {
                // Handle mouse event
                clientX = event.clientX;
                clientY = event.clientY;
            }
            
            // Calculate position in normalized device coordinates
            mouse.x = (clientX / this.canvasRef.clientWidth) * 2 - 1;
            mouse.y = -(clientY / this.canvasRef.clientHeight) * 2 + 1;
            
            // Update the raycaster
            raycaster.setFromCamera(mouse, this.camera);
            
            // Check for intersections with portal
            const intersects = raycaster.intersectObjects(this.portalGroup.children, true);
            
            // If there's an intersection and the object is the portal, redirect
            if (intersects.length > 0 && intersects[0].object.userData.isPortal) {
                this.redirectToVibeverse();
            }
        };
        
        // Add event listeners for both mouse and touch
        this.canvasRef.addEventListener('click', handleInteraction);
        this.canvasRef.addEventListener('touchend', handleInteraction, { passive: false });
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
        
        // Redirect to the Vibeverse portal
        window.location.href = `https://portal.pieter.com?${params.toString()}`;
    }
}