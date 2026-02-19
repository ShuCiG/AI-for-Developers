# План рефакторинга и анализа кода

## 1. Собранная информация

### 1.1 Структура проекта
- **Frontend (web):** React 19, TypeScript, Vite 7, Tailwind 4. Страницы: dashboard, chat, words, word-pairs, random-phrase, words-game, login, signup.
- **Backend (ai):** Flask, CrewAI, Supabase client. Эндпоинты: health, random-phrase, example-sentences, classify-difficulty, words-game, chat, chat/save-word.
- **Supabase:** миграции (words, profiles, word_pairs, chats, chat_messages, seed_initial_words), отдельный seed-файл `seeds/words.sql`.
- **Скрипты:** `scripts/setup-and-verify.ps1` для запуска и проверки.

### 1.2 Выявленные проблемы и недочёты

| # | Область | Проблема | Критичность |
|---|--------|----------|-------------|
| 1 | **ai/run.py** | В `generate_random_phrase` для полей `words` и `user_context` используется `jsonify(...).get_data(as_text=True)`. Это сериализация через Flask Response; для входов CrewAI корректнее и единообразнее использовать `json.dumps(words)` и `str(user_context)`, как в `generate_words_game`. | Средняя |
| 2 | **ai/run.py** | Импорт `typing.Any` не используется — можно удалить. | Низкая |
| 3 | **web/app-sidebar** | Chat дублируется трижды: в блоке под логотипом (SidebarHeader), в navMain (Dashboard + Chat), в documents (Chat первым пунктом). Для упрощения UI можно оставить Chat только в navMain и в documents, убрав отдельную кнопку из header сайдбара. | Низкая |
| 4 | **web/chat.tsx** | В `handleSaveWord` используется динамический `import('@/lib/supabase')` — создаёт лишний chunk и предупреждение Vite. Достаточно статического импорта `supabase` в начале файла. | Низкая |
| 5 | **web/use-chat-messages** | `updateChatTitle` и `touchChatUpdatedAt` не инвалидируют список чатов в родителе — заголовок в сайдбаре обновится только после перезагрузки или перехода. Можно добавить callback/refetch в useChats после обновления title или оставить как есть (приемлемый компромисс). | Низкая |
| 6 | **web/nav-main** | Кнопки "Quick Create" и "Inbox" не ведут никуда (нет asChild/Link). "Inbox" — заглушка. Либо привязать к реальным действиям/страницам, либо убрать/упростить. | Низкая |
| 7 | **Supabase** | Два источника начальных слов: миграция `20260217120000_seed_initial_words.sql` (100 слов) и `supabase/seeds/words.sql` (много слов). Seed выполняется только при `db reset`. Для консистентности можно оставить миграцию для сценария "только migration up", в README/AGENTS указать, что при reset подтягивается полный seed. | Инфо |
| 8 | **web/database.types** | В типах нет таблицы `profiles` (есть в БД). Комментарий в файле рекомендует генерировать типы через `supabase gen types typescript --local`. Имеет смысл добавить profiles в типы или обновить инструкцию. | Низкая |
| 9 | **Backend** | При отсутствии `SUPABASE_SERVICE_ROLE_KEY` создаётся `supabase_admin = None` — использование везде проверяется, утечек нет. Ок. | — |
| 10 | **Chat** | Обработка ошибок (в т.ч. 401, timeout, 503) и отображение сообщений пользователю есть; дублирование типов word_card между backend payload и frontend — допустимо. | — |

---

## 2. План действий (приоритет)

### Фаза 1 — Исправления и консистентность (рекомендуется)
1. **run.py:** заменить в `generate_random_phrase` передачу `words` и `user_context` на `json.dumps(words)` и `user_context or ""` (или `str(user_context)`), убрать неиспользуемый импорт `Any`.
2. **chat.tsx:** заменить динамический `import('@/lib/supabase')` на статический импорт `supabase` из `@/lib/supabase`.
3. **database.types:** при необходимости добавить таблицу `profiles` (или оставить только инструкцию по `supabase gen types` в README/AGENTS).

### Фаза 2 — Упрощение UI (по желанию)
4. **app-sidebar:** убрать дублирование Chat — оставить один пункт Chat в navMain и один в списке documents (или только в navMain), убрав отдельную кнопку Chat из SidebarHeader.
5. **nav-main:** либо добавить ссылки/действия для "Quick Create" и "Inbox", либо убрать кнопку Inbox и оставить только "Quick Create" с осмысленным действием (например, "New chat" или выпадающее меню).

### Фаза 3 — Улучшения без смены поведения
6. **use-chat-messages / useChats:** опционально — после `updateChatTitle(chatId, title)` вызывать refetch чатов в родителе (например, передавать `onChatTitleChange` из useChats в чат-страницу и вызывать refetch), чтобы заголовок в сайдбаре обновлялся без перезагрузки.
7. **Документация:** в AGENTS.md или README кратко описать: seed words (seeds/words.sql) используется при `db reset`; при только `migration up` слова попадают из миграции seed_initial_words.

### Фаза 4 — Не делать без согласования
- Менять структуру CrewAI (crews) или контракты API.
- Удалять миграции или менять историю Supabase.
- Трогать RLS и политики без необходимости.

---

## 3. Итог

- **Критичных ошибок** не найдено; приложение работоспособно.
- **Имеет смысл исправить:** сериализацию в `generate_random_phrase`, неиспользуемый импорт, динамический импорт supabase в чате.
- **По желанию:** уменьшить дублирование Chat в сайдбаре, оживить или убрать "Quick Create"/"Inbox", обновить типы/документацию по БД и seed.

После выполнения Фазы 1 код станет консистентнее и без лишних предупреждений; Фазы 2–3 — по необходимости и приоритетам.
