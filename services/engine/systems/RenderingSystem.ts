
import { GameState } from '../GameState';
import { Unit, InspectableEntity, Enemy, RenderMode, SpriteAnimation } from '../../../types';
import { GRID_ROWS, GRID_COLS, CELL_SIZE, GRID_OFFSET_X, GRID_OFFSET_Y, CANVAS_WIDTH, CANVAS_HEIGHT } from '../../../constants';
import { useGameStore } from '../../../store/useGameStore';
import { InputSystem } from './InputSystem';
import { ENEMY_DATA } from '../../../data/enemies';
import { EmojiSpriteCache } from '../utils/EmojiSpriteCache';
import { assetLoader } from '../../AssetLoader';

type AnimationState = 'IDLE' | 'ATTACK' | 'HIT' | 'DEATH' | 'MOVE';

interface VisualUnit {
  x: number;
  y: number;
  scale: number;
  hitFlash: number;
  offsetX: number;
  recoil: number;
  // Animation state
  currentState: AnimationState;
  frameTimer: number;
  animationStartTime: number; 
}

export class RenderingSystem {
  private visualUnits: Map<string, VisualUnit> = new Map();
  private emojiCache: EmojiSpriteCache = new EmojiSpriteCache();
  private helperCanvas: HTMLCanvasElement;
  private helperCtx: CanvasRenderingContext2D;
  
  constructor(private ctx: CanvasRenderingContext2D, private inputSystem: InputSystem) {
      this.helperCanvas = document.createElement('canvas');
      this.helperCanvas.width = 512;
      this.helperCanvas.height = 512;
      this.helperCtx = this.helperCanvas.getContext('2d', { willReadFrequently: true })!;
  }

  public setUnitHitFlash(unitId: string) {
    const vis = this.visualUnits.get(unitId);
    if (vis) {
      vis.hitFlash = 0.25; // Slightly longer for better visibility
    }
  }

  public update(dt: number) {
    const units = useGameStore.getState().gridUnits;
    const LERP_FACTOR = 1 - Math.pow(0.001, dt);
    const seenIds = new Set<string>();

    units.forEach(u => {
      seenIds.add(u.id);
      
      if (!this.visualUnits.has(u.id)) {
        this.visualUnits.set(u.id, {
          x: GRID_OFFSET_X + u.col * CELL_SIZE + CELL_SIZE / 2,
          y: GRID_OFFSET_Y + u.row * CELL_SIZE + CELL_SIZE / 2,
          scale: 1,
          hitFlash: 0,
          offsetX: 0,
          recoil: 0,
          currentState: 'IDLE',
          frameTimer: 0,
          animationStartTime: performance.now()
        });
      }

      const vis = this.visualUnits.get(u.id)!;
      
      // --- Animation State Machine Logic ---
      let desiredState: AnimationState = 'IDLE';

      if (u.isDead) {
          desiredState = 'DEATH';
      } else if (vis.hitFlash > 0.05) { 
          desiredState = 'HIT';
      } else if (u.attackState === 'ATTACKING') {
          desiredState = 'ATTACK';
      } else {
          desiredState = 'IDLE';
      }

      // Transition Logic
      if (desiredState !== vis.currentState) {
          // Prevent switching out of death unless revived
          if (vis.currentState !== 'DEATH' || !u.isDead) {
              vis.currentState = desiredState;
              vis.frameTimer = 0;
              vis.animationStartTime = performance.now();
          }
      }

      // Animation frame update
      vis.frameTimer += dt * 1000; // ms

      if (u.hitFlash && u.hitFlash > 0) {
        vis.hitFlash = u.hitFlash;
        u.hitFlash = 0;
      }
      if (vis.hitFlash > 0) vis.hitFlash -= dt;

      // Recoil logic (Visual shake on attack)
      if (vis.currentState === 'ATTACK' && (u.attackPattern === 'SHOOT' || u.attackPattern === 'STREAM') && vis.frameTimer < 100) {
          // Only recoil at start of attack frame
          vis.recoil = -12; 
      }
      vis.recoil += (0 - vis.recoil) * LERP_FACTOR * 3; 

      const isDragging = this.inputSystem.dragUnitId === u.id;

      let lungeOffset = 0;
      if (u.attackPattern === 'THRUST' && vis.currentState === 'ATTACK' && u.attackProgress) {
          const lungeDistance = u.range * CELL_SIZE * 0.6;
          lungeOffset = Math.sin(u.attackProgress * Math.PI) * lungeDistance;
      }

      if (isDragging) {
        vis.x = this.inputSystem.mouseX;
        vis.y = this.inputSystem.mouseY;
        vis.scale += (1.2 - vis.scale) * LERP_FACTOR;
        vis.offsetX += (0 - vis.offsetX) * LERP_FACTOR;
      } else {
        const targetX = GRID_OFFSET_X + u.col * CELL_SIZE + CELL_SIZE / 2;
        const targetY = GRID_OFFSET_Y + u.row * CELL_SIZE + CELL_SIZE / 2;
        vis.x += (targetX - vis.x) * LERP_FACTOR;
        vis.y += (targetY - vis.y) * LERP_FACTOR;
        vis.scale += (1.0 - vis.scale) * LERP_FACTOR;
        vis.offsetX += (lungeOffset - vis.offsetX) * LERP_FACTOR;
      }
    });

    for (const id of this.visualUnits.keys()) {
      if (!seenIds.has(id)) {
        this.visualUnits.delete(id);
      }
    }
  }
  
  public draw(gameState: GameState, inspectedEntity: InspectableEntity) {
    const store = useGameStore.getState();
    const renderMode = store.renderMode;

    this.drawBackground();

    const { c: hoverC, r: hoverR } = this.inputSystem.getGridPosFromCoords(this.inputSystem.mouseX, this.inputSystem.mouseY);

    this.drawGridHighlights(hoverC, hoverR);

    const activeUnits = store.gridUnits.filter(u => u.id !== this.inputSystem.dragUnitId);
    const draggingUnit = store.gridUnits.find(u => u.id === this.inputSystem.dragUnitId);
    
    // Determine which range to show (Hovered or Dragging)
    const unitForRange = draggingUnit 
        ? draggingUnit 
        : activeUnits.find(u => u.col === hoverC && u.row === hoverR && !u.isDead);

    // Draw Range UNDER units
    if (unitForRange) {
        this.drawAttackRange(unitForRange, draggingUnit ? 'drag' : 'hover');
    }

    const sortedUnits = [...activeUnits].sort((a, b) => a.row - b.row);

    sortedUnits.forEach(u => {
        const isHovered = u.id === unitForRange?.id;
        this.drawUnit(u, renderMode, isHovered);
    });

    this.drawEnemies(gameState, renderMode);
    this.drawProjectiles(gameState);

    if (draggingUnit) this.drawUnit(draggingUnit, renderMode, true);
    this.drawFloatingTexts(gameState);

    if (inspectedEntity && store.phase === 'COMBAT') {
      const selectedId = 'id' in inspectedEntity.data ? inspectedEntity.data.id : null;
      if (selectedId) this.drawSelection(selectedId, gameState);
    }
  }

  // --- Background: Sky + Grass + Dirt Lanes ---
  private drawBackground() {
      // Sky
      const gradient = this.ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      gradient.addColorStop(0, '#bae6fd'); // Sky 200
      gradient.addColorStop(1, '#7dd3fc'); // Sky 300
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Grass Field
      this.ctx.fillStyle = '#a3e635'; // Lime 400
      const grassY = GRID_OFFSET_Y - 30;
      const grassH = GRID_ROWS * CELL_SIZE + 60;
      // Rounded grass field
      this.ctx.beginPath();
      this.ctx.roundRect(10, grassY, CANVAS_WIDTH - 20, grassH, 30);
      this.ctx.fill();
      // Grass border
      this.ctx.strokeStyle = '#84cc16'; // Lime 500
      this.ctx.lineWidth = 4;
      this.ctx.stroke();
      
      // Dirt Lanes
      for (let r = 0; r < GRID_ROWS; r++) {
          const laneY = GRID_OFFSET_Y + r * CELL_SIZE + 10;
          const laneHeight = CELL_SIZE - 20;
          
          // Main dirt
          this.ctx.fillStyle = '#d97706'; // Amber 600
          this.ctx.beginPath();
          this.ctx.roundRect(40, laneY, CANVAS_WIDTH - 80, laneHeight, 16);
          this.ctx.fill();

          // Inner lighter dirt (Highlight)
          this.ctx.fillStyle = '#f59e0b'; // Amber 500
          this.ctx.beginPath();
          this.ctx.roundRect(40, laneY + 6, CANVAS_WIDTH - 80, laneHeight - 16, 16);
          this.ctx.fill();
      }
  }

  private drawGridHighlights(hoverC: number, hoverR: number) {
    if (this.inputSystem.dragUnitId) {
        // Drop Zones
        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
                const x = GRID_OFFSET_X + c * CELL_SIZE;
                const y = GRID_OFFSET_Y + r * CELL_SIZE;
                
                const { c: dragC, r: dragR } = this.inputSystem.getGridPosFromCoords(this.inputSystem.mouseX, this.inputSystem.mouseY);
                if (dragC === c && dragR === r) {
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                    this.ctx.beginPath();
                    this.ctx.roundRect(x + 5, y + 5, CELL_SIZE - 10, CELL_SIZE - 10, 15);
                    this.ctx.fill();
                    
                    this.ctx.strokeStyle = '#ffffff';
                    this.ctx.lineWidth = 4;
                    this.ctx.stroke();
                } else {
                    // Slight highlight for available slots
                    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                    this.ctx.lineWidth = 2;
                    this.ctx.beginPath();
                    this.ctx.roundRect(x + 10, y + 10, CELL_SIZE - 20, CELL_SIZE - 20, 15);
                    this.ctx.stroke();
                }
            }
        }
    } else if (hoverC >= 0 && hoverC < GRID_COLS && hoverR >= 0 && hoverR < GRID_ROWS) {
        // Mouse Hover
        const x = GRID_OFFSET_X + hoverC * CELL_SIZE;
        const y = GRID_OFFSET_Y + hoverR * CELL_SIZE;
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.beginPath();
        this.ctx.roundRect(x + 5, y + 5, CELL_SIZE - 10, CELL_SIZE - 10, 15);
        this.ctx.fill();
    }
  }

  private drawUnit(u: Unit, mode: RenderMode, isHovered: boolean = false) {
    const vis = this.visualUnits.get(u.id);
    if (!vis) return;
    
    const store = useGameStore.getState();
    const stats = store.stats;

    const { x, y, scale, offsetX, recoil } = vis;
    this.ctx.save();
    
    let shakeX = 0, shakeY = 0;
    if (u.isUlting) {
        shakeX = (Math.random() - 0.5) * 6;
        shakeY = (Math.random() - 0.5) * 6;
    }

    this.ctx.translate(x + offsetX + recoil + shakeX, y + shakeY);

    // Breathe / Sway Effect for Idle
    if (!u.isDead && vis.currentState === 'IDLE') {
         const time = performance.now() / 1000;
         const sway = Math.sin(time * 3 + parseInt(u.id, 16));
         // Apply to all idle states (Emoji and Sprite idle)
         this.ctx.scale(1 + sway * 0.03, 1 - sway * 0.03);
    }
    
    this.ctx.scale(scale, scale);

    // Drop Shadow
    this.ctx.fillStyle = 'rgba(0,0,0,0.15)';
    this.ctx.beginPath();
    this.ctx.ellipse(0, 35, 30, 10, 0, 0, Math.PI * 2);
    this.ctx.fill();

    if (u.isUlting) {
        this.ctx.shadowColor = '#facc15'; 
        this.ctx.shadowBlur = 20;
    }

    // --- SPRITE RENDER LOGIC ---
    let drawnAsSprite = false;
    
    if ((mode === 'SPRITE' || u.isHero) && u.spriteConfig) {
        const tex = assetLoader.getTexture(u.spriteConfig.textureId);
        if (tex) {
            drawnAsSprite = true;
            const config = u.spriteConfig;
            
            const attackAnim = config.animations.ATTACK;
            const baseAnim = config.animations.IDLE || attackAnim;

            if (!baseAnim) {
                drawnAsSprite = false; // Cannot draw if no anim is available
            } else {
                let anim: SpriteAnimation = baseAnim;
                let frameIndex = 0;

                if (vis.currentState === 'DEATH') {
                    anim = config.animations.DEATH || baseAnim;
                    const duration = anim.frames * (anim.speed || 100);
                    const progress = Math.min(1, vis.frameTimer / duration);
                    frameIndex = Math.min(anim.frames - 1, Math.floor(progress * anim.frames));
                }
                else if (vis.currentState === 'HIT') {
                    anim = config.animations.HIT || baseAnim;
                    if (config.animations.HIT) {
                        const duration = anim.frames * (anim.speed || 100);
                        const progress = Math.min(1, vis.frameTimer / duration);
                        frameIndex = Math.min(anim.frames - 1, Math.floor(progress * anim.frames));
                    } else {
                        frameIndex = 0; // If no HIT anim, just show first frame of base
                    }
                }
                else if (vis.currentState === 'ATTACK' && attackAnim) {
                    anim = attackAnim;
                    const totalDurationMs = anim.frames * (anim.speed || 60);
                    const progress = Math.min(1.0, vis.frameTimer / totalDurationMs);
                    frameIndex = Math.floor(progress * anim.frames);
                }
                else { // IDLE State
                    anim = baseAnim;
                    if (anim === attackAnim && anim.loop !== true) {
                        frameIndex = 0;
                    } else if (anim.frames > 1 && anim.loop) {
                        const totalDuration = anim.frames * (anim.speed || 100);
                        const time = vis.frameTimer % totalDuration;
                        frameIndex = Math.floor(time / (anim.speed || 100));
                    } else {
                        frameIndex = 0;
                    }
                }

                frameIndex = Math.min(frameIndex, anim.frames - 1);

                const sx = anim.x + frameIndex * config.width;
                const sy = anim.y;
                
                const targetSize = 120 * (config.scale || 1);
                const ratio = config.width / config.height;
                const drawW = targetSize * ratio;
                const drawH = targetSize;

                if (u.isHero) {
                    this.ctx.shadowColor = 'rgba(255,255,255,0.5)';
                    this.ctx.shadowBlur = 10;
                }

                if (vis.hitFlash > 0) {
                    this.helperCtx.clearRect(0, 0, drawW, drawH);
                    this.helperCtx.drawImage(tex, sx, sy, config.width, config.height, 0, 0, drawW, drawH);
                    
                    this.helperCtx.globalCompositeOperation = 'source-atop';
                    this.helperCtx.fillStyle = 'rgba(255, 100, 100, 0.7)';
                    this.helperCtx.fillRect(0, 0, drawW, drawH);
                    this.helperCtx.globalCompositeOperation = 'source-over';
                    
                    this.ctx.drawImage(this.helperCanvas, 0, 0, drawW, drawH, -drawW/2, -drawH + 40, drawW, drawH);
                } else {
                    this.ctx.drawImage(tex, sx, sy, config.width, config.height, -drawW/2, -drawH + 40, drawW, drawH);
                }
                this.ctx.shadowBlur = 0;
            }
        }
    }

    if (!drawnAsSprite) {
        // Fallback to Emoji
        if (u.isDead) {
            this.ctx.globalAlpha = 0.6;
            this.emojiCache.draw(this.ctx, '🪦', 0, -10, 70);
        } else {
            if (u.isTemp) {
                this.ctx.shadowColor = '#38bdf8'; // Sky blue
                this.ctx.shadowBlur = 15;
            }
            
            if (vis.hitFlash > 0) {
                 this.helperCtx.clearRect(0, 0, 100, 100);
                 this.emojiCache.draw(this.helperCtx, u.emoji, 50, 50, 70);
                 
                 this.helperCtx.globalCompositeOperation = 'source-atop';
                 this.helperCtx.fillStyle = 'rgba(255, 100, 100, 0.7)';
                 this.helperCtx.fillRect(0, 0, 100, 100);
                 this.helperCtx.globalCompositeOperation = 'source-over';
                 
                 this.ctx.drawImage(this.helperCanvas, 0, 0, 100, 100, -50, -60, 100, 100);
            } else {
                 this.emojiCache.draw(this.ctx, u.emoji, 0, -10, 70);
            }
        }
    }
    
    this.ctx.globalAlpha = 1.0;
    this.ctx.shadowBlur = 0;

    // --- Stats Display ---
    if (!u.isDead) {
        const statY = 35;
        
        // Calculate REAL Damage for Display
        let flatBonus = 0;
        if (u.type === 'MELEE') flatBonus = stats.meleeDmg;
        if (u.type === 'RANGED') flatBonus = stats.rangedDmg;
        if (u.type === 'MAGIC') flatBonus = stats.elementalDmg;
        if (u.effects?.stick_bonus) flatBonus += u.effects.stick_bonus;

        const heroDmgMult = u.isHero ? (1 + (stats.heroDamageMult || 0)) : 1;
        const globalDmgMult = (1 + (stats.damagePercent || 0)) * (1 + (stats.tempDamageMult || 0));
        
        let finalDamage = Math.round((u.baseDamage + flatBonus) * globalDmgMult * heroDmgMult);
        if (u.isHero && u.isUlting) finalDamage = Math.round(finalDamage * (1 + (stats.ult_dmg_bonus || 0)));

        this.drawStatBadge(-25, statY, finalDamage, '#facc15'); 
        this.drawStatBadge(25, statY, Math.ceil(u.hp), '#f87171', u.maxHp);

        if (u.isHero && typeof u.energy === 'number') {
            const maxEnergy = stats.heroMaxEnergy || 100;
            const energyPct = u.energy / maxEnergy;
            
            this.ctx.fillStyle = '#1e293b'; // Slate 800
            this.ctx.fillRect(-30, 48, 60, 8);
            this.ctx.fillStyle = '#67e8f9'; // Cyan 300
            this.ctx.fillRect(-29, 49, 58 * energyPct, 6);
        }
    }
    
    this.ctx.restore();
  }
  
  private drawStatBadge(x: number, y: number, value: number, bgColor: string, maxValue?: number) {
      this.ctx.save();
      this.ctx.translate(x, y);
      
      const text = String(value);
      this.ctx.font = "bold 12px 'Fredoka', sans-serif";
      const textWidth = this.ctx.measureText(text).width;
      const boxWidth = Math.max(24, textWidth + 10);

      // Draw box
      this.ctx.fillStyle = bgColor;
      this.ctx.beginPath();
      this.ctx.roundRect(-boxWidth/2, -8, boxWidth, 16, 8);
      this.ctx.fill();
      
      this.ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      this.ctx.fillStyle = 'white';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(text, 0, 1);

      this.ctx.restore();
  }

  private drawEnemies(gameState: GameState, mode: RenderMode) {
    gameState.enemies.forEach(e => {
      this.ctx.save();
      this.ctx.translate(e.x, e.y);

      if (e.attackState === 'ATTACKING' && e.attackProgress) {
        const lunge = Math.sin(e.attackProgress * Math.PI) * -30;
        this.ctx.translate(lunge, 0);
      }
      
      this.ctx.scale(e.slowTimer && e.slowTimer > 0 ? 0.8 : 1.0, 1.0);
      
      this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
      this.ctx.beginPath();
      this.ctx.ellipse(0, e.radius, e.radius, e.radius * 0.3, 0, 0, Math.PI * 2);
      this.ctx.fill();

      if (e.deathTimer && e.deathTimer > 0) {
        this.ctx.globalAlpha = e.deathTimer; 
        this.ctx.scale(1 + (1 - e.deathTimer) * 0.5, 1 + (1 - e.deathTimer) * 0.5); 
      }
      
      if (e.hitFlash && e.hitFlash > 0) {
          this.helperCtx.clearRect(0,0, 150, 150);
          this.emojiCache.draw(this.helperCtx, e.emoji, 75, 75, e.radius * 2);
          
          this.helperCtx.globalCompositeOperation = 'source-atop';
          this.helperCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          this.helperCtx.fillRect(0, 0, 150, 150);
          this.helperCtx.globalCompositeOperation = 'source-over';
          
          this.ctx.drawImage(this.helperCanvas, 0, 0, 150, 150, -75, -75, 150, 150);
      } else {
          this.emojiCache.draw(this.ctx, e.emoji, 0, 0, e.radius * 2);
      }

      this.ctx.restore();

      const hpPct = Math.max(0, e.hp / e.maxHp);
      const barY = e.y + e.radius + 5;
      this.ctx.fillStyle = '#1e293b'; 
      this.ctx.fillRect(e.x - e.radius, barY, e.radius * 2, 8);
      this.ctx.fillStyle = '#ef4444'; 
      this.ctx.fillRect(e.x - e.radius + 1, barY + 1, (e.radius * 2 - 2) * hpPct, 6);

      if (e.slowTimer && e.slowTimer > 0) {
        this.ctx.fillStyle = 'rgba(56, 189, 248, 0.8)';
        this.ctx.font = "bold 24px sans-serif";
        this.ctx.fillText('❄️', e.x - 12, e.y - e.radius - 10);
      }
    });
  }

  private drawProjectiles(gameState: GameState) {
    this.ctx.font = '24px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    gameState.projectiles.forEach(p => {
        if (p.emoji) {
            this.emojiCache.draw(this.ctx, p.emoji, p.x, p.y, p.radius * 2);
        } else {
             this.ctx.fillStyle = 'white';
             this.ctx.beginPath();
             this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
             this.ctx.fill();
        }
    });
  }
  
  private drawFloatingTexts(gameState: GameState) {
    gameState.floatingTexts.forEach(t => {
      this.ctx.save();
      this.ctx.globalAlpha = t.life / 0.8;
      this.ctx.font = `bold ${20 * t.scale}px 'Fredoka', sans-serif`;
      this.ctx.fillStyle = t.color;
      this.ctx.strokeStyle = 'black';
      this.ctx.lineWidth = 4;
      this.ctx.strokeText(t.text, t.x, t.y);
      this.ctx.fillText(t.text, t.x, t.y);
      this.ctx.restore();
    });
  }

  private drawAttackRange(unit: Unit, state: 'hover' | 'drag') {
    const x = GRID_OFFSET_X + unit.col * CELL_SIZE + CELL_SIZE / 2;
    const y = GRID_OFFSET_Y + unit.row * CELL_SIZE + CELL_SIZE / 2;
    const isGlobal = unit.type === 'MAGIC' || unit.range > 20 || (unit.isHero && unit.attackType === 'TRACKING');
    
    this.ctx.save();
    
    const time = performance.now() / 50;
    this.ctx.setLineDash([8, 8]);
    this.ctx.lineDashOffset = -time;

    const mainColor = unit.isHero ? '#22d3ee' : '#4ade80'; 
    const fillColor = unit.isHero ? 'rgba(34, 211, 238, 0.15)' : 'rgba(74, 222, 128, 0.15)';
    
    if (isGlobal) {
      const radius = unit.range * CELL_SIZE;
      
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();

      this.ctx.strokeStyle = mainColor;
      this.ctx.lineWidth = 3;
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.arc(x, y, radius - 10, 0, Math.PI * 2);
      this.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      this.ctx.lineWidth = 1;
      this.ctx.stroke();

    } else {
      const startX = x - CELL_SIZE/2 + 10;
      const startY = y - CELL_SIZE/2 + 10;
      const width = (unit.range * CELL_SIZE) - 20; 
      const height = CELL_SIZE - 20;

      this.ctx.beginPath();
      this.ctx.roundRect(startX, startY, width, height, 15);
      
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();

      this.ctx.strokeStyle = mainColor;
      this.ctx.lineWidth = 3;
      this.ctx.stroke();
      
      if (state === 'hover') {
          const endX = startX + width;
          const endY = y;
          this.ctx.font = '20px sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillStyle = mainColor;
          this.ctx.fillText('⌖', endX - 15, endY);
      }
    }
    
    this.ctx.restore();
  }
  
  private drawSelection(id: string | number, gameState: GameState) {
    let x = 0, y = 0, radius = 0;
    
    const unit = useGameStore.getState().gridUnits.find(u => u.id === id);
    if (unit) {
        const vis = this.visualUnits.get(unit.id);
        if(vis) {
            x = vis.x;
            y = vis.y;
            radius = 35;
        }
    } else {
        const enemy = gameState.enemies.find(e => e.id === id);
        if (enemy) {
            x = enemy.x;
            y = enemy.y;
            radius = enemy.radius;
        }
    }

    if (x > 0) {
        this.ctx.save();
        this.ctx.strokeStyle = '#facc15'; // Yellow-400
        this.ctx.lineWidth = 4;
        this.ctx.setLineDash([10, 5]);
        
        this.ctx.translate(x, y);
        this.ctx.rotate((performance.now() / 1000) * 1.5);
        
        this.ctx.beginPath();
        this.ctx.arc(0, 0, radius + 15, 0, Math.PI * 2);
        this.ctx.stroke();
        
        this.ctx.restore();
    }
  }
}
