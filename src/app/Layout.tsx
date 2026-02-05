import { Outlet } from "react-router-dom";
import Header from "../widgets/Header";
import "./App.css"

//
// Обертка для вывода страницы
//

export default function Layout() {
  return (
    <>
      <Header/>

      <div className="body_content">

        <Outlet />

      </div>
    </>
  )
}