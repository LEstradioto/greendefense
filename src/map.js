import { EasyStarPathfinding } from './easyStarPathfinding.js';
import * as THREE from 'three';

export class Map {
    constructor(game) {
        this.game = game;

        // Grid dimensions
        this.gridWidth = 15;
        this.gridHeight = 25;
        this.originalGridWidth = this.gridWidth; // Store original dimensions for reset
        this.originalGridHeight = this.gridHeight;

        // Grid cell types
        // 0: Empty (placeable)
        // 1: Path
        // 2: Water/obstacle
        // 3: Occupied by tower
        this.grid = [];
        this.originalGrid = []; // Store original grid for reset

        // Path waypoints (for enemy movement)
        this.pathWaypoints = [];

        // Path visualization
        this.pathHelper = null;

        // Pathfinding system
        this.pathfindingHelper = new EasyStarPathfinding(this);

        // 3D representation
        this.mapMesh = null;
        this.mapGroup = null;
    }

    async initialize() {
        console.log("Initializing map...");
        // Create grid data
        this.createGridData();

        // Create 3D representation
        this.mapGroup = this.game.renderer.createMap(this.grid, {
            width: this.gridWidth,
            height: this.gridHeight
        });

        // Store for easy access
        this.mapMesh = this.mapGroup;

        // Build the pathfinding navmesh
        this.pathfindingHelper.buildNavMesh();

        // Create path waypoints for enemies to follow
        await this.createPathWaypoints();

        // Explicitly set the path property
        this.path = this.worldPathWaypoints;
        console.log("Path initialized with", this.path ? this.path.length : 0, "waypoints");

        // Create path visualization
        this.createPathVisualization();

        // Add key bindings for debug mode
        document.addEventListener('keydown', (e) => {
            if (e.key === 'n' && this.game.debugMode) {
                // Toggle navmesh visibility when in debug mode
                this.pathfindingHelper.toggleNavMeshVisibility();
            }
        });

        // Store a copy of the original grid for reset
        this.originalGrid = this.grid.map(row => [...row]);

        console.log("Map initialization complete");
        return this.path;
    }

    async reset() {
        console.log("Resetting map...");
        // Reset the grid dimensions to original values
        if (this.gridWidth !== this.originalGridWidth || this.gridHeight !== this.originalGridHeight) {
            console.log(`Resetting grid dimensions from ${this.gridWidth}x${this.gridHeight} to ${this.originalGridWidth}x${this.originalGridHeight}`);
            this.gridWidth = this.originalGridWidth;
            this.gridHeight = this.originalGridHeight;
        }

        // Clear the current grid completely
        this.grid = [];

        // Reset the grid to its original state
        if (this.originalGrid.length > 0) {
            console.log("Restoring grid from original");
            this.grid = this.originalGrid.map(row => [...row]);
        } else {
            // If we don't have an original grid, recreate it
            console.log("Recreating grid data");
            this.createGridData();
        }

        // Clear any existing paths
        this.pathWaypoints = [];
        this.worldPathWaypoints = [];
        this.path = null;

        // Rebuild the pathfinding navmesh
        console.log("Rebuilding navmesh");
        this.pathfindingHelper.buildNavMesh();

        // Recreate path waypoints
        console.log("Recreating path waypoints");
        await this.recreatePathWaypoints();

        // Check if we need to recreate the 3D map representation
        if (!this.mapGroup || !this.game.renderer.scene.children.includes(this.mapGroup)) {
            console.log("3D map representation missing, recreating...");
            this.mapGroup = this.game.renderer.createMap(this.grid, {
                width: this.gridWidth,
                height: this.gridHeight
            });

            // Store for easy access
            this.mapMesh = this.mapGroup;

            // Recreate path visualization
            this.createPathVisualization();
        }

        console.log("Map reset complete. Path has", this.path ? this.path.length : 0, "waypoints");
        return this.path;
    }

    async recreatePathWaypoints() {
        // Clear existing waypoints
        this.pathWaypoints = [];
        this.worldPathWaypoints = [];
        this.path = null;

        try {
            // Use the center of the top row as start point
            const startPoint = this.getStartPoint();

            // Use the center of the bottom row as end point
            const endPoint = this.getEndPoint();

            console.log("Finding path from", startPoint, "to", endPoint);

            // Calculate path waypoints (in grid coordinates) using proper pathfinding
            this.pathWaypoints = await this.pathfindingHelper.findPath(startPoint, endPoint);

            console.log("Recreated pathWaypoints:", this.pathWaypoints);

            if (!this.pathWaypoints || this.pathWaypoints.length === 0) {
                console.error("Failed to create valid path with pathfinder - falling back to direct line");
                // Fallback to simple direct path if pathfinding fails
                this.pathWaypoints = [startPoint, endPoint];
            }

            // Convert grid positions to world positions for visualization and enemy movement
            this.worldPathWaypoints = this.pathWaypoints.map(point =>
                this.gridToWorld(point.x, point.z)
            );

            // Set the path property that the game uses for enemy movement
            this.path = this.worldPathWaypoints;

            console.log("Recreated path with", this.path ? this.path.length : 0, "waypoints");

            // Recreate path visualization if needed
            this.createPathVisualization();

            return this.path;
        } catch (error) {
            console.error("Error recreating path waypoints:", error);
            // Create a fallback path in case of error
            const startPoint = this.getStartPoint();
            const endPoint = this.getEndPoint();
            this.pathWaypoints = [startPoint, endPoint];
            this.worldPathWaypoints = this.pathWaypoints.map(point =>
                this.gridToWorld(point.x, point.z)
            );
            this.path = this.worldPathWaypoints;
            return this.path;
        }
    }

    createGridData() {
        // Make sure we're using the correct dimensions
        const gridWidth = this.gridWidth;
        const gridHeight = this.gridHeight;

        // Clear the grid first to prevent duplication
        this.grid = [];

        // Initialize grid with all path cells (walkable)
        for (let z = 0; z < gridHeight; z++) {
            const row = [];
            for (let x = 0; x < gridWidth; x++) {
                // Make the entire map walkable (1)
                row.push(1); // Everything is walkable by default
            }
            this.grid.push(row);
        }

        // Add all cells along the top as entry points (z=0)
        for (let x = 0; x < gridWidth; x++) {
            this.grid[0][x] = 1; // Mark as path
        }

        // Add all cells along the bottom as exit points (z=gridHeight-1)
        for (let x = 0; x < gridWidth; x++) {
            this.grid[gridHeight - 1][x] = 1; // Mark as path
        }

        // Add restricted rows at the bottom (last 3 rows before the very bottom)
        for (let z = gridHeight - 4; z < gridHeight - 1; z++) {
            for (let x = 0; x < gridWidth; x++) {
                // Set cells as path (1) but we'll prevent tower placement in the game logic
                if (x > 0 && x < gridWidth - 1) {
                    this.grid[z][x] = 1;
                }
            }
        }

        // No obstacles - the field is now completely clear except for borders
        // Towers will be the only obstacles

        // Ensure there's at least one valid path from top to bottom
        const startPoint = this.getStartPoint();
        const endPoint = this.getEndPoint();

        // Initialize pathfinding
        this.pathfindingHelper.buildNavMesh();
    }

    async createPathWaypoints() {
        // Use the center of the top row as start point
        const startPoint = { x: Math.floor(this.gridWidth / 2), z: 0 };

        // Use the center of the bottom row as end point
        const endPoint = { x: Math.floor(this.gridWidth / 2), z: this.gridHeight - 1 };

        console.log("Finding path from", startPoint, "to", endPoint);

        // Calculate path waypoints (in grid coordinates)
        this.pathWaypoints = await this.pathfindingHelper.findPath(startPoint, endPoint);

        console.log("Path finding complete, path length:", this.pathWaypoints ? this.pathWaypoints.length : 0);

        // If pathfinding failed, create a simple direct line
        if (!this.pathWaypoints || this.pathWaypoints.length === 0) {
            console.warn("Pathfinding failed to create a valid path - using direct line fallback");
            this.pathWaypoints = [startPoint, endPoint];
        }

        // Convert grid positions to world positions for visualization
        this.worldPathWaypoints = this.pathWaypoints.map(point =>
            this.gridToWorld(point.x, point.z)
        );

        // Explicitly set the path property that enemies use for movement
        this.path = this.worldPathWaypoints;
        console.log("Created path with", this.path.length, "waypoints");

        return this.pathWaypoints;
    }

    createPathVisualization() {
        // Remove old visualization
        if (this.pathVisualization) {
            this.game.renderer.scene.remove(this.pathVisualization);
            // Dispose of geometry and material to prevent memory leaks
            if (this.pathVisualization.geometry) this.pathVisualization.geometry.dispose();
            if (this.pathVisualization.material) this.pathVisualization.material.dispose();
            this.pathVisualization = null;
        }

        // Convert grid waypoints to world positions if not already converted
        if (!this.worldPathWaypoints) {
            this.worldPathWaypoints = this.pathWaypoints.map(point => {
                return this.gridToWorld(point.x, point.z);
            });
        }

        // For the minimalist design, we'll skip creating the actual visualization line
        // This creates an empty object that can be toggled in debug mode but won't show anything
        // Only when explicitly requested we'll create a visible line
        if (this.game.debugMode) {
            // Create a line to visualize the path
            const points = this.worldPathWaypoints.map(p => {
                return new THREE.Vector3(p.x, 0.2, p.z); // Slightly above ground
            });

            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ color: 0xFFFF00, linewidth: 2 });

            this.pathVisualization = new THREE.Line(geometry, material);
            this.pathVisualization.visible = this.game.debugMode; // Only visible in debug mode
            this.game.renderer.scene.add(this.pathVisualization);
        } else {
            // Create an empty group as a placeholder (won't be visible)
            this.pathVisualization = new THREE.Group();
            this.pathVisualization.visible = false;
            this.game.renderer.scene.add(this.pathVisualization);
        }
    }

    getPathWaypoints() {
        return this.pathWaypoints;
    }

    async canPlaceTower(gridX, gridY) {
        // Check if coordinates are within bounds
        if (gridX < 0 || gridX >= this.gridWidth || gridY < 0 || gridY >= this.gridHeight) {
            // console.log('Tower placement failed: Out of bounds');
            return false;
        }

        // Check if cell is empty (not path, obstacle, or already occupied)
        if (this.grid[gridY][gridX] !== 1) {
            // console.log('Tower placement failed: Cell not empty', this.grid[gridY][gridX]);
            return false;
        }

        // Check if in entry or exit rows
        if (gridY === 0 || gridY === this.gridHeight - 1) {
            // console.log('Tower placement failed: Cannot place towers in entry/exit areas');
            return false;
        }

        // Check if in restricted area (last 3 rows before the bottom)
        if (gridY >= this.gridHeight - 4 && gridY < this.gridHeight - 1) {
            // console.log('Tower placement failed: Cannot place towers in the restricted area (end zone)');
            return false;
        }

        // Create a temporary grid with the tower placed
        const tempGrid = this.grid.map(row => [...row]);
        tempGrid[gridY][gridX] = 3; // Mark as tower temporarily

        // If no enemies yet, only check for a path between any entry and exit
        if (!this.game.enemies || this.game.enemies.length === 0) {
            // Find a single entry and exit point for basic path check
            const entryPoint = this.getStartPoint();
            const exitPoint = this.getEndPoint();

            if (!entryPoint || !exitPoint) {
                // console.log('Tower placement failed: No entry or exit point found');
                return false;
            }

            // Create a temporary EasyStar instance with the modified grid
            const tempEasyStar = new this.pathfindingHelper.constructor(this);
            tempEasyStar.easystar.setGrid(tempGrid);
            tempEasyStar.easystar.setAcceptableTiles([1]);

            // Check if a path exists from entry to exit
            const pathExists = await new Promise(resolve => {
                tempEasyStar.easystar.findPath(
                    entryPoint.x, entryPoint.z,
                    exitPoint.x, exitPoint.z,
                    path => resolve(path !== null && path.length > 0)
                );
                tempEasyStar.easystar.calculate();
            });

            if (!pathExists) {
                // console.log('Tower placement failed: No valid path from entry to exit');
                return false;
            }

            return true;
        }

        // If there are enemies, check if this placement would block any enemy paths
        const tempEasyStar = new this.pathfindingHelper.constructor(this);
        tempEasyStar.easystar.setGrid(tempGrid);
        tempEasyStar.easystar.setAcceptableTiles([1]);

        // Only check active enemies that haven't reached the end
        const activeEnemies = this.game.enemies.filter(enemy => !enemy.reachedEnd);

        // If no active enemies, check a basic path
        if (activeEnemies.length === 0) {
            const entryPoint = this.getStartPoint();
            const exitPoint = this.getEndPoint();

            if (!entryPoint || !exitPoint) return true; // No need for a path if no enemies

            const pathExists = await new Promise(resolve => {
                tempEasyStar.easystar.findPath(
                    entryPoint.x, entryPoint.z,
                    exitPoint.x, exitPoint.z,
                    path => resolve(path !== null && path.length > 0)
                );
                tempEasyStar.easystar.calculate();
            });

            if (!pathExists) {
                // console.log('Tower placement failed: No valid path from entry to exit');
                return false;
            }

            return true;
        }

        // For active enemies, check if each can still reach the exit
        const exitPoint = this.getEndPoint();
        let allEnemiesHavePaths = true;

        // Only check a sample of enemies to improve performance
        const maxEnemiesToCheck = 3;
        const enemiesToCheck = activeEnemies.slice(0, maxEnemiesToCheck);

        for (const enemy of enemiesToCheck) {
            // Skip enemies that are too close to their target
            if (enemy.reachedEnd) continue;

            // Get validated grid position for the enemy
            const enemyWorldPos = enemy.ensurePositionInBounds ?
                enemy.ensurePositionInBounds() : enemy.position;
            const enemyGridPos = this.worldToGrid(enemyWorldPos.x, enemyWorldPos.z);

            // Skip if enemy is at or very near the exit
            if (Math.abs(enemyGridPos.x - exitPoint.x) <= 1 &&
                Math.abs(enemyGridPos.y - exitPoint.z) <= 1) {
                continue;
            }

            // Make sure enemy position is valid for pathfinding
            if (enemyGridPos.x < 0 || enemyGridPos.x >= this.gridWidth ||
                enemyGridPos.y < 0 || enemyGridPos.y >= this.gridHeight) {
                // console.log('Tower placement: Enemy position out of bounds', enemyGridPos);
                continue; // Skip this enemy
            }

            // Check if there's a path from the enemy to the exit
            const pathExists = await new Promise(resolve => {
                tempEasyStar.easystar.findPath(
                    enemyGridPos.x, enemyGridPos.y,
                    exitPoint.x, exitPoint.z,
                    path => resolve(path !== null && path.length > 0)
                );
                tempEasyStar.easystar.calculate();
            });

            if (!pathExists) {
                // console.log('Tower placement failed: Would block enemy path to exit');
                allEnemiesHavePaths = false;
                break;
            }
        }

        return allEnemiesHavePaths; // Allow placement if all enemies can still reach the exit
    }

    placeTower(gridX, gridY) {
        // Mark cell as occupied by a tower
        this.grid[gridY][gridX] = 3;

        // Update the pathfinding grid
        this.pathfindingHelper.updateGrid();

        // Force all enemies to recalculate their paths
        if (this.game.enemies) {
            // Clear the path cache since the grid has changed
            if (typeof this.game.clearPathCache === 'function') {
                this.game.clearPathCache();
            }

            // Mark last path update time to force recalculation for all enemies
            this.game.lastPathUpdate = performance.now();
        }
    }

    removeTower(gridX, gridY) {
        // Find the tower at this grid position
        const worldPos = this.gridToWorld(gridX, gridY);
        const towersAtPosition = this.game.towers.filter(tower =>
            tower.gridPosition &&
            tower.gridPosition.gridX === gridX &&
            tower.gridPosition.gridY === gridY
        );

        // Remove the tower if found
        for (const tower of towersAtPosition) {
            // Call the tower cleanup method
            if (tower.cleanup) {
                tower.cleanup();
            } else if (tower.towerInstance) {
                this.game.renderer.removeTower(tower.towerInstance);
            } else if (tower.mesh) {
                // Fallback for compatibility with old tower system
                this.game.renderer.scene.remove(tower.mesh);
            }

            // Remove from the game's towers array
            const index = this.game.towers.indexOf(tower);
            if (index !== -1) {
                this.game.towers.splice(index, 1);
            }
        }

        // Mark cell as walkable again
        this.grid[gridY][gridX] = 1;

        // Recalculate path
        this.updatePathfinding();
    }

    async updatePathfinding() {
        // Get start and end points
        const startPoint = this.getStartPoint();
        const endPoint = this.getEndPoint();

        // Recalculate path
        this.pathWaypoints = await this.pathfindingHelper.findPath(startPoint, endPoint);

        // Convert grid positions to world positions
        this.worldPathWaypoints = this.pathWaypoints.map(point => {
            return this.gridToWorld(point.x, point.z);
        });

        // Update path visualization
        if (this.pathVisualization) {
            this.game.renderer.scene.remove(this.pathVisualization);
        }

        // Create new path visualization
        this.createPathVisualization();

        // Force path recalculation for all enemies
        if (this.game.enemies) {
            // Clear path cache
            if (typeof this.game.clearPathCache === 'function') {
                this.game.clearPathCache();
            }

            // Mark last path update time to force recalculation for all enemies
            if (this.game.lastPathUpdate !== undefined) {
                this.game.lastPathUpdate = performance.now();
            }
        }
    }

    gridToWorld(gridX, gridZ) {
        // Convert grid coordinates to world coordinates
        const worldX = gridX - (this.gridWidth / 2) + 0.5;
        const worldZ = gridZ - (this.gridHeight / 2) + 0.5;

        return { x: worldX, y: 0, z: worldZ }; // Add y=0 for proper 3D positioning
    }

    worldToGrid(worldX, worldZ) {
        // Convert world coordinates to grid coordinates
        // The grid is centered at world origin, so we add half the grid dimensions
        const gridX = Math.floor(worldX + this.gridWidth / 2);
        const gridZ = Math.floor(worldZ + this.gridHeight / 2);

        // Ensure coordinates are within bounds
        const boundedX = Math.max(0, Math.min(this.gridWidth - 1, gridX));
        const boundedZ = Math.max(0, Math.min(this.gridHeight - 1, gridZ));

        // If coordinates were clamped, log a warning
        if (boundedX !== gridX || boundedZ !== gridZ) {
            console.log(`worldToGrid: Coordinates out of bounds - clamping (${gridX},${gridZ}) to (${boundedX},${boundedZ})`);
        }

        return { x: boundedX, y: boundedZ }; // Note: y is used for the z coordinate in grid space
    }

    getStartPoint() {
        // Use center point of top row
        return { x: Math.floor(this.gridWidth / 2), z: 0 };
    }

    getEndPoint() {
        // Use center point of bottom row
        return { x: Math.floor(this.gridWidth / 2), z: this.gridHeight - 1 };
    }
}