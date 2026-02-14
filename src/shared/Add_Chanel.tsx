//
// Кнопка для добавления канала
//

export function Add_Chanel({ onClick } : { onClick: () => void }) {
    return <button className="add-chanel-btn" onClick={onClick}>
        +
    </button>
}