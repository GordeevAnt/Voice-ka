import "./Add_Chanel.css"

//
// Кнопка для добавления канала
//

export function Add_Chanel({ onClick } : { onClick: () => void }) {
    return <button className="add-chanel-btn" onClick={ onClick }>
        <img src="./public/grey-search.svg" />
    </button>
}