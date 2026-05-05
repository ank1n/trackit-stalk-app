#
 TrackIT Mobile — Архитектура приложения

## Концепция

Мобильное приложение для управления проектами и задачами в TrackIT.
Технология: **Expo (React Native)**, TypeScript, Plane V1 API + Keycloak OIDC.

### Визуальный стиль
Референс: `docs/design-reference.png` (Dribbble: ToDo App Kanban Board + Gantt chart)
- Чистый светлый интерфейс, белые карточки на светло-сером фоне (#F5F5F7)
- Мягкие тени (shadow-sm), скруглённые углы (12-16px)
- Пастельные цвета для labels/categories (мятный, лавандовый, розовый, бежевый)
- Иконки-статусы в цветных кружках на карточках
- FAB (Floating Action Button) — синий "+" по центру bottom bar
- Шрифт: системный SF Pro, чистая типография без декора

---

## Навигация — 5 элементов (Bottom Tab Bar)

```
┌──────┬──────┬──────┬──────┬──────┐
│ Home │Proj. │  +   │Anal. │Profile│
│  🏠  │  📁  │  ➕  │  📊  │  👤  │
└──────┴──────┴──────┴──────┴──────┘
```

| # | Таб | Иконка | Назначение |
|---|-----|--------|------------|
| 1 | Home | grid/home | Dashboard: Kanban-доска текущего проекта + входящие |
| 2 | Projects | folder | Список всех проектов |
| 3 | + (FAB) | plus-circle | Создание задачи (modal) — крупная синяя кнопка по центру |
| 4 | Analytics | bar-chart | Статистика / SLA / графики |
| 5 | Profile | person | Профиль, настройки, выход |

---

## Экраны — полная карта

```
App Root
│
├── (auth)
│   └── login.tsx                    — Email + пароль (Keycloak)
│
├── (tabs)
│   ├── index.tsx (Home)             — Dashboard: Kanban + фильтры
│   ├── projects.tsx                 — Список проектов
│   ├── create.tsx                   — Создание задачи (FAB target)
│   ├── analytics.tsx                — Аналитика / SLA
│   └── profile.tsx                  — Профиль + настройки
│
├── project/[id].tsx                 — Kanban-доска проекта
│
├── issue/[id].tsx                   — Детали задачи (Card Back)
│
└── search.tsx                       — Глобальный поиск
```

---

## Экран: Home (Dashboard)

Главный экран — Kanban-доска последнего открытого проекта.

### Header
```
┌─────────────────────────────────┐
│ Dashboard                    ≡  │  Заголовок + бургер-меню
├─────────────────────────────────┤
│ [Filters ▾]    [View: Kanban ▾] │  Фильтры + переключатель вида
└─────────────────────────────────┘
```
- "Filters" dropdown: приоритет, assignee, labels
- "View" dropdown: Kanban / List / Timeline

### Kanban-доска
Горизонтальный скролл колонок (snap-to-column).

```
┌──────────────────────────────────────────────────┐
│                                                  │
│ ┌────────────────┐  ┌────────────────┐  ┌─────   │
│ │⋮ 📈 In Progress│  │⋮ ✅ Done       │  │⋮ 📋    │
│ │         ⋯      │  │         ⋯      │  │        │
│ ├────────────────┤  ├────────────────┤  ├─────   │
│ │                │  │                │  │        │
│ │ ┌────────────┐ │  │ ┌────────────┐ │  │        │
│ │ │⚡Design sys.│ │  │ │🔖 Research │ │  │        │
│ │ │            │ │  │ │            │ │  │        │
│ │ │Create Land.│ │  │ │Market anal.│ │  │        │
│ │ │            │ │  │ │            │ │  │        │
│ │ │☑3/5 💬3 📅 │ │  │ │☑2/2 💬1 📅 │ │  │        │
│ │ └────────────┘ │  │ └────────────┘ │  │        │
│ │                │  │                │  │        │
│ │ ┌────────────┐ │  │ ┌────────────┐ │  │        │
│ │ │🔖 Wirefram.│ │  │ │⚡ Dev      │ │  │        │
│ │ │New app view│ │  │ │API integr. │ │  │        │
│ │ │☑4/7 💬8 📅 │ │  │ │☑5/5 💬2 📅 │ │  │        │
│ │ └────────────┘ │  │ └────────────┘ │  │        │
│ │                │  │                │  │        │
│ └────────────────┘  └────────────────┘  └─────   │
│                                                  │
├──────────────────────────────────────────────────┤
│  🏠    📁       ➕        📊    👤               │
│ Home  Proj.   Create   Anal. Profile             │
└──────────────────────────────────────────────────┘
```

### Колонка (Column)
```
┌─────────────────────────┐
│ ⋮  📈 In Progress    ⋯  │  Меню + иконка статуса + название + overflow
├─────────────────────────┤
│                         │
│   [Карточка 1]          │  Вертикальный скролл
│   [Карточка 2]          │
│   [Карточка 3]          │
│                         │
└─────────────────────────┘
```
- Drag handle (⋮) слева
- Иконка статуса в цветном кружке
- Название группы
- Overflow menu (⋯): сортировка, фильтр

### Карточка (Card Front)
```
┌─────────────────────────┐
│  ⚡ Design system       │  Цветная иконка категории + label text
│                         │
│  Create Landing Page    │  Заголовок задачи (semi-bold, 15px)
│                         │
│  ☑ 3/5   💬 3   📅 22 Jun│  Badges: checklist, comments, date
└─────────────────────────┘
```

**Элементы карточки:**
1. **Category/Label chip** — цветная иконка (⚡🔖📐✏️) + текст label в мягком цвете
2. **Заголовок** — 15-16px, semi-bold, max 2 строки
3. **Badges строка** — мелкие иконки + значения:
   - ☑ checklist progress (3/5)
   - 💬 comments count
   - 📅 due date
4. **Фон:** белый (#FFFFFF)
5. **Тень:** мягкая (0 2px 8px rgba(0,0,0,0.06))
6. **Скругление:** 12px
7. **Padding:** 16px

### Цвета категорий (пастельные)
| Категория | Иконка | Фон иконки | Текст |
|-----------|--------|-----------|-------|
| Design system | ⚡ | #EDE9FE (лавандовый) | #7C3AED |
| Wireframing | 🔖 | #DBEAFE (голубой) | #2563EB |
| Development | 📐 | #D1FAE5 (мятный) | #059669 |
| Research | ✏️ | #FEF3C7 (бежевый) | #D97706 |
| Bug | 🐛 | #FEE2E2 (розовый) | #DC2626 |

---

## Экран: Детали задачи (Card Back)

Full-screen pushed view.

```
┌─────────────────────────────────┐
│ ←                          ⋯   │  Back + overflow menu
├─────────────────────────────────┤
│                                 │
│  ⚡ Design system               │  Category label
│                                 │
│  Create Landing Page            │  Заголовок (20px, bold)
│                                 │
│ ┌─ Свойства ──────────────────┐ │
│ │                             │ │
│ │ Статус      📈 In Progress  │ │  Colored chip
│ │ Приоритет   🔴 High         │ │  Priority icon + text
│ │ Назначен    👤 Дмитрий Б.   │ │  Avatar + name
│ │ Метки       ⚡Design  🔖UX  │ │  Label chips
│ │ Дедлайн     📅 22 Jun 2026  │ │  Due date
│ │ Создано     12 Mar 2026     │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│ ── Описание ────────────────── │
│ Необходимо создать лендинг     │
│ страницу для нового продукта...│
│                                 │
│ ── Чек-лист (3/5) ──────────── │
│ ✅ Wireframe                    │
│ ✅ Design mockup                │
│ ✅ Content                      │
│ ☐ Development                   │
│ ☐ Review                        │
│                                 │
│ ── SLA ─────────────────────── │
│ 🟢 First Response  ост. 4ч     │
│ 🟡 Resolution      ост. 1д 2ч  │
│                                 │
│ ── Комментарии (3) ──────────  │
│ 👤 Дмитрий · 2ч назад          │
│ Макет готов, жду ревью          │
│                                 │
│ 👤 Анна · 5ч назад             │
│ Добавила контент на страницу    │
│                                 │
├─────────────────────────────────┤
│ [💬 Написать комментарий... ] 📎│  Sticky input + attach
└─────────────────────────────────┘
```

---

## Экран: Projects

```
┌─────────────────────────────────┐
│ Projects                   🔍   │
├─────────────────────────────────┤
│                                 │
│ ┌─────────────────────────────┐ │
│ │ ⚙️  TRKIT                   │ │  Emoji + identifier
│ │     TrackIT                 │ │  Project name
│ │     12 задач · 3 в работе   │ │  Stats
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 💬  STALK                   │ │
│ │     sTalk                   │ │
│ │     8 задач · 1 в работе    │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 🎫  SUP                    │ │
│ │     Support Requests        │ │
│ │     21 обращение            │ │
│ └─────────────────────────────┘ │
│                                 │
├─────────────────────────────────┤
│  🏠    📁       ➕        📊  👤│
└─────────────────────────────────┘
```

---

## Экран: Analytics

```
┌─────────────────────────────────┐
│ April 2026                  ▾   │  Месяц + selector
├─────────────────────────────────┤
│ ≡  Mon  Tue  Wed  Thu  Fri  Sat │  Calendar header
│    14   15   16   17   18   19  │
│              |                  │  Today line (синяя)
│ ┌──────────────────────┐        │
│ │ Development          │────    │  Цветные горизонтальные полоски
│ └──────────────────────┘        │  задач на timeline
│    ┌───────────────┐            │
│    │ Wireframing   │──          │
│    └───────────────┘            │
│ ┌────────────────────────────┐  │
│ │ Design system              │  │
│ └────────────────────────────┘  │
│         ┌────────────┐          │
│         │ Research   │──        │
│         └────────────┘          │
│                                 │
├─────────────────────────────────┤
│  🏠    📁       ➕        📊  👤│
└─────────────────────────────────┘
```

Timeline/Gantt view с цветными полосками задач.

---

## Экран: Profile

```
┌─────────────────────────────────┐
│ Profile                         │
├─────────────────────────────────┤
│                                 │
│        👤 (аватар 64px)         │
│        Дмитрий Бондарь          │
│        dp.bondar@gmail.com      │
│                                 │
│ ── Подключение ──────────────── │
│ 🖥 Сервер   trackit.implica.ru  │
│ 📡 Статус   Подключено ✅       │
│                                 │
│ ── Приложение ─────────────── │
│ 🎨 Тема     Системная    ▾     │
│ 🔔 Уведомления  Включены  ▾    │
│ ℹ️ Версия   1.0.0 (MVP)        │
│                                 │
│ ┌─────────────────────────────┐ │
│ │    🚪 Выйти                 │ │  Красная кнопка
│ └─────────────────────────────┘ │
│                                 │
├─────────────────────────────────┤
│  🏠    📁       ➕        📊  👤│
└─────────────────────────────────┘
```

---

## Экран: Создание задачи (Modal bottom sheet)

Вызывается по нажатию FAB "+".

```
┌─────────────────────────────────┐
│ ─── (swipe handle)              │
│                                 │
│  Новая задача                   │  Title
│                                 │
│  Проект     [TrackIT       ▾]   │  Dropdown
│                                 │
│  Заголовок                      │
│  [__________________________ ]  │  TextInput
│                                 │
│  Приоритет  [Medium        ▾]   │  Dropdown
│                                 │
│  Статус     [Todo          ▾]   │  Dropdown
│                                 │
│  ┌─────────────────────────────┐│
│  │        Создать              ││  Primary button
│  └─────────────────────────────┘│
│                                 │
└─────────────────────────────────┘
```

Минимальный набор полей. Остальное (описание, labels, assignee) — после создания в деталях.

---

## Данные и API

### Endpoints
| Данные | Endpoint | Метод |
|--------|----------|-------|
| Auth (Keycloak) | `POST /api/v1/mobile/auth/oidc/` | POST |
| Проекты | `GET /api/v1/workspaces/{slug}/projects/` | GET |
| Задачи | `GET /api/v1/.../projects/{id}/issues/` | GET |
| Задача | `GET /api/v1/.../issues/{id}/` | GET |
| Создание | `POST /api/v1/.../issues/` | POST |
| Обновление | `PATCH /api/v1/.../issues/{id}/` | PATCH |
| Статусы | `GET /api/v1/.../states/` | GET |
| Labels | `GET /api/v1/.../labels/` | GET |
| Members | `GET /api/v1/.../members/` | GET |
| Комментарии | `GET /api/workspaces/.../issues/{id}/history/` | GET |
| Новый комментарий | `POST /api/workspaces/.../issues/{id}/comments/` | POST |
| Intake issues | `GET /api/workspaces/.../inbox-issues/` | GET |
| SLA | `GET /api/custom-fields/sla/issues/{id}` | GET |

---

## Дизайн-система

### Цвета
```
Primary:        #3F76FF  (синий TrackIT, FAB кнопка)
Background:     #F5F5F7  (светло-серый фон)
Card:           #FFFFFF  (белые карточки)
Text:           #1A1A1A  (основной текст)
Text Secondary: #6B7280  (вторичный)
Text Tertiary:  #9CA3AF  (третичный)
Border:         #E5E7EB  (разделители)
```

### Категории (пастельные пары: фон иконки + текст)
```
Design:      bg #EDE9FE  text #7C3AED  icon ⚡
Wireframe:   bg #DBEAFE  text #2563EB  icon 🔖
Development: bg #D1FAE5  text #059669  icon 📐
Research:    bg #FEF3C7  text #D97706  icon ✏️
Bug:         bg #FEE2E2  text #DC2626  icon 🐛
Feature:     bg #E0F2FE  text #0284C7  icon ✨
```

### Приоритеты
```
Urgent:  #EF4444 (●)
High:    #F97316 (▲)
Medium:  #EAB308 (─)
Low:     #3B82F6 (▼)
None:    #9CA3AF (○)
```

### Отступы и размеры
```
Card padding:       16px
Card border-radius: 12px
Card shadow:        0 2px 8px rgba(0,0,0,0.06)
Column width:       75% screen width (iPhone)
Column gap:         12px
Column radius:      16px
FAB size:           56px
FAB radius:         28px (circle)
Tab bar height:     84px (with safe area)
```

### Типография
```
H1 (screen title):  24px, weight 700
H2 (section title): 18px, weight 600
Card title:         15px, weight 600
Card subtitle:      13px, weight 400
Badge text:         11px, weight 500
Tab label:          10px, weight 500
```
