import Chanel_Button from "../shared/Chanel_Button"
import Add_Chanel from "../shared/Add_Chanel"

import "./Chanels_List.css"

//
// Виджет вывода списка комнат канала
//

export default function Chanels_List() {
    return <footer className="chanels-container">

        <div className="chanel-list-changer">
            <button className="sub-chanel-btn">Подписки</button>
            <button className="fav-chanel-btn">Избранное</button>
        </div>
        
        <div className="chanel-list-block">
            <div className="chanel-list">
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
                <Chanel_Button />
            </div>
        </div>
        
        <Add_Chanel />
        
    </footer>
}