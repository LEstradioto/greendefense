// Basic multiplayer framework for tower defense TCG

import { Player } from './player.js';
import { CardCatalog, Deck } from './cards.js';
import { ElementTypes } from './elements.js';

// Match states
export const MatchState = {
    WAITING: 'waiting',
    READY: 'ready',
    PLAYING: 'playing',
    FINISHED: 'finished'
};

// Game modes
export const GameMode = {
    DUEL: 'duel', // 1v1 - one builds towers, one sends enemies
    COOPERATIVE: 'cooperative', // 2 players vs AI
    TEAM: 'team' // 2v2 - team-based play
};

// Player roles in a duel mode
export const PlayerRole = {
    DEFENDER: 'defender', // Places towers
    ATTACKER: 'attacker' // Sends enemies
};

// Match class to manage a multiplayer game session
export class Match {
    constructor(id, mode = GameMode.DUEL) {
        this.id = id;
        this.mode = mode;
        this.players = [];
        this.state = MatchState.WAITING;
        this.currentTurn = 0;
        this.maxTurns = 10; // Number of turns before switching roles in duel mode
        this.startTime = null;
        this.endTime = null;
        this.winner = null;
        
        // Game state
        this.gameState = {
            turn: 0,
            phase: 'setup', // setup, action, end
            activePlayerIndex: 0,
            logs: []
        };
    }

    addPlayer(player) {
        if (this.players.length < this.getMaxPlayers()) {
            // For duel mode, assign roles
            if (this.mode === GameMode.DUEL) {
                const role = this.players.length === 0 ? 
                    PlayerRole.DEFENDER : PlayerRole.ATTACKER;
                
                this.players.push({
                    player: player,
                    role: role,
                    ready: false,
                    hand: [], // Cards in hand
                    mana: 10, // Resource for playing cards
                    health: 20 // Player health
                });
            } else {
                this.players.push({
                    player: player,
                    ready: false,
                    hand: [],
                    mana: 10,
                    health: 20
                });
            }
            
            // Check if match is ready to start
            if (this.players.length === this.getMaxPlayers()) {
                this.state = MatchState.READY;
            }
            
            return true;
        }
        return false;
    }

    getMaxPlayers() {
        switch (this.mode) {
            case GameMode.DUEL: return 2;
            case GameMode.COOPERATIVE: return 2;
            case GameMode.TEAM: return 4;
            default: return 2;
        }
    }

    setPlayerReady(playerId) {
        const playerIndex = this.players.findIndex(p => p.player.id === playerId);
        if (playerIndex !== -1) {
            this.players[playerIndex].ready = true;
            
            // Check if all players are ready
            const allReady = this.players.every(p => p.ready);
            if (allReady && this.state === MatchState.READY) {
                this.startMatch();
            }
            
            return true;
        }
        return false;
    }

    startMatch() {
        this.state = MatchState.PLAYING;
        this.startTime = Date.now();
        this.currentTurn = 1;
        this.gameState.turn = 1;
        this.gameState.phase = 'setup';
        this.gameState.activePlayerIndex = 0;
        
        // Deal initial cards to players
        this.players.forEach(player => {
            this.dealCards(player, 5);
        });
        
        // Log start of match
        this.addLogEntry('Match started');
    }

    dealCards(playerObj, count) {
        const deck = playerObj.player.getCurrentDeck();
        if (!deck) return;
        
        // Simple implementation - just take the first cards from each type
        // In a real implementation, this would draw random cards from shuffled deck
        for (let i = 0; i < count; i++) {
            if (playerObj.role === PlayerRole.DEFENDER && deck.towerCards.length > 0) {
                playerObj.hand.push(deck.towerCards[i % deck.towerCards.length]);
            } else if (playerObj.role === PlayerRole.ATTACKER && deck.enemyCards.length > 0) {
                playerObj.hand.push(deck.enemyCards[i % deck.enemyCards.length]);
            }
            
            // Both roles can use spell cards
            if (deck.spellCards.length > 0 && i % 3 === 0) {
                playerObj.hand.push(deck.spellCards[i % deck.spellCards.length]);
            }
        }
    }

    playCard(playerId, cardId, targetPosition) {
        const playerIndex = this.players.findIndex(p => p.player.id === playerId);
        if (playerIndex === -1 || playerIndex !== this.gameState.activePlayerIndex) {
            return { success: false, message: 'Not your turn' };
        }
        
        const playerObj = this.players[playerIndex];
        const cardIndex = playerObj.hand.findIndex(card => card.id === cardId);
        
        if (cardIndex === -1) {
            return { success: false, message: 'Card not in hand' };
        }
        
        const card = playerObj.hand[cardIndex];
        
        // Check if player has enough mana
        if (playerObj.mana < card.cost) {
            return { success: false, message: 'Not enough mana' };
        }
        
        // Handle card play based on type
        let result;
        switch (card.type) {
            case 'tower':
                if (playerObj.role !== PlayerRole.DEFENDER) {
                    return { success: false, message: 'Only defenders can place towers' };
                }
                result = this.placeTower(playerObj, card, targetPosition);
                break;
            case 'enemy':
                if (playerObj.role !== PlayerRole.ATTACKER) {
                    return { success: false, message: 'Only attackers can send enemies' };
                }
                result = this.spawnEnemy(playerObj, card);
                break;
            case 'spell':
                result = this.castSpell(playerObj, card, targetPosition);
                break;
            default:
                return { success: false, message: 'Unknown card type' };
        }
        
        if (result.success) {
            // Remove card from hand
            playerObj.hand.splice(cardIndex, 1);
            
            // Deduct mana
            playerObj.mana -= card.cost;
            
            // Add log entry
            this.addLogEntry(`${playerObj.player.username} played ${card.name}`);
        }
        
        return result;
    }

    placeTower(playerObj, card, position) {
        // In a real implementation, this would interact with the game state
        // to place the tower on the map
        
        // For now, just return success
        return { 
            success: true, 
            message: 'Tower placed',
            data: {
                towerId: `tower_${Date.now()}`, // Generate unique ID
                position: position,
                stats: card.getAdjustedStats()
            }
        };
    }

    spawnEnemy(playerObj, card) {
        // In a real implementation, this would spawn an enemy for the opponent
        
        // For now, just return success
        return { 
            success: true, 
            message: 'Enemy spawned',
            data: {
                enemyId: `enemy_${Date.now()}`, // Generate unique ID
                stats: card.getAdjustedStats()
            }
        };
    }

    castSpell(playerObj, card, target) {
        // In a real implementation, this would apply the spell effect
        
        // For now, just return success
        return { 
            success: true, 
            message: 'Spell cast',
            data: {
                spellId: `spell_${Date.now()}`, // Generate unique ID
                target: target,
                stats: card.getAdjustedStats()
            }
        };
    }

    endTurn(playerId) {
        const playerIndex = this.players.findIndex(p => p.player.id === playerId);
        if (playerIndex === -1 || playerIndex !== this.gameState.activePlayerIndex) {
            return false;
        }
        
        // Move to next player
        this.gameState.activePlayerIndex = (this.gameState.activePlayerIndex + 1) % this.players.length;
        
        // If back to first player, advance turn
        if (this.gameState.activePlayerIndex === 0) {
            this.gameState.turn++;
            this.currentTurn++;
            
            // Replenish mana for all players
            this.players.forEach(player => {
                player.mana = 10; // Base mana + turn number
            });
            
            // Deal a new card to each player
            this.players.forEach(player => {
                this.dealCards(player, 1);
            });
            
            // Check if it's time to switch roles in duel mode
            if (this.mode === GameMode.DUEL && this.currentTurn > this.maxTurns) {
                this.switchRoles();
            }
            
            // Check if game should end
            if (this.checkGameEnd()) {
                this.endMatch();
            }
        }
        
        this.addLogEntry(`Turn ended. Now ${this.players[this.gameState.activePlayerIndex].player.username}'s turn`);
        return true;
    }

    switchRoles() {
        if (this.mode === GameMode.DUEL) {
            // Switch player roles
            this.players.forEach(player => {
                player.role = player.role === PlayerRole.DEFENDER ? 
                    PlayerRole.ATTACKER : PlayerRole.DEFENDER;
            });
            
            // Reset turn counter
            this.currentTurn = 1;
            
            // Clear hands and deal new cards
            this.players.forEach(player => {
                player.hand = [];
                this.dealCards(player, 5);
            });
            
            this.addLogEntry('Roles switched! Defenders are now Attackers and vice versa.');
        }
    }

    checkGameEnd() {
        // Check if any player has lost all health
        const defeatedPlayer = this.players.find(p => p.health <= 0);
        if (defeatedPlayer) {
            // The other player wins
            this.winner = this.players.find(p => p !== defeatedPlayer).player.id;
            return true;
        }
        
        // Check if maximum turns reached (draw)
        if (this.gameState.turn >= 20) {
            // Determine winner based on remaining health
            this.players.sort((a, b) => b.health - a.health);
            if (this.players[0].health > this.players[1].health) {
                this.winner = this.players[0].player.id;
            } else {
                // It's a draw
                this.winner = null;
            }
            return true;
        }
        
        return false;
    }

    endMatch() {
        this.state = MatchState.FINISHED;
        this.endTime = Date.now();
        
        // Update player stats
        this.players.forEach(playerObj => {
            playerObj.player.updateStat('matchesPlayed', 1);
            
            if (this.winner === playerObj.player.id) {
                playerObj.player.updateStat('wins', 1);
                // Award XP and gold for winning
                playerObj.player.addXp(100);
                playerObj.player.addGold(50);
            } else if (this.winner !== null) {
                playerObj.player.updateStat('losses', 1);
                // Award smaller XP and gold for participating
                playerObj.player.addXp(50);
                playerObj.player.addGold(20);
            } else {
                // Draw
                playerObj.player.addXp(75);
                playerObj.player.addGold(30);
            }
        });
        
        this.addLogEntry('Match ended');
    }

    addLogEntry(message) {
        const timestamp = new Date().toISOString();
        this.gameState.logs.push({ 
            timestamp: timestamp, 
            message: message 
        });
    }

    getState() {
        return {
            id: this.id,
            mode: this.mode,
            state: this.state,
            players: this.players.map(p => ({
                id: p.player.id,
                username: p.player.username,
                role: p.role,
                ready: p.ready,
                handSize: p.hand.length,
                mana: p.mana,
                health: p.health
            })),
            currentTurn: this.currentTurn,
            gameState: this.gameState,
            winner: this.winner
        };
    }
}

// Matchmaking service
export class MatchmakingService {
    constructor() {
        this.matches = {};
        this.queuedPlayers = [];
        this.cardCatalog = new CardCatalog();
    }

    createMatch(mode = GameMode.DUEL) {
        const id = `match_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const match = new Match(id, mode);
        this.matches[id] = match;
        return match;
    }

    getMatch(id) {
        return this.matches[id] || null;
    }

    getAllMatches() {
        return Object.values(this.matches);
    }

    addPlayerToQueue(player) {
        // Check if player is already in queue
        if (this.queuedPlayers.find(p => p.id === player.id)) {
            return null;
        }
        
        this.queuedPlayers.push(player);
        
        // Try to match players
        return this.matchPlayers();
    }

    removePlayerFromQueue(playerId) {
        const index = this.queuedPlayers.findIndex(p => p.id === playerId);
        if (index !== -1) {
            this.queuedPlayers.splice(index, 1);
            return true;
        }
        return false;
    }

    matchPlayers() {
        // Simple matchmaking - just pair the first two players in queue
        if (this.queuedPlayers.length >= 2) {
            const player1 = this.queuedPlayers.shift();
            const player2 = this.queuedPlayers.shift();
            
            const match = this.createMatch(GameMode.DUEL);
            match.addPlayer(player1);
            match.addPlayer(player2);
            
            return match;
        }
        
        return null;
    }

    // For testing/demo purposes
    createDemoMatch() {
        // Create two players with starter decks
        const player1 = new Player('player1', 'Player 1');
        const player2 = new Player('player2', 'Player 2');
        
        player1.addDeck(Deck.createStarterDeck(this.cardCatalog));
        player2.addDeck(Deck.createStarterDeck(this.cardCatalog));
        
        // Create and return a match with these players
        const match = this.createMatch(GameMode.DUEL);
        match.addPlayer(player1);
        match.addPlayer(player2);
        
        return match;
    }
}