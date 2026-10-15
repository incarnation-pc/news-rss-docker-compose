import re
from html import unescape
from datetime import datetime, timezone

import feedparser
import httpx
from fastapi import FastAPI, HTTPException, Query

app = FastAPI(title="News RSS Service")

RSS_FEEDS = {
    "Лента.ру": "https://lenta.ru/rss/news",
}


def clean_text(text):
    text = re.sub(r"<[^>]+>", " ", text)
    return unescape(text).strip()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/search")
def search_news(q: str = Query(min_length=2, max_length=100)):
    articles = []
    available_feeds = 0

    with httpx.Client(
        timeout=10,
        follow_redirects=True
    ) as client:

        for source, url in RSS_FEEDS.items():
            try:
                response = client.get(url)
                response.raise_for_status()

                feed = feedparser.parse(response.content)

                if not feed.entries:
                    continue

                available_feeds += 1

                for entry in feed.entries:
                    title = entry.get("title", "")
                    link = entry.get("link", "")
                    description = clean_text(
                        entry.get("summary", "")
                    )

                    search_text = (
                        title + " " + description
                    ).casefold()

                    if q.casefold() not in search_text:
                        continue

                    if not link:
                        continue

                    published_at = None
                    date_parts = entry.get("published_parsed")

                    if date_parts:
                        published_at = datetime(
                            *date_parts[:6],
                            tzinfo=timezone.utc
                        ).isoformat()

                    articles.append({
                        "title": title,
                        "url": link,
                        "source": source,
                        "description": description[:500],
                        "published_at": published_at
                    })

            except (httpx.HTTPError, ValueError):
                continue

    if available_feeds == 0:
        raise HTTPException(
            status_code=503,
            detail="RSS-источники недоступны"
        )

    articles = articles[:30]

    return {
        "query": q,
        "count": len(articles),
        "articles": articles
    }
