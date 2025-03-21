# Warcraft-Style Tower Defense

A web-based tower defense game inspired by classic Warcraft tower defense maps, built with Three.js. This game features a 3D grid-based environment where players can strategically place towers to defend against waves of enemies.

## Game Features

- Top-down Warcraft-style perspective with 3D graphics
- Three different tower types with unique attack behaviors
- Multiple enemy types with varied health, speed, and abilities
- Grid-based tower placement system
- Path-based enemy movement with advanced pathfinding
- Economy system with gold for defeating enemies and building towers
- Advanced A* pathfinding system with obstacle avoidance
- Power card system with special abilities and effects
- Dynamic visual effects and animations
- Health systems for both enemies and towers

## How to Play

1. Open `index.html` in a modern web browser
2. Enter your username and click "Start Game"
3. Place towers along the path to defend against incoming waves
4. Defeat enemies to earn gold and build more towers
5. Use power cards for special abilities
6. Survive all three waves!

## Controls

- **Left Click**: Place selected tower at mouse position
- **1**: Select Arrow Tower (10 gold)
- **2**: Select Double Arrow Tower (25 gold)
- **3**: Select Cannon Tower (50 gold)
- **ESC**: Cancel tower placement
- **D**: Toggle debug mode (shows pathfinding grid and debug information)

## Game Entities

### Tower Types

| Tower | Cost | Damage | Range | Fire Rate | Description |
|-------|------|--------|-------|-----------|-------------|
| Arrow | 10 | 20 | 3 | 1/s | Basic tower with balanced stats |
| Double Arrow | 25 | 15 | 4 | 2/s | Faster firing with chance of double shot |
| Cannon | 50 | 50 | 2.5 | 0.5/s | High damage with area effect |

### Enemy Types

| Enemy | Health | Speed | Reward | Wave |
|-------|--------|-------|--------|------|
| Simple | 100 | Fast | 10 | 1 |
| Elephant | 250 | Medium | 25 | 2 |
| Pirate | 400 | Slow | 50 | 3 |

### Power Cards

| Card | Cost | Cooldown | Effect |
|------|------|----------|--------|
| Meteor Strike | 100 | 45s | Area damage to enemies |
| Freeze Wave | 80 | 60s | Slows all enemies for 10 seconds |
| Summon Hero | 150 | 90s | Creates a temporary hero unit |
| Gold Rush | 0 | 30s | Gain 50 gold immediately |
| Tower Empowerment | 120 | 75s | Boosts all towers for 15 seconds |

## Technical Architecture

### Core Systems

- **Rendering**: Built with Three.js for 3D graphics
- **Game Loop**: Follows a standard update/render game loop pattern
- **Entity Management**: Component-based system for entities
- **Pathfinding**: Custom A* implementation with obstacle avoidance
- **Grid System**: Map represented as a 2D grid with multiple cell types
- **Event System**: DOM-based event handling for user interaction

### Key Components

- **Game**: Main controller managing game state, entities, and events
- **Map**: Handles grid representation, pathfinding grid, and path rendering
- **Enemy**: Manages enemy behavior, movement, and pathfinding
- **Tower**: Controls tower placement, targeting, and projectile firing
- **Pathfinding**: Custom A* algorithm with multi-path strategy
- **PowerCard**: Power-up system with special abilities and effects
- **Renderer**: Manages Three.js scene, camera, and rendering

### Pathfinding System

The game employs a sophisticated pathfinding system:

- Grid-based A* algorithm for finding optimal paths
- Dynamic obstacle marking with gradient costs
- Multi-step pathfinding with fallback approaches
- Intermediate point calculation when direct paths are blocked
- Path smoothing for more natural enemy movement
- Obstacle avoidance for navigating around towers
- Collision detection to prevent enemies from walking through obstacles

### Technical Performance Considerations

- Optimized rendering with minimal draw calls
- Efficient entity management with pooling
- Path calculation optimizations to minimize CPU usage
- Visual effects that scale based on device performance
- Optimized collision detection with spatial partitioning

## Development

This game uses:
- Three.js for 3D rendering
- Vanilla JavaScript for game logic
- HTML5/CSS3 for UI elements
- Custom pathfinding implementation
- Component-based entity system

## Server Setup

To run the game with a local server:

```bash
# Install dependencies
npm install

# Start the server
node server.js
```

The game will be available at http://localhost:3000

## Future Improvements

- Tower upgrades and progression system
- More enemy and tower types
- Sound effects and background music
- Saving/loading game progress
- Multiplayer mode with cooperative play
- Mobile-friendly controls
- Advanced wave generation system
- More power cards and special abilities
- Enhanced visual effects and animations