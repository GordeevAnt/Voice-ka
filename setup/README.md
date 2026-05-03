# Предварительные требования
- Docker Desktop
- Node.js (18+)
- Rust (последняя стабильная)

# Первый запуск

1)  Открыть Docker Desktop
2)  Запустить setup.bat
3)  Прописать в консоль (Command Prompt) "npm install" для установки зависимостей
4)  Прописать в конcоль (Powershell) "winget install Rustlang.Rustup"
5)  Проверить установленные файлы
    - "npm --version"   (Command Prompt)
    - "node --version"  (Command Prompt)
    - "cargo --version" (Powershell)
6)  Если высвечивается ошибка, нужно переустановить компоненты
7)  Перейти в Voice-ka/src-client
8)  Прописать в консоль (Command Prompt) "npm run tauri dev" столько раз,
    сколько нужно экземпляров клиентского приложения
9)  Перейти в Voice-ka/src-server
10) Прописать в консоль (Powershell) "cargo run server" для запуска сервера

# Последующие запуски

1) Запустить контейнер setup в Docker Desktop
2) Выполнить пункты 7-10

# Исполняемые файлы

setup.bat - устанавливает образ docker
reset.bat - перезапускает контейнер

# Команды приложения

1) npm run tauri dev   - запуск клиентского приложения
2) npm run test        - включить тестирование
3) cargo run migration - провести миграцию
4) cargo run server    - запустить сервер