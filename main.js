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
    window.ui = new UI(window.game);

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

    // Setup the restart button event listener
    document.getElementById('restart-button').addEventListener('click', () => {
        location.reload(); // Simple restart by reloading the page
    });

    // Setup keyboard controls
    window.addEventListener('keydown', (event) => {
        switch(event.key) {
            case '1':
                window.ui.selectTower('arrow');
                break;
            case '2':
                window.ui.selectTower('doubleArrow');
                break;
            case '3':
                window.ui.selectTower('cannon');
                break;
            case 'Escape':
                window.ui.cancelTowerPlacement();
                break;
            case 'd':
            case 'D':
                window.game.toggleDebugMode();
                break;
        }
    });

    // Initialize tower selection UI
    document.querySelectorAll('.tower-option').forEach(element => {
        element.addEventListener('click', () => {
            const towerType = element.getAttribute('data-tower');
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

    console.log('Game initialization complete');
});