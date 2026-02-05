import { Link } from "react-router-dom";
import "./Button.css"

//
// Кнопка для перехода на главную
//

export default function Home_Button() { 
    return (
        // <Link className="home_btn" to={'/'}>
        //     {/* <Home_Icon /> */}
        //     <p className="home_btn_txt">На главную</p>
        // </Link>

        <Link className="btn btn--md" to={'/'}>
            <p className="home_btn_txt">На главную</p>
        </Link>
    )
}