import Home_Button from "../shared/Home_Button";
import Personal_Account_Button from "../shared/Personal_Account_Button";
import Search_Bar from "../shared/Search_Bar";
import "./Header.css"

//
// Хедер (верхняя часть сайта)
//

export default function Header() {
    return <header>
        <Home_Button/>
        <Search_Bar/>
        <Personal_Account_Button/>
    </header>
}