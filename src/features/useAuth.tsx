// hooks/useAuth.ts
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { storeAPI } from "./useStore";

interface User {
    id: number;
    username: string;
    email: string;
    avatar?: string;
    status: string;
}

export const useAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const getCurrentUser = async () => {
            try {
                const sessionId = await storeAPI.get('session_id');
                const currentUser = await invoke<User>("get_current_user", { sessionId });
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