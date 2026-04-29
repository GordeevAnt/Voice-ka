import { memo } from "react";
import "./Switch_Room_Button.css";

type Props = {
    roomId: number;
    name: string;
    isActive?: boolean;
    // memberCount?: number | null;
    onSelect?: (roomId: number) => void;
};

export const Switch_Room_Button = memo(({ 
    roomId, 
    name, 
    isActive, 
    // memberCount, 
    onSelect,
}: Props) => {
    const handleClick = () => {
        // Запрещаем нажатие, если комната уже активна
        if (isActive) {
            return;
        }
        
        if (onSelect) {
            onSelect(roomId);
        }
    };
    
    return (
        <div 
            className={`switch-room-wrapper ${isActive ? "active" : ""}`}
            onClick={handleClick}
            role="button"
            tabIndex={isActive ? -1 : 0}  // Убираем из фокуса активную комнату
            style={{ cursor: isActive ? 'default' : 'pointer' }}  // Меняем курсор для активной
            onKeyPress={(e) => {
                if (isActive) return;  // Запрещаем клавиатурную активацию
                
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
            </div>
        </div>
    );
});

Switch_Room_Button.displayName = "Switch_Room_Button";