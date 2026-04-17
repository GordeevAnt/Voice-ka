import { memo } from "react";
import "./Switch_Room_Button.css";

type Props = {
    roomId: number;
    name: string;
    isActive?: boolean;
    memberCount?: number | null;
    onSelect?: (roomId: number) => void;
    onDelete?: (roomId: number) => void; // Добавляем onDelete
};

export const Switch_Room_Button = memo(({ 
    roomId, 
    name, 
    isActive, 
    memberCount, 
    onSelect,
    onDelete 
    }: Props) => {
    const handleClick = () => {
        if (onSelect) {
        onSelect(roomId);
        }
    };
    
    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation(); // Предотвращаем срабатывание onClick кнопки
        if (onDelete) {
        onDelete(roomId);
        }
    };
    
    return (
        <button 
        className={`switch-room-btn ${isActive ? "active" : ""}`} 
        onClick={handleClick}
        >
        <div className="room-info">
            <span className="room-icon">#</span>
            <p className="room-name">{name}</p>
        </div>
        <div className="room-right">
            {memberCount !== undefined && memberCount !== null && (
            <span className="member-count">{memberCount}</span>
            )}
            {onDelete && (
            <button 
                className="delete-room-btn" 
                onClick={handleDelete}
                title="Удалить комнату"
            >
                🗑️
            </button>
            )}
        </div>
        </button>
    );
});

Switch_Room_Button.displayName = "Switch_Room_Button";