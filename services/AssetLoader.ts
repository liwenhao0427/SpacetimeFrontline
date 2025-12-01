
import { Log } from './Log';

class AssetLoader {
    private static instance: AssetLoader;
    private textures: Map<string, HTMLImageElement> = new Map();
    private loadingPromises: Map<string, Promise<void>> = new Map();

    private constructor() {}

    public static getInstance(): AssetLoader {
        if (!AssetLoader.instance) {
            AssetLoader.instance = new AssetLoader();
        }
        return AssetLoader.instance;
    }

    /**
     * 加载单个图片资源
     * @param id 资源ID (如 'atlas_main')
     * @param src 图片路径
     */
    public async loadTexture(id: string, src: string): Promise<void> {
        if (this.textures.has(id)) return;
        if (this.loadingPromises.has(id)) return this.loadingPromises.get(id);

        const promise = new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous"; // 允许跨域加载CDN资源
            img.src = src;
            img.onload = () => {
                this.textures.set(id, img);
                Log.log('AssetLoader', `Loaded texture: ${id}`);
                resolve();
            };
            img.onerror = (e) => {
                Log.error('AssetLoader', `Failed to load texture: ${id} from ${src}`);
                // Don't reject, just warn, so game can continue with emojis
                resolve();
            };
        });

        this.loadingPromises.set(id, promise);
        return promise;
    }

    /**
     * 获取已加载的图片
     */
    public getTexture(id: string): HTMLImageElement | undefined {
        return this.textures.get(id);
    }

    /**
     * 预加载所有核心资源
     */
    public async preloadCoreAssets() {
        // 加载英雄主角的精灵图 - Keqing
        await this.loadTexture('hero_zhuyuan', 'https://raw.githubusercontent.com/liwenhao0427/towerImg/main/units/keqing.png');
    }
}

export const assetLoader = AssetLoader.getInstance();
