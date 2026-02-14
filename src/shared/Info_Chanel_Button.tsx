import { Link } from "react-router-dom";

//
// Кнопка для перехода в личный кабинет
//

export default function Info_Chanel_Button() {
    return (
        <Link to={'/chanel_info'}>
            <p>Канал</p>
        </Link>
    )
}