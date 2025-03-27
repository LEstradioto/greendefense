import { Renderer } from './renderer.js';
import { Map } from './map.js';
import { PowerCards } from './powerCards.js';
import { Enemy } from './entities/enemy/index.js';
import { Tower } from './entities/tower.js';
import { TCGIntegration } from './tcg-integration.js';
import { UI } from './ui.js';
import { ElementTypes, ElementEffects, ElementStyles } from './elements.js';

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
        this.maxWaves = 6; // Increased from 3 to 6 waves
        this.waveInProgress = false;
        this.gameStarted = false;
        this.gameOver = false;
        this.debugMode = false;
        this.cardDebugMode = false; // New debug mode for testing cards
        this.isMultiplayer = false; // Will be used for TCG enemy cards

        // Game timing
        this.lastFrameTime = 0;
        this.deltaTime = 0;
        this.enemySpawnInterval = 2000; // ms
        this.lastEnemySpawnTime = 0;
        // Increased number of enemies per wave and added more waves
        this.enemiesPerWave = [10, 15, 20, 25, 30, 40]; // Number of enemies per wave
        this.enemiesSpawned = 0;
        this.enemiesDefeated = 0;

        // Bind methods
        this.update = this.update.bind(this);
        this.startWave = this.startWave.bind(this);
        
        // UI and TCG System will be initialized after map is ready
        this.tcgIntegration = null;
    }

    async start(username) {
        // Clean up any previous game state first
        if (this.gameStarted) {
            // If restarting, ensure we clean up properly
            this.clearAllEntities();
            if (this.renderer) {
                this.renderer.cleanupScene();
            }
        }
        
        this.player.username = username;
        this.gameStarted = true;
        this.gameOver = false;
        this.lastFrameTime = performance.now();
        
        // Make sure map is initialized
        await this.map.initialize();
        
        // Initialize TCG system
        if (!this.tcgIntegration) {
            this.tcgIntegration = new TCGIntegration(this);
        } else {
            // Reset existing TCG integration
            this.tcgIntegration.reset();
        }
        
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

        console.log("Game started for player:", username);
        
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

        // Handle debug infinite gold & mana if enabled
        if (this.cardDebugMode) {
            if (document.getElementById('debug-infinite-gold')?.checked) {
                this.player.gold = 9999;
                document.getElementById('gold-amount').textContent = this.player.gold;
            }
            
            if (document.getElementById('debug-infinite-mana')?.checked && this.tcgIntegration) {
                this.tcgIntegration.mana = this.tcgIntegration.absoluteMaxMana;
                this.tcgIntegration.updateManaDisplay();
            }
        }

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

        // Update UI with current wave/max waves format
        document.getElementById('wave-number').textContent = `${this.currentWave}/${this.maxWaves}`;
    }

    completeWave() {
        this.waveInProgress = false;

        // Reward player for completing the wave
        // Scale rewards for later waves to provide better economy
        let waveBonus;
        switch (this.currentWave) {
            case 1:
                waveBonus = 50;
                break;
            case 2:
                waveBonus = 100;
                break;
            case 3:
                waveBonus = 150;
                break;
            case 4:
                waveBonus = 220;
                break;
            case 5:
                waveBonus = 300;
                break;
            case 6:
                waveBonus = 400;
                break;
            default:
                waveBonus = this.currentWave * 50;
        }
        
        this.player.gold += waveBonus;
        this.player.score += waveBonus;
        
        // Show wave completion bonus message
        this.showWaveCompletionMessage(waveBonus);

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
        // Determine enemy type based on wave and add elemental enemies in later waves
        let enemyType;
        let elementType = ElementTypes.NEUTRAL;
        
        // In card debug mode, spawn a variety of enemies to test against
        if (this.cardDebugMode) {
            // During debug mode, cycle through all enemy types to see them all
            const enemyTypes = ['simple', 'elephant', 'pirate', 'golem'];
            const totalEnemies = this.enemies.length + this.enemiesSpawned;
            enemyType = enemyTypes[totalEnemies % enemyTypes.length];
            
            // Also cycle through elements
            const elements = [
                ElementTypes.FIRE, 
                ElementTypes.WATER, 
                ElementTypes.EARTH, 
                ElementTypes.AIR, 
                ElementTypes.SHADOW
            ];
            
            // Apply elements to every other enemy
            if (totalEnemies % 2 === 0) {
                elementType = elements[Math.floor(totalEnemies / 2) % elements.length];
            }
        } 
        // Normal enemy spawning logic
        else {
            // Determine enemy type based on wave
            if (this.currentWave === 1) {
                enemyType = 'simple';
            } else if (this.currentWave === 2) {
                enemyType = Math.random() > 0.5 ? 'simple' : 'elephant';
                
                // 20% chance for elemental enemy at wave 2
                if (Math.random() < 0.2) {
                    elementType = this.getRandomElement();
                }
            } else if (this.currentWave === 3) {
                // Wave 3 - mix of all base enemy types
                const rand = Math.random();
                if (rand < 0.3) enemyType = 'simple';
                else if (rand < 0.7) enemyType = 'elephant';
                else enemyType = 'pirate';
                
                // 35% chance for elemental enemy at wave 3
                if (Math.random() < 0.35) {
                    elementType = this.getRandomElement();
                }
            } else if (this.currentWave === 4) {
                // Wave 4 - mainly stronger enemies
                const rand = Math.random();
                if (rand < 0.2) enemyType = 'simple';
                else if (rand < 0.6) enemyType = 'elephant';
                else enemyType = 'pirate';
                
                // 50% chance for elemental enemy at wave 4
                if (Math.random() < 0.5) {
                    elementType = this.getRandomElement();
                }
            } else if (this.currentWave === 5) {
                // Wave 5 - stronger enemies with elementals
                const rand = Math.random();
                if (rand < 0.1) enemyType = 'simple';
                else if (rand < 0.5) enemyType = 'elephant';
                else enemyType = 'pirate';
                
                // 75% chance for elemental enemy at wave 5
                if (Math.random() < 0.75) {
                    elementType = this.getRandomElement();
                    
                    // 25% chance to spawn a golem (special enemy)
                    if (Math.random() < 0.25) {
                        enemyType = 'golem';
                    }
                }
            } else {
                // Wave 6 (final wave) - mostly powerful enemies
                const rand = Math.random();
                if (rand < 0.1) enemyType = 'elephant';
                else if (rand < 0.6) enemyType = 'pirate';
                else enemyType = 'golem';
                
                // 90% chance for elemental enemy at wave 6
                if (Math.random() < 0.9) {
                    elementType = this.getRandomElement();
                }
            }
        }
        
        // If it's an elemental enemy, add the element type to the name
        if (elementType !== ElementTypes.NEUTRAL) {
            enemyType = `${elementType}_${enemyType}`;
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
                // Check for infinite lives in debug mode
                const hasInfiniteLives = this.cardDebugMode && 
                    document.getElementById('debug-infinite-lives')?.checked;
                
                if (!hasInfiniteLives) {
                    this.player.lives -= 1;
                    
                    // Create life flash effect
                    this.createLifeFlashEffect();
                }

                // Remove enemy mesh from scene
                if (enemy.mesh) {
                    this.renderer.scene.remove(enemy.mesh);
                }

                this.enemies.splice(i, 1);
                this.updateUI();

                // Check if game over (skip if infinite lives enabled)
                if (this.player.lives <= 0 && !hasInfiniteLives) {
                    this.gameOver = true;
                    this.createGameOverEffect();
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
                if (this.tcgIntegration && (
                    enemy.type.includes('elemental') || 
                    enemy.type.includes('fire') || 
                    enemy.type.includes('water') || 
                    enemy.type.includes('earth') || 
                    enemy.type.includes('air') || 
                    enemy.type.includes('shadow') || 
                    enemy.type.includes('golem')
                )) {
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

        // Get tower cost based on type - add support for elemental towers
        const costs = {
            // Basic towers
            'arrow': 10,
            'doubleArrow': 25,
            'cannon': 50,
            
            // Elemental basic towers
            'fire_basic': 15,
            'water_basic': 15, 
            'earth_basic': 20,
            'air_basic': 15,
            'shadow_basic': 20,
            
            // Elemental advanced towers
            'fire_advanced': 35,
            'water_advanced': 35,
            'earth_advanced': 45,
            'air_advanced': 30,
            'shadow_advanced': 40
        };

        const cost = costs[towerType] || 20; // Default cost if tower type not found

        // Check if player has enough gold
        if (this.player.gold < cost) {
            console.log("Tower placement failed: Not enough gold");
            return false;
        }

        // Create tower - determine default element based on tower type
        let element = ElementTypes.NEUTRAL;
        if (towerType.startsWith('fire_')) {
            element = ElementTypes.FIRE;
        } else if (towerType.startsWith('water_')) {
            element = ElementTypes.WATER;
        } else if (towerType.startsWith('earth_')) {
            element = ElementTypes.EARTH;
        } else if (towerType.startsWith('air_')) {
            element = ElementTypes.AIR;
        } else if (towerType.startsWith('shadow_')) {
            element = ElementTypes.SHADOW;
        }

        const position = this.map.gridToWorld(gridX, gridY);
        const tower = new Tower(this, towerType, position, { gridX, gridY }, element);

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
        document.getElementById('wave-number').textContent = `${this.currentWave}/${this.maxWaves}`;
    }

    victory() {
        this.gameOver = true;
        
        // Create fireworks for victory
        this.createFireworksEffect();
        
        this.endGame(true);
    }

    resetGameState() {
        // Clean up any remaining meshes in the scene first
        // This prevents duplicate map generation
        if (this.renderer && this.renderer.scene) {
            // Keep only essential elements (ground, lights)
            this.renderer.cleanupScene();
        }
        
        // Clear all game entities
        this.clearAllEntities();
        
        // Reset player stats
        this.player.gold = 100;
        this.player.lives = 20;
        this.player.score = 0;
        
        // Reset wave counters
        this.currentWave = 1;
        this.waveInProgress = false;
        this.enemiesSpawned = 0;
        this.enemiesDefeated = 0;
        
        // Reset game flags
        this.gameOver = false;
        this.gameStarted = false;
        
        // Reset the UI
        this.updateUI();
        
        // Reset the map
        if (this.map) {
            console.log("Resetting map with dimensions:", this.map.gridWidth, "x", this.map.gridHeight);
            this.map.reset();
            console.log("Map reset complete, dimensions now:", this.map.gridWidth, "x", this.map.gridHeight);
        }
        
        // Reset TCG if active
        if (this.tcgIntegration) {
            this.tcgIntegration.reset();
        }
        
        console.log("Game state reset completed");
    }
    
    clearAllEntities() {
        // Clean up all entities properly
        
        // Clean up enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            if (this.enemies[i].mesh) {
                this.renderer.scene.remove(this.enemies[i].mesh);
            }
        }
        this.enemies = [];
        
        // Clean up towers
        for (let i = this.towers.length - 1; i >= 0; i--) {
            if (this.towers[i].mesh) {
                this.renderer.scene.remove(this.towers[i].mesh);
            }
        }
        this.towers = [];
        
        // Clean up projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            if (this.projectiles[i].mesh) {
                this.renderer.scene.remove(this.projectiles[i].mesh);
            }
        }
        this.projectiles = [];
    }
    
    endGame(isVictory) {
        const overlay = document.getElementById('game-overlay');
        const startScreen = document.getElementById('start-screen');
        const endScreen = document.getElementById('end-screen');
        const resultMessage = document.getElementById('result-message');
        const scoreDisplay = document.getElementById('score-display');
        
        console.log("Ending game, victory:", isVictory);

        // Show end screen after a short delay
        setTimeout(() => {
            console.log("Showing end screen");
            
            // Show overlay
            overlay.style.display = '';
            overlay.classList.remove('hidden');
            
            // Show end screen immediately 
            endScreen.style.display = '';
            endScreen.classList.remove('hidden');
            
            // Hide start screen if it's visible
            startScreen.classList.add('hidden');
            
            // Force refresh of display to ensure elements are visible
            setTimeout(() => {
                overlay.style.opacity = "1";
                endScreen.style.opacity = "1";
            }, 0);
    
            // Set result message
            if (isVictory) {
                resultMessage.textContent = 'Victory!';
            } else {
                resultMessage.textContent = 'Game Over';
            }
    
            // Display score
            scoreDisplay.textContent = `${this.player.username}'s Score: ${this.player.score}`;
            
            // Setup restart button to restart the game
            const restartButton = document.getElementById('restart-button');
            restartButton.onclick = null; // Clear any previous handlers
            
            restartButton.addEventListener('click', () => {
                console.log("Restart button clicked, showing start screen");
                
                // Hide the end screen
                endScreen.classList.add('hidden');
                
                // Show the start screen
                startScreen.classList.remove('hidden');
                
                // Make sure elements are visible
                overlay.style.display = '';
                overlay.classList.remove('hidden');
                
                // Reset game state for a fresh start
                this.resetGameState();
                
                console.log("Game state reset complete");
            });
        }, isVictory ? 3000 : 2500); // Longer delay for animations to complete
    }

    toggleDebugMode() {
        this.debugMode = !this.debugMode;
        
        // Update path visualization visibility only in debug mode
        if (this.map && this.map.pathVisualization) {
            this.map.pathVisualization.visible = this.debugMode;
        }
        
        // Log debug mode state
        console.log(`Debug mode ${this.debugMode ? 'enabled' : 'disabled'}`);
    }
    
    toggleCardDebugMode() {
        this.cardDebugMode = !this.cardDebugMode;
        
        // If enabling card debug mode
        if (this.cardDebugMode && this.tcgIntegration) {
            // Give player infinite mana
            this.tcgIntegration.mana = this.tcgIntegration.absoluteMaxMana;
            this.tcgIntegration.maxMana = this.tcgIntegration.absoluteMaxMana;
            
            // Increase max cards in hand for debug mode
            this.tcgIntegration.maxCardsInHand = 20;
            
            // Clear current hand
            this.tcgIntegration.hand = [];
            
            // Draw all available cards (one of each type)
            const allCards = this.tcgIntegration.cardCatalog.getAllCards();
            
            // Add all tower cards
            for (const towerCard of allCards.towers) {
                if (this.tcgIntegration.hand.length < this.tcgIntegration.maxCardsInHand) {
                    this.tcgIntegration.hand.push(towerCard);
                }
            }
            
            // Add all spell cards
            for (const spellCard of allCards.spells) {
                if (this.tcgIntegration.hand.length < this.tcgIntegration.maxCardsInHand) {
                    this.tcgIntegration.hand.push(spellCard);
                }
            }
            
            // Add power cards
            for (const powerCard of this.tcgIntegration.powerCards) {
                if (this.tcgIntegration.hand.length < this.tcgIntegration.maxCardsInHand) {
                    this.tcgIntegration.hand.push(powerCard);
                }
            }
            
            // Update UI
            this.tcgIntegration.updateCardUI();
            this.tcgIntegration.updateManaDisplay();
            
            // Show debug panel button
            document.getElementById('toggle-debug-panel').classList.remove('hidden');
            
            // Setup debug enemy showcase if not already done
            this.setupEnemyShowcase();
            
            console.log("Card debug mode enabled - all cards available with infinite mana");
        } else {
            // When disabling, reset to normal state
            if (this.tcgIntegration) {
                // Reset mana to normal
                this.tcgIntegration.mana = 5;
                this.tcgIntegration.maxMana = 5;
                
                // Reset max cards in hand
                this.tcgIntegration.maxCardsInHand = 5;
                
                // Draw a normal hand
                this.tcgIntegration.drawInitialHand();
                
                // Hide debug panel
                document.getElementById('toggle-debug-panel').classList.add('hidden');
                document.getElementById('debug-panel').classList.add('hidden');
                
                // Reset debug options
                document.getElementById('debug-infinite-lives').checked = false;
                document.getElementById('debug-infinite-gold').checked = false;
                
                console.log("Card debug mode disabled - returned to normal state");
            }
        }
        
        // Update UI to show that debug mode is active
        document.body.classList.toggle('card-debug-mode', this.cardDebugMode);
    }
    
    setupEnemyShowcase() {
        // Create showcase of all enemy types
        const container = document.getElementById('enemy-showcase-container');
        if (!container) return;
        
        // Clear existing content
        container.innerHTML = '';
        
        // Define all enemy types to showcase
        const enemyTypes = [
            { 
                type: 'simple', 
                displayName: 'Simple', 
                health: 10, 
                speed: 'Fast', 
                description: 'Basic enemy with low health'
            },
            { 
                type: 'elephant', 
                displayName: 'Elephant', 
                health: 30, 
                speed: 'Slow', 
                description: 'Tanky enemy with high health'
            },
            { 
                type: 'pirate', 
                displayName: 'Pirate', 
                health: 20, 
                speed: 'Medium', 
                description: 'Balanced enemy with moderate stats'
            },
            { 
                type: 'golem', 
                displayName: 'Golem', 
                health: 50, 
                speed: 'Very Slow', 
                description: 'Elite enemy with very high health'
            }
        ];
        
        // Define element types to showcase
        const elementTypes = [
            { type: ElementTypes.NEUTRAL, displayName: 'Neutral' },
            { type: ElementTypes.FIRE, displayName: 'Fire' },
            { type: ElementTypes.WATER, displayName: 'Water' },
            { type: ElementTypes.EARTH, displayName: 'Earth' },
            { type: ElementTypes.AIR, displayName: 'Air' },
            { type: ElementTypes.SHADOW, displayName: 'Shadow' }
        ];
        
        // Generate cards for each enemy type and element combination
        enemyTypes.forEach(enemy => {
            elementTypes.forEach(element => {
                // Skip some combinations to keep the showcase manageable
                if (element.type !== ElementTypes.NEUTRAL && 
                    enemy.type === 'simple' && 
                    element.type !== ElementTypes.FIRE && 
                    element.type !== ElementTypes.WATER) {
                    return;
                }
                
                // Create enemy card element
                const card = document.createElement('div');
                card.className = 'enemy-card';
                
                // Title with element if applicable
                const title = document.createElement('div');
                title.className = 'enemy-card-title';
                if (element.type === ElementTypes.NEUTRAL) {
                    title.textContent = enemy.displayName;
                } else {
                    title.textContent = `${element.displayName} ${enemy.displayName}`;
                    // Add element-based styling
                    card.style.borderColor = this.getElementColor(element.type);
                }
                card.appendChild(title);
                
                // Enemy info
                const info = document.createElement('div');
                info.className = 'enemy-card-info';
                info.textContent = enemy.description;
                card.appendChild(info);
                
                // Enemy attributes
                const attributes = document.createElement('div');
                attributes.className = 'enemy-attributes';
                
                // Add health, speed, etc.
                const health = document.createElement('span');
                health.textContent = `Health: ${enemy.health}`;
                
                const speed = document.createElement('span');
                speed.textContent = `Speed: ${enemy.speed}`;
                
                // Add element-specific attributes
                let elementText = '';
                if (element.type !== ElementTypes.NEUTRAL) {
                    elementText = `Element: ${element.displayName}`;
                }
                
                attributes.appendChild(health);
                attributes.appendChild(speed);
                
                if (elementText) {
                    const elementInfo = document.createElement('span');
                    elementInfo.textContent = elementText;
                    elementInfo.style.color = this.getElementColor(element.type);
                    attributes.appendChild(elementInfo);
                }
                
                card.appendChild(attributes);
                
                // Add spawn button
                const spawnBtn = document.createElement('button');
                spawnBtn.textContent = 'Spawn';
                spawnBtn.style.marginTop = '5px';
                spawnBtn.style.padding = '2px 5px';
                spawnBtn.style.fontSize = '10px';
                spawnBtn.style.backgroundColor = '#3498db';
                spawnBtn.style.border = 'none';
                spawnBtn.style.borderRadius = '3px';
                spawnBtn.style.cursor = 'pointer';
                
                // Set data attributes for spawning
                spawnBtn.dataset.enemyType = enemy.type;
                spawnBtn.dataset.elementType = element.type;
                
                // Add click event to spawn this enemy
                spawnBtn.addEventListener('click', () => {
                    this.debugSpawnEnemy(enemy.type, element.type);
                });
                
                card.appendChild(spawnBtn);
                
                // Add to container
                container.appendChild(card);
            });
        });
        
        // Show the showcase
        document.querySelector('.debug-enemy-showcase').classList.remove('hidden');
    }
    
    getElementColor(elementType) {
        switch (elementType) {
            case ElementTypes.FIRE: return '#e74c3c'; // Red
            case ElementTypes.WATER: return '#3498db'; // Blue
            case ElementTypes.EARTH: return '#27ae60'; // Green
            case ElementTypes.AIR: return '#95a5a6'; // Light Gray
            case ElementTypes.SHADOW: return '#9b59b6'; // Purple
            default: return '#95a5a6'; // Gray for neutral
        }
    }
    
    debugSpawnEnemy(enemyType, elementType = ElementTypes.NEUTRAL) {
        if (!this.cardDebugMode) return;
        
        // Find a valid entry point
        const validEntryPoints = [];
        for (let x = 0; x < this.map.gridWidth; x++) {
            if (this.map.grid[0][x] === 1) {
                validEntryPoints.push({ x, z: 0 });
            }
        }
        
        if (validEntryPoints.length === 0) return;
        
        // Choose a random entry point
        const randomEntryIndex = Math.floor(Math.random() * validEntryPoints.length);
        const startGridPoint = validEntryPoints[randomEntryIndex];
        
        // Convert grid position to world position
        const startWorldPoint = this.map.gridToWorld(startGridPoint.x, startGridPoint.z);
        
        // Add element prefix if it's an elemental enemy
        let fullEnemyType = enemyType;
        if (elementType !== ElementTypes.NEUTRAL) {
            fullEnemyType = `${elementType}_${enemyType}`;
        }
        
        // Create and add enemy
        const enemy = new Enemy(this, fullEnemyType, startWorldPoint);
        this.enemies.push(enemy);
        
        console.log(`Spawned ${fullEnemyType} enemy at position:`, startWorldPoint);
    }
    
    debugCompleteWave() {
        if (!this.cardDebugMode || !this.waveInProgress) return;
        
        // Remove all existing enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (enemy.mesh) {
                this.renderer.scene.remove(enemy.mesh);
            }
            this.enemies.splice(i, 1);
        }
        
        // Set wave progress to completion
        this.enemiesSpawned = this.enemiesPerWave[this.currentWave - 1];
        this.completeWave();
        
        console.log("Debug: Wave completed immediately");
    }
    
    debugStartWave() {
        if (!this.cardDebugMode) return;
        
        // If a wave is in progress, complete it first
        if (this.waveInProgress) {
            this.debugCompleteWave();
        }
        
        // After a short delay, start the next wave (even if the current wave completes)
        setTimeout(() => {
            this.startWave();
            console.log("Debug: Started wave", this.currentWave);
        }, 300);
    }

    calculateDistance(pos1, pos2) {
        const dx = pos2.x - pos1.x;
        const dz = pos2.z - pos1.z;
        return Math.sqrt(dx * dx + dz * dz);
    }
    
    getRandomElement() {
        // Return a random element type (excluding NEUTRAL)
        const elements = [
            ElementTypes.FIRE,
            ElementTypes.WATER,
            ElementTypes.EARTH,
            ElementTypes.AIR,
            ElementTypes.SHADOW
        ];
        
        return elements[Math.floor(Math.random() * elements.length)];
    }
    
    showWaveCompletionMessage(amount) {
        // Create a visual message for wave completion bonus
        if (!this.renderer) return;
        
        const message = `Wave ${this.currentWave} Complete! +${amount} Gold`;
        
        // Create a text canvas with more width to avoid text cutting
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 1024; // Doubled width to prevent text from being cut off
        canvas.height = 256;  // Increased height for better positioning
        
        // Clear canvas
        context.fillStyle = 'rgba(0, 0, 0, 0)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw message
        context.font = 'Bold 48px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Measure text width to ensure it fits
        const textWidth = context.measureText(message).width;
        console.log("Wave message width:", textWidth, "Canvas width:", canvas.width);
        
        // Add glow effect
        context.shadowColor = '#FFD700';
        context.shadowBlur = 20;
        
        // Draw gold text
        context.fillStyle = '#FFD700';
        context.fillText(message, canvas.width / 2, canvas.height / 2);
        
        // Create texture and sprite
        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true
        });
        
        const sprite = new THREE.Sprite(spriteMaterial);
        // Position in center of map
        sprite.position.set(0, 5, 0); 
        sprite.scale.set(15, 3.75, 1); // Increased scale to match bigger canvas
        
        this.renderer.scene.add(sprite);
        
        // Animate and remove after delay
        const startTime = performance.now();
        const duration = 3000; // 3 seconds
        
        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            if (progress < 1) {
                // Float upwards
                sprite.position.y += 0.02;
                
                // Fade out at the end
                if (progress > 0.7) {
                    const fadeOutProgress = (progress - 0.7) / 0.3;
                    spriteMaterial.opacity = 1 - fadeOutProgress;
                }
                
                requestAnimationFrame(animate);
            } else {
                // Remove sprite
                this.renderer.scene.remove(sprite);
            }
        };
        
        animate();
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
    
    createLifeFlashEffect() {
        // Create a red flash effect when player loses a life
        const flashElement = document.createElement('div');
        flashElement.className = 'life-flash';
        document.body.appendChild(flashElement);
        
        // Remove the element after animation completes
        setTimeout(() => {
            document.body.removeChild(flashElement);
        }, 600);
    }
    
    createGameOverEffect() {
        // Create game over visual effect for defeat
        const container = document.createElement('div');
        container.className = 'game-over-effect';
        document.body.appendChild(container);
        
        // Add game over text with shake animation
        const gameOverText = document.createElement('div');
        gameOverText.className = 'game-over-text';
        gameOverText.textContent = 'GAME OVER';
        document.body.appendChild(gameOverText);
        
        // Remove after animation completes
        setTimeout(() => {
            document.body.removeChild(container);
            document.body.removeChild(gameOverText);
        }, 2500);
    }
    
    createFireworksEffect() {
        // Create fireworks visual effect for victory
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
        
        // Create multiple fireworks with different colors and timings
        const colors = [
            '#FF0000', '#00FF00', '#0000FF', '#FFFF00', 
            '#FF00FF', '#00FFFF', '#FFFFFF', '#FF8800'
        ];
        
        const launchFirework = (delay, color) => {
            setTimeout(() => {
                // Random position
                const x = Math.random() * 100;
                const y = 30 + Math.random() * 50;
                
                // Create the firework element
                const firework = document.createElement('div');
                firework.className = 'firework';
                firework.style.left = `${x}%`;
                firework.style.top = `${y}%`;
                firework.style.backgroundColor = color;
                firework.style.boxShadow = `0 0 15px 5px ${color}`;
                container.appendChild(firework);
                
                // Create particles
                const particleCount = 20 + Math.floor(Math.random() * 30);
                for (let i = 0; i < particleCount; i++) {
                    const particle = document.createElement('div');
                    particle.className = 'firework';
                    
                    // Calculate particle position (circular pattern)
                    const angle = Math.random() * Math.PI * 2;
                    const distance = 2 + Math.random() * 3;
                    const particleX = x + Math.cos(angle) * distance;
                    const particleY = y + Math.sin(angle) * distance;
                    
                    // Set particle style
                    particle.style.left = `${particleX}%`;
                    particle.style.top = `${particleY}%`;
                    particle.style.backgroundColor = color;
                    particle.style.boxShadow = `0 0 8px 3px ${color}`;
                    particle.style.opacity = '0';
                    particle.style.transform = 'scale(0.1)';
                    
                    // Add to container
                    container.appendChild(particle);
                    
                    // Animate the particle with slight delay
                    setTimeout(() => {
                        particle.style.opacity = '1';
                        particle.style.transform = 'scale(1)';
                        
                        // Remove after animation completes
                        setTimeout(() => {
                            container.removeChild(particle);
                        }, 2000);
                    }, Math.random() * 300);
                }
                
                // Remove main firework element after a short delay
                setTimeout(() => {
                    container.removeChild(firework);
                }, 300);
                
            }, delay);
        };
        
        // Launch multiple fireworks with different timings
        for (let i = 0; i < 20; i++) {
            const delay = i * 300;
            const color = colors[i % colors.length];
            launchFirework(delay, color);
        }
        
        // Remove the container after all fireworks complete
        setTimeout(() => {
            document.body.removeChild(container);
        }, 8000);
    }
}