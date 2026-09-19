# Kickoff — следующая сессия иайдо тренажёр

## Где мы

Релиз v1.0.1 (добавлен «Словарь» — поиск по терминам). До этого v1.0.0 (2026-06-29). Установщик ставить от имени администратора, если путь в Program Files.
- Windows: `iaydo-trainer-setup-1.0.0.exe` (77 МБ)
- macOS: `iaydo-trainer-1.0.0.dmg` (96 МБ)
- https://github.com/Misurugi/iaydo-trainer/releases/tag/v1.0.0

Приложение работает: 156 вопросов, Express сервер на порту 5000, Electron обёртка.

## Known issues

**macOS Gatekeeper** — `.dmg` без подписи блокируется с ошибкой «приложение повреждено».
Ручной фикс для пользователя:
```bash
xattr -cr "/Applications/Иайдо Тренажёр.app"
```
Долгосрочный фикс — notarization через Apple Developer Program ($99/год). Отложено.

## Возможные следующие шаги

1. **Gmail app password** — настройка SMTP для отправки результатов теста проверяющему
   - Google Аккаунт → Безопасность → Двухэтапная аутентификация → Пароли приложений
   - Вставить через `config.html` в интерфейсе

2. **macOS notarization** — подпись приложения, чтобы Gatekeeper не блокировал

3. **Новые фичи** — история сессий и прочее отложено по решению пользователя

4. **Следующий релиз** — при любых изменениях: `git tag v1.0.1 && git push origin v1.0.1`

## Ключевые файлы

- `D:\Документы\claude\iaydo\server.js` — Express сервер, роуты, порт 5000
- `D:\Документы\claude\iaydo\main.js` — Electron точка входа
- `D:\Документы\claude\iaydo\.github\workflows\build.yml` — CI/CD
- `D:\Документы\claude\iaydo\data\questions.json` — 156 терминов

## Memory

- `project_iaydo.md` — полный статус проекта и стек
- `feedback_electron_github_actions.md` — питфолсы Electron + GitHub Actions
