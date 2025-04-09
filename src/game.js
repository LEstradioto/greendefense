import { Renderer } from './renderer.js';
import { Map } from './map.js';
import { PowerCards } from './powerCards.js';
import { Enemy } from './entities/enemy.js';
import { Tower } from './entities/tower.js';
import { TCGIntegration } from './tcg-integration.js';
import { UI } from './ui.js';
import { ElementTypes, ElementEffects, ElementStyles } from './elements.js';
import { Projectile } from './entities/projectile.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new Renderer(canvas, this);
        this.map = new Map(this);
        this.enemies = [];
        this.towers = [];
        this.projectiles = [];
        this.powerCards = new PowerCards(this);

        // Object pools for entity recycling
        this.enemyPool = [];
        this.projectilePool = [];
        this.particlePool = [];

        // Animation system
        this.animations = [];
        this.animationIdCounter = 0;

        // Maximum number of entities to keep performance stable
        this.maxActiveProjectiles = 100; // Reduced limit to prevent visual clutter
        this.maxActiveEnemies = 150;

        // Pathfinding optimization
        this.cachedPaths = new Map(); // Store paths by grid coordinates - using JavaScript's Map() object
        this.pathRecalcFrequency = 500; // ms between path recalculations
        this._pathfindingCalls = 0; // For debugging

        // Performance optimization settings
        this.lowQualityMode = false;
        this.maxParticles = 200;
        this.enemyUpdateSkipRate = 3; // Default: update 1/3 of distant enemies

        // Game state
        this.player = {
            username: '',
            gold: 100,
            lives: 10,
            score: 0
        };

        // Performance monitoring
        this.fpsCounter = {
            element: null,
            frames: 0,
            lastUpdate: 0,
            value: 0
        };
        this.createFpsCounter();

        // Game timing tracking for score multiplier
        this.gameStartTime = 0;
        this.waveStartTimes = {};

        this.currentWave = 1;
        this.maxWaves = 6; // Increased from 3 to 6 waves
        this.waveInProgress = false;
        this.gameStarted = false;
        this.gameOver = false;
        this.debugMode = false;
        this.cardDebugMode = false; // New debug mode for testing cards
        this.isMultiplayer = false; // Will be used for TCG enemy cards

        // Progressive difficulty tracking
        this.consecutiveWavesWithoutLosses = 0; // Track waves completed without losing lives
        this.initialLives = 10; // Store initial lives value
        this.difficultyIncreaseActive = false; // Track if difficulty has been increased

        // Game balance settings
        this.difficultySettings = {
            enemyHealthMultiplier: 1.0,    // Base multiplier for enemy health
            enemySpeedMultiplier: 1.0,     // Base multiplier for enemy speed
            goldMultiplier: 1.0,           // Base multiplier for gold rewards
            towerDamageMultiplier: 1.0,    // Base multiplier for tower damage
            waveSpeedMultiplier: 1.0,       // Base multiplier for spawn rate
            spawnIntervalMultiplier: 1.0,  // Controls time between enemy spawns
            randomFactorMultiplier: 0.2,   // Random variation in enemy stats (0-1)
            bossHealthMultiplier: 3.0,     // Base multiplier for boss health
            bossSpeedMultiplier: 0.7,      // Base multiplier for boss speed (slower but tougher)
            lateStageBossBonus: 2.0        // Additional multiplier for bosses in waves 4-6
        };

        // Per-wave difficulty settings
        this.waveSettings = [
            { enemyHealth: 1.0, enemySpeed: 1.0, enemyCount: 15, goldMultiplier: 1.0, spawnBoss: false, batchSpawning: false },  // Wave 1
            { enemyHealth: 1.2, enemySpeed: 1.0, enemyCount: 30, goldMultiplier: 1.2, spawnBoss: false, batchSpawning: false },  // Wave 2
            { enemyHealth: 1.75, enemySpeed: 1.25, enemyCount: 50, goldMultiplier: 1.4, spawnBoss: false, batchSpawning: true },   // Wave 3
            { enemyHealth: 4.5, enemySpeed: 1.4, enemyCount: 70, goldMultiplier: 1.6, spawnBoss: true, batchSpawning: true },    // Wave 4 - Much higher health, more enemies
            { enemyHealth: 5.0, enemySpeed: 1.4, enemyCount: 90, goldMultiplier: 1.7, spawnBoss: true, batchSpawning: true },    // Wave 5 - Significantly increased health and count
            { enemyHealth: 5.5, enemySpeed: 1.5, enemyCount: 110, goldMultiplier: 1.8, spawnBoss: true, batchSpawning: true }     // Wave 6 - Massive wave with very tough enemies
        ];

        // Game timing
        this.lastFrameTime = 0;
        this.deltaTime = 0;
        this.enemySpawnInterval = 1000; // ms
        this.lastEnemySpawnTime = 0;
        // Enemy counts now defined in waveSettings
        this.enemiesSpawned = 0;
        this.enemiesDefeated = 0;

        // Track active waves for multi-wave support
        this.activeWaves = [];
        this.wavesCompleted = 0;

        // Bind methods
        this.update = this.update.bind(this);
        this.startWave = this.startWave.bind(this);

        // UI and TCG System will be initialized after map is ready
        this.tcgIntegration = null;

        // Initialize projectile pool
        this.projectilePool = [];
        this.maxPoolSize = 300; // Maximum size of the projectile pool
    }

    async start(username) {
        console.log("=== GAME START/RESTART SEQUENCE INITIATED ===");

        // Clean up any previous game state first
        if (this.gameStarted) {
            console.log("Restarting game - cleaning up previous state");
            // If restarting, ensure we clean up properly
            this.clearAllEntities();
            if (this.renderer) {
                console.log("Cleaning up renderer scene");
                this.renderer.cleanupScene();
                // Explicitly reinitialize instance managers
                console.log("Reinitializing instance managers");
                this.renderer.initializeInstanceManagers();
            }
        }

        this.player.username = username;
        this.gameStarted = true;
        this.gameOver = false;
        this.lastFrameTime = performance.now();

        // Record game start time for scoring
        this.gameStartTime = performance.now();
        this.waveStartTimes = {};

        // Load saved wave settings if available
        this.loadWaveSettings();

        // Make sure map is initialized - add explicit await to ensure it completes
        console.log("Initializing map");
        try {
            let mapPath = null;

            if (this.gameStarted && this.map) {
                // If restarting, use the reset method instead of initialize
                console.log("Resetting existing map");
                await this.map.reset();

                // Ensure the map is recreated in the renderer if it was removed
                if (!this.renderer.scene.children.find(child => child.userData && child.userData.ground)) {
                    console.log("Map not found in scene, recreating...");
                    const gridSize = { width: this.map.gridWidth, height: this.map.gridHeight };
                    this.map.mapGroup = this.renderer.createMap(this.map.grid, gridSize);
                }

                mapPath = this.map.path;
            } else {
                // First time start - initialize the map
                await this.map.initialize();
                mapPath = this.map.path;
            }

            console.log("Map initialized, path length:", mapPath ? mapPath.length : "path not set");

            if (!mapPath || !Array.isArray(mapPath) || mapPath.length === 0) {
                console.error("Map initialization failed to create valid path - retrying");
                // Force recreate the path
                mapPath = await this.map.recreatePathWaypoints();
                console.log("Map path after retry:", mapPath ? mapPath.length : "path still not set");
            }
        } catch (err) {
            console.error("Error initializing map:", err);
        }

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

        // Create difficulty controls in the debug panel
        this.createDifficultyControls();

        // Add CSS class for TCG integration
        document.body.classList.add('tcg-enabled');

        // Start the game loop
        requestAnimationFrame(this.update);

        // Add console logs for debugging restart issues
        console.log("Game started/restarted with username:", username);
        console.log("Game state:", {
            gameStarted: this.gameStarted,
            gameOver: this.gameOver,
            currentWave: this.currentWave,
            enemies: this.enemies.length,
            towers: this.towers.length,
            mapPathInitialized: this.map.path && Array.isArray(this.map.path) && this.map.path.length > 0
        });
        console.log("=== GAME START/RESTART SEQUENCE COMPLETED ===");

        // Only start the first wave if we have a valid map path
        if (this.map.path && Array.isArray(this.map.path) && this.map.path.length > 0) {
        // Start the first wave after a short delay
        setTimeout(() => {
                this.startWave();
            }, 3000);
        } else {
            console.error("Cannot start game wave - map path is not properly initialized");
        }
    }

    startCountdown(seconds) {
        this.countdownTimer = seconds;
        this.countdownActive = true;

        // Create UI element for countdown display
        const countdownEl = document.createElement('div');
        countdownEl.id = 'game-countdown';
        countdownEl.classList.add('game-countdown');

        // Seconds div
        const secondsEl = document.createElement('div');
        secondsEl.textContent = this.countdownTimer;

        // Style the countdown
        countdownEl.style.position = 'fixed';
        countdownEl.style.top = '50%';
        countdownEl.style.left = '50%';
        countdownEl.style.transform = 'translate(-50%, -50%)';
        countdownEl.style.fontSize = '5rem';
        countdownEl.style.fontWeight = 'bold';
        countdownEl.style.color = '#fff';
        countdownEl.style.textShadow = '0 0 10px rgba(0,0,0,0.7)';
        countdownEl.style.zIndex = '1000';
        countdownEl.style.textAlign = 'center';
        // Make the countdown not selectable and allow cursor events to pass through
        countdownEl.style.userSelect = 'none';
        countdownEl.style.pointerEvents = 'none';
        countdownEl.style.webkitUserSelect = 'none';
        countdownEl.style.msUserSelect = 'none';

        // Add "Get Ready!" text
        const readyText = document.createElement('div');
        readyText.textContent = 'Get Ready!';
        readyText.style.fontSize = '2rem';
        readyText.style.textAlign = 'center';
        readyText.style.marginTop = '1rem';

        countdownEl.appendChild(secondsEl);
        countdownEl.appendChild(readyText);
        document.body.appendChild(countdownEl);

        this.countdownElement = countdownEl;
        // Update countdown every second
        this.countdownInterval = setInterval(() => {
            this.countdownTimer--;
            secondsEl.textContent = this.countdownTimer;


            if (this.countdownTimer <= 0) {
                clearInterval(this.countdownInterval);
                this.countdownActive = false;
                countdownEl.remove();
                this.startWave(); // Start the game after countdown
            }
        }, 1000);
    }

    createFpsCounter() {
        // Create the FPS counter element
        const fpsElement = document.createElement('div');
        fpsElement.id = 'fps-counter';
        // Add class for CSS styling
        fpsElement.classList.add('fps-counter-element');
        // Keep visual styles inline, move positioning to CSS
        // fpsElement.style.position = 'fixed';
        // fpsElement.style.top = '10px';
        // fpsElement.style.right = '10px';
        fpsElement.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        fpsElement.style.color = '#00ff00';
        fpsElement.style.padding = '5px 10px';
        fpsElement.style.borderRadius = '3px';
        fpsElement.style.fontFamily = 'monospace';
        fpsElement.style.fontSize = '14px';
        // fpsElement.style.zIndex = '1000';
        fpsElement.textContent = 'FPS: 0';
        document.body.appendChild(fpsElement);

        this.fpsCounter.element = fpsElement;
    }

    updateFpsCounter(currentTime) {
        this.fpsCounter.frames++;

        // Update FPS display every 500ms
        if (currentTime - this.fpsCounter.lastUpdate >= 500) {
            // Calculate FPS: frames / seconds
            const fps = Math.round(this.fpsCounter.frames * 1000 / (currentTime - this.fpsCounter.lastUpdate));
            this.fpsCounter.value = fps;

            // Update display with color coding
            let color = '#00ff00'; // Green for good FPS
            if (fps < 30) color = '#ff0000'; // Red for bad FPS
            else if (fps < 50) color = '#ffff00'; // Yellow for mediocre FPS

            this.fpsCounter.element.textContent = `FPS: ${fps}`;
            this.fpsCounter.element.style.color = color;

            // Reset for next update
            this.fpsCounter.frames = 0;
            this.fpsCounter.lastUpdate = currentTime;
        }
    }

    update = (currentTime) => {
        if (!this.gameStarted || this.gameOver) {
            requestAnimationFrame(this.update);
            return;
        }

        // Update FPS counter
        this.updateFpsCounter(currentTime);

        // Calculate time delta
        this.deltaTime = (currentTime - this.lastFrameTime) / 1000; // convert to seconds
        this.lastFrameTime = currentTime;

        // Debug logging every 3 seconds to track entity counts
        if (Math.floor(currentTime / 3000) !== Math.floor((currentTime - this.deltaTime * 1000) / 3000)) {
            console.log(`Entity counts: Enemies=${this.enemies.length}, Towers=${this.towers.length}, Projectiles=${this.projectiles.length}`);

            // Check if entities are being properly created and rendered
            if ((this.enemies.length > 0 || this.towers.length > 0) &&
                this.renderer && this.renderer.scene) {
                let visibleEntities = 0;
                this.renderer.scene.traverse(obj => {
                    if (obj.isMesh && obj.visible &&
                        obj.position.x < 1000) { // Basic check to exclude off-screen objects
                        visibleEntities++;
                    }
                });
                console.log(`Visible meshes in scene: ${visibleEntities}`);
            }
        }

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

        // Process animations
        this.updateAnimations(currentTime);

        // Spawn enemies for active waves
        if (this.waveInProgress) {
            const now = currentTime;

            // Debug - detect missing spawns
            if (this.lastEnemySpawnTime + this.enemySpawnInterval*2 < currentTime &&
                this.enemiesSpawned < this.waveSettings[this.currentWave - 1].enemyCount &&
                this.enemies.length < 5) {
                console.warn("Enemy spawning seems delayed. Forcing spawn check.");
                this.lastEnemySpawnTime = currentTime - this.enemySpawnInterval;
            }

            // Process each active wave
            for (let i = 0; i < this.activeWaves.length; i++) {
                const waveInfo = this.activeWaves[i];

                // Skip waves that are already complete
                if (waveInfo.completed) continue;

                const waveIndex = waveInfo.waveNumber - 1;
                if (waveIndex < this.waveSettings.length) {
                    const waveSettings = this.waveSettings[waveIndex];
                    const enemyCount = waveSettings.enemyCount;

                    if (waveInfo.enemiesSpawned < enemyCount) {
                        // Determine if this is the final enemy in the wave and it should be a boss
                        const isBossSpawn = waveSettings.spawnBoss && waveInfo.enemiesSpawned === enemyCount - 1;

                        // Adjust spawn interval based on difficulty settings and batch logic
                        let adjustedInterval = this.enemySpawnInterval / this.difficultySettings.waveSpeedMultiplier;

                        // Apply spawn interval multiplier (additional control)
                        adjustedInterval = adjustedInterval / this.difficultySettings.spawnIntervalMultiplier;

                        // Apply batch spawning logic if enabled for this wave
                        if (waveSettings.batchSpawning) {
                            // For waves 4-6, use enhanced challenging batch spawning
                            if (waveInfo.waveNumber >= 3) {
                                // More intense spawning patterns for higher waves
                                const waveIntensity = waveInfo.waveNumber - 3; // 1 for wave 4, 2 for wave 5, 3 for wave 6

                                // Larger batch sizes for higher waves with random variation
                                const baseBatchSize = 5 + waveIntensity; // 6, 7, 8 for waves 4, 5, 6
                                const randomVariation = Math.floor(Math.random() * 3); // 0, 1, or 2
                                const batchSize = baseBatchSize + randomVariation;

                                const batchPosition = waveInfo.enemiesSpawned % (batchSize + Math.ceil(waveIntensity * 0.5));

                                if (batchPosition < batchSize) {
                                    // Near-simultaneous spawning - extremely fast within batch
                                    adjustedInterval = adjustedInterval * (0.15 - (waveIntensity * 0.03)); // 0.15, 0.12, 0.09
                                } else {
                                    // Longer delay between batches to create distinct waves of enemies
                                    adjustedInterval = adjustedInterval * (2.5 + (waveIntensity * 0.5)); // 3.0, 3.5, 4.0
                                }

                                // Every ~3 batches, add a surprise burst (1 in 3 chance when between batches)
                                if (batchPosition >= batchSize && Math.random() < 0.3) {
                                    // Surprise burst - no delay
                                    adjustedInterval = 0;
                                }
                            } else {
                                // Original logic for waves 1-3
                                const batchSize = 6;
                                const batchPosition = waveInfo.enemiesSpawned % (batchSize + 1);

                                if (batchPosition < batchSize) {
                                    // Within a batch - spawn quickly
                                    adjustedInterval = adjustedInterval * 0.25; // Even faster spawns within a batch
                                } else {
                                    // Between batches - longer delay
                                    adjustedInterval = adjustedInterval * 2.5; // Longer delay between batches
                                }
                            }
                        }

                        // Skip delay for boss spawn to make it more dramatic (regardless of batch settings)
                        if (isBossSpawn) {
                            adjustedInterval = adjustedInterval * 2.5; // Dramatic pause before boss
                        }

                        // For waves after the first active wave, add a small additional delay
                        if (i > 0) {
                            adjustedInterval *= 1.2;
                        }

                        if (now - waveInfo.lastSpawnTime > adjustedInterval) {
                            this.spawnEnemy(isBossSpawn, waveInfo);
                            waveInfo.lastSpawnTime = now;

                            // Also update the global last spawn time for backward compatibility
                            if (waveInfo.waveNumber === this.currentWave) {
                                this.lastEnemySpawnTime = now;
                            }
                        }
                    }
                }
            }
        }

        // Check completion of all active waves
        if (this.waveInProgress) {
            // The individual enemy updates will trigger checkWaveCompletion
            // We'll also check if all active waves are complete
            if (this.activeWaves.length > 0 &&
                this.activeWaves.every(w => w.completed ||
                    (w.enemiesSpawned >= this.waveSettings[w.waveNumber - 1]?.enemyCount && w.enemiesAlive === 0))) {

                // If all waves are done, update game state
                if (this.activeWaves.every(w => w.completed)) {
                    this.waveInProgress = false;

                    // If current wave is the max wave and all are complete, trigger victory
                    if (this.currentWave >= this.maxWaves) {
                        this.victory();
                    }
                }
            }
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

            // Return to normal quality when FPS recovers
            // Status log removed
            this.lowQualityMode = false;
            this.maxParticles = 200;
            this.enemyUpdateSkipRate = 3; // Reset to default (i % 3)


        // Render the game
        this.renderer.render(this);

        // Continue the game loop
        requestAnimationFrame(this.update);
    }

    startWave(forceSend = false) {
        // If forceSend is true, we'll start the next wave even if a wave is in progress
        // If a wave is already in progress and forceSend is false, we don't start another wave
        if (this.waveInProgress && !forceSend) return;

        // If we're already on the max wave and have sent all waves, don't allow more
        const nextWaveNumber = forceSend && this.waveInProgress ?
            this.currentWave + 1 : this.currentWave;

        if (nextWaveNumber > this.maxWaves) {
            // Status log removed
            return;
        }

        // Record wave start time for scoring
        const now = performance.now();
        this.waveStartTimes[nextWaveNumber] = now;

        // Set up wave tracking info
        const waveInfo = {
            waveNumber: nextWaveNumber,
            enemiesSpawned: 0,
            enemiesAlive: 0,
            enemiesDefeated: 0,
            startTime: now,
            lastSpawnTime: now,
            completed: false
        };

        // Add this wave to active waves
        this.activeWaves.push(waveInfo);

        // If we're force-sending and there's a wave in progress, increment the current wave
        if (forceSend && this.waveInProgress) {
            this.currentWave = nextWaveNumber;
            // Manually trigger TCG turn start when forcing next wave
            if (this.tcgIntegration) {
                this.tcgIntegration.startTurn();
            }
        }

        // Initialize tracking variables for the new wave
        this.waveInProgress = true;
        this.enemiesSpawned = 0;
        this.enemiesDefeated = 0;
        this.lastEnemySpawnTime = now;

        // Update UI with current wave/max waves format
        document.getElementById('wave-number').textContent = `${this.currentWave}/${this.maxWaves}`;

        // Status log removed
        // Status log removed
    }

    // Check if a specific wave is complete
    checkWaveCompletion(waveNumber) {
        const waveInfo = this.activeWaves.find(w => w.waveNumber === waveNumber);
        if (!waveInfo || waveInfo.completed) return;

        const waveIndex = waveInfo.waveNumber - 1;
        if (waveIndex >= this.waveSettings.length) return;

        const enemyCount = this.waveSettings[waveIndex].enemyCount;

        // Add extensive debug logging to track wave completion
        // console.log(`[WAVE DEBUG] Checking completion for wave ${waveNumber}:
        // - Enemies spawned: ${waveInfo.enemiesSpawned}/${enemyCount}
        // - Enemies still alive: ${waveInfo.enemiesAlive}
        // - Enemies defeated: ${waveInfo.enemiesDefeated}
        // - Enemies reached end: ${waveInfo.enemiesSpawned - waveInfo.enemiesAlive - waveInfo.enemiesDefeated}
        // - Wave already completed: ${waveInfo.completed}`);

        // Check if all enemies for this wave have been spawned and defeated/reached end
        if (waveInfo.enemiesSpawned >= enemyCount && waveInfo.enemiesAlive === 0) {
            // Status log removed

            // Record wave completion time for scoring
            const waveCompletionTime = performance.now();
            const waveStartTime = this.waveStartTimes[waveNumber] || this.gameStartTime;
            const waveDuration = waveCompletionTime - waveStartTime;
            // Status log removed

            // Mark wave as completed
            waveInfo.completed = true;
            waveInfo.completionTime = waveCompletionTime;
            waveInfo.duration = waveDuration;
            this.wavesCompleted++;

            // Call completeWave to give rewards
            this.completeWave(waveInfo.waveNumber);

            // If this completed wave is the current wave and not the last wave,
            // prepare to start the next wave if no waves were force-sent
            if (waveInfo.waveNumber === this.currentWave && waveInfo.waveNumber < this.maxWaves) {
                // Status log removed
                // Start next wave after delay, but only if no other uncompleted waves
                const nextWave = this.currentWave + 1;
                this.currentWave = nextWave;

                // Check if we should auto-start the next wave
                const shouldAutoStart = this.activeWaves.length <= 1 ||
                                       this.activeWaves.every(w => w.completed);

                if (shouldAutoStart) {
                    // Status log removed
                    setTimeout(() => {
                        // Double-check we're not already in progress when timeout fires
                        if (!this.waveInProgress) {
                            this.startWave();
                        } else {
                            // Status log removed
                        }
                    }, 5000);
                } else {
                    // Status log removed
                }
            }
        }
    }

    completeWave(waveNumber = this.currentWave) {
        // Find wave info object
        const waveInfo = this.activeWaves.find(w => w.waveNumber === waveNumber);
        if (!waveInfo) return;

        // If all active waves are completed, set waveInProgress to false
        if (this.activeWaves.every(w => w.completed)) {
            this.waveInProgress = false;
        }

        // Determine wave index
        const waveIndex = waveNumber - 1;
        if (waveIndex >= this.waveSettings.length) return;

        // Reward player for completing the wave
        // Scale rewards for later waves to provide better economy
        let baseWaveBonus;
        switch (waveNumber) {
            case 1:
                baseWaveBonus = 50;
                break;
            case 2:
                baseWaveBonus = 100;
                break;
            case 3:
                baseWaveBonus = 150;
                break;
            case 4:
                baseWaveBonus = 220;
                break;
            case 5:
                baseWaveBonus = 300;
                break;
            case 6:
                baseWaveBonus = 400;
                break;
            default:
                baseWaveBonus = waveNumber * 50;
        }

        // Calculate time-based speed bonus multiplier
        let timeMultiplier = 1.0;

        // Calculate wave duration in seconds
        const now = performance.now();
        const waveStartTime = this.waveStartTimes[waveNumber] || this.gameStartTime;
        const waveDuration = (now - waveStartTime) / 1000; // in seconds

        // Calculate expected time to complete wave based on enemy count and base stats
        // This is a rough estimation, adjust based on your game balance
        const enemyCount = this.waveSettings[waveIndex].enemyCount;
        const expectedSeconds = 45 + (enemyCount * 1.5); // Base time + time per enemy

        if (waveDuration < expectedSeconds * 0.7) {
            // Very fast completion (30% faster than expected) - 50% bonus
            timeMultiplier = 1.5;
            // Status log removed
        } else if (waveDuration < expectedSeconds * 0.85) {
            // Fast completion (15% faster than expected) - 25% bonus
            timeMultiplier = 1.25;
            // Status log removed
        } else if (waveDuration < expectedSeconds) {
            // Better than expected completion - 10% bonus
            timeMultiplier = 1.1;
            // Status log removed
        }

        // Apply gold multipliers
        let waveBonus = baseWaveBonus;

        // Apply per-wave gold multiplier if available
        if (this.waveSettings[waveIndex].goldMultiplier) {
            waveBonus = Math.round(waveBonus * this.waveSettings[waveIndex].goldMultiplier);
        }

        // Apply global gold multiplier
        waveBonus = Math.round(waveBonus * this.difficultySettings.goldMultiplier);

        // Apply time multiplier to score (not gold)
        const timeBonus = Math.round(waveBonus * timeMultiplier) - waveBonus;

        // Add rewards
        this.player.gold += waveBonus;
        this.player.score += waveBonus + timeBonus;

        // Store time data for final scoring
        waveInfo.timeBonus = timeBonus;
        waveInfo.timeMultiplier = timeMultiplier;

        // Show wave completion bonus message
        this.showWaveCompletionMessage(waveBonus, waveNumber);

        // Track consecutive waves without life loss and increase difficulty
        // Check if player lost lives during this wave
        if (this.player.lives === this.initialLives) {
            // No life lost this wave
            this.consecutiveWavesWithoutLosses++;
            // Status log removed

            // If player completed 2 consecutive waves without losing lives, increase difficulty
            if (this.consecutiveWavesWithoutLosses >= 2 && !this.difficultyIncreaseActive) {
                this.difficultyIncreaseActive = true;

                // Increase enemy health and speed for next wave only
                const originalHealthMultiplier = this.difficultySettings.enemyHealthMultiplier;
                const originalSpeedMultiplier = this.difficultySettings.enemySpeedMultiplier;

                // Apply stronger bonuses
                this.difficultySettings.enemyHealthMultiplier *= 1.5; // 50% more health
                this.difficultySettings.enemySpeedMultiplier *= 1.2; // 20% more speed

                // Status log removed

                // Show message about increasing difficulty
                this.showDifficultyIncreaseMessage();
            }
        } else {
            // Reset consecutive wave counter if lives were lost
            if (this.difficultyIncreaseActive) {
                // Reset difficulty if it was increased
                this.difficultySettings.enemyHealthMultiplier /= 1.5;
                this.difficultySettings.enemySpeedMultiplier /= 1.2;
                // Status log removed
                this.difficultyIncreaseActive = false;
            }
            this.consecutiveWavesWithoutLosses = 0;
            // Status log removed

            // Update initial lives count for next wave
            this.initialLives = this.player.lives;
        }

        // Update UI
        this.updateUI();

        // Give TCG rewards and start new turn if TCG system is active
        // Only do this for the current wave, not for force-sent waves that complete
        if (this.tcgIntegration && waveNumber === this.currentWave) {
            // Start a new TCG turn (refresh mana, draw a card)
            this.tcgIntegration.startTurn();
        }

        // Check if all waves completed
        if (waveNumber >= this.maxWaves && this.activeWaves.every(w => w.completed)) {
            this.victory();
        }
    }

    spawnEnemy(isBoss = false, waveInfo = null) {
        // Determine enemy type based on wave and add elemental enemies in later waves
        let enemyType;
        let elementType = ElementTypes.NEUTRAL;
        let isSpecialEnemy = false; // Track if this is a special enemy (boss or elemental)

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

        // If this is a boss, override the enemy type and make it special
        if (isBoss) {
            enemyType = 'golem'; // Use golem as base boss type
            isSpecialEnemy = true;

            // Always give boss an element
            if (elementType === ElementTypes.NEUTRAL) {
                elementType = this.getRandomElement();
            }
        }

        // Find valid entry points at the top of the map
        const validEntryPoints = [];
        for (let x = 0; x < this.map.gridWidth; x++) {
            if (this.map.grid[0][x] === 1) {
                validEntryPoints.push({ x, z: 0 });
            }
        }

        let startGridPoint;

        // Enhanced spawn patterns for waves 4-6
        if (waveInfo && waveInfo.waveNumber >= 4) {
            // Get the number of entry points available
            const numEntryPoints = validEntryPoints.length;

            // For later waves, we want to bias spawns toward the edges to make defense harder
            const waveIntensity = waveInfo.waveNumber - 3; // 1 for wave 4, 2 for wave 5, 3 for wave 6

            // Different spawn patterns for each late-game wave
            if (waveInfo.waveNumber === 4) {
                // Wave 4: Favor left/right sides and sometimes center
                const spawnPattern = waveInfo.enemiesSpawned % 5; // 0,1,2,3,4

                if (spawnPattern === 0) {
                    // Left side
                    const leftIndex = Math.floor(numEntryPoints * 0.25);
                    startGridPoint = validEntryPoints[leftIndex];
                } else if (spawnPattern === 1) {
                    // Right side
                    const rightIndex = Math.floor(numEntryPoints * 0.75);
                    startGridPoint = validEntryPoints[rightIndex];
                } else {
                    // Random but weighted toward edges
                    const useEdge = Math.random() < 0.6;
                    if (useEdge) {
                        // Choose left or right edge
                        const useLeft = Math.random() < 0.5;
                        const edgeIndex = useLeft ?
                            Math.floor(numEntryPoints * 0.1) :
                            Math.floor(numEntryPoints * 0.9);
                        startGridPoint = validEntryPoints[edgeIndex];
                    } else {
                        // Use center-ish
                        const centerIndex = Math.floor(numEntryPoints * 0.5) + Math.floor(Math.random() * 3) - 1;
                        startGridPoint = validEntryPoints[Math.min(Math.max(0, centerIndex), numEntryPoints - 1)];
                    }
                }
            } else if (waveInfo.waveNumber === 5) {
                // Wave 5: Create groups from multiple entry points simultaneously
                // Divide enemies into groups of 4
                const groupSize = 4;
                const groupNumber = Math.floor(waveInfo.enemiesSpawned / groupSize);
                const positionInGroup = waveInfo.enemiesSpawned % groupSize;

                // Each group gets its own spawn point
                if (positionInGroup === 0) {
                    // Start of a new group - select a spawn point based on sequence
                    const spawnSequence = groupNumber % 3; // 0,1,2

                    if (spawnSequence === 0) {
                        // Left side
                        const leftIndex = Math.floor(numEntryPoints * 0.2);
                        waveInfo.currentSpawnPoint = validEntryPoints[leftIndex];
                    } else if (spawnSequence === 1) {
                        // Right side
                        const rightIndex = Math.floor(numEntryPoints * 0.8);
                        waveInfo.currentSpawnPoint = validEntryPoints[rightIndex];
                    } else {
                        // Center
                        const centerIndex = Math.floor(numEntryPoints * 0.5);
                        waveInfo.currentSpawnPoint = validEntryPoints[centerIndex];
                    }
                }

                // Use the group's spawn point for all enemies in the group
                startGridPoint = waveInfo.currentSpawnPoint;
            } else { // Wave 6
                // Wave 6: Complete chaos - true multi-point spawning
                // Group size decreases as wave progresses to create more chaos
                const initialGroupSize = 3;
                const spawnedRatio = waveInfo.enemiesSpawned / this.waveSettings[5].enemyCount;
                const adaptiveGroupSize = Math.max(1, Math.floor(initialGroupSize * (1 - spawnedRatio)));

                const groupNumber = Math.floor(waveInfo.enemiesSpawned / adaptiveGroupSize);
                const positionInGroup = waveInfo.enemiesSpawned % adaptiveGroupSize;

                if (positionInGroup === 0) {
                    // Calculate a new spawn point for this group
                    // As wave progresses, make spawn points more random to overwhelm player
                    if (spawnedRatio < 0.3) {
                        // Early wave 6: Mainly from sides
                        const useLeft = Math.random() < 0.5;
                        const edgeIndex = useLeft ?
                            Math.floor(numEntryPoints * 0.15) :
                            Math.floor(numEntryPoints * 0.85);
                        waveInfo.currentSpawnPoint = validEntryPoints[edgeIndex];
                    } else if (spawnedRatio < 0.7) {
                        // Mid wave 6: From all areas, but more from unexpected places
                        const rand = Math.random();
                        let index;
                        if (rand < 0.3) {
                            // Left third
                            index = Math.floor(Math.random() * (numEntryPoints / 3));
                        } else if (rand < 0.6) {
                            // Right third
                            index = Math.floor((numEntryPoints * 2/3) + Math.random() * (numEntryPoints / 3));
                        } else {
                            // Center
                            index = Math.floor((numEntryPoints / 3) + Math.random() * (numEntryPoints / 3));
                        }
                        waveInfo.currentSpawnPoint = validEntryPoints[Math.min(index, numEntryPoints - 1)];
                    } else {
                        // Late wave 6: Complete chaos - totally random
                        const index = Math.floor(Math.random() * numEntryPoints);
                        waveInfo.currentSpawnPoint = validEntryPoints[index];
                    }
                }

                // Use the group's spawn point
                startGridPoint = waveInfo.currentSpawnPoint;
            }
        } else {
            // For waves 1-3, use simple random entry point
            const randomEntryIndex = Math.floor(Math.random() * validEntryPoints.length);
            startGridPoint = validEntryPoints[randomEntryIndex];
        }

        // Convert grid position to world position
        const startWorldPoint = this.map.gridToWorld(startGridPoint.x, startGridPoint.z);

        // Determine which wave this enemy belongs to
        const waveNumber = waveInfo ? waveInfo.waveNumber : this.currentWave;
        const waveIndex = waveNumber - 1;

        // Create and add enemy - with destination set to the bottom of the map
        const enemy = new Enemy(this, enemyType, startWorldPoint, elementType);

        // Associate enemy with its wave
        enemy.waveNumber = waveNumber;

        // Apply boss stats if this is a boss
        if (isBoss) {
            // Apply boss stat multipliers
            let healthMultiplier = this.difficultySettings.bossHealthMultiplier;
            let rewardMultiplier = 3; // Base reward multiplier for bosses

            // Apply additional late stage boss bonus for waves 4-6
            if (waveNumber >= 4) {
                healthMultiplier *= this.difficultySettings.lateStageBossBonus;

                // Each wave gets progressively harder
                const extraWaveScaling = (waveNumber - 3) * 0.5; // 0.5 for wave 4, 1.0 for wave 5, 1.5 for wave 6
                healthMultiplier *= (1.0 + extraWaveScaling);

                // More gold for late game bosses
                rewardMultiplier = 3 + (waveNumber - 3); // 4x for wave 4, 5x for wave 5, 6x for wave 6

                // Bigger visual size for late-game bosses
                if (enemy.enemyInstance) {
                    // Scale increases with wave number: 1.8x for wave 4, 2.1x for wave 5, 2.4x for wave 6
                    const lateGameBossScale = 1.5 + ((waveNumber - 3) * 0.3);
                    // Update scale via instance manager
                    if (this.renderer.enemyInstanceManager &&
                        enemy.enemyInstance.baseType &&
                        enemy.enemyInstance.elementType &&
                        enemy.enemyInstance.instanceIndex !== undefined) {
                        // Track scaling in enemy instance
                        enemy.enemyInstance.scale = lateGameBossScale;
                    }
                }
            } else {
                // Normal boss size for early waves
                if (enemy.enemyInstance) {
                    // Track scaling in enemy instance
                    enemy.enemyInstance.scale = 1.5;
                }
            }

            // Apply final multipliers
            enemy.maxHealth *= healthMultiplier;
            enemy.health = enemy.maxHealth;
            enemy.baseSpeed *= this.difficultySettings.bossSpeedMultiplier;
            enemy.reward *= rewardMultiplier;
        }

        // Apply randomness to enemy stats if enabled
        if (this.difficultySettings.randomFactorMultiplier > 0 && !isBoss) {
            const randomRange = this.difficultySettings.randomFactorMultiplier;

            // Generate random variation within the range [-randomRange/2, +randomRange]
            // This creates more positive than negative variation for a slight challenge increase
            const healthVariation = 1.0 + (Math.random() * randomRange - randomRange/3);
            const speedVariation = 1.0 + (Math.random() * randomRange - randomRange/3);

            // Apply random variations
            enemy.maxHealth *= healthVariation;
            enemy.health = enemy.maxHealth;
            enemy.baseSpeed *= speedVariation;
        }

        // Apply per-wave gold multiplier based on the enemy's wave number
        const enemyWaveIndex = waveNumber - 1;
        if (enemyWaveIndex < this.waveSettings.length) {
            const waveGoldMultiplier = this.waveSettings[enemyWaveIndex].goldMultiplier;
            enemy.reward = Math.ceil(enemy.reward * waveGoldMultiplier * this.difficultySettings.goldMultiplier);
        }

        this.enemies.push(enemy);

        // Update wave info
        if (waveInfo) {
            waveInfo.enemiesSpawned++;
            waveInfo.enemiesAlive++;
        } else {
            this.enemiesSpawned++;
        }

        // Debug step - verify the enemy has a valid visual representation
        if (enemy && !enemy.enemyInstance) {
            console.warn("Enemy created but missing visual instance! Attempting to recreate.");
            // Attempt to create visual representation
            enemy.enemyInstance = this.renderer.createEnemy(enemy);
            if (!enemy.enemyInstance) {
                console.error("Failed to create enemy visual representation on second attempt!");
            } else {
                console.log("Successfully recreated enemy visual representation.");
            }
        }

        return enemy;
    }

    updateEnemies() {
        // Performance optimization based on FPS and enemy count
        const enemyCount = this.enemies.length;

        // Use adaptive update frequency based on current FPS
        const fpsValue = this.fpsCounter.value || 60;
        const shouldOptimize = (fpsValue < 40 && enemyCount > 20);

        // Collect position updates for batch processing
        const positionUpdates = [];

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];

            // Store previous position for checking movement
            const prevPosition = { x: enemy.position.x, y: enemy.position.y, z: enemy.position.z };

            // Normal update
            enemy.update(this.deltaTime);

            // Add to batch position updates if position changed
            if (prevPosition.x !== enemy.position.x ||
                prevPosition.y !== enemy.position.y ||
                prevPosition.z !== enemy.position.z) {
                positionUpdates.push({ enemy, position: enemy.position });
            }

            // Check if enemy reached the end
            if (enemy.reachedEnd) {
                // Check for infinite lives in debug mode
                const hasInfiniteLives = this.cardDebugMode &&
                    document.getElementById('debug-infinite-lives')?.checked;

                if (!hasInfiniteLives) {
                    this.player.lives -= 1;

                    // Create life flash effect
                    this.createLifeFlashEffect();

                    // Play lose life sound effect
                    if (window.playSound) {
                        window.playSound('loseLife');
                    }
                }

                // Update wave info
                const waveNumber = enemy.waveNumber || this.currentWave;
                const waveInfo = this.activeWaves.find(w => w.waveNumber === waveNumber);

                if (waveInfo) {
                    waveInfo.enemiesAlive--;
                }

                // Remove enemy from scene
                this.removeEnemyVisuals(enemy);

                // Remove from array
                this.enemies.splice(i, 1);
                this.updateUI();

                // Check wave completion
                this.checkWaveCompletion(waveNumber);

                // Check if game over (skip if infinite lives enabled)
                if (this.player.lives <= 0 && !hasInfiniteLives) {
                    this.gameOver = true;
                    this.createGameOverEffect();
                    this.endGame(false);
                }
            }
        }

        // Update enemy visuals in batch for better performance
        if (positionUpdates.length > 0 && this.renderer.enemyInstanceManager) {
            this.renderer.enemyInstanceManager.batchUpdatePositions(positionUpdates);
        }
    }

    // Handle enemy defeat (called from enemy.takeDamage)
    defeatEnemy(enemy) {
        // Ensure the enemy exists and isn't already processed
        if (!enemy || enemy.isDefeated) return;
        enemy.isDefeated = true;

        // Calculate reward (with all multipliers)
        let baseReward = Math.round(enemy.reward || 10);

        // Apply wave gold multiplier
        const waveIndex = this.currentWave - 1;
        let finalReward = baseReward;
        if (waveIndex < this.waveSettings.length && this.waveSettings[waveIndex].goldMultiplier) {
            finalReward = Math.round(finalReward * this.waveSettings[waveIndex].goldMultiplier);
        }

        // Apply global gold multiplier
        if (this.difficultySettings && this.difficultySettings.goldMultiplier) {
            finalReward = Math.round(finalReward * this.difficultySettings.goldMultiplier);
        }

        // Add the gold reward
        const oldGold = this.player.gold;
        this.player.gold += finalReward;
        this.player.score += finalReward;

        // Ensure the gold is a valid number
        if (isNaN(this.player.gold)) {
            console.error("[GOLD DEBUG] Gold became NaN! Resetting to previous value");
            this.player.gold = oldGold;
        }

        // Track enemy defeat
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
            setTimeout(() => {
                this.createManaBonusEffect(enemy.position);
            }, 1000);
        }

        // Update wave info
        const waveNumber = enemy.waveNumber || this.currentWave;
        const waveInfo = this.activeWaves.find(w => w.waveNumber === waveNumber);

        if (waveInfo) {
            waveInfo.enemiesAlive--;
            waveInfo.enemiesDefeated++;
        }

        // Create money effect when enemy dies
        this.createMoneyWinEffect(enemy);

        // Remove enemy visuals
        this.removeEnemyVisuals(enemy);

        // Remove from enemies array
        const index = this.enemies.indexOf(enemy);
        if (index !== -1) {
            this.enemies.splice(index, 1);
        }

        // Update UI
        this.updateUI();

        // Check wave completion
        this.checkWaveCompletion(waveNumber);
    }

    // Helper method to remove enemy visual elements
    removeEnemyVisuals(enemy) {
        // Clean up instance-based enemy
        if (enemy.enemyInstance) {
            this.renderer.removeEnemy(enemy);
        }
        // Legacy cleanup for mesh-based enemies
        else if (enemy.mesh) {
            this.renderer.scene.remove(enemy.mesh);

            // Clean up geometries and materials
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

            enemy.mesh = null;
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
        // Simple projectile management without complex pooling
        // This is a more reliable approach when debugging projectile issues

        // Log for debugging - once per second to avoid console spam
        if (!this._lastProjectileDebugTime || performance.now() - this._lastProjectileDebugTime > 1000) {
            // console.log(`Active projectiles: ${this.projectiles.length}`);
            this._lastProjectileDebugTime = performance.now();
        }

        // Enforce maximum projectiles limit for performance
        if (this.projectiles.length > this.maxActiveProjectiles) {
            // Remove oldest projectiles when there are too many
            const excessCount = this.projectiles.length - this.maxActiveProjectiles;
            for (let i = 0; i < excessCount; i++) {
                // Mark oldest projectiles as hit to be removed
                if (i < this.projectiles.length) {
                    this.projectiles[i].hit = true;
                }
            }
        }

        // Count active and removed projectiles for debugging
        let activeCount = 0;
        let removedCount = 0;

        // Update all projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];

            // Skip updates for invalid projectiles
            if (!projectile) {
                this.projectiles.splice(i, 1);
                continue;
            }

            // Ensure projectile mesh is in scene
            if (projectile.mesh && !this.renderer.scene.children.includes(projectile.mesh)) {
                // console.log(`Adding missing projectile mesh back to scene`);
                this.renderer.scene.add(projectile.mesh);
            }

            // Update projectile position and state
            projectile.update(this.deltaTime);
            activeCount++;

            // Check if projectile hit a target or is out of bounds
            if (projectile.hit || projectile.isOutOfBounds()) {
                // Log hit status for debugging
                if (projectile.hit) {
                    // console.log(`Projectile hit target or was manually marked as hit`);
                } else {
                    // console.log(`Projectile out of bounds and being removed`);
                }

                // Remove mesh from scene
                if (projectile.mesh) {
                    this.renderer.scene.remove(projectile.mesh);

                    // Immediately dispose resources
                    if (projectile.mesh.geometry) {
                        projectile.mesh.geometry.dispose();
                    }

                    if (projectile.mesh.material) {
                        if (Array.isArray(projectile.mesh.material)) {
                            projectile.mesh.material.forEach(m => m.dispose());
                        } else {
                            projectile.mesh.material.dispose();
                        }
                    }
                }

                // Remove from array - no object pooling for now
                this.projectiles.splice(i, 1);
                removedCount++;
            }
        }

        // Add debug info to FPS counter
        if (this.fpsCounter && this.fpsCounter.element) {
            this.fpsCounter.element.textContent = `FPS: ${this.fpsCounter.value}`; // Simplified display
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

    async placeTower(towerType, gridX, gridY, skipGoldCost = false) {
        // Status log removed

        // Check if cell is empty and tower can be placed
        if (!await this.map.canPlaceTower(gridX, gridY)) {
            // Status log removed
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

        // Check if player has enough gold (when not skipping cost check)
        if (!skipGoldCost && this.player.gold < cost) {
            // Status log removed
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

        // Deduct gold (when not skipping cost) with debug logging
        if (!skipGoldCost) {
            const oldGold = this.player.gold;
            this.player.gold -= cost;

            // Status log removed
            // Status log removed

            // Ensure gold is a valid number
            if (isNaN(this.player.gold)) {
                console.error("[GOLD DEBUG] Gold became NaN during tower placement! Resetting to previous value");
                this.player.gold = oldGold;
            }

            this.updateUI();
        } else {
            // Status log removed
        }

        // Status log removed
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
        // Update UI with current values
        document.getElementById('gold-amount').textContent = this.player.gold;
        document.getElementById('lives-amount').textContent = this.player.lives;
        document.getElementById('wave-number').textContent = `${this.currentWave}/${this.maxWaves}`;

        // Debug log to track gold updates
        // Status log removed
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

            // Explicitly reinitialize instance managers
            this.renderer.initializeInstanceManagers();
        }

        // Clear all game entities
        this.clearAllEntities();

        // Reset player stats
        this.player.gold = 100;
        this.player.lives = this.initialLives || 10; // Use initialLives if set, fallback to 5
        this.player.score = 0;

        // Reset wave counters
        this.currentWave = 1;
        this.waveInProgress = false;
        this.enemiesSpawned = 0;
        this.enemiesDefeated = 0;
        this.activeWaves = [];
        this.wavesCompleted = 0;

        // Reset game flags
        this.gameOver = false;
        this.gameStarted = false;

        // Reset the UI
        this.updateUI();

        // Reset the map
        if (this.map) {
            // Status log removed
            this.map.reset();
            // Status log removed
        }

        // Reset TCG if active
        if (this.tcgIntegration) {
            this.tcgIntegration.reset();
        }

        console.log("Game state reset complete. Lives:", this.player.lives);
    }

    clearAllEntities() {
        // Clean up all entities properly

        // Clean up enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            if (this.enemies[i].mesh) {
                this.renderer.scene.remove(this.enemies[i].mesh);

                // Dispose geometries and materials to free memory
                if (this.enemies[i].mesh.geometry) {
                    this.enemies[i].mesh.geometry.dispose();
                }

                if (this.enemies[i].mesh.material) {
                    if (Array.isArray(this.enemies[i].mesh.material)) {
                        this.enemies[i].mesh.material.forEach(m => m.dispose());
                    } else {
                        this.enemies[i].mesh.material.dispose();
                    }
                }
            }
        }
        this.enemies = [];

        // Clean up towers using the new tower cleanup method
        for (let i = this.towers.length - 1; i >= 0; i--) {
            if (this.towers[i].cleanup) {
                this.towers[i].cleanup();
            } else if (this.towers[i].towerInstance) {
                this.renderer.removeTower(this.towers[i].towerInstance);
            } else if (this.towers[i].mesh) {
                // Fallback for compatibility with old tower system
                this.renderer.scene.remove(this.towers[i].mesh);
            }
        }
        this.towers = [];

        // Clean up projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            if (this.projectiles[i].mesh) {
                this.renderer.scene.remove(this.projectiles[i].mesh);

                // Dispose geometries and materials to free memory
                if (this.projectiles[i].mesh.geometry) {
                    this.projectiles[i].mesh.geometry.dispose();
                }

                if (this.projectiles[i].mesh.material) {
                    if (Array.isArray(this.projectiles[i].mesh.material)) {
                        this.projectiles[i].mesh.material.forEach(m => m.dispose());
                    } else {
                        this.projectiles[i].mesh.material.dispose();
                    }
                }
            }
        }
        this.projectiles = [];

        // Force garbage collection
        if (window.gc) {
            window.gc();
        }
    }

    endGame(isVictory) {
        const overlay = document.getElementById('game-overlay');
        const startScreen = document.getElementById('start-screen');
        const endScreen = document.getElementById('end-screen');
        const resultMessage = document.getElementById('result-message');
        const scoreDisplay = document.getElementById('score-display');

        // Status log removed

        // Show end screen after a short delay
        setTimeout(() => {
            // Status log removed

            // Save score to ranking system
            this.savePlayerScore(isVictory);

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

            // Display player ranking
            this.displayPlayerRanking(scoreDisplay);

            // Setup restart button to restart the game
            const restartButton = document.getElementById('restart-button');
            restartButton.onclick = null; // Clear any previous handlers

            restartButton.addEventListener('click', () => {
                // Status log removed

                // Hide the end screen
                endScreen.classList.add('hidden');

                // Show the start screen
                startScreen.classList.remove('hidden');

                // Make sure elements are visible
                overlay.style.display = '';
                overlay.classList.remove('hidden');

                // Reset game state for a fresh start
                this.resetGameState();

                // Status log removed
            });
        }, isVictory ? 3000 : 2500); // Longer delay for animations to complete
    }

    toggleDebugMode() {
        this.debugMode = !this.debugMode;

        // Toggle debug panel visibility
        const debugPanel = document.getElementById('debug-panel');
        const debugPanelButton = document.getElementById('toggle-debug-panel');

        if (debugPanel) {
            debugPanel.classList.toggle('hidden', !this.debugMode);
        }

        if (debugPanelButton) {
            debugPanelButton.classList.toggle('hidden', !this.debugMode);
        }

        // Update path visualization visibility only in debug mode
        if (this.map && this.map.pathVisualization) {
            this.map.pathVisualization.visible = this.debugMode;

            // Update raycasting on path visualization
            if (this.map.pathVisualization.raycast) {
                if (this.debugMode) {
                    // Store original raycaster and disable it
                    this.map.pathVisualization.userData.originalRaycast = this.map.pathVisualization.raycast;
                    this.map.pathVisualization.raycast = function() {};
                } else if (this.map.pathVisualization.userData.originalRaycast) {
                    // Restore original raycaster
                    this.map.pathVisualization.raycast = this.map.pathVisualization.userData.originalRaycast;
                }
            }
        }

        // Create difficulty sliders when debug mode is enabled
        if (this.debugMode) {
            this.createDifficultyControls();
        }

        // Log debug mode state
        // Status log removed
    }

    // Create difficulty control panel
    createDifficultyControls() {
        // Target existing containers
        const difficultyControls = document.getElementById('difficulty-controls');
        const waveControls = document.getElementById('wave-controls');

        // If there are no containers, something is wrong with the HTML structure
        if (!difficultyControls || !waveControls) {
            console.error("Difficulty control containers not found in the DOM");
            return;
        }

        // Clear existing controls
        difficultyControls.innerHTML = '<h3>Global Difficulty Settings</h3>';
        waveControls.innerHTML = '<h3>Per-Wave Settings</h3>';

        // Create sliders for each difficulty setting
        for (const key in this.difficultySettings) {
            const label = key.replace(/([A-Z])/g, ' $1')
                          .replace(/^./, str => str.toUpperCase());

            const controlGroup = document.createElement('div');
            controlGroup.className = 'control-group';

            const sliderLabel = document.createElement('label');
            sliderLabel.textContent = label + ': ';

            const valueDisplay = document.createElement('span');
            valueDisplay.id = `difficulty-${key}-value`;
            valueDisplay.textContent = this.difficultySettings[key].toFixed(2);
            sliderLabel.appendChild(valueDisplay);

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.id = `difficulty-${key}`;
            slider.min = key.includes('enemy') ? '0.5' : '0.2';
            slider.max = key.includes('enemy') ? '3.0' : '5.0';
            slider.step = '0.1';
            slider.value = this.difficultySettings[key];

            // Add event listener to update difficulty when slider changes
            slider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                valueDisplay.textContent = value.toFixed(2);

                // Update the setting in real-time
                const settings = {};
                settings[key] = value;
                this.updateDifficultySettings(settings);
            });

            controlGroup.appendChild(sliderLabel);
            controlGroup.appendChild(slider);
            difficultyControls.appendChild(controlGroup);
        }

        // Add reset button
        const resetButton = document.createElement('button');
        resetButton.textContent = 'Reset Global Settings';
        resetButton.className = 'debug-button';
        resetButton.addEventListener('click', () => {
            this.updateDifficultySettings({
                enemyHealthMultiplier: 1.0,
                enemySpeedMultiplier: 1.0,
                goldMultiplier: 1.0,
                towerDamageMultiplier: 1.0,
                waveSpeedMultiplier: 1.0,
                spawnIntervalMultiplier: 1.0,
                randomFactorMultiplier: 0.2,
                bossHealthMultiplier: 3.0,
                bossSpeedMultiplier: 0.7
            });
        });

        difficultyControls.appendChild(resetButton);

        // Create a table for per-wave settings
        const table = document.createElement('table');
        table.className = 'wave-settings-table';

        // Create header row
        const headerRow = document.createElement('tr');
        ['Wave', 'Enemy Health', 'Enemy Speed', 'Enemy Count', 'Gold Mult', 'Boss', 'Batch', 'Actions'].forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            headerRow.appendChild(th);
        });
        table.appendChild(headerRow);

        // Create a row for each wave
        this.waveSettings.forEach((wave, index) => {
            const row = document.createElement('tr');

            // Wave number
            const waveCell = document.createElement('td');
            waveCell.textContent = `Wave ${index + 1}`;
            row.appendChild(waveCell);

            // Health multiplier
            const healthCell = document.createElement('td');
            const healthInput = document.createElement('input');
            healthInput.type = 'number';
            healthInput.min = '0.5';
            healthInput.max = '5';
            healthInput.step = '0.1';
            healthInput.value = wave.enemyHealth.toFixed(1);
            healthInput.style.width = '4em';
            healthInput.addEventListener('change', () => {
                this.waveSettings[index].enemyHealth = parseFloat(healthInput.value);
                // Save to local storage
                this.saveWaveSettings();
            });
            healthCell.appendChild(healthInput);
            row.appendChild(healthCell);

            // Speed multiplier
            const speedCell = document.createElement('td');
            const speedInput = document.createElement('input');
            speedInput.type = 'number';
            speedInput.min = '0.5';
            speedInput.max = '3';
            speedInput.step = '0.1';
            speedInput.value = wave.enemySpeed.toFixed(1);
            speedInput.style.width = '4em';
            speedInput.addEventListener('change', () => {
                this.waveSettings[index].enemySpeed = parseFloat(speedInput.value);
                // Save to local storage
                this.saveWaveSettings();
            });
            speedCell.appendChild(speedInput);
            row.appendChild(speedCell);

            // Enemy count
            const countCell = document.createElement('td');
            const countInput = document.createElement('input');
            countInput.type = 'number';
            countInput.min = '5';
            countInput.max = '100';
            countInput.step = '1';
            countInput.value = wave.enemyCount.toString();
            countInput.style.width = '4em';
            countInput.addEventListener('change', () => {
                this.waveSettings[index].enemyCount = parseInt(countInput.value);
                // Save to local storage
                this.saveWaveSettings();
            });
            countCell.appendChild(countInput);
            row.appendChild(countCell);

            // Gold multiplier
            const goldMultCell = document.createElement('td');
            const goldMultInput = document.createElement('input');
            goldMultInput.type = 'number';
            goldMultInput.min = '0.5';
            goldMultInput.max = '5.0';
            goldMultInput.step = '0.1';
            goldMultInput.value = wave.goldMultiplier ? wave.goldMultiplier.toFixed(1) : '1.0';
            goldMultInput.style.width = '4em';
            goldMultInput.addEventListener('change', () => {
                this.waveSettings[index].goldMultiplier = parseFloat(goldMultInput.value);
                // Save to local storage
                this.saveWaveSettings();
            });
            goldMultCell.appendChild(goldMultInput);
            row.appendChild(goldMultCell);

            // Boss spawn checkbox
            const bossCell = document.createElement('td');
            const bossCheckbox = document.createElement('input');
            bossCheckbox.type = 'checkbox';
            bossCheckbox.checked = wave.spawnBoss || false;
            bossCheckbox.addEventListener('change', () => {
                this.waveSettings[index].spawnBoss = bossCheckbox.checked;
                // Save to local storage
                this.saveWaveSettings();
            });
            bossCell.appendChild(bossCheckbox);
            row.appendChild(bossCell);

            // Batch spawning checkbox
            const batchCell = document.createElement('td');
            const batchCheckbox = document.createElement('input');
            batchCheckbox.type = 'checkbox';
            batchCheckbox.checked = wave.batchSpawning || false;
            batchCheckbox.addEventListener('change', () => {
                this.waveSettings[index].batchSpawning = batchCheckbox.checked;
                // Save to local storage
                this.saveWaveSettings();
            });
            batchCell.appendChild(batchCheckbox);
            row.appendChild(batchCell);

            // Actions
            const actionsCell = document.createElement('td');
            // Delete wave button
            if (this.waveSettings.length > 1) {
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '❌';
                deleteBtn.title = 'Delete Wave';
                deleteBtn.className = 'wave-action-btn';
                deleteBtn.addEventListener('click', () => {
                    this.waveSettings.splice(index, 1);
                    this.createDifficultyControls(); // Refresh the control panel
                    this.saveWaveSettings();
                });
                actionsCell.appendChild(deleteBtn);
            }
            row.appendChild(actionsCell);

            table.appendChild(row);
        });

        waveControls.appendChild(table);

        // Add new wave button
        const addWaveBtn = document.createElement('button');
        addWaveBtn.textContent = 'Add Wave';
        addWaveBtn.className = 'debug-button';
        addWaveBtn.addEventListener('click', () => {
            // Copy settings from the last wave and increase difficulty slightly
            const lastWave = this.waveSettings[this.waveSettings.length - 1];
            this.waveSettings.push({
                enemyHealth: lastWave.enemyHealth * 1.2,
                enemySpeed: lastWave.enemySpeed * 1.1,
                enemyCount: Math.floor(lastWave.enemyCount * 1.2),
                goldMultiplier: lastWave.goldMultiplier * 1.1, // Slightly increase gold rewards
                spawnBoss: lastWave.spawnBoss || this.waveSettings.length > 3, // Add boss for later waves
                batchSpawning: lastWave.batchSpawning || this.waveSettings.length > 2 // Add batch spawning for later waves
            });
            this.createDifficultyControls(); // Refresh the control panel
            this.saveWaveSettings();
        });
        waveControls.appendChild(addWaveBtn);

        // Add export/import buttons
        const exportImportDiv = document.createElement('div');
        exportImportDiv.className = 'export-import-buttons';

        const exportBtn = document.createElement('button');
        exportBtn.textContent = 'Export Settings';
        exportBtn.className = 'debug-button';
        exportBtn.addEventListener('click', () => {
            this.exportSettings();
        });
        exportImportDiv.appendChild(exportBtn);

        const importBtn = document.createElement('button');
        importBtn.textContent = 'Import Settings';
        importBtn.className = 'debug-button';
        importBtn.addEventListener('click', () => {
            this.importSettings();
        });
        exportImportDiv.appendChild(importBtn);

        waveControls.appendChild(exportImportDiv);

        // Status log removed
    }

    saveWaveSettings() {
        try {
            localStorage.setItem('waveSettings', JSON.stringify(this.waveSettings));
            console.log('Wave settings saved to local storage');
        } catch (e) {
            console.error('Failed to save wave settings:', e);
        }
    }

    loadWaveSettings() {
        try {
            const savedSettings = localStorage.getItem('waveSettings');
            if (savedSettings) {
                this.waveSettings = JSON.parse(savedSettings);
                console.log('Wave settings loaded from local storage');
            }
        } catch (e) {
            console.error('Failed to load wave settings:', e);
        }
    }

    exportSettings() {
        const settings = {
            globalSettings: this.difficultySettings,
            waveSettings: this.waveSettings
        };

        // Create a data URL for the settings
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings, null, 2));

        // Create download link
        const downloadLink = document.createElement('a');
        downloadLink.setAttribute("href", dataStr);
        downloadLink.setAttribute("download", "tower_defense_settings.json");
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    }

    importSettings() {
        // Create a file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';

        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const settings = JSON.parse(e.target.result);

                    // Update settings
                    if (settings.globalSettings) {
                        this.updateDifficultySettings(settings.globalSettings);
                    }

                    if (settings.waveSettings) {
                        this.waveSettings = settings.waveSettings;
                        this.saveWaveSettings();
                    }

                    // Refresh the control panel
                    this.createDifficultyControls();

                    alert('Settings imported successfully!');
                } catch (error) {
                    console.error('Error importing settings:', error);
                    alert('Error importing settings. Please check the file format.');
                }
            };

            reader.readAsText(file);
            document.body.removeChild(fileInput);
        });

        document.body.appendChild(fileInput);
        fileInput.click();
    }

    // Update difficulty settings
    updateDifficultySettings(settings) {
        // Update difficulty settings
        for (const key in settings) {
            if (this.difficultySettings.hasOwnProperty(key)) {
                this.difficultySettings[key] = settings[key];
            }
        }

        // Apply to existing enemies by rebuilding their stats
        this.enemies.forEach(enemy => {
            const oldHealth = enemy.health;
            const oldMaxHealth = enemy.maxHealth;
            const healthPercent = oldHealth / oldMaxHealth;

            // Reset and reapply stats with new multipliers
            enemy.setStats();

            // Keep same health percentage
            enemy.health = enemy.maxHealth * healthPercent;
        });

        // Update UI if there's a difficulty UI display
        this.updateDifficultyUI();
    }

    // Update difficulty UI elements
    updateDifficultyUI() {
        // Update each slider if it exists
        for (const key in this.difficultySettings) {
            const slider = document.getElementById(`difficulty-${key}`);
            if (slider) {
                slider.value = this.difficultySettings[key];
            }

            const label = document.getElementById(`difficulty-${key}-value`);
            if (label) {
                label.textContent = this.difficultySettings[key].toFixed(2);
            }
        }
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

            // Show and update the debug panel
            const debugPanel = document.getElementById('debug-panel');
            debugPanel.classList.remove('hidden');

            // Create difficulty controls
            this.createDifficultyControls();

            // Setup debug enemy showcase if not already done
            this.setupEnemyShowcase();

            // Status log removed
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

                // Status log removed
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

        // Status log removed
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

        // Status log removed
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
            // Status log removed
        }, 300);
    }

    debugJumpToWave5() {
        if (!this.cardDebugMode) return;

        // Reset game state to prepare for wave 5
        this.clearAllEntities();

        // Skip to wave 5
        this.currentWave = 5;

        // Update UI with current wave
        document.getElementById('wave-number').textContent = `${this.currentWave}/${this.maxWaves}`;

        // Give extra resources for testing
        this.player.gold = 500;
        this.updateUI();

        // Start the wave
        setTimeout(() => {
            this.startWave();
            // Status log removed
        }, 300);
    }

    calculateDistance(pos1, pos2) {
        const dx = pos2.x - pos1.x;
        const dz = pos2.z - pos1.z;
        return Math.sqrt(dx * dx + dz * dz);
    }

    findClosestEnemyInRange(position, range) {
        // Similar to findTarget but with explicitly passed position and range
        let closestEnemy = null;
        let closestDistance = Infinity;

        for (const enemy of this.enemies) {
            // Skip enemies that have reached the end or are dead
            if (enemy.reachedEnd || enemy.health <= 0) continue;

            const distance = this.calculateDistance(position, enemy.position);
            if (distance <= range && distance < closestDistance) {
                closestEnemy = enemy;
                closestDistance = distance;
            }
        }

        return closestEnemy;
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

    showDifficultyIncreaseMessage() {
        // Create a visual message for difficulty increase
        if (!this.renderer) return;

        const text = "Difficulty Increased!";

        // Create texture for sprite
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const context = canvas.getContext('2d');

        // Fill background
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.strokeStyle = '#FF3333';
        context.lineWidth = 4;
        context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

        // Add text
        context.font = 'bold 28px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        // Add a red glow by drawing text multiple times
        context.fillStyle = 'rgba(255, 0, 0, 0.3)';
        context.fillText(text, canvas.width / 2 + 3, canvas.height / 2 + 3);
        context.fillText(text, canvas.width / 2 - 3, canvas.height / 2 - 3);

        // Draw the main text
        context.fillStyle = '#FFFFFF';
        context.fillText(text, canvas.width / 2, canvas.height / 2);

        // Create sprite
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 1.0
        });

        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(20, 5, 1);
        sprite.position.set(0, 8, 0); // Position above the map

        this.renderer.scene.add(sprite);

        // Animation data
        const startTime = performance.now();
        const duration = 4000; // 4 seconds

        // Add to the centralized animation system
        this.addAnimationEffect({
            startTime,
            duration,
            update: (progress) => {
                // Add shaking effect for warning
                if (progress < 0.7) {
                    const elapsed = performance.now() - startTime;
                    sprite.position.x = Math.sin(elapsed * 0.02) * 0.3;

                    // Pulse size
                    const scale = 1 + 0.05 * Math.sin(elapsed * 0.01);
                    sprite.scale.set(20 * scale, 5 * scale, 1);
                }

                // Fade out at the end
                if (progress > 0.7) {
                    const fadeOutProgress = (progress - 0.7) / 0.3;
                    spriteMaterial.opacity = 1 - fadeOutProgress;
                }

                if (progress >= 1) {
                    // Remove sprite
                    this.renderer.scene.remove(sprite);
                    texture.dispose();
                    spriteMaterial.dispose();
                    return true; // Animation complete
                }

                return false; // Animation still running
            }
        });
    }

    showWaveCompletionMessage(amount, waveNumber = this.currentWave) {
        // Create a visual message for wave completion bonus
        if (!this.renderer) return;

        // Get time bonus information if available
        const waveInfo = this.activeWaves.find(w => w.waveNumber === waveNumber);
        const timeBonus = waveInfo?.timeBonus || 0;

        // Create message with time bonus if applicable
        let message;
        if (timeBonus > 0) {
            const timeBonusPercent = Math.round((waveInfo.timeMultiplier - 1) * 100);
            message = `Wave ${waveNumber} Complete! +${amount} Gold +${timeBonus} (${timeBonusPercent}% Speed Bonus)`;
        } else {
            message = `Wave ${waveNumber} Complete! +${amount} Gold`;
        }

        // Create a text canvas with significantly more width to avoid text cutting at any resolution
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 2048; // Much wider canvas to ensure text fits completely
        canvas.height = 256;  // Increased height for better positioning

        // Ensure canvas is completely transparent (no background)
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Draw message with enhanced styling
        context.font = 'Bold 56px Arial, sans-serif'; // Larger font
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        // Measure text width to ensure it fits
        const textWidth = context.measureText(message).width;
        // Status log removed

        // Enhanced glow effect
        context.shadowColor = '#FFD700';
        context.shadowBlur = 25;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;

        // Draw gold text (slightly brighter gold)
        context.fillStyle = '#FFDF00';
        context.fillText(message, canvas.width / 2, canvas.height / 2);

        // Add a second layer with slight offset for stronger effect
        context.shadowBlur = 15;
        context.fillStyle = '#FFF6A0';
        context.fillText(message, canvas.width / 2, canvas.height / 2);

        // Create texture and sprite with improved transparency
        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;

        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false, // Ensure text renders on top
            depthWrite: false // Prevent z-fighting
        });

        const sprite = new THREE.Sprite(spriteMaterial);
        // Position in center of map, slightly higher
        sprite.position.set(0, 6, 0);
        sprite.scale.set(20, 5, 1); // Increased scale to match bigger canvas and ensure text is fully visible

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

    createFloatingTextEffect(position, amount, type = 'gold') {
        // Skip if no renderer or no position
        if (!this.renderer || !position) return;

        // Configure appearance based on type
        let textColor, text;
        if (type === 'gold') {
            textColor = '#FFD700'; // Gold color
            text = `+${amount}`;
        } else if (type === 'mana') {
            textColor = '#00AAFF'; // Blue mana color
            text = `+${amount}`;
        }

        // Create a canvas for the text
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 64;
        const context = canvas.getContext('2d');

        // Clear background with transparency
        context.clearRect(0, 0, canvas.width, canvas.height);
        // Draw text with color and black outline
        context.font = 'bold 48px Arial';
        context.fillStyle = textColor;
        context.strokeStyle = '#000000';
        context.lineWidth = 4;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.strokeText(text, canvas.width/2, canvas.height/2);
        context.fillText(text, canvas.width/2, canvas.height/2);

        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);

        // Create sprite material with proper transparency settings
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 1.0,
            depthTest: false, // Ensure it's always visible
            depthWrite: false, // Don't write to depth buffer
            sizeAttenuation: true, // Scale with distance
            blending: type === 'mana' ? THREE.AdditiveBlending : THREE.NormalBlending
        });

        // Create the sprite
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(1.4, 0.7, 2);
        sprite.position.copy(position);
        sprite.position.y += 0.5; // Position above enemy or object

        // Add to scene
        this.renderer.scene.add(sprite);

        // Animate floating up and fading out
        const startTime = performance.now();
        const duration = 1000; // 1 second

        this.addAnimationEffect({
            startTime,
            duration,
            type: 'decorative', // Mark as non-essential for performance
            update: (progress) => {
                // Float upward
                sprite.position.y += 0.015;

                // Fade out in the second half of animation
                if (progress > 0.5) {
                    material.opacity = 2 * (1 - progress); // Fade out in the second half
                }

                if (progress >= 1) {
                    // Clean up
                    this.renderer.scene.remove(sprite);
                    material.dispose();
                    texture.dispose();
                    return true; // Animation complete
                }
                return false; // Animation still running
            }
        });
    }

    createMoneyWinEffect(enemy) {
        // Skip if no enemy
        if (!enemy || !enemy.position) return;

        // Get the actual gold reward for this enemy
        let baseReward = Math.round(enemy.reward || 10);

        // Apply wave gold multiplier
        const waveIndex = this.currentWave - 1;
        let goldAmount = baseReward;
        if (waveIndex < this.waveSettings.length && this.waveSettings[waveIndex].goldMultiplier) {
            goldAmount = Math.round(goldAmount * this.waveSettings[waveIndex].goldMultiplier);
        }

        // Apply global gold multiplier
        if (this.difficultySettings && this.difficultySettings.goldMultiplier) {
            goldAmount = Math.round(goldAmount * this.difficultySettings.goldMultiplier);
        }

        // Create the floating text effect
        this.createFloatingTextEffect(enemy.position, goldAmount, 'gold');
    }

    createManaBonusEffect(position) {
        // Create a visual mana bonus effect at the given position
        if (!position) return;

        // Use 2 as the default mana bonus amount
        const manaBonus = 2;

        // Create the floating text effect
        this.createFloatingTextEffect(position, manaBonus, 'mana');
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

    // Player ranking system methods
    savePlayerScore(isVictory) {
        if (!this.player.username || this.player.username === 'Player') {
            // Status log removed
            return;
        }

        try {
            // Calculate game duration in seconds
            const gameEndTime = performance.now();
            const gameDuration = Math.round((gameEndTime - this.gameStartTime) / 1000);

            // Prepare score data for both local storage and server
            const gameScore = {
                username: this.player.username,
                score: this.player.score,
                wave: this.currentWave,
                victory: isVictory,
                date: new Date().toISOString(),
                duration: gameDuration,
                gameData: {
                    waveTimes: this.waveStartTimes,
                    wavesCompleted: this.wavesCompleted,
                    activeWaves: this.activeWaves
                }
            };

            // Save to localStorage as fallback
            this.saveScoreToLocalStorage(gameScore);

            // Save to server database
            this.saveScoreToServer(gameScore);

            // Status log removed
        } catch (err) {
            console.error("Error saving score:", err);
        }
    }

    saveScoreToLocalStorage(gameScore) {
        try {
            // Get existing scores from localStorage
            let highScores = JSON.parse(localStorage.getItem('towerDefenseHighScores') || '[]');

            // Add to high scores and sort
            highScores.push(gameScore);

            // Sort by score (highest first)
            highScores.sort((a, b) => b.score - a.score);

            // Keep only top 20 scores
            if (highScores.length > 20) {
                highScores = highScores.slice(0, 20);
            }

            // Save back to localStorage
            localStorage.setItem('towerDefenseHighScores', JSON.stringify(highScores));
            // Status log removed
        } catch (err) {
            console.error("Error saving score to localStorage:", err);
        }
    }

    saveScoreToServer(gameScore) {
        try {
            // API endpoint (adjust if needed)
            const apiUrl = '/api/scores';

            // Remove gameData to reduce payload size (optional)
            const scoreData = { ...gameScore };

            // Make POST request to server
            fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(scoreData)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Status log removed
            })
            .catch(error => {
                console.error("Error saving score to server:", error);
                // Status log removed
            });
        } catch (err) {
            console.error("Error in server score saving:", err);
        }
    }

    displayPlayerRanking(scoreDisplay) {
        try {
            // First try to get scores from the server
            this.fetchScoresFromServer().then(serverScores => {
                if (serverScores && serverScores.length > 0) {
                    this.renderRankings(scoreDisplay, serverScores, "Global Rankings");
                } else {
                    // Fallback to localStorage if server fails
                    const localScores = JSON.parse(localStorage.getItem('towerDefenseHighScores') || '[]');
                    if (localScores.length > 0) {
                        this.renderRankings(scoreDisplay, localScores, "Player Rankings");
                    }
                }
            }).catch(err => {
                console.error("Error fetching server scores:", err);
                // Fallback to localStorage
                const localScores = JSON.parse(localStorage.getItem('towerDefenseHighScores') || '[]');
                if (localScores.length > 0) {
                    this.renderRankings(scoreDisplay, localScores, "Player Rankings");
                }
            });
        } catch (err) {
            console.error("Error displaying ranking:", err);
        }
    }

    fetchScoresFromServer() {
        return new Promise((resolve, reject) => {
            fetch('/api/scores?limit=20')
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    // Status log removed
                    resolve(data);
                })
                .catch(error => {
                    console.error("Error fetching scores from server:", error);
                    reject(error);
                });
        });
    }

    renderRankings(scoreDisplay, scores, title) {
        // If no scores, don't show anything
        if (scores.length === 0) {
            return;
        }

        // Find rank of current player
        const playerRank = scores.findIndex(score =>
            score.username === this.player.username &&
            score.score === this.player.score &&
            score.wave === this.currentWave
        );

        // Create ranking display
        const rankingInfo = document.createElement('div');
        rankingInfo.style.marginTop = '10px';
        rankingInfo.style.color = '#4CAF50';

        if (playerRank !== -1) {
            rankingInfo.textContent = `${title}: Rank ${playerRank + 1} of ${scores.length}`;
        } else {
            rankingInfo.textContent = `${title}: ${scores.length} total players`;
        }

        // Create top scores section
        const topScores = document.createElement('div');
        topScores.style.marginTop = '15px';
        topScores.style.fontSize = '0.9rem';
        topScores.innerHTML = '<strong>Top 5 Scores:</strong><br>';

        // Add top 5 scores
        for (let i = 0; i < Math.min(5, scores.length); i++) {
            const scoreEntry = scores[i];
            const scoreItem = document.createElement('div');

            // Format display based on available data
            const scoreDetail = scoreEntry.victory ? 'Victory' : `Wave ${scoreEntry.wave}`;
            const timeInfo = scoreEntry.duration ? ` (${Math.floor(scoreEntry.duration/60)}m ${scoreEntry.duration%60}s)` : '';

            scoreItem.textContent = `${i + 1}. ${scoreEntry.username}: ${scoreEntry.score} - ${scoreDetail}${timeInfo}`;

            // Highlight current player
            if (scoreEntry.username === this.player.username &&
                scoreEntry.score === this.player.score &&
                scoreEntry.wave === this.currentWave) {
                scoreItem.style.color = '#FFD700'; // Gold color
                scoreItem.style.fontWeight = 'bold';
            }

            topScores.appendChild(scoreItem);
        }

        // Add to score display
        scoreDisplay.appendChild(rankingInfo);
        scoreDisplay.appendChild(topScores);
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

    // Update a method to handle adding animation effects to the centralized system
    addAnimationEffect(animationConfig) {
        const id = this.animationIdCounter++;
        this.animations.push({
            id,
            ...animationConfig,
            completed: false
        });
        return id;
    }

    // Add a new method to update all animations
    updateAnimations(currentTime) {
        let maxAnimations = 100;

        if (this.animations.length > maxAnimations) {
            // Remove oldest animations to stay under the limit
            this.animations = this.animations.slice(this.animations.length - maxAnimations);
        }

        // Update and filter out completed animations
        this.animations = this.animations.filter(animation => {
            if (animation.completed) return false;

            const elapsed = currentTime - animation.startTime;
            const progress = animation.duration === Infinity ? 0 : Math.min(elapsed / animation.duration, 1);

            // Call the animation's update function
            const completed = animation.update(progress, currentTime);

            // Remove if completed
            return !completed;
        });

        // Log animation count in debug mode for performance monitoring
        if (this.debugMode && this.animations.length > 50) {
            console.log(`High animation count: ${this.animations.length}`);
        }
    }

    // Add this method to get a projectile from the pool or create a new one
    getProjectileFromPool(type, startPosition, target, damage, areaOfEffect = 0, element = 'neutral') {
        // Check if there's a matching projectile in the pool
        if (this.projectilePool && this.projectilePool.length > 0) {
            for (let i = 0; i < this.projectilePool.length; i++) {
                const pooledProjectile = this.projectilePool[i];
                if (pooledProjectile.type === type) {
                    // Remove from pool
                    const projectile = this.projectilePool.splice(i, 1)[0];

                    // Reset and update properties
                    projectile.position = { ...startPosition };
                    projectile.target = target;
                    projectile.damage = damage;
                    projectile.areaOfEffect = areaOfEffect;
                    projectile.element = element;
                    projectile.timeAlive = 0;
                    projectile.hit = false;

                    // Update mesh position
                    if (projectile.mesh) {
                        projectile.mesh.position.set(startPosition.x, startPosition.y, startPosition.z);
                        projectile.mesh.visible = true;
                    } else {
                        // If mesh somehow got lost, recreate it
                        projectile.mesh = this.renderer.createProjectile(projectile);
                    }

                    // Recalculate direction to target
                    projectile.calculateDirection();

                    // Add to active projectiles array
                    this.projectiles.push(projectile);

                    return projectile;
                }
            }
        }

        // Create a new projectile if none was found in the pool
        const projectile = new Projectile(this, type, startPosition, target, damage, areaOfEffect, element);
        this.projectiles.push(projectile);

        return projectile;
    }

    // Method to return a projectile to the pool
    returnProjectileToPool(projectile) {
        if (!projectile) return;

        // Remove from active projectiles
        const index = this.projectiles.indexOf(projectile);
        if (index !== -1) {
            this.projectiles.splice(index, 1);
        }

        // Hide the mesh but keep it for reuse
        if (projectile.mesh) {
            projectile.mesh.visible = false;
        }

        // Initialize pool if it doesn't exist
        if (!this.projectilePool) {
            this.projectilePool = [];
        }

        // Add to pool if it's not at max capacity
        if (this.projectilePool.length < this.maxPoolSize) {
            this.projectilePool.push(projectile);
        } else {
            // Dispose of the projectile completely if pool is full
            if (projectile.mesh) {
                this.renderer.scene.remove(projectile.mesh);
                if (projectile.mesh.geometry) projectile.mesh.geometry.dispose();
                if (projectile.mesh.material) {
                    if (Array.isArray(projectile.mesh.material)) {
                        projectile.mesh.material.forEach(m => m.dispose());
                    } else {
                        projectile.mesh.material.dispose();
                    }
                }
            }
        }
    }
}