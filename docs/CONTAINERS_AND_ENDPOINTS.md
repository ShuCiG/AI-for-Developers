# Контейнеры и эндпоинты

## Новые возможности (Chat)

- **Чат Language Tutor** (страница Chat): переводы, новая лексика, грамматика, примеры. Ответы бывают текстом или **карточкой слова** (word_card). На карточке кнопка **"Add to my list"** сохраняет пару слов в таблицу `word_pairs` (через Supabase с фронта). На странице чата есть кнопка **Help** с кратким описанием и примерами запросов.

## Контейнеры (Docker Compose)

| Сервис    | Порт  | Описание |
|-----------|-------|----------|
| **web**   | 5173  | Фронтенд (Vite dev). Проксирует `/api` и `/health` на `ai:8000`. |
| **ai**    | 8000  | Бэкенд (Flask). Зависит от `phoenix`. Ожидает Supabase на хосте (`supabase start`). |
| **phoenix** | 6006 | Arize Phoenix (observability). Зависит от `phoenix-db`. |
| **phoenix-db** | —  | PostgreSQL для Phoenix (внутренняя сеть). |

**Запуск:** `docker compose up --build`  
**Supabase:** отдельно: `supabase start` (порт 54321). В `ai/.env`: `SUPABASE_URL=http://host.docker.internal:54321`.

---

## Эндпоинты бэкенда (ai)

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| GET  | `/health` | — | Проверка живости (healthcheck). |
| POST | `/api/random-phrase` | JWT | Тело: `{ "words": ["..."] }`. Генерация фразы. |
| POST | `/api/example-sentences` | JWT | Тело: `{ "word1", "word2" }`. Примеры предложений. |
| POST | `/api/classify-difficulty` | JWT | Тело: `{ "word1", "word2" }`. Сложность слов. |
| POST | `/api/words-game` | JWT | Тело: `{ "words": ["a","b","c"] }` (3 слова). Игра с плейсхолдерами. |
| POST | `/api/chat` | JWT | Тело: `{ "chat_id?", "message", "history": [{ "role", "content" }] }`. Ответ: `{ "content" }` или `{ "response_type": "word_card", "payload": { ... } }`. |
| POST | `/api/chat/save-word` | JWT | Тело: `{ "word1", "word2", "description?" }`. Сохранение в `word_pairs` (нужен `SUPABASE_SERVICE_ROLE_KEY` в `ai/.env`). |

Все `/api/*` требуют заголовок: `Authorization: Bearer <jwt>`.

---

## Использование с фронта (web)

- **В Docker:** в `docker-compose` для web задано `VITE_AI_SERVICE_URL=` (пусто) — запросы идут на тот же origin (Vite), прокси перенаправляет на `http://ai:8000`.
- **Локально:** в `web/.env.local` можно задать `VITE_AI_SERVICE_URL=http://localhost:8000` — тогда запросы идут напрямую на бэкенд.

Вызовы из кода:
- `ai-service.ts`: `sendChatMessage`, `generateRandomPhrase`, `generateExampleSentences`, `classifyDifficulty`, `generateWordsGameText` — все используют `AI_SERVICE_URL` + путь выше.
- «Add to my list» в чате: вставка в `word_pairs` через Supabase с фронта (JWT пользователя), без вызова `/api/chat/save-word`.

---

## Проверка

```bash
# Health бэкенда
curl -s http://localhost:8000/health

# С JWT (после логина взять token из DevTools / Application)
curl -s -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{"message":"Hello","history":[]}'
```
