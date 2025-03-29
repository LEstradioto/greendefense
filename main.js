import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Make THREE and OrbitControls available globally for legacy code
window.THREE = THREE;
window.OrbitControls = OrbitControls;

// Import our game components
import { Game } from './src/game.js';
import { UI } from './src/ui.js';
import { LofiMusicPlayer } from './src/lofiMusic.js';

// Three.js version info removed for production

// Initialize the game when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    window.game = new Game(canvas);
    
    // Create UI and store it in the game
    window.ui = new UI(window.game);
    window.game.ui = window.ui;
    
    // Set up audio system with music and sound effects
    const setupAudio = () => {
        // Music tracks
        const musicTracks = [
            "https://cdn.pixabay.com/download/audio/2023/07/30/audio_e0908e8569.mp3", // Good Night Lofi by FASSounds
            "https://cdn.pixabay.com/download/audio/2022/11/22/audio_febc508520.mp3", // Lofi Chill by Music Unlimited
            "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3"  // Lofi Study by FASSounds
        ];
        
        // We're using URL-based sounds instead of base64
        
        // Elements
        const musicButton = document.getElementById('music-toggle');
        const musicIcon = document.getElementById('music-icon');
        const backgroundMusic = document.getElementById('background-music');
        
        // Randomize tracks completely
        // Shuffle the tracks array to get a truly random order
        const shuffleTracks = (tracks) => {
            for (let i = tracks.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
            }
            return tracks;
        };
        
        // Shuffle the tracks once at start
        const shuffledTracks = shuffleTracks([...musicTracks]);
        let currentTrackIndex = 0; // Start with first track in shuffled list
        
        // Play a track from the shuffled list
        const playRandomTrack = () => {
            backgroundMusic.src = shuffledTracks[currentTrackIndex];
            backgroundMusic.volume = 0.15; // Lower volume further from 0.2 to 0.15
            backgroundMusic.load();
            backgroundMusic.play().catch(err => {});
            
            // Show track name
            const trackName = shuffledTracks[currentTrackIndex].split('/').pop().split('.')[0];
            showTrackInfo(trackName);
        };
        
        // Track info display
        const showTrackInfo = (trackName) => {
            // Check if we already have the info element
            let trackInfo = document.getElementById('track-info');
            if (!trackInfo) {
                // Create track info display
                trackInfo = document.createElement('div');
                trackInfo.id = 'track-info';
                trackInfo.style.position = 'fixed';
                trackInfo.style.bottom = '48px';
                trackInfo.style.left = '8px';
                trackInfo.style.backgroundColor = 'rgba(0,0,0,0.6)';
                trackInfo.style.color = '#fff';
                trackInfo.style.padding = '4px 8px';
                trackInfo.style.borderRadius = '4px';
                trackInfo.style.fontSize = '12px';
                trackInfo.style.opacity = '0';
                trackInfo.style.transition = 'opacity 0.5s';
                trackInfo.style.zIndex = '9999';
                document.body.appendChild(trackInfo);
            }
            
            // Set content and show
            trackInfo.textContent = `▶ ${trackName.replace(/_/g, ' ')}`;
            trackInfo.style.opacity = '1';
            
            // Hide after 3 seconds
            setTimeout(() => {
                trackInfo.style.opacity = '0';
            }, 3000);
        };
        
        // When current track ends, play the next one
        backgroundMusic.addEventListener('ended', () => {
            currentTrackIndex = (currentTrackIndex + 1) % shuffledTracks.length;
            playRandomTrack();
        });
        
        // Add FX toggle button to the audio-controls div
        const fxButton = document.createElement('button');
        fxButton.id = 'fx-toggle';
        fxButton.innerHTML = 'FX';
        fxButton.className = 'music-button'; // Use the same class to get the base styling
         
        // Only override the position to place it next to the music button
        // This way it inherits all the styling from the CSS class including
        // the green border, glow effect and animations
        fxButton.style.left = '76px';
        fxButton.style.bottom = '8px';
        fxButton.style.top = 'auto';
        
        fxButton.title = "Sound Effects: On";
        document.getElementById('audio-controls').appendChild(fxButton);
        
        // FX toggle state
        window.soundFxEnabled = true;
        
        fxButton.addEventListener('click', () => {
            window.soundFxEnabled = !window.soundFxEnabled;
            
            if (window.soundFxEnabled) {
                fxButton.title = "Sound Effects: On";
                fxButton.classList.remove('muted');
            } else {
                fxButton.title = "Sound Effects: Off";
                fxButton.classList.add('muted');
            }
        });
        
        // Local sound file paths
        const soundUrls = {
            'towerShoot': [
                "/bowShot.mp3" // Local bow shot sound
            ],
            'enemyHit': [
                "/enemyHit.wav", // Local hit sound
                "/enemyHit2.wav" // Alternative hit sound
            ],
            'loseLife': [
                "/loseHit1.mp3", // Local lose life sound
                "/loseHit2.mp3" // Alternative lose life sound
            ]
        };
        
        // Pre-load and cache sound effects
        const soundCache = {};
        
        // Load each sound effect once
        Object.keys(soundUrls).forEach(type => {
            soundUrls[type].forEach((url, index) => {
                const cacheKey = `${type}_${index}`;
                soundCache[cacheKey] = new Audio(url);
                
                // Set normalized volume based on sound type (lower overall)
                if (type === 'loseLife') {
                    soundCache[cacheKey].volume = 0.5; // Moderate volume for lose life
                } else if (type === 'enemyHit') {
                    soundCache[cacheKey].volume = 0.4; // Lower for enemy hit to avoid overwhelming
                } else {
                    soundCache[cacheKey].volume = 0.35; // Even lower for frequent sounds
                }
                
                // Preload the sound
                soundCache[cacheKey].load();
            });
        });
        
        // Create a simple context for playback rate manipulation (avoid audio fatigue)
        let audioContext;
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            // AudioContext not supported
        }
        
        // Function to play sound effects with variations to avoid audio fatigue
        window.playSound = (soundType) => {
            // Check if sound effects are enabled
            if (!window.soundFxEnabled) {
                return;
            }
            
            try {
                // Check if we have sounds for this type
                if (!soundUrls[soundType] || !soundUrls[soundType].length) {
                    return;
                }
                
                // Pick a random sound from the category
                const urlIndex = Math.floor(Math.random() * soundUrls[soundType].length);
                
                // Create a fresh sound to allow independent playback and pitch variation
                const sound = new Audio(soundUrls[soundType][urlIndex]);
                
                // Set extremely low base volumes for all sound types
                let baseVolume;
                if (soundType === 'loseLife') {
                    baseVolume = 0.15; // Low volume for lose life
                } else if (soundType === 'enemyHit') {
                    baseVolume = 0.12; // Very low for enemy hit sounds
                } else {
                    baseVolume = 0.1; // Extremely low for tower shooting (most frequent)
                }
                
                // Add substantial volume variation to make sounds less repetitive
                // Sometimes make sound nearly silent or completely silent
                const volumeVariation = Math.random();
                
                // 10% chance for no sound at all - i.e., skip playing
                if (volumeVariation < 0.1) {
                    return; // Skip playing this sound completely
                }
                
                // 20% chance for very quiet sound
                if (volumeVariation < 0.3) {
                    sound.volume = baseVolume * 0.3; // Very quiet (6-9% volume)
                } else {
                    // Normal case: variable volume based on random factor
                    sound.volume = baseVolume * (0.5 + (volumeVariation * 0.5)); // 50-100% of base volume
                }
                
                // Add pitch variation to avoid audio fatigue
                // More variation for frequently played sounds
                if (soundType === 'towerShoot') {
                    sound.playbackRate = 0.85 + (Math.random() * 0.4); // Wider range: 0.85-1.25
                } else {
                    sound.playbackRate = 0.9 + (Math.random() * 0.3); // 0.9-1.2 range
                }
                
                // Play the sound with error handling
                sound.play().catch(err => {});
            } catch (err) {
                // Silently fail - sound effects aren't critical
            }
        };
        
        // Set initial volume and play the first track
        playRandomTrack();
        
        // Set up music toggle button
        if (musicButton) {
            musicButton.addEventListener('click', () => {
                if (backgroundMusic.paused) {
                    backgroundMusic.play();
                    musicIcon.className = 'fas fa-volume-up';
                    musicButton.classList.remove('muted');
                } else {
                    backgroundMusic.pause();
                    musicIcon.className = 'fas fa-volume-mute';
                    musicButton.classList.add('muted');
                }
            });
        }
        
        // Add event listener to document that tries to play music on first interaction
        document.body.addEventListener('click', () => {
            if (backgroundMusic.paused) {
                backgroundMusic.play().catch(err => {});
            }
        }, { once: true });
    };
    
    // Initialize audio controls
    setupAudio();
    
    // Hide debug elements unless running locally
    hideDebugElementsUnlessLocal();
    
    // Setup high scores functionality
    setupHighScoresSystem();

    // Setup the start button event listener
    document.getElementById('start-button').addEventListener('click', async () => {
        const username = document.getElementById('username').value || 'Player';
        await window.game.start(username);

        // Hide the overlay
        const overlay = document.getElementById('game-overlay');
        
        // Method 1: Add hidden class
        overlay.classList.add('hidden');

        // Method 2: Set style directly
        overlay.style.display = 'none';
    });

    // We'll handle the restart button in the Game class
    // Do not reload the page as we want to maintain the game state properly

    // Setup keyboard controls with strict key tracking to prevent duplicates
    let keyStates = {
        '1': false,
        '2': false,
        '3': false,
        'Escape': false,
        'd': false,
        'D': false,
        'c': false,
        'C': false
    };
    
    // Map number keys to tower types - this allows easier configuration
    const keyToTowerMap = {
        '1': 'arrow',
        '2': 'doubleArrow',
        '3': 'cannon'
    };
    
    // Handle keydown - only act on the first press, not repeated events
    window.addEventListener('keydown', (event) => {
        // Only respond if the game is started
        if (window.game && window.game.gameStarted) {
            // Check if this key is already down
            if (keyStates[event.key] === true) {
                return;
            }
            
            // Mark key as down
            keyStates[event.key] = true;
            
            // Check if it's a tower selection key
            if (keyToTowerMap[event.key]) {
                const towerType = keyToTowerMap[event.key];
                window.ui.selectTower(towerType);
            }
            // Other key handlers
            else switch(event.key) {
                case 'Escape':
                    window.ui.cancelTowerPlacement();
                    break;
                case 'd':
                case 'D':
                    window.game.toggleDebugMode();
                    break;
                case 'c':
                case 'C':
                    window.game.toggleCardDebugMode(); // Card debug mode shortcut
                    break;
            }
        }
    });
    
    // Handle keyup - reset key state
    window.addEventListener('keyup', (event) => {
        // Reset key state when released
        keyStates[event.key] = false;
    });
    
    // Setup debug button for card debug mode
    document.getElementById('toggle-card-debug').addEventListener('click', () => {
        window.game.toggleCardDebugMode();
    });
    
    // Setup debug panel toggle
    const debugPanelToggle = document.getElementById('toggle-debug-panel');
    debugPanelToggle.addEventListener('click', () => {
        const panel = document.getElementById('debug-panel');
        panel.classList.toggle('hidden');
        
        // Add memory monitor when debug panel is shown
        if (!panel.classList.contains('hidden')) {
            addMemoryMonitor();
        }
    });
    
    // Add a memory and performance monitoring component for debugging
    const addMemoryMonitor = () => {
        // Check if we already have a memory monitor
        let memoryMonitor = document.getElementById('memory-monitor');
        if (memoryMonitor) return;

        // Create memory monitor element
        memoryMonitor = document.createElement('div');
        memoryMonitor.id = 'memory-monitor';
        memoryMonitor.style.position = 'fixed';
        memoryMonitor.style.top = '40px';
        memoryMonitor.style.right = '10px';
        memoryMonitor.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        memoryMonitor.style.color = '#00ffff';
        memoryMonitor.style.padding = '5px 10px';
        memoryMonitor.style.borderRadius = '3px';
        memoryMonitor.style.fontFamily = 'monospace';
        memoryMonitor.style.fontSize = '14px';
        memoryMonitor.style.zIndex = '1000';
        document.body.appendChild(memoryMonitor);

        // Add performance stats container
        const perfStatsContainer = document.createElement('div');
        perfStatsContainer.id = 'perf-stats';
        perfStatsContainer.style.position = 'fixed';
        perfStatsContainer.style.top = '70px';
        perfStatsContainer.style.right = '10px';
        perfStatsContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        perfStatsContainer.style.color = '#00ff00';
        perfStatsContainer.style.padding = '5px 10px';
        perfStatsContainer.style.borderRadius = '3px';
        perfStatsContainer.style.fontFamily = 'monospace';
        perfStatsContainer.style.fontSize = '14px';
        perfStatsContainer.style.zIndex = '1000';
        perfStatsContainer.style.maxWidth = '300px';
        perfStatsContainer.style.maxHeight = '200px';
        perfStatsContainer.style.overflow = 'auto';
        document.body.appendChild(perfStatsContainer);

        // Add entity counter container
        const entityCounterContainer = document.createElement('div');
        entityCounterContainer.id = 'entity-counter';
        entityCounterContainer.style.position = 'fixed';
        entityCounterContainer.style.top = '100px';
        entityCounterContainer.style.right = '10px';
        entityCounterContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        entityCounterContainer.style.color = '#ffaa00';
        entityCounterContainer.style.padding = '5px 10px';
        entityCounterContainer.style.borderRadius = '3px';
        entityCounterContainer.style.fontFamily = 'monospace';
        entityCounterContainer.style.fontSize = '14px';
        entityCounterContainer.style.zIndex = '1000';
        document.body.appendChild(entityCounterContainer);

        // Update memory stats if performance API is available
        if (window.performance && window.performance.memory) {
            // Initial update
            updateMemoryStats();
            
            // Update regularly
            setInterval(updateMemoryStats, 1000);
        } else {
            memoryMonitor.textContent = 'Memory stats unavailable';
        }
        
        // Update entity counts and performance metrics
        setInterval(updateEntityCounts, 500);
        
        // Start performance monitoring
        setupPerformanceMonitoring();
        
        function updateMemoryStats() {
            const memoryInfo = window.performance.memory;
            const usedHeap = Math.round(memoryInfo.usedJSHeapSize / (1024 * 1024));
            const totalHeap = Math.round(memoryInfo.totalJSHeapSize / (1024 * 1024));
            const limit = Math.round(memoryInfo.jsHeapSizeLimit / (1024 * 1024));
            
            memoryMonitor.textContent = `Memory: ${usedHeap}MB / ${totalHeap}MB (${limit}MB limit)`;
            
            // Color coding based on usage
            const usageRatio = memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize;
            if (usageRatio > 0.9) {
                memoryMonitor.style.color = '#ff0000'; // Red for high usage
            } else if (usageRatio > 0.7) {
                memoryMonitor.style.color = '#ffff00'; // Yellow for moderate usage
            } else {
                memoryMonitor.style.color = '#00ffff'; // Cyan for normal usage
            }
        }
        
        function updateEntityCounts() {
            if (!window.game) return;
            
            const entityCounter = document.getElementById('entity-counter');
            const enemyCount = window.game.enemies.length;
            const projectileCount = window.game.projectiles.length;
            const towerCount = window.game.towers.length;
            const totalCount = enemyCount + projectileCount + towerCount;
            
            entityCounter.textContent = `Entities: ${totalCount} (E:${enemyCount} P:${projectileCount} T:${towerCount})`;
            
            // Color coding based on entity count
            if (totalCount > 300) {
                entityCounter.style.color = '#ff0000'; // Red for high count
            } else if (totalCount > 150) {
                entityCounter.style.color = '#ffff00'; // Yellow for moderate count
            } else {
                entityCounter.style.color = '#ffaa00'; // Orange for normal count
            }
        }
        
        function setupPerformanceMonitoring() {
            // Only run in browsers that support the Performance API
            if (!window.performance || !window.performance.now) return;
            
            const perfStats = document.getElementById('perf-stats');
            let lastUpdateTime = performance.now();
            let frameTimes = [];
            let gameUpdateTime = 0;
            let renderTime = 0;
            let enemyUpdateTime = 0;
            let projectileUpdateTime = 0;
            
            // Create counters for each operation
            const perfCounters = {
                gameUpdate: { time: 0, calls: 0 },
                enemyUpdate: { time: 0, calls: 0 },
                projectileUpdate: { time: 0, calls: 0 },
                renderUpdate: { time: 0, calls: 0 },
                pathfinding: { time: 0, calls: 0 }
            };
            
            // Patch the game update method to measure performance
            if (window.game) {
                // Patch performance monitoring into game methods if not already done
                if (!window.game._performancePatched) {
                    // Override the update method
                    const originalUpdate = window.game.update;
                    window.game.update = function(currentTime) {
                        const startTime = performance.now();
                        const result = originalUpdate.call(this, currentTime);
                        const endTime = performance.now();
                        
                        gameUpdateTime = endTime - startTime;
                        perfCounters.gameUpdate.time += gameUpdateTime;
                        perfCounters.gameUpdate.calls++;
                        
                        return result;
                    };
                    
                    // Override the updateEnemies method
                    const originalUpdateEnemies = window.game.updateEnemies;
                    window.game.updateEnemies = function() {
                        const startTime = performance.now();
                        const result = originalUpdateEnemies.call(this);
                        const endTime = performance.now();
                        
                        enemyUpdateTime = endTime - startTime;
                        perfCounters.enemyUpdate.time += enemyUpdateTime;
                        perfCounters.enemyUpdate.calls++;
                        
                        return result;
                    };
                    
                    // Override the updateProjectiles method
                    const originalUpdateProjectiles = window.game.updateProjectiles;
                    window.game.updateProjectiles = function() {
                        const startTime = performance.now();
                        const result = originalUpdateProjectiles.call(this);
                        const endTime = performance.now();
                        
                        projectileUpdateTime = endTime - startTime;
                        perfCounters.projectileUpdate.time += projectileUpdateTime;
                        perfCounters.projectileUpdate.calls++;
                        
                        return result;
                    };
                    
                    // Mark as patched
                    window.game._performancePatched = true;
                }
            }
            
            // Update performance stats every second
            setInterval(() => {
                const now = performance.now();
                const elapsedTime = now - lastUpdateTime;
                lastUpdateTime = now;
                
                // Calculate average times
                const avgGameUpdate = perfCounters.gameUpdate.calls > 0 ? 
                    perfCounters.gameUpdate.time / perfCounters.gameUpdate.calls : 0;
                
                const avgEnemyUpdate = perfCounters.enemyUpdate.calls > 0 ? 
                    perfCounters.enemyUpdate.time / perfCounters.enemyUpdate.calls : 0;
                
                const avgProjectileUpdate = perfCounters.projectileUpdate.calls > 0 ? 
                    perfCounters.projectileUpdate.time / perfCounters.projectileUpdate.calls : 0;
                
                // Reset counters
                Object.keys(perfCounters).forEach(key => {
                    perfCounters[key].time = 0;
                    perfCounters[key].calls = 0;
                });
                
                // Update the display with formatted data
                perfStats.innerHTML = `
                <div>Game Update: ${avgGameUpdate.toFixed(2)}ms</div>
                <div>Enemy Update: ${avgEnemyUpdate.toFixed(2)}ms</div>
                <div>Projectile Update: ${avgProjectileUpdate.toFixed(2)}ms</div>
                `;
                
                // Color code based on performance
                if (avgGameUpdate > 16) { // More than 16ms per frame is below 60fps
                    perfStats.style.color = '#ff0000'; // Red for poor performance
                } else if (avgGameUpdate > 8) { // 8-16ms is acceptable
                    perfStats.style.color = '#ffff00'; // Yellow for moderate performance
                } else {
                    perfStats.style.color = '#00ff00'; // Green for good performance
                }
            }, 1000);
        }
    };
    
    // Initially hide the debug panel toggle (will be shown when debug mode is enabled)
    debugPanelToggle.classList.add('hidden');
    
    // Setup debug element buttons (for enemy spawning)
    document.querySelectorAll('.element-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Toggle selection state
            document.querySelectorAll('.element-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
    });
    
    // Setup debug enemy spawn buttons
    document.querySelectorAll('.debug-enemy-controls button').forEach(btn => {
        btn.addEventListener('click', () => {
            // Get the selected element (if any)
            const selectedElement = document.querySelector('.element-btn.selected');
            let elementType = 'neutral'; // Default
            
            if (selectedElement) {
                elementType = selectedElement.dataset.element;
            }
            
            // Spawn the enemy with the selected element
            const enemyType = btn.id.replace('spawn-', '');
            window.game.debugSpawnEnemy(enemyType, elementType);
        });
    });
    
    // Setup debug wave control buttons
    document.getElementById('debug-complete-wave').addEventListener('click', () => {
        window.game.debugCompleteWave();
    });
    
    document.getElementById('debug-start-wave').addEventListener('click', () => {
        window.game.debugStartWave();
    });
    
    document.getElementById('debug-jump-to-wave5').addEventListener('click', () => {
        window.game.debugJumpToWave5();
    });
    
    // Performance debugging tools
    document.getElementById('debug-perf-snapshot').addEventListener('click', () => {
        takePerformanceSnapshot();
    });
    
    document.getElementById('debug-profile-start').addEventListener('click', () => {
        if (window.console && window.console.profile) {
            window.console.profile('Game Performance Profile');
            document.getElementById('debug-perf-report').innerHTML = '<div style="color: #00ff00">Profiling started...</div>';
        } else {
            document.getElementById('debug-perf-report').innerHTML = '<div style="color: #ff0000">Profiling not supported in this browser</div>';
        }
    });
    
    document.getElementById('debug-profile-stop').addEventListener('click', () => {
        if (window.console && window.console.profileEnd) {
            window.console.profileEnd();
            document.getElementById('debug-perf-report').innerHTML = '<div style="color: #00ff00">Profiling stopped. Check DevTools console.</div>';
        }
    });
    
    document.getElementById('debug-gc').addEventListener('click', () => {
        if (window.gc) {
            window.gc();
            document.getElementById('debug-perf-report').innerHTML = '<div style="color: #00ff00">Garbage collection requested</div>';
        } else {
            document.getElementById('debug-perf-report').innerHTML = '<div style="color: #ff0000">Manual GC not available. Try Chrome with --js-flags="--expose-gc"</div>';
        }
    });
    
    function takePerformanceSnapshot() {
        const report = document.getElementById('debug-perf-report');
        if (!window.game) {
            report.innerHTML = '<div style="color: #ff0000">Game not initialized</div>';
            return;
        }
        
        // Take snapshot of current game state
        const snapshot = {
            time: new Date().toISOString(),
            fps: window.game.fpsCounter.value,
            entities: {
                enemies: window.game.enemies.length,
                projectiles: window.game.projectiles.length,
                towers: window.game.towers.length
            },
            memory: window.performance.memory ? {
                usedJSHeapSize: Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024)),
                totalJSHeapSize: Math.round(window.performance.memory.totalJSHeapSize / (1024 * 1024))
            } : null,
            wave: window.game.currentWave,
            activeWaves: window.game.activeWaves ? window.game.activeWaves.length : 0
        };
        
        // Format and display report
        let reportHTML = `
        <div style="color: #ffffff; margin-top: 10px; font-weight: bold">Performance Snapshot (${snapshot.time})</div>
        <div>FPS: <span style="color: ${snapshot.fps < 30 ? '#ff0000' : '#00ff00'}">${snapshot.fps}</span></div>
        <div>Enemies: ${snapshot.entities.enemies}</div>
        <div>Projectiles: ${snapshot.entities.projectiles}</div>
        <div>Towers: ${snapshot.entities.towers}</div>
        `;
        
        if (snapshot.memory) {
            reportHTML += `<div>Memory: ${snapshot.memory.usedJSHeapSize}MB / ${snapshot.memory.totalJSHeapSize}MB</div>`;
        }
        
        reportHTML += `
        <div>Wave: ${snapshot.wave} (Active: ${snapshot.activeWaves})</div>
        <div style="margin-top: 5px;">
            <button id="debug-perf-detailed" style="font-size: 12px; padding: 2px 5px;">Show Details</button>
        </div>
        `;
        
        report.innerHTML = reportHTML;
        
        // Add event listener for detailed report
        document.getElementById('debug-perf-detailed').addEventListener('click', () => {
            showDetailedReport(snapshot);
        });
    }
    
    function showDetailedReport(snapshot) {
        const report = document.getElementById('debug-perf-report');
        
        // Collect detailed information
        let enemyTypes = {};
        let pathfindingCalls = 0;
        let statusEffectsCount = 0;
        
        // Count enemy types
        window.game.enemies.forEach(enemy => {
            enemyTypes[enemy.type] = (enemyTypes[enemy.type] || 0) + 1;
            statusEffectsCount += enemy.statusEffects ? enemy.statusEffects.length : 0;
        });
        
        // Count pathfinding calls (requires instrumentation elsewhere)
        pathfindingCalls = window.game._pathfindingCalls || 0;
        
        // Format and display detailed report
        let detailedHTML = `
        <div style="color: #ffffff; margin-top: 10px; font-weight: bold">Detailed Performance Report</div>
        <div style="font-size: 12px; margin-top: 5px;">Enemy Types:</div>
        <ul style="font-size: 12px; margin: 2px 0; padding-left: 15px;">
        `;
        
        for (const [type, count] of Object.entries(enemyTypes)) {
            detailedHTML += `<li>${type}: ${count}</li>`;
        }
        
        detailedHTML += `
        </ul>
        <div style="font-size: 12px;">Status Effects Active: ${statusEffectsCount}</div>
        <div style="font-size: 12px;">Pathfinding Calls: ${pathfindingCalls}</div>
        
        <div style="margin-top: 5px;">
            <button id="debug-perf-summary" style="font-size: 12px; padding: 2px 5px;">Show Summary</button>
        </div>
        `;
        
        report.innerHTML = detailedHTML;
        
        // Add event listener to go back to summary
        document.getElementById('debug-perf-summary').addEventListener('click', () => {
            takePerformanceSnapshot();
        });
    }
    
    // Setup Send Next Wave button
    document.getElementById('send-next-wave-button').addEventListener('click', () => {
        // Only allow if game is started
        if (window.game && window.game.gameStarted && !window.game.gameOver) {
            window.game.startWave(true); // Force send the next wave
        }
    });
    
    // Grid style controls
    document.getElementById('grid-style-default').addEventListener('change', (e) => {
        if (e.target.checked) updateGridCustomization();
    });
    
    document.getElementById('grid-style-borders').addEventListener('change', (e) => {
        if (e.target.checked) updateGridCustomization();
    });
    
    document.getElementById('grid-style-opacity').addEventListener('change', (e) => {
        if (e.target.checked) updateGridCustomization();
    });
    
    document.getElementById('grid-style-neon').addEventListener('change', (e) => {
        if (e.target.checked) updateGridCustomization();
    });
    
    // Grid brightness slider
    document.getElementById('grid-brightness').addEventListener('input', (e) => {
        updateGridCustomization();
    });
    
    // Path color picker
    document.getElementById('path-color').addEventListener('input', (e) => {
        updateGridCustomization();
    });
    
    // Ground color picker
    document.getElementById('ground-color').addEventListener('input', (e) => {
        updateGridCustomization();
    });
    
    // Helper function to update all grid customizations
    function updateGridCustomization() {
        const brightness = document.getElementById('grid-brightness').value / 100;
        const pathColor = document.getElementById('path-color').value;
        const groundColor = document.getElementById('ground-color').value;
        const style = document.querySelector('input[name="grid-style"]:checked').id.replace('grid-style-', '');
        
        // Update grid style with all customization options
        window.game.renderer.updateGridStyle(style, brightness, pathColor, groundColor);
    }
    
    // Helper function to get current brightness value
    function getBrightness() {
        return document.getElementById('grid-brightness').value / 100;
    }
    
    // Function to hide debug elements unless in development mode
    function hideDebugElementsUnlessLocal() {
        // First check for development header from our server
        const checkDevMode = async () => {
            try {
                const response = await fetch(window.location.origin, {
                    method: 'HEAD'
                });
                return response.headers.get('X-Development-Mode') === 'true';
            } catch (err) {
                // Error checking development mode
                return false;
            }
        };
        
        // Local dev environment detection (Vite dev server or file://)
        const isLocalDev = window.location.hostname === 'localhost' && window.location.port === '5173' || 
                         window.location.protocol === 'file:';
        
        // Check both methods
        if (isLocalDev) {
            // Debug controls available in local development
            return; // Keep debug controls visible
        }
        
        // Check header for server-controlled setting
        checkDevMode().then(isDev => {
            if (!isDev) {
                // Hide debug buttons
                const debugControls = document.getElementById('debug-controls');
                if (debugControls) {
                    debugControls.style.display = 'none';
                }
                
                // Hide debug panel
                const debugPanel = document.getElementById('debug-panel');
                if (debugPanel) {
                    debugPanel.style.display = 'none';
                }
                
            }
        });
        
        // Hide by default until we confirm dev mode
        const debugControls = document.getElementById('debug-controls');
        if (debugControls) {
            debugControls.style.display = 'none';
        }
        
        const debugPanel = document.getElementById('debug-panel');
        if (debugPanel) {
            debugPanel.style.display = 'none';
        }
    }
    
    // Function to setup high scores system
    function setupHighScoresSystem() {
        // Setup high scores button
        document.getElementById('show-rankings-button').addEventListener('click', () => {
            // Show high scores screen
            document.getElementById('start-screen').classList.add('hidden');
            document.getElementById('high-scores-screen').classList.remove('hidden');
            
            // Populate high scores
            displayHighScores();
        });
        
        // Setup back button from high scores
        document.getElementById('back-to-start-button').addEventListener('click', () => {
            // Return to start screen
            document.getElementById('high-scores-screen').classList.add('hidden');
            document.getElementById('start-screen').classList.remove('hidden');
        });
        
        // Create side rankings display for desktop
        createSideRankingsDisplay();
    }
    
    // Function to create side rankings display for desktop
    function createSideRankingsDisplay() {
        // Create the rankings display container
        const rankingsDisplay = document.createElement('div');
        rankingsDisplay.id = 'rankings-display';
        
        // Add title
        const rankingsTitle = document.createElement('h3');
        rankingsTitle.textContent = 'Top Players';
        rankingsDisplay.appendChild(rankingsTitle);
        
        // Add placeholder for rankings
        const rankingsList = document.createElement('div');
        rankingsList.id = 'rankings-list';
        rankingsDisplay.appendChild(rankingsList);
        
        // Add to the game container
        document.getElementById('game-container').appendChild(rankingsDisplay);
        
        // Populate with top scores (simplified version)
        updateSideRankings();
    }
    
    // Function to update side rankings display
    function updateSideRankings() {
        const rankingsList = document.getElementById('rankings-list');
        if (!rankingsList) return;
        
        // Show loading message
        rankingsList.innerHTML = 'Loading...';
        
        // Try to get scores from the server first
        fetch('/api/scores?limit=5')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(serverScores => {
                if (serverScores && serverScores.length > 0) {
                    // Render server scores
                    renderSideRankings(rankingsList, serverScores);
                } else {
                    // Fallback to localStorage
                    const localScores = JSON.parse(localStorage.getItem('towerDefenseHighScores') || '[]');
                    renderSideRankings(rankingsList, localScores.slice(0, 5));
                }
            })
            .catch(error => {
                console.error("Error fetching server scores:", error);
                
                // Fallback to localStorage
                const localScores = JSON.parse(localStorage.getItem('towerDefenseHighScores') || '[]');
                renderSideRankings(rankingsList, localScores.slice(0, 5));
            });
    }
    
    // Function to render side rankings
    function renderSideRankings(container, scores) {
        container.innerHTML = '';
        
        if (scores.length === 0) {
            const noScores = document.createElement('div');
            noScores.className = 'ranking-entry';
            noScores.textContent = 'No scores yet';
            container.appendChild(noScores);
            return;
        }
        
        // Add scores (simplified display)
        scores.forEach((score, index) => {
            const entry = document.createElement('div');
            entry.className = 'ranking-entry';
            
            // Only show rank, name and score
            entry.textContent = `${index + 1}. ${score.username}: ${score.score}`;
            
            container.appendChild(entry);
        });
    }
    
    // Function to display high scores
    function displayHighScores() {
        try {
            const highScoresList = document.getElementById('high-scores-list');
            highScoresList.innerHTML = ''; // Clear existing scores
            
            // Show loading message
            const loadingMessage = document.createElement('div');
            loadingMessage.className = 'score-entry';
            loadingMessage.textContent = 'Loading scores...';
            highScoresList.appendChild(loadingMessage);
            
            // Try to get scores from the server first
            fetch('/api/scores?limit=50')
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(serverScores => {
                    // Clear loading message
                    highScoresList.innerHTML = '';
                    
                    if (serverScores && serverScores.length > 0) {
                        // Render server scores
                        renderScoresList(highScoresList, serverScores, "Global Rankings");
                    } else {
                        // Fallback to localStorage
                        const localScores = JSON.parse(localStorage.getItem('towerDefenseHighScores') || '[]');
                        renderScoresList(highScoresList, localScores, "Player Rankings");
                    }
                })
                .catch(error => {
                    console.error("Error fetching server scores:", error);
                    
                    // Clear loading message
                    highScoresList.innerHTML = '';
                    
                    // Fallback to localStorage
                    const localScores = JSON.parse(localStorage.getItem('towerDefenseHighScores') || '[]');
                    renderScoresList(highScoresList, localScores, "Player Rankings (Server Unavailable)");
                });
        } catch (err) {
            console.error("Error displaying high scores:", err);
            
            // Show error message
            const highScoresList = document.getElementById('high-scores-list');
            highScoresList.innerHTML = 'Error loading high scores.';
        }
    }
    
    // Helper function to render scores list
    function renderScoresList(container, scores, title) {
        // Add title
        const titleHeader = document.createElement('h2');
        titleHeader.textContent = title;
        titleHeader.style.fontSize = '1.5rem';
        titleHeader.style.marginBottom = '15px';
        container.appendChild(titleHeader);
        
        if (scores.length === 0) {
            // No scores yet
            const noScores = document.createElement('div');
            noScores.className = 'score-entry';
            noScores.textContent = 'No high scores yet. Play a game to be the first!';
            container.appendChild(noScores);
            return;
        }
        
        // Add title row
        const titleRow = document.createElement('div');
        titleRow.className = 'score-entry title';
        titleRow.innerHTML = '<strong>Rank. Player - Score (Result - Time)</strong>';
        container.appendChild(titleRow);
        
        // Add scores
        scores.forEach((score, index) => {
            const entry = document.createElement('div');
            entry.className = 'score-entry';
            
            // Format date and time
            const scoreDate = new Date(score.date || score.datetime);
            const dateString = scoreDate.toLocaleDateString();
            const timeString = scoreDate.toLocaleTimeString();
            
            // Format duration if available
            const durationInfo = score.duration ? 
                ` - ${Math.floor(score.duration/60)}m ${score.duration%60}s` : '';
            
            entry.textContent = `${index + 1}. ${score.username} - ${score.score} (${score.victory ? 'Victory' : 'Wave ' + score.wave}${durationInfo}) - ${dateString} ${timeString}`;
            
            container.appendChild(entry);
        });
    }

    // Initialize tower selection UI - make selection consistent with keyboard shortcuts
    document.querySelectorAll('.tower-option').forEach(element => {
        element.addEventListener('click', () => {
            const towerType = element.getAttribute('data-tower');
            
            // Call selectTower method to handle the toggle behavior
            window.ui.selectTower(towerType);
            
        });
    });

    // Initialize power card UI
    document.querySelectorAll('.power-card').forEach(element => {
        element.addEventListener('click', () => {
            const cardType = element.getAttribute('data-card');
            const cost = parseInt(element.getAttribute('data-cost'));
            window.ui.activatePowerCard(cardType, cost);
        });
    });

    // Handle canvas click for placing towers
    canvas.addEventListener('click', (event) => {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Normalize coordinates to canvas space
        const normalizedX = x / canvas.clientWidth;
        const normalizedY = y / canvas.clientHeight;

        window.ui.handleCanvasClick(normalizedX, normalizedY);
    });

});