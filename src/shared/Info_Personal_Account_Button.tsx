import { Link } from "react-router-dom";

//
// Кнопка для перехода в личный кабинет
//

export default function Info_Personal_Account_Button() {
    return (
        <Link to={'/person_acc_info'}>
            <p>Личный кабинет</p>
        </Link>
    )
}