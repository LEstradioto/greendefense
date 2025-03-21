// Element type definitions and relationships

export const ElementTypes = {
    FIRE: 'fire',
    WATER: 'water',
    EARTH: 'earth',
    AIR: 'air',
    SHADOW: 'shadow',
    NEUTRAL: 'neutral' // Default element
};

// Element advantages (attacker -> defender)
// 1.5 = strong against (50% bonus)
// 1.0 = neutral
// 0.7 = weak against (30% penalty)
export const ElementalAdvantages = {
    [ElementTypes.FIRE]: {
        [ElementTypes.FIRE]: 1.0,
        [ElementTypes.WATER]: 0.7,
        [ElementTypes.EARTH]: 1.5,
        [ElementTypes.AIR]: 1.0,
        [ElementTypes.SHADOW]: 1.0,
        [ElementTypes.NEUTRAL]: 1.2
    },
    [ElementTypes.WATER]: {
        [ElementTypes.FIRE]: 1.5,
        [ElementTypes.WATER]: 1.0,
        [ElementTypes.EARTH]: 0.7,
        [ElementTypes.AIR]: 1.0,
        [ElementTypes.SHADOW]: 1.0,
        [ElementTypes.NEUTRAL]: 1.2
    },
    [ElementTypes.EARTH]: {
        [ElementTypes.FIRE]: 0.7,
        [ElementTypes.WATER]: 1.5,
        [ElementTypes.EARTH]: 1.0,
        [ElementTypes.AIR]: 0.7,
        [ElementTypes.SHADOW]: 1.0,
        [ElementTypes.NEUTRAL]: 1.2
    },
    [ElementTypes.AIR]: {
        [ElementTypes.FIRE]: 1.0,
        [ElementTypes.WATER]: 1.0,
        [ElementTypes.EARTH]: 1.5,
        [ElementTypes.AIR]: 1.0,
        [ElementTypes.SHADOW]: 0.7,
        [ElementTypes.NEUTRAL]: 1.2
    },
    [ElementTypes.SHADOW]: {
        [ElementTypes.FIRE]: 1.0,
        [ElementTypes.WATER]: 1.0,
        [ElementTypes.EARTH]: 1.0,
        [ElementTypes.AIR]: 1.5,
        [ElementTypes.SHADOW]: 1.0,
        [ElementTypes.NEUTRAL]: 1.5
    },
    [ElementTypes.NEUTRAL]: {
        [ElementTypes.FIRE]: 1.0,
        [ElementTypes.WATER]: 1.0,
        [ElementTypes.EARTH]: 1.0,
        [ElementTypes.AIR]: 1.0,
        [ElementTypes.SHADOW]: 0.7,
        [ElementTypes.NEUTRAL]: 1.0
    }
};

// Visual representation for each element
export const ElementStyles = {
    [ElementTypes.FIRE]: {
        color: 0xFF5722, // Deep Orange
        emissive: 0xE64A19,
        particleColor: 0xFF9800
    },
    [ElementTypes.WATER]: {
        color: 0x2196F3, // Blue
        emissive: 0x1976D2,
        particleColor: 0x4FC3F7
    },
    [ElementTypes.EARTH]: {
        color: 0x8BC34A, // Light Green
        emissive: 0x689F38,
        particleColor: 0xAED581
    },
    [ElementTypes.AIR]: {
        color: 0xE0E0E0, // Light Gray
        emissive: 0x9E9E9E,
        particleColor: 0xEEEEEE
    },
    [ElementTypes.SHADOW]: {
        color: 0x9C27B0, // Purple
        emissive: 0x7B1FA2,
        particleColor: 0xBA68C8
    },
    [ElementTypes.NEUTRAL]: {
        color: 0x795548, // Brown
        emissive: 0x5D4037,
        particleColor: 0xA1887F
    }
};

// Element special effects
export const ElementEffects = {
    [ElementTypes.FIRE]: {
        name: 'Burn',
        description: 'Deals damage over time',
        duration: 3, // seconds
        tickInterval: 1, // seconds
        damagePerTick: 1
    },
    [ElementTypes.WATER]: {
        name: 'Slow',
        description: 'Reduces movement speed',
        duration: 3, // seconds
        speedModifier: 0.6 // 60% of normal speed
    },
    [ElementTypes.EARTH]: {
        name: 'Armor',
        description: 'Provides defensive buff to nearby towers',
        duration: 5, // seconds
        radius: 2, // grid cells
        damageReduction: 0.2 // 20% damage reduction
    },
    [ElementTypes.AIR]: {
        name: 'Swift',
        description: 'Increases attack speed temporarily',
        duration: 3, // seconds
        attackSpeedModifier: 1.3 // 30% faster attacks
    },
    [ElementTypes.SHADOW]: {
        name: 'Weaken',
        description: 'Reduces enemy damage output',
        duration: 3, // seconds
        damageModifier: 0.8 // 20% less damage
    }
};
