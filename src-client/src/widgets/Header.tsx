import { getCurrentWindow } from "@tauri-apps/api/window"
import { useState, useEffect } from "react"

import "./Header.css"

//
// Хедер (шапка окна)
//

export function Header() {
    const appWindow = getCurrentWindow();
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        // Проверяем текущее состояние окна при загрузке
        const checkMaximized = async () => {
            const maximized = await appWindow.isMaximized();
            setIsMaximized(maximized);
        };
        
        checkMaximized();

        // Подписываемся на события изменения размера окна
        const unlistenResized = appWindow.onResized(() => {
            checkMaximized();
        });

        // Также подписываемся на событие moved (некоторые платформы)
        const unlistenMoved = appWindow.onMoved(() => {
            checkMaximized();
        });

        return () => {
            unlistenResized.then(unlisten => unlisten());
            unlistenMoved.then(unlisten => unlisten());
        };
    }, [appWindow]);

    const handleToggleMaximize = async () => {
        await appWindow.toggleMaximize();
        const maximized = await appWindow.isMaximized();
        setIsMaximized(maximized);
    };

    return (
        <div className="titlebar" data-tauri-drag-region>
            
            <div className="titlebar-title">
                <img src="/voice-ka.svg" alt="Voice-ka" />
            </div>
            
            <div className="titlebar-title-name">
                <h4>Voice-ka</h4>
            </div>

            <div className="titlebar-controls">
                
                <button className="titlebar-btn" id="titlebar-minimize" onClick={() => appWindow.minimize()}>
                    –
                </button>
                
                <button 
                    className="titlebar-btn" 
                    id="titlebar-switch-window-size" 
                    onClick={handleToggleMaximize}
                >
                    <img 
                        src={isMaximized ? "/minimize.svg" : "/maximize.svg"} 
                        alt={isMaximized ? "Restore" : "Maximize"}
                    />
                </button>
                
                <button className="titlebar-btn close" id="titlebar-close" onClick={() => appWindow.close()}>
                    <img src="/close.svg" alt="Close" />
                </button>
            
            </div>
        
        </div>
    )
}