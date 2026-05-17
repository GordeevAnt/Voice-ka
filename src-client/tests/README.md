е# Тестирование React компонентов Voice-ka

## Обзор

Этот проект содержит end-to-end тесты для всех React компонентов приложения Voice-ka, написанные с использованием Playwright. Тесты покрывают все основные компоненты приложения, включая:

- **App компоненты** (`App.tsx`, `Layout.tsx`, `Logined_Layout.tsx`)
- **Entity компоненты** (`Message.tsx`, `Message_Input.tsx`, `Messages_List.tsx`)
- **Feature компоненты** (`Auth_Page.tsx`, `Register_Page.tsx`, `UserPermissionsModal.tsx`)
- **Page компоненты** (`Main_Page.tsx`, `Chanel_Info_Page.tsx`, `Room_Info_Page.tsx`, `Personal_Account_Info_Page.tsx`)
- **Shared компоненты** (`Search_Chanel.tsx`, `Switch_Chanel_Button.tsx`, `Switch_Room_Button.tsx`, `Info_Chanel_Button.tsx`, `Info_Room_Button.tsx`, `Info_Personal_Account_Button.tsx`)
- **Widget компоненты** (`Header.tsx`, `Chanels_List.tsx`, `Rooms_List.tsx`, `Rooms_Online_List.tsx`, `Messenger_Field.tsx`)
- **Интеграционные тесты** для ключевых пользовательских сценариев

## Структура тестов

```
tests/
├── app/                    # Тесты для App компонентов
├── entities/              # Тесты для Entity компонентов
├── features/              # Тесты для Feature компонентов
├── pages/                 # Тесты для Page компонентов
├── shared/                # Тесты для Shared компонентов
├── widgets/               # Тесты для Widget компонентов
├── integration/           # Интеграционные тесты пользовательских сценариев
├── utils/                 # Вспомогательные утилиты и mock-данные
└── server/                # Тесты для WebSocket сервера (будут перенесены в src-server)
```

## Установка и настройка

### Предварительные требования

1. Node.js 16 или выше
2. Установленные зависимости проекта: `npm install` в папке `src-client/`

### Установка Playwright

Playwright уже установлен как dev-зависимость. Для установки браузеров выполните:

```bash
cd src-client
npx playwright install
```

## Запуск тестов

### Все тесты

```bash
cd src-client
npm test
```

### Тесты с UI

```bash
cd src-client
npm run test:ui
```

### Тесты в режиме отладки

```bash
cd src-client
npm run test:debug
```

### Тесты только для Chromium

```bash
cd src-client
npm run test:chromium
```

### Конкретный тестовый файл

```bash
cd src-client
npx playwright test tests/app/app.spec.ts
```

## Конфигурация

Конфигурация Playwright находится в `playwright.config.ts`:

- **baseURL**: `http://localhost:1420` (Tauri dev-сервер)
- **Projects**: Chromium, Firefox, WebKit
- **WebServer**: Автоматический запуск Tauri dev-сервера на порту 1420

## Особенности тестирования Tauri приложения

1. **Порт 1420**: Tauri dev-сервер запускается на порту 1420
2. **Аутентификация**: Большинство тестов работают без аутентификации, проверяя только наличие элементов интерфейса
3. **Гибкие селекторы**: Тесты используют гибкие CSS-селекторы для устойчивости к изменениям в интерфейсе
4. **Mock-данные**: В `test-utils.tsx` содержатся mock-данные для тестирования компонентов

## Решение проблем

### Тесты падают с ошибкой "Cannot connect to localhost:1420"

Убедитесь, что Tauri dev-сервер запущен:

```bash
cd src-client
npm run tauri dev
```

Или запустите сервер вручную в отдельном терминале.

### Тесты проходят, но некоторые проверки не выполняются

Тесты написаны с учетом того, что пользователь может быть не аутентифицирован. Если компонент требует аутентификации, тесты проверяют только базовую структуру или пропускают проверки.

### Как добавить новый тест

1. Создайте файл `.spec.ts` в соответствующей папке
2. Используйте гибкие селекторы для поиска элементов
3. Добавьте проверки с учетом возможного отсутствия аутентификации
4. Запустите тест для проверки

## Best Practices

1. **Гибкие селекторы**: Используйте множественные селекторы (`selector1, selector2, selector3`)
2. **Условные проверки**: Проверяйте наличие элементов перед взаимодействием
3. **Устойчивость к изменениям**: Не полагайтесь на конкретные CSS-классы, используйте общие паттерны
4. **Чистые тесты**: Каждый тест должен быть независимым

## Отчеты

После запуска тестов отчеты генерируются в:
- `playwright-report/` - HTML отчет
- `test-results/` - скриншоты и трассировки

Для просмотра HTML отчета:

```bash
cd src-client
npx playwright show-report
```

## Контакты

Для вопросов по тестированию обращайтесь к разработчикам проекта Voice-ka.