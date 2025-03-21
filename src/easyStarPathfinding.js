// EasyStarPathfinding.js - A wrapper around easystarjs for our game
import EasyStar from 'easystarjs';

export class EasyStarPathfinding {
    constructor(map) {
        this.map = map;
        this.easystar = new EasyStar.js();
        this.initialized = false;

        // Set acceptable tiles (1 is for path in our grid system)
        this.easystar.setAcceptableTiles([1]);

        // Enable diagonals if needed (our game currently doesn't use diagonals)
        // this.easystar.enableDiagonals();

        // Set grid when the map is ready
        if (map.grid && map.grid.length > 0) {
            this.setGrid(map.grid);
        }
    }

    // Set the grid data for pathfinding
    setGrid(grid) {
        if (!grid || grid.length === 0) return;

        this.easystar.setGrid(grid);
        this.initialized = true;
    }

    // Find a path from start to end using EasyStar A* algorithm
    findPath(startPoint, endPoint) {
        return new Promise((resolve) => {
            if (!this.initialized) {
                this.setGrid(this.map.grid);
            }

            // Ensure valid coordinates
            const startX = Math.floor(startPoint.x);
            const startZ = Math.floor(startPoint.z);
            const endX = Math.floor(endPoint.x);
            const endZ = Math.floor(endPoint.z);

            // Check if coordinates are within grid bounds
            if (startX < 0 || startX >= this.map.gridWidth ||
                startZ < 0 || startZ >= this.map.gridHeight ||
                endX < 0 || endX >= this.map.gridWidth ||
                endZ < 0 || endZ >= this.map.gridHeight) {
                console.log("Pathfinding error: Coordinates out of bounds", {startX, startZ, endX, endZ});

                // Try to find valid coordinates within bounds
                const validStart = this.getValidPointInBounds(startX, startZ);
                const validEnd = this.getValidPointInBounds(endX, endZ);

                if (validStart && validEnd) {
                    console.log("Using corrected coordinates for pathfinding",
                        {startX: validStart.x, startZ: validStart.z, endX: validEnd.x, endZ: validEnd.z});

                    // Use the valid coordinates instead
                    return this.findPathWithValidCoords(validStart.x, validStart.z, validEnd.x, validEnd.z)
                        .then(resolve);
                }

                return resolve([]);
            }

            // Check if start and end are walkable
            if (this.map.grid[startZ][startX] !== 1 || this.map.grid[endZ][endX] !== 1) {
                // Try to find nearest walkable cell
                const nearestStart = this.findNearestWalkableCell(startX, startZ);
                const nearestEnd = this.findNearestWalkableCell(endX, endZ);

                if (!nearestStart || !nearestEnd) {
                    console.log("Pathfinding error: No walkable cells near start or end");
                    return resolve([]);
                }

                console.log("Using nearest walkable cells for pathfinding");
                return this.findPathWithValidCoords(nearestStart.x, nearestStart.z, nearestEnd.x, nearestEnd.z)
                    .then(resolve);
            }

            // Use the valid coordinates to find a path
            this.findPathWithValidCoords(startX, startZ, endX, endZ).then(resolve);
        });
    }

    // Helper method to find a path with validated coordinates
    findPathWithValidCoords(startX, startZ, endX, endZ) {
        return new Promise((resolve) => {
            // Double-check everything is still valid
            if (startX < 0 || startX >= this.map.gridWidth ||
                startZ < 0 || startZ >= this.map.gridHeight ||
                endX < 0 || endX >= this.map.gridWidth ||
                endZ < 0 || endZ >= this.map.gridHeight) {
                return resolve([]);
            }

            // EasyStar is asynchronous, so we use a promise
            this.easystar.findPath(startX, startZ, endX, endZ, (path) => {
                if (path === null) {
                    console.log(`No path found from (${startX},${startZ}) to (${endX},${endZ})`);
                    resolve([]); // No path found, return empty array
                } else {
                    // Convert path to our format
                    const formattedPath = path.map(point => ({
                        x: point.x,
                        z: point.y // EasyStar uses y for the second coordinate
                    }));
                    resolve(formattedPath);
                }
            });

            // Calculate the path
            this.easystar.calculate();
        });
    }

    // Get a valid point within bounds
    getValidPointInBounds(x, z) {
        // Clamp to grid bounds
        const validX = Math.max(0, Math.min(this.map.gridWidth - 1, x));
        const validZ = Math.max(0, Math.min(this.map.gridHeight - 1, z));

        // Look for a walkable cell near this point
        return this.findNearestWalkableCell(validX, validZ);
    }

    // Helper to find the nearest walkable cell
    findNearestWalkableCell(x, z) {
        // Check cells in a spiral pattern outward from the given coordinates
        for (let radius = 1; radius <= 3; radius++) {
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    // Skip cells we've already checked (inner radius)
                    if (Math.abs(dx) < radius && Math.abs(dz) < radius) continue;

                    const newX = x + dx;
                    const newZ = z + dz;

                    // Check if within bounds
                    if (newX < 0 || newX >= this.map.gridWidth ||
                        newZ < 0 || newZ >= this.map.gridHeight) {
                        continue;
                    }

                    // Check if walkable
                    if (this.map.grid[newZ][newX] === 1) {
                        return { x: newX, z: newZ };
                    }
                }
            }
        }

        return null; // No walkable cell found within radius
    }

    // Check if a path exists between start and end
    async hasPath(start, end) {
        const path = await this.findPath(start, end);
        return path.length > 0;
    }

    // Get the path with a tower as an obstacle
    async findPathWithTower(start, end, towerX, towerZ) {
        // Create a copy of the grid
        const tempGrid = this.map.grid.map(row => [...row]);

        // Add tower as obstacle in the temporary grid
        if (towerX >= 0 && towerX < this.map.gridWidth &&
            towerZ >= 0 && towerZ < this.map.gridHeight &&
            tempGrid[towerZ][towerX] === 0) { // Only place on empty cells
            tempGrid[towerZ][towerX] = 3; // Mark as tower temporarily
        }

        // Create a temporary EasyStar instance with the modified grid
        const tempEasyStar = new EasyStar.js();
        tempEasyStar.setAcceptableTiles([1]);
        tempEasyStar.setGrid(tempGrid);

        // Find the path with the temporary tower
        return new Promise((resolve) => {
            tempEasyStar.findPath(
                Math.floor(start.x), Math.floor(start.z),
                Math.floor(end.x), Math.floor(end.z),
                (path) => {
                    if (path === null) {
                        resolve([]);
                    } else {
                        const formattedPath = path.map(point => ({
                            x: point.x,
                            z: point.y
                        }));
                        resolve(formattedPath);
                    }
                }
            );
            tempEasyStar.calculate();
        });
    }

    // Update the grid when the map changes
    updateGrid() {
        if (this.map.grid && this.map.grid.length > 0) {
            this.setGrid(this.map.grid);
        }
    }

    // Methods for compatibility with the existing interface
    buildNavMesh() {
        // Initialize the grid if needed
        this.updateGrid();
    }

    updateNavMesh() {
        // Update the grid
        this.updateGrid();
    }

    toggleNavMeshVisibility() {
        // Not applicable for EasyStar, but kept for compatibility
        console.log("NavMesh visibility toggle is not applicable for EasyStar");
    }
}