# 美术资源流水线与规范文档 (v2.0 - ZZZ Style)

本文档定义了《超时空防线》的高级美术风格，采用米哈游《绝区零》(Zenless Zero Zone) 的潮酷、高对比度与故障艺术风格。

## 1. 核心视觉风格 (Visual Style)

*   **风格关键词:** Zenless Zone Zero, Hoyoverse, Urban Punk, Pop Art, Glitch Effect.
*   **渲染:** Stylized 3D rendering 转 2D Sprite, Highres, Detailed texture.
*   **比例:** Chibi / SD Style (2.5头身 - 3头身), Large head, Full body.
*   **轮廓:** Sharp outlines, Clean silhouette.

## 2. 英雄单位 Sprite Sheet 规范

英雄单位使用 **2行 x 16列** 序列帧图集。这种水平布局的图集有利于定义长动画序列。

### 2.1 文件格式
*   **路径:** `assets/hero_[name].png`
*   **背景:** 透明 (Transparent)
*   **推荐尺寸:** 单帧 128x128 px (总图 2048x256 px)

### 2.2 动作序列定义 (Sequence Chart)

图集必须严格按照以下行顺序排列：

**Row 1: IDLE / ATTACK (待机与攻击)**
*   **描述:** 包含一个完整的攻击循环动画。在非攻击状态时，可以循环播放此动画的前几帧作为待机动作，或者直接使用攻击动画作为待机动作以表现持续的战斗准备状态。
*   **Prompt:** `Row 1 (16 frames): A full combat animation sequence, starting from an active combat stance, leading into a powerful attack (e.g., firing a gun with muzzle flash and heavy recoil), and then returning to the ready stance. The motion should be fluid and impactful.`
*   **逻辑:** `IDLE` 状态可循环播放，`ATTACK` 状态单次播放。当前实现中，`IDLE` 和 `ATTACK` 共享此行，通过不同的播放逻辑（循环/单次）和速度来区分。

**Row 2: DEATH (死亡)**
*   **描述:** 角色倒地、消失或碎裂，并伴随数码故障或能量消散的特效。
*   **Prompt:** `Row 2 (16 frames): A death animation sequence. The character gets hit, stumbles, falls to the ground, and then dissolves with a digital glitch effect or fades out.`
*   **逻辑:** 单次播放，播放结束后停留在最后一帧 (Clamp)。

**注意:** 当前的主角精灵图中**不包含**独立的 `HIT` (受击) 动画。受击效果通过代码中的白色闪烁滤镜实现。

---

## 3. AI 生成提示词模板 (Prompt Template)

请使用以下模板生成新的单位资源：

```text
masterpiece, best quality, highres,
// 风格
zenless zone zero, hoyoverse, game cg style, stylized 3d rendering, detailed texture,
// 角色
character: [Character Name/Description, e.g., a cool girl with purple hair holding a futuristic rifle],
chibi, SD style, large head, full body, tower defense unit,
// 格式
2d sprite sheet, game sprite, sequence chart, 2 rows, 16 columns, white background, simple background,
side view,
// 动作
Row 1 (16 frames): A full combat animation sequence, starting from an active combat stance, leading into a powerful attack (e.g., firing a gun with muzzle flash and heavy recoil), and then returning to the ready stance. The motion should be fluid and impactful.
Row 2 (16 frames): A death animation sequence. The character gets hit, stumbles, falls to the ground, and then dissolves with a digital glitch effect or fades out.
// 细节
consistent character details, sharp outlines, clean silhouette, smooth animation flow.
```

## 4. 导入流程

1.  将生成的 Sprite Sheet 放入 `public/assets/` 目录或一个可公开访问的图床。
2.  在 `data/units.ts` 或 `constants.ts` 中为对应的单位配置 `spriteConfig` 对象。
3.  确保 `textureId` 是一个唯一的标识符。
4.  在 `services/AssetLoader.ts` 的 `preloadCoreAssets` 方法中调用 `loadTexture` 来预加载该资源，将 `textureId` 和图片URL作为参数。