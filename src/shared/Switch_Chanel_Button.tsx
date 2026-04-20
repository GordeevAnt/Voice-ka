import "./Switch_Chanel_Button.css"

//
// Кнопка перехода на канал
//

export function Switch_Chanel_Button({guildId, icon}: {guildId: number, icon: string}) {
    return <button id={`guild ${ guildId.toString()}`} className="switch-chanel-btn">
        <img src={icon} />
    </button>
}