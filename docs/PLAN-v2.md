# TrackIT Mobile v2 — План доработки React Native

## Что есть сейчас (работает)
- ✅ Login (Keycloak → API token через V1 API)
- ✅ 5 табов (Home/Projects/+/Inbox/Profile)
- ✅ Kanban с drag & drop (long press → onTouchMove)
- ✅ Card actions (⋯ → modal с переместить/назначить/приоритет)
- ✅ Inline создание в колонке
- ✅ Issue Detail (статус/приоритет pickers, labels, comments)
- ✅ Label creation с цветовой палитрой
- ✅ Card display settings

## Что нужно ПЕРЕДЕЛАТЬ

### 1. Auth: перейти на session cookie
**Сейчас:** X-Api-Key через V1 API
**Надо:** Keycloak → session cookie → internal API

Изменения в lib/api.ts:
- Убрать createApiClient() с X-Api-Key
- Все запросы через fetch() с credentials: "include"
- Login: POST /api/v1/mobile/auth/oidc/ → cookie автоматически
- Все endpoints переписать на /api/... (internal)

### 2. Tab 1: Home — по wireframe
**Сейчас:** Kanban доска + toggle My Issues
**Надо:** Dashboard (приветствие + статистика + просроченные + мои в работе)

Новый файл: app/(tabs)/index.tsx — полная переделка

### 3. Tab 2: Projects — оставить + доработать Kanban
**Сейчас:** Список проектов → Kanban (работает)
**Надо:** Добавить мини-прогресс на карточке проекта

### 4. Tab 3: Create — переделать
**Сейчас:** Placeholder
**Надо:** Кнопка создания сверху + список моих созданных задач

### 5. Tab 4: My Tasks — НОВЫЙ (вместо Inbox)
**Сейчас:** Inbox (обращения intake)
**Надо:** Мои задачи, группировка по проектам, фильтр по статусу

### 6. Issue Detail — доработать вложения
**Сейчас:** Upload через mobile-attachments (работает на бэке)
**Надо:** Исправить upload в RN (fetch + FormData + session cookie)

## Порядок реализации

### Шаг 1: Auth (session cookie)
- [ ] Переписать lib/api.ts на session cookie
- [ ] Переписать lib/auth-context.tsx
- [ ] Тест в симуляторе: login → /api/users/me/ работает
- [ ] Скриншот

### Шаг 2: Home (dashboard)
- [ ] Новый app/(tabs)/index.tsx по wireframe
- [ ] API: /api/users/me/ + /api/.../dashboard/
- [ ] Тест в симуляторе
- [ ] Скриншот

### Шаг 3: My Tasks (новый таб)
- [ ] Переименовать analytics.tsx → my-tasks.tsx
- [ ] Загрузка задач assigned to me из всех проектов
- [ ] Группировка по проектам + фильтр
- [ ] Тест + скриншот

### Шаг 4: Create (история + форма)
- [ ] Переделать create placeholder
- [ ] Список created_by=me + кнопка создания
- [ ] Тест + скриншот

### Шаг 5: Kanban polish (как Trello)
- [ ] Проверить drag & drop работает
- [ ] Проверить inline create
- [ ] Проверить action sheet
- [ ] Тест + скриншот

### Шаг 6: Issue Detail + attachments
- [ ] Переписать upload на session cookie + mobile-attachments
- [ ] Тест upload фото
- [ ] Скриншот

### Шаг 7: Деплой на телефон
- [ ] Полный прогон всех экранов в симуляторе
- [ ] Скриншоты всех табов
- [ ] Показать пользователю
- [ ] Build + install на устройство
