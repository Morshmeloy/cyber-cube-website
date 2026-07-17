# Д4 Технологии — 3D-куб навигации

Интерактивный сайт-визитка. Куб с 6 гранями открывает полноразмерные страницы с реальным контентом компании; есть общий футер, отдельная страница «Правовая информация» и личный кабинет (дашборд, «Обучение», «Склад», «Финансы», «Документы»).

**Полностью на React + TypeScript + Tailwind CSS.** Миграция с vanilla TypeScript завершена — весь UI, вся логика и все стили перенесены на идиоматичные React-компоненты с Tailwind-разметкой; отдельных `.css`-файлов и файлов данных на `.ts` в проекте не осталось — `.ts` использовался только пока файл физически не мог стать `.tsx` (таких не оказалось), поэтому весь `src/` — `.tsx`, кроме самого Tailwind-входа `src/index.css`.

## Стек

- **React 19 + TypeScript + Vite**, JSX (`react-jsx`), алиас `@/*` → `src/*`
- **Tailwind CSS v4** (`@tailwindcss/vite`, без отдельного `tailwind.config.js` — тема в `src/index.css` через `@theme`)
- **shadcn/ui** (на Radix/`radix-ui`) — базовые компоненты в `src/components/ui/` (`button`, `input`, `label`, `select`, `dialog`, `dropdown-menu`, `tabs`, `checkbox`, `sonner`)
- **axios** — HTTP-запросы (логин, ИИ-помощник «Обучения»)
- **lucide-react** — иконки (кроме самодельных inline-SVG у граней куба)
- Бэкенда у самого фронтенда нет — статика; ходит к двум отдельным сервисам (`backend/main.py`, `teacher/server.py`), см. «Личный кабинет»

## Разработка

```bash
cd frontend
npm install        # установка зависимостей
npm run dev        # dev-сервер с HMR — http://localhost:5173
npm run build      # tsc (проверка типов) + vite build → результат в frontend/dist/
npm run preview    # локально поднять собранный frontend/dist/ и проверить прод-сборку
npm run lint       # ESLint (flat config, eslint.config.js)
npm run format     # Prettier по всему проекту
```

`dist/` — статические файлы, готовые к раздаче любым статическим хостингом.

## Структура `src/`

```
app/            AppRoot.tsx (корень приложения), App.tsx
components/
  auth/           LoginForm.tsx, BiometricLogin.tsx
  background/      BackgroundSlideshow.tsx, Rain.tsx — декоративные фоновые слои
  cube/            Cube.tsx — главный 3D-куб навигации
  layout/          SiteFooter.tsx, UserMenu.tsx
  page-shell/       PageShell.tsx, PageRenderer.tsx, CertificateCarousel.tsx
  private/          DashboardPage.tsx, DocsPage.tsx, FinancePage.tsx, WarehousePage.tsx, learning/
  ui/              shadcn-примитивы
hooks/            useCube.tsx, useLumaKeyCutout.tsx, useNetworkCanvas.tsx
lib/              auth.tsx, storage.tsx, utils.tsx, audio-engine.tsx
data/             контент и константы сайта (переименовано из бывшего settings/ на этапе финальной реструктуризации): navigation/{faces,cube,carousel,private,pages/*}, site/{site,footer}, audio/audio, background/{luma-key,rain,slideshow}
types/            audio.tsx, navigation.tsx, page-content.tsx
index.css         Tailwind-вход: тема (@theme), @layer base (сброс, body-фон, сетка), все @keyframes
```

## Как всё запускается

`index.html` → `<div id="root">` + `<script src="/src/main.tsx">` → `main.tsx` монтирует `<App/>` (`src/app/App.tsx`) → `App` рендерит `<AppRoot/>` (`src/app/AppRoot.tsx`) + `<Toaster/>` (sonner).

`AppRoot.tsx` — корень приложения и единственный владелец навигационного состояния: `target: PageShellTarget | null` (какая страница открыта и чем закрывается), `cubeVisual: CubeVisualState` (визуальное состояние куба — `visible`/`closing`/`hidden`), плюс `user`. Диспетчер `navigateTo(target: PageNavigationTarget)` — переход по грани куба, по «Правовая информация» или по разделу личного кабинета; при первом открытии панели проигрывает короткую вспышку/сжатие куба (450 мс) перед тем, как показать панель, при переключении между уже открытыми страницами — просто меняет контент (кросс-фейд в `PageShell`). Фоновые слои (`BackgroundSlideshow`, `Rain`) и логотип шапки (`useLumaKeyCutout`) — самостоятельные компонент/хук, монтируются прямо в JSX, без ручной оркестрации через `useEffect`.

## Куб (`src/components/cube/Cube.tsx`, `src/hooks/useCube.tsx`)

Вся физика — перетаскивание мышью/тачем с инерцией, snap к ближайшей грани на 90°, автовращение в простое (константы в `data/navigation/cube.tsx`) — в хуке `useCube`: состояние живёт в `ref`ах, а не в `useState`, чтобы не гонять React-рендер на каждый кадр 60fps-анимации. Хук возвращает `CubeHandle` (`resetRotation`/`pauseIdleBehaviour`/`scheduleAutoRotation`), который `Cube.tsx` прокидывает наружу через `useImperativeHandle` — объект мутируется на месте, а не пересоздаётся, чтобы не потерять ссылку между эффектом хука и `useImperativeHandle`.

Клик по кубу определяет активную грань не по тому, какая именно грань была кликнута, а по текущему углу поворота (`resolveFaceFromRotation`) — это исходное поведение оригинала, куб должен быть довёрнут (или доброшен инерцией) до нужной грани перед кликом. Разметка граней — JSX, стили — Tailwind; исключение — `FACE_VISUALS` (многостоповые градиенты/3D-transform каждой грани) заданы как объект, а не строкой произвольных классов, так читаемее. Логотип на лицевой грани — через `useLumaKeyCutout`.

## Панель страницы (`src/components/page-shell/`)

- **`PageShell.tsx`** — сама панель: открытие/закрытие/переключение контента, полноэкранный режим (сохраняется в `localStorage` под `d4_plasma_fullscreen`, переживает закрытие панели), Escape сворачивает полноэкранный режим. Корневой элемент несёт атрибут `data-plasma-panel` (не класс) и инлайн `--plasma-color`. Сетевая canvas-анимация фона — через `useNetworkCanvas`.
- **`PageRenderer.tsx`** — рендерит `PageContent`/`PageBlock[]` (`types/page-content.tsx`) построчно с нарастающей задержкой на блок: заголовки, абзацы, абзац с акцентом (`paragraphEmphasis`), абзац со встроенной ссылкой-переходом (`paragraphLink`), списки, карточки с тегами (`cardGrid`), ряд кнопок-переходов (`linkButtons`), галерея-карусель (`imageGallery`, через `CertificateCarousel.tsx`), контактные реквизиты (`contactInfo`), форма обратной связи (`contactForm`, `mailto:`), встроенная карта (`map`) и **`component`** — блок, рендерящий произвольный React-компонент (им построены авторизация и весь личный кабинет).
- **`CertificateCarousel.tsx`** — зацикленная 3D-«коверфлоу» карусель сертификатов с лайтбоксом. Физика скролла/наклона/масштаба соседних слайдов и бесшовный цикл — императивные (`ref`ы + `requestAnimationFrame`, как в `useCube`, это per-frame пересчёт трансформов); лайтбокс — обычное React-состояние, портал (`createPortal`) в `document.body`.

## Грани куба и страницы (`src/data/navigation/pages/`)

| Грань | Контент |
|---|---|
| front | форма входа (`components/auth/LoginForm.tsx` + `BiometricLogin.tsx`), собирается прямо в `AppRoot.tsx` |
| back | `about.tsx` — «О нас» (сертификаты/партнёрства, соответствие требованиям КИИ) |
| right | `services.tsx` — «Решения и услуги» |
| left | `software.tsx` — «Программное обеспечение» (D4NMS) |
| top | `support.tsx` — «Поддержка» |
| bottom | `contacts.tsx` — «Контакты» |

`legal.tsx` — «Правовая информация» — вне этой таблицы, без грани; открывается только по ссылке в футере.

## Личный кабинет (`src/components/private/`, `src/lib/`)

- **`lib/auth.tsx`** — вход через `POST http://localhost:9000/api/login` (`backend/main.py`, FastAPI, демо-учётки `admin/admin`, `engineer/eng`, `accountant/acc`, `employee/emp`) через `axios`. Различает `invalid-credentials` (бэкенд ответил ошибкой) и `server-unreachable` (сети/бэкенда нет вообще) по наличию `error.response` в перехваченной ошибке axios.
- **`components/auth/BiometricLogin.tsx`** — заглушка «Вход по биометрии»: камера через `getUserMedia`, анимация сканирования, затем настоящий вход как `admin` через тот же `lib/auth.tsx::login()` — без реальной привязки к лицу, только демонстрация UX.
- **`lib/storage.tsx`** — обёртка над `localStorage`, данные каждого раздела хранятся с префиксом по имени текущего пользователя (`d4_<prefix>_<username>`). Черновики форм (сумма/описание в «Финансах», товар/кол-во/тип/ФИО в «Складе», недописанный вопрос в чате «Обучения») сохраняются на каждое изменение и переживают закрытие кабинета до отправки.
- **`DashboardPage.tsx`** — приветствие + ряд разворачивающихся по наведению карточек-переходов в разделы.
- **`components/private/learning/`** — тест на 100 вопросов по книге Таненбаума, разбит на `LearningQuiz.tsx` (оркестратор состояния — `state`/`wrongIds`/`results`, все изменения иммутабельны), `QuizStart.tsx`, `QuizQuestion.tsx`, `QuizResults.tsx`, `TeacherChat.tsx` (разбор ошибок и свободный диалог с учителем — `POST /api/chat`, `/api/chat/detail`, `/api/chat/free`, `GET /api/model_status`, всё через `axios` на `teacher/server.py`, порт 5000). Прогресс теста, история чата и черновик вопроса — в `localStorage`, переживают перезагрузку страницы.
- **`WarehousePage.tsx`/`FinancePage.tsx`** — учёт в `localStorage`, **`DocsPage.tsx`** — статический список документов по роли.
- Навигация между разделами — тот же `PageNavigationTarget`/`navigateTo`, что и у остального сайта (`{ private: PrivatePageKey }`); крестик внутри раздела кабинета возвращает на дашборд, а не к кубу (переопределение `onClose` в `PageShellTarget`).

## Футер и виджет профиля (`src/components/layout/`)

- **`SiteFooter.tsx`** — навигация по граням с подсветкой в цвет грани при наведении, контакты, реквизиты, ссылка на «Правовая информация». Намеренно не в неоновом стиле — спокойнее, читаемее.
- **`UserMenu.tsx`** — виджет профиля в правом верхнем углу поверх куба/панели, на shadcn `DropdownMenu` (Radix): переход на дашборд, выход (`logout()` + возврат к форме входа).

## Звук и фон

- **`lib/audio-engine.tsx`** — звуковой движок (гул трансформатора, звуки куба/панели), без React-состояния, инициализируется один раз при загрузке модуля (`createAudioEngine()`), передаётся пропом в `Cube`/`PageShell`.
- **`components/background/BackgroundSlideshow.tsx`** — смена фоновых фото раз в минуту, кросс-фейд между двумя слоями; владеет своим состоянием сам (раньше принимал `ref`ы двух `<div>` снаружи).
- **`components/background/Rain.tsx`** — капли кибер-дождя, рендерятся `.map()`-ом по JSX со случайными параметрами (раньше создавались императивно через `document.createElement`).
- **`hooks/useLumaKeyCutout.tsx`** — лума-ключ для логотипа (вырезает тёмный фон по яркости пикселя) — на лицевой грани куба и в шапке.
- **`hooks/useNetworkCanvas.tsx`** — анимация «сети узлов» внутри плазменной панели (тема «компьютерные сети»).

## shadcn/ui

`components.json` — конфиг CLI (`npx shadcn add <компонент>`), алиасы согласованы со структурой (`@/components`, `@/lib`, `@/hooks`).

## Известные ограничения

- Личный кабинет работает только при запущенных рядом сервисах: `backend/main.py` (FastAPI, порт 9000 — логин) и `teacher/server.py` (Flask, порт 5000 — раздел «Обучение»). Без них форма входа/биометрия покажут «сервер недоступен» — это ожидаемо, не баг фронтенда.
- Оба адреса захардкожены (`lib/auth.tsx`, `components/private/learning/TeacherChat.tsx`, `QuizStart.tsx`) — без `.env`.
- Реального роутинга (`react-router-dom`) нет — переходы между «страницами» только внутреннее состояние панели (`PageNavigationTarget`), URL не меняется.
- «Склад»/«Финансы» продолжают хранить данные в `localStorage`, не на сервере (нет соответствующих эндпоинтов в бэкенде).
- Форма обратной связи («Контакты») отправляет через `mailto:`.
- Несколько файлов данных/типов, не содержащих JSX (`data/**`, `types/*`, `lib/*`), переименованы в `.tsx` по решению этой сессии (единообразие расширений важнее конвенции «`.tsx` только для компонентов»); ESLint из-за этого выдаёт безобидные warning'и `react-refresh/only-export-components` на нескольких файлах — они не влияют на сборку и рантайм.

## Мобильная адаптация

`clamp()` в размерах, `max-sm:` варианты Tailwind точечно там, где нужна отдельная мобильная раскладка (например, карточки дашборда в колонку).
