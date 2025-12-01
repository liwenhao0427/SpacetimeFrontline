
import { create } from 'zustand';
import { PlayerStats, Unit, GamePhase, DraftOption, AmmoBayState, InspectableEntity, BrotatoItem, UnitData, AmmoItem, HeroUpgradeStatus, RenderMode, GameConfig, WaveData } from '../types';
import { INITIAL_STATS, HERO_UNIT, GRID_ROWS, GRID_COLS, CELL_SIZE, GRID_OFFSET_X, GRID_OFFSET_Y } from '../constants';
import { v4 as uuidv4 } from 'uuid';
import { ITEM_POOLS, ITEMS_DATA } from '../data/items';
import { UNIT_POOLS, UNIT_DATA, HEROES } from '../data/units';
import { WAVE_CONFIGS, WAVE_DATA } from '../data/waves';
import { Log } from '../services/Log';
import { audioManager } from '../services/audioManager';

// A mapping from item stat keys to player stat keys
const STAT_KEY_MAP: Record<string, string> = {
  percentDmg: 'damagePercent',
  atkSpeed: 'attackSpeed',
  crit: 'critChance',
  shop_discount: 'shopDiscount',
  flatHp: 'flatHp',
  hpPercent: 'hpPercent',
  harvesting: 'harvesting'
};

interface GameStore {
  stats: PlayerStats;
  phase: GamePhase;
  gridUnits: Unit[];
  draftOptions: DraftOption[];
  ammoState: AmmoBayState;
  inspectedEntity: InspectableEntity;
  renderMode: RenderMode;
  isPaused: boolean;
  
  // Game Configuration
  gameConfig: GameConfig;
  
  // Active Data Pools (Derived from Config)
  activeUnitPool: UnitData[];
  activeItemPool: BrotatoItem[];
  activeWaveData: WaveData[];

  // New state for Brotato-style items
  allItems: BrotatoItem[];
  ownedItems: Record<string, number>; // Map of item.id -> count
  
  // Hero Upgrade Tracking
  heroUpgradeStatus: HeroUpgradeStatus; // Current Wave Status
  permanentHeroUpgradeStatus: HeroUpgradeStatus; // Permanent Status (Base for next wave)
  
  // UI State
  showPermanentLevelUp: boolean;
  
  // Supermarket state management
  wasPausedBeforeSupermarket: boolean;

  // Actions
  setPhase: (phase: GamePhase) => void;
  togglePause: () => void;
  toggleRenderMode: () => void;
  initGame: (config?: GameConfig) => void;
  moveUnit: (unitId: string, targetRow: number, targetCol: number) => void;
  addUnit: (item: UnitData | Partial<Unit>) => boolean;
  buyUnit: (item: UnitData, price: number) => boolean;
  applyDraft: (option: DraftOption, isPermanent?: boolean) => void;
  setInspectedEntity: (entity: InspectableEntity) => void;
  buyBrotatoItem: (item: BrotatoItem) => void;
  moveAmmo: (activeId: string, overId: string) => void;
  triggerManualExplosion: (unitId: string) => void;
  buyExperience: (amount: number, cost: number) => void;
  sellUnit: (unitId: string) => { refund: number, x: number, y: number } | null;
  openSupermarket: () => void;
  closeSupermarket: () => void;

  // Engine Sync Actions
  damageUnit: (unitId: string, amount: number) => void;
  updateHeroEnergy: (amount: number) => void;
  startNextWave: () => void;
  endWaveAndGoToShop: () => void;
  addGold: (amount: number) => void;
  setHeroUltState: (isUlting: boolean, ultTimer?: number) => void;
  updateUltTimer: (dt: number) => void;
}

const initialUpgradeStatus: HeroUpgradeStatus = { 
    multishot: 0, 
    effect: 0, 
    bounce: 0, 
    damage: 0, 
    attackSpeed: 0, 
    ultimate: 0 
};

// Helper: Get HP Scaling Coefficient
// Melee default 1.0, Ranged/Magic default 0.5, can be overridden by data
export const getUnitHpScaling = (unitData: UnitData | Partial<Unit>): number => {
    if (unitData.hpScaling !== undefined) return unitData.hpScaling;
    if (unitData.type === 'MELEE') return 1.0;
    return 0.5; // Ranged, Magic, Engineering default
};

// Helper: Calculate Max HP based on Unit Data and Player Stats
const calculateUnitMaxHp = (unitData: UnitData | Partial<Unit>, stats: PlayerStats): number => {
    const baseMaxHp = 'maxHp' in unitData && typeof unitData.maxHp === 'number' ? unitData.maxHp : 100;
    const scaling = getUnitHpScaling(unitData);
    
    // Logic: Global HP modifiers are scaled by the coefficient for this unit.
    // Final = (Base + (Flat * Scaling)) * (1 + (Percent * Scaling))
    const effectiveFlat = (stats.flatHp || 0) * scaling;
    const effectivePercent = (stats.hpPercent || 0) * scaling;
    
    return Math.round((baseMaxHp + effectiveFlat) * (1 + effectivePercent));
};

const calculateFinalStats = (ownedItems: Record<string, number>, allItems: BrotatoItem[], currentStats: PlayerStats): PlayerStats => {
    const newStats: PlayerStats = { 
        ...INITIAL_STATS,
        gold: currentStats.gold,
        wave: currentStats.wave,
        // Preserve Permanent Progression
        heroLevel: currentStats.heroLevel,
        heroXp: currentStats.heroXp,
        heroMaxXp: currentStats.heroMaxXp,
        // Reset Combat stats to Permanent stats (will be overwritten by items below if items add to them, but items add to base)
        level: currentStats.heroLevel,
        xp: currentStats.heroXp,
        maxXp: currentStats.heroMaxXp,
    };
    
    const itemMap = new Map(allItems.map(i => [i.id, i]));

    for (const itemId in ownedItems) {
        const count = ownedItems[itemId];
        const itemData = itemMap.get(itemId);
        if (itemData) {
            for (let i = 0; i < count; i++) { 
                const combinedAttrs = { ...(itemData.stats || {}), ...(itemData.effect || {}) };
                for (const key in combinedAttrs) {
                    const value = combinedAttrs[key];
                    const statKey = STAT_KEY_MAP[key] || key;
                    newStats[statKey] = (newStats[statKey] || 0) + value;
                }
            }
        }
    }
    return newStats;
};


export const useGameStore = create<GameStore>((set, get) => ({
  stats: INITIAL_STATS,
  phase: GamePhase.START,
  gridUnits: [],
  draftOptions: [],
  ammoState: {},
  inspectedEntity: null,
  allItems: ITEMS_DATA,
  ownedItems: {},
  heroUpgradeStatus: { ...initialUpgradeStatus },
  permanentHeroUpgradeStatus: { ...initialUpgradeStatus },
  showPermanentLevelUp: false,
  renderMode: 'EMOJI',
  isPaused: false,
  wasPausedBeforeSupermarket: false,
  gameConfig: { selectedHeroId: 'hero_keyboard', selectedUnitPools: [], selectedItemPools: [], selectedWaveConfigId: 'STANDARD_CAMPAIGN' },
  activeUnitPool: [],
  activeItemPool: [],
  activeWaveData: WAVE_DATA,

  setPhase: (phase) => set({ phase }),
  
  togglePause: () => set(state => ({ isPaused: !state.isPaused })),

  toggleRenderMode: () => set(state => {
      const newMode = state.renderMode === 'EMOJI' ? 'SPRITE' : 'EMOJI';
      Log.event('系统', `切换渲染模式为: ${newMode}`);
      return { renderMode: newMode };
  }),
  
  openSupermarket: () => {
    set(state => {
        Log.log('Store', `Entering supermarket. Storing pause state: ${state.isPaused}`);
        return {
            wasPausedBeforeSupermarket: state.isPaused,
            isPaused: true, // Always pause when opening
        };
    });
  },
  closeSupermarket: () => {
      set(state => {
          Log.log('Store', `Closing supermarket. Restoring pause state to: ${state.wasPausedBeforeSupermarket}`);
          return ({ isPaused: state.wasPausedBeforeSupermarket });
      });
  },

  setInspectedEntity: (entity) => set({ inspectedEntity: entity }),
  
  addGold: (amount) => set(state => ({ stats: { ...state.stats, gold: state.stats.gold + amount }})),

  initGame: (config) => {
    // 1. Process Configuration
    const finalConfig = config || { selectedHeroId: 'hero_keyboard', selectedUnitPools: Object.keys(UNIT_POOLS), selectedItemPools: Object.keys(ITEM_POOLS), selectedWaveConfigId: 'STANDARD_CAMPAIGN' };
    
    // Merge Pools
    let mergedUnits: UnitData[] = [];
    finalConfig.selectedUnitPools.forEach(poolId => {
        if (UNIT_POOLS[poolId]) mergedUnits = [...mergedUnits, ...UNIT_POOLS[poolId]];
    });
    if (mergedUnits.length === 0) mergedUnits = Object.values(UNIT_POOLS).flat(); // Fallback

    let mergedItems: BrotatoItem[] = [];
    finalConfig.selectedItemPools.forEach(poolId => {
        if (ITEM_POOLS[poolId]) mergedItems = [...mergedItems, ...ITEM_POOLS[poolId]];
    });
    if (mergedItems.length === 0) mergedItems = Object.values(ITEM_POOLS).flat(); // Fallback

    const activeWaveData = WAVE_CONFIGS[finalConfig.selectedWaveConfigId] || WAVE_DATA;

    // 2. Setup Hero
    const heroData = HEROES.find(h => h.id === finalConfig.selectedHeroId) || HEROES[0];
    const heroUnit = { 
      ...heroData,
      id: uuidv4(), 
      row: 2, 
      col: 0,
      attackType: 'LINEAR' as const,
      isHero: true,
      // Ensure Hero stats are initialized if not in JSON
      maxCooldown: heroData.cd,
      hp: heroData.maxHp,
    };
    
    const starters: Unit[] = [heroUnit as unknown as Unit];
    
    Log.log('Store', `initGame: Config loaded. Hero: ${heroData.name}, UnitPoolSize: ${mergedUnits.length}, ItemPoolSize: ${mergedItems.length}`);

    set({
      gameConfig: finalConfig,
      activeUnitPool: mergedUnits,
      activeItemPool: mergedItems,
      activeWaveData: activeWaveData,
      allItems: mergedItems,

      stats: { ...INITIAL_STATS, wave: 0, gold: 200, heroLevel: 1 }, 
      gridUnits: starters,
      phase: GamePhase.SHOP, // Start in SHOP
      draftOptions: [],
      inspectedEntity: null,
      ownedItems: {},
      heroUpgradeStatus: { ...initialUpgradeStatus },
      permanentHeroUpgradeStatus: { ...initialUpgradeStatus },
      showPermanentLevelUp: false,
      isPaused: false,
    });
  },

  addUnit: (data) => {
    const units = [...get().gridUnits];
    for (let c = 0; c < GRID_COLS; c++) {
      for (let r = 0; r < GRID_ROWS; r++) {
        if (!units.find(u => u.row === r && u.col === c)) {
          
          const stats = get().stats;
          const finalMaxHp = calculateUnitMaxHp(data, stats);

          const newUnit: Unit = {
            id: uuidv4(),
            name: data.name || 'Unit',
            emoji: data.emoji || '📦',
            type: data.type || 'RANGED',
            baseDamage: data.baseDamage || 10,
            scaling: data.scaling,
            range: data.range || 5,
            cooldown: 0,
            maxCooldown: 'cd' in data && typeof data.cd === 'number' ? data.cd : ((data as Partial<Unit>).maxCooldown || 1.0),
            hp: finalMaxHp,
            maxHp: finalMaxHp,
            hpScaling: getUnitHpScaling(data),
            row: r,
            col: c,
            description: 'desc' in data ? data.desc : data.description,
            isTemp: 'isTemporary' in data ? !!data.isTemporary : ('isTemp' in data ? !!data.isTemp : false),
            effects: 'effect' in data ? data.effect : ('effects' in data ? data.effects || {} : {}),
            attackPattern: 'attackPattern' in data ? data.attackPattern : 'SHOOT',
            projectileEmoji: 'projectileEmoji' in data ? data.projectileEmoji : undefined,
            state: 'IDLE',
            armingTimer: ('effect' in data && data.effect?.mine_arm_time) ? data.effect.mine_arm_time : 0,
            specialEffectTimer: ('cd' in data && typeof data.cd === 'number' ? data.cd : (data as Partial<Unit>).maxCooldown) || 0,
            spriteConfig: 'spriteConfig' in data ? data.spriteConfig : undefined,
          };

          if (newUnit.effects?.mine_arm_time) {
            newUnit.state = 'ARMING';
          }

          set({ gridUnits: [...units, newUnit] });
          return true;
        }
      }
    }
    return false;
  },
  
  buyUnit: (item, price) => {
      const { stats, addUnit } = get();
      if (stats.gold < price) return false;

      const placed = addUnit(item);
      if (placed) {
          audioManager.play('coin', { volume: 0.3 });
          set(s => ({ stats: { ...s.stats, gold: s.stats.gold - price } }));
          return true;
      }
      return false;
  },
  
  sellUnit: (unitId: string) => {
      const { gridUnits, stats, activeUnitPool } = get();
      const unitIndex = gridUnits.findIndex(u => u.id === unitId);
      if (unitIndex === -1) return null;

      const unit = gridUnits[unitIndex];
      if (unit.isHero) return null; // Cannot sell hero

      // Find in active pool or fallback to full data
      const unitData = activeUnitPool.find(ud => ud.name === unit.name) || Object.values(UNIT_DATA).find(ud => ud.name === unit.name);
      if (!unitData) return null;

      const refund = Math.floor(unitData.price * 0.5);
      
      Log.event('战场', `玩家出售了单位 ${unit.name}，获得 ${refund} 金币。`);
      audioManager.play('coin', { volume: 0.3 });

      set({
          stats: { ...stats, gold: stats.gold + refund },
          gridUnits: gridUnits.filter(u => u.id !== unitId)
      });
      
      const x = GRID_OFFSET_X + unit.col * CELL_SIZE + CELL_SIZE / 2;
      const y = GRID_OFFSET_Y + unit.row * CELL_SIZE + CELL_SIZE / 2;

      return { refund, x, y };
  },
  
  buyExperience: (amount, cost) => {
      set(state => {
          if (state.stats.gold < cost) return {};
          
          audioManager.play('coin', { volume: 0.3 });
          
          let newXp = state.stats.heroXp + amount;
          let newMaxXp = state.stats.heroMaxXp;
          let newLevel = state.stats.heroLevel;
          let currentGold = state.stats.gold - cost;
          let leveledUp = false;
          
          // Handle leveling up in shop
          while (newXp >= newMaxXp) {
              newXp -= newMaxXp;
              newLevel += 1;
              newMaxXp = Math.floor(newMaxXp * 1.5);
              leveledUp = true;
          }
          
          // Sync combat stats with permanent stats immediately if in Shop
          return {
              stats: {
                  ...state.stats,
                  gold: currentGold,
                  // Update Permanent Stats
                  heroXp: newXp,
                  heroMaxXp: newMaxXp,
                  heroLevel: newLevel,
                  // Sync visuals
                  xp: newXp,
                  maxXp: newMaxXp,
                  level: newLevel
              },
              showPermanentLevelUp: leveledUp || state.showPermanentLevelUp
          };
      });
  },

  buyBrotatoItem: (item) => {
    set(state => {
      // Use item.price which might be overridden (e.g. 0 for cheat)
      const price = item.price;
      const currentGold = state.stats.gold;
      if (currentGold < price) return {};
      
      audioManager.play('coin', { volume: 0.3 });

      const newOwnedItems = { ...state.ownedItems };
      newOwnedItems[item.id] = (newOwnedItems[item.id] || 0) + 1;
      
      // If item is not in allItems (e.g. Debug item), add it temp to allItems or just let calculation handle it if we passed it in.
      // But calculateFinalStats relies on allItems. Let's append if missing.
      let allItems = state.allItems;
      if (!allItems.find(i => i.id === item.id)) {
          allItems = [...allItems, item];
      }
      
      const newStats = calculateFinalStats(newOwnedItems, allItems, state.stats);
      newStats.gold -= price;

      const updatedUnits = state.gridUnits.map(u => {
        // Find unit data in active pool or fallback
        const unitData = state.activeUnitPool.find(ud => ud.name === u.name) || Object.values(UNIT_DATA).find(ud => ud.name === u.name);
        const dataToUse = unitData || u; // Fallback to unit itself if no data found
        const newMaxHp = calculateUnitMaxHp(dataToUse, newStats);
        
        return { ...u, maxHp: newMaxHp, hp: newMaxHp };
      });

      return {
        ownedItems: newOwnedItems,
        stats: newStats,
        gridUnits: updatedUnits,
        allItems: allItems // Update allItems in case we added a debug item
      };
    });
  },

  moveAmmo: (activeId: string, overId: string) => {
    // Legacy support removal - stub
    return {};
  },

  moveUnit: (unitId, tRow, tCol) => {
    set((state) => {
      if (tRow < 0 || tRow >= GRID_ROWS || tCol < 0 || tCol >= GRID_COLS) return {};

      const units = [...state.gridUnits];
      const unitIndex = units.findIndex(u => u.id === unitId);
      if (unitIndex === -1) return {};

      const unit = units[unitIndex];
      const targetUnit = units.find(u => u.row === tRow && u.col === tCol && u.id !== unitId);
      
      Log.event('战场', `玩家移动了单位 ${unit.name} 从 (${unit.row}, ${unit.col}) 到 (${tRow}, ${tCol})。`);
      
      if (targetUnit) {
        // Swap positions with the target unit (dead or alive)
        targetUnit.row = unit.row;
        targetUnit.col = unit.col;
        unit.row = tRow;
        unit.col = tCol;
      } else {
        // Move to an empty cell
        unit.row = tRow;
        unit.col = tCol;
      }
      
      return { gridUnits: units };
    });
  },

  damageUnit: (unitId, amount) => {
    set((state) => {
      const units = state.gridUnits.map(u => {
        if (u.id !== unitId) return u;
        
        if (u.effects?.explode_on_hit) {
            return { ...u, hp: 0, isDead: true };
        }

        const newHp = u.hp - amount;
        return { ...u, hp: newHp, isDead: newHp <= 0, hitFlash: 0.2 };
      });
      return { gridUnits: units };
    });
  },

  triggerManualExplosion: (unitId) => {
    set((state) => {
        const units = state.gridUnits.map(u => {
            if (u.id === unitId && u.effects?.trigger_on_move) {
                return { ...u, hp: 0, isDead: true };
            }
            return u;
        });
        return { gridUnits: units };
    });
  },

  updateHeroEnergy: (amount) => {
    set((state) => {
      const energyGain = amount * (state.stats.heroEnergyGainRate || 1.0);
      const maxEnergy = state.stats.heroMaxEnergy || 100;
      const units = state.gridUnits.map(u => {
        if (!u.isHero) return u;
        return { ...u, energy: Math.min(maxEnergy, (u.energy || 0) + energyGain) };
      });
      return { gridUnits: units };
    });
  },
  
  updateUltTimer: (dt) => set(state => {
    let needsUpdate = false;
    const units = state.gridUnits.map(u => {
        if (u.isHero && u.isUlting && u.ultTimer) {
            needsUpdate = true;
            const newTimer = u.ultTimer - dt;
            if (newTimer <= 0) {
                return { ...u, isUlting: false, ultTimer: 0 };
            }
            return { ...u, ultTimer: newTimer };
        }
        return u;
    });
    return needsUpdate ? { gridUnits: units } : {};
  }),

  setHeroUltState: (isUlting, ultTimer) => set(state => {
      const units = state.gridUnits.map(u => {
          if (u.isHero) {
              return { ...u, isUlting, ultTimer: isUlting ? ultTimer : 0 };
          }
          return u;
      });
      return { gridUnits: units };
  }),

  endWaveAndGoToShop: () => {
    set(state => {
      Log.log('Store', `endWaveAndGoToShop: phase -> SHOP.`);
      
      const harvestingGold = Math.floor(state.stats.harvesting || 0);
      const newGold = state.stats.gold + harvestingGold;

      const baseStats = calculateFinalStats(state.ownedItems, state.allItems, {...state.stats, gold: newGold });
      
      const nextUnits = state.gridUnits
        .filter(u => !u.isTemp) 
        .map(u => {
            // Re-fetch maxHP from pool or fallback
            const unitData = state.activeUnitPool.find(ud => ud.name === u.name) || Object.values(UNIT_DATA).find(ud => ud.name === u.name);
            const dataToUse = unitData || u;
            const newMaxHp = calculateUnitMaxHp(dataToUse, baseStats);
            return { ...u, maxHp: newMaxHp, hp: newMaxHp, isDead: false, energy: 0 };
        });
      
      // Apply permanent hero upgrades to stats for shop display
      const permStatus = state.permanentHeroUpgradeStatus;
      baseStats.heroDamageMult = (permStatus.damage * 0.50);
      baseStats.heroAttackSpeedMult = (permStatus.attackSpeed * 0.30);
      
      baseStats.ult_speed_mult = 3 + (permStatus.ultimate >= 1 ? 1 : 0);
      baseStats.ult_dmg_bonus = (permStatus.ultimate >= 2 ? 0.25 : 0);
      baseStats.ult_duration_bonus = (permStatus.ultimate >= 3 ? 1.5 : 0);
      baseStats.ult_kill_extend = (permStatus.ultimate >= 4 ? 0.1 : 0);

      // Clear Wave Temporary Buffs (from in-wave level ups)
      baseStats.tempDamageMult = 0;
      baseStats.tempAttackSpeedMult = 0;
      
      // Reset Combat XP/Level to Permanent Hero Status for the UI
      baseStats.level = baseStats.heroLevel;
      baseStats.xp = baseStats.heroXp;
      baseStats.maxXp = baseStats.heroMaxXp;

      baseStats.lastHarvestYield = harvestingGold > 0 ? harvestingGold : null;

      return {
        gridUnits: nextUnits,
        stats: baseStats,
        phase: GamePhase.SHOP,
        isPaused: false, // Ensure not paused when entering shop
      };
    });
  },

  startNextWave: () => {
    audioManager.play('wave_start');
    set(state => {
      Log.log('Store', `startNextWave: phase -> COMBAT, wave -> ${state.stats.wave + 1}.`);
      
      const startingStatus = { ...state.permanentHeroUpgradeStatus };

      const unitsWithResetHero = state.gridUnits.map(u => {
        if (u.isHero) {
          // Re-apply permanent upgrades based on status
          let type: 'LINEAR' | 'DOUBLE_SHOT' | 'TRI_SHOT' | 'PENTA_SHOT' = 'LINEAR';
          
          if (startingStatus.multishot === 1) type = 'DOUBLE_SHOT';
          if (startingStatus.multishot === 2) type = 'TRI_SHOT';
          if (startingStatus.multishot === 3) type = 'PENTA_SHOT';
          
          let newEffects: Record<string, any> = {};
          if (startingStatus.effect >= 1) newEffects.is_tracking = true;
          if (startingStatus.effect >= 2) newEffects.explode_on_hit = 1;
          if (startingStatus.effect >= 3) newEffects.chain_explosion = 1;
          
          if (startingStatus.bounce >= 1) newEffects.bounceCount = 1;
          if (startingStatus.bounce >= 2) newEffects.bounceCount = 2;
          if (startingStatus.bounce >= 3) newEffects.bounceCount = 4;
          if (startingStatus.bounce >= 4) newEffects.bounceCount = 10;

          return { ...u, attackType: type, effects: newEffects };
        }
        return u;
      });
      
      const nextStats = { ...state.stats };
      nextStats.wave = state.stats.wave + 1;
      nextStats.level = state.stats.heroLevel;
      nextStats.xp = state.stats.heroXp;
      nextStats.maxXp = state.stats.heroMaxXp;
      nextStats.lastHarvestYield = null;
      
      // Apply Permanent Upgrades from status to live stats for the wave
      const permStatus = state.permanentHeroUpgradeStatus;
      nextStats.heroDamageMult = (permStatus.damage * 0.50);
      nextStats.heroAttackSpeedMult = (permStatus.attackSpeed * 0.30);
      
      nextStats.ult_speed_mult = 3 + (permStatus.ultimate >= 1 ? 1 : 0);
      nextStats.ult_dmg_bonus = (permStatus.ultimate >= 2 ? 0.25 : 0);
      nextStats.ult_duration_bonus = (permStatus.ultimate >= 3 ? 1.5 : 0);
      nextStats.ult_kill_extend = (permStatus.ultimate >= 4 ? 0.1 : 0);

      return {
        gridUnits: unitsWithResetHero,
        stats: nextStats,
        phase: GamePhase.COMBAT,
        heroUpgradeStatus: startingStatus,
        isPaused: false, // Ensure not paused
      };
    });
  },

  applyDraft: (option, isPermanent = false) => {
    set(state => {
      Log.event('升级', `玩家选择了 ${isPermanent ? '永久' : '临时'} 升级：'${option.name}'。`);
      const nextState: Partial<Pick<GameStore, 'gridUnits' | 'stats' | 'heroUpgradeStatus' | 'permanentHeroUpgradeStatus' | 'showPermanentLevelUp'>> = {}; 
      
      if (isPermanent) {
          nextState.showPermanentLevelUp = false;
      }

      if (option.type === 'TEMP_UNIT') {
        get().addUnit({ ...option.data, isTemp: true });
      } else if (option.type === 'HERO_UPGRADE') {
          const upgradeData = option.data as any;
          const nextStats = { ...state.stats };
          
          if (upgradeData.upgradePath) {
              const path = upgradeData.upgradePath as keyof HeroUpgradeStatus;
              
              if (isPermanent) {
                  const permStatus = { ...state.permanentHeroUpgradeStatus };
                  permStatus[path] = (permStatus[path] || 0) + 1;
                  nextState.permanentHeroUpgradeStatus = permStatus;
              } else {
                  const currentStatus = { ...state.heroUpgradeStatus };
                  currentStatus[path] = (currentStatus[path] || 0) + 1;
                  nextState.heroUpgradeStatus = currentStatus;
              }
          }
          
          // Apply numeric stats immediately for both permanent and temp upgrades
          if (upgradeData.heroDamage) nextStats.heroDamageMult = (nextStats.heroDamageMult || 0) + upgradeData.heroDamage;
          if (upgradeData.heroAttackSpeed) nextStats.heroAttackSpeedMult = (nextStats.heroAttackSpeedMult || 0) + upgradeData.heroAttackSpeed;

          // These affect stats directly and aren't multipliers
          if (upgradeData.heroEnergyGainRate) nextStats.heroEnergyGainRate = (nextStats.heroEnergyGainRate || 1) + upgradeData.heroEnergyGainRate;
          if (upgradeData.extraEffects?.ult_duration_bonus) nextStats.ult_duration_bonus = (nextStats.ult_duration_bonus || 0) + upgradeData.extraEffects.ult_duration_bonus;
          if (upgradeData.extraEffects?.ult_speed_mult_bonus) nextStats.ult_speed_mult = (nextStats.ult_speed_mult || 3) + upgradeData.extraEffects.ult_speed_mult_bonus;
          if (upgradeData.extraEffects?.ult_dmg_bonus) nextStats.ult_dmg_bonus = (nextStats.ult_dmg_bonus || 0) + upgradeData.extraEffects.ult_dmg_bonus;
          if (upgradeData.extraEffects?.ult_kill_extend) nextStats.ult_kill_extend = (nextStats.ult_kill_extend || 0) + upgradeData.extraEffects.ult_kill_extend;

          nextState.stats = nextStats;
          
          const units = [...state.gridUnits];
          const heroIndex = units.findIndex(u => u.isHero);
          if (heroIndex !== -1) {
            let hero = { ...units[heroIndex] };
            if (upgradeData.heroAttackType) hero.attackType = upgradeData.heroAttackType;
            if (upgradeData.extraEffects) {
                hero.effects = { ...(hero.effects || {}), ...upgradeData.extraEffects };
            }
            units[heroIndex] = hero;
            nextState.gridUnits = units;
          }

      } else if (option.type === 'TEMP_BUFF') {
        const buff = option.data as any;
        const nextStats = { ...state.stats };

        if (buff.damage) nextStats.tempDamageMult = (nextStats.tempDamageMult || 0) + buff.damage;
        if (buff.attackSpeed) nextStats.tempAttackSpeedMult = (nextStats.tempAttackSpeedMult || 0) + buff.attackSpeed;
        if (buff.heroDamage) nextStats.heroDamageMult = (nextStats.heroDamageMult || 0) + buff.heroDamage;
        if (buff.heroAttackSpeed) nextStats.heroAttackSpeedMult = (nextStats.heroAttackSpeedMult || 0) + buff.heroAttackSpeed;
        if (buff.heroEnergyGainRate) nextStats.heroEnergyGainRate = (nextStats.heroEnergyGainRate || 1.0) + buff.heroEnergyGainRate;
        if (buff.heroMaxEnergy) nextStats.heroMaxEnergy = Math.max(20, (nextState.stats.heroMaxEnergy || 100) + buff.heroMaxEnergy);

        nextState.stats = nextStats;
      }
      return nextState;
    });
  }
}));
