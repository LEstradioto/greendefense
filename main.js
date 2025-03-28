import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Make THREE and OrbitControls available globally for legacy code
window.THREE = THREE;
window.OrbitControls = OrbitControls;

// Import our game components
import { Game } from './src/game.js';
import { UI } from './src/ui.js';

// Three.js version info removed for production

// Initialize the game when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    window.game = new Game(canvas);
    
    // Create UI and store it in the game
    window.ui = new UI(window.game);
    window.game.ui = window.ui;
    
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
    });
    
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
                console.error('Error checking development mode:', err);
                return false;
            }
        };
        
        // Local dev environment detection (Vite dev server or file://)
        const isLocalDev = window.location.hostname === 'localhost' && window.location.port === '5173' || 
                         window.location.protocol === 'file:';
        
        // Check both methods
        if (isLocalDev) {
            console.log('Debug controls available - local development detected');
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
                        renderScoresList(highScoresList, serverScores, "Server Rankings");
                    } else {
                        // Fallback to localStorage
                        const localScores = JSON.parse(localStorage.getItem('towerDefenseHighScores') || '[]');
                        renderScoresList(highScoresList, localScores, "Local Rankings");
                    }
                })
                .catch(error => {
                    console.error("Error fetching server scores:", error);
                    
                    // Clear loading message
                    highScoresList.innerHTML = '';
                    
                    // Fallback to localStorage
                    const localScores = JSON.parse(localStorage.getItem('towerDefenseHighScores') || '[]');
                    renderScoresList(highScoresList, localScores, "Local Rankings (Server Unavailable)");
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