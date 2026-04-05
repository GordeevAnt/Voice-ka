import { useState } from "react";
import { Switch_Chanel_Button } from "../shared/Switch_Chanel_Button"
import { Add_Chanel } from "../shared/Add_Chanel"

import "./Chanels_List.css"

//
// Виджет вывода списка комнат канала
//

export function Chanels_List() {
    const [sub, setSub] = useState(1);
    const [fav, setFav] = useState(0);

    const [subList, setSubList] = useState([1, 2, 3, 4, 5, 6, 7]);
    const [favList, setFavList] = useState([1, 2, 3, 4]);
    
    const handleGroupSwitch = () => {
        if(sub == 1) {
            setSub(0)
            setFav(1)
        }
        else {
            setFav(0)
            setSub(1)
        }
        console.log(sub);
        console.log(fav);
    }

    const handleAddChanel = () => {
        if(sub == 1) {
            setSubList([...subList, 1]);
            console.log(1);
            console.log(subList);
        }
        else {
            setFavList([...favList, 1]);
            console.log(1);
            console.log(favList);
        }
    }

    return (
    <>
        <footer className="chanels-container">

            <div className="chanel-list-changer">
                <button className="sub-chanel-btn" onClick={handleGroupSwitch}>Подписки</button>
                <button className="fav-chanel-btn" onClick={handleGroupSwitch}>Избранное</button>
            </div>
            
            <div className="chanel-list-block">
                <div className="chanel-list">
                    {subList.map((item) => (
                        <Switch_Chanel_Button key={item.toString()} />
                    ))}
                </div>
            </div>
            
            <Add_Chanel onClick={handleAddChanel}/>
            
        </footer>
    </>
    )
}