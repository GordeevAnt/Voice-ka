// src/components/UserPermissionsModal.tsx
import { useEffect, useState } from 'react';
import { apiService } from '../features/api.service';
import { storeAPI } from '../features/useStore';
import './UserPermissionsModal.css';

interface UserPermissionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: number;
    username: string;
    guildId: number;
    onPermissionsUpdated: () => void;
}

interface Permission {
    bit: number;
    name: string;
    description: string;
    category: 'general' | 'text' | 'voice' | 'video' | 'admin';
}

const AVAILABLE_PERMISSIONS: Permission[] = [
    // Права администратора
    { bit: 1 << 1, name: 'EDIT_GUILD', description: 'Редактирование сервера', category: 'admin' },
    { bit: 1 << 2, name: 'CREATE_ROOMS', description: 'Создание комнат', category: 'admin' },
    { bit: 1 << 3, name: 'EDIT_ROOMS', description: 'Редактирование комнат', category: 'admin' },
    { bit: 1 << 4, name: 'BAN_MEMBERS', description: 'Блокировать участников', category: 'admin' },
    { bit: 1 << 5, name: 'KICK_MEMBERS', description: 'Выгонять участников', category: 'admin' },
    
    // Текстовые права
    { bit: 1 << 6, name: 'SEND_MESSAGES', description: 'Отправка сообщений', category: 'text' },
];

const CATEGORY_NAMES: Record<string, string> = {
    'general': 'Общие',
    'admin': 'Администрирование',
    'text': 'Текстовые каналы',
    'voice': 'Голосовые каналы',
    'video': 'Видео'
};

export function UserPermissionsModal({
    isOpen,
    onClose,
    userId,
    username,
    guildId,
    onPermissionsUpdated
}: UserPermissionsModalProps) {
    const [currentPermissions, setCurrentPermissions] = useState<number>(0);
    const [selectedPermissions, setSelectedPermissions] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadKey, setLoadKey] = useState(0);

    // Загружаем права при открытии модального окна или изменении userId/guildId
    useEffect(() => {
        if (isOpen && guildId && userId) {
            console.log(`Loading permissions for user ${userId} (${username}) in guild ${guildId}`);
            loadPermissions();
        }
    }, [isOpen, guildId, userId, loadKey]);

    const loadPermissions = async () => {
        setLoading(true);
        try {
            // Очищаем кэш для этого пользователя
            const cacheKey = `user_permissions_${guildId}_${userId}`;
            await storeAPI.delete(cacheKey);
            
            // Загружаем права для целевого пользователя
            const perms = await apiService.getUserPermissionsInGuild(userId, guildId);
            console.log(`Loaded permissions for user ${userId} (${username}): ${perms} (binary: ${perms.toString(2)})`);
            setCurrentPermissions(perms);
            
            // Инициализируем выбранные права из текущих
            const selected = new Set<number>();
            for (const perm of AVAILABLE_PERMISSIONS) {
                if ((perms & perm.bit) !== 0) {
                    selected.add(perm.bit);
                }
            }
            setSelectedPermissions(selected);
        } catch (error) {
            console.error('Error loading permissions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePermissionToggle = (bit: number) => {
        const newSet = new Set(selectedPermissions);
        if (newSet.has(bit)) {
            newSet.delete(bit);
        } else {
            newSet.add(bit);
        }
        setSelectedPermissions(newSet);
    };

    const handleSelectAll = (category: string) => {
        const categoryPermissions = AVAILABLE_PERMISSIONS.filter(p => p.category === category);
        const allSelected = categoryPermissions.every(p => selectedPermissions.has(p.bit));
        
        const newSet = new Set(selectedPermissions);
        for (const perm of categoryPermissions) {
            if (allSelected) {
                newSet.delete(perm.bit);
            } else {
                newSet.add(perm.bit);
            }
        }
        setSelectedPermissions(newSet);
    };

    const isCategoryFullySelected = (category: string): boolean => {
        const categoryPermissions = AVAILABLE_PERMISSIONS.filter(p => p.category === category);
        return categoryPermissions.length > 0 && categoryPermissions.every(p => selectedPermissions.has(p.bit));
    };

    const isCategoryPartiallySelected = (category: string): boolean => {
        const categoryPermissions = AVAILABLE_PERMISSIONS.filter(p => p.category === category);
        const selectedCount = categoryPermissions.filter(p => selectedPermissions.has(p.bit)).length;
        return selectedCount > 0 && selectedCount < categoryPermissions.length;
    };

    const calculateNewPermissions = (): number => {
        let perms = 0;
        for (const bit of selectedPermissions) {
            perms |= bit;
        }
        return perms;
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const newPermissions = calculateNewPermissions();
            console.log(`Saving permissions for user ${userId} in guild ${guildId}: ${newPermissions} (binary: ${newPermissions.toString(2)})`);
            
            // Используем прямой метод обновления прав пользователя
            const result = await apiService.updateUserPermissionsDirect(userId, guildId, newPermissions);
            
            if (result) {
                console.log('Permissions updated successfully');
                
                // Очищаем кэш
                await storeAPI.delete(`user_permissions_${guildId}_${userId}`);
                
                // Обновляем локальное состояние
                setCurrentPermissions(newPermissions);
                
                // Уведомляем родительский компонент
                onPermissionsUpdated();
                
                // Закрываем модальное окно
                onClose();
            } else {
                console.error('Failed to update permissions');
            }
        } catch (error) {
            console.error('Error saving permissions:', error);
        } finally {
            setSaving(false);
        }
    };

    // Группировка прав по категориям
    const groupedPermissions = AVAILABLE_PERMISSIONS.reduce((acc, perm) => {
        if (!acc[perm.category]) {
            acc[perm.category] = [];
        }
        acc[perm.category].push(perm);
        return acc;
    }, {} as Record<string, Permission[]>);

    if (!isOpen) return null;

    return (
        <div className="permissions-modal-overlay" onClick={onClose}>
            <div className="permissions-modal permissions-modal-large" onClick={(e) => e.stopPropagation()}>
                <div className="permissions-modal-header">
                    <h3>Управление правами</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                
                <div className="permissions-modal-body">
                    <p className="target-user">
                        Пользователь: <strong>{username}</strong> (ID: {userId})
                    </p>
                    
                    {loading ? (
                        <div className="loading">Загрузка прав...</div>
                    ) : (
                        <>
                            <div className="permissions-summary">
                                <span>Текущие права (битовая маска): </span>
                                <code className="permissions-bits">
                                    {currentPermissions} = {currentPermissions.toString(2).padStart(32, '0')}
                                </code>
                            </div>
                            <div className="permissions-groups">
                                {Object.entries(groupedPermissions).map(([category, perms]) => (
                                    <div key={category} className="permission-group">
                                        <div className="permission-group-header">
                                            <label className="group-select-all">
                                                <input
                                                    type="checkbox"
                                                    checked={isCategoryFullySelected(category)}
                                                    ref={(el) => {
                                                        if (el) {
                                                            el.indeterminate = isCategoryPartiallySelected(category);
                                                        }
                                                    }}
                                                    onChange={() => handleSelectAll(category)}
                                                />
                                                <span className="group-title">{CATEGORY_NAMES[category]}</span>
                                            </label>
                                        </div>
                                        <div className="permission-group-items">
                                            {perms.map(perm => (
                                                <label key={perm.bit} className="permission-item">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedPermissions.has(perm.bit)}
                                                        onChange={() => handlePermissionToggle(perm.bit)}
                                                    />
                                                    <div className="permission-info">
                                                        <span className="permission-name">{perm.name}</span>
                                                        <span className="permission-description">{perm.description}</span>
                                                    </div>
                                                    <code className="permission-bit">
                                                        {perm.bit} = {(perm.bit).toString(2)}
                                                    </code>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
                
                <div className="permissions-modal-footer">
                    <button className="cancel-btn" onClick={onClose}>
                        Отмена
                    </button>
                    <button 
                        className="save-btn" 
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                </div>
            </div>
        </div>
    );
}