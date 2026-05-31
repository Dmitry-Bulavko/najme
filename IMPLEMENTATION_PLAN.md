# Plan имплементации — Najme.me

> Документ описывает порядок разработки от текущего состояния до полноценного MVP.  
> Обновлён: 2026-05-31

---

## Текущее состояние (baseline)

| Слой | Что готово | Что является заглушкой |
|---|---|---|
| **Server** | Auth (login/register/Google), JWT генерация | Пароль без хеша, нет profiles/chat/reviews endpoints, нет JWT guard |
| **Web** | Auth страницы, главная с поиском (UI) | Mock данные, поиск не подключён к API, нет страницы профиля |
| **Mobile** | Auth экраны, home/search/account вкладки, profile detail | Mock данные везде, contact button пустой |
| **Shared** | User и Profile типы | Нет типов для Chat, Review, Request |
| **DB Schema** | User, UserInfo, ProfessionProfile, Cities, Countries | Нет Profile, Review, Message, Request, Category |

---

## Фазы разработки

```
Фаза 0 — Фундамент (исправить критические проблемы)
Фаза 1 — Ядро MVP (поиск и просмотр профилей)
Фаза 2 — Взаимодействие (чат и заявки)
Фаза 3 — Доверие (отзывы и верификация)
Фаза 4 — Операции (admin-панель)
Фаза 5 — Монетизация (продвижение)
```

---

## Фаза 0 — Фундамент
**Цель:** устранить критические уязвимости и технический долг до написания новой функциональности.

### 0.1 Безопасность авторизации
**Проблема:** пароли хранятся в открытом виде — `auth.service.ts` сравнивает `user.password !== loginDto.password`.

- [ ] Добавить `bcrypt` в server: хеширование при `register`, сравнение при `login`
- [ ] Добавить `JwtAuthGuard` и `@UseGuards` для защищённых endpoints
- [ ] Вынести JWT secret в `.env` (сейчас хардкодирован в `app.module.ts`)
- [ ] Создать `UserInfo` при обычной регистрации (сейчас только для Google)

### 0.2 Схема базы данных
**Проблема:** Prisma schema не содержит основных сущностей продукта.

Добавить модели:

```prisma
Category         — id, slug, name (i18n JSON), createdAt
SpecialistProfile — id, userId, categoryId, title, description, experience, 
                    cities[], hourlyRate, currency, workFormat, status (PENDING/APPROVED/REJECTED), 
                    isPromoted, createdAt, updatedAt
PortfolioItem    — id, profileId, url, type (IMAGE/VIDEO), caption
Certificate      — id, profileId, title, url
Review           — id, profileId, authorId, rating (1-5), comment, createdAt
Conversation     — id, clientId, specialistId, createdAt
Message          — id, conversationId, senderId, text, createdAt, readAt
ServiceRequest   — id, clientId, profileId, message, status (PENDING/ACCEPTED/DECLINED/DONE), 
                   scheduledAt, createdAt
ContactInfo      — id, profileId, phone, whatsapp, telegram, otherLinks[]
```

- [ ] Написать миграцию
- [ ] Обновить `packages/shared` — добавить TypeScript типы для всех новых моделей
- [ ] Пересмотреть существующие `ProfessionProfile` / `Cities` / `Countries` — заменить или связать с новой схемой

### 0.3 Инфраструктура i18n (Web)
**Проблема:** есть контекст переводов, но нет ключей для большинства будущих страниц.

- [ ] Расширить `web/src/i18n/translations.ts` — добавить структуру для всех предстоящих страниц
- [ ] Договориться о формате ключей и зафиксировать конвенцию

---

## Фаза 1 — Ядро MVP
**Цель:** пользователь может найти специалиста и посмотреть его полный профиль.

### 1.1 Server — Profiles API

- [ ] Создать `ProfilesModule` (controller, service, module)
- [ ] `GET /api/v1/profiles` — список с фильтрацией и пагинацией
  - query params: `search`, `categorySlug`, `city`, `page`, `pageSize`, `sortBy` (rating | createdAt | promoted)
  - response: `{ data: Profile[], total, page, pageSize }`
- [ ] `GET /api/v1/profiles/:id` — детальный профиль со всеми связями
- [ ] `POST /api/v1/profiles` — создание профиля (только авторизованный, одному user — один профиль)
- [ ] `PATCH /api/v1/profiles/:id` — редактирование (только владелец)
- [ ] `GET /api/v1/categories` — список категорий (для фильтров и форм)

### 1.2 Server — File Upload

- [ ] Настроить `@nestjs/platform-express` + multer или внешний S3-совместимый storage
- [ ] `POST /api/v1/upload` — загрузка файла (изображение/видео), возвращает URL
- [ ] Ограничения: тип файла, размер (10MB для фото, 100MB для видео)

### 1.3 Web — Главная страница

- [ ] Убрать `MOCK_PROFILES`, подключить `profilesApi.list(filters)`
- [ ] Фильтры (категория, город, поиск) — управляют state, который передаётся в API запрос
- [ ] Пагинация — синхронизировать с `page` из API response
- [ ] Skeleton loader пока данные загружаются
- [ ] Empty state если профилей нет

### 1.4 Web — Страница профиля специалиста

- [ ] Создать `/profiles/[id]` — новая страница (сейчас не существует)
- [ ] Секции: шапка (аватар, имя, verified, категория, город, рейтинг), описание, портфолио (фото/видео галерея), опыт и сертификаты, цена и режим работы, отзывы (фаза 3), кнопка "Написать" / "Оставить заявку"
- [ ] SSR через `fetch` на сервере (Next.js 15 server component)

### 1.5 Web — Личный кабинет специалиста

- [ ] Страница `/dashboard` (только для авторизованных)
- [ ] Мой профиль — просмотр и кнопка редактировать
- [ ] Форма создания/редактирования профиля:
  - Основная информация (название, категория, описание)
  - Города работы (мультиселект)
  - Опыт, сертификаты (список с добавлением)
  - Портфолио (загрузка фото/видео)
  - Контакты (телефон, WhatsApp, Telegram)
  - Цена и режим работы
- [ ] После сохранения → статус "На модерации"

### 1.6 Mobile — Подключение к API

- [ ] Убрать `MOCK_PROFILES` из Home экрана, подключить `profilesApi.list()`
- [ ] Profile Detail экран — загружать по `id` из route params, убрать хардкод
- [ ] Account экран — отображать реальные данные пользователя из JWT / API
- [ ] Добавить Skeleton / ActivityIndicator при загрузке

### 1.7 Mobile — Экран профиля (полный)

- [ ] Расширить `profile/[id].tsx` — добавить секции портфолио, сертификаты, контакты
- [ ] Галерея фото/видео (FlatList горизонтальный)
- [ ] Contact button — открывать экран чата (фаза 2) или ссылку на WhatsApp/Telegram

---

## Фаза 2 — Взаимодействие
**Цель:** клиент может написать специалисту и оставить заявку.

### 2.1 Server — Chat (WebSocket)

- [ ] Установить `@nestjs/websockets` + `socket.io`
- [ ] `ChatModule`: Gateway, Service
- [ ] Events: `join_conversation`, `send_message`, `message_received`, `mark_read`
- [ ] REST endpoints:
  - `GET /api/v1/conversations` — список бесед текущего пользователя
  - `GET /api/v1/conversations/:id/messages` — история сообщений (пагинация)
  - `POST /api/v1/conversations` — создать беседу (clientId + profileId)

### 2.2 Server — Service Requests

- [ ] `RequestsModule`
- [ ] `POST /api/v1/requests` — клиент создаёт заявку специалисту (message, scheduledAt)
- [ ] `GET /api/v1/requests` — список (для специалиста — входящие, для клиента — исходящие)
- [ ] `PATCH /api/v1/requests/:id/status` — специалист принимает/отклоняет
- [ ] `PATCH /api/v1/requests/:id/done` — отметить выполненной (открывает возможность отзыва)

### 2.3 Web — Чат

- [ ] `/messages` — список бесед
- [ ] `/messages/[conversationId]` — экран чата
  - Отображение истории с пагинацией (infinite scroll вверх)
  - Поле ввода + отправка
  - Real-time обновление через Socket.IO
- [ ] Индикатор непрочитанных в header

### 2.4 Web — Заявки

- [ ] Кнопка "Оставить заявку" на странице профиля → модальное окно
- [ ] Форма заявки: сообщение, желаемая дата/время
- [ ] `/dashboard/requests` — список входящих заявок (для специалиста)
- [ ] `/my-requests` — список исходящих (для клиента)
- [ ] Смена статуса заявки (принять/отклонить/выполнено)

### 2.5 Mobile — Чат и заявки

- [ ] Вкладка "Сообщения" в bottom tab navigation
- [ ] Список бесед + экран чата с Socket.IO
- [ ] Кнопка "Написать" / "Оставить заявку" на profile detail экране
- [ ] Вкладка/секция "Заявки" в account

---

## Фаза 3 — Доверие
**Цель:** отзывы и верификация профилей.

### 3.1 Server — Reviews

- [ ] `ReviewsModule`
- [ ] `POST /api/v1/reviews` — оставить отзыв (только если есть выполненная заявка от этого клиента к этому профилю)
- [ ] `GET /api/v1/profiles/:id/reviews` — отзывы профиля (пагинация)
- [ ] Автоматический пересчёт `rating` и `reviewCount` в `SpecialistProfile` при добавлении отзыва

### 3.2 Server — Moderation

- [ ] Статус профиля: `PENDING → APPROVED / REJECTED`
- [ ] `PATCH /api/v1/admin/profiles/:id/status` — смена статуса (роль ADMIN)
- [ ] Email-нотификация специалисту при изменении статуса (через nodemailer или внешний сервис)
- [ ] Флаг `isVerified` на профиле — выставляется вручную через admin

### 3.3 Web/Mobile — Reviews

- [ ] Секция отзывов на странице профиля (с реальными данными)
- [ ] Форма оставления отзыва (звёздный рейтинг + комментарий) — показывается если была завершённая заявка
- [ ] Аватар, имя, дата, текст отзыва

---

## Фаза 4 — Операции
**Цель:** admin-панель для управления платформой.

### 4.1 Web — Admin Panel `/admin`

- [ ] Защита роутов — только пользователи с ролью `ADMIN`
- [ ] **Модерация профилей:**
  - Список новых анкет (статус PENDING)
  - Детальный просмотр анкеты
  - Кнопки "Одобрить" / "Отклонить с причиной"
  - Кнопка "Верифицировать" (выдать verified badge)
- [ ] **Управление пользователями:**
  - Список всех пользователей
  - Поиск по email/login
  - Блокировка/разблокировка
  - Назначение роли ADMIN
- [ ] **Управление категориями:**
  - CRUD категорий (slug, названия на 3 языках, иконка)
- [ ] **Жалобы:**
  - Просмотр жалоб на профили / отзывы
  - Удаление контента

### 4.2 Server — Admin Endpoints

- [ ] Роль `ADMIN` в модели User
- [ ] `AdminModule` — все endpoints требуют роль ADMIN
- [ ] `GET /api/v1/admin/profiles?status=PENDING` — анкеты на модерации
- [ ] `GET /api/v1/admin/users` — все пользователи
- [ ] `PATCH /api/v1/admin/users/:id` — изменение роли, блокировка
- [ ] `POST /api/v1/admin/categories` — создание категории
- [ ] `DELETE /api/v1/admin/reviews/:id` — удаление отзыва

---

## Фаза 5 — Монетизация
**Цель:** платное продвижение анкет.

### 5.1 Продвижение

- [ ] Поле `isPromoted`, `promotedUntil` в `SpecialistProfile`
- [ ] `GET /api/v1/profiles` — промотированные анкеты выводятся первыми в поиске
- [ ] Страница `/promote` — выбор пакета продвижения (1 месяц / 3 месяца / 6 месяцев)
- [ ] Интеграция с платёжным шлюзом (Stripe или local — определить отдельно)
- [ ] После оплаты — `isPromoted = true`, `promotedUntil = now + duration`
- [ ] Admin: список промо-пакетов, ручная активация/деактивация

---

## Сквозные задачи (выполняются по ходу)

### Тестирование
- [ ] Unit-тесты для auth.service и будущих сервисов (Jest, уже настроен)
- [ ] E2E тесты критических пользовательских сценариев (supertest)

### Инфраструктура
- [ ] CI/CD pipeline (GitHub Actions или аналог)
- [ ] Staging окружение
- [ ] Docker Compose для prod (уже есть базовый `docker-compose.yml`)
- [ ] Настройка environment variables для всех окружений

### SEO и производительность (Web)
- [ ] Metadata для страниц через Next.js `generateMetadata`
- [ ] OG-теги для страниц профилей
- [ ] SSR для страницы профиля (важно для индексации)

### Push-уведомления (Mobile)
- [ ] Expo Push Notifications — настроить при реализации чата (фаза 2)

---

## Порядок приоритетов для разработки

```
Неделя 1–2:   Фаза 0  (фундамент: bcrypt, схема БД, типы)
Неделя 3–5:   Фаза 1a (server: profiles API, categories, file upload)
Неделя 6–8:   Фаза 1b (web: главная с API, страница профиля, dashboard)
Неделя 9–10:  Фаза 1c (mobile: подключение API, profile detail)
Неделя 11–13: Фаза 2  (чат, заявки — server + web + mobile)
Неделя 14–15: Фаза 3  (отзывы, верификация)
Неделя 16–18: Фаза 4  (admin-панель)
Post-launch:  Фаза 5  (монетизация)
```

---

## Критические решения, требующие принятия до начала

| Вопрос | Почему важно | Когда нужен ответ |
|---|---|---|
| Хранилище файлов (S3 / Cloudflare R2 / локальное?) | Влияет на реализацию upload API и CDN URLs | До Фазы 1 |
| Email-провайдер (Resend / SendGrid / SMTP?) | Нужен для уведомлений при модерации | До Фазы 3 |
| Платёжный шлюз (Stripe / local?) | Влияет на архитектуру биллинга | До Фазы 5 |
| Домен и hosting стратегия | Web (Vercel?), Server (VPS?), Mobile (EAS Build?) | До Фазы 1 |
