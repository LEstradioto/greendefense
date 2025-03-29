import { CardCatalog, Deck, CardRarity, CardType } from './cards.js';
import { ElementTypes } from './elements.js';
import { Player } from './player.js';
import { Tower } from './entities/tower.js';

// TCG Integration module - connects TCG systems to the main game
export class TCGIntegration {
    constructor(game) {
        this.game = game;
        this.cardCatalog = new CardCatalog();
        this.player = null;
        this.selectedCard = null;
        this.hand = []; // Cards currently in hand
        this.deckSize = 30; // Standard deck size
        this.maxCardsInHand = 5; // Maximum cards in hand
        this.mana = 8; // Starting mana (increased from 5)
        this.maxMana = 8; // Starting maximum mana (increased from 5)
        this.absoluteMaxMana = 12; // Maximum possible mana cap (increased from 10)
        this.lastManaRegenTime = 0; // Track last mana regeneration time
        this.manaRegenInterval = 15000; // Regenerate mana every 15 seconds
        this.manaRegenAmount = 1; // Amount of mana regenerated
        this.currentTurn = 0;
        
        // Initial state for reset
        this.initialMana = 8;
        this.initialMaxMana = 8;
        
        // Power cards integration
        this.powerCards = [];
        this.powerCardChance = 0.15; // 15% chance to get a power card when drawing
        
        // UI elements for cards
        this.cardContainer = null;
        
        // Initialize the system
        this.initialize();
    }
    
    initialize() {
        // Create the local player
        this.player = new Player('player1', this.game.player.username || 'Player');
        
        // Create a starter deck
        const starterDeck = Deck.createStarterDeck(this.cardCatalog);
        this.player.addDeck(starterDeck);
        
        // Initialize power cards
        this.initializePowerCards();
        
        // Set up UI
        this.createCardUI();
        
        // Initial card draw
        this.drawInitialHand();
        
        // Add window resize listener to update display
        window.addEventListener('resize', () => {
            this.updateManaDisplay();
        });
    }
    
    initializePowerCards() {
        // Create spell-like cards for each power
        this.powerCards = [
            {
                id: 'meteor_power',
                name: 'Meteor Strike',
                type: 'spell',
                rarity: CardRarity.RARE,
                element: ElementTypes.FIRE,
                cost: 0, // Uses gold instead of mana
                goldCost: 100,
                description: 'Rains meteors on all enemies',
                effect: 'meteor',
                duration: 3,
                radius: 5,
                getAdjustedStats: function() {
                    return {
                        effect: this.effect,
                        duration: this.duration,
                        radius: this.radius,
                        element: this.element
                    };
                }
            },
            {
                id: 'freeze_power',
                name: 'Freeze Wave',
                type: 'spell',
                rarity: CardRarity.RARE,
                element: ElementTypes.WATER,
                cost: 0, // Uses gold instead of mana
                goldCost: 80,
                description: 'Freezes all enemies',
                effect: 'freeze',
                duration: 4,
                radius: 5,
                getAdjustedStats: function() {
                    return {
                        effect: this.effect,
                        duration: this.duration,
                        radius: this.radius,
                        element: this.element
                    };
                }
            },
            {
                id: 'gold_power',
                name: 'Gold Rush',
                type: 'spell',
                rarity: CardRarity.UNCOMMON,
                element: ElementTypes.EARTH,
                cost: 0, // No gold cost for this one (free)
                goldCost: 0,
                description: 'Generates extra gold',
                effect: 'gold',
                duration: 1,
                radius: 1,
                getAdjustedStats: function() {
                    return {
                        effect: this.effect,
                        duration: this.duration,
                        radius: this.radius,
                        element: this.element
                    };
                }
            },
            {
                id: 'empower_power',
                name: 'Empower Towers',
                type: 'spell',
                rarity: CardRarity.RARE,
                element: ElementTypes.AIR,
                cost: 0, // Uses gold instead of mana
                goldCost: 120,
                description: 'Empowers all towers',
                effect: 'empower',
                duration: 8,
                radius: 5,
                getAdjustedStats: function() {
                    return {
                        effect: this.effect,
                        duration: this.duration,
                        radius: this.radius,
                        element: this.element
                    };
                }
            }
        ];
    }
    
    createCardUI() {
        // Create card container if it doesn't exist
        if (!document.getElementById('card-container')) {
            // Create a wrapper for cards and mana
            const containerWrapper = document.createElement('div');
            containerWrapper.id = 'card-container-wrapper';
            containerWrapper.style.position = 'fixed';
            containerWrapper.style.bottom = '8px';
            containerWrapper.style.left = '50%';
            containerWrapper.style.transform = 'translateX(-50%)';
            containerWrapper.style.zIndex = '1000';
            containerWrapper.style.overflow = 'visible';
            
            // Create the card container
            this.cardContainer = document.createElement('div');
            this.cardContainer.id = 'card-container';
            this.cardContainer.className = 'card-container';
            
            // Add mana display to the wrapper directly (outside the card container)
            const manaDisplay = document.createElement('div');
            manaDisplay.id = 'mana-display';
            manaDisplay.className = 'mana-display';
            
            // Add elements to the DOM
            containerWrapper.appendChild(manaDisplay);
            containerWrapper.appendChild(this.cardContainer);
            
            // Add wrapper to document
            document.body.appendChild(containerWrapper);
            
            // Add an additional style override to ensure transparency
            const styleOverride = document.createElement('style');
            styleOverride.textContent = `
                #card-container {
                    background-color: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                    overflow-x: auto !important;
                    overflow-y: hidden !important;
                }
                
                #card-container-wrapper {
                    overflow: visible !important;
                }
                
                .mana-display {
                    position: absolute;
                    top: -30px;
                    left: 50%;
                    transform: translateX(-50%);
                }
            `;
            document.head.appendChild(styleOverride);
            
            // Show the mana counter in the game status
            const manaCounter = document.getElementById('mana-counter');
            manaCounter.classList.remove('hidden');
        } else {
            // If container already exists, find it
            this.cardContainer = document.getElementById('card-container');
            
            // If wrapper doesn't exist, check if we need to upgrade the structure
            if (!document.getElementById('card-container-wrapper') && this.cardContainer) {
                // Create wrapper and move existing container into it
                const wrapper = document.createElement('div');
                wrapper.id = 'card-container-wrapper';
                wrapper.style.position = 'fixed';
                wrapper.style.bottom = '8px';
                wrapper.style.left = '50%';
                wrapper.style.transform = 'translateX(-50%)';
                wrapper.style.zIndex = '1000';
                wrapper.style.overflow = 'visible';
                
                // Get existing container's parent
                const parent = this.cardContainer.parentNode;
                
                // Create mana display
                const mana = document.createElement('div');
                mana.id = 'mana-display';
                mana.className = 'mana-display';
                
                // Transfer existing mana display if it exists
                const existingMana = document.getElementById('mana-display');
                if (existingMana && existingMana.parentNode === this.cardContainer) {
                    this.cardContainer.removeChild(existingMana);
                    wrapper.appendChild(existingMana);
                } else {
                    wrapper.appendChild(mana);
                }
                
                // Insert wrapper in DOM
                parent.insertBefore(wrapper, this.cardContainer);
                wrapper.appendChild(this.cardContainer);
            }
        }
        
        // Update mana display
        this.updateManaDisplay();
    }
    
    updateManaDisplay() {
        // Update the card mana display
        const manaDisplay = document.getElementById('mana-display');
        if (manaDisplay) {
            // Use data attributes for the actual values to avoid conflicting with CSS ::before content
            manaDisplay.setAttribute('data-current', this.mana);
            manaDisplay.setAttribute('data-max', this.maxMana);
            
            // On desktop show "Mana: X/Y", on mobile CSS will add the "Mana:" prefix
            if (window.innerWidth > 768) {
                manaDisplay.textContent = `Mana: ${this.mana}/${this.maxMana}`;
            } else {
                manaDisplay.textContent = `${this.mana}/${this.maxMana}`;
            }
            
            // Show regeneration indicator if not at max
            if (this.mana < this.maxMana) {
                // Add regeneration indicator
                if (!manaDisplay.classList.contains('regenerating')) {
                    manaDisplay.classList.add('regenerating');
                }
            } else {
                // Remove regeneration indicator
                manaDisplay.classList.remove('regenerating');
            }
            
            // Using CSS styles from main.css
        }
        
        // Update the header mana display
        const manaAmount = document.getElementById('mana-amount');
        const maxManaAmount = document.getElementById('max-mana-amount');
        
        if (manaAmount && maxManaAmount) {
            // Check for infinite mana in debug mode
            if (this.game.cardDebugMode && document.getElementById('debug-infinite-mana')?.checked) {
                // Show infinity symbol for infinite mana
                manaAmount.textContent = '∞';
                maxManaAmount.textContent = '∞';
                this.mana = this.absoluteMaxMana;
            } else {
                manaAmount.textContent = this.mana;
                maxManaAmount.textContent = this.maxMana;
            }
        }
    }
    
    drawInitialHand() {
        // Reset hand
        this.hand = [];
        
        // Draw 4 cards
        for (let i = 0; i < 4; i++) {
            this.drawCard();
        }
        
        // Update UI
        this.updateCardUI();
    }
    
    drawCard() {
        // Check if hand is full
        if (this.hand.length >= this.maxCardsInHand) {
            console.log('Hand is full, cannot draw more cards');
            return null;
        }
        
        // Get current deck
        const deck = this.player.getCurrentDeck();
        if (!deck) {
            console.log('No deck available');
            return null;
        }
        
        // Chance to draw a power card
        if (Math.random() < this.powerCardChance && this.powerCards.length > 0) {
            // Draw a random power card
            const powerCard = this.powerCards[Math.floor(Math.random() * this.powerCards.length)];
            this.hand.push(powerCard);
            return powerCard;
        }
        
        // For simplicity, just draw a random card from the catalog
        // In a real implementation, this would draw from the player's shuffled deck
        const allCards = this.cardCatalog.getAllCards();
        
        // Prioritize tower cards (70% chance)
        let card;
        const rand = Math.random();
        if (rand < 0.8) {
            // Draw tower card (increased chance to 80%)
            const towerCards = allCards.towers;
            card = towerCards[Math.floor(Math.random() * towerCards.length)];
        } else {
            // Draw spell card (20% chance)
            const spellCards = allCards.spells;
            card = spellCards[Math.floor(Math.random() * spellCards.length)];
        }
        // Enemy cards removed since they're not useful yet
        
        if (card) {
            this.hand.push(card);
            return card;
        }
        
        return null;
    }
    
    updateCardUI() {
        // Clear existing cards
        this.cardContainer.innerHTML = '';
        
        // Add mana display
        const manaDisplay = document.createElement('div');
        manaDisplay.id = 'mana-display';
        manaDisplay.className = 'mana-display';
        // We'll use CSS styles from main.css
        this.cardContainer.appendChild(manaDisplay);
        this.updateManaDisplay();
        
        // Add cards
        for (let i = 0; i < this.hand.length; i++) {
            const card = this.hand[i];
            this.createCardElement(card, i);
        }
    }
    
    createCardElement(card, index) {
        // Create card element
        const cardElement = document.createElement('div');
        cardElement.className = 'card';
        cardElement.dataset.cardIndex = index;
        
        // Check if it's a power card
        const isPowerCard = card.goldCost !== undefined;
        
        // Style based on card type and element
        const borderColor = this.getCardBorderColor(card);
        
        // Style the card
        Object.assign(cardElement.style, {
            width: '80px',
            height: '120px',
            backgroundColor: '#2c3e50',
            borderRadius: '5px',
            border: `2px solid ${borderColor}`,
            display: 'flex',
            flexDirection: 'column',
            padding: '5px',
            cursor: 'pointer',
            transition: 'transform 0.2s, margin 0.3s',
            position: 'relative',
            color: 'white',
            margin: '0 -5px' // Overlap cards slightly when many are present
        });
        
        // In debug mode with many cards, make them more compact
        if (this.game.cardDebugMode) {
            cardElement.style.margin = '0 -25px';
        }
        
        // Card can be played condition
        let canPlay = false;
        
        if (isPowerCard) {
            // For power cards, check if player has enough gold
            canPlay = this.game.player.gold >= card.goldCost;
            // Add a gold border for power cards
            cardElement.style.boxShadow = '0 0 10px gold';
        } else {
            // For regular cards, check if player has enough mana
            canPlay = this.mana >= card.cost;
        }
        
        if (!canPlay) {
            cardElement.style.opacity = '0.6';
            cardElement.style.cursor = 'not-allowed';
        }
        
        // Card name
        const nameElement = document.createElement('div');
        nameElement.className = 'card-name';
        nameElement.textContent = card.name;
        Object.assign(nameElement.style, {
            fontSize: '12px',
            fontWeight: 'bold',
            marginBottom: '2px',
            textAlign: 'center'
        });
        cardElement.appendChild(nameElement);
        
        // Card cost (mana or gold)
        const costElement = document.createElement('div');
        costElement.className = 'card-cost';
        costElement.textContent = isPowerCard ? card.goldCost : card.cost;
        Object.assign(costElement.style, {
            position: 'absolute',
            top: '5px',
            right: '5px',
            backgroundColor: isPowerCard ? '#f1c40f' : '#3498db', // Gold for power cards, blue for mana
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 'bold'
        });
        cardElement.appendChild(costElement);
        
        // Show a small gold icon for power cards
        if (isPowerCard) {
            const goldIcon = document.createElement('div');
            goldIcon.className = 'card-gold-icon';
            goldIcon.textContent = '💰';
            Object.assign(goldIcon.style, {
                position: 'absolute',
                top: '5px',
                left: '5px',
                fontSize: '12px'
            });
            cardElement.appendChild(goldIcon);
        }
        
        // Card stats
        let statsText = '';
        if (card.type === 'tower') {
            statsText = `DMG:${Math.round(card.damage)} SPD:${card.fireRate.toFixed(1)}`;
        } else if (card.type === 'spell') {
            statsText = `Effect:${card.effect}`;
        }
        
        if (statsText) {
            const statsElement = document.createElement('div');
            statsElement.className = 'card-stats';
            statsElement.textContent = statsText;
            Object.assign(statsElement.style, {
                fontSize: '10px',
                marginBottom: '2px'
            });
            cardElement.appendChild(statsElement);
        }
        
        // Card element type
        const elementText = card.element ? (typeof card.element === 'string' ? card.element : card.element[0]) : 'neutral';
        const elementElement = document.createElement('div');
        elementElement.className = 'card-element';
        elementElement.textContent = elementText.charAt(0).toUpperCase() + elementText.slice(1);
        Object.assign(elementElement.style, {
            fontSize: '10px',
            backgroundColor: borderColor,
            borderRadius: '3px',
            padding: '2px 5px',
            marginBottom: '2px',
            textAlign: 'center'
        });
        cardElement.appendChild(elementElement);
        
        // Add click handler
        cardElement.addEventListener('click', () => {
            if (canPlay) {
                this.selectCard(index);
            }
        });
        
        // Hover effect
        cardElement.addEventListener('mouseover', () => {
            if (canPlay) {
                cardElement.style.transform = 'translateY(-10px)';
                cardElement.style.zIndex = '10'; // Bring to front
                
                // In debug mode, increase spacing to see the card better
                if (this.game.cardDebugMode) {
                    cardElement.style.margin = '0 5px';
                }
            }
        });
        
        cardElement.addEventListener('mouseout', () => {
            cardElement.style.transform = 'translateY(0)';
            cardElement.style.zIndex = '1';
            
            // Reset margin in debug mode
            if (this.game.cardDebugMode) {
                cardElement.style.margin = '0 -25px';
            }
        });
        
        // Add to container
        this.cardContainer.appendChild(cardElement);
    }
    
    getCardBorderColor(card) {
        // Get color based on element
        let element = card.element;
        if (Array.isArray(element)) {
            element = element[0]; // Use first element for dual-element cards
        }
        
        switch (element) {
            case ElementTypes.FIRE:
                return '#e74c3c'; // Red
            case ElementTypes.WATER:
                return '#3498db'; // Blue
            case ElementTypes.EARTH:
                return '#27ae60'; // Green
            case ElementTypes.AIR:
                return '#ecf0f1'; // White
            case ElementTypes.SHADOW:
                return '#9b59b6'; // Purple
            default:
                return '#95a5a6'; // Gray for neutral
        }
    }
    
    selectCard(index) {
        const card = this.hand[index];
        if (!card) return;
        
        // Check if card is a power card
        const isPowerCard = card.goldCost !== undefined;
        
        if (isPowerCard) {
            // Check if player has enough gold
            if (this.game.player.gold < card.goldCost) {
                console.log('Not enough gold to play this power card');
                return;
            }
            
            // Handle power card
            this.selectedCard = card;
            console.log(`Selected power card: ${card.name}`);
            
            // Activate power card immediately
            this.activatePowerCard(card);
            return;
        }
        
        // Regular mana-based card
        // Check if player has enough mana
        if (this.mana < card.cost) {
            console.log('Not enough mana to play this card');
            return;
        }
        
        this.selectedCard = card;
        console.log(`Selected card: ${card.name}`);
        
        // Handle card based on type
        switch (card.type) {
            case 'tower':
                // Enable tower placement mode
                this.game.ui.setTowerPlacementMode(true, this.onTowerPlaced.bind(this));
                break;
                
            case 'spell':
                // Cast spell immediately
                this.castSpell(card);
                break;
                
            case 'enemy':
                // In single player, enemy cards can't be played
                if (!this.game.isMultiplayer) {
                    console.log('Enemy cards can only be played in multiplayer mode');
                    this.selectedCard = null;
                    return;
                }
                break;
        }
    }
    
    activatePowerCard(card) {
        // Activate the power card using the existing PowerCards system
        const cardType = card.effect; // meteor, freeze, hero, gold, empower
        const success = this.game.activatePowerCard(cardType, card.goldCost);
        
        if (success) {
            // Remove card from hand
            this.removeCardFromHand(card);
            
            // Update UI
            this.updateCardUI();
        }
        
        // Reset selected card
        this.selectedCard = null;
    }
    
    async onTowerPlaced(success, gridPosition) {
        if (success && this.selectedCard) {
            // Convert tower card to tower entity
            const worldPosition = this.game.map.gridToWorld(gridPosition.x, gridPosition.y);
            
            // Get adjusted stats from card
            const stats = this.selectedCard.getAdjustedStats();
            
            // Create tower with elemental properties
            // Note: We're adapting the existing tower types based on the card's stats
            // In the future, we'll need to create proper mappings between card IDs and tower types
            let towerType = 'arrow'; // Default type
            
            // Map card's element to appropriate tower type more accurately
            // This determines what kind of tower we create based on the card's element and rarity
            if (this.selectedCard.id.includes('fire')) {
                towerType = 'fire_' + (this.selectedCard.rarity === CardRarity.COMMON ? 'basic' : 'advanced');
            } else if (this.selectedCard.id.includes('water')) {
                towerType = 'water_' + (this.selectedCard.rarity === CardRarity.COMMON ? 'basic' : 'advanced');
            } else if (this.selectedCard.id.includes('earth')) {
                towerType = 'earth_' + (this.selectedCard.rarity === CardRarity.COMMON ? 'basic' : 'advanced');
            } else if (this.selectedCard.id.includes('air')) {
                towerType = 'air_' + (this.selectedCard.rarity === CardRarity.COMMON ? 'basic' : 'advanced');
            } else if (this.selectedCard.id.includes('shadow')) {
                towerType = 'shadow_' + (this.selectedCard.rarity === CardRarity.COMMON ? 'basic' : 'advanced');
            } else {
                // Fallback to generic types for non-elemental cards
                towerType = this.selectedCard.rarity === CardRarity.COMMON ? 'arrow' : 'doubleArrow';
            }
            
            // For TCG cards, we need to make sure the player has enough mana to cast
            if (this.mana >= this.selectedCard.cost) {
                // Instead of calling game.placeTower which handles gold costs, we'll place the tower directly
                // This completely bypasses the gold cost mechanism in game.placeTower
                
                // Check if placement is valid
                const canPlace = await this.game.map.canPlaceTower(gridPosition.x, gridPosition.y);
                if (!canPlace) {
                    console.log("Tower placement failed: canPlaceTower returned false");
                    return false;
                }
                
                // Get world position
                const position = this.game.map.gridToWorld(gridPosition.x, gridPosition.y);
                
                // Create tower with appropriate element
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
                
                // Debug gold before TCG tower placement
                const oldGold = this.game.player.gold;
                console.log(`[GOLD DEBUG] TCG tower placement before: Gold=${oldGold}, TowerType=${towerType}, ManaCost=${this.selectedCard.cost}`);
                
                // Create and add tower directly
                const tower = new Tower(this.game, towerType, position, { gridX: gridPosition.x, gridY: gridPosition.y }, element);
                this.game.map.placeTower(gridPosition.x, gridPosition.y);
                this.game.towers.push(tower);
                
                // Debug gold after TCG tower placement
                console.log(`[GOLD DEBUG] TCG tower placement after: Gold=${this.game.player.gold}, Difference=${this.game.player.gold - oldGold}`);
                
                // Mark placement as successful
                const placementSuccess = true;
                
                if (placementSuccess) {
                    // Get the tower that was just placed (it should be the last one in the array)
                    const tower = this.game.towers[this.game.towers.length - 1];
                    
                    // Set tower properties based on card
                    if (tower) {
                        // Make sure element is properly set (might be an array for dual-element cards)
                        if (Array.isArray(this.selectedCard.element)) {
                            tower.element = this.selectedCard.element[0]; // Use primary element
                        } else {
                            tower.element = this.selectedCard.element;
                        }
                        
                        // Apply card stats
                        tower.damage = stats.damage;
                        tower.range = stats.range;
                        tower.fireRate = stats.fireRate;
                        tower.specialAbility = stats.specialAbility;
                        
                        // Apply any element-specific properties
                        tower.setAdditionalStats();
                    }
                    
                    // Deduct mana (gold is already deducted in game.placeTower)
                    this.mana -= this.selectedCard.cost;
                    
                    // Remove card from hand
                    this.removeCardFromHand(this.selectedCard);
                    
                    // Update UI
                    this.updateCardUI();
                    this.updateManaDisplay();
                }
            }
            
            // Reset selected card
            this.selectedCard = null;
        } else {
            // Tower placement failed or canceled
            this.selectedCard = null;
        }
        
        // Exit tower placement mode
        this.game.ui.setTowerPlacementMode(false);
    }
    
    castSpell(card) {
        // Get spell effect details
        const spellStats = card.getAdjustedStats();
        
        // Apply spell effect based on type
        let success = false;
        
        switch (card.effect) {
            case 'damage':
                // Deal damage to all enemies in area
                success = this.castDamageSpell(spellStats);
                break;
                
            case 'freeze':
                // Freeze all enemies
                success = this.castFreezeSpell(spellStats);
                break;
                
            case 'shield':
                // Stone Shield: Apply protective shields to towers
                success = this.castShieldSpell(spellStats);
                break;
                
            case 'haste':
                // Wind Rush: Increase attack speed of towers
                success = this.castHasteSpell(spellStats);
                break;
                
            case 'drain':
                // Void Drain: Weakens enemies and restores mana
                success = this.castDrainSpell(spellStats);
                break;
        }
        
        if (success) {
            // Deduct mana
            this.mana -= card.cost;
            
            // Remove card from hand
            this.removeCardFromHand(card);
            
            // Update UI
            this.updateCardUI();
            this.updateManaDisplay();
        }
        
        // Reset selected card
        this.selectedCard = null;
    }
    
    castDamageSpell(spellStats) {
        // Deal damage to all enemies
        const damage = 20 * this.getRarityMultiplier(spellStats.rarity);
        
        // Apply damage to all enemies
        let hitCount = 0;
        for (const enemy of this.game.enemies) {
            enemy.takeDamage(damage);
            hitCount++;
        }
        
        // Find the best target position for visual effect (center of enemy group)
        const targetPosition = this.findBestMeteorTarget();
        
        // Create visual effect
        const effect = this.game.powerCards.createMeteorEffect(targetPosition, spellStats.element);
        // Add effect to active effects list
        this.game.powerCards.activeEffects.push(effect);
        
        return hitCount > 0;
    }
    
    // Helper method to find the best target position for area spells
    findBestMeteorTarget() {
        const enemies = this.game.enemies;
        
        if (enemies.length === 0) {
            // If no enemies, target the center of the map
            return { x: 0, y: 0.5, z: 0 };
        }
        
        // Simple strategy: target the group with most enemies
        const meteorRadius = 5;
        let bestTarget = null;
        let maxEnemiesHit = 0;
        
        for (const enemy of enemies) {
            let enemiesHit = 0;
            
            // Count how many enemies would be hit if we target this enemy
            for (const otherEnemy of enemies) {
                const distance = this.game.calculateDistance(enemy.position, otherEnemy.position);
                if (distance <= meteorRadius) {
                    enemiesHit++;
                }
            }
            
            if (enemiesHit > maxEnemiesHit) {
                maxEnemiesHit = enemiesHit;
                bestTarget = enemy.position;
            }
        }
        
        return bestTarget || { x: enemies[0].position.x, y: 0.5, z: enemies[0].position.z };
    }
    
    castFreezeSpell(spellStats) {
        // Freeze all enemies
        let hitCount = 0;
        for (const enemy of this.game.enemies) {
            enemy.applyStatusEffect('slow', {
                duration: spellStats.duration,
                speedModifier: 0.3 // 70% slow
            });
            hitCount++;
        }
        
        // Create visual effect
        const effect = this.game.powerCards.createFreezeEffect({ x: 0, y: 0, z: 0 });
        // Add effect to active effects list
        this.game.powerCards.activeEffects.push(effect);
        
        return hitCount > 0;
    }
    
    castShieldSpell(spellStats) {
        // Apply shield effect to towers
        const duration = spellStats.duration || 10; // Default 10 seconds if not specified
        const damageReduction = 0.5; // 50% damage reduction
        
        // Apply shield effect to all towers
        let affectedCount = 0;
        
        for (const tower of this.game.towers) {
            // Apply the effect to the tower
            tower.applyEffect('shield', damageReduction, duration);
            console.log(`Applied shield effect to tower at (${tower.position.x}, ${tower.position.z}) for ${duration} seconds`);
            
            // Visual effect on tower
            if (tower.mesh) {
                const effectPosition = {
                    x: tower.position.x,
                    y: tower.position.y + 0.5,
                    z: tower.position.z
                };
                
                try {
                    const effect = this.game.powerCards.createShieldEffect(effectPosition);
                    if (effect) {
                        this.game.powerCards.activeEffects.push(effect);
                    }
                } catch (err) {
                    console.error("Error creating shield effect:", err);
                }
            }
            affectedCount++;
        }
        
        // Return true if any towers were affected
        return affectedCount > 0;
    }
    
    castHasteSpell(spellStats) {
        // Apply haste effect to towers (increased attack speed)
        const duration = spellStats.duration || 10; // Default 10 seconds if not specified
        const speedMultiplier = 1.5; // 50% faster attacks
        
        // Apply effect to all towers
        let affectedCount = 0;
        
        for (const tower of this.game.towers) {
            // Apply the effect to the tower
            tower.applyEffect('haste', speedMultiplier, duration);
            console.log(`Applied haste effect to tower at (${tower.position.x}, ${tower.position.z}) for ${duration} seconds`);
            
            // Visual effect
            if (tower.mesh) {
                const effectPosition = {
                    x: tower.position.x,
                    y: tower.position.y + 0.5,
                    z: tower.position.z
                };
                
                try {
                    // Create wind effect (Air/Wind effect)
                    // Directly create the effect since createWindEffect might not exist
                    const particleCount = 20;
                    const particles = [];
                    
                    // Create particles manually
                    for (let i = 0; i < particleCount; i++) {
                        const particle = document.createElement('div');
                        particle.className = 'wind-particle';
                        particle.style.width = '5px';
                        particle.style.height = '5px';
                        particle.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
                        particle.style.position = 'absolute';
                        particle.style.borderRadius = '50%';
                        document.body.appendChild(particle);
                        particles.push(particle);
                    }
                    
                    // Add visual animation for wind effect
                    // This is a basic effect that can be enhanced
                    const startTime = performance.now();
                    const duration = 2000; // 2 seconds for animation
                    
                    const animateParticles = () => {
                        const elapsed = performance.now() - startTime;
                        const progress = Math.min(elapsed / duration, 1);
                        
                        if (progress < 1) {
                            particles.forEach(particle => {
                                // Animate particle movement
                                // This is just a simple animation
                                const angle = Math.random() * Math.PI * 2;
                                const distance = Math.random() * 50;
                                particle.style.left = `calc(50% + ${Math.cos(angle) * distance}px)`;
                                particle.style.top = `calc(50% + ${Math.sin(angle) * distance}px)`;
                            });
                            
                            requestAnimationFrame(animateParticles);
                        } else {
                            // Remove particles when animation completes
                            particles.forEach(particle => {
                                document.body.removeChild(particle);
                            });
                        }
                    };
                    
                    requestAnimationFrame(animateParticles);
                } catch (err) {
                    console.error("Error creating wind effect:", err);
                }
            }
            affectedCount++;
        }
        
        // Return true if any towers were affected
        return affectedCount > 0;
    }
    
    castDrainSpell(spellStats) {
        // Apply drain effect to enemies (weakens them) and restore mana
        const duration = spellStats.duration || 10; // Default 10 seconds if not specified
        const weakenAmount = 0.5; // 50% increased damage taken
        const manaRestored = Math.min(3, this.absoluteMaxMana - this.mana); // Restore up to 3 mana
        
        // Apply weaken effect to all enemies
        let affectedCount = 0;
        for (const enemy of this.game.enemies) {
            // Apply weaken status effect to the enemy
            try {
                // Use simpler form to apply weaken effect
            if (typeof enemy.applyStatusEffect === 'function') {
                enemy.applyStatusEffect('weaken', {
                    duration: duration,
                    damageModifier: 1.0 + weakenAmount // Take 50% more damage
                });
            } else if (enemy.health) {
                // Direct damage if no status effect system
                // Take 10% of current health as immediate damage
                const drainDamage = Math.max(1, Math.floor(enemy.health * 0.1)); 
                enemy.takeDamage(drainDamage);
                console.log(`Direct drain damage applied: ${drainDamage} to enemy with ${enemy.health} health`);
            }
                
                console.log(`Applied weaken effect to enemy at (${enemy.position.x}, ${enemy.position.z}) for ${duration} seconds`);
                
                // Create visual effect on each enemy
                const effectPosition = {
                    x: enemy.position.x,
                    y: enemy.position.y + 0.5,
                    z: enemy.position.z
                };
                
                // Create a simple visual effect if the createDrainEffect function doesn't exist
                if (this.game.powerCards.createDrainEffect) {
                    const effect = this.game.powerCards.createDrainEffect(effectPosition);
                    if (effect) {
                        this.game.powerCards.activeEffects.push(effect);
                    }
                } else {
                    // Create a simple visual effect using DOM elements
                    const particle = document.createElement('div');
                    particle.className = 'drain-particle';
                    particle.style.width = '10px';
                    particle.style.height = '10px';
                    particle.style.backgroundColor = 'rgba(128, 0, 128, 0.7)'; // Purple for void/shadow
                    particle.style.position = 'absolute';
                    particle.style.borderRadius = '50%';
                    particle.style.left = '50%';
                    particle.style.top = '50%';
                    document.body.appendChild(particle);
                    
                    // Animate and remove after animation completes
                    setTimeout(() => {
                        document.body.removeChild(particle);
                    }, 2000);
                }
                
                affectedCount++;
            } catch (err) {
                console.error("Error applying weaken effect:", err);
            }
        }
        
        // Restore mana if enemies were affected
        if (affectedCount > 0) {
            this.mana = Math.min(this.absoluteMaxMana, this.mana + manaRestored);
            this.updateManaDisplay();
            console.log(`Restored ${manaRestored} mana from Void Drain`);
            
            
            // Show mana gain UI effect
            const manaGainMessage = document.createElement('div');
            manaGainMessage.className = 'mana-gain-message';
            manaGainMessage.textContent = `+${manaRestored} Mana`;
            document.getElementById('game-container').appendChild(manaGainMessage);
            
            // Animate and remove
            setTimeout(() => {
                manaGainMessage.style.opacity = '0';
                setTimeout(() => manaGainMessage.remove(), 1000);
            }, 1500);
        }
        
        // Return true if any enemies were affected
        return affectedCount > 0;
    }
    
    removeCardFromHand(card) {
        const index = this.hand.indexOf(card);
        if (index !== -1) {
            this.hand.splice(index, 1);
        }
    }
    
    startTurn() {
        this.currentTurn++;
        
        // Increase max mana based on current wave
        this.updateMaxManaByWave();
        
        // Refresh mana (up to max)
        this.mana = this.maxMana;
        
        // Refill hand to maintain 5 cards
        this.refillHand();
        
        // Update UI
        this.updateCardUI();
        
        // Reset mana regeneration timer
        this.lastManaRegenTime = performance.now();
    }
    
    refillHand() {
        // Fill hand back up to max (typically 5 cards)
        const cardsNeeded = this.maxCardsInHand - this.hand.length;
        
        for (let i = 0; i < cardsNeeded; i++) {
            this.drawCard();
        }
        
        console.log(`Refilled hand with ${cardsNeeded} new cards. Hand size: ${this.hand.length}`);
    }
    
    updateMaxManaByWave() {
        const currentWave = this.game.currentWave;
        
        // Set max mana based on current wave - more gradual progression
        switch (currentWave) {
            case 1:
                this.maxMana = 8;
                break;
            case 2:
                this.maxMana = 9;
                break;
            case 3:
                this.maxMana = 10;
                break;
            case 4:
                this.maxMana = 11;
                break;
            case 5:
            case 6:
            default:
                this.maxMana = this.absoluteMaxMana; // 12
                break;
        }
        
        // Also give a small mana bonus for wave completion
        const manaBonus = currentWave; // 1, 2, or 3 mana bonus
        this.mana = Math.min(this.maxMana, this.mana + manaBonus);
    }
    
    reset() {
        // Reset mana to initial values
        this.mana = this.initialMana;
        this.maxMana = this.initialMaxMana;
        
        // Reset turn counter
        this.currentTurn = 0;
        
        // Reset last mana regen time
        this.lastManaRegenTime = 0;
        
        // Reset selected card
        this.selectedCard = null;
        
        // Clear hand
        this.hand = [];
        
        // Reset card UI
        this.updateCardUI();
        
        // Draw a new initial hand
        this.drawInitialHand();
        
        // Update mana display
        this.updateManaDisplay();
    }
    
    getRarityMultiplier(rarity) {
        // Simple multiplier based on rarity
        switch (rarity) {
            case 'common': return 1;
            case 'uncommon': return 1.2;
            case 'rare': return 1.5;
            case 'epic': return 1.8;
            case 'legendary': return 2.2;
            default: return 1;
        }
    }
}