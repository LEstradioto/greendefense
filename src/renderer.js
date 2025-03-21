
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    createMap(mapData, gridSize) {
        const mapGroup = new THREE.Group();

        // Create ground with more detail for grass appearance
        const groundGeometry = new THREE.PlaneGeometry(gridSize.width, gridSize.height, 32, 32);
        
        // Create ground mesh with cartoon-style grass material
        const ground = new THREE.Mesh(groundGeometry, this.materials.ground);
        
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

        // Create mesh based on enemy type
        switch (enemy.type) {
            case 'simple':
                geometry = new THREE.SphereGeometry(0.3, 16, 16);
                material = this.materials.simple;
                break;
            case 'elephant':
                geometry = new THREE.BoxGeometry(0.5, 0.5, 0.7);
                material = this.materials.elephant;
                break;
            case 'pirate':
                geometry = new THREE.ConeGeometry(0.3, 0.8, 5);
                material = this.materials.pirate;
                break;
            default:
                geometry = new THREE.SphereGeometry(0.3, 16, 16);
                material = this.materials.simple;
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;

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

        // Set materials based on tower type (base and top can be different)
        switch (tower.type) {
            case 'arrow':
                baseMaterial = this.materials.arrow;
                topMaterial = new THREE.MeshStandardMaterial({ 
                    color: 0x388E3C, 
                    roughness: 0.5,
                    metalness: 0.7
                });
                break;
            case 'doubleArrow':
                baseMaterial = this.materials.doubleArrow;
                topMaterial = new THREE.MeshStandardMaterial({ 
                    color: 0x4CAF50, 
                    roughness: 0.5,
                    metalness: 0.8
                });
                break;
            case 'cannon':
                baseMaterial = this.materials.cannon;
                topMaterial = new THREE.MeshStandardMaterial({ 
                    color: 0x2E7D32, 
                    roughness: 0.3,
                    metalness: 0.9
                });
                break;
            default:
                baseMaterial = this.materials.arrow;
                topMaterial = this.materials.arrow;
        }

        // Create the base (cylindrical base)
        const baseGeometry = new THREE.CylinderGeometry(0.4, 0.5, 0.4, 8);
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = 0.2; // Position at half height
        base.castShadow = true;
        towerGroup.add(base);

        // Add top part - different for each tower type
        let top;
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
        
        top.castShadow = true;
        towerGroup.add(top);

        // Add tower range indicator (circle with better visibility)
        const rangeGeometry = new THREE.RingGeometry(tower.range - 0.05, tower.range, 32);
        const rangeMaterial = new THREE.MeshBasicMaterial({
            color: 0x4CAF50,
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

        // Create geometry and material based on projectile type
        switch (projectile.type) {
            case 'arrow':
                // Arrow-like projectile
                geometry = new THREE.ConeGeometry(0.08, 0.4, 8);
                material = new THREE.MeshStandardMaterial({ 
                    color: 0x76FF03,
                    emissive: 0x33691E,
                    emissiveIntensity: 0.5,
                    roughness: 0.3,
                    metalness: 0.8
                });
                break;
                
            case 'doubleArrow':
                // Energy ball for double arrow
                geometry = new THREE.SphereGeometry(0.15, 12, 12);
                material = new THREE.MeshStandardMaterial({ 
                    color: 0xB9F6CA,
                    emissive: 0x00C853,
                    emissiveIntensity: 0.7,
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
                    color: 0x004D40,
                    emissive: 0x00BFA5,
                    emissiveIntensity: 0.3,
                    roughness: 0.1,
                    metalness: 1.0
                });
                break;
                
            default:
                geometry = new THREE.SphereGeometry(0.1, 8, 8);
                material = this.materials.projectile;
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        
        // Add trail/glow effect for some projectiles
        if (projectile.type === 'doubleArrow' || projectile.type === 'cannon') {
            // Add a glowing halo
            const glowGeometry = new THREE.SphereGeometry(
                projectile.type === 'doubleArrow' ? 0.25 : 0.3, 
                12, 12
            );
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: projectile.type === 'doubleArrow' ? 0x69F0AE : 0x00BFA5,
                transparent: true,
                opacity: 0.4,
                side: THREE.BackSide
            });
            
            const glow = new THREE.Mesh(glowGeometry, glowMaterial);
            mesh.add(glow);
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

        // Show highlight
        this.gridHighlight.visible = true;
    }

    hideGridHighlight() {
        this.gridHighlight.visible = false;
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