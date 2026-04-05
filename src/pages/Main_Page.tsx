import { Messenger_Field } from "../widgets/Messenger_Field"
import Info_Chanel_Button from "../shared/Info_Chanel_Button"
import Info_Room_Button from "../shared/Info_Room_Button"
import Info_Personal_Account_Button from "../shared/Info_Personal_Account_Button"
import { Rooms_Online_List } from "../widgets/Rooms_Online_List"
import { Rooms_List } from "../features/Rooms_List"

import "./Main_Page.css"
import { Chanels_List } from "../features/Chanels_List"
import { Logout } from "../entities/Logout"

//
// Главная страница
//

export function Main_Page() {
    return (
        <div className="main-page-container">
            
            <div className="main-container">

                <Messenger_Field />

                <div className="room-container">
                    
                    <div className="settings">
                        <Info_Chanel_Button />
                        <Info_Room_Button />
                        <Info_Personal_Account_Button />
                        <Logout />
                    </div>
                    
                    <div className="room-selector">
                        <Rooms_Online_List />
                        <Rooms_List />
                    </div>
                
                </div>

            </div>

            <Chanels_List />
        
        </div>
    )
}