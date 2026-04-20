import { memo } from "react";
import "./Switch_Room_Button.css";

type Props = {
    roomId: number;
    name: string;
    isActive?: boolean;
    memberCount?: number | null;
    onSelect?: (roomId: number) => void;
    onDelete?: (roomId: number) => void;
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
        e.stopPropagation();
        if (onDelete) {
            onDelete(roomId);
        }
    };
    
    return (
        <div 
            className={`switch-room-wrapper ${isActive ? "active" : ""}`}
            onClick={handleClick}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    handleClick();
                }
            }}
        >
            <div className="switch-room-content">
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
                            type="button"
                        >
                            🗑️
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});

Switch_Room_Button.displayName = "Switch_Room_Button";