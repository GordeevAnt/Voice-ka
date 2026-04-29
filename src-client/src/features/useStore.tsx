// hooks/useStore.ts
import { Store } from '@tauri-apps/plugin-store';
import { useEffect, useState } from 'react';

// Создаем уникальное хранилище для каждого экземпляра приложения
// Используем sessionStorage для хранения имени файла хранилища для текущей сессии
const getStoreFileName = (): string => {
    let storeName = sessionStorage.getItem('store_name');
    if (!storeName) {
        // Создаем уникальное имя для этого экземпляра
        const instanceId = crypto.randomUUID();
        storeName = `app_store_${instanceId}.json`;
        sessionStorage.setItem('store_name', storeName);
    }
    return storeName;
};

// Класс для работы с хранилищем
class AppStore {
    private static instance: AppStore | null = null;
    private store: Store | null = null;
    private isInitialized = false;
    private pendingOperations: (() => void)[] = [];

    private constructor() {}

    static getInstance(): AppStore {
        if (!AppStore.instance) {
            AppStore.instance = new AppStore();
        }
        return AppStore.instance;
    }

    async init(): Promise<void> {
        if (this.isInitialized) return;
        
        const fileName = getStoreFileName();
        console.log(`Initializing store: ${fileName}`);
        
        this.store = await Store.load(fileName);
        this.isInitialized = true;
        
        // Выполняем ожидающие операции
        while (this.pendingOperations.length) {
            const op = this.pendingOperations.shift();
            if (op) op();
        }
    }

    private async ensureInit(): Promise<void> {
        if (!this.isInitialized) {
            await this.init();
        }
    }

    async get<T>(key: string): Promise<T | null> {
        await this.ensureInit();
        if (!this.store) return null;
        const value = await this.store.get<T>(key);
        // T | undefined преобразуем в T | null
        return value !== undefined ? value : null;
    }

    async set(key: string, value: any): Promise<void> {
        await this.ensureInit();
        if (!this.store) return;
        await this.store.set(key, value);
        await this.store.save();
    }

    async delete(key: string): Promise<void> {
        await this.ensureInit();
        if (!this.store) return;
        await this.store.delete(key);
        await this.store.save();
    }

    async clear(): Promise<void> {
        await this.ensureInit();
        if (!this.store) return;
        const keys = await this.store.keys();
        for (const key of keys) {
            await this.store.delete(key);
        }
        await this.store.save();
    }

    async keys(): Promise<string[]> {
        await this.ensureInit();
        if (!this.store) return [];
        return await this.store.keys();
    }
}

// Экспортируем функции для удобного использования
export const storeAPI = {
    async get<T>(key: string): Promise<T | null> {
        const store = AppStore.getInstance();
        return await store.get<T>(key);
    },
    
    async set(key: string, value: any): Promise<void> {
        const store = AppStore.getInstance();
        await store.set(key, value);
    },
    
    async delete(key: string): Promise<void> {
        const store = AppStore.getInstance();
        await store.delete(key);
    },
    
    async clear(): Promise<void> {
        const store = AppStore.getInstance();
        await store.clear();
    },
    
    async keys(): Promise<string[]> {
        const store = AppStore.getInstance();
        return await store.keys();
    }
};

// Хук для использования в компонентах
export const useStore = () => {
    const [isReady, setIsReady] = useState(false);
    const [store] = useState(() => storeAPI);

    useEffect(() => {
        const initStore = async () => {
            const store = AppStore.getInstance();
            await store.init();
            setIsReady(true);
        };
        initStore();
    }, []);

    return { store, isReady };
};