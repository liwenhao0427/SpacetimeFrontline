
import { GameState } from '../GameState';
import { System } from '../System';
import { EngineCallbacks } from '../index';
import { GRID_ROWS, GRID_OFFSET_Y, CANVAS_WIDTH, CELL_SIZE, GRID_OFFSET_X } from '../../../constants';
import { useGameStore } from '../../../store/useGameStore';
import { GamePhase } from '../../../types';
import { ENEMY_DATA } from '../../../data/enemies';
import { WAVE_DATA } from '../../../data/waves';
import { Log } from '../../Log';

export class EnemySystem implements System {
  // New state for wave management
  private waveElapsedTime: number = 0;
  
  // Revised Spawning Logic State
  private spawnQueue: string[] = []; // Full list of enemies to spawn
  private spawnTimer: number = 0;    // Time accumulated since last spawn
  private spawnInterval: number = 0; // Ideal time between spawns
  private spawnEndTime: number = 0;  // When to stop spawning (duration - 3s)

  update(dt: number, gameState: GameState, callbacks: EngineCallbacks) {
    this.spawnEnemies(dt, gameState);
    this.updateEnemies(dt, gameState, callbacks);
  }

  public prepareWave(waveNumber: number) {
    // Reset state for the new wave
    this.waveElapsedTime = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;

    const config = WAVE_DATA.find(w => w.wave === waveNumber) || WAVE_DATA[WAVE_DATA.length - 1];
    if (!config) return;

    const store = useGameStore.getState();
    const enemyCountModifier = 1 + ((store.stats.enemy_count || 0) / 100);
    
    // 1. Generate the total list of enemies for the wave based on composition percentages
    for (const id in config.composition) {
        const count = Math.round(config.totalCount * config.composition[id] * enemyCountModifier);
        for (let i = 0; i < count; i++) {
            this.spawnQueue.push(id);
        }
    }
    
    // 2. Shuffle queue for randomness in enemy types
    for (let i = this.spawnQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.spawnQueue[i], this.spawnQueue[j]] = [this.spawnQueue[j], this.spawnQueue[i]];
    }
    
    // 3. Configure uniform spawning parameters
    // We stop spawning 3 seconds before the wave ends to allow cleanup.
    // If duration is very short (<=3), we just spawn immediately or over 1s.
    const effectiveDuration = Math.max(1, config.duration - 3); 
    this.spawnEndTime = effectiveDuration;
    
    // Calculate interval: Total Time / Total Enemies
    if (this.spawnQueue.length > 0) {
        this.spawnInterval = effectiveDuration / this.spawnQueue.length;
    } else {
        this.spawnInterval = 9999;
    }
    
    // Start with a small random offset so the first enemy doesn't appear at t=0.000
    this.spawnTimer = Math.random() * -0.5;

    Log.log('EnemySystem', `Prepared Wave ${waveNumber}. Total Enemies: ${this.spawnQueue.length}. Duration: ${config.duration}s. Spawning ends at: ${this.spawnEndTime}s. Interval: ${this.spawnInterval.toFixed(3)}s`);
  }

  private spawnEnemies(dt: number, gameState: GameState) {
    this.waveElapsedTime += dt;

    // Stop spawning if we passed the cut-off time
    if (this.waveElapsedTime >= this.spawnEndTime) {
        return;
    }
    
    if (this.spawnQueue.length === 0) return;

    this.spawnTimer += dt;

    // While timer exceeds interval, spawn enemies (allows catching up if frame dropped or interval is tiny)
    while (this.spawnTimer >= this.spawnInterval && this.spawnQueue.length > 0) {
        this.spawnTimer -= this.spawnInterval;
        const enemyId = this.spawnQueue.shift();
        if (enemyId) {
            this.spawnSingleEnemy(enemyId, gameState);
        }
    }
  }
  
  private spawnSingleEnemy(enemyId: string, gameState: GameState, forcedRow?: number) {
    if (!enemyId) return;
    const typeData = ENEMY_DATA[enemyId];
    if (!typeData) return;

    const store = useGameStore.getState();
    const healthMultiplier = store.stats.enemyHealthMultiplier || 1.0;
    const finalHp = Math.round(typeData.baseHp * healthMultiplier);

    // First, determine a consistent row for both positioning and logic
    const spawnRow = (forcedRow !== undefined) ? forcedRow : Math.floor(Math.random() * GRID_ROWS);
    const spawnY = GRID_OFFSET_Y + (spawnRow * CELL_SIZE) + (CELL_SIZE / 2);

    // Find the rightmost enemy in the same row to prevent perfect stacking.
    const rightmostEnemyInRowX = gameState.enemies
      .filter(e => e.row === spawnRow)
      .reduce((max_x, e) => Math.max(e.x, max_x), 0);

    const baseSpawnX = CANVAS_WIDTH + 50;
    const spawnOffset = 15; // Small pixel offset to stagger spawns.

    // Spawn behind the rightmost enemy in the lane, or at the default position if the lane is clear.
    const spawnX = Math.max(baseSpawnX, rightmostEnemyInRowX + spawnOffset);
    
    const newEnemyId = Math.random();

    gameState.enemies.push({
      id: newEnemyId,
      x: spawnX,
      y: spawnY,
      radius: 24 * typeData.scale,
      markedForDeletion: false,
      hp: finalHp,
      maxHp: finalHp,
      speed: typeData.speed,
      emoji: typeData.emoji,
      description: typeData.name,
      type: typeData.type as any,
      damage: typeData.damage,
      row: spawnRow, // Use the single, consistent calculated row
      attackTimer: 0,
      isAttacking: false,
      frozen: 0,
      hitFlash: 0,
      name: typeData.id,
      attackState: 'IDLE',
      attackProgress: 0,
      slowTimer: 0,
      slowMultiplier: 1,
      deathTimer: 0,
    });
  }


  private updateEnemies(dt: number, gameState: GameState, callbacks: EngineCallbacks) {
    const store = useGameStore.getState();
    
    gameState.enemies.forEach(e => {
      if (e.hitFlash && e.hitFlash > 0) e.hitFlash -= dt;

      // Handle death animation timer
      if (e.deathTimer && e.deathTimer > 0) {
        e.deathTimer -= dt;
        if (e.deathTimer <= 0) {
          e.markedForDeletion = true;
        }
        return; // Don't process movement/attacks for dying enemies
      }

      if (e.frozen > 0) {
        e.frozen -= dt;
        return;
      }

      // Handle Burn Effect
      if (e.burnTimer && e.burnTimer > 0) {
          e.burnTimer -= dt;
          e.burnTickTimer = (e.burnTickTimer || 0) - dt;
          if (e.burnTickTimer <= 0) {
              if (e.burnDamage && e.burnDamage > 0) {
                  e.hp -= e.burnDamage;
                  callbacks.onAddFloatingText?.(gameState, `-${Math.round(e.burnDamage)}`, 'orange', e.x, e.y - e.radius);
                  if (e.hp <= 0 && (!e.deathTimer || e.deathTimer <= 0)) {
                      this.killEnemy(e, gameState, callbacks);
                  }
              }
              e.burnTickTimer = 1.0; // Tick every 1 second
          }
          if (e.burnTimer <= 0) {
              e.burnDamage = 0; // Clear damage when timer expires
          }
      }

      let currentSpeed = e.speed;
      if (e.slowTimer && e.slowTimer > 0) {
          e.slowTimer -= dt;
          currentSpeed *= (e.slowMultiplier || 1);
      }
      
      if (e.attackState === 'ATTACKING') {
        e.attackProgress! += dt * 3.0;
        if (e.attackProgress! >= 1) {
          e.attackState = 'IDLE';
          e.attackProgress = 0;
        }
      }

      e.x -= currentSpeed * dt;

      if (e.x < GRID_OFFSET_X) {
        callbacks.onGameOver?.();
        store.setPhase(GamePhase.GAME_OVER);
        return; 
      }

      const unitInCell = store.gridUnits.find(u => 
        !u.isDead && u.row === e.row && 
        Math.abs(e.x - (GRID_OFFSET_X + u.col * CELL_SIZE + CELL_SIZE / 2)) < (CELL_SIZE / 2 + e.radius)
      );

      if (unitInCell) {
        e.attackTimer -= dt;
        if (e.attackTimer <= 0) {
          store.damageUnit(unitInCell.id, e.damage);
          callbacks.onUnitDamaged?.(unitInCell.id);
          e.attackTimer = 1.0;
          e.attackState = 'ATTACKING';
          e.attackProgress = 0;
        }
        e.x += currentSpeed * dt;
      }
    });
    
    gameState.enemies = gameState.enemies.filter(e => !e.markedForDeletion);
  }

  private killEnemy(e: any, gameState: GameState, callbacks: EngineCallbacks) {
    if (e.markedForDeletion || (e.deathTimer && e.deathTimer > 0)) return;
    
    e.deathTimer = 1.0; 
    
    const enemyData = e.name ? ENEMY_DATA[e.name] : null;
    const xp = enemyData?.xp ?? 3;
    const gold = enemyData?.gold ?? 5;
    
    callbacks.onGainLoot?.(xp, gold);
  }
}
