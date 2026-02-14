import "./Room_Button.css"

//
// Кнопка переключения комнаты
//

export function Room_Button() {
    return <button className="room-btn">
        <img src="../public/minimize.svg"/>
        <p>Название</p>
    </button>
}