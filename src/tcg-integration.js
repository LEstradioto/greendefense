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
        this.mana = 5; // Starting mana
        this.maxMana = 5; // Starting maximum mana (increases with waves)
        this.absoluteMaxMana = 10; // Maximum possible mana cap
        this.lastManaRegenTime = 0; // Track last mana regeneration time
        this.manaRegenInterval = 15000; // Regenerate mana every 15 seconds
        this.manaRegenAmount = 1; // Amount of mana regenerated
        this.currentTurn = 0;
        
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
                id: 'hero_power',
                name: 'Summon Hero',
                type: 'spell',
                rarity: CardRarity.EPIC,
                element: ElementTypes.SHADOW,
                cost: 0, // Uses gold instead of mana
                goldCost: 150,
                description: 'Summons a powerful hero to fight',
                effect: 'hero',
                duration: 10,
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
            // Create the card container
            this.cardContainer = document.createElement('div');
            this.cardContainer.id = 'card-container';
            this.cardContainer.className = 'card-container';
            
            // Style the container
            Object.assign(this.cardContainer.style, {
                position: 'fixed',
                bottom: '10px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '10px',
                padding: '10px',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                borderRadius: '10px',
                zIndex: '1000'
            });
            
            // Add mana display
            const manaDisplay = document.createElement('div');
            manaDisplay.id = 'mana-display';
            manaDisplay.className = 'mana-display';
            Object.assign(manaDisplay.style, {
                position: 'absolute',
                top: '-30px',
                left: '0',
                color: '#3498db',
                fontWeight: 'bold',
                fontSize: '18px'
            });
            this.cardContainer.appendChild(manaDisplay);
            
            // Add to document
            document.body.appendChild(this.cardContainer);
        } else {
            this.cardContainer = document.getElementById('card-container');
        }
        
        // Update mana display
        this.updateManaDisplay();
    }
    
    updateManaDisplay() {
        const manaDisplay = document.getElementById('mana-display');
        if (manaDisplay) {
            manaDisplay.textContent = `Mana: ${this.mana}/${this.maxMana}`;
            
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
        if (rand < 0.7) {
            // Draw tower card
            const towerCards = allCards.towers;
            card = towerCards[Math.floor(Math.random() * towerCards.length)];
        } else if (rand < 0.9) {
            // Draw spell card (20% chance)
            const spellCards = allCards.spells;
            card = spellCards[Math.floor(Math.random() * spellCards.length)];
        } else {
            // Draw enemy card (10% chance - only useful in multiplayer)
            const enemyCards = allCards.enemies;
            card = enemyCards[Math.floor(Math.random() * enemyCards.length)];
        }
        
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
        Object.assign(manaDisplay.style, {
            position: 'absolute',
            top: '-30px',
            left: '0',
            color: '#3498db',
            fontWeight: 'bold',
            fontSize: '18px'
        });
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
            transition: 'transform 0.2s',
            position: 'relative',
            color: 'white'
        });
        
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
            }
        });
        
        cardElement.addEventListener('mouseout', () => {
            cardElement.style.transform = 'translateY(0)';
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
    
    onTowerPlaced(success, gridPosition) {
        if (success && this.selectedCard) {
            // Convert tower card to tower entity
            const worldPosition = this.game.map.gridToWorld(gridPosition.x, gridPosition.y);
            
            // Get adjusted stats from card
            const stats = this.selectedCard.getAdjustedStats();
            
            // Create tower with elemental properties
            // Note: We're adapting the existing tower types based on the card's stats
            // In the future, we'll need to create proper mappings between card IDs and tower types
            let towerType = 'arrow'; // Default type
            
            // Map card's element to appropriate tower type
            if (this.selectedCard.id.includes('fire')) {
                towerType = 'cannon'; // Fire-based towers are more like cannons
            } else if (this.selectedCard.id.includes('air')) {
                towerType = 'doubleArrow'; // Air-based towers are like double arrows
            }
            
            // Place tower through the game's API
            const placementSuccess = this.game.placeTower(towerType, gridPosition.x, gridPosition.y);
            
            if (placementSuccess) {
                // Get the tower that was just placed (it should be the last one in the array)
                const tower = this.game.towers[this.game.towers.length - 1];
                
                // Set tower properties based on card
                if (tower) {
                    tower.element = this.selectedCard.element;
                    tower.damage = stats.damage;
                    tower.range = stats.range;
                    tower.fireRate = stats.fireRate;
                    tower.specialAbility = stats.specialAbility;
                }
                
                // Deduct mana
                this.mana -= this.selectedCard.cost;
                
                // Remove card from hand
                this.removeCardFromHand(this.selectedCard);
                
                // Update UI
                this.updateCardUI();
                this.updateManaDisplay();
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
                
            // Add more spell types as needed
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
        
        // Create visual effect - for now, use existing effect system
        this.game.powerCards.createMeteorEffect({ x: 0, y: 0, z: 0 }, spellStats.element);
        
        return hitCount > 0;
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
        
        // Create visual effect - for now, use existing effect system
        this.game.powerCards.createFreezeEffect({ x: 0, y: 0, z: 0 });
        
        return hitCount > 0;
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
        
        // Draw a card
        this.drawCard();
        
        // Update UI
        this.updateCardUI();
        
        // Reset mana regeneration timer
        this.lastManaRegenTime = performance.now();
    }
    
    updateMaxManaByWave() {
        const currentWave = this.game.currentWave;
        
        // Set max mana based on current wave
        switch (currentWave) {
            case 1:
                this.maxMana = 5;
                break;
            case 2:
                this.maxMana = 7;
                break;
            case 3:
            default:
                this.maxMana = this.absoluteMaxMana; // 10
                break;
        }
        
        // Also give a small mana bonus for wave completion
        const manaBonus = currentWave; // 1, 2, or 3 mana bonus
        this.mana = Math.min(this.maxMana, this.mana + manaBonus);
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