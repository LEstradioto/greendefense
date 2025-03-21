import { ElementTypes, ElementStyles, ElementEffects } from './elements.js';

// Card rarity definitions
export const CardRarity = {
    COMMON: 'common',
    UNCOMMON: 'uncommon',
    RARE: 'rare',
    EPIC: 'epic',
    LEGENDARY: 'legendary'
};

// Card type definitions
export const CardType = {
    TOWER: 'tower',
    SPELL: 'spell',
    ENEMY: 'enemy'
};

// Base card class
export class Card {
    constructor(id, name, type, rarity, element, cost, description) {
        this.id = id;
        this.name = name;
        this.type = type; // tower, spell, enemy
        this.rarity = rarity;
        this.element = element;
        this.cost = cost; // gold cost to play
        this.description = description;
        this.imageUrl = `/assets/cards/${type}/${id}.png`; // Path to card image
    }

    // Get visual styles based on element type
    getElementStyles() {
        return ElementStyles[this.element] || ElementStyles[ElementTypes.NEUTRAL];
    }

    // Get element effect
    getElementEffect() {
        return ElementEffects[this.element] || null;
    }

    // Get rarity multiplier for stats
    getRarityMultiplier() {
        switch (this.rarity) {
            case CardRarity.COMMON: return 1.0;
            case CardRarity.UNCOMMON: return 1.2;
            case CardRarity.RARE: return 1.4;
            case CardRarity.EPIC: return 1.7;
            case CardRarity.LEGENDARY: return 2.0;
            default: return 1.0;
        }
    }
}

// Tower card class
export class TowerCard extends Card {
    constructor(id, name, rarity, element, cost, description, damage, range, fireRate, specialAbility) {
        super(id, name, CardType.TOWER, rarity, element, cost, description);
        
        // Base stats
        this.damage = damage;
        this.range = range;
        this.fireRate = fireRate; // attacks per second
        
        // Special ability if any
        this.specialAbility = specialAbility;
    }

    // Get adjusted stats based on rarity
    getAdjustedStats() {
        const multiplier = this.getRarityMultiplier();
        return {
            damage: this.damage * multiplier,
            range: this.range,
            fireRate: this.fireRate * Math.sqrt(multiplier), // Smaller increase for attack speed
            element: this.element,
            specialAbility: this.specialAbility
        };
    }
}

// Spell card class
export class SpellCard extends Card {
    constructor(id, name, rarity, element, cost, description, effect, duration, radius) {
        super(id, name, CardType.SPELL, rarity, element, cost, description);
        
        // Spell properties
        this.effect = effect;
        this.duration = duration;
        this.radius = radius;
    }

    // Get adjusted stats based on rarity
    getAdjustedStats() {
        const multiplier = this.getRarityMultiplier();
        return {
            effect: this.effect,
            duration: this.duration * multiplier,
            radius: this.radius,
            element: this.element
        };
    }
}

// Enemy card class (for multiplayer - one player sends enemies)
export class EnemyCard extends Card {
    constructor(id, name, rarity, element, cost, description, health, speed, reward) {
        super(id, name, CardType.ENEMY, rarity, element, cost, description);
        
        // Enemy properties
        this.health = health;
        this.speed = speed;
        this.reward = reward; // Gold reward when defeated
    }

    // Get adjusted stats based on rarity
    getAdjustedStats() {
        const multiplier = this.getRarityMultiplier();
        return {
            health: this.health * multiplier,
            speed: this.speed,
            reward: Math.ceil(this.reward * multiplier),
            element: this.element
        };
    }
}

// Card catalog - all available cards in the game
export class CardCatalog {
    constructor() {
        this.towers = {};
        this.spells = {};
        this.enemies = {};
        this.initializeCards();
    }

    initializeCards() {
        // Initialize with default cards
        this.initializeTowerCards();
        this.initializeSpellCards();
        this.initializeEnemyCards();
    }

    initializeTowerCards() {
        // Add tower cards for each element
        
        // FIRE TOWERS
        this.addTower(
            'fire_basic',
            'Flame Thrower',
            CardRarity.COMMON,
            ElementTypes.FIRE,
            2, // Lower cost for basic towers (was 10)
            'Basic fire tower that deals burn damage',
            10, // damage
            2,  // range
            1.0, // fire rate
            'Has a 20% chance to apply burn effect'
        );

        this.addTower(
            'fire_advanced',
            'Inferno Cannon',
            CardRarity.UNCOMMON,
            ElementTypes.FIRE,
            4, // Lowered cost (was 25)
            'Advanced fire tower with area damage',
            15, // damage
            2.5,  // range
            0.8, // fire rate
            'Attacks hit all enemies in a small radius'
        );

        // WATER TOWERS
        this.addTower(
            'water_basic',
            'Frost Shooter',
            CardRarity.COMMON,
            ElementTypes.WATER,
            2, // Lowered cost (was 10)
            'Basic water tower that slows enemies',
            8, // damage
            2,  // range
            1.1, // fire rate
            'Has a 30% chance to slow enemies'
        );

        this.addTower(
            'water_advanced',
            'Tidal Cannon',
            CardRarity.UNCOMMON,
            ElementTypes.WATER,
            4, // Lowered cost (was 25)
            'Advanced water tower with chain attacks',
            12, // damage
            2.3,  // range
            0.9, // fire rate
            'Attacks can chain to an additional enemy'
        );

        // EARTH TOWERS
        this.addTower(
            'earth_basic',
            'Stone Launcher',
            CardRarity.COMMON,
            ElementTypes.EARTH,
            3, // Lowered cost (was 10)
            'Basic earth tower with high damage',
            12, // damage
            1.8,  // range
            0.8, // fire rate
            'Provides small armor buff to nearby towers'
        );

        this.addTower(
            'earth_advanced',
            'Mountain Catapult',
            CardRarity.UNCOMMON,
            ElementTypes.EARTH,
            5, // Lowered cost (was 25)
            'Advanced earth tower with resource generation',
            18, // damage
            2,  // range
            0.7, // fire rate
            'Generates 1 gold every 10 seconds'
        );

        // AIR TOWERS
        this.addTower(
            'air_basic',
            'Wind Shooter',
            CardRarity.COMMON,
            ElementTypes.AIR,
            2, // Lowered cost (was 10)
            'Basic air tower with fast attacks',
            6, // damage
            2.2,  // range
            1.5, // fire rate
            'Has a 15% chance for critical hits (2x damage)'
        );

        this.addTower(
            'air_advanced',
            'Cyclone Blaster',
            CardRarity.UNCOMMON,
            ElementTypes.AIR,
            4, // Lowered cost (was 25)
            'Advanced air tower with evasion aura',
            10, // damage
            2.5,  // range
            1.8, // fire rate
            'Nearby towers have 10% evasion chance'
        );

        // SHADOW TOWERS
        this.addTower(
            'shadow_basic',
            'Dark Bolt Shooter',
            CardRarity.COMMON,
            ElementTypes.SHADOW,
            3, // Lowered cost (was 10)
            'Basic shadow tower with debuff effects',
            9, // damage
            2.2,  // range
            1.0, // fire rate
            'Has a 20% chance to weaken enemies'
        );

        this.addTower(
            'shadow_advanced',
            'Void Cannon',
            CardRarity.UNCOMMON,
            ElementTypes.SHADOW,
            5, // Lowered cost (was 25)
            'Advanced shadow tower with drain effects',
            14, // damage
            2.3,  // range
            0.9, // fire rate
            'Recovers 10% of damage dealt as player health'
        );

        // Rare dual-element towers (one for each combination)
        this.addTower(
            'fire_water',
            'Steam Generator',
            CardRarity.RARE,
            [ElementTypes.FIRE, ElementTypes.WATER],
            7, // Lowered cost (was 50)
            'Dual fire/water tower with steam attacks',
            20, // damage
            2.5,  // range
            1.0, // fire rate
            'Attacks apply both burn and slow effects'
        );

        // Add more towers as needed...
    }

    initializeSpellCards() {
        // Basic element spells
        this.addSpell(
            'fire_wave',
            'Fire Wave',
            CardRarity.COMMON,
            ElementTypes.FIRE,
            4, // Lowered cost (was 30)
            'Sends a wave of fire across the map',
            'damage',
            2, // duration
            3  // radius
        );

        this.addSpell(
            'water_freeze',
            'Frost Nova',
            CardRarity.COMMON,
            ElementTypes.WATER,
            3, // Lowered cost (was 25)
            'Freezes enemies in an area',
            'freeze',
            3, // duration
            2.5  // radius
        );
        
        // Add Earth spell
        this.addSpell(
            'earth_shield',
            'Stone Shield',
            CardRarity.UNCOMMON,
            ElementTypes.EARTH,
            5,
            'Creates protective shields around towers',
            'shield',
            5, // duration
            2.5  // radius
        );
        
        // Add Air spell
        this.addSpell(
            'air_haste',
            'Wind Rush',
            CardRarity.UNCOMMON,
            ElementTypes.AIR,
            4,
            'Increases attack speed of all towers',
            'haste',
            4, // duration
            3  // radius
        );
        
        // Add Shadow spell
        this.addSpell(
            'shadow_drain',
            'Void Drain',
            CardRarity.RARE,
            ElementTypes.SHADOW,
            6,
            'Weakens all enemies and restores mana',
            'drain',
            3, // duration
            4  // radius
        );

        // Add more spells as needed...
    }

    initializeEnemyCards() {
        // Basic element enemies
        this.addEnemy(
            'fire_imp',
            'Fire Imp',
            CardRarity.COMMON,
            ElementTypes.FIRE,
            2, // Lowered cost (was 15)
            'Basic fire enemy with fast movement',
            10, // health
            2.0, // speed
            5   // reward
        );

        this.addEnemy(
            'water_elemental',
            'Water Elemental',
            CardRarity.COMMON,
            ElementTypes.WATER,
            3, // Lowered cost (was 20)
            'Water enemy with high health',
            25, // health
            0.8, // speed
            8   // reward
        );
        
        // Add Earth enemy
        this.addEnemy(
            'earth_golem',
            'Earth Golem',
            CardRarity.UNCOMMON,
            ElementTypes.EARTH,
            5,
            'Slow but extremely tough earth enemy',
            40, // health
            0.6, // speed
            12   // reward
        );
        
        // Add Air enemy
        this.addEnemy(
            'air_wisp',
            'Air Wisp',
            CardRarity.UNCOMMON, 
            ElementTypes.AIR,
            4,
            'Very fast but fragile air enemy',
            8, // health
            2.5, // speed
            10   // reward
        );
        
        // Add Shadow enemy
        this.addEnemy(
            'shadow_wraith',
            'Shadow Wraith',
            CardRarity.RARE,
            ElementTypes.SHADOW,
            6,
            'Powerful shadow enemy that drains tower energy',
            30, // health
            1.2, // speed
            15   // reward
        );

        // Add more enemies as needed...
    }

    addTower(id, name, rarity, element, cost, description, damage, range, fireRate, specialAbility) {
        const tower = new TowerCard(id, name, rarity, element, cost, description, damage, range, fireRate, specialAbility);
        this.towers[id] = tower;
        return tower;
    }

    addSpell(id, name, rarity, element, cost, description, effect, duration, radius) {
        const spell = new SpellCard(id, name, rarity, element, cost, description, effect, duration, radius);
        this.spells[id] = spell;
        return spell;
    }

    addEnemy(id, name, rarity, element, cost, description, health, speed, reward) {
        const enemy = new EnemyCard(id, name, rarity, element, cost, description, health, speed, reward);
        this.enemies[id] = enemy;
        return enemy;
    }

    getAllCards() {
        return {
            towers: Object.values(this.towers),
            spells: Object.values(this.spells),
            enemies: Object.values(this.enemies)
        };
    }

    getCardById(id) {
        return this.towers[id] || this.spells[id] || this.enemies[id] || null;
    }
}

// Player's deck of cards
export class Deck {
    constructor(name = 'Default Deck') {
        this.name = name;
        this.towerCards = [];
        this.spellCards = [];
        this.enemyCards = [];
        this.maxCards = 30; // Maximum deck size
    }

    addCard(card) {
        if (this.getTotalCards() >= this.maxCards) {
            console.warn('Deck is full, cannot add more cards');
            return false;
        }

        switch (card.type) {
            case CardType.TOWER:
                this.towerCards.push(card);
                break;
            case CardType.SPELL:
                this.spellCards.push(card);
                break;
            case CardType.ENEMY:
                this.enemyCards.push(card);
                break;
            default:
                console.warn('Unknown card type');
                return false;
        }

        return true;
    }

    removeCard(cardId, type) {
        let cardArray;
        switch (type) {
            case CardType.TOWER:
                cardArray = this.towerCards;
                break;
            case CardType.SPELL:
                cardArray = this.spellCards;
                break;
            case CardType.ENEMY:
                cardArray = this.enemyCards;
                break;
            default:
                return false;
        }

        const index = cardArray.findIndex(card => card.id === cardId);
        if (index !== -1) {
            cardArray.splice(index, 1);
            return true;
        }
        return false;
    }

    getTotalCards() {
        return this.towerCards.length + this.spellCards.length + this.enemyCards.length;
    }

    shuffle() {
        // Fisher-Yates shuffle algorithm
        const shuffle = array => {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        };

        this.towerCards = shuffle(this.towerCards);
        this.spellCards = shuffle(this.spellCards);
        this.enemyCards = shuffle(this.enemyCards);
    }

    // Create a starter deck with some basic cards
    static createStarterDeck(catalog) {
        const deck = new Deck('Starter Deck');
        
        // Add some basic towers
        deck.addCard(catalog.getCardById('fire_basic'));
        deck.addCard(catalog.getCardById('water_basic'));
        deck.addCard(catalog.getCardById('earth_basic'));
        deck.addCard(catalog.getCardById('air_basic'));
        deck.addCard(catalog.getCardById('shadow_basic'));
        
        // Add some basic spells
        deck.addCard(catalog.getCardById('fire_wave'));
        deck.addCard(catalog.getCardById('water_freeze'));
        
        // Add some basic enemies for multiplayer
        deck.addCard(catalog.getCardById('fire_imp'));
        deck.addCard(catalog.getCardById('water_elemental'));
        
        return deck;
    }
}
