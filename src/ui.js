export class UI {
    constructor(game) {
        this.game = game;
        this.selectedTower = null;
        this.towerPreviewMesh = null;
        this.isValidPlacement = false;
        this.towerPlacementCallback = null;
        this.isTowerPlacementMode = false;

        // Touch controls state
        this.touchState = {
            isDragging: false,
            startX: 0,
            startY: 0,
            lastTouchDistance: 0,
            towerPlacementActive: false,
            towerPlacementStartTime: 0,
            longPressThreshold: 500, // ms for long press
            touchStartPosition: { x: 0, y: 0 }
        };

        // Cache elements
        this.towerOptions = document.querySelectorAll('.tower-option');
        this.powerCards = document.querySelectorAll('.power-card');

        // Configure the raycaster for tower placement
        this.setupRaycaster();

        // Mouse move handler for tower preview
        this.setupMouseMoveHandler();

        // Setup touch controls for mobile
        this.setupTouchControls();

        // Note: Keyboard shortcuts are now handled in main.js only
    }

    setupRaycaster() {
        const renderer = this.game.renderer;
        const canvas = renderer.canvas;

        // Track mouse state for desktop
        let isMouseDown = false;
        let dragStartX = 0;
        let dragStartY = 0;
        const dragThreshold = 5; // pixels

        // Mouse down handler
        canvas.addEventListener('mousedown', (event) => {
            isMouseDown = true;
            dragStartX = event.clientX;
            dragStartY = event.clientY;

            // Create tower preview immediately when mouse is pressed and a tower is selected
            if (this.selectedTower && !this.towerPreviewMesh) {
                const rect = canvas.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;

                // Normalize coordinates to canvas space
                const normalizedX = x / canvas.clientWidth;
                const normalizedY = y / canvas.clientHeight;

                // Create tower preview
                this.towerPreviewMesh = this.game.renderer.createTowerPreview(this.selectedTower);
                this.updateTowerPreview(normalizedX, normalizedY);
            }
        });

        // Mouse up handler
        canvas.addEventListener('mouseup', (event) => {
            // Check if this was a click vs. a drag
            const dragDistance = Math.sqrt(
                Math.pow(event.clientX - dragStartX, 2) +
                Math.pow(event.clientY - dragStartY, 2)
            );
            const wasDragging = dragDistance >= dragThreshold;

            // Only place tower if it wasn't a drag (for camera rotation)
            if (this.selectedTower && !wasDragging) {
                const rect = canvas.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;

                // Normalize coordinates to canvas space
                const normalizedX = x / canvas.clientWidth;
                const normalizedY = y / canvas.clientHeight;

                // Handle the click for tower placement
                // this.handleCanvasClick(normalizedX, normalizedY); // REMOVED - handling in click event now
            } else if (wasDragging) {
                // If we were dragging (camera rotation), remove any tower preview to prevent accidental placement
                if (this.towerPreviewMesh) {
                    this.game.renderer.removeTowerPreview();
                    this.towerPreviewMesh = null;

                    // Create a new preview after a short delay to prevent immediate placement
                    setTimeout(() => {
                        if (this.selectedTower && !this.towerPreviewMesh) {
                            this.towerPreviewMesh = this.game.renderer.createTowerPreview(this.selectedTower);
                        }
                    }, 100);
                }
            }

            isMouseDown = false;
        });

        // Mouse move for tower preview
        canvas.addEventListener('mousemove', (event) => {
            if (this.selectedTower) {
                const rect = canvas.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;

                // Check if cursor is inside the canvas
                if (x >= 0 && x <= canvas.clientWidth && y >= 0 && y <= canvas.clientHeight) {
                    // Normalize coordinates to canvas space
                    const normalizedX = x / canvas.clientWidth;
                    const normalizedY = y / canvas.clientHeight;

                    // Create tower preview if it doesn't exist
                    if (!this.towerPreviewMesh && this.selectedTower) {
                        this.towerPreviewMesh = this.game.renderer.createTowerPreview(this.selectedTower);
                    }

                    this.updateTowerPreview(normalizedX, normalizedY);
                } else {
                    // Hide preview when cursor leaves canvas
                    if (this.towerPreviewMesh) {
                        this.game.renderer.removeTowerPreview();
                        this.towerPreviewMesh = null;
                    }
                }
            }
        });

        // We're not using click event anymore, as we handle the placement logic in mouseup event
        // This ensures better distinction between camera rotation and tower placement
    }

    setupMouseMoveHandler() {
        // This is handled in the setupRaycaster method
        console.log("Mouse move handler setup is done in setupRaycaster method");
    }

    setupTouchControls() {
        const renderer = this.game.renderer;
        const canvas = renderer.canvas;

        // Touch start handler
        canvas.addEventListener('touchstart', (event) => {
            event.preventDefault();

            // Store initial touch position
            if (event.touches.length === 1) {
                const touch = event.touches[0];
                this.touchState.startX = touch.clientX;
                this.touchState.startY = touch.clientY;
                this.touchState.isDragging = false;

                // For tower placement: show preview when touch starts
                if (this.selectedTower) {
                    // Mark this as a potential tower placement
                    this.touchState.towerPlacementActive = true;

                    // Convert touch to normalized coordinates
                    const rect = canvas.getBoundingClientRect();
                    const normalizedX = (touch.clientX - rect.left) / canvas.clientWidth;
                    const normalizedY = (touch.clientY - rect.top) / canvas.clientHeight;

                    // Store start position for tower placement
                    this.touchState.touchStartPosition = { x: normalizedX, y: normalizedY };

                    // Create tower preview if it doesn't exist
                    if (!this.towerPreviewMesh) {
                        this.towerPreviewMesh = this.game.renderer.createTowerPreview(this.selectedTower);
                    }

                    // Update tower preview
                    this.updateTowerPreview(normalizedX, normalizedY);
                }
            }
            // Pinch to zoom - store initial distance between touches
            else if (event.touches.length === 2) {
                const dx = event.touches[0].clientX - event.touches[1].clientX;
                const dy = event.touches[0].clientY - event.touches[1].clientY;
                this.touchState.lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
            }
        }, { passive: false });

        // Touch move handler
        canvas.addEventListener('touchmove', (event) => {
            event.preventDefault();

            // Single touch - camera pan or tower placement
            if (event.touches.length === 1) {
                const touch = event.touches[0];

                // Calculate delta
                const deltaX = touch.clientX - this.touchState.startX;
                const deltaY = touch.clientY - this.touchState.startY;

                // If tower placement is active, update preview position
                if (this.selectedTower && this.touchState.towerPlacementActive) {
                    const rect = canvas.getBoundingClientRect();
                    const normalizedX = (touch.clientX - rect.left) / canvas.clientWidth;
                    const normalizedY = (touch.clientY - rect.top) / canvas.clientHeight;

                    this.updateTowerPreview(normalizedX, normalizedY);

                    // Allow touch move up to a small threshold before considering it a drag
                    // This way slight finger movements won't prevent tower placement
                    const moveThreshold = 20; // pixels
                    const dx = Math.abs(touch.clientX - this.touchState.startX);
                    const dy = Math.abs(touch.clientY - this.touchState.startY);

                    if (dx > moveThreshold || dy > moveThreshold) {
                        this.touchState.isDragging = true;
                    }
                }
                // Regular camera control - only if not in tower placement mode
                else {
                    // If enough movement, mark as dragging
                    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
                        this.touchState.isDragging = true;
                    }

                    // Handle camera rotation
                    if (this.touchState.isDragging) {
                        // Rotate camera
                        renderer.controls.rotateLeft(deltaX * 0.005);
                        renderer.controls.rotateUp(deltaY * 0.005);

                        // Update start position for next move
                        this.touchState.startX = touch.clientX;
                        this.touchState.startY = touch.clientY;
                    }
                }
            }
        }, { passive: false });

        // Touch end handler
        canvas.addEventListener('touchend', (event) => {
            event.preventDefault();

            // Handle tower placement if active
            if (this.selectedTower && this.touchState.towerPlacementActive) {
                // Only place tower if not dragging (to prevent accidental placement during camera rotation)
                if (!this.touchState.isDragging) {
                    const touch = event.changedTouches[0];
                    const rect = canvas.getBoundingClientRect();
                    const normalizedX = (touch.clientX - rect.left) / canvas.clientWidth;
                    const normalizedY = (touch.clientY - rect.top) / canvas.clientHeight;

                    // Update preview position one last time before placing
                    this.updateTowerPreview(normalizedX, normalizedY);

                    // Place the tower immediately on touch end
                    this.handleCanvasClick(normalizedX, normalizedY);
                }

                // Reset tower placement state
                this.touchState.towerPlacementActive = false;
            }

            // Reset touch state
            this.touchState.isDragging = false;
        }, { passive: false });
    }

    // REMOVED: setupKeyboardShortcuts method - now handled in main.js to avoid duplicate events
    // Keyboard shortcuts for tower selection are now fully handled in main.js

    selectTower(towerType) {
        // console.log("Tower selection called with:", towerType, "Currently selected:", this.selectedTower);

        // Check if we're selecting the same tower that's already selected
        if (towerType === this.selectedTower) {
            // console.log("Toggling off currently selected tower");

            // This is a toggle - deselect the current tower
            this.towerOptions.forEach(element => {
                element.classList.remove('selected');
            });

            // Clear selected tower
            this.selectedTower = null;

            // Remove tower preview
            this.game.renderer.removeTowerPreview();
            this.towerPreviewMesh = null;

            return;
        }

        // We're selecting a different tower or selecting when none was selected
        // console.log("Selecting a different tower");

        // Always remove any existing preview before creating a new one
        this.game.renderer.removeTowerPreview();
        this.towerPreviewMesh = null;

        // Deselect previous tower option if any
        this.towerOptions.forEach(element => {
            element.classList.remove('selected');
        });

        // Select new tower option
        this.towerOptions.forEach(element => {
            if (element.getAttribute('data-tower') === towerType) {
                element.classList.add('selected');
            }
        });

        // Set selected tower
        this.selectedTower = towerType;

        // Create tower preview
        this.towerPreviewMesh = this.game.renderer.createTowerPreview(towerType);
        // console.log("Created tower preview for:", towerType);
    }

    cancelTowerPlacement() {
        // console.log("Canceling tower placement");

        // For consistency between mobile and desktop, we deselect the tower completely

        // Deselect tower in UI
        this.towerOptions.forEach(element => {
            element.classList.remove('selected');
        });

        // Remove tower preview
        this.game.renderer.removeTowerPreview();
        this.towerPreviewMesh = null;

        // Clear selected tower
        this.selectedTower = null;

        // Exit TCG placement mode if active
        if (this.isTowerPlacementMode && this.towerPlacementCallback) {
            this.towerPlacementCallback(false);
            this.setTowerPlacementMode(false);
        }
    }

    async updateTowerPreview(normalizedX, normalizedY) {
        if (!this.selectedTower) {
            // console.log("No tower selected, cannot update preview");
            return;
        }

        if (!this.towerPreviewMesh) {
            // console.log("No preview mesh exists, creating one");
            this.towerPreviewMesh = this.game.renderer.createTowerPreview(this.selectedTower);
        }

        // Cast ray to determine where to place the tower
        const camera = this.game.renderer.camera;
        const map = this.game.map;

        // Calculate mouse position in normalized device coordinates (-1 to +1)
        const mouseX = (normalizedX * 2) - 1;
        const mouseY = -(normalizedY * 2) + 1;

        // Use raycasting to find intersection with ground plane
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera({ x: mouseX, y: mouseY }, camera);

        // First try intersecting with scene objects
        const intersects = raycaster.intersectObjects(this.game.renderer.scene.children, true);

        // Filter to only consider the ground - ignore other objects
        const groundIntersects = intersects.filter(intersect =>
            intersect.object.userData && intersect.object.userData.isGround
        );

        let target = new THREE.Vector3();

        if (groundIntersects.length > 0) {
            // Use the first ground intersection
            target = groundIntersects[0].point;
        } else {
            // Fallback to plane intersection if no ground was hit
            const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            raycaster.ray.intersectPlane(groundPlane, target);
        }

        // Convert to grid coordinates
        const gridCoords = map.worldToGrid(target.x, target.z);
        const { x: gridX, y: gridY } = gridCoords;

        // Check if placement is valid - now async
        this.isValidPlacement = await map.canPlaceTower(gridX, gridY);

        // Update preview mesh position
        const worldPos = map.gridToWorld(gridX, gridY);
        this.game.renderer.updateTowerPreview(worldPos, this.isValidPlacement);

        // Show grid highlight
        this.game.renderer.showGridHighlight(gridX, gridY, {
            width: map.gridWidth,
            height: map.gridHeight
        }, this.isValidPlacement);
    }

    async handleCanvasClick(normalizedX, normalizedY) {
        if (!this.selectedTower) return;

        // Check if camera is rotating - abort tower placement if it is
        if (this.game.renderer.isRotating) {
            // console.log("Camera is rotating, aborting tower placement");
            return;
        }

        // Calculate mouse position in normalized device coordinates (-1 to +1)
        const mouseX = (normalizedX * 2) - 1;
        const mouseY = -(normalizedY * 2) + 1;

        // Use raycasting to find intersection with ground plane
        const camera = this.game.renderer.camera;
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera({ x: mouseX, y: mouseY }, camera);

        // First try intersecting with scene objects
        const intersects = raycaster.intersectObjects(this.game.renderer.scene.children, true);

        // Filter to only consider the ground - ignore other objects
        const groundIntersects = intersects.filter(intersect =>
            intersect.object.userData && intersect.object.userData.isGround
        );

        let target = new THREE.Vector3();

        if (groundIntersects.length > 0) {
            // Use the first ground intersection
            target = groundIntersects[0].point;
        } else {
            // Fallback to plane intersection if no ground was hit
            const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            raycaster.ray.intersectPlane(groundPlane, target);
        }

        // Convert to grid coordinates
        const map = this.game.map;
        const gridCoords = map.worldToGrid(target.x, target.z);
        const { x: gridX, y: gridY } = gridCoords;

        // console.log(`Mouse click at world: (${target.x.toFixed(2)}, ${target.z.toFixed(2)}), grid: (${gridX}, ${gridY})`);

        // Check the placement validity again (in case it changed since last move)
        this.isValidPlacement = await map.canPlaceTower(gridX, gridY);

        // console.log(`Tower placement validity: ${this.isValidPlacement}`);

        // Attempt to place tower
        if (this.isValidPlacement) {
            // Check if we're in TCG tower placement mode
            if (this.isTowerPlacementMode && this.towerPlacementCallback) {
                // Use TCG placement callback (which may be async now)
                Promise.resolve(this.towerPlacementCallback(true, { x: gridX, y: gridY }))
                  .catch(err => console.error("Error in tower placement callback:", err));
                console.log("TCG tower placement callback called");
            } else {
                // Normal tower placement
                const success = await this.game.placeTower(this.selectedTower, gridX, gridY);

                if (success) {
                    // Tower placed successfully
                    // Keep the same tower selected for multiple placements
                    // First, remove the old preview
                    if (this.towerPreviewMesh) {
                        this.game.renderer.removeTowerPreview();
                        this.towerPreviewMesh = null;
                    }

                    // Create a new preview for the next placement at the current position
                    this.towerPreviewMesh = this.game.renderer.createTowerPreview(this.selectedTower);

                    // Update preview position to current cursor position
                    this.updateTowerPreview(normalizedX, normalizedY);

                    // console.log("Tower placement successful, keeping selection and creating new preview");
                } else {
                    console.log("Tower placement failed in game.placeTower");
                }
            }
        } else {
            console.log("Invalid placement location");

            // If we're in TCG mode, call the callback with failure (handling async)
            if (this.isTowerPlacementMode && this.towerPlacementCallback) {
                Promise.resolve(this.towerPlacementCallback(false))
                  .catch(err => console.error("Error in tower placement callback:", err));
            }
        }
    }

    activatePowerCard(cardType, cost) {
        // Attempt to activate power card
        const success = this.game.activatePowerCard(cardType, cost);

        if (success) {
            // Find the card element
            const cardElement = Array.from(this.powerCards).find(
                element => element.getAttribute('data-card') === cardType
            );

            if (cardElement) {
                // Apply cooldown effect
                cardElement.classList.add('cooldown');

                // Remove cooldown after appropriate delay
                const cooldowns = {
                    'meteor': 45000,
                    'freeze': 60000,
                    'hero': 90000,
                    'gold': 30000,
                    'empower': 75000
                };

                setTimeout(() => {
                    cardElement.classList.remove('cooldown');
                }, cooldowns[cardType] || 60000);
            }
        }

        return success;
    }

    // Method for TCG integration - enables tower placement mode for cards
    setTowerPlacementMode(enabled, callback = null) {
        this.isTowerPlacementMode = enabled;
        this.towerPlacementCallback = callback;

        if (enabled) {
            // Show visual cue that tower placement mode is active
            document.body.classList.add('tower-placement-mode');

            // For now, we'll use the existing tower preview system
            // But in the future, we might want to create a special preview for TCG towers
            if (!this.selectedTower && this.game.tcgIntegration?.selectedCard) {
                // Use a generic tower preview for now
                this.selectedTower = 'custom';
                this.towerPreviewMesh = this.game.renderer.createTowerPreview('arrow');
            }
        } else {
            // Remove visual cue
            document.body.classList.remove('tower-placement-mode');

            // Only clear if we're in TCG mode, to avoid interfering with normal tower placement
            if (this.selectedTower === 'custom') {
                this.selectedTower = null;

                // Remove tower preview
                if (this.towerPreviewMesh) {
                    this.game.renderer.removeTowerPreview();
                    this.towerPreviewMesh = null;
                }
            }
        }
    }
}