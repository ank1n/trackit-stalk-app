import * as SecureStore from "expo-secure-store";

const LANG_KEY = "trackit_language";

export type Lang = "ru" | "en";

let currentLang: Lang = "ru";

export async function initLang() {
  const saved = await SecureStore.getItemAsync(LANG_KEY);
  if (saved === "en" || saved === "ru") currentLang = saved;
}

export async function setLang(lang: Lang) {
  currentLang = lang;
  await SecureStore.setItemAsync(LANG_KEY, lang);
}

export function getLang(): Lang {
  return currentLang;
}

const translations: Record<string, Record<Lang, string>> = {
  // Tabs
  "tab.home": { ru: "Главная", en: "Home" },
  "tab.projects": { ru: "Проекты", en: "Projects" },
  "tab.create": { ru: "Создать", en: "Create" },
  "tab.myTasks": { ru: "Мои задачи", en: "My Tasks" },
  "tab.profile": { ru: "Профиль", en: "Profile" },

  // Home
  "home.title": { ru: "Главная", en: "Dashboard" },
  "home.greeting.welcome": { ru: "Добро пожаловать", en: "Welcome" },
  "home.greeting.morning": { ru: "Доброе утро", en: "Good morning" },
  "home.greeting.afternoon": { ru: "Добрый день", en: "Good afternoon" },
  "home.greeting.evening": { ru: "Добрый вечер", en: "Good evening" },
  "home.stat.assigned": { ru: "Назначено", en: "Assigned" },
  "home.stat.inProgress": { ru: "В работе", en: "In Progress" },
  "home.stat.done": { ru: "Готово", en: "Done" },
  "home.overdue": { ru: "Просроченные", en: "Overdue" },
  "home.dueThisWeek": { ru: "задач с дедлайном", en: "tasks due" },
  "home.myWork": { ru: "Мои задачи в работе", en: "My work in progress" },
  "home.myWorkEmpty": { ru: "Нет задач в работе", en: "No tasks in progress" },
  "home.attention": { ru: "Требует внимания", en: "Needs attention" },
  "home.projectsSummary": { ru: "Проекты", en: "Projects" },
  "home.recentActivity": { ru: "Последняя активность", en: "Recent activity" },
  "home.deadlines": { ru: "Дедлайны на неделю", en: "Deadlines this week" },
  "home.noDeadlines": { ru: "Нет дедлайнов", en: "No deadlines" },
  "home.today": { ru: "сегодня", en: "today" },
  "home.tomorrow": { ru: "завтра", en: "tomorrow" },

  // Projects
  "projects.title": { ru: "Проекты", en: "Projects" },
  "projects.empty": { ru: "Нет проектов", en: "No projects" },
  "projects.tasks": { ru: "задач", en: "tasks" },
  "projects.inProgress": { ru: "в работе", en: "in progress" },
  "projects.done": { ru: "готово", en: "done" },
  "projects.pin": { ru: "Закрепить", en: "Pin" },
  "projects.unpin": { ru: "Открепить", en: "Unpin" },
  "projects.pages": { ru: "Страницы", en: "Pages" },
  "projects.noPages": { ru: "Нет страниц", en: "No pages" },

  // Kanban
  "kanban.add": { ru: "Добавить", en: "Add" },
  "kanban.addCard": { ru: "Название задачи...", en: "Task title..." },
  "kanban.cancel": { ru: "Отмена", en: "Cancel" },
  "kanban.moveTo": { ru: "Переместить в:", en: "Move to:" },
  "kanban.close": { ru: "Закрыть", en: "Close" },
  "kanban.assign": { ru: "Взять", en: "Assign" },
  "kanban.priority": { ru: "Приоритет", en: "Priority" },
  "kanban.open": { ru: "Открыть", en: "Open" },
  "kanban.cancelDrag": { ru: "Отмена — отпустите здесь", en: "Cancel — drop here" },
  "kanban.dropHere": { ru: "Отпустите здесь", en: "Drop here" },

  // Issue Detail
  "issue.title": { ru: "Задача", en: "Task" },
  "issue.back": { ru: "Назад", en: "Back" },
  "issue.description": { ru: "ОПИСАНИЕ", en: "DESCRIPTION" },
  "issue.noDescription": { ru: "Описание отсутствует", en: "No description" },
  "issue.attachments": { ru: "ВЛОЖЕНИЯ", en: "ATTACHMENTS" },
  "issue.noAttachments": { ru: "Нет вложений", en: "No attachments" },
  "issue.addPhoto": { ru: "Добавить", en: "Add" },
  "issue.comments": { ru: "КОММЕНТАРИИ", en: "COMMENTS" },
  "issue.noComments": { ru: "Нет комментариев", en: "No comments" },
  "issue.addComment": { ru: "Добавить комментарий", en: "Add comment" },
  "issue.commentPlaceholder": { ru: "Написать комментарий...", en: "Write a comment..." },
  "issue.addLabel": { ru: "Добавить метку", en: "Add label" },
  "issue.createLabel": { ru: "Создать метку", en: "Create label" },
  "issue.labelName": { ru: "Название метки", en: "Label name" },
  "issue.create": { ru: "Создать", en: "Create" },
  "issue.created": { ru: "Создано", en: "Created" },
  "issue.updated": { ru: "Обновлено", en: "Updated" },
  "issue.deadline": { ru: "Дедлайн", en: "Deadline" },

  // Priority
  "priority.urgent": { ru: "Срочный", en: "Urgent" },
  "priority.high": { ru: "Высокий", en: "High" },
  "priority.medium": { ru: "Средний", en: "Medium" },
  "priority.low": { ru: "Низкий", en: "Low" },
  "priority.none": { ru: "Без приоритета", en: "None" },

  // My Tasks
  "myTasks.title": { ru: "Мои задачи", en: "My Tasks" },
  "myTasks.assigned": { ru: "Назначены мне", en: "Assigned to me" },
  "myTasks.created": { ru: "Создал я", en: "Created by me" },
  "myTasks.active": { ru: "Актуальные", en: "Active" },
  "myTasks.closed": { ru: "Закрытые", en: "Closed" },
  "myTasks.all": { ru: "Все", en: "All" },
  "myTasks.inProgress": { ru: "В работе", en: "In Progress" },
  "myTasks.done": { ru: "Готово", en: "Done" },
  "myTasks.empty": { ru: "Нет задач", en: "No tasks" },

  // Create
  "create.title": { ru: "Задачи", en: "Tasks" },
  "create.button": { ru: "Создать задачу", en: "Create task" },
  "create.recent": { ru: "НЕДАВНИЕ", en: "RECENT" },
  "create.empty": { ru: "Вы ещё не создали задач", en: "No tasks created yet" },
  "create.form.title": { ru: "Новая задача", en: "New task" },
  "create.form.project": { ru: "Проект", en: "Project" },
  "create.form.taskName": { ru: "Что нужно сделать?", en: "What needs to be done?" },
  "create.form.priority": { ru: "Приоритет", en: "Priority" },
  "create.form.cancel": { ru: "Отмена", en: "Cancel" },
  "create.form.create": { ru: "Создать", en: "Create" },
  "create.form.status": { ru: "Статус", en: "Status" },
  "create.form.selectStatus": { ru: "Выберите статус", en: "Select status" },

  // Profile
  "profile.title": { ru: "Профиль", en: "Profile" },
  "profile.connection": { ru: "ПОДКЛЮЧЕНИЕ", en: "CONNECTION" },
  "profile.server": { ru: "Сервер", en: "Server" },
  "profile.connected": { ru: "Подключено", en: "Connected" },
  "profile.display": { ru: "ОТОБРАЖЕНИЕ", en: "DISPLAY" },
  "profile.cardView": { ru: "Вид карточки", en: "Card view" },
  "profile.app": { ru: "ПРИЛОЖЕНИЕ", en: "APP" },
  "profile.theme": { ru: "Тема", en: "Theme" },
  "profile.themeSystem": { ru: "Системная", en: "System" },
  "profile.language": { ru: "Язык", en: "Language" },
  "profile.version": { ru: "Версия", en: "Version" },
  "profile.logout": { ru: "Выйти", en: "Log out" },
  "profile.logoutConfirm": { ru: "Вы уверены?", en: "Are you sure?" },

  // Login
  "login.email": { ru: "Email", en: "Email" },
  "login.password": { ru: "Пароль", en: "Password" },
  "login.button": { ru: "Войти", en: "Sign in" },
  "login.error": { ru: "Ошибка", en: "Error" },
  "login.errorCredentials": { ru: "Введите email и пароль", en: "Enter email and password" },
  "login.errorFailed": { ru: "Авторизация не удалась", en: "Authentication failed" },

  // Card Settings
  "cardSettings.title": { ru: "Вид карточки", en: "Card view" },
  "cardSettings.hint": { ru: "Выберите какие поля отображать на карточках Kanban-доски", en: "Choose which fields to show on Kanban cards" },
  "cardSettings.labels": { ru: "Метки", en: "Labels" },
  "cardSettings.priority": { ru: "Приоритет", en: "Priority" },
  "cardSettings.assignees": { ru: "Исполнители", en: "Assignees" },
  "cardSettings.dueDate": { ru: "Дедлайн", en: "Due date" },
  "cardSettings.id": { ru: "ID задачи", en: "Task ID" },
  "cardSettings.attachments": { ru: "Вложения", en: "Attachments" },
  "cardSettings.coverImage": { ru: "Фото-обложка", en: "Cover image" },
  "cardSettings.note": { ru: "Изменения применятся при следующем обновлении доски (pull-to-refresh)", en: "Changes will apply on next board refresh (pull-to-refresh)" },

  // Swipe actions
  // Search
  "search.placeholder": { ru: "Поиск задач...", en: "Search tasks..." },
  "search.empty": { ru: "Ничего не найдено", en: "No results" },

  "swipe.start": { ru: "Начать", en: "Start" },
  "swipe.inProgress": { ru: "В работу", en: "In Progress" },
  "swipe.done": { ru: "Готово", en: "Done" },
  "swipe.reopen": { ru: "Открыть", en: "Reopen" },
  "swipe.cancel": { ru: "Отменить", en: "Cancel" },
  "swipe.assign": { ru: "Взять себе", en: "Assign me" },

  // Notes
  "notes.title": { ru: "Заметки", en: "Notes" },
  "notes.placeholder": { ru: "Быстрая заметка...", en: "Quick note..." },
  "notes.empty": { ru: "Нет заметок", en: "No notes" },
  "notes.createTask": { ru: "Создать задачу", en: "Create task" },
  "notes.delete": { ru: "Удалить", en: "Delete" },

  // Common
  "common.error": { ru: "Ошибка", en: "Error" },
  "common.cancel": { ru: "Отмена", en: "Cancel" },
  "common.ok": { ru: "OK", en: "OK" },
  "common.ago": { ru: "назад", en: "ago" },
  "common.justNow": { ru: "только что", en: "just now" },
  "common.logout": { ru: "Выйти", en: "Log out" },
  "common.continue": { ru: "Продолжить", en: "Continue" },

  // Portal
  "portal.title": { ru: "Портал поддержки", en: "Support Portal" },
  "portal.chooseMode": { ru: "Выберите режим работы", en: "Choose your mode" },
  "portal.modePM": { ru: "Управление проектами", en: "Project Management" },
  "portal.modePMDesc": { ru: "Для сотрудников: задачи, проекты, канбан", en: "For team members: tasks, projects, kanban" },
  "portal.modePortal": { ru: "Портал поддержки", en: "Support Portal" },
  "portal.modePortalDesc": { ru: "Для клиентов: заявки и обращения", en: "For clients: requests and inquiries" },
  "portal.enterEmail": { ru: "Введите email", en: "Enter your email" },
  "portal.emailHint": { ru: "Мы отправим код подтверждения на вашу почту", en: "We will send a verification code to your email" },
  "portal.sendCode": { ru: "Отправить код", en: "Send code" },
  "portal.codeSendFailed": { ru: "Не удалось отправить код", en: "Failed to send code" },
  "portal.backToLogin": { ru: "Войти как сотрудник", en: "Sign in as team member" },
  "portal.enterCode": { ru: "Введите код", en: "Enter code" },
  "portal.codeSentTo": { ru: "Код отправлен на", en: "Code sent to" },
  "portal.codeInvalid": { ru: "Неверный код", en: "Invalid code" },
  "portal.resendIn": { ru: "Отправить повторно через", en: "Resend in" },
  "portal.seconds": { ru: "с", en: "s" },
  "portal.resendCode": { ru: "Отправить повторно", en: "Resend code" },
  "portal.changeEmail": { ru: "Изменить email", en: "Change email" },
  "portal.myRequests": { ru: "Мои обращения", en: "My Requests" },
  "portal.noIssues": { ru: "Нет обращений", en: "No requests" },
  "portal.noIssuesHint": { ru: "Создайте первое обращение нажав +", en: "Create your first request by tapping +" },
  "portal.issue": { ru: "Обращение", en: "Request" },
  "portal.createIssue": { ru: "Новое обращение", en: "New Request" },
  "portal.support": { ru: "Поддержка", en: "Support" },
  "portal.writeMessage": { ru: "Написать сообщение...", en: "Write a message..." },
  "portal.issueNotFound": { ru: "Обращение не найдено", en: "Request not found" },
  "portal.selectType": { ru: "Тип обращения", en: "Request Type" },
  "portal.selectTypeHint": { ru: "Выберите тип вашего обращения", en: "Choose the type of your request" },
  "portal.noRequestTypes": { ru: "Нет доступных типов", en: "No request types available" },
  "portal.issueTitle": { ru: "Тема", en: "Subject" },
  "portal.issueTitlePlaceholder": { ru: "Кратко опишите проблему", en: "Briefly describe the issue" },
  "portal.issueDescription": { ru: "Описание", en: "Description" },
  "portal.issueDescPlaceholder": { ru: "Подробности обращения...", en: "Request details..." },
  "portal.fillRequired": { ru: "Заполните обязательные поля", en: "Fill in required fields" },
  "portal.submit": { ru: "Отправить", en: "Submit" },
  "portal.issueCreated": { ru: "Обращение создано", en: "Request created" },
  "portal.issueCreatedHint": { ru: "Мы свяжемся с вами в ближайшее время", en: "We will get back to you shortly" },
  "portal.createFailed": { ru: "Не удалось создать обращение", en: "Failed to create request" },
  "portal.state.backlog": { ru: "В очереди", en: "Queued" },
  "portal.state.unstarted": { ru: "Новое", en: "New" },
  "portal.state.started": { ru: "В работе", en: "In Progress" },
  "portal.state.completed": { ru: "Решено", en: "Resolved" },
  "portal.state.cancelled": { ru: "Отменено", en: "Cancelled" },
  "portal.loadFailed": { ru: "Не удалось загрузить данные", en: "Failed to load data" },
  "portal.invalidEmail": { ru: "Некорректный email", en: "Invalid email address" },
  "portal.sendMessage": { ru: "Отправить сообщение", en: "Send message" },
};

export function t(key: string): string {
  return translations[key]?.[currentLang] ?? key;
}

export function tPriority(p?: string): string {
  return t(`priority.${p || "none"}`);
}
