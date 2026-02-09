import "./Message.css"

//
// Отображает конкретное сообщение
//

export default function Message() {
    return <div className="message">
        <div className="message-avatar-block">Аватар</div>{/* <Avatar /> */}
        <div className="message-text-block">Текст</div>{/* <Text /> */}
        <div className="message-time-block">Время</div>{/* <Time /> */}
    </div>
}