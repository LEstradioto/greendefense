export class UI {
    constructor(game) {
        this.game = game;
        this.selectedTower = null;
        this.towerPreviewMesh = null;
        this.isValidPlacement = false;

        // Cache elements
        this.towerOptions = document.querySelectorAll('.tower-option');
        this.powerCards = document.querySelectorAll('.power-card');

        // Configure the raycaster for tower placement
        this.setupRaycaster();

        // Mouse move handler for tower preview
        this.setupMouseMoveHandler();
        
        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
    }

    setupRaycaster() {
        const renderer = this.game.renderer;
        const canvas = renderer.canvas;

        canvas.addEventListener('mousemove', (event) => {
            if (this.selectedTower) {
                const rect = canvas.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;

                // Normalize coordinates to canvas space
                const normalizedX = x / canvas.clientWidth;
                const normalizedY = y / canvas.clientHeight;

                this.updateTowerPreview(normalizedX, normalizedY);
            }
        });
    }

    setupMouseMoveHandler() {
        // This is handled in the setupRaycaster method
    }
    
    setupKeyboardShortcuts() {
        // Add keyboard shortcuts for tower selection
        document.addEventListener('keydown', (event) => {
            // Only process shortcuts when not in input fields
            if (event.target.tagName === 'INPUT') return;
            
            switch(event.key) {
                case '1':
                    this.selectTower('arrow');
                    break;
                case '2':
                    this.selectTower('doubleArrow');
                    break;
                case '3':
                    this.selectTower('cannon');
                    break;
                case 'Escape':
                    this.cancelTowerPlacement();
                    break;
            }
        });
    }

    selectTower(towerType) {
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
        if (this.selectedTower) {
            this.towerPreviewMesh = this.game.renderer.createTowerPreview(towerType);
        }
    }

    cancelTowerPlacement() {
        // Deselect tower option
        this.towerOptions.forEach(element => {
            element.classList.remove('selected');
        });

        // Clear selected tower
        this.selectedTower = null;

        // Remove tower preview
        if (this.towerPreviewMesh) {
            this.game.renderer.removeTowerPreview();
            this.towerPreviewMesh = null;
        }
    }

    async updateTowerPreview(normalizedX, normalizedY) {
        if (!this.selectedTower || !this.towerPreviewMesh) return;

        // Cast ray to determine where to place the tower
        const camera = this.game.renderer.camera;
        const map = this.game.map;

        // Calculate mouse position in normalized device coordinates (-1 to +1)
        const mouseX = (normalizedX * 2) - 1;
        const mouseY = -(normalizedY * 2) + 1;

        // Use raycasting to find intersection with ground plane
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera({ x: mouseX, y: mouseY }, camera);

        // Create a horizontal plane for intersection
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const target = new THREE.Vector3();

        // Find intersection point
        raycaster.ray.intersectPlane(groundPlane, target);

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

        // Calculate mouse position in normalized device coordinates (-1 to +1)
        const mouseX = (normalizedX * 2) - 1;
        const mouseY = -(normalizedY * 2) + 1;

        // Use raycasting to find intersection with ground plane
        const camera = this.game.renderer.camera;
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera({ x: mouseX, y: mouseY }, camera);

        // Create a horizontal plane for intersection
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const target = new THREE.Vector3();

        // Find intersection point
        raycaster.ray.intersectPlane(groundPlane, target);

        // Convert to grid coordinates
        const map = this.game.map;
        const gridCoords = map.worldToGrid(target.x, target.z);
        const { x: gridX, y: gridY } = gridCoords;

        console.log(`Mouse click at world: (${target.x.toFixed(2)}, ${target.z.toFixed(2)}), grid: (${gridX}, ${gridY})`);

        // Check the placement validity again (in case it changed since last move)
        this.isValidPlacement = await map.canPlaceTower(gridX, gridY);

        console.log(`Tower placement validity: ${this.isValidPlacement}`);

        // Attempt to place tower
        if (this.isValidPlacement) {
            const success = await this.game.placeTower(this.selectedTower, gridX, gridY);

            if (success) {
                // Tower placed successfully
                // Reset selection
                this.cancelTowerPlacement();
                console.log("Tower placement successful, selection reset");
            } else {
                console.log("Tower placement failed in game.placeTower");
            }
        } else {
            console.log("Invalid placement location");
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
}