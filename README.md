- # **Wavv Lite** — lightweight browser speed & stability test

## Overview

Wavv Lite is a minimal static project that measures latency, jitter and download speed directly in the browser. It is suited for demos and portfolio showcasing.

## Features

- Lightweight static frontend (HTML/CSS/JS)
- Streaming download test (reads response stream)
- Basic user info (IP, provider, location) via public APIs with fallback
- Mobile-friendly responsive layout

## Run locally

1. Open `index.html` directly in the browser or use a simple local server (recommended):

```bash
# Python 3
python -m http.server 8000
# or use Live Server in VS Code
```

2. Open http://localhost:8000 and verify the app.

## Publishing to GitHub Pages (manual)

1. Create a new repository on GitHub.
2. In the repo web UI choose **Add file → Upload files** and upload the project files.
3. Commit to the `main` branch.
4. In Settings → Pages choose the publishing source (if you do not use an automated workflow, you can select `gh-pages` branch or `main`/`docs` folder depending on your workflow).

## Reliability notes

- User info is obtained from public APIs; in local development you may see CORS or 429 errors in the console — this is expected. For production reliability consider using a serverless proxy (Cloudflare Worker, Netlify/Vercel function) to cache responses and add proper CORS headers.
- For more accurate download measurements consider running multiple parallel download streams (4–8) and adding an upload test (requires a server endpoint).

## Project structure

- `index.html` — main page
- `css/style.css` — styles
- `js/engine.js` — test engine logic
- `js/main.js` — UI bindings
- `assets/` — icons and manifest

## License

If you need a license, I can add an MIT or another license file.

## Next steps

When you upload the project to GitHub, send me the repository link — I will check Pages settings and verify the live site.

--

Wavv Lite — минимальный статический проект, который измеряет latency, jitter и download speed прямо в браузере. Подходит для демонстраций и портфолио.

## Особенности

- Лёгкий, статический фронтенд (HTML/CSS/JS)
- Streaming‑download тест (чтение потока ответа)
- Простая информация о пользователе (IP, провайдер, локация) через публичные API с fallback
- Адаптивная вёрстка для мобильных устройств

## Как запустить локально

1. Откройте `index.html` напрямую в браузере или используйте простой локальный сервер (рекомендуется):

```bash
# Python 3
python -m http.server 8000
# или (Live Server в VS Code)
```

2. Откройте http://localhost:8000 и проверьте работу.

## Публикация на GitHub Pages (ручная)

1. Создайте новый репозиторий на GitHub.
2. В веб‑интерфейсе репозитория выберите _Add file → Upload files_ и загрузите все файлы проекта.
3. Закоммитьте изменения в ветку `main`.
4. (Опционально) В Settings → Pages укажите источник публикации: ветка `gh-pages` или `main`/`docs` в зависимости от вашего рабочего процесса. Если вы хотите автоматический деплой, можно добавить GitHub Action.

## Советы по надёжности

- Информацию о пользователе приложение получает от публичных API. В локальной разработке в консоли могут появляться ошибки CORS и 429 (rate limit) — это нормально. Для продакшена рекомендую настроить прокси (Cloudflare Worker или serverless function), который будет кешировать ответ и добавлять CORS‑заголовки.
- Для более точного измерения download speed — можно реализовать параллельные потоки загрузки (4–8 запросов) и добавить upload‑тест (требует серверного endpoint).

## Структура проекта

- `index.html` — главный файл
- `css/style.css` — стили
- `js/engine.js` — логика тестов
- `js/main.js` — привязка UI
- `assets/` — иконки и манифест

## Лицензия

Нужна ли вам лицензия — скажите, могу добавить `MIT` или другую.

Если хотите — после того, как выгрузите проект на GitHub, пришлите ссылку на репозиторий, я проверю Pages и дам финальные рекомендации.
