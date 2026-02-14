import { Link } from "react-router-dom";

//
// Кнопка для перехода в личный кабинет
//

export default function Info_Room_Button() {
    return (
        <Link to={'/room_info'}>
            <p>Комната</p>
        </Link>
    )
}