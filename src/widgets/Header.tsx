import "./Header.css"

//
// Хедер (шапка окна)
//

export default function Header() {
    return (
    <>
        <div className="titlebar" data-tauri-drag-region>
            
            <div className="titlebar-title">
                <img src="./public/voice-ka.svg" />
            </div>
            
            <div className="titlebar-controls">
                
                <button className="titlebar-btn" id="minimize">–</button>
                
                <button className="titlebar-btn" id="switch-window-size">
                    <img src="./public/maximize.svg" />
                </button>
                
                <button className="titlebar-btn close" id="close">
                    <img src="./public/close.svg" />
                </button>
            
            </div>
        
        </div>
    </>
    )
}