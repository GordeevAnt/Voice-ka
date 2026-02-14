import "./Switch_Room_Button.css"

//
// Кнопка переключения комнаты
//

export function Switch_Room_Button() {
    return <button className="switch-room-btn">
        <img src="../public/minimize.svg"/>
        <p>Название</p>
    </button>
}