import { Renderer } from './renderer.js';
import { Map } from './map.js';
import { PowerCards } from './powerCards.js';
import { Enemy } from './entities/enemy/index.js';
import { Tower } from './entities/tower.js';
import { TCGIntegration } from './tcg-integration.js';
import { UI } from './ui.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new Renderer(canvas);
        this.map = new Map(this);
        this.enemies = [];
        this.towers = [];
        this.projectiles = [];
        this.powerCards = new PowerCards(this);

        // Game state
        this.player = {
            username: '',
            gold: 100,
            lives: 20,
            score: 0
        };

        this.currentWave = 1;
        this.maxWaves = 3;
        this.waveInProgress = false;
        this.gameStarted = false;
        this.gameOver = false;
        this.debugMode = false;
        this.isMultiplayer = false; // Will be used for TCG enemy cards

        // Game timing
        this.lastFrameTime = 0;
        this.deltaTime = 0;
        this.enemySpawnInterval = 2000; // ms
        this.lastEnemySpawnTime = 0;
        this.enemiesPerWave = [10, 15, 20]; // Number of enemies per wave
        this.enemiesSpawned = 0;
        this.enemiesDefeated = 0;

        // Bind methods
        this.update = this.update.bind(this);
        this.startWave = this.startWave.bind(this);
        
        // UI and TCG System will be initialized after map is ready
        this.tcgIntegration = null;
    }

    async start(username) {
        this.player.username = username;
        this.gameStarted = true;
        this.gameOver = false;
        this.lastFrameTime = performance.now();
        await this.map.initialize();
        
        // Initialize TCG system
        this.tcgIntegration = new TCGIntegration(this);
        
        // Initialize UI if it wasn't created yet (in case this was called directly)
        if (!this.ui) {
            this.ui = new UI(this);
        }

        // Update UI
        this.updateUI();
        
        // Add CSS class for TCG integration
        document.body.classList.add('tcg-enabled');

        // Start the game loop
        requestAnimationFrame(this.update);

        // Start the first wave after a short delay
        setTimeout(() => {
            this.startWave();
        }, 3000);
    }

    update(currentTime) {
        if (!this.gameStarted || this.gameOver) return;

        // Calculate time delta
        this.deltaTime = (currentTime - this.lastFrameTime) / 1000; // convert to seconds
        this.lastFrameTime = currentTime;

        // Spawn enemies during wave
        if (this.waveInProgress && this.enemiesSpawned < this.enemiesPerWave[this.currentWave - 1]) {
            const now = currentTime;
            if (now - this.lastEnemySpawnTime > this.enemySpawnInterval) {
                this.spawnEnemy();
                this.lastEnemySpawnTime = now;
            }
        }

        // Check if wave completed
        if (this.waveInProgress &&
            this.enemiesSpawned === this.enemiesPerWave[this.currentWave - 1] &&
            this.enemies.length === 0) {
            this.completeWave();
        }

        // Update game entities
        this.updateEnemies();
        this.updateTowers();
        this.updateProjectiles();
        this.powerCards.update(this.deltaTime);
        
        // Update TCG system if initialized
        if (this.tcgIntegration) {
            // Check if it's time to regenerate mana
            const now = performance.now();
            if (now - this.tcgIntegration.lastManaRegenTime >= this.tcgIntegration.manaRegenInterval) {
                // Regenerate mana if below max
                if (this.tcgIntegration.mana < this.tcgIntegration.maxMana) {
                    this.tcgIntegration.mana = Math.min(
                        this.tcgIntegration.maxMana,
                        this.tcgIntegration.mana + this.tcgIntegration.manaRegenAmount
                    );
                    // Update the UI
                    this.tcgIntegration.updateManaDisplay();
                }
                // Reset timer
                this.tcgIntegration.lastManaRegenTime = now;
            }
        }

        // Render the game
        this.renderer.render(this);

        // Continue the game loop
        requestAnimationFrame(this.update);
    }

    startWave() {
        if (this.waveInProgress) return;

        this.waveInProgress = true;
        this.enemiesSpawned = 0;
        this.enemiesDefeated = 0;
        this.lastEnemySpawnTime = performance.now();

        // Update UI
        document.getElementById('wave-number').textContent = this.currentWave;
    }

    completeWave() {
        this.waveInProgress = false;

        // Reward player for completing the wave
        const waveBonus = this.currentWave * 50;
        this.player.gold += waveBonus;
        this.player.score += waveBonus;

        // Update UI
        this.updateUI();
        
        // Give TCG rewards and start new turn if TCG system is active
        if (this.tcgIntegration) {
            // Start a new TCG turn (refresh mana, draw a card)
            this.tcgIntegration.startTurn();
        }

        // Check if all waves completed
        if (this.currentWave >= this.maxWaves) {
            this.victory();
            return;
        }

        // Start next wave after delay
        this.currentWave++;
        setTimeout(() => {
            this.startWave();
        }, 5000);
    }

    spawnEnemy() {
        // Determine enemy type based on wave
        let enemyType;
        if (this.currentWave === 1) {
            enemyType = 'simple';
        } else if (this.currentWave === 2) {
            enemyType = Math.random() > 0.5 ? 'simple' : 'elephant';
        } else {
            // Wave 3 - mix of all enemy types
            const rand = Math.random();
            if (rand < 0.3) enemyType = 'simple';
            else if (rand < 0.7) enemyType = 'elephant';
            else enemyType = 'pirate';
        }

        // Find a random entry point at the top of the map
        const validEntryPoints = [];
        for (let x = 0; x < this.map.gridWidth; x++) {
            if (this.map.grid[0][x] === 1) {
                validEntryPoints.push({ x, z: 0 });
            }
        }

        // Choose a random entry point
        const randomEntryIndex = Math.floor(Math.random() * validEntryPoints.length);
        const startGridPoint = validEntryPoints[randomEntryIndex];

        // Convert grid position to world position
        const startWorldPoint = this.map.gridToWorld(startGridPoint.x, startGridPoint.z);

        // Create and add enemy - with destination set to the bottom of the map
        const enemy = new Enemy(this, enemyType, startWorldPoint);
        this.enemies.push(enemy);
        this.enemiesSpawned++;
    }

    updateEnemies() {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update(this.deltaTime);

            // Check if enemy reached the end
            if (enemy.reachedEnd) {
                this.player.lives -= 1;

                // Remove enemy mesh from scene
                if (enemy.mesh) {
                    this.renderer.scene.remove(enemy.mesh);
                }

                this.enemies.splice(i, 1);
                this.updateUI();

                // Check if game over
                if (this.player.lives <= 0) {
                    this.gameOver = true;
                    this.endGame(false);
                }
            }
            // Check if enemy was defeated
            else if (enemy.health <= 0) {
                // Reward player
                this.player.gold += enemy.reward;
                this.player.score += enemy.reward;
                this.enemiesDefeated++;
                
                // TCG mana bonus for special enemies
                if (this.tcgIntegration && enemy.type.includes('elemental') || enemy.type.includes('golem')) {
                    // Special enemy defeated - give mana bonus
                    const manaBonus = 2;
                    this.tcgIntegration.mana = Math.min(
                        this.tcgIntegration.maxMana,
                        this.tcgIntegration.mana + manaBonus
                    );
                    this.tcgIntegration.updateManaDisplay();
                    
                    // Visual effect for mana bonus
                    this.createManaBonusEffect(enemy.position);
                }

                // Remove enemy mesh from scene
                if (enemy.mesh) {
                    this.renderer.scene.remove(enemy.mesh);
                }

                this.enemies.splice(i, 1);
                this.updateUI();
            }
        }
    }

    updateTowers() {
        for (const tower of this.towers) {
            tower.update(this.deltaTime);

            // Check for targets if tower is not on cooldown
            if (tower.canFire()) {
                const target = this.findTarget(tower);
                if (target) {
                    tower.fire(target);
                }
            }
        }
    }

    updateProjectiles() {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            projectile.update(this.deltaTime);

            // Check if projectile hit a target or is out of bounds
            if (projectile.hit || projectile.isOutOfBounds()) {
                this.projectiles.splice(i, 1);
            }
        }
    }

    findTarget(tower) {
        // Simple targeting - find closest enemy in range
        let closestEnemy = null;
        let closestDistance = Infinity;

        for (const enemy of this.enemies) {
            const distance = this.calculateDistance(tower.position, enemy.position);
            if (distance <= tower.range && distance < closestDistance) {
                closestEnemy = enemy;
                closestDistance = distance;
            }
        }

        return closestEnemy;
    }

    async placeTower(towerType, gridX, gridY) {
        console.log(`Attempting to place ${towerType} tower at grid: ${gridX}, ${gridY}`);

        // Check if cell is empty and tower can be placed
        if (!await this.map.canPlaceTower(gridX, gridY)) {
            console.log("Tower placement failed: canPlaceTower returned false");
            return false;
        }

        // Get tower cost
        const costs = {
            'arrow': 10,
            'doubleArrow': 25,
            'cannon': 50
        };

        const cost = costs[towerType];

        // Check if player has enough gold
        if (this.player.gold < cost) {
            console.log("Tower placement failed: Not enough gold");
            return false;
        }

        // Create tower
        const position = this.map.gridToWorld(gridX, gridY);
        const tower = new Tower(this, towerType, position, { gridX, gridY });

        // Update map grid and game state
        this.map.placeTower(gridX, gridY);
        this.towers.push(tower);

        // Deduct gold
        this.player.gold -= cost;
        this.updateUI();

        console.log(`Tower placement successful at grid: ${gridX}, ${gridY}`);
        return true;
    }

    activatePowerCard(cardType, cost) {
        if (this.player.gold < cost) return false;

        // Attempt to activate the power card
        const success = this.powerCards.activate(cardType);

        if (success) {
            // Deduct gold
            this.player.gold -= cost;
            this.updateUI();
        }

        return success;
    }

    updateUI() {
        document.getElementById('gold-amount').textContent = this.player.gold;
        document.getElementById('lives-amount').textContent = this.player.lives;
        document.getElementById('wave-number').textContent = this.currentWave;
    }

    victory() {
        this.gameOver = true;
        this.endGame(true);
    }

    endGame(isVictory) {
        const overlay = document.getElementById('game-overlay');
        const endScreen = document.getElementById('end-screen');
        const resultMessage = document.getElementById('result-message');
        const scoreDisplay = document.getElementById('score-display');

        // Show end screen
        overlay.classList.remove('hidden');
        endScreen.classList.remove('hidden');

        // Set result message
        if (isVictory) {
            resultMessage.textContent = 'Victory!';
        } else {
            resultMessage.textContent = 'Game Over';
        }

        // Display score
        scoreDisplay.textContent = `${this.player.username}'s Score: ${this.player.score}`;
    }

    toggleDebugMode() {
        this.debugMode = !this.debugMode;
        
        // Update path visualization visibility
        if (this.map && this.map.pathVisualization) {
            this.map.pathVisualization.visible = this.debugMode;
        }
    }

    calculateDistance(pos1, pos2) {
        const dx = pos2.x - pos1.x;
        const dz = pos2.z - pos1.z;
        return Math.sqrt(dx * dx + dz * dz);
    }
    
    createManaBonusEffect(position) {
        // Create a visual mana bonus effect at the given position
        
        // Skip if no renderer or TCG not enabled
        if (!this.renderer || !this.tcgIntegration) return;
        
        // Create a mana orb effect
        const orbGeometry = new THREE.SphereGeometry(0.3, 16, 16);
        const orbMaterial = new THREE.MeshBasicMaterial({
            color: 0x3498db, // Mana blue color
            transparent: true,
            opacity: 0.8
        });
        
        const orb = new THREE.Mesh(orbGeometry, orbMaterial);
        orb.position.set(position.x, position.y + 1, position.z);
        
        this.renderer.scene.add(orb);
        
        // Add text showing +2
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 64;
        canvas.height = 32;
        
        context.font = 'Bold 24px Arial';
        context.fillStyle = '#3498db';
        context.textAlign = 'center';
        context.fillText('+2', 32, 24);
        
        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true
        });
        
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.set(position.x, position.y + 1.5, position.z);
        sprite.scale.set(0.75, 0.375, 1);
        
        this.renderer.scene.add(sprite);
        
        // Animate and remove effect
        const startTime = performance.now();
        const duration = 1500; // 1.5 seconds
        
        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            if (progress < 1) {
                // Float upward
                orb.position.y += 0.01;
                sprite.position.y += 0.015;
                
                // Pulse size
                const scale = 1 + 0.2 * Math.sin(progress * Math.PI * 4);
                orb.scale.set(scale, scale, scale);
                
                // Fade out at the end
                if (progress > 0.7) {
                    const fadeOutProgress = (progress - 0.7) / 0.3;
                    orbMaterial.opacity = 0.8 * (1 - fadeOutProgress);
                    spriteMaterial.opacity = 1 - fadeOutProgress;
                }
                
                requestAnimationFrame(animate);
            } else {
                // Remove effect
                this.renderer.scene.remove(orb);
                this.renderer.scene.remove(sprite);
            }
        };
        
        animate();
    }
}