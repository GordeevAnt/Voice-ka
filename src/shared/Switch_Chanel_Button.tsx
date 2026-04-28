import "./Switch_Chanel_Button.css"

interface SwitchChanelButtonProps {
    guildId: number;
    icon: string;
    isActive: boolean;
    onSelect: (guildId: number) => void;
}

export function Switch_Chanel_Button({ 
    guildId, 
    icon, 
    isActive, 
    onSelect 
}: SwitchChanelButtonProps) {
    const handleClick = () => {
        console.log(`🔄 Switch_Chanel_Button clicked: switching to guild ${guildId}`);
        onSelect(guildId);
    };

    return (
        <button 
            id={`guild-${guildId}`} 
            className={`switch-chanel-btn ${isActive ? 'active' : ''}`}
            onClick={handleClick}
            disabled={isActive}
        >
            <img src={icon} alt={`Channel ${guildId}`} />
        </button>
    )
}