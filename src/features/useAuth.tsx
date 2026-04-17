// hooks/useAuth.ts
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface User {
    id: number;
    username: string;
    email: string;
}

export const useAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Получаем текущего пользователя из бэкенда
        const getCurrentUser = async () => {
            try {
                const currentUser = await invoke<User>("get_current_user");
                setUser(currentUser);
            } catch (error) {
                console.error("Failed to get current user:", error);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        getCurrentUser();
    }, []);

    return { user, loading };
};