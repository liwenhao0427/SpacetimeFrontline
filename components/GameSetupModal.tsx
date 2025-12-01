

import React, { useState } from 'react';
import { GameConfig } from '../types';
import { HEROES, UNIT_POOLS } from '../data/units';
import { ITEM_POOLS } from '../data/items';
import { WAVE_CONFIGS } from '../data/waves';
import { ChevronRight, Play, CheckCircle2, Circle } from 'lucide-react';

interface GameSetupModalProps {
  onConfirm: (config: GameConfig) => void;
}

export const GameSetupModal: React.FC<GameSetupModalProps> = ({ onConfirm }) => {
  const [heroId, setHeroId] = useState<string>(HEROES[0]?.id || '');
  const [unitPools, setUnitPools] = useState<string[]>(Object.keys(UNIT_POOLS));
  const [itemPools, setItemPools] = useState<string[]>(Object.keys(ITEM_POOLS));
  const [waveConfigId, setWaveConfigId] = useState<string>('STANDARD_CAMPAIGN');

  const handleConfirm = () => {
    onConfirm({
      selectedHeroId: heroId,
      selectedUnitPools: unitPools,
      selectedItemPools: itemPools,
      selectedWaveConfigId: waveConfigId
    });
  };

  const togglePool = (poolId: string, currentList: string[], setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (currentList.includes(poolId)) {
        if (currentList.length > 1) { // Prevent deselecting last one
            setter(currentList.filter(id => id !== poolId));
        }
    } else {
        setter([...currentList, poolId]);
    }
  };

  return (
    <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md z-[110] flex items-center justify-center p-8 animate-in fade-in zoom-in-95">
      <div className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl flex flex-col overflow-hidden border-4 border-slate-200 max-h-[90vh]">
        
        <div className="p-8 border-b border-slate-100 bg-slate-50">
           <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-2">战术整备</h2>
           <p className="text-slate-500 font-bold">配置你的战场环境</p>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            
            {/* HERO SELECTION */}
            <section className="mb-8">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">选择英雄</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {HEROES.map(hero => (
                        <button 
                            key={hero.id}
                            onClick={() => setHeroId(hero.id)}
                            className={`p-4 rounded-2xl border-2 flex items-center gap-4 transition-all text-left
                                ${heroId === hero.id ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-100 bg-white hover:border-slate-300'}
                            `}
                        >
                            <div className="text-4xl bg-white w-16 h-16 rounded-xl flex items-center justify-center shadow-sm border border-slate-100">
                                {hero.emoji}
                            </div>
                            <div>
                                <div className="font-black text-slate-800 text-lg">{hero.name}</div>
                                <div className="text-xs text-slate-500 font-bold mt-1 line-clamp-1">{hero.desc}</div>
                            </div>
                            <div className="ml-auto">
                                {heroId === hero.id ? <CheckCircle2 className="text-purple-500" /> : <Circle className="text-slate-200" />}
                            </div>
                        </button>
                    ))}
                </div>
            </section>

            {/* WAVE CONFIG */}
            <section className="mb-8">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">波次配置</h3>
                <div className="flex flex-wrap gap-4">
                    {Object.keys(WAVE_CONFIGS).map(configId => (
                        <button 
                            key={configId}
                            onClick={() => setWaveConfigId(configId)}
                            className={`px-6 py-3 rounded-xl font-bold border-2 transition-all
                                ${waveConfigId === configId ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 bg-white text-slate-500 hover:bg-slate-50'}
                            `}
                        >
                            {configId.replace(/_/g, ' ')}
                        </button>
                    ))}
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* UNIT POOLS */}
                <section>
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">单位池 (可多选)</h3>
                    <div className="space-y-3">
                        {Object.keys(UNIT_POOLS).map(poolId => (
                            <button 
                                key={poolId}
                                onClick={() => togglePool(poolId, unitPools, setUnitPools)}
                                className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all
                                    ${unitPools.includes(poolId) ? 'border-green-500 bg-green-50' : 'border-slate-100 bg-white opacity-60 hover:opacity-100'}
                                `}
                            >
                                <span className="font-bold text-slate-700">{poolId.replace(/_/g, ' ')}</span>
                                {unitPools.includes(poolId) && <CheckCircle2 size={20} className="text-green-600"/>}
                            </button>
                        ))}
                    </div>
                </section>

                {/* ITEM POOLS */}
                <section>
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">道具池 (可多选)</h3>
                    <div className="space-y-3">
                        {Object.keys(ITEM_POOLS).map(poolId => (
                            <button 
                                key={poolId}
                                onClick={() => togglePool(poolId, itemPools, setItemPools)}
                                className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all
                                    ${itemPools.includes(poolId) ? 'border-orange-500 bg-orange-50' : 'border-slate-100 bg-white opacity-60 hover:opacity-100'}
                                `}
                            >
                                <span className="font-bold text-slate-700">{poolId.replace(/_/g, ' ')}</span>
                                {itemPools.includes(poolId) && <CheckCircle2 size={20} className="text-orange-600"/>}
                            </button>
                        ))}
                    </div>
                </section>
            </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button 
                onClick={handleConfirm}
                className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xl hover:scale-105 transition-transform shadow-xl shadow-slate-300"
            >
                开始游戏 <Play fill="white" size={20} />
            </button>
        </div>
      </div>
    </div>
  );
};
