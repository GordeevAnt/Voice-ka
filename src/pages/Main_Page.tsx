import Messenger_Field from "../widgets/Messenger_Field"
import Chanel_Settings from "../widgets/Chanel_Settings"
import Room_Settings from "../widgets/Room_Settings"
import Personal_Settings from "../widgets/Personal_Settings"
import Rooms_List from "../features/Rooms_List"

import "./Main_Page.css"

//
// Главная страница
//

export default function Main_Page() {
    return (
        <div className="chanel-container">

            <Messenger_Field />
            
            <div className="room-container">
                
                <div className="settings">
                    <Chanel_Settings />
                    <Room_Settings />
                    <Personal_Settings />
                </div>
                
                <Rooms_List />
            
            </div>
        
        </div>
    )
}