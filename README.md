# NewsHub — Новости и RSS

Лабораторная работа по Docker Compose.
Вариант №5 — Новости и RSS.

## Описание проекта

NewsHub — веб-приложение для поиска новостей через RSS
и управления сохранёнными статьями.

## Возможности

- Поиск новостей по ключевым словам
- Получение актуальных статей из RSS Лента.ру
- Сохранение статей в PostgreSQL
- Просмотр избранных новостей
- Отметки «Прочитано» и «Не прочитано»
- Удаление сохранённых статей
- Фильтрация и сортировка избранного
- Полноценные операции CRUD через REST API

## Архитектура

Приложение состоит из четырёх Docker-контейнеров:

1. frontend — Nginx, HTML, CSS, JavaScript
2. backend — Python, FastAPI
3. db — PostgreSQL 16
4. web-service — Python, RSS, feedparser

Frontend взаимодействует с Backend через REST API.
Backend обращается к PostgreSQL и RSS Web-service.

## Запуск

Требуются Docker и Docker Compose.

1. Клонировать репозиторий.
2. Создать файл .env на основе .env.example.
3. Указать надёжный POSTGRES_PASSWORD.
4. Выполнить:

    docker compose up -d --build

5. Открыть в браузере:

    http://localhost:8008

В docker-compose.yml порт привязан к 127.0.0.1.
Для доступа с другого компьютера используется SSH-туннель.

## REST API

GET /api/health — проверка работоспособности
GET /api/news?q=слово — поиск новостей
GET /api/articles — получение сохранённых статей
POST /api/articles — сохранение статьи
PATCH /api/articles/{id} — изменение статуса прочтения
DELETE /api/articles/{id} — удаление статьи

## База данных

Используется PostgreSQL с постоянным Docker volume.

Файл db/init.sql создаёт начальную структуру базы.
Файл db/migration_002_read_status.sql предназначен
для добавления статуса прочтения в существующую базу.

## Остановка

    docker compose down

Для сохранения данных не используйте docker compose down -v.
