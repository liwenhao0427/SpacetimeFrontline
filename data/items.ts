

import { BrotatoItem } from "../types";

const NATURES_GIFT: BrotatoItem[] = [
    { "id": "ant_power", "name": "蚂蚁之力", "tier": 1, "price": 30, "stats": { "meleeDmg": 2 }, "desc": "+2 近战伤害 🔪" },
    { "id": "bee_stinger", "name": "蜜蜂蜇针", "tier": 1, "price": 62, "stats": { "rangedDmg": 1, "atkSpeed": 0.05 }, "desc": "+1 远程伤害 🏹, +5% 攻击速度 💨" },
    { "id": "lucky_cat", "name": "招财猫", "tier": 1, "price": 40, "max": 5, "effect": { "shop_discount": 5 }, "desc": "商店价格 -5% 🛒 (最大5个)" },
    { "id": "hummingbird_nectar", "name": "蜂鸟蜜", "tier": 1, "price": 63, "stats": { "atkSpeed": 0.1, "percentDmg": -0.02 }, "desc": "+10% 攻击速度 💨, -2% 伤害 ⚔️" },
    { "id": "firefly_lantern", "name": "萤火虫灯笼", "tier": 1, "price": 60, "stats": { "elementalDmg": 2 }, "desc": "+2 魔法伤害 🔮" },
    { "id": "turtle_shell", "name": "硬龟壳", "tier": 1, "price": 10, "stats": { "flatHp": 10 }, "desc": "+10 最大生命值 ❤️" },
    { "id": "rabbit_foot", "name": "兔子脚", "tier": 1, "price": 30, "stats": { "luck": 15, "elementalDmg": -1 }, "desc": "+15 幸运 🍀, -1 魔法伤害 🔮" },
    { "id": "mole_claws", "name": "鼹鼠爪", "tier": 1, "price": 50, "stats": { "crit": 0.06, "percentDmg": -0.03 }, "desc": "+6% 暴击率 🎯, -3% 伤害 ⚔️" },
    { "id": "friendly_alien_frog", "name": "友善的外星蛙", "tier": 1, "price": -20, "max": 10, "stats": { "percentDmg": 0.05 }, "effect": { "enemy_count": 5 }, "desc": "+5% 伤害 ⚔️, 敌人数量 +5% 👾" },
    { "id": "earthworm", "name": "蚯蚓", "tier": 1, "price": -2, "stats": { "harvesting": 8, "meleeDmg": -1 }, "desc": "+8 收获 🌿, -1 近战伤害 🔪" },
    { "id": "alien_eyes", "name": "外星眼", "tier": 2, "price": 60, "effect": { "alien_eyes_count": 6 }, "desc": "每5秒向周围发射 6 个外星眼 (50% 伤害)" },
    { "id": "little_frog", "name": "小青蛙", "tier": 2, "price": 40, "stats": { "harvesting": 10 }, "desc": "+10 收获" },
    { "id": "chameleon_skin", "name": "变色龙皮", "tier": 3, "price": 50, "effect": { "stationary_dmg": 25 }, "desc": "静止时, 伤害+25% ⚔️" },
    { "id": "bear_paw", "name": "熊掌", "tier": 3, "price": 513, "stats": { "meleeDmg": 8, "rangedDmg": 8, "elementalDmg": 8 }, "desc": "所有扁平伤害+8 (🔪, 🏹, 🔮)" },
    { "id": "four_leaf_clover", "name": "四叶草", "tier": 3, "price": 60, "stats": { "luck": 20 }, "desc": "+20 幸运 🍀" },
    { "id": "mammoth_tusk", "name": "猛犸象牙", "tier": 4, "price": 203, "stats": { "meleeDmg": 15, "percentDmg": -0.08 }, "desc": "+15 近战伤害 🔪, -8% 伤害 ⚔️" },
    { "id": "dragon_scale", "name": "龙鳞", "tier": 4, "price": 50, "stats": { "flatHp": 50 }, "desc": "+50 最大生命值 ❤️" }
];

const INDUSTRIAL_TECH: BrotatoItem[] = [
    { "id": "boxing_glove", "name": "拳击手套", "tier": 1, "price": 15, "stats": { "knockback": 3 }, "desc": "+3 击退" },
    { "id": "charcoal", "name": "木炭", "tier": 1, "price": 54, "stats": { "elementalDmg": 1, "meleeDmg": 2, "harvesting": -2 }, "desc": "+1 元素伤害, +2 近战伤害, -2 收获" },
    { "id": "coffee", "name": "咖啡", "tier": 1, "price": 58, "stats": { "atkSpeed": 0.1, "percentDmg": -0.02 }, "desc": "+10% 攻击速度, -2% 伤害" },
    { "id": "dynamite", "name": "炸药", "tier": 1, "price": 30, "effect": { "explosion_dmg": 15 }, "desc": "+15% 爆炸伤害" },
    { "id": "fertilizer", "name": "化肥", "tier": 1, "price": 25, "stats": { "harvesting": 8, "meleeDmg": -1 }, "desc": "+8 收获, -1 近战伤害" },
    { "id": "injection", "name": "针剂", "tier": 1, "price": 56, "stats": { "percentDmg": 0.07 }, "desc": "+7% 伤害" },
    { "id": "lens", "name": "透镜", "tier": 1, "price": 30, "stats": { "rangedDmg": 1 }, "desc": "+1 远程伤害" },
    { "id": "propeller_hat", "name": "螺旋桨帽", "tier": 1, "price": 14, "stats": { "luck": 10, "percentDmg": -0.02 }, "desc": "+10 幸运, -2% 伤害" },
    { "id": "small_magazine", "name": "小弹夹", "tier": 2, "price": 150, "stats": { "rangedDmg": 2, "atkSpeed": 0.1, "percentDmg": -0.06 }, "desc": "+2 远程, +10% 攻速, -6% 伤害" },
    { "id": "alloy", "name": "合金", "tier": 3, "price": 212, "stats": { "meleeDmg": 3, "rangedDmg": 3, "crit": 0.05 }, "desc": "全伤害属性提升 +3, +5% 暴击" },
    { "id": "explosive_shells", "name": "爆炸弹", "tier": 4, "price": 60, "stats": { "percentDmg": -0.15 }, "effect": { "explosion_dmg": 60 }, "desc": "+60% 爆炸伤害, -15% 伤害" },
    { "id": "heavy_bullets", "name": "重型子弹", "tier": 4, "price": 194, "stats": { "rangedDmg": 5, "percentDmg": 0.1, "atkSpeed": -0.1, "crit": -0.05 }, "desc": "+5 远程, +10% 伤害, -10% 攻速" },
    { "id": "ricochet", "name": "跳弹", "tier": 4, "price": 90, "stats": { "percentDmg": -0.35 }, "effect": { "bounce_plus_1": 1 }, "desc": "子弹弹射 +1, -35% 伤害" }
];

export const ITEM_POOLS: Record<string, BrotatoItem[]> = {
    "NATURES_GIFT": NATURES_GIFT,
    "INDUSTRIAL_TECH": INDUSTRIAL_TECH
};

// Flatten for default behavior
export const ITEMS_DATA: BrotatoItem[] = Object.values(ITEM_POOLS).flat();