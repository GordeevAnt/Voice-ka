import "./Message_Input.css"

//
// Виджет ввода сообщений
//

export default function Message_Input() {
    return <div className="message-input-container">

        <button id="message-smile">Смайлик</button>
        
        <div className="message-input-block">
            <input id="message-input" placeholder="Напиши сообщение :)"></input>
            <button className="send-btn">Отправить</button>
        </div>
        
        <button id="message-file">Файл</button>
    </div>
}