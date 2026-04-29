import { getCurrentWindow } from "@tauri-apps/api/window"

import "./Header.css"

//
// Хедер (шапка окна)
//

export function Header() {

    const appWindow = getCurrentWindow();

    return (
    <>
        <div className="titlebar" data-tauri-drag-region>
            
            <div className="titlebar-title">
                <img src="/voice-ka.svg" />
            </div>
            
            <div className="titlebar-title-name">
                <h4>Voice-ka</h4>
            </div>

            <div className="titlebar-controls">
                
                <button className="titlebar-btn" id="titlebar-minimize" onClick={() => appWindow.minimize()}>–</button>
                
                <button className="titlebar-btn" id="titlebar-switch-window-size" onClick={() => appWindow.toggleMaximize()}>
                    <img src="/maximize.svg" />
                </button>
                
                <button className="titlebar-btn close" id="titlebar-close" onClick={() => appWindow.close()}>
                    <img src="/close.svg" />
                </button>
            
            </div>
        
        </div>
    </>
    )
}