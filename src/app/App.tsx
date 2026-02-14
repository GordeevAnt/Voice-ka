import { Route, Routes } from "react-router-dom";
import Layout from "./Layout";
import { Main_Page } from "../pages/Main_Page";
import { Chanel_Info_Page } from "../pages/Chanel_Info_Page";
import { Chanel_Settings } from "../widgets/Chanel_Settings";
import { Room_Info_Page } from "../pages/Room_Info_Page";
import { Room_Settings } from "../widgets/Room_Settings";
import { Personal_Account_Info_Page } from "../pages/Personal_Account_Info_Page";
import { Personal_Settings } from "../widgets/Personal_Settings";

//
// Компонент для маршрутизации
//

export default function App() {
    return (
    <>
        <Routes>
            <Route path='/' element={<Layout />}>
                <Route index element={<Main_Page/>}/>
                
                <Route path='/chanel_info' element={<Chanel_Info_Page />}>
                    <Route path='/chanel_info/settings' element={<Chanel_Settings />}/>
                </Route>
                
                <Route path='/room_info' element={<Room_Info_Page />}>
                    <Route path='/room_info/settings' element={<Room_Settings />}/>
                </Route>
                
                <Route path='/person_acc_info' element={<Personal_Account_Info_Page />}>
                    <Route path='/person_acc_info/settings' element={<Personal_Settings />}/>
                </Route>
            </Route>
        </Routes>
    </>
    )
}