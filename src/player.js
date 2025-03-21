import { Deck } from './cards.js';

// Player class for managing player data, inventory, and collection
export class Player {
    constructor(id, username) {
        this.id = id;
        this.username = username;
        this.decks = [];
        this.currentDeckIndex = 0;
        this.collection = []; // Array of card IDs the player owns
        this.gold = 0;
        this.gems = 0; // Premium currency
        this.level = 1;
        this.xp = 0;
        this.stats = {
            wins: 0,
            losses: 0,
            towersPlaced: 0,
            enemiesDefeated: 0,
            spellsCast: 0,
            matchesPlayed: 0
        };
    }

    addDeck(deck) {
        this.decks.push(deck);
        return this.decks.length - 1; // Return the index of the new deck
    }

    setCurrentDeck(index) {
        if (index >= 0 && index < this.decks.length) {
            this.currentDeckIndex = index;
            return true;
        }
        return false;
    }

    getCurrentDeck() {
        return this.decks[this.currentDeckIndex] || null;
    }

    addCardToCollection(cardId) {
        this.collection.push(cardId);
    }

    hasCard(cardId) {
        return this.collection.includes(cardId);
    }

    addXp(amount) {
        this.xp += amount;
        
        // Simple leveling formula: 100 * current level XP to level up
        const xpToNextLevel = 100 * this.level;
        
        if (this.xp >= xpToNextLevel) {
            this.xp -= xpToNextLevel;
            this.level++;
            return true; // Return true if leveled up
        }
        
        return false;
    }

    addGold(amount) {
        this.gold += amount;
    }

    useGold(amount) {
        if (this.gold >= amount) {
            this.gold -= amount;
            return true;
        }
        return false;
    }

    addGems(amount) {
        this.gems += amount;
    }

    useGems(amount) {
        if (this.gems >= amount) {
            this.gems -= amount;
            return true;
        }
        return false;
    }

    updateStat(statName, value) {
        if (this.stats.hasOwnProperty(statName)) {
            this.stats[statName] += value;
        }
    }

    // Create basic serialized data for storage or network transmission
    serialize() {
        return {
            id: this.id,
            username: this.username,
            level: this.level,
            xp: this.xp,
            gold: this.gold,
            gems: this.gems,
            stats: { ...this.stats },
            collection: [...this.collection],
            currentDeckIndex: this.currentDeckIndex,
            decks: this.decks.map(deck => ({
                name: deck.name,
                towerCards: deck.towerCards.map(card => card.id),
                spellCards: deck.spellCards.map(card => card.id),
                enemyCards: deck.enemyCards.map(card => card.id)
            }))
        };
    }

    // Create a player from serialized data
    static deserialize(data, cardCatalog) {
        const player = new Player(data.id, data.username);
        player.level = data.level;
        player.xp = data.xp;
        player.gold = data.gold;
        player.gems = data.gems;
        player.stats = { ...data.stats };
        player.collection = [...data.collection];
        player.currentDeckIndex = data.currentDeckIndex;

        // Reconstruct decks
        data.decks.forEach(deckData => {
            const deck = new Deck(deckData.name);
            
            // Add tower cards
            deckData.towerCards.forEach(cardId => {
                const card = cardCatalog.getCardById(cardId);
                if (card) deck.addCard(card);
            });
            
            // Add spell cards
            deckData.spellCards.forEach(cardId => {
                const card = cardCatalog.getCardById(cardId);
                if (card) deck.addCard(card);
            });
            
            // Add enemy cards
            deckData.enemyCards.forEach(cardId => {
                const card = cardCatalog.getCardById(cardId);
                if (card) deck.addCard(card);
            });
            
            player.addDeck(deck);
        });

        return player;
    }
}
