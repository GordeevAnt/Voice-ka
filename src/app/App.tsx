import { Route, Routes } from "react-router-dom";
import Main_Page from "../pages/Main_Page";
import Personal_Account_Page from "../pages/Personal_Account_Page";
import Layout from "./Layout";

//
// Компонент для маршрутизации
//

export default function App() {
    return (
    <>
        <Routes>
            <Route path='/' element={<Layout />}>
                <Route index element={<Main_Page/>}/>
                <Route path='/person_acc' element={<Personal_Account_Page/>}/>
            </Route>
        </Routes>
    </>
    )
}