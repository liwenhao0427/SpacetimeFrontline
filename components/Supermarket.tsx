
import React, { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { UNIT_POOLS } from '../data/units';
import { ITEM_POOLS } from '../data/items';
import { UnitData, BrotatoItem } from '../types';
import { RARITY_COLORS, TIER_TO_RARITY, RARITY_BG_COLORS } from '../constants';
import { ShoppingCart, Sword, Package, X, Check, AlertCircle, Terminal, Zap } from 'lucide-react';

interface SupermarketProps {
  onClose: () => void;
}

type Tab = 'UNITS' | 'ITEMS' | 'DEBUG';

// Debug items definition
const DEBUG_ITEMS: BrotatoItem[] = [
    { id: 'debug_hp_percent', name: '泰坦药剂', tier: 4, price: 0, stats: { hpPercent: 0.5 }, desc: '+50% 最大生命值' },
    { id: 'debug_gold', name: '无限黑卡', tier: 4, price: 0, effect: { generate_gold: 9999 }, desc: '瞬间获得 9999 金币 (点击购买)' },
    { id: 'debug_damage', name: '一拳超人', tier: 4, price: 0, stats: { damagePercent: 1.0 }, desc: '+100% 伤害' },
    { id: 'debug_speed', name: '子弹时间', tier: 4, price: 0, stats: { attackSpeed: 0.5 }, desc: '+50% 攻击速度' },
    { id: 'debug_flat_hp', name: '生命水晶', tier: 3, price: 0, stats: { flatHp: 100 }, desc: '+100 基础生命' },
];

export const Supermarket: React.FC<SupermarketProps> = ({ onClose }) => {
  const { buyUnit, buyBrotatoItem, addGold } = useGameStore();
  const [activeTab, setActiveTab] = useState<Tab>('UNITS');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleBuyUnit = (unit: UnitData) => {
    // Cheat: Price is 0
    const success = buyUnit(unit, 0);
    if (success) {
      setFeedback(`已添加单位: ${unit.name}`);
    } else {
      setFeedback("场地已满！无法添加。");
    }
    setTimeout(() => setFeedback(null), 1500);
  };

  const handleBuyItem = (item: BrotatoItem) => {
    if (item.id === 'debug_gold') {
        addGold(9999);
        setFeedback(`获得 9999 金币`);
    } else {
        // Cheat: Price is 0
        buyBrotatoItem({ ...item, price: 0 });
        setFeedback(`已添加道具: ${item.name}`);
    }
    setTimeout(() => setFeedback(null), 1500);
  };

  return (
    <div className="absolute inset-0 z-[80] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-white w-full max-w-6xl h-[85vh] rounded-[40px] shadow-2xl flex flex-col overflow-hidden border-4 border-purple-500 relative">
        
        {/* Header */}
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
             <div className="bg-purple-500 p-3 rounded-2xl text-white shadow-lg shadow-purple-200">
                <ShoppingCart size={32} />
             </div>
             <div>
                 <h2 className="text-3xl font-black text-slate-800 tracking-tight">DEV SUPERMARKET</h2>
                 <p className="text-purple-500 font-bold text-sm uppercase tracking-wider">调试模式 // 免费获取 // 系列浏览</p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="p-3 bg-slate-200 hover:bg-red-100 hover:text-red-500 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100/50">
           <button 
             onClick={() => setActiveTab('UNITS')}
             className={`flex-1 py-4 font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-colors
               ${activeTab === 'UNITS' ? 'bg-white text-purple-600 border-b-4 border-purple-500' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-600'}
             `}
           >
              <Sword size={18} /> 单位 (Units)
           </button>
           <button 
             onClick={() => setActiveTab('ITEMS')}
             className={`flex-1 py-4 font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-colors
               ${activeTab === 'ITEMS' ? 'bg-white text-purple-600 border-b-4 border-purple-500' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-600'}
             `}
           >
              <Package size={18} /> 道具 (Items)
           </button>
           <button 
             onClick={() => setActiveTab('DEBUG')}
             className={`flex-1 py-4 font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-colors
               ${activeTab === 'DEBUG' ? 'bg-white text-red-600 border-b-4 border-red-500' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-600'}
             `}
           >
              <Terminal size={18} /> 调试工具 (Debug)
           </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/30 custom-scrollbar">
           
           {feedback && (
             <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[90] bg-slate-800 text-white px-6 py-3 rounded-full font-bold shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
               {feedback.includes('满') ? <AlertCircle size={20} className="text-red-400"/> : <Check size={20} className="text-green-400"/>}
               {feedback}
             </div>
           )}

           {activeTab === 'UNITS' && (
               <div className="space-y-8">
                   {Object.entries(UNIT_POOLS).map(([poolName, units]) => (
                       <div key={poolName}>
                           <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 border-b pb-2 border-slate-200">{poolName.replace(/_/g, ' ')}</h3>
                           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                               {units.map(unit => {
                                   const rarity = TIER_TO_RARITY[unit.tier];
                                   const color = RARITY_COLORS[rarity];
                                   const bgColor = RARITY_BG_COLORS[rarity];
                                   return (
                                       <button 
                                          key={unit.id}
                                          onClick={() => handleBuyUnit(unit)}
                                          className={`relative flex flex-col items-center p-3 border-2 rounded-xl bg-white hover:scale-105 transition-all text-center group ${bgColor}`}
                                          style={{ borderColor: color }}
                                       >
                                           <div className="text-3xl mb-2">{unit.emoji}</div>
                                           <div className="font-bold text-slate-800 text-xs mb-1 truncate w-full">{unit.name}</div>
                                           <div className="text-[10px] text-slate-400">Tier {unit.tier}</div>
                                       </button>
                                   );
                               })}
                           </div>
                       </div>
                   ))}
               </div>
           )}

           {activeTab === 'ITEMS' && (
               <div className="space-y-8">
                   {Object.entries(ITEM_POOLS).map(([poolName, items]) => (
                       <div key={poolName}>
                           <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 border-b pb-2 border-slate-200">{poolName.replace(/_/g, ' ')}</h3>
                           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                               {items.map(item => {
                                   const rarity = TIER_TO_RARITY[item.tier];
                                   const color = RARITY_COLORS[rarity];
                                   const bgColor = RARITY_BG_COLORS[rarity];
                                   return (
                                       <button 
                                          key={item.id}
                                          onClick={() => handleBuyItem(item)}
                                          className={`relative flex flex-col items-center p-3 border-2 rounded-xl bg-white hover:scale-105 transition-all text-center group ${bgColor}`}
                                          style={{ borderColor: color }}
                                       >
                                           <div className="text-2xl mb-2 bg-white w-10 h-10 flex items-center justify-center rounded shadow-sm font-bold text-slate-700">{item.name.charAt(0)}</div>
                                           <div className="font-bold text-slate-800 text-xs mb-1 truncate w-full">{item.name}</div>
                                           <div className="text-[10px] text-slate-500 line-clamp-2 h-6 leading-tight opacity-70">{item.desc}</div>
                                       </button>
                                   );
                               })}
                           </div>
                       </div>
                   ))}
               </div>
           )}

           {activeTab === 'DEBUG' && (
               <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                   {DEBUG_ITEMS.map(item => (
                       <button 
                          key={item.id}
                          onClick={() => handleBuyItem(item)}
                          className="relative flex flex-col items-center p-4 border-4 border-dashed border-red-300 rounded-xl bg-red-50 hover:bg-red-100 hover:scale-105 transition-all text-center"
                       >
                           <div className="text-3xl mb-2 text-red-500"><Zap /></div>
                           <div className="font-black text-red-700 text-sm mb-1">{item.name}</div>
                           <div className="text-[10px] text-red-500 font-bold">{item.desc}</div>
                       </button>
                   ))}
               </div>
           )}
        </div>

      </div>
    </div>
  );
};
