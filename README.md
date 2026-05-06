# IDP Dashboard v2

Локальный MVP продуктового дашборда для RAG-платформы.

Сейчас это небольшой `FastAPI`-проект без базы данных и без внешнего API:

- сервер отдает HTML-страницу через `Jinja2`;
- данные берутся из локальных `JSON`-файлов;
- интерактивность дашборда живет в `app/static/js/dashboard.js`.

## Что здесь уже есть

- главная страница дашборда: `/`
- healthcheck: `/health`
- 5 виджетов:
  - заведенные инициативы
  - инициативы в ПРОМе
  - вызовы LLM сервисов
  - источники
  - тикеты
- вкладка `UI Kit` внутри интерфейса
- тесты на загрузку данных, фильтрацию и рендер страницы

## Быстрый старт

Требования:

- `Python 3.12+`

Создать окружение и установить зависимости:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
```

Запустить проект:

```bash
python -m uvicorn app.main:app --reload
```

После запуска открыть:

- [http://127.0.0.1:8000](http://127.0.0.1:8000)

Если порт `8000` занят, можно выбрать другой:

```bash
python -m uvicorn app.main:app --reload --port 8010
```

Тогда приложение будет доступно по адресу:

- [http://127.0.0.1:8010](http://127.0.0.1:8010)

## Как остановить проект

Если сервер запущен в терминале, остановка обычная:

```bash
Ctrl+C
```

## Как проверить, что все поднялось

Проверка healthcheck:

```bash
curl -s http://127.0.0.1:8000/health
```

Ожидаемый ответ:

```json
{"status":"ok"}
```

Если запускал на другом порту, просто замени `8000` на свой порт.

## Как прогнать тесты

```bash
python -m pytest
```

## Что лежит в проекте

```text
app/
  main.py                  # точка входа FastAPI
  routes/pages.py          # маршрут главной страницы
  services/                # загрузка данных и подготовка payload
  config/widgets.py        # описание виджетов, фильтров и осей
  domain/                  # pydantic-модели и enum'ы
  templates/               # Jinja2-шаблоны
  static/                  # CSS и JS
  data/                    # локальные JSON-данные
tests/                     # автотесты
requirements/              # продуктовые и архитектурные заметки
pyproject.toml             # зависимости и настройки проекта
```

## Как проект работает

1. При старте приложение читает данные из `app/data/*.json`.
2. В `app/services/chart_payloads.py` собирается единый payload для дашборда.
3. Payload кладется в `app.state.dashboard_payload`.
4. Маршрут `/` из `app/routes/pages.py` рендерит `dashboard.html`.
5. Фронтенд-скрипт `app/static/js/dashboard.js` читает payload и управляет фильтрами, графиками и состояниями виджетов.

## Ключевые файлы

- [app/main.py](/Users/vadimkovtunenko/05%20repos/idp-dashboard-v2/app/main.py) - создание `FastAPI` приложения, подключение роутов и статики
- [app/routes/pages.py](/Users/vadimkovtunenko/05%20repos/idp-dashboard-v2/app/routes/pages.py) - рендер главной страницы
- [app/services/data_loader.py](/Users/vadimkovtunenko/05%20repos/idp-dashboard-v2/app/services/data_loader.py) - чтение и нормализация данных из `JSON`
- [app/services/chart_payloads.py](/Users/vadimkovtunenko/05%20repos/idp-dashboard-v2/app/services/chart_payloads.py) - подготовка данных для фронта и overview-карточек
- [app/services/filter_engine.py](/Users/vadimkovtunenko/05%20repos/idp-dashboard-v2/app/services/filter_engine.py) - логика зависимых фильтров и периодов
- [app/config/widgets.py](/Users/vadimkovtunenko/05%20repos/idp-dashboard-v2/app/config/widgets.py) - конфигурация всех 5 виджетов
- [app/templates/dashboard.html](/Users/vadimkovtunenko/05%20repos/idp-dashboard-v2/app/templates/dashboard.html) - HTML-шаблон страницы
- [app/static/js/dashboard.js](/Users/vadimkovtunenko/05%20repos/idp-dashboard-v2/app/static/js/dashboard.js) - фронтенд-логика дашборда

## Данные

В проекте используются три локальных набора данных:

- `app/data/monthly_metrics.json` - месячные метрики по инициативам и вызовам
- `app/data/source_distribution.json` - распределение по источникам
- `app/data/tickets.json` - данные по тикетам в разрезе спринтов

Это важно: сейчас данные статические. Базы данных, фоновых джоб и интеграции с внешними сервисами в проекте нет.

## Документы с требованиями

В папке `requirements/` лежат исходные заметки по продукту и архитектуре:

- `Product-dashboard.md`
- `Product-dashboard-architecture.md`
- `Product-dashboard-design.md`

Их полезно читать вместе с кодом, если хочется понять, почему виджеты и фильтры устроены именно так.
