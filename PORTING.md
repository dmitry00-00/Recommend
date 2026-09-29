# Что перенесено и что осталось

Перенесены все 59 компонентов бандла (по состоянию на 22.09) — весь пользовательский контур от
приветствия и диагностики до чек-ина, контрольной точки и настроек, кабинет участника,
кураторская и системное на Radix. Как переписывалось: `bundle.js` → `src/components/<Name>.tsx`,
классы и структура разметки сохраняются, пропсы типизируются из `src/types/tmdf.ts`, строки уезжают в `i18n`.

Порядок, в котором имеет смысл продолжать (уточнён 19.09 по `ROADMAP.md`; в скобках — что
добавляется к бандлу и **чего в дизайн-системе нет — там нужен дизайн до кода**):

1. ~~**Произведение**~~ — сделано 19.09: `WorkHeader`, `BarrierTag`, `SpoilerGuard`, `TropeInsight`,
   `ExternalAnalysisLink`, `DiscussionLink`, `ReadinessNotice`, `ReasonPicker`; экран `/works/:id`.
   Добавлено сверх бандла: метка ценностного заряда у приёма (`charge`, стиль пока в `app.css`),
   раздел «Кто чего хочет» (`characters`, `desireModel`). `RecommendationCard` доведён до бандла.
   Осталось: блок **«Где смотреть»** (`WatchProviders` — нет в системе; данные TMDb/JustWatch с
   атрибуцией; этап 2).
2. ~~**Карта**~~ — сделано 19.09: `CognitiveMap` на `d3-shape`/`d3-scale`, `UncertaintyMark`,
   `TimeScrubber`, `StateChangeNote`; экран `/map`. Позже (этап 4): диспозиционный слой на карте —
   нужен дизайн.
3. ~~**Маршруты**~~ — сделано 19.09: `TrajectoryPath` (полный и `compact`), `TrajectoryStep`,
   `ReplanNote`; экраны `/trajectories` (список карточек-ссылок, «Собрать маршрут») и
   `/trajectories/:id` (путь, действие для текущей станции). Названия станций ведут на страницу
   произведения. Осталось сверх бандла: типы шагов **«пара»** («та же история, другая форма» —
   два «Соляриса» уже в моках) и **«пересмотр»** — нет в системе, нужен дизайн шага с двумя
   кадрами; «Пропустить» шаг — нет эндпоинта в §17.
4. ~~**Дневник и после просмотра**~~ — сделано 21.09: `JourneyEntry`, `CheckInFlow`,
   `DifficultyPicker`, `ReflectionPrompt`; экраны `/journal`, `/journal/:entryId`,
   `/journal/:entryId/check-in` (ветка «Бросаю» — `?abandon=1`). Поток собирает `CheckInRequest`,
   экран вызывает `checkIn` и показывает разбор, следующий кадр и перестроение. Осталось сверх
   бандла: шаг **прогноза до просмотра** и сверка (нужен дизайн); промпты по рутинам Visible
   Thinking — это данные (`ReflectionPromptData`), компонент тот же.
5. ~~**Диагностика и вход**~~ — сделано 21.09: `AssessmentItem` (шесть видов ответа),
   `AssessmentProgress`, `ConsentCard`; экраны `/welcome`, `/onboarding`, `/assessment/:id`,
   `/onboarding/map` и `/checkpoint/:id` (согласие → задания → что изменилось). Добавлено к
   контракту: `AssessmentAnswer`; к слою данных сверх §17: `getAssessment`, `pauseAssessment`.
   Осталось: `/login` (ждёт `ErrorState` из группы 6; в Telegram вход — по `initData`, экран
   нужен только вне мессенджера) и сверх бандла — **импорт истории**
   (`ImportHistorySheet` — нет в системе). Логика уже есть (21.09):
   `src/lib/import` — разбор CSV Letterboxd / IMDb / Goodreads / StoryGraph, импорт-формата
   Letterboxd (его отдают конвертеры с Кинопоиска), текстового списка «не найдено» того же
   конвертера и **сохранённых из браузера страниц «Оценки» профиля Кинопоиска** (конвертер
   не нужен); определение формата по содержимому; несколько файлов за раз с дедупом
   (`parseExports`); сопоставление с каталогом по IMDb / TMDb / Кинопоиск / ISBN и по названию
   с годом ±1; `api.importHistory(text | text[])`. Шиту остаётся выбрать файл(ы) — для
   Кинопоиска это «Сохранить страницу как…» на каждой странице оценок, — показать три корзины:
   сопоставлено, не в каталоге (в сетку знакомства), отложено (сериалы) — и получить согласие
   через `ConsentCard`. Файл страницы наружу не уходит: разбирается на клиенте, серверу — записи.
6. ~~**Оболочка и системное**~~ — сделано 21.09: `EmptyState`, `ErrorState`, `Toast`, `Dialog`,
   `Sheet` (три последних — на Radix, как просит §17); экраны `/settings` и `/login`; все экраны
   переведены с ручных `tm-error` / `tm-empty` на компоненты; `AppShell` — глифы и профиль.
   «Сегодня» перестроен: один кадр на экран и страницы вместо прокрутки. Сверх бандла:
   слой изображения в `WorkCover` (`stillUrl`) и оверлеи `Dialog`/`Sheet` — нужны в системе.
7. ~~**Кабинет участника**~~ — сделано 22.09: `TaskFeed`, `PairwiseCompare`, `TropeCheckList`,
   `TropeUsagePicker`, `BarrierVote`, `MechanismNote`, `ContributionSummary`, `CreditSettings`;
   экраны `/contribute` (лента + вклад, фильтр «только моё» по истории участника),
   `/contribute/tasks/:id` (компонент по виду задания, ответ `ContributorAnswer`, дальше —
   следующее из очереди), `/contribute/profile` (подпись и ссылки, сохранение кнопкой).
   Сверх бандла, **без своих стилей — на классах системы**: `DesireCheck` (строки
   `TropeCheckList`: герой, «хочет вслух» / «на самом деле», согласен / нет / не уверен(а), при
   «нет» — своя версия в `tm-input`) и `ChargePicker` (кнопки `TropeUsagePicker` для четырёх
   позиций квадрата; показывается под «есть» рядом со способом использования — в
   `ContributorAnswer` заряда пока нет, значение остаётся на экране). «Добавить недостающий
   приём» в `TropeCheckList` работает: строка текста → `missing[]`. Мок: разобранные в сессии
   задания уходят из ленты, счётчики вклада растут; задание `desire_check` добавлено (ct5).
   В дизайн-систему: `DesireCheck` как самостоятельная компонента и заряд в контракте ответа.
8. ~~**Кураторская**~~ — сделано 22.09: `StatusTag`, `FieldConfidence`, `ReviewTable`, `DiffView`,
   `ValidationList`, `TropeTree` (поиск работает: ветка с совпадением остаётся целиком),
   `RunProgress`, `MetricsTable`, `PacketExport` (управляемый: набор, слои, формат → `onExport`),
   `PacketImportReport`, `BlindAnnotationToggle` (управляемый), `AgreementCeiling`,
   `AgreementMatrix`, `MappingTable`, `ContributorTable`. Оболочка — десктопный вариант системы
   (`CuratorShell`: `.tm-nav--desktop` слева, до 1280px), выбирается в `App` по адресу
   `/curator*`. Экраны: `/curator` (очередь, фильтры по статусу и источнику, самое
   неуверенное первым, название открывает ревью), `/curator/annotations/:id` (факты о прогоне,
   слепой режим — для эталона включён по умолчанию и прячет колонку черновика, ошибки
   валидации, разница, «Утвердить» / «Отклонить» — при ошибках утвердить нельзя),
   `/curator/taxonomy`, `/curator/runs`, `/curator/packets` (выгрузка и загрузка файлов с
   отчётом), `/curator/gold`, `/curator/evaluation`, `/curator/contributors`,
   `/curator/agreement`, `/curator/mappings`. Сверх бандла: колонка **«Сигналы»** в
   `ReviewTable` — провенанс `ExternalSignal` (вид · источник, в title дата и лицензия), поле
   `AnnotationReviewItem.signals`; в `AgreementCeiling` подписи соседних отметок разведены по
   высоте (`--alt`, `app.css`). Сверх §16/§17 — типы `TropeTreeNode`, `AnnotationRun`,
   `QualityMetric`, `AnnotationDiffRow`, `AgreementCeilingData` и эндпоинты `reviewAnnotation`,
   `getAnnotationDiff`, `getTaxonomy`, `getRuns`, `getQualityMetrics`, `getAgreementCeiling`,
   `getContributorReliability`; данные — `src/mocks/curator.ts`. `Placeholder` больше не
   используется.

Правила переноса не меняются: разметка из `bundle.js`, классы `.tm-*`, пропсы из
`src/types/tmdf.ts`, строки в `i18n`, значения только из токенов. Всё, что помечено «нет в
системе», сначала появляется в дизайн-системе, потом в коде — иначе стили осядут в `app.css`
и разойдутся с бандлом (сейчас там уже два таких исключения: `.tm-trope__charge` и `.tm-desires`).

### Компоненты, которых нет в дизайн-системе

| Компонент | Зачем | Данные | Этап |
|---|---|---|---|
| `WatchProviders` | «где смотреть» вместо тупика «Недоступно» | TMDb watch providers (JustWatch), регион пользователя | 2 |
| `ImportHistorySheet` | холодный старт из собственной истории | **сделано 22.09**: шторка на `Sheet`, разбор на клиенте, отчёт «что поняли», вопрос о норме шкалы; стиль `.tm-import__*` в `app.css` | перенести в систему |
| слой изображения в `WorkCover` | кадр TMDb / обложка Open Library в рамке | `WorkCard.stillUrl`, `coverUrl` — уже в коде (`.tm-cover__still` в `app.css`) | перенести стиль в систему |
| `WorkBanner` | фильм баннером во всю ширину: главный экран и архив (21.09) | `WorkCard` + кадр/обложка; стиль в `app.css` | перенести в систему |
| `WorkSheet` | карточка произведения в модальном окне: баннер сверху, тело со своей прокруткой (21.09) | `WorkCard`; Radix Dialog; стиль в `app.css` | перенести в систему |
| `DesireCheck` | задание «проверка желаний» | `ContributorTask` (`desire_check`); классы `TropeCheckList`, своих стилей нет | в систему как компонента |
| `ChargePicker` | ценностный заряд приёма при проверке | `ValueCharge`; классы `TropeUsagePicker` | в систему + заряд в `ContributorAnswer` |
| `WatchOptions` (в `TodayScreen`) | «Где посмотреть»: кнопки площадок, шесть + «ещё N» | `WorkCard.watch` | перенести в систему |
| колонка «Сигналы» в `ReviewTable` | провенанс внешних сигналов при ревью | `AnnotationReviewItem.signals` (`ExternalSignal`) | перенести в систему |
| `CuratorShell` | десктопная оболочка кураторской на `.tm-nav--desktop` | стиль `.tm-shell--desktop` в `app.css` | перенести в систему |
| раскладка кураторских экранов | фильтры, факты о прогоне, стопка, две колонки | `.tm-curator__*` в `app.css` | перенести в систему |
| тело карточки (`Panel` в `TodayScreen`) | описание, разборы, места разговора, где посмотреть, действия | `Recommendation.analyses/discussions`, `WorkCard.blurb/watch` | перенести в систему |
| `LinkCheck` | задание «тот ли это фильм»: подтверждение автонайденного разбора | `ContributorTask` (`link_check`); классы `ExternalAnalysisLink` и `PairwiseCompare`, своих стилей нет | в систему как компонента |
| группа «нашлось по названию — не проверено» | автонайденные разборы отдельно от подтверждённых | `ExternalAnalysis.unverified` | перенести в систему |
| превью у `ExternalAnalysisLink` | кадр ролика вместо одинаковых прямоугольников; закрытый — под штриховкой (22.09) | `ExternalAnalysis.previewUrl`; `.tm-extlink--preview` в `app.css` | перенести в систему |
| `LeadText` | преамбула карточки в три строки с «Ещё» (23.09) | любой текст; `.tm-lead*` в `app.css` | в систему как компонента |
| страница автора (`VoiceScreen`) | все разборы одного автора (23.09) | `Voice`, `getVoiceWorks`; классы `.tm-voicepage*` | перенести в систему |
| шкалы в `FilmFormNote` | место фильма среди измеренных линейкой (23.09) | `FilmForm.speechPercentile/silencePercentile`; `.tm-form__scale*` | перенести в систему |
| `WorkVoices` | разборы по авторам: строка иконок, один материал выбранного, посты в Telegram (23.09) | `Voice`, `WorkVoice`, `ExternalAnalysis`; стиль `.tm-voice__*` в `app.css` | в систему как компонента |
| `SearchLine` (в `TodayScreen`) | поиск по каналам авторов одной строкой, а не четырьмя блоками | `DiscussionPlace.search` | перенести в систему |
| оверлеи `Dialog` / `Sheet` | подложка, центр, шторка снизу | `.tm-overlay*` в `app.css` | перенести в систему |
| шаг маршрута «пара» / «пересмотр» | перенос: схема из двух аналогов | `TrajectoryStepData.kind` | 3 |
| шаг прогноза в `CheckInFlow` | калибровка | `CheckInRequest.predicted*` | 4 (UI — этап 1) |
| `DesireCheck`, `ChargePicker` | разметка желаний и заряда участниками | `desire_check`, `ValueCharge` | 5 |
| метка `charge` в `TropeInsight` | уже сделана в коде | `TropeInsightData.charge` | перенести стиль в систему |
| раздел желаний на экране произведения | уже сделан в коде | `characters`, `desireModel` | перенести стиль в систему |

| Компонент | Статус | Где смотреть в системе |
|---|---|---|
| `OperationGlyph` | перенесён | `components/OperationGlyph/` |
| `OperationChip` | перенесён | `components/OperationChip/` |
| `EnergySwitch` | перенесён | `components/EnergySwitch/` |
| `RecommendationCard` | перенесён | `components/RecommendationCard/` |
| `ExplanationBlock` | перенесён | `components/ExplanationBlock/` |
| `StretchIndicator` | перенесён | `components/StretchIndicator/` |
| `ReadinessNotice` | перенесён (19.09) | `components/ReadinessNotice/` |
| `ReasonPicker` | перенесён (19.09): `variant` dismiss/abandon, `onPick` типизирован по варианту | `components/ReasonPicker/` |
| `WorkCover` | перенесён | `components/WorkCover/` |
| `WorkHeader` | перенесён (19.09) | `components/WorkHeader/` |
| `BarrierTag` | перенесён (19.09) | `components/BarrierTag/` |
| `SpoilerGuard` | перенесён (19.09) | `components/SpoilerGuard/` |
| `TropeInsight` | перенесён (19.09) | `components/TropeInsight/` |
| `ExternalAnalysisLink` | перенесён (19.09): в Telegram открывается через `openExternal` | `components/ExternalAnalysisLink/` |
| `DiscussionLink` | перенесён (19.09): закрыт до завершения, в Telegram — через `openExternal` | `components/DiscussionLink/` |
| `CognitiveMap` | перенесён (19.09) на d3: `lineRadial` + `curveLinearClosed` для колец, контуров и полосы диапазона | `components/CognitiveMap/` |
| `UncertaintyMark` | перенесён (19.09) | `components/UncertaintyMark/` |
| `StateChangeNote` | перенесён (19.09) | `components/StateChangeNote/` |
| `TimeScrubber` | перенесён (19.09) | `components/TimeScrubber/` |
| `TrajectoryPath` | перенесён (19.09): `currentStep()` экспортируется — выбор станции из статусов | `components/TrajectoryPath/` |
| `TrajectoryStep` | перенесён (19.09) | `components/TrajectoryStep/` |
| `ReplanNote` | перенесён (19.09) | `components/ReplanNote/` |
| `JourneyEntry` | перенесён (21.09): заголовок — ссылка на запись или произведение, `onFinish`/`onAbandon` | `components/JourneyEntry/` |
| `CheckInFlow` | перенесён (21.09): собирает `CheckInRequest`, разбор приходит пропсом | `components/CheckInFlow/` |
| `DifficultyPicker` | перенесён (21.09) | `components/DifficultyPicker/` |
| `ReflectionPrompt` | перенесён (21.09): `onAnswer` по blur, `onSkip` | `components/ReflectionPrompt/` |
| `AssessmentItem` | перенесён (21.09): черновик ответа внутри, `onChange` отдаёт `AssessmentAnswer` | `components/AssessmentItem/` |
| `AssessmentProgress` | перенесён (21.09): `progress` из `AssessmentSession`, `onPause`/`onSkip` | `components/AssessmentProgress/` |
| `ConsentCard` | перенесён (21.09): пункты и подписи по умолчанию — из `i18n`, `onAccept`/`onLater` | `components/ConsentCard/` |
| `AppShell` | перенесён (19.09: варианты `mobile` и `telegram`, активный пункт навигации, «Назад» мессенджера) | `components/AppShell/` |
| `Button` | перенесён | `components/Button/` |
| `EmptyState` | перенесён (21.09) | `components/EmptyState/` |
| `ErrorState` | перенесён (21.09): тексты по умолчанию из `i18n`, `onRetry`/`onSecondary` | `components/ErrorState/` |
| `Toast` | перенесён (21.09) на Radix: `ToastProvider` + `useToast()`, `ToastViewport` в оболочке; `tone` нет в CSS | `components/Toast/` |
| `Dialog` | перенесён (21.09) на Radix Dialog: `open`/`onOpenChange`, `destructive`, `busy` | `components/Dialog/` |
| `Sheet` | перенесён (21.09) на Radix Dialog: шторка снизу, оверлей в `app.css` | `components/Sheet/` |
| `TaskFeed` | — | `components/TaskFeed/` |
| `PairwiseCompare` | — | `components/PairwiseCompare/` |
| `TropeCheckList` | — | `components/TropeCheckList/` |
| `TropeUsagePicker` | — | `components/TropeUsagePicker/` |
| `BarrierVote` | — | `components/BarrierVote/` |
| `MechanismNote` | — | `components/MechanismNote/` |
| `ContributionSummary` | — | `components/ContributionSummary/` |
| `CreditSettings` | — | `components/CreditSettings/` |
| `ReviewTable` | — | `components/ReviewTable/` |
| `DiffView` | — | `components/DiffView/` |
| `FieldConfidence` | — | `components/FieldConfidence/` |
| `ValidationList` | — | `components/ValidationList/` |
| `TropeTree` | — | `components/TropeTree/` |
| `RunProgress` | — | `components/RunProgress/` |
| `MetricsTable` | — | `components/MetricsTable/` |
| `PacketExport` | — | `components/PacketExport/` |
| `PacketImportReport` | — | `components/PacketImportReport/` |
| `BlindAnnotationToggle` | — | `components/BlindAnnotationToggle/` |
| `AgreementCeiling` | — | `components/AgreementCeiling/` |
| `AgreementMatrix` | — | `components/AgreementMatrix/` |
| `MappingTable` | — | `components/MappingTable/` |
| `ContributorTable` | — | `components/ContributorTable/` |
| `StatusTag` | — | `components/StatusTag/` |
