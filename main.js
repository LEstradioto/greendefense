import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Make THREE and OrbitControls available globally for legacy code
window.THREE = THREE;
window.OrbitControls = OrbitControls;

// Import our game components
import { Game } from './src/game.js';
import { UI } from './src/ui.js';

console.log('Three.js version:', THREE.REVISION);

// Initialize the game when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    window.game = new Game(canvas);
    
    // Create UI and store it in the game
    window.ui = new UI(window.game);
    window.game.ui = window.ui;

    // Setup the start button event listener
    document.getElementById('start-button').addEventListener('click', async () => {
        const username = document.getElementById('username').value || 'Player';
        await window.game.start(username);

        // Try multiple approaches to hide the overlay
        const overlay = document.getElementById('game-overlay');
        console.log('Hiding overlay, current classes:', overlay.className);

        // Method 1: Add hidden class
        overlay.classList.add('hidden');

        // Method 2: Set style directly
        overlay.style.display = 'none';

        console.log('After hiding, classes:', overlay.className);
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
                console.log("Key already down, ignoring repeat");
                return;
            }
            
            // Mark key as down
            keyStates[event.key] = true;
            
            // Check if it's a tower selection key
            if (keyToTowerMap[event.key]) {
                const towerType = keyToTowerMap[event.key];
                console.log(`Key ${event.key} pressed - ${towerType} tower`);
                window.ui.selectTower(towerType);
            }
            // Other key handlers
            else switch(event.key) {
                case 'Escape':
                    console.log("Escape key pressed - canceling tower placement");
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
    document.getElementById('toggle-debug-panel').addEventListener('click', () => {
        const panel = document.getElementById('debug-panel');
        panel.classList.toggle('hidden');
    });
    
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

    // Initialize tower selection UI - make selection consistent with keyboard shortcuts
    document.querySelectorAll('.tower-option').forEach(element => {
        element.addEventListener('click', () => {
            const towerType = element.getAttribute('data-tower');
            
            // Call selectTower method to handle the toggle behavior
            window.ui.selectTower(towerType);
            
            // Log for debugging
            console.log(`Tower option clicked - ${towerType} tower`);
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

    console.log('Game initialization complete');
});