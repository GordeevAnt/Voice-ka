import "./Message_Input.css"

//
// Виджет ввода сообщений
//

export function Message_Input() {
    return <div className="message-input-container">
        
        <div className="message-input-block">
            
            <button id="message-smile">Смайлик</button>
            <input id="message-input" placeholder="Напиши сообщение :)"></input>
            <button id="message-file">Файл</button>
            <button className="send-btn">Отправить</button>
        
        </div>
        
    </div>
}