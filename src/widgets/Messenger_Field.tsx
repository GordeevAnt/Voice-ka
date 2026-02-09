import Messages_List from "./Messages_List"
import Message_Input from "./Message_Input"

import "./Messenger_Field.css"

//
// Виджет общения (текст/аудио/видео)
//

export default function Messenger_Field() {
    return <div className="messenger-field">
        <Messages_List />
        <Message_Input />
    </div>
}