# Правила разработки TrackIT Mobile

## Процесс работы над экраном

### 1. Перед написанием кода
- Проверить API через curl — какие поля, формат, коды ответов
- Записать точные endpoints и формат данных
- Убедиться что auth (session cookie / API key) работает для endpoint

### 2. Написание кода
- Один экран за раз — довести до конца, не прыгать
- Следовать wireframe из docs/screens.md ТОЧНО
- Следовать референсу дизайна (docs/design-reference.png)
- Типы данных — все поля optional (API может не вернуть)

### 3. Тестирование ПЕРЕД деплоем на телефон
- Запустить в симуляторе
- Сделать скриншот
- Показать пользователю скриншот
- Только после подтверждения — деплоить на телефон

### 4. Деплой
- Убить Metro: kill $(lsof -ti:8081)
- Build: npx expo run:ios --device "uNiphone" --configuration Release
- Если device locked — НЕ повторять, попросить разблокировать

## Auth
- Keycloak email/password → access_token
- POST /api/v1/mobile/auth/oidc/ → session cookie (sessionid + session-id)
- Все API вызовы через session cookie (internal API: /api/...)
- НЕ использовать X-Api-Key / V1 API

## API базовые правила
- Base URL: https://trackit.implica.ru
- Workspace: implica
- Projects: /api/workspaces/implica/projects/ — возвращает ARRAY
- Issues: /api/workspaces/implica/projects/{id}/issues/ — возвращает PAGINATED {results: [...]}
- States: /api/workspaces/implica/projects/{id}/states/ — возвращает ARRAY
- Labels: /api/workspaces/implica/projects/{id}/issue-labels/ — возвращает ARRAY
- Dashboard: /api/users/me/workspaces/implica/dashboard/ — возвращает OBJECT
- User: /api/users/me/ — возвращает OBJECT
- Comments: /api/workspaces/.../issues/{id}/history/?activity_type=issue-comment
- Attachments upload: /api/workspaces/.../issues/{id}/mobile-attachments/ (POST multipart)
- Attachments list: /api/workspaces/.../issues/{id}/mobile-attachments/ (GET)

## Поля Issue (internal API)
- state_id (НЕ state) — ID статуса
- sequence_id — номер задачи
- assignee_ids — может быть undefined
- label_ids — может быть undefined
- created_at, updated_at — строки ISO8601
- description_html — может быть null

## Tabs (5 штук)
1. Home — dashboard (статистика + просроченные + мои в работе)
2. Projects — список → Kanban (как Trello)
3. Create (+) — создание + история
4. My Tasks — назначенные мне
5. Profile — настройки + выход

## Дизайн
- Референс: docs/design-reference.png
- Фон: #FAFAFA
- Карточки: white, radius 12-14, shadow 0.04
- Tab bar: #1C1C1E (тёмный)
- Primary: #4A7BF7
- Шрифт: system
