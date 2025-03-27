
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ElementTypes, ElementStyles } from './elements.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(25, window.innerWidth / window.innerHeight, 0.1, 1000);

        // Set up renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000); // Black background
        this.renderer.shadowMap.enabled = true;

        // Set up camera
        this.camera.position.set(0, 50, 40);
        this.camera.lookAt(0, 0, 0);

        // Set up controls for camera movement
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.25;
        this.controls.maxPolarAngle = Math.PI / 2.5; // Limit camera angle

        // Set up lights
        this.setupLights();

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
            gridHighlight: new THREE.MeshBasicMaterial({
                color: 0x4CAF50,
                transparent: true,
                opacity: 0.7
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

        // Grid cell highlight for tower placement
        this.gridHighlight = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            this.materials.gridHighlight
        );
        this.gridHighlight.rotation.x = -Math.PI / 2; // Rotate to horizontal
        this.gridHighlight.position.y = 0.02; // Slightly above ground to prevent z-fighting
        this.gridHighlight.visible = false;
        this.scene.add(this.gridHighlight);
    }

    setupLights() {
        // Ambient light - slightly greenish tint for cartoon effect
        const ambientLight = new THREE.AmbientLight(0xc0ffc0, 0.4);
        this.scene.add(ambientLight);

        // Main directional light (sunlight) - warmer tone
        const directionalLight = new THREE.DirectionalLight(0xfffaf0, 1.0);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;

        // Adjust shadow properties for better quality
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -15;
        directionalLight.shadow.camera.right = 15;
        directionalLight.shadow.camera.top = 15;
        directionalLight.shadow.camera.bottom = -15;
        this.scene.add(directionalLight);
        
        // Add a secondary fill light from the opposite side (cooler tone)
        const fillLight = new THREE.DirectionalLight(0xc0e0ff, 0.5);
        fillLight.position.set(-10, 15, -10);
        this.scene.add(fillLight);
        
        // Add subtle rim light for cartoon effect
        const rimLight = new THREE.DirectionalLight(0x80ff80, 0.3);
        rimLight.position.set(0, 10, -15);
        this.scene.add(rimLight);
    }

    render(game) {
        // Update camera controls
        this.controls.update();

        // Toggle debug helpers
        this.gridHelper.visible = game.debugMode;
        
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
            
            // Very slow pulsing for the ground glow
            const pulseAmount = 0.03;
            const pulseSpeed = 0.2; // Very slow pulse
            glowLayer.material.opacity = 0.07 + pulseAmount * Math.sin(currentTime * pulseSpeed);
        }
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    createMap(mapData, gridSize) {
        const mapGroup = new THREE.Group();

        // Create ground with more detail for grass appearance
        const groundGeometry = new THREE.PlaneGeometry(gridSize.width, gridSize.height, 32, 32);
        
        // Create ground mesh with cartoon-style grass material with subtle glow
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2E8B57, // Sea green
            roughness: 0.7,
            metalness: 0.2,
            emissive: 0x1E6E3E, // Darker green for emissive
            emissiveIntensity: 0.2 // Subtle emissive glow
        });
        
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        
        // Add subtle vertex displacement for grass texture effect
        const vertices = ground.geometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            // Don't modify X or Z coordinates (i, i+2), only Y (i+1)
            // Add very small random displacement for grass effect
            vertices[i+1] = (Math.random() * 0.05); 
        }
        
        // Update geometry
        ground.geometry.attributes.position.needsUpdate = true;
        ground.geometry.computeVertexNormals();
        
        ground.rotation.x = -Math.PI / 2; // Rotate to horizontal
        ground.receiveShadow = true;
        mapGroup.add(ground);
        
        // Add a subtle glow layer above the ground for cartoonish effect
        const glowGeometry = new THREE.PlaneGeometry(gridSize.width, gridSize.height);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x66FF99,
            transparent: true,
            opacity: 0.07,
            blending: THREE.AdditiveBlending
        });
        
        const glowLayer = new THREE.Mesh(glowGeometry, glowMaterial);
        glowLayer.rotation.x = -Math.PI / 2; // Rotate to horizontal
        glowLayer.position.y = 0.03; // Slightly above ground
        mapGroup.add(glowLayer);
        
        // Store reference for animation
        mapGroup.userData.glowLayer = glowLayer;

        // Create special material for restricted area
        const restrictedMaterial = new THREE.MeshStandardMaterial({
            color: 0xFF6347, // Tomato red
            transparent: true,
            opacity: 0.5,
            roughness: 0.8,
            metalness: 0.1
        });

        // Create path tiles
        for (let z = 0; z < mapData.length; z++) {
            for (let x = 0; x < mapData[z].length; x++) {
                const cell = mapData[z][x];

                // Skip empty cells
                if (cell === 0) continue;

                // Create appropriate tile based on cell type
                let tileMaterial;

                if (cell === 1) { // Path
                    // Check if this is in entry, exit or restricted area
                    if (z === 0) {
                        // Entry area - use a distinct color
                        tileMaterial = new THREE.MeshStandardMaterial({
                            color: 0x4169E1, // Royal Blue
                            transparent: true,
                            opacity: 0.6,
                            roughness: 0.8,
                            metalness: 0.1
                        });
                    } else if (z === mapData.length - 1) {
                        // Exit area - use a distinct color
                        tileMaterial = new THREE.MeshStandardMaterial({
                            color: 0x9932CC, // Dark Orchid
                            transparent: true,
                            opacity: 0.6,
                            roughness: 0.8,
                            metalness: 0.1
                        });
                    } else if (z >= mapData.length - 4 && z < mapData.length - 1) {
                        // Restricted area
                        tileMaterial = restrictedMaterial;
                    } else {
                        tileMaterial = this.materials.path;
                    }
                } else if (cell === 2) { // Water/obstacle
                    tileMaterial = this.materials.water;
                } else {
                    continue; // Skip other cell types
                }

                const tileGeometry = new THREE.BoxGeometry(0.95, 0.1, 0.95);
                const tile = new THREE.Mesh(tileGeometry, tileMaterial);

                // Position tile in grid
                tile.position.set(
                    x - gridSize.width / 2 + 0.5,
                    0.05, // Slightly above ground
                    z - gridSize.height / 2 + 0.5
                );

                tile.receiveShadow = true;
                mapGroup.add(tile);
            }
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

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        
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

        // Create the base (cylindrical base)
        const baseGeometry = new THREE.CylinderGeometry(0.4, 0.5, 0.4, 8);
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = 0.2; // Position at half height
        base.castShadow = true;
        towerGroup.add(base);

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
                    fireCone.position.y = 0.7;
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
                    waterSphere.position.y = 0.7;
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
                    rockBase.position.y = 0.7;
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
                    shadowCore.position.y = 0.7;
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
                        voidSphere.position.y = 0.7;
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
                    top.position.y = 0.7;
            }
        } else {
            // Standard tower types
            switch (tower.type) {
                case 'arrow':
                    // Cone-shaped top for arrow tower
                    const topGeometry = new THREE.ConeGeometry(0.3, 0.6, 8);
                    top = new THREE.Mesh(topGeometry, topMaterial);
                    top.position.y = 0.7; // Position above the base
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
                    sphere.position.y = 0.7;
                    
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
                    top.position.y = 0.7;
            }
        }
        
        top.castShadow = true;
        towerGroup.add(top);
        
        // Add a glow effect only to special towers
        if (isSpecialTower) {
            // Create glow mesh
            const glowGeometry = new THREE.SphereGeometry(0.8, 16, 16);
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: elementStyle.particleColor,
                transparent: true,
                opacity: 0.3,
                side: THREE.BackSide
            });
            
            const glow = new THREE.Mesh(glowGeometry, glowMaterial);
            glow.position.y = 0.7; // Position at the top part
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

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        
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
        // Remove existing preview if any
        if (this.previewMesh) {
            this.scene.remove(this.previewMesh);
        }

        // Create a group for the preview tower
        const previewGroup = new THREE.Group();
        let baseMaterial, topMaterial;

        // Set transparent materials for preview
        switch (towerType) {
            case 'arrow':
                baseMaterial = new THREE.MeshBasicMaterial({
                    color: 0x4CAF50,
                    transparent: true,
                    opacity: 0.6,
                    wireframe: false
                });
                topMaterial = new THREE.MeshBasicMaterial({
                    color: 0x388E3C,
                    transparent: true,
                    opacity: 0.6,
                    wireframe: false
                });
                break;
            case 'doubleArrow':
                baseMaterial = new THREE.MeshBasicMaterial({
                    color: 0x66BB6A,
                    transparent: true,
                    opacity: 0.6,
                    wireframe: false
                });
                topMaterial = new THREE.MeshBasicMaterial({
                    color: 0x4CAF50,
                    transparent: true,
                    opacity: 0.6,
                    wireframe: false
                });
                break;
            case 'cannon':
                baseMaterial = new THREE.MeshBasicMaterial({
                    color: 0x388E3C,
                    transparent: true,
                    opacity: 0.6,
                    wireframe: false
                });
                topMaterial = new THREE.MeshBasicMaterial({
                    color: 0x2E7D32,
                    transparent: true,
                    opacity: 0.6,
                    wireframe: false
                });
                break;
            default:
                baseMaterial = new THREE.MeshBasicMaterial({
                    color: 0x4CAF50,
                    transparent: true,
                    opacity: 0.6,
                    wireframe: false
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
                top.position.y = 0.7;
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
                sphere.position.y = 0.7;
                
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
                top.position.y = 0.7;
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
        if (this.previewMesh) {
            this.scene.remove(this.previewMesh);
            this.previewMesh = null;
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
        
        // Update opacity for better visibility
        this.gridHighlight.material.opacity = isValid ? 0.5 : 0.7;

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
    
    cleanupScene() {
        // Remove all non-essential objects from the scene
        const objectsToKeep = [];
        
        // Keep track of which objects to keep (like ground, lights, grid helpers)
        this.scene.traverse(object => {
            // Keep lights
            if (object.isLight) {
                objectsToKeep.push(object);
            }
            
            // Keep the ground and path
            if (object.userData && object.userData.isGround) {
                objectsToKeep.push(object);
            }
            
            // Keep the grid helper
            if (object === this.gridHelper || object === this.gridHighlight) {
                objectsToKeep.push(object);
            }
        });
        
        // Remove everything else
        while (this.scene.children.length > 0) {
            this.scene.remove(this.scene.children[0]);
        }
        
        // Add back the objects we want to keep
        for (const object of objectsToKeep) {
            this.scene.add(object);
        }
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
}