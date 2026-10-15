"use strict";

const ui = {
  navSearch: document.getElementById("navSearch"),
  navSaved: document.getElementById("navSaved"),
  navSavedCount: document.getElementById("navSavedCount"),
  searchPanel: document.getElementById("searchPanel"),
  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("searchInput"),
  searchButton: document.getElementById("searchButton"),
  pageTitle: document.getElementById("pageTitle"),
  pageSubtitle: document.getElementById("pageSubtitle"),
  sectionTitle: document.getElementById("sectionTitle"),
  status: document.getElementById("status"),
  foundCount: document.getElementById("foundCount"),
  savedCount: document.getElementById("savedCount"),
  results: document.getElementById("results"),
  toast: document.getElementById("toast"),
};

let view = "search";
let searchResults = [];
let savedArticles = [];
let savedUrls = new Set();
let lastQuery = "";
let toastTimer;
let savedFilter = "all";
let savedSort = "newest";
let savedSearchText = "";

async function api(url, options) {
  const response = await fetch(url, options);
  let data;
  try { data = await response.json(); }
  catch { throw new Error(`Некорректный ответ сервера (HTTP ${response.status})`); }
  if (!response.ok) {
    throw new Error(typeof data.detail === "string" ? data.detail : `Ошибка HTTP ${response.status}`);
  }
  return data;
}

function showToast(message, isError = false) {
  ui.toast.textContent = message;
  ui.toast.classList.toggle("error", isError);
  ui.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 3600);
}

function showEmpty(title, description, icon = "⌕") {
  const box = document.createElement("div");
  box.className = "empty-state";
  const symbol = document.createElement("div");
  symbol.className = "empty-icon";
  symbol.textContent = icon;
  const heading = document.createElement("h3");
  heading.textContent = title;
  const text = document.createElement("p");
  text.textContent = description;
  box.append(symbol, heading, text);
  ui.results.replaceChildren(box);
}

function formatDate(iso) {
  if (!iso) return "Без даты";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Без даты";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric", month: "short", year: "numeric",
  }).format(date);
}

function makeButton(text, cls, callback) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = cls;
  button.textContent = text;
  button.addEventListener("click", callback);
  return button;
}

function makeCard(article, canSave) {
  const card = document.createElement("article");
  card.className = "article-card";
  if (!canSave && article.is_read) card.classList.add("is-read");

  const meta = document.createElement("div");
  meta.className = "article-source";
  const source = document.createElement("span");
  source.className = "article-tag";
  source.textContent = article.source || "RSS";
  const date = document.createElement("span");
  date.className = "article-date";
  date.textContent = formatDate(article.published_at);
  meta.append(source, date);

  if (!canSave) {
    const badge = document.createElement("span");
    badge.className = article.is_read ? "read-pill read" : "read-pill unread";
    badge.textContent = article.is_read ? "Прочитано" : "Не прочитано";
    meta.insertBefore(badge, date);
  }

  const title = document.createElement("h3");
  title.className = "article-title";
  title.textContent = article.title || "Без названия";
  const description = document.createElement("p");
  description.className = "article-description";
  description.textContent = article.description || "Читать публикацию на сайте источника.";

  const actions = document.createElement("div");
  actions.className = "article-actions";
  const link = document.createElement("a");
  link.className = "article-link";
  link.textContent = "Читать статью ↗";
  const url = String(article.url || "");
  if (/^https?:\/\//i.test(url)) {
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  } else {
    link.textContent = "Ссылка недоступна";
  }
  actions.append(link);

  if (canSave) {
    const alreadySaved = savedUrls.has(url);
    const save = makeButton(alreadySaved ? "✓ Сохранено" : "☆ Сохранить", "save-button", async () => {
      save.disabled = true;
      save.textContent = "Сохраняем…";
      try {
        const data = await api("/api/articles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: article.title,
            url: article.url,
            source: article.source,
            description: article.description || "",
            published_at: article.published_at || null,
          }),
        });
        savedUrls.add(url);
        if (!savedArticles.some(item => String(item.url) === url)) savedArticles.unshift(data.article);
        updateSavedCount();
        renderArticles(searchResults, true);
        showToast("Новость сохранена в избранное");
      } catch (error) {
        save.disabled = false;
        save.textContent = "☆ Сохранить";
        showToast(error.message, true);
      }
    });
    save.disabled = alreadySaved;
    save.classList.toggle("is-saved", alreadySaved);
    actions.append(save);
  } else {
    const readButton = makeButton(
      article.is_read ? "↶ Не прочитано" : "✓ Прочитано",
      "save-button status-button",
      async () => {
        readButton.disabled = true;
        deleteButton.disabled = true;
        try {
          const data = await api(`/api/articles/${article.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_read: !Boolean(article.is_read) }),
          });
          savedArticles = savedArticles.map(item => item.id === article.id ? data.article : item);
          renderSaved();
          showToast(data.article.is_read ? "Отмечено как прочитанное" : "Отмечено как непрочитанное");
        } catch (error) {
          readButton.disabled = false;
          deleteButton.disabled = false;
          showToast(error.message, true);
        }
      }
    );
    const deleteButton = makeButton("Удалить", "delete-button", async () => {
      if (!window.confirm(`Удалить из избранного статью «${article.title}»?`)) return;
      readButton.disabled = true;
      deleteButton.disabled = true;
      try {
        await api(`/api/articles/${article.id}`, { method: "DELETE" });
        savedArticles = savedArticles.filter(item => item.id !== article.id);
        savedUrls.delete(url);
        updateSavedCount();
        renderSaved();
        showToast("Новость удалена из избранного");
      } catch (error) {
        readButton.disabled = false;
        deleteButton.disabled = false;
        showToast(error.message, true);
      }
    });
    actions.append(readButton, deleteButton);
  }

  card.append(meta, title, description, actions);
  return card;
}

function renderArticles(articles, canSave) {
  ui.results.replaceChildren();
  if (!articles.length) {
    showEmpty(canSave ? "Ничего не найдено" : "Здесь пока пусто",
      canSave ? "Попробуйте другое ключевое слово." : "Найдите новость и нажмите «Сохранить».",
      canSave ? "⌕" : "☆");
    return;
  }
  const cards = document.createDocumentFragment();
  for (const article of articles) cards.append(makeCard(article, canSave));
  ui.results.append(cards);
}

function updateSavedCount() {
  ui.savedCount.textContent = String(savedUrls.size);
  ui.navSavedCount.textContent = String(savedUrls.size);
}

// Saved articles toolbar is added without changing the existing HTML template.
const savedTools = document.createElement("div");
savedTools.className = "saved-tools";
savedTools.hidden = true;

const savedSearch = document.createElement("input");
savedSearch.type = "search";
savedSearch.className = "saved-search";
savedSearch.placeholder = "Поиск в избранном";
savedSearch.setAttribute("aria-label", "Поиск в избранном");
savedSearch.addEventListener("input", () => {
  savedSearchText = savedSearch.value.trim().toLocaleLowerCase("ru-RU");
  renderSaved();
});

const filterSelect = document.createElement("select");
filterSelect.className = "saved-select";
filterSelect.setAttribute("aria-label", "Фильтр статей");
for (const [value, label] of [
  ["all", "Все статьи"], ["unread", "Не прочитаны"], ["read", "Прочитаны"],
]) filterSelect.add(new Option(label, value));
filterSelect.addEventListener("change", () => {
  savedFilter = filterSelect.value;
  renderSaved();
});

const sortSelect = document.createElement("select");
sortSelect.className = "saved-select";
sortSelect.setAttribute("aria-label", "Сортировка статей");
for (const [value, label] of [
  ["newest", "Сначала новые"], ["oldest", "Сначала старые"],
]) sortSelect.add(new Option(label, value));
sortSelect.addEventListener("change", () => {
  savedSort = sortSelect.value;
  renderSaved();
});
savedTools.append(savedSearch, filterSelect, sortSelect);
document.querySelector(".feed-heading").insertBefore(savedTools, ui.status);

function renderSaved() {
  if (view !== "saved") return;
  let articles = savedArticles.filter(article => {
    const matchesStatus = savedFilter === "all" ||
      (savedFilter === "read" && Boolean(article.is_read)) ||
      (savedFilter === "unread" && !article.is_read);
    const haystack = `${article.title} ${article.source} ${article.description || ""}`.toLocaleLowerCase("ru-RU");
    return matchesStatus && haystack.includes(savedSearchText);
  });
  articles = articles.sort((a, b) => {
    const compare = (new Date(b.saved_at).getTime() || 0) - (new Date(a.saved_at).getTime() || 0);
    return savedSort === "newest" ? compare : -compare;
  });
  if (articles.length) {
    renderArticles(articles, false);
  } else {
    showEmpty(
      savedArticles.length ? "Нет статей по фильтру" : "Здесь пока пусто",
      savedArticles.length ? "Попробуйте изменить фильтр или поисковый запрос." : "Найдите новость и нажмите «Сохранить».",
      "☆"
    );
  }
  const unreadCount = savedArticles.filter(item => !item.is_read).length;
  ui.status.textContent = `Показано: ${articles.length} из ${savedArticles.length} · Не прочитано: ${unreadCount}`;
}

async function loadSaved(showCards = true) {
  if (showCards) {
    ui.status.textContent = "Загрузка…";
    showEmpty("Загружаем избранное", "Получаем статьи из базы данных.", "◌");
  }
  try {
    const data = await api("/api/articles");
    savedArticles = data.articles || [];
    savedUrls = new Set(savedArticles.map(article => String(article.url)));
    updateSavedCount();
    if (showCards) renderSaved();
  } catch (error) {
    if (showCards && view === "saved") {
      ui.status.textContent = "Ошибка загрузки";
      showEmpty("Не удалось загрузить статьи", error.message, "!");
    } else {
      showToast(`Ошибка БД: ${error.message}`, true);
    }
  }
}

function setView(next) {
  view = next;
  const inSaved = next === "saved";
  ui.searchPanel.hidden = inSaved;
  savedTools.hidden = !inSaved;
  ui.navSaved.classList.toggle("is-active", inSaved);
  ui.navSearch.classList.toggle("is-active", !inSaved);
  ui.navSaved.setAttribute("aria-current", inSaved ? "page" : "false");
  ui.navSearch.setAttribute("aria-current", !inSaved ? "page" : "false");
  ui.pageTitle.textContent = inSaved ? "Мои сохранённые новости" : "Всё важное — в одном месте.";
  ui.pageSubtitle.textContent = inSaved
    ? "Сохраняйте, отмечайте прочитанные и управляйте избранным."
    : "Ищите новости по ключевым словам и сохраняйте интересные статьи.";
  ui.sectionTitle.textContent = inSaved ? "Избранные статьи" : "Результаты поиска";
  if (inSaved) {
    void loadSaved();
  } else if (lastQuery) {
    ui.status.textContent = `Запрос: ${lastQuery}`;
    renderArticles(searchResults, true);
  } else {
    ui.status.textContent = "Ожидание запроса";
    showEmpty("Начните с поиска", "Введите ключевое слово, чтобы найти актуальные публикации.");
  }
}

ui.navSearch.addEventListener("click", () => setView("search"));
ui.navSaved.addEventListener("click", () => setView("saved"));
ui.searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const q = ui.searchInput.value.trim();
  if (q.length < 2) return;
  lastQuery = q;
  ui.searchButton.disabled = true;
  ui.searchButton.textContent = "Ищем…";
  ui.status.textContent = "Поиск по RSS…";
  showEmpty("Ищем новости", "Это может занять несколько секунд.", "◌");
  try {
    const data = await api(`/api/news?q=${encodeURIComponent(q)}`);
    searchResults = data.articles || [];
    ui.foundCount.textContent = String(searchResults.length);
    if (view === "search") {
      renderArticles(searchResults, true);
      ui.status.textContent = `Запрос: ${q} · Найдено: ${searchResults.length}`;
    }
  } catch (error) {
    searchResults = [];
    ui.foundCount.textContent = "—";
    ui.status.textContent = "Ошибка поиска";
    if (view === "search") showEmpty("Не удалось получить новости", error.message, "!");
    showToast(error.message, true);
  } finally {
    ui.searchButton.disabled = false;
    ui.searchButton.textContent = "Найти новости →";
  }
});

void loadSaved(false);
