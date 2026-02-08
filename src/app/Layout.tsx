import { Outlet } from "react-router-dom";
import Header from "../widgets/Header";
import Chanels_List from "../features/Chanels_List";

import "./App.css"

//
// Обертка для вывода страницы
//

export default function Layout() {
  return (
    <>
      <Header/>

      <div className="app-container">

        <Outlet />

      </div>

      <Chanels_List />
    </>
  )
}