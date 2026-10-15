"""NewsHub REST API: RSS proxy and PostgreSQL CRUD for saved articles."""

import os
from datetime import datetime

import httpx
import psycopg
from psycopg.rows import dict_row
from fastapi import FastAPI, HTTPException, Query, Response
from pydantic import BaseModel, Field, HttpUrl

app = FastAPI(title="NewsHub API", version="2.0.0")

DATABASE_URL = os.environ["DATABASE_URL"]
RSS_SERVICE_URL = os.getenv("RSS_SERVICE_URL", "http://web-service:8001")


class ArticleCreate(BaseModel):
    title: str = Field(min_length=1, max_length=1000)
    url: HttpUrl
    source: str = Field(min_length=1, max_length=255)
    description: str | None = None
    published_at: datetime | None = None


class ArticleReadUpdate(BaseModel):
    is_read: bool


ARTICLE_COLUMNS = "id, title, url, source, description, published_at, saved_at, is_read"


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/news")
def search_news(q: str = Query(min_length=2, max_length=100)):
    try:
        response = httpx.get(
            f"{RSS_SERVICE_URL}/search",
            params={"q": q},
            timeout=45,
        )
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="RSS-сервис недоступен") from exc


@app.get("/api/articles")
def get_articles():
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT {ARTICLE_COLUMNS} FROM saved_articles ORDER BY saved_at DESC, id DESC")
            return {"articles": cur.fetchall()}


@app.get("/api/articles/{article_id}")
def get_article(article_id: int):
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT {ARTICLE_COLUMNS} FROM saved_articles WHERE id = %s", (article_id,))
            article = cur.fetchone()
    if article is None:
        raise HTTPException(status_code=404, detail="Статья не найдена")
    return {"article": article}


@app.post("/api/articles", status_code=201)
def save_article(article: ArticleCreate, response: Response):
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""INSERT INTO saved_articles (title, url, source, description, published_at)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (url) DO NOTHING
                    RETURNING {ARTICLE_COLUMNS}""",
                (
                    article.title,
                    str(article.url),
                    article.source,
                    article.description,
                    article.published_at,
                ),
            )
            saved = cur.fetchone()
            if saved is None:
                cur.execute(
                    f"SELECT {ARTICLE_COLUMNS} FROM saved_articles WHERE url = %s",
                    (str(article.url),),
                )
                saved = cur.fetchone()
                response.status_code = 200
    return {"article": saved}


@app.patch("/api/articles/{article_id}")
def update_article(article_id: int, changes: ArticleReadUpdate):
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE saved_articles SET is_read = %s WHERE id = %s RETURNING {ARTICLE_COLUMNS}",
                (changes.is_read, article_id),
            )
            article = cur.fetchone()
    if article is None:
        raise HTTPException(status_code=404, detail="Статья не найдена")
    return {"article": article}


@app.delete("/api/articles/{article_id}")
def delete_article(article_id: int):
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM saved_articles WHERE id = %s RETURNING id", (article_id,))
            deleted = cur.fetchone()
    if deleted is None:
        raise HTTPException(status_code=404, detail="Статья не найдена")
    return {"deleted": deleted["id"]}
