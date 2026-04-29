import { memo } from "react";
import "./Message.css";

export type MessageProps = {
  id: number;
  author: string;
  text: string;
  timestamp: string;
  isCurrentUser?: boolean;
  onDelete?: (id: number) => void;
  onEdit?: (message: any) => void;
};

// Функция сравнения для глубокого сравнения
const areEqual = (prevProps: MessageProps, nextProps: MessageProps) => {
  return (
    prevProps.id === nextProps.id &&
    prevProps.author === nextProps.author &&
    prevProps.text === nextProps.text &&
    prevProps.timestamp === nextProps.timestamp &&
    prevProps.isCurrentUser === nextProps.isCurrentUser
  );
};

export const Message = memo(({ 
    id, 
    author, 
    text, 
    timestamp, 
    isCurrentUser,
    // onDelete,
    // onEdit 
    }: MessageProps) => {
    
    // const handleDelete = () => {
    //     if (onDelete && window.confirm("Удалить сообщение?")) {
    //     onDelete(id);
    //     }
    // };

    return (
        <div id={id.toString()} className={`message ${isCurrentUser ? "message-current-user" : ""}`}>
            <div className="message-avatar-block">
                {author[0]?.toUpperCase() || "?"}
            </div>
            <div className="message-content">
                <div className="message-header">
                <span className="message-author">{author}</span>
                <span className="message-time">{timestamp}</span>
                </div>
                <div className="message-text-block">{text}</div>
            </div>
            {/* {isCurrentUser && (
                <div className="message-actions">
                <button onClick={handleDelete} className="message-delete-btn">
                    🗑️
                </button>
                </div>
            )} */}
        </div>
    );
}, areEqual);

Message.displayName = "Message";