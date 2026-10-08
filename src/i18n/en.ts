// Строки интерфейса по-английски (ЗП-20, 07.10): та же форма, что у ru.ts — ключи, функции и порядок те же.
// Новая строка в ru.ts — сюда же, иначе не сойдутся типы (Strings).
import type { Strings } from './ru';

export const en: Strings = {
  nav: {
  "today": "Today",
  "trajectories": "Paths",
  "map": "Map",
  "journal": "Archive",
  "search": "Search",
  "profile": "Profile"
},
  operations: {
  "pattern_recognition": {
    "name": "Spot patterns",
    "short": "Patterns",
    "line": "notice repetitions, rhymes and hidden structure"
  },
  "causal_reasoning": {
    "name": "Understand causes",
    "short": "Causes",
    "line": "trace what led to what, and why"
  },
  "perspective_taking": {
    "name": "See through others' eyes",
    "short": "Others' eyes",
    "line": "hold several points of view on one event"
  },
  "analogical_thinking": {
    "name": "Find analogies",
    "short": "Analogies",
    "line": "carry the shape of one story over to another situation"
  },
  "synthesis": {
    "name": "Put the whole together",
    "short": "The whole",
    "line": "connect scattered pieces into one picture"
  },
  "abstraction": {
    "name": "Generalize",
    "short": "Generalizing",
    "line": "see the general model behind a particular case"
  },
  "metacognition": {
    "name": "Notice your own thinking",
    "short": "Own thinking",
    "line": "catch how you interpret things and where you go wrong"
  },
  "critical_analysis": {
    "name": "Question and check",
    "short": "Checking",
    "line": "test assumptions, arguments and your own conclusions"
  }
},
  energy: {
  "low": {
    "label": "Easy going",
    "note": "nothing heavy"
  },
  "normal": {
    "label": "As usual",
    "note": "the usual mix"
  },
  "high": {
    "label": "Up for a challenge",
    "note": "something hard is fine"
  }
},
  slot: {
  "next_step": {
    "label": "Next frame",
    "note": "the next frame of your path"
  },
  "stretch": {
    "label": "Takes effort",
    "note": "harder than usual — flagged honestly"
  },
  "side_step": {
    "label": "Side step",
    "note": "an unfamiliar form, chosen on purpose"
  },
  "preparation": {
    "label": "Warm-up",
    "note": "leads to the peak"
  },
  "universe": {
    "label": "Further in the universe",
    "note": "a follow-up to what you've already seen"
  }
},
  stretch: {
  "easy_entry": {
    "label": "Easy to get into",
    "note": "builds on what you can already do"
  },
  "productive": {
    "label": "Productive effort",
    "note": "takes attention, but you've got this"
  },
  "challenge": {
    "label": "Challenge",
    "note": "it'll be tough — and we're telling you up front"
  }
},
  stepStatus: {
  "locked": {
    "label": "Locked",
    "note": "unlocks after the previous step"
  },
  "available": {
    "label": "Available",
    "note": "ready to start"
  },
  "in_progress": {
    "label": "In progress",
    "note": "you are here"
  },
  "completed": {
    "label": "Done",
    "note": ""
  },
  "skipped": {
    "label": "Skipped",
    "note": "set aside — that's not a failure"
  }
},
  journeyStatus: {
  "planned": "Planned",
  "in_progress": "In progress",
  "finished": "Finished",
  "abandoned": "On hold"
},
  difficulty: {
  "too_easy": "Easy",
  "just_right": "Just right",
  "too_hard": "Tough"
},
  dismissReason: {
  "too_heavy_now": "Too heavy for today",
  "not_interested": "Not my thing",
  "already_know": "Already know it",
  "unavailable": "Not available",
  "other": "Other"
},
  abandonReason: {
  "too_hard": "Too hard",
  "not_engaging": "Didn't grab me",
  "no_time": "No time",
  "distracted": "Got distracted",
  "other": "Other"
},
  tropeUsage: {
  "straight": "Played straight",
  "deconstruction": "Deconstruction",
  "subversion": "Subversion",
  "reconstruction": "Reconstruction",
  "meta": "Meta"
},
  tropeUsageNote: {
  "straight": "the device works as usual",
  "deconstruction": "the device is taken apart",
  "subversion": "the device is set up and then overturned",
  "reconstruction": "the device is rebuilt after being broken",
  "meta": "the work is about the device itself"
},
  familiarity: {
  "unknown": "Don't know it",
  "seen": "Seen it",
  "remember_well": "Remember it well",
  "revisited": "Revisited",
  "analyzed": "Analyzed it"
},
  contributorTaskKind: {
  "pairwise": "Comparison",
  "trope_check": "Trope check",
  "barrier_vote": "Barriers",
  "mechanism_note": "Mechanism note",
  "desire_check": "Desire check",
  "link_check": "Right film?"
},
  annotationStatus: {
  "queued": "Queued",
  "annotating": "Annotating",
  "validation_failed": "Validation failed",
  "needs_review": "In review",
  "approved": "Approved",
  "published": "Published",
  "rejected": "Rejected"
},
  annotationProvider: {
  "local": "local model",
  "packet": "packet",
  "anthropic_api": "API",
  "human": "human",
  "expert_consensus": "experts",
  "tvtropes": "TV Tropes"
},
  actions: {
  "startFilm": "Start watching",
  "startBook": "Start reading",
  "save": "Add to plans",
  "dismiss": "Not now",
  "finishFilm": "Finished",
  "finishBook": "Finished reading",
  "abandon": "Drop it",
  "skip": "Skip",
  "pause": "Pause",
  "back": "Back",
  "next": "Next",
  "retry": "Try again",
  "whatNext": "What's next",
  "collapse": "Collapse",
  "makeFocus": "Make it my focus",
  "seen": "Already seen",
  "openNow": "Open now",
  "hide": "Hide",
  "showDetails": "Show details",
  "close": "Close",
  "undo": "Undo",
  "remove": "Remove",
  "clear": "Clear"
},
  shell: {
  "navLabel": "Main navigation"
},
  explanation: {
  "what": "What it is",
  "why": "Why you",
  "whyNow": "Why now",
  "whatNext": "What's next",
  "splice": "A splice here: ",
  "previousFrame": "Previous frame · done"
},
  /* группа «Произведение»: строки компонентов WorkHeader … DiscussionLink, выгружены из бандла */
  /* сезон и серия разбора сериала (Е6) */
  seriesPart: (season?: number, episode?: number): string | undefined =>
    season && episode ? `Season ${season}, episode ${episode}` : season ? `Season ${season}` : episode ? `Episode ${episode}` : undefined,
  platform: {
  "youtube": "video",
  "vk": "video",
  "telegram": "channel",
  "article": "article",
  "podcast": "podcast",
  "other": "breakdown"
},
  discussionKind: {
  "telegram_chat": "Chat",
  "telegram_channel": "Channel",
  "youtube_channel": "YouTube",
  "comments": "Comments",
  "forum": "Forum",
  "other": "Place"
},
  relation: {
  "prepares_for": "Prepares you for",
  "continues": "Continues",
  "contrasts": "Argues with",
  "similar_structure": "Built similarly"
},
  lang: {
  "ru": "RU",
  "en": "EN"
},
  spoilers: {
  "with": "spoilers",
  "without": "no spoilers"
},
  spoiler: {
  "title": "Unlocks in the breakdown after you watch",
  "note": "This is how the plot works: how it's made and why.",
  "open": "Unlocked",
  "lockedAnalysis": "Unlocks once you've finished",
  "lockedPost": "This post may reveal the plot — it unlocks once you've finished",
  "lockedDiscussion": "Unlocks once you've finished: they talk about the ending there.",
  "externalLink": "external link, opens in a new tab"
},
  readiness: {
  "ready": "You can start now",
  "easierAfter": "It'll be easier after "
},
  reasons: {
  "dismissTitle": "Why not now?",
  "abandonTitle": "What didn't work? This is data, not a failure."
},
  discussion: {
  "searchWhy": "channel search — the breakdown will open if it's there",
  "searchLine": "Search channels for a breakdown:",
  "chatsLine": "Talking about film:",
  "placeWhy": "a place to talk about film in general, not this one in particular",
  "talked": "discussed ",
  "broughtBy": "shared by "
},
  /* группа «Карта»: CognitiveMap, UncertaintyMark, TimeScrubber, StateChangeNote */
  map: {
  "ariaField": "Thinking map. A text version is in the table below.",
  "caption": "Thinking map: level and range across eight skills",
  "colOperation": "Skill",
  "colLevel": "Level",
  "colRange": "Range",
  "colData": "Data",
  "focus": "focus",
  "legendLow": "The solid line is the current estimate; the hatching around it is its range: the wider it is, the less data there is. Short ticks on the axes are finished works. The map is rough and will get sharper over time.",
  "legend": "The solid line is the estimate; the hatching is its range. Short ticks on the axes are finished works.",
  "levelWords": ["very little", "a little", "moderate", "confident", "very confident"],
  "dataAmount": {
    "low": "not much yet",
    "medium": "enough",
    "high": "plenty"
  }
},
  uncertainty: {
  "refining": "estimate is being refined",
  "of": " of ",
  "range": " · range ",
  "srRange": "range from ",
  "srTo": " to ",
  "srLowData": ", not much data yet"
},
  change: {
  "refinedText": "New data came in — the estimate's bounds narrowed. That's not growth, just a more accurate picture.",
  "growthText": "The checkpoint showed a change that a refined estimate can't explain.",
  "refinedShort": "map refined",
  "growthShort": "noticeable shift"
},
  trend: {
  "up": "rising",
  "flat": "holding steady",
  "down": "declining",
  "unknown": "no clear direction yet"
},
  /* экран «Карта» */
  mapScreen: {
  "asList": "As a list",
  "asOf": "as of ",
  "history": "How the map has changed",
  "focusTitle": "Focus",
  "focusNote": "Your focus is the skill your paths are built around. We suggest, you choose.",
  "suggested": "Suggested",
  "yourFocus": "Your focus",
  "isFocus": "This is your focus",
  "tracesOne": "work finished with this skill",
  "tracesFew": "works finished with this skill",
  "tracesMany": "works finished with this skill",
  "noTraces": "no finished works with this skill yet",
  "errorMap": "Couldn't load the map",
  "errorMapText": "The connection dropped. Please try again.",
  "loading": "Loading the map",
  "pickOp": "Tap a skill on the map to see it in detail"
},
  /* ценностный заряд исполнения и желания персонажей */
  charge: {
  "positive": "Positive",
  "contrary": "Contrary",
  "contradictory": "Contradictory",
  "negation_of_negation": "Negation of the negation"
},
  chargeNote: {
  "positive": "the convention is played as is",
  "contrary": "a muted version — you have to notice it",
  "contradictory": "the expectation is openly broken",
  "negation_of_negation": "a negative that looks like a positive — the film won't tip you off"
},
  desire: {
  "explicit": "Says they want",
  "suppressed": "Actually wants",
  "visibility": ["said out loud", "shown through actions", "only in the structure"],
  "model": {
    "goal_driven": "",
    "diffuse": "The characters' goals are blurry — that's the form, not a flaw: you'll follow a state of mind, not a task.",
    "none": "There's no character with a clear goal here — that's the form, not a flaw: your attention is all you'll have to hold on to."
  },
  "guardTitle": "What the characters really want — unlocks afterwards",
  "guardNote": "Suppressed desires are often the resolution itself."
},
  /* группа «Маршруты»: TrajectoryPath, TrajectoryStep, ReplanNote */
  trajectory: {
  "kindDevelopment": "growth path",
  "kindPeak": "path to a peak",
  "step": "step ",
  "of": " of ",
  "focus": "focus: ",
  "peak": "Peak",
  "peakNoteBefore": "To “",
  "peakNoteAfter": "” — another ",
  "stepsOne": "step",
  "stepsFew": "steps",
  "stepsMany": "steps",
  "introduces": "introduces",
  "reinforces": "reinforces",
  "now": "Now",
  "next": "Up next",
  "srNext": "Next work: ",
  "srDone": "Path complete",
  "replannedAt": "Path rebuilt · "
},
  /* экран «Маршруты» */
  trajectories: {
  "empty": "No paths yet",
  "emptyText": "A path will appear after your first map — or build one from a focus on the map.",
  "build": "Build a path",
  "notFound": "Path not found",
  "notFoundText": "The link is out of date, or the path was rebuilt into another one.",
  "errorList": "Couldn't load paths",
  "errorOne": "Couldn't load the path",
  "errorText": "The connection dropped. Please try again.",
  "loading": "Loading paths",
  "currentStep": "Current step",
  "toWork": "About the work"
},
  /* группа «Дневник и после просмотра» */
  /* дневник книги (З5): часть и страница, чек-ин после части */
  bookDiary: {
  "now": (part?: number, page?: number, pages?: number) =>
    `Now: ${[part ? `part ${part}` : '', page ? `p. ${page}${pages ? ` of ${pages}` : ''}` : ''].filter(Boolean).join(', ')}`,
  "done": (list: number[]) => (list.length === 1 ? `finished part ${list[0]}` : `finished parts: ${list.join(', ')}`),
  "stoppedAt": (part?: number, page?: number) => `Stopped at ${part ? `part ${part}` : `p. ${page}`}: `,
  "stoppedAtBare": (part?: number, page?: number) => `Stopped at ${part ? `part ${part}` : `p. ${page}`}`,
  "q": (n: number) => `How was part ${n}?`,
  "finishedPart": (n: number) => `Finished part ${n}`,
  "finishedAll": "Finished the book",
  "finishPart": (n: number) => `Part ${n} finished`,
  "whereTitle": "Where you are now",
  "whereHint": "Part — if the book is split into parts and you want to note how each one went: then the check-in comes after each part. Page is just a bookmark.",
  "part": "Part",
  "page": "Page",
  "pageOf": (n: number) => `of ${n}`,
  "partDone": (n: number, next: number) => `Part ${n} saved. Next up is part ${next} — we'll ask after it.`
},
  /* дневник сериала (Е3): сезон и серия, чек-ин после сезона */
  seriesDiary: {
  "now": (s: number, e?: number) => (e ? `Now: season ${s}, episode ${e}` : `Now: season ${s}`),
  "done": (list: number[]) => (list.length === 1 ? `finished season ${list[0]}` : `finished seasons: ${list.join(', ')}`),
  "stoppedAt": (s: number) => `Stopped at season ${s}: `,
  "stoppedAtBare": (s: number) => `Stopped at season ${s}`,
  "newSeason": (s: number) => `Season ${s} is out`,
  "nextSeason": (s: number, date: string) => `Season ${s} — ${date}`,
  "q": (s: number) => `How was season ${s}?`,
  "finishedSeason": (s: number) => `Finished season ${s}`,
  "finishedAll": "Finished the whole series",
  "finishSeason": (s: number) => `Season ${s} finished`,
  "hours": (h: number) => `About ${h} h`,
  "whereTitle": "Where you are now",
  "whereHint": "The check-in comes after each season, not after the whole series: that way you can see which season worked and which didn't.",
  "season": "Season",
  "episode": "Episode",
  "less": "Less",
  "more": "More",
  "save": "Remember",
  "saved": "Saved",
  "seasonDone": (s: number, next: number) => `Season ${s} saved. Next up is season ${next} — we'll ask after it.`
},
  entry: {
  "abandoned": "On hold: ",
  "otherReason": "other"
},
  reflection: {
  "placeholder": "One sentence is enough. Or skip it."
},
  difficultyPicker: {
  "label": "How hard was it?"
},
  /* «рядом называют»: CoMentionList */
  nearby: {
  "title": "Mentioned alongside",
  "why": "What gets mentioned in the same post as this one, in the channels we read. It's not similarity and not a recommendation: usually it's the same creator, the same wave or the same awards season."
},
  /* поиск и отметка просмотренного: SearchScreen */
  // подбор по настроению (ЗП-16)
  mood: {
  "title": "By mood",
  "placeholder": "What are you in the mood for? E.g. something quiet about family",
  "go": "Find",
  "hint": "Describe it in your own words: mood, genre, theme, “something to think about” or “easy going”, “like …”. We'll read your request and pick from what you haven't seen yet.",
  "examples": ["something quiet about family, not sad", "an atmospheric autumn film", "a mystery with a twist ending", "thought-provoking but not heavy", "like “Now You See Me”", "a Korean series about teenagers"],
  "understood": "We got:",
  "likeFound": (t: string) => `Based on “${t}”.`,
  "notUnderstood": "We didn't get that",
  "notUnderstoodText": "Try naming a mood, genre or theme: “funny”, “scary”, “about war”, “something to think about”. For a film title, use Search.",
  "empty": "Nothing matches that request",
  "emptyText": "Loosen it up: drop the year or country, or describe the mood more broadly.",
  "error": "Couldn't pick anything",
  "entry": "Pick by mood",
  },
  search: {
  "title": "Search films",
  "placeholder": "Film, series or book",
  "hint": "We search our own list — by both the Russian and the original title.",
  "watchedHint": "Here's what you've already marked as watched. It won't show up in your feed, and it's what we use to learn your taste.",
  "watchedCount": (n: number) => `Marked: ${n}.`,
  "mark": "Watched",
  "unmark": "Remove",
  "added": "Marked as watched",
  "removed": "Removed from watched",
  "empty": "Nothing found",
  "emptyText": "Try a different spelling or the original title.",
  "filterAll": "All",
  "filterHint": "Filters count what you've marked, not the whole catalog.",
  "importLink": "Import history",
  "watchedEmpty": "Nothing here yet",
  "watchedEmptyText": "Find a film and mark it — it'll stop showing up in your feed.",
  "error": "Search isn't responding",
  "missing": "Can't find a film?"
},
  /* заявки участников: «такого фильма у вас нет», «добавьте этого автора» — SuggestSheet */
  suggest: {
  "work": {
    "title": "Which film is missing",
    "lead": "Tell us what you were looking for — we'll see why we don't have it.",
    "name": "Title",
    "namePlaceholder": "What's the film called",
    "notePlaceholder": "Year, director, a link — whatever you remember"
  },
  "voice": {
    "title": "Who else has covered it",
    "lead": "If you know a breakdown that isn't here, name the creator or share a link.",
    "name": "Creator or channel",
    "namePlaceholder": "Name, handle or channel name",
    "notePlaceholder": "Link to the video or channel"
  },
  "note": "Anything else you know",
  "send": "Send",
  "sent": "Thanks, we've got it",
  "offline": "Can't send right now: no connection to the server",
  "failed": "Didn't send — please try again",
  "why": "We build the catalog by hand, so a person reads your request, not a database."
},
  /* приёмы с TV Tropes: TropeMentionList */
  tropeMentions: {
  "title": "Tropes on TV Tropes",
  "why": "What's listed for this film on the TV Tropes wiki. It says the trope is there, but not how it works here specifically — and no person has checked it. The names and explanations are ours.",
  "linkNote": " — open the trope page on TV Tropes",
  "credit": "TV Tropes, CC BY-NC-SA. Non-commercial use."
},
  /* похожесть по чужим тегам: TagNeighbourList */
  tagNeighbours: {
  "title": "Described similarly",
  "why": "Films that MovieLens viewers tag with the same traits. It's an outside, English-language signal: it reflects how films are described there, not our picks — and it differs from what Russian channels mention together.",
  "credit": "Tag Genome 2021, GroupLens (Kotkov et al., 2021; Vig et al., 2012), CC BY-NC."
},
  /* темп речи и тишины по субтитрам: FilmFormNote */
  filmForm: {
  "title": "Pace of speech and silence",
  /* число со словом приходит готовым: русское согласование считает компонент */
  "speech": (speed: string, pct: number) => (pct >= 50
    ? `${speed} — denser than ${pct}% of measured films`
    : `${speed} — sparser than ${100 - pct}% of measured films`),
  "silence": (share: number, longest: string, pct: number) => (pct >= 50
    ? `${share}% of the runtime with no dialogue, longest gap — ${longest}; only ${100 - pct}% of films stay silent longer`
    : `${share}% of the runtime with no dialogue, longest gap — ${longest}`),
  "source": (translations: string, spread?: string) => `Measured from subtitles: ${translations}${spread ? `, differing by ${spread}` : ''}.`,
  "oneSource": "one translation",
  "manySources": (n: string) => `${n} translations`,
  "caveat": "This measures form, not difficulty: on the films we've annotated, a link to level isn't confirmed yet.",
  /* подписи к шкалам: слева и справа — края измеренного, метка — место этого фильма */
  "scaleSpeechLabel": "Speech",
  "scaleSpeechLow": "quieter",
  "scaleSpeechHigh": "chattier",
  "scaleSilenceLabel": "Silence",
  "scaleSilenceLow": "no pauses",
  "scaleSilenceHigh": "long pauses",
  "scaleHere": (pct: number) => `here: denser than ${pct}% of measured`
},
  /* прогноз перед началом и сверка после: PredictionSheet, PredictionNote */
  prediction: {
  "title": "Before you start",
  "label": "How do you think it'll go?",
  "why": "We'll compare it with how it turned out. This tests us, not you: otherwise we can't tell whether our picks fit you.",
  "start": "Start",
  "skip": "Skip and start",
  "hit": (expected: string) => `You expected “${expected.toLowerCase()}” — and that's how it went.`,
  "harder": (expected: string) => `You expected “${expected.toLowerCase()}” — it turned out harder.`,
  "easier": (expected: string) => `You expected “${expected.toLowerCase()}” — it turned out easier.`,
  "modelHit": "We expected the same.",
  "modelMiss": (model: string) => `We expected “${model.toLowerCase()}” — we were off.`,
  "noAnswer": "No prediction was made."
},
  checkin: {
  "steps": ["Outcome", "Difficulty", "A couple of questions", "Breakdown"],
  "note": "A minute and a half. You can skip any step.",
  "qFilm": "Finished or dropped?",
  "qBook": "Finished or dropped?",
  "finishedFilm": "Finished",
  "finishedBook": "Finished",
  "debrief": "Breakdown",
  "debriefLoading": "Putting together the breakdown",
  "nextFrame": "Next frame",
  "toJournal": "To the archive",
  "toMap": "To the map"
},
  /* диагностика: задание и прогресс */
  assessment: {
  "about": "about",
  "minuteOne": "minute",
  "minuteFew": "minutes",
  "minuteMany": "minutes",
  "textPlaceholder": "A couple of sentences. Or skip it.",
  "up": "Up",
  "down": "Down",
  "position": "position",
  "of": "of",
  "loading": "Loading tasks",
  "notFound": "No such assessment",
  "notFoundText": "The session has ended or the link is out of date. You can start over.",
  "errorLoad": "Couldn't load the task",
  "errorAnswer": "Couldn't save your answer",
  "errorText": "The connection dropped. Please try again.",
  "finishing": "Building your map",
  "startOver": "Start over",
  "paused": "Assessment paused — you can come back any time."
},
  /* экраны входа: приветствие, выбор диагностики, первая карта */
  welcome: {
  "title": "Not what to watch, but what will shift your view",
  "lead": "We don't collect ratings. We look at which ways of thinking a work engages — and pick what will be a little harder for you than usual.",
  "how": "First, a short assessment: a few tasks about films, books and situations. They add up to a map — not a score, but a sketch of what already comes easily to you and where there's room to grow.",
  "mapSample": "A map after a few weeks — an example, not yours",
  "framesSample": "This is what frames look like in the feed",
  "start": "Start",
  "haveMap": "I already have a map"
},
  onboarding: {
  "title": "Where to start",
  "lead": "You can pause any assessment and come back later. “I don't know” is a perfectly good answer.",
  "quickTitle": "Quick start",
  "quickText": "A few tasks, about six minutes. The map will be rough and will sharpen with your first frames.",
  "fullTitle": "Full assessment",
  "fullText": "More tasks, about twenty minutes. The map is more accurate from day one — and your first recommendations miss less.",
  "choose": "Choose",
  "starting": "Preparing tasks",
  "errorStart": "Couldn't start the assessment"
},
  firstMap: {
  "title": "Your first map",
  "lead": "Eight ways of thinking that films and books engage. The solid line is our estimate; the shading shows how unsure we are about it.",
  "rough": "The map is rough for now: a few tasks can't make it more precise. It'll sharpen after every frame you finish.",
  "suggested": "Our suggested focus",
  "toToday": "To today's frames",
  "toMap": "More about the map",
  "loading": "Building your map",
  "error": "Couldn't build the map"
},
  /* согласие на участие в исследовании */
  consent: {
  "title": "Taking part in the study",
  "points": [
    "What we measure: how your answers to tasks change over a few months.",
    "Why: to check whether our picks actually work. Without this we can't know.",
    "How it's stored: separately from your account, with no name or email.",
    "How to opt out: any time in your profile — we'll delete the data."
  ],
  "check": "I agree to take part",
  "accept": "Continue",
  "later": "Not now"
},
  /* контрольная точка: повтор заданий спустя время */
  checkpoint: {
  "title": "Checkpoint",
  "lead": "A few tasks similar to the ones at the start. This shows what has actually changed, not just how it feels.",
  "consentLead": "Checkpoints are the study itself: we compare your answers with earlier ones. Without consent, the tasks aren't saved.",
  "done": "What changed",
  "thanks": "Saved",
  "thanksText": "Thanks. We'll compare your answers with earlier ones — your picks will get sharper, no extra words needed.",
  "noChange": "The map didn't move — that's a result too: it means the estimate was accurate.",
  "toMap": "To the map",
  "toToday": "To today's frames"
},
  /* экран «Сегодня»: страницы вместо прокрутки */
  today: {
  "loading": "Loading today's frames",
  "fromShelf": (shelf: string) => `From the “${shelf}” shelf you chose. `,
  "universeSequel": (seen: string) => `A sequel to “${seen}”, which you've seen.`,
  "universeMore": (universe: string, seen: string) => `From the same universe as “${seen}”${universe && universe !== seen ? ` (“${universe}”)` : ''}.`,
  "pagerLabel": "Frames one at a time",
  "prev": "‹ Back",
  "next": "Next ›",
  "of": "of",
  "empty": "No films for today",
  "emptyText": "All frames have been dismissed or haven't been picked yet. Try a different effort or refresh.",
  "coldTitle": "First, a few ratings",
  "normTitle": "Which rating means “fine” to you?",
  "normWhy": (count: number, median: number) => `Your history has ${count} ratings, most often around ${median}. Not “I liked it” but “I don't regret the time”: the model measures your taste from this point.`,
  "normKeep": (median: number) => `Keep ${median}`,
  "coldText": (needed: number) => `The feed is built around your taste, and we don't know anything about it yet. Rate at least ${needed} films you've already seen — and your first recommendations will appear.`,
  "coldProgress": (rated: number, needed: number) => `Rated ${rated} of ${needed}.`,
  "coldAction": "Rate films",
  "coldMore": "Keep rating",
  "introTitle": "Not what to watch, but what will shift your view",
  "introText": "We pick films and books not by taste, but one step harder than usual — and attach breakdowns from creators who've talked about each one.",
  "coldImport": "Paste a list of what you've watched",
  "coldImportHint": "Titles one per line, or an export from Letterboxd, IMDb, Goodreads — what you've watched won't show up in the feed, and ratings will sharpen your taste.",
  "early": "This is an early version. If something's unclear or broken, write to me — I answer myself.",
  "shareLead": "Found it useful? Invite someone you talk films with."
},
  /* первые оценки: экран /rate */
  rate: {
  "title": "Rate what you've seen",
  "lead": "Mark how you liked the film — or skip it if you haven't seen it. Ratings are only for picks: no one else will see them.",
  "progress": (rated: number, needed: number) => rated >= needed ? `Rated ${rated}` : `Rated ${rated} of ${needed}`,
  "scale": ["Miss", "Weak", "Fine", "Good", "Great"],
  "scaleLabel": (title: string) => `How was “${title}”`,
  "skip": "Haven't seen it",
  "unskip": "Undo",
  "gesture": "You can swipe: right for “Good”, further for “Great”; left for “Weak”, further for “Miss”.",
  "skipped": "Skipped",
  "done": "Show picks",
  "notYet": (left: number) => `${left} more`,
  "hint": "Five ratings are enough for your first feed, but the more you add, the more accurate it gets. You can find the rest in Search.",
  "error": "Couldn't load the list",
  "saveError": "Rating wasn't saved",
  "seriesTitle": "Series",
  "seriesLead": "If you've watched them, rate the series as a whole. That's taste too: picks will start suggesting series as well."
},
  /* страница автора: все его разборы по нашим фильмам */
  /* связи между произведениями (Ж1): экранизация, сиквел, ремейк, цикл и франшиза */
  relations: {
  "title": "Where it comes from and what's next",
  "note": "From Wikidata: adaptations, sequels, remakes, series.",
  "label": (kind: 'adaptation_of' | 'sequel_of' | 'remake_of' | 'part_of', dir: 'out' | 'in', node: string): string => {
    if (kind === 'part_of') return node === 'franchise' ? 'Franchise' : 'Series';
    if (kind === 'remake_of') return dir === 'out' ? 'Remake of' : 'Remake';
    if (kind === 'sequel_of') return dir === 'out' ? 'Sequel to' : 'Sequel';
    if (dir === 'in') return node === 'series' ? 'Series based on it' : node === 'film' ? 'Film based on it' : 'Adaptation';
    return ({ book: 'Book adaptation', comic: 'Comic adaptation', series: 'Based on the series', film: 'Based on the film', game: 'Based on the game' } as Record<string, string>)[node] ?? 'Inspired by';
  }
},
  /* герои через несколько произведений (И1) */
  heroes: {
  "title": "Characters who appear in other works too",
  "also": "also in",
  "more": (n: number) => `and ${n} more`,
  "note": "From Wikidata: characters and roles. Only characters who appear in at least two works and are named in breakdowns."
},
  /* страница героя (И2) */
  hero: {
  "played": (actor: string) => `played by ${actor}`,
  "commons": "image: Wikimedia Commons",
  "kind": "Character",
  "aka": (names: string[]) => `also known as ${names.join(', ')}`,
  "cast": "Played by",
  "castWork": (title: string, year?: number) => (year ? `${title}, ${year}` : title),
  "first": "Where they come from",
  "firstNote": (type: string) => (type === 'book' ? 'The earliest of what we have is a book: this is where the character comes from.' : 'The earliest of what we have.'),
  "startNear": (level: number) => `Level ${level} — the closest to “a little above usual” among their works.`,
  "analyses": (n: number) => `breakdowns about them: ${n}`,
  "essaysTitle": "Breakdowns about them",
  "essaysNone": "We don't have any breakdowns that name them in the title yet.",
  "places": "Where people talk about them",
  "search": (name: string, n: number) => `Character: ${name} — in ${n} ${n === 1 ? 'work' : 'works'}`,
  "unknown": "No such character",
  "unknownText": "The link may be out of date: characters are rebuilt with every data update."
},
  /* страница вселенной (Ж2) */
  universe: {
  "kind": { "franchise": "Franchise", "cycle": "Series", "film": "Film universe", "series": "Series universe", "book": "Book universe", "comic": "Comic universe", "game": "Game universe", "other": "Universe" } as Record<string, string>,
  "group": { "film": "Films", "series": "Series", "book": "Books", "comic": "Comics", "game": "Games", "other": "Other" } as Record<string, string>,
  "one": { "film": "film", "series": "series", "book": "book", "comic": "comic", "game": "game", "other": "work" } as Record<string, string>,
  "count": (kind: string, n: number) => `${({ film: 'films', series: 'series', book: 'books', comic: 'comics', game: 'games' } as Record<string, string>)[kind] ?? 'other'}: ${n}`,
  "startFirst": "The first installment — this is where the story begins.",
  "startNear": "Closest to your usual level — a good way in, even if it isn't the first installment.",
  "orderLabel": "Order",
  "byRelease": "By release",
  "byStory": "By story",
  "chain": (n: number, first: string) => `Chain ${n}: from “${first}”`,
  "places": "Where people talk about it",
  "notOurs": "not in our catalog",
  "sources": "Encyclopedias and data",
  "apis": (list: string) => `Open data: ${list}.`,
  "link": (title: string, n: number) => /^universe\b/iu.test(title) ? `${title}: ${n} ${n === 1 ? 'work' : 'works'}` : `The “${title}” universe: ${n} ${n === 1 ? 'work' : 'works'}`,
  "essays": "Breakdowns about the universe",
  "essaysNote": "Videos about the franchise or series as a whole: history, timeline, lore.",
  "unknown": "No such universe",
  "unknownText": "We didn't find any connections for this work — the link may be out of date."
},
  /* карточка найденного и просмотренного (02.10): тот же вид, что у рекомендации */
  card: {
  "more": "More",
  "seen": "Seen"
},
  /* неточность в карточке (02.10) */
  share: {
  "button": "Share",
  "label": "Share card",
  "text": (title: string, year?: number) => `“${title}”${year ? ` (${year})` : ''} — see what creators are saying about it`,
  "heroText": (name: string) => `${name} — every version across films, series and books, plus breakdowns about them`,
  "copied": "Link copied",
  "sent": "Sent",
  "failed": "Couldn't share — please try again",
  "opening": "Opening card…",
  "notFound": "We don't have this work yet — try searching by title",
},
  issue: {
  "button": "Report error",
  "buttonLabel": "Report an error in the card",
  "link": "Spotted an error in the card?",
  "title": "What's wrong with the card",
  "lead": (title: string) => `“${title}”: mark what's incorrect. You can pick several.`,
  "what": "What's incorrect",
  "field": (f: string, type: string) => ({
    title: "title", year: "year", people: type === 'book' ? "author" : "director or writers", image: type === 'book' ? "cover" : "poster or still",
    synopsis: "description", duration: type === 'book' ? "length" : "runtime", type: "film, series or book mixed up",
    watch: type === 'book' ? "where to read" : "where to watch", analyses: "breakdown isn't about this work", relations: "connections and universe",
    heroes: "characters", other: "other",
  } as Record<string, string>)[f] ?? f,
  "note": "What it should be (optional)",
  "notePlaceholder": "E.g. year 1979, director — Tarkovsky; the video “…” isn't about this film",
  "why": "Your report goes to the people who maintain the catalog. Nothing changes in the card right away — we check first.",
  "sent": "Thanks — we'll check and fix it"
},
  /* статистика обсуждений (/stats/:kind/:id, 02.10): сколько и где говорят */
  stats: {
  "link": "Discussion stats",
  "title": (kind: 'work' | 'universe' | 'person') => ({ work: 'Discussions of the work', universe: 'Discussions of the universe', person: 'Discussions of the creator' })[kind],
  "videos": "videos",
  "posts": "posts",
  "channels": "channels",
  "hours": "hours",
  "essays": (n: number, reviews: number) => reviews ? `essays and posts: ${n}, reviews: ${reviews}` : `essays and posts: ${n}`,
  "span": (first: string, last: string) => first.slice(0, 4) === last.slice(0, 4) ? `in ${first.slice(0, 4)}` : `from ${first.slice(0, 4)} to ${last.slice(0, 4)}`,
  "rank": (kind: 'work' | 'universe' | 'person', place: number, of: number, now?: number) => `#${place} of ${of} ${kind === 'universe' ? 'universes' : 'works'} by discussion weight${now ? `, currently #${now}` : ''}`,
  "weight": "weight",
  "weightNote": (all: number, now: number) => `Discussion weight ${all.toLocaleString('en')}: confirmed links weigh more than guesses, a long breakdown more than a post, and a channel's tenth video less than its first. Current weight (halving every six months) — ${now.toLocaleString('en')}.`,
  "about": (n: number) => `about it as a whole: ${n}`,
  "timeline": "Over time",
  "timelineNote": "How many videos and posts came out. An empty stretch is information too: nobody was talking about the work.",
  "channelsTitle": "Who's talking",
  "worksTitle": "About which works",
  "evidenceTitle": "How much to trust the links",
  "evidenceNote": "Matches found by title alone, without confirmation, can be wrong: matching titles can mislead.",
  "evidence": { "human": "confirmed by a person", "manual": "sent in by hand", "link": "link to the film", "year": "year next to the title", "original": "original title", "channel": "trusted channel", "tag": "hashtag", "lore": "via a character", "playlist": "channel playlist", "none": "unconfirmed" } as Record<string, string>,
  "nearbyTitle": "Mentioned together with",
  "nearbyNote": "What's mentioned in the same posts. It's not similarity in meaning, but how people talk about film.",
  "mentionsTitle": "In lists and news",
  "mentions": (list: number, several: number, news: number) => [list ? `in lists: ${list}` : '', several ? `in videos covering several: ${several}` : '', news ? `in news: ${news}` : ''].filter(Boolean).join(' · ') || 'nowhere yet',
  "mentionsNote": (labels: number) => `Based on the model's annotation, ${labels} items. That's its guess, not a person's decision.`,
  "legendVideos": "videos",
  "legendPosts": "posts",
  "empty": "No material yet",
  "emptyText": "We haven't found any videos or posts about it yet.",
  "unknown": "No such page",
  "more": (n: number) => `and ${n} more`
},
  /* страница автора-создателя (Д3): режиссёр, сценарист, шоураннер, писатель */
  person: {
  "role": { "director": "director", "writer": "screenwriter", "creator": "series creator", "author": "writer" } as Record<'director' | 'writer' | 'creator' | 'author', string>,
  "years": (born: number, died?: number) => (died ? `${born}–${died}` : `b. ${born}`),
  "roleOf": { "director": "Director", "writer": "Screenplay", "creator": "Series creator", "author": "Author" } as Record<'director' | 'writer' | 'creator' | 'author', string>,
  "works": (n: number) => `${n} ${n === 1 ? 'work' : 'works'} in our catalog`,
  "byName": "identified by name in the cards",
  "start": "Where to start",
  "startNear": (level: number) => `Level ${level} — a little above your usual: there's room to grow here, but it's still approachable.`,
  "startEntry": (level: number) => `Level ${level} — the most accessible way in among what we've annotated.`,
  "worksTitle": "Works",
  "level": (n: number) => `level ${n}`,
  "unmarked": "not annotated",
  "seen": "seen",
  "analyses": (n: number) => `breakdowns: ${n}`,
  "essaysTitle": "Video essays",
  "essaysNone": "Essayists haven't covered their work here yet.",
  "aboutTitle": "About them and their work",
  "aboutNote": "Videos about the person as a whole, not about a single work.",
  "trajectories": "In paths",
  "unknown": "No such creator",
  "unknownText": "None of their works are among the ones we know — the link may be out of date.",
  "back": "‹ Back"
},
  voice: {
  "lead": "Breaks down films — here's what they have on titles we know.",
  "works": (n: number) => `${n} ${n === 1 ? 'film' : 'films'}`,
  "empty": "Nothing yet",
  "emptyText": "This creator has no breakdowns of films we know.",
  "unknown": "No such creator",
  "unknownText": "This link leads nowhere — the creator may have left the directory.",
  "about": "What they talk about",
  "aboutNote": (n: number) => `Share across ${n} videos where we recognized the title; matches found by title alone count for less.`,
  "focus": "main focus",
  "share": (s: number) => `${Math.round(s * 100)}%`,
  "back": "‹ Back"
},
  /* разборы по авторам в карточке: строка авторов, материал, посты в Telegram */
  // полки рубрик (ТВ-3г, за флагом): короткие имена — строка чипов в одну линию
  lens: {
    "label": "Lenses",
    "all": "All",
    "name": {
      "meaning": "Meaning", "domain": "Philosophy & psychology", "specialist": "Expert's eye", "facts": "Facts & behind the scenes",
      "sins": "Sins & goofs", "compare": "Comparison", "book": "Book vs film", "history": "What really happened",
      "author": "About the director", "character": "About a character", "franchise": "About the franchise", "opinion": "Opinions", "other": "Other",
    } as Record<import('@/types/tmdf').MaterialLens, string>,
    "toggle": "Lens shelves in the film card",
    "toggleText": "Pre-release trial: breakdowns by lens — meaning, facts, sins, book vs film… Reviews appear on their own shelves. Other members don't see the shelves.",
  },
  voices: {
  "title": "Who broke it down",
  "suggestLink": "Know a breakdown that's missing here?",
  "talk": "Discussed on Telegram",
  "outletYoutube": "YouTube",
  "outletTelegram": "Telegram",
  "outletChat": "Chat",
  "unverified": "matched by title",
  "byModel": "per the model",
  "nextItem": (n: number) => `${n} more from this creator`,
  "allWorks": "All breakdowns",
  "nobody": "No creators have talked about this film yet",
  "nobodyHint": "We only show people who break down films — platform announcements don't go here. You can search the channels below.",
  "nobodyBook": "No creators have talked about this book yet",
  "nobodyBookHint": "We only show people who break down books — reviews and announcements don't go here.",
  "nobodySeries": "No creators have talked about this series yet",
  "lessPosts": "show less",
  "comments": "Comments",
  /* лента разборов в карточке фильма (06.10): площадки вкладками, автор — фильтр, по десять */
  "feeds": "Where it was broken down",
  "allVoices": "all creators",
  "feedMore": (n: number, rest: number) => (n === rest ? `${n} more` : `${n} more of ${rest}`),
  "morePosts": (n: number) => `${n} more ${n === 1 ? 'post' : 'posts'}`
},
  /* карточка фильма: две вложенные страницы и нижняя панель (FilmTabs) */
  film: {
  "pages": "Card pages",
  "reviews": "Breakdowns",
  "loading": "Loading breakdowns and discussions…",
  "talk": "Discussions",
  "watch": "Watch",
  "reviewsNoneHint": "We only show people who break down films — platform announcements don't go here. Posts and channels are under “Discussions”.",
  "talkNone": "Nothing on Telegram about this film yet — you can search the channels below.",
  "watchOn": (platform: string) => `Watch on ${platform}`,
  "watchByJustWatch": "Where to watch — data from JustWatch",
  "watchHint": (n: number) => `Platforms: ${n} — switch between them in the bar below.`,
  "watchNone": "We don't know where to stream it yet",
  "watchNoneHint": "The platform list comes from Kinopoisk and can be incomplete.",
  "read": "Read",
  "readHonest": "We can't say for sure where the book is available: book services don't share open availability data. Here's where to look:",
  "readSearch": (title: string) => `${title} — search`,
  "readHours": (h: number, pages: number) => `${pages} pages, about ${h} h of reading`
},
  /* петля прогноза: экран /loop (трек Б) */
  // подписка на разборы (06.10): «Следить» у героя и произведения, сводка от бота раз в день
  follow: {
    "button": "Follow",
    "on": "Following",
    "label": (title: string) => `Get new breakdowns: ${title}`,
    "labelOn": (title: string) => `Stop new breakdowns: ${title}`,
    "added": "I'll send a digest when new breakdowns come out",
    "removed": "No longer following",
    "denied": "Without permission to message you, the bot can't send the digest",
    "error": "Not saved — can't reach the server",
    "tooMany": "You're already following 100 — remove some in settings",
    "title": "Breakdown follows",
    "text": "Once a day, after 10 a.m., the bot sends a single message: what's new about the characters and works you follow. Breakdowns with spoilers come without a title.",
    "empty": "None yet. Tap “Follow” on a character or work page.",
    "remove": "Remove",
    "kind": { "work": "work", "character": "character" } as Record<'work' | 'character', string>,
  },
  // тестеры (ТВ-3в, 06.10): список ведёт админ в настройках
  testers: {
    "title": "Testers",
    "text": "They see all lens shelves, but not stats or mechanics (skills map, levels, forecast). Add by Telegram username.",
    "placeholder": "@username",
    "add": "Add",
    "remove": "Remove",
    "empty": "No one yet.",
    "added": "Tester added",
    "removed": "Tester removed",
    "error": "Not saved — can't reach the server",
  },
  owner: {
    "open": "Annotation",
    "openHint": "The queue from the console's “Check” and “Lenses” tabs — on your phone. Decisions are picked up by the collector on the Mac.",
    "back": "‹ Settings",
    "title": "Annotation",
    "tabCheck": "Links", "tabLens": "Lenses",
    "noServer": "Annotation lives on the server — it's not available in dev mode.",
    "noQueue": "No queue yet: it's sent from the Mac by tools/owner-queue.mts.",
    "error": "Queue failed to load",
    "empty": "Queue is empty — everything's annotated.",
    "left": (n: number) => `${n} left`,
    "done": (n: number) => `${n} annotated so far`,
    "group": { "spor": "model disagrees", "check": "unchecked", "gap": "unlinked" } as Record<string, string>,
    "binding": "Link",
    "noBinding": "unlinked",
    "model": "Model",
    "ok": "Correct",
    "asModel": (film: string) => `Same as model: ${film}`,
    "notFilm": "Not about a film",
    "other": "Another film…",
    "otherPlaceholder": "Film title",
    "otherSave": "Save",
    "more": "More…",
    "several": "Several films",
    "severalMain": "Main film",
    "severalAlso": "Other films",
    "severalAdd": "Add film",
    "franchise": "About the franchise",
    "franchisePlaceholder": "Franchise or universe",
    "person": "About a person",
    "personPlaceholder": "Director, actor, writer",
    "remove": "remove",
    "skip": "Skip",
    "undo": "Undo last",
    "saved": "Saved",
    "undone": "Decision undone",
    "errorSave": "Didn't save",
    "modelRight": "Model is right",
    "second": "With a second angle",
    "secondPick": "Now the second angle — or “Done”",
    "finish": "Done",
    "confidence": (p: number) => `${Math.round(p * 100)}% confidence`,
  },
  loop: {
  "title": "Forecast loop",
  "back": "‹ Settings",
  "lead": "How well we predict how a film will go, and what people do with the feed. The actual outcome is the “How did it go?” answer after watching.",
  "scope": (all: boolean, users: number) => all ? `Across all members: ${users}.` : "Only your observations.",
  "noServer": "The report is computed on the server — it's not available in dev mode.",
  "error": "Report failed to load",
  "calibration": "Calibration",
  "calibrationHint": "Brier: 0 is perfect, 0.67 is a coin flip over three outcomes, 2 is as bad as it gets. The model is worth something only if it beats both baselines.",
  "n": "N", "brier": "Brier", "exact": "Exact",
  "who": { "model": "Model", "human": "Person", "baseRate": "Overall rate", "alwaysJustRight": "Always “just right”" },
  "confusion": "Forecast vs. actual",
  "confusionHint": "Rows are what we expected, columns are how it turned out. The diagonal is hits.",
  "predicted": "Expected ↓ actual →",
  "agreement": (p: string, n: number) => `Person and model expected the same thing: ${p} (of ${n}).`,
  "slate": "Feed",
  "impressions": "Frames shown", "starts": "Started", "saves": "To plans", "dismisses": "Not now",
  "dismissReasons": "Why “not now”",
  "plans": "Plans: wanted → got to",
  "plansHint": "Swipe right collected the “want” scale (1–5) until Sep 28; now it shows breakdown creators, so there are no new ratings. If “5”s get watched no more often than “2”s, the scale meant nothing.",
  "want": "Want", "planned": "Planned", "started": "Started", "finished": "Finished",
  "noWant": "no rating",
  "abandon": "Dropped",
  "abandoned": "Dropped", "medianDays": "Days until dropped (median)",
  "abandonFit": "Because of the film (didn't hook, too hard)", "abandonCircumstances": "Circumstances (no time, got distracted)",
  "notWatched": "Started but not watched", "notWatchedHint": "Going to a streaming service or tapping “Watching” isn't a viewing yet. “Haven't watched yet” and an unanswered question aren't drops or picking misses.",
  "notWatchedAnswered": "Answered “haven't watched yet”", "notWatchedExpired": "Question went unanswered",
  "open": "Forecast loop",
  "openHint": "Forecast calibration, feed uptake and drop-offs — across all members."
},
  /* надпечатка по кромке плёнки в ленте и архиве */
  edge: {
  "no": (n: number) => `No. ${String(n).padStart(2, '0')}`,
  "film": "Film",
  "book": "Book",
  "series": "Series",
  "min": (n: number) => `${n} min`
},
  /* лента баннеров и архив */
  feed: {
  /* «Ещё фильмы» в конце ленты (ТВ-11) */
  "moreFilms": "More films",
  "moreLoading": "Picking…",
  "moreNone": "That's everything that fits for today. Rate more films and your picks will widen.",
  "moreFailed": "Couldn't pick more — try again later",
  "archive": "Archive",
  "entryOne": "entry",
  "entryFew": "entries",
  "entryMany": "entries",
  "telegram": "Telegram channels and chats",
  "analyses": "Breakdowns",
  "analysesAuto": "Matched by title — unchecked",
  "youtube": "Broken down on YouTube",
  "other": "Other breakdowns and places",
  "watch": "Watch",
  "watching": "Now",
  "finishedQ": "finished?",
  "openEntry": "Open entry",
  "howWas": "How did it go?",
  "lead": "More",
  "leadLess": "Show less",
  "toFeed": "‹ Feed",
  "archiveTitle": "Archive",
  "archiveLead": "Everything you've watched and read, what's in progress, and what you've put in your plans.",
  "more": (n: number) => `${n} more`,
  "keep": "Keep",
  "wantMeta": (n: number) => `want ${n} of 5`,
  "watchingNow": "Watching — mark how it went afterwards",
  "readingNow": "Reading — mark how it went afterwards",
  "didYouWatch": "Watched it?",
  "didYouRead": "Finished it?",
  "notYet": "Haven't watched yet",
  "notYetRead": "Haven't read yet",
  /* сериал и книга в процессе: страница записи с «где вы сейчас» (сезон, часть, страница) */
  "whereNow": "Where I am now",
  "gaveUp": "Dropped",
  "watchingMark": "Watching",
  "watchingOn": "Watching ✓",
  "readingMark": "Reading",
  "readingOn": "Reading ✓",
  "swipeHint": "Swipe left — not now. Right — who broke this film down. Swipe an open card sideways to return to the feed.",
  "noVoices": "No breakdowns yet",
  "voicesTitle": (title: string) => `“${title}”: who broke it down`,
  "voicesHint": "Tap to open the breakdown in the card",
  "voicesBack": "Back",
  "swipeHintOk": "Got it",
  "unplan": "Remove from plans",
  "imageTmdb": "Still: TMDb",
  "imageKinopoisk": "Still: Kinopoisk",
  "imageOpenLibrary": "Cover: Open Library"
},
  /* кабинет участника: TaskFeed, PairwiseCompare, TropeCheckList, BarrierVote, MechanismNote,
     DesireCheck, ContributionSummary, CreditSettings; экраны /contribute* */
  contribute: {
  "linkQuestion": (title: string, year: number) => `Is this breakdown about “${title}” (${year})?`,
  "linkHint": "The breakdown was found automatically, by a title match. Matches are wrong more often than you'd think: a video about “The Dark Knight” gets caught by the word “Joker”.",
  "linkYes": "Yes, this one",
  "linkNo": "No, a different one",
  "linkUnsure": "Can't tell",
  "title": "Contributor hub",
  "lead": "Tagging techniques, comparing pairs, barriers — peer to peer. No points, no rankings.",
  "tasks": "Tasks",
  "onlyMine": "Only what I've broken down",
  "seconds": "seconds",
  "open": "Open",
  "stopAnytime": "You can stop anytime — answers are saved one at a time.",
  "whatCounts": (op: string) => `What counts as “${op}”`,
  "equal": "Same  =",
  "cantJudge": "Can't judge",
  "independent": "Answers from the model and other members are hidden — otherwise the comparison stops being independent.",
  "whichTropes": (title: string) => `Which techniques are in “${title}”?`,
  "verdict": { "present": "Yes", "absent": "No", "unsure": "Not sure" },
  "addMissing": "Add a missing technique",
  "missingPlaceholder": "Technique name, in your own words",
  "add": "Add",
  "addedByYou": "added by you — a curator will match it to the technique tree",
  "howNoticeable": (title: string) => `How noticeable are the barriers in “${title}”?`,
  "severity": { "none": "None", "weak": "Weak", "notable": "Noticeable", "strong": "Strong" },
  "notePlaceholder": "Two or three sentences about the mechanism. No jargon needed.",
  "referenceUrl": "Link to your breakdown, if you have one",
  "submit": "Submit",
  "whichDesires": (title: string) => `What do the characters of “${title}” really want?`,
  "desireVerdict": { "agree": "Agree", "disagree": "No", "unsure": "Not sure" },
  "alternativePlaceholder": "Your take: what the character really wants",
  "yourContribution": "Your contribution",
  "worksCovered": ["work covered", "works covered", "works covered"],
  "answers": ["answer", "answers", "answers"],
  "scalesRefined": "scales refined",
  "creditPublic": (name: string) => `Your name appears on these works' pages: “Expert annotation with contributions from ${name}”.`,
  "creditAnonymous": "Your contribution counts anonymously — your name isn't shown anywhere.",
  "noScores": "No points, rankings or levels here — and there won't be.",
  "howToCredit": "How to credit your contribution",
  "creditLabel": "Contribution credit",
  "byName": "By name",
  "anonymous": "Anonymously",
  "noMention": "no mention",
  "yourLinks": "Links to your breakdowns",
  "linkLabel": "Label",
  "linkUrl": "URL",
  "addLink": "Add link",
  "profile": "Credit and links",
  "toSettings": "‹ Settings",
  "toCabinet": "‹ Hub",
  "taskOf": (n: number, total: number) => `Task ${n} of ${total}`,
  "empty": "No tasks yet",
  "emptyText": "When works you've broken down show up in the queue, you'll find them here.",
  "errorTasks": "Couldn't load tasks",
  "errorTask": "Task not found",
  "errorTaskText": "It may already be done or removed from the queue.",
  "sent": "Answer saved",
  "skipped": "Task skipped",
  "allDone": "That's all the tasks — thank you",
  "saved": "Credit saved",
  "save": "Save"
},
  /* кураторская: StatusTag, FieldConfidence, ReviewTable, DiffView, ValidationList, TropeTree,
     RunProgress, MetricsTable, PacketExport, PacketImportReport, BlindAnnotationToggle,
     AgreementCeiling, AgreementMatrix, MappingTable, ContributorTable; экраны /curator* */
  curator: {
  "brand": "Transformative Media",
  "navLabel": "Curator sections",
  "toApp": "‹ Back to app",
  "nav": {
    "queue": "Queue", "taxonomy": "Taxonomy", "runs": "Runs", "packets": "Packets", "gold": "Gold set",
    "evaluation": "Quality", "contributors": "Contributors", "agreement": "Agreement", "mappings": "TV Tropes",
    "sources": "Sources"
  },
  "confidence": { "low": "low", "medium": "medium", "high": "high" },
  "confidenceTitle": (level: string) => `Model confidence: ${level}`,
  "knowledge": { "sufficient": "sufficient", "partial": "partial", "insufficient": "insufficient" },
  "agreementStatus": { "reliable": "reliable", "tentative": "tentative", "unreliable": "diverging" },
  "raterGroup": { "experts": "Experts", "community": "Community", "all": "All" },
  "role": { "expert": "expert", "community": "community" },
  "credit": { "public_name": "by name", "anonymous": "anonymous" },
  "queueCaption": "Annotation queue — least confident first",
  "queueCols": ["Title", "Status", "Source", "Confidence", "Errors", "Model knowledge", "Signals", "Tokens / time"],
  "gold": "gold",
  "errorsN": ["error", "errors", "errors"],
  "fieldsUnsure": ["field uncertain", "fields uncertain", "fields uncertain"],
  "seconds": "s",
  "signalsNone": "—",
  "signalKind": { "polarization": "polarization", "critic_audience_gap": "critic–audience gap", "vote_count": "votes", "availability": "availability" },
  "signalTitle": (source: string, fetchedAt: string, license: string) => `${source} · ${fetchedAt} · ${license}`,
  "draft": "Model draft",
  "published": "Published version",
  "draftHidden": "Draft hidden until you save your version",
  "evidence": "evidence",
  "validationTitle": "Validation errors",
  "validationOk": "No errors",
  "taxonomySearch": "Search the taxonomy",
  "taxonomyEmpty": "Nothing found",
  "runOf": (done: number, total: number) => `${done} of ${total}`,
  "tokens": "tokens",
  "metricsCaption": "Quality by layer and annotation source, against the gold set",
  "metricsCols": ["Layer", "Source", "Agreement with gold", "Human ceiling", "Verdict"],
  "fit": "fit",
  "unfit": "not fit",
  "packetTitle": "Export a packet for annotation",
  "packetWorks": "Titles",
  "packetSets": { "needs": "Not annotated", "low": "Low confidence", "gold": "Gold set" },
  "packetLayers": "Layers",
  "layers": { "structure": "structure", "mechanisms": "mechanisms", "tropes": "tropes", "operations": "skills", "complexity": "complexity", "barriers": "barriers" },
  "packetFormat": "Format",
  "formats": { "json": "One JSON file per layer", "jsonl": "Single JSONL" },
  "export": "Export",
  "preview": "Preview",
  "exported": (id: string) => `Packet ${id} built`,
  "importTitle": "Upload results",
  "importNote": "Packet files after annotation — JSON per layer or a single JSONL. Checked on the spot; only what passes goes to review.",
  "importPick": "Choose files",
  "packet": (id: string) => `Packet ${id}`,
  "filesPassed": (passed: number, files: number) => `${passed} of ${files} files passed`,
  "importCols": ["File", "Result", "Next step"],
  "accepted": "accepted",
  "rejectedFile": "rejected",
  "blindOn": "Blind annotation on",
  "blindOff": "Model draft visible",
  "blindOnNote": "The model draft stays hidden until you save your version. That keeps the gold set independent.",
  "blindOffNote": "Your version is saved — comparison is available.",
  "blindShowAfter": "Show after saving",
  "blindEnable": "Turn on blind mode",
  "ceilingTitle": "Agreement ceiling",
  "ceilingText": (weeks: number, alpha: string) => `Re-annotating the gold set after ${weeks} weeks gave α ${alpha}. Neither the model nor contributors can go higher — this is the limit of the measurement itself.`,
  "ceilingCap": (alpha: string) => `ceiling ${alpha}`,
  "matrixCaption": "Agreement by field, Krippendorff’s α",
  "matrixField": "Field",
  "matrixExample": "Example: on how a trope is used, experts agree tentatively (α 0.68 with six raters) — the field stays in review until the sample is large enough.",
  "mappingCaption": "TV Tropes → TMDF mapping",
  "mappingCols": ["TV Tropes trope", "TMDF trope", "How it’s used", "Status", "Source"],
  "noMapping": "no match",
  "contributorsCaption": "Contributors: roles, consents, contribution volume",
  "contributorsCols": ["Contributor", "Role", "Attribution", "Answers", "Titles", "Reliability"],
  "curatorOnly": "visible to curator only",
  "draftFields": {
    "what": "What it does", "level": "Level", "ops": "Skills", "barriers": "Barriers", "warnings": "Warnings",
    "niche": "Niche masterpiece", "yes": "yes", "no": "no",
    "season": (n: number) => `Season ${n}`
  },
  "seasonOf": (title: string, n: number) => `${title} — season ${n}`,
  "batchToday": "Today",
  "batchAll": "Whole queue",
  "batchProgress": (done: number, daily: number, left: number) => `Reviewed today: ${done} of ${daily} · ${left} left in queue`,
  "batchTotals": (approved: number, rejected: number) => `${approved} approved, ${rejected} rejected in total`,
  "batchDone": "That’s it for today",
  "batchDoneText": "Twenty drafts reviewed. More tomorrow.",
  "exportDecisions": "Download decisions",
  "exportedDecisions": (n: number) => `Decisions in file: ${n}. Next — npx tsx tools/apply-review.mts <file>`,
  "noDecisions": "No decisions yet",
  "next": "Next",
  "loopLabel": "How people took it",
  "loopHarder": (n: number) => `harder than predicted ×${n}`,
  "loopEasier": (n: number) => `easier than predicted ×${n}`,
  "loopAbandon": (n: number) => `dropped ×${n}`,
  "loopDismiss": (n: number) => `“not now” ×${n}`,
  "loopChecks": (n: number) => `${n} ${n === 1 ? 'check-in' : 'check-ins'}`,
  "loopNone": "no signals yet",
  "queueTitle": "Annotation queue",
  "filterStatus": "Status",
  "filterProvider": "Source",
  "anyStatus": "any",
  "anyProvider": "any",
  "queueEmpty": "Queue is empty",
  "queueEmptyText": "No annotations match these filters.",
  "errorLoad": "Couldn’t load",
  "errorText": "Please try again.",
  "toQueue": "‹ Queue",
  "reviewTitle": "Annotation review",
  "notFound": "Annotation not found",
  "notFoundText": "It may have been approved already or removed from the queue.",
  "model": "Model",
  "tier": { "light": "light", "standard": "standard", "heavy": "heavy" },
  "knowledgeLabel": "Model knowledge",
  "created": "Created",
  "usage": (tokens: string, seconds: number, cost: string) => `${tokens} tokens · ${seconds} s · ${cost}`,
  "approve": "Approve",
  "reject": "Reject",
  "approved": "Annotation approved",
  "rejected": "Annotation rejected",
  "taxonomyTitle": "Device taxonomy",
  "taxonomyLead": "Axes, categories and devices; the number shows how many titles a device is annotated in; glyphs are the skills it usually draws on.",
  "runsTitle": "Annotation runs",
  "runsLead": "Local model, packets and API — what’s running now and what failed.",
  "packetsTitle": "Packets",
  "goldTitle": "Gold set",
  "goldLead": "Titles annotated blind by people: both the model and contributors are measured against them.",
  "evaluationTitle": "Annotation quality",
  "contributorsTitle": "Contributors",
  "agreementTitle": "Agreement",
  "mappingsTitle": "TV Tropes mappings",
  "sourcesTitle": "Source candidates",
  "sourcesLead": "Channels linked to and reposted by the ones we already read. Collected from our own exports — we never visit the channels themselves. A repost weighs more than a link: someone put another’s text in their own feed. A person decides which of them talk about film and which just came along.",
  "sourcesCaption": "Who our sources read",
  "sourceCols": ["Channel", "Reposts", "Links", "Who links", "Last seen"],
  "sourceNoHandle": "handle unknown — repost name only",
  "sourcesEmpty": "No candidates",
  "sourcesEmptyText": "The index is built by tools/build-source-index.mts from Telegram exports."
},
  /* механика выключена */
  mechanics: {
  "offTitle": "Map hidden",
  "offText": "Thinking skills, levels and the map only show when mechanics are on — it’s our internal tool, not a grade.",
  "openSettings": "Open settings"
},
  /* системное: диалог, тосты */
  dialog: {
  "confirm": "Continue",
  "cancel": "Cancel"
},
  toast: {
  "label": "Notification",
  "viewport": "Notifications",
  "saved": "Saved",
  "dismissed": "Removed from feed",
  "savedPlain": "Saved to plans — it’s in the archive",
  "unplanned": "Removed from plans",
  "watchInferred": "When you’re back, we’ll ask how it went",
  "watchMarked": "Marked “watching” — we’ll ask how it went later",
  "readMarked": "Marked “reading” — we’ll ask how it went later",
  "notWatched": "Back in plans — watch it when you have time",
  "started": "Marked: watching now",
  "startFailed": "Couldn’t start — please try again"
},
  /* фабула в карточке (02.10): спрятана под баннером, открывается тапом */
  plot: {
  "hint": "Plot ▾",
  "title": "Plot",
  "loading": "Looking for a synopsis…",
  "none": "We don’t have a plot synopsis yet",
  /* вход на полную страницу из шторки (ТВ-4, 06.10): там «Где об этом говорили», «Рядом называют», статистика */
  "page": "More",
  "pageLabel": "Open the full title page"
},
  /* облегчённый учёт (02.10): «посмотрел» с оценкой в одно касание, «бросил» без вопросов */
  quick: {
  "watched": "Watched",
  "read": "Read",
  "how": "How was it?",
  "noRating": "No rating",
  "back": "Back",
  "doneWatched": "Logged: watched",
  "doneRead": "Logged: read",
  "doneAbandoned": "Logged: dropped — that helps your picks too",
  "more": (left: number) => `${left} more ${left === 1 ? 'rating' : 'ratings'} and your feed appears`,
  "ready": "Enough ratings — your feed is ready",
  "abandonedMark": "Dropped",
  "notCounted": (left: number) => `your first feed needs films we’ve already annotated — rate ${left} more`,
  "toDeck": "Back to ratings"
},
  /* связь с автором и приглашение друга (02.10) */
  social: {
  "write": "Message the author",
  "share": "Invite a friend",
  "shareText": "Picks films and books not by taste, but one step beyond what you’re used to — with creators’ breakdowns",
  "title": "Feedback",
  "text": "Early version: if something’s unclear, broken, or you’d like it different — write to us. And if you like it — invite a friend."
},
  /* экран «Профиль и настройки» */
  settings: {
  "title": "Profile and settings",
  "loading": "Loading settings",
  "errorLoad": "Couldn't load settings",
  "errorSave": "Couldn't save",
  "history": "History",
  "historyText": "Ratings and lists from other services: your map and picks are built from them. Files are processed right here and never leave your device.",
  "historyImport": "Import history",
  "theme": "Theme",
  "themeSystem": "Same as Telegram",
  "themeLight": "Light",
  "themeDark": "Dark",
  "energy": "Effort",
  "energyText": "How much energy to build “Today” for: easy going — nothing demanding, as usual — your usual mix, up for a challenge — something harder gets added.",
  "diary": "Detailed diary",
  "diaryText": "Mark what you're watching, track where you are in a book or series, and answer a couple of questions afterwards — this helps picks match your effort better. When off, it's just “watched” with a rating and “dropped”.",
  "details": "Show the mechanics",
  "detailsText": "Thinking skills, levels and ranges, the map and what changes on it. Off by default: picks and paths work without it, and you still see the still, a plain-words explanation, creators' breakdowns and discussion spots.",
  "openMap": "Open the thinking map",
  "media": "What to recommend",
  "mediaFilm": "Films",
  "mediaBook": "Books",
  "mediaNote": "At least one of the two.",
  "langs": "Breakdown language",
  "langsText": "Which languages to show creators' breakdowns and reviews in. English adds, for example, the big breakdowns of “Game of Thrones” and Martin's books.",
  "langRu": "Russian",
  "langEn": "English",
  "spoilers": "Spoilers",
  "spoilerLevels": ["Nothing before watching", "How it works, without the ending", "Everything"],
  "spoilersText": "What to show about a work until you've finished it.",
  "warnings": "Excluded warnings",
  "warningsEmpty": "Nothing excluded. You can exclude a topic on a work's page — next to the warning.",
  "language": "Language",
  "languageRu": "Русский",
  "languageEn": "English",
  "languageNote": "Language of menus and labels. The app will restart. Titles, descriptions and most breakdowns are still in Russian for now.",
  "focus": "Focus",
  "focusText": "Topics you asked for specifically: “Today” will always have one spot from them — something that fits your effort.",
  "focusFilms": (n: number) => `${n} ${n === 1 ? 'film' : 'films'} in picks, series later`,
  "research": "Research",
  "researchOff": "You're not taking part in the research.",
  "researchJoin": "Take part",
  "researchOn": "You're taking part: your checkpoint answers are compared with earlier ones, without your name or email.",
  "revoke": "Withdraw consent",
  "revokeTitle": "Withdraw consent?",
  "revokeText": "Task answers collected for the research will be deleted. Your map and diary will stay.",
  "revokeConfirm": "Withdraw and delete",
  "revoked": "Consent withdrawn",
  "consented": "Thanks — you're taking part",
  "contributor": "Contributor space",
  "contributorText": "Tagging techniques, comparing pairs, barriers — for those who want to help the catalog.",
  "contributorOpen": "Open contributor space",
  "bot": "Telegram bot",
  "sources": "Where the data comes from",
  "sourcesText": "Film and book cards are built from open sources; we don't show scores or ratings.",
  "sourceWikidata": "Wikidata — identifiers, directors, runtime (CC0)",
  "sourceTmdb": "TMDb — stills, descriptions, where to watch",
  "sourceKinopoisk": "Kinopoisk (unofficial API) — Russian descriptions, stills, streaming services",
  "sourceOpenLibrary": "Open Library — book covers",
  // формулировка из условий TMDb (редакция 20.10.2023); там же требование логотипа TMDb рядом — ЗП-24
  "tmdbNotice": "This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.",
},
  /* экран «Вход» */
  /* шторка импорта истории (22.09) */
  importSheet: {
  "title": "Import history",
  "lead": "An export from a service (Letterboxd, IMDb, Trakt, Kinopoisk, Goodreads, StoryGraph) or just a list of titles — either works, or both at once. No need to unzip the export.",
  "privacy": "Files are processed right here in the app: a profile export may contain your session keys, so it never leaves your device.",
  "files": "Export files",
  "paste": "Or a list of titles",
  "pastePlaceholder": "The Lighthouse 2019\nViy\nBrotherhood of the Wolf",
  "found": (n: number) => `Entries read: ${n}`,
  "films": (n: number) => `films — ${n}`,
  "books": (n: number) => `books — ${n}`,
  "series": (n: number) => `series — ${n}`,
  "rated": (n: number) => `with your rating — ${n}`,
  "unrecognized": (n: number) => `files not recognized — ${n}`,
  "sources": "Formats: ",
  "normTitle": "Which rating means “fine” for you?",
  "normWhy": "Not “I liked it”, but “I don't regret the time spent”. The model measures your taste from this point, and it can't be guessed: it differs from person to person.",
  "run": "Import",
  "done": (added: number, resolved: number) => `Entries added: ${added}. Found in external databases: ${resolved}.`
},
  importSource: {
  "letterboxd": "Letterboxd",
  "letterboxd_import": "Letterboxd (import format)",
  "imdb": "IMDb",
  "goodreads": "Goodreads",
  "storygraph": "StoryGraph",
  "kinopoisk": "Kinopoisk",
  "plain_list": "list of titles",
  "trakt": "Trakt"
},
  login: {
  "title": "Sign in",
  "lead": "The app lives inside Telegram: signing in means opening the bot. There's no separate password.",
  "open": "Open in Telegram",
  "demo": "Look around without signing in",
  "demoName": "Guest",
  "signedIn": (name: string) => `Signed in as ${name}`,
  "signOut": "Sign out",
  "account": "Account",
  "inTelegram": "Signing in…",
  "errorTitle": "Couldn't sign in",
  "errorText": "Telegram didn't confirm the session. Open the app from the bot again."
},
  /* экран «Дневник» */
  journal: {
  "notFound": "No such entry",
  "notFoundText": "The link is out of date or the entry was deleted.",
  "errorList": "Couldn't load the archive",
  "errorOne": "Couldn't load the entry",
  "errorCheckIn": "Couldn't save your wrap-up",
  "errorText": "The connection dropped. Please try again.",
  "loading": "Loading archive",
  "reflections": "Your answers",
  "noReflections": "No answers yet — you can leave them after watching.",
  "noReflectionsBook": "No answers yet — you can leave them once you've finished reading.",
  "changes": "What changed on the map",
  "checkIn": "Wrap up",
  "startedAt": "started ",
  "finishedAt": "finished "
},
  /* экран «Произведение» */
  work: {
  "about": "What it is",
  "characters": "Who wants what",
  "whatItDoes": "What it does",
  "tropes": "Techniques",
  "analyses": "Creators' breakdowns",
  "discussions": "Where people talked about it",
  "discussionsNote": "These are places where the conversation is already happening, not our chats. Each link goes to a specific message.",
  "inTrajectories": "In paths",
  "stepOf": "step ",
  "related": "Nearby",
  "credit": "Annotation: ",
  "nicheMasterpiece": "Niche masterpiece",
  "notFound": "No such work",
  "notFoundText": "The link is out of date or the work was removed from the catalog.",
  "errorWork": "Couldn't load the work",
  "errorWorkText": "The connection dropped. Please try again.",
  "loading": "Loading the work",
  "finished": "You've finished this — breakdowns and discussions are open"
},
  state: {
  "refined": "Your map got sharper",
  "growth": "A noticeable shift",
  "lowData": "not much data yet",
  "roughMap": "The map is rough — it'll sharpen after your first stills",
  "emptyJournal": "What you watch and read will show up here",
  "emptyJournalText": "Start with today's recommendations.",
  "errorSlate": "Couldn't load recommendations",
  "errorSlateText": "The connection dropped. Showing the last saved version.",
  /* честные тексты ошибок (ТВ-8б, 06.10): обещаем «сохранённое», только когда оно на экране */
  "errorText": "The server didn't respond. Check your connection and try again.",
  "errorVoice": "Couldn't load the creator's page",
  "errorPerson": "Couldn't load the page",
  "errorUniverse": "Couldn't load the universe",
  "errorCharacter": "Couldn't load the character",
  "errorStats": "Couldn't load stats",
  "offlineTitle": "Can't reach the server",
  "offlineText": "Your marks and ratings are safe — we just can't get to them right now. Check your internet and try again.",
  "offline": "No connection",
  "savedToPlans": "Saved to plans",
  "replanned": "Path rebuilt",
  "noChallengeToday": "No challenge today"
},
  /* выбор компанией (ЗП-11, 07.10): десятка под вкус того, кто собирает, голоса «хочу / не хочу / видел» */
  together: {
  "title": "Pick together",
  "lead": "We'll put together ten films to your taste. Invite friends to the chat — everyone marks “want”, “don't want” or “seen”. What everyone wants rises to the top.",
  "create": "Build a top ten",
  "creating": "Building…",
  "noServer": "Picking together only works in the Telegram app or at its web address.",
  "createFailed": "Couldn't build the top ten — please try again.",
  "invite": "Invite to chat",
  "inviteLead": "Send the invite wherever you're planning the evening. Voting stays open for seven days.",
  "shareTitle": "What are we watching? Let's vote",
  "shareAbout": (who: string | null, n: number) => `${who ?? 'A friend'} picked ${n} films for tonight. Mark what you'd like to watch — the shared choice rises to the top.`,
  "shareText": "We're choosing what to watch together — cast your vote:",
  "people": "Voting",
  "you": "you",
  "progress": (i: number, n: number) => `${i} of ${n}`,
  "yes": "Want",
  "no": "Don't want",
  "seen": "Seen",
  "seenHint": "Looks like you've already seen this",
  "essays": (n: number) => `${n} creator ${n === 1 ? 'breakdown' : 'breakdowns'}`,
  "results": "Results",
  "toResults": "See results",
  "match": "It's a match: everyone wants it",
  "leader": "In the lead so far",
  "nobody": "No one has voted yet — invite your friends.",
  "want": (names: string[]) => `want it: ${names.join(', ')}`,
  "seenBy": (names: string[]) => `seen it: ${names.join(', ')}`,
  "counts": (yes: number, no: number) => `want ${yes} · don't want ${no}`,
  "watchOn": (p: string) => `Watch: ${p}`,
  "noWatch": "We don't know where to watch yet",
  "plan": "Add to plans",
  "planned": "Added to plans",
  "planFailed": "This film isn't in your catalog — find it through search.",
  "revote": "Vote again",
  "closed": "Voting is closed: seven days have passed.",
  "missing": "No such vote — the link may be out of date.",
  "voteFailed": "Your vote wasn't saved — please try again.",
  "loadFailed": "Couldn't load the vote",
  "entry": "Not watching alone?",
  "entryAction": "Pick together",
},
  /* документы (ЗП-5, 07.10): правила рекомендательных технологий (149-ФЗ, ст. 10.2-2) и политика данных (152-ФЗ).
     Владелец и почта — из сборки (src/lib/legal.ts); перед открытым запуском показать юристу */
  legal: {
  "docs": "Documents and data",
  "docsText": "How picks work, what we store about you and how to delete it.",
  "rules": "How picks work",
  "privacy": "Data processing policy",
  "edition": (date: string) => `Version of ${date}`,
  "operator": "Service owner",
  "email": "Contact email",
  "pendingOperator": "will be listed before the public launch",
  "pendingEmail": "will be listed before the public launch — for now, message the author on Telegram",
  "writeAuthor": "Message the author",
  "other": { "rules": "Data processing policy", "privacy": "How picks work" } as Record<string, string>,
  "missing": "For the owner: VITE_LEGAL_OPERATOR and VITE_LEGAL_EMAIL aren't set in the build — without an owner and email the documents are incomplete.",
  "consentLead": "By using the app, you accept the",
  "consentRules": "pick rules",
  "consentAnd": "and the",
  "consentPrivacy": "data processing policy",
  "notFound": "No such document",
  "delete": "Delete account",
  "deleteText": "We'll erase your ratings, marks, diary, feed responses, subscriptions and the account itself. This can't be undone.",
  "deleteTitle": "Delete your account and all data?",
  "deleteBody": "Everything you've marked and rated disappears from the server right away. In backups the data lives for up to 30 more days and is erased along with them. If you open the app again, you'll start from a clean slate.",
  "deleteConfirm": "Delete forever",
  "deleted": "Account deleted",
  "deleteFailed": "Couldn't delete. Try again or message the author.",
  "rulesDoc": [
    { "h": "What this is", "p": [
      "Transformative Media — the @recomend_media_bot mini app in Telegram and its web version — uses recommendation technologies: it picks films, series and books based on information about your preferences. This page describes what information we use for that, where it comes from and how picks work.",
    ] },
    { "h": "What information about your preferences is used", "p": [
      "Your ratings of films, series and books — on a scale of 1 to 5, and which rating means “fine” to you.",
      "“Watched” marks, the diary (planned, watching, finished, dropped) and your answers after watching — how it went, whether it was hard or easy.",
      "Responses to the feed: what you saved to plans, what you removed and why, how much you want to watch something.",
      "Settings: how much effort you have for the evening, breakdown languages, spoilers, content warnings.",
      "Your watch history, if you uploaded it yourself (titles, a Kinopoisk, Letterboxd, IMDb or Goodreads export).",
    ] },
    { "h": "Where this information comes from", "p": [
      "Only from you: from what you mark and rate in the app, and from the list you uploaded. When you sign in via Telegram, the app receives your ID, name and username — they're needed to sign you in and play no part in picks.",
      "Information about the works themselves — level, genre registers, what a work does to the viewer, creators' breakdowns — comes from open sources (Wikidata, TMDb, Kinopoisk, Open Library), from curators' annotation and from model processing. This is information about works, not about you.",
    ] },
    { "h": "How picks work", "p": [
      "Collection. Each of your actions listed above is stored on the service's server and linked to your account.",
      "Organization. Ratings are brought to a common scale relative to your “fine” rating; marks, the diary and your answers after watching are gathered into a profile: what you've seen and how it went.",
      "Analysis. The model compares your ratings and answers with the works' annotation and estimates your usual level and strengths — which works come easily to you and which are hard.",
      "Delivery. The feed gets works close to your level, with a step that depends on the effort you chose. Things you've already watched aren't shown. New members first see works that have creators' breakdowns. While there are few ratings, instead of the feed you get a short list of films to rate.",
      "Picks only suggest and decide nothing for you: you choose what to watch.",
    ] },
    { "h": "What picks don't do", "p": [
      "They don't read your Telegram chats, and don't use contacts, location or data from other services, except the list you uploaded yourself.",
      "They don't rank anything higher because someone paid for it: ads and partner terms don't affect the order of the feed.",
      "They don't show an explanation for each recommendation — the general rules are described here.",
    ] },
    { "h": "How to influence picks", "p": [
      "Add or remove a rating, mark something as “watched”, remove a film from the feed with a reason, change your evening effort and breakdown languages in your profile. You can delete your account — then picks forget everything and start over.",
    ] },
  ] as { h: string; p: string[] }[],
  "privacyDoc": [
    { "h": "What data we store", "p": [
      "When you sign in via Telegram — your ID, name and username, passed to us by Telegram. Outside Telegram — an anonymous identifier for this browser.",
      "What you do in the app: ratings, “watched” marks, the diary, answers after watching, responses to the feed and which films were in it, opened cards and breakdowns, clicks through to streaming services, the days you visited, settings, breakdown subscriptions, reports of inaccuracies and suggestions, and the watch history you uploaded.",
      "We don't collect your phone number, email, contacts, location, payment details or messages.",
    ] },
    { "h": "Why", "p": [
      "To make the service work: to let you in, keep your history and pick films — that's what the data is for, and without it there are no picks.",
      "So the bot can send a digest of new breakdowns — only if you subscribed and allowed the bot to message you.",
      "To understand whether the service works: how many people come back, open breakdowns, find where to watch. We only look at this in aggregate, across everyone.",
      "For research into how a viewer's perspective changes — only with your separate consent in your profile. You can withdraw it at any time.",
    ] },
    { "h": "How long we keep it", "p": [
      "For as long as you have an account. After the account is deleted, data is erased from the server immediately and from backups within 30 days.",
    ] },
    { "h": "Who we share it with", "p": [
      "We don't sell or share it with anyone. Sign-in goes through Telegram, which has its own rules. Videos, posts and streaming services open on their own sites when you tap them, and their rules apply from there.",
    ] },
    { "h": "Your rights", "p": [
      "To find out what's stored about you, write to the email below. To correct it — right in the app. To delete everything — “Delete account” in your profile. To withdraw consent to the research — in the same place.",
    ] },
    { "h": "How we protect it", "p": [
      "Sign-in is verified by Telegram's signature, the access key is stored only on your device, and only the service owner has access to the database.",
    ] },
  ] as { h: string; p: string[] }[],
},
  /* единицы и метаданные карточки (ЗП-20, 07.10): src/lib/format.ts, FilmFormNote — тройки форм для plural() */
  units: {
  "word": ["word", "words", "words"] as const,
  "minute": ["minute", "minutes", "minutes"] as const,
  "second": ["second", "seconds", "seconds"] as const,
  "season": ["season", "seasons", "seasons"] as const,
  "episode": ["episode", "episodes", "episodes"] as const,
  "perMinute": (x: string) => `${x} per minute`,
  "episodeOf": (minutes: number) => `, ${minutes} min each`,
  "episodeLength": (d: string) => `${d} per episode`,
  "pages": (n: number) => `${n} pages`,
  "series": "Series",
  "book": "Book",
  "film": "Film",
  "months": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const,
  "date": (day: number, month: string, year: string) => `${month} ${day}${year ? `, ${year}` : ''}`
},
  /* регистры — ось вкуса (src/lib/registers.ts): name — ярлык, line — «здесь …» в объяснении */
  registers: {
  "folk_gothic": { "name": "Myth and ritual", "line": "old dread: ritual, forest, curse, belief in something stronger than people" },
  "body_visceral": { "name": "Visceral", "line": "physical horror without euphemism — the body as the stuff of the story" },
  "cold_clinical": { "name": "Cold observation", "line": "a level, clinical gaze: the institution, the experiment, the observer" },
  "genre_idea": { "name": "Genre with an idea", "line": "a speculative premise followed all the way through" },
  "puzzle_noir": { "name": "Investigation", "line": "untangling it: clues, theories, the person across the table who’s lying" },
  "absurd_satire": { "name": "Dark irony", "line": "mockery that makes you uneasy" },
  "quiet_realism": { "name": "No genre", "line": "ordinary life without genre scaffolding" },
  "myth_adventure": { "name": "Adventure", "line": "the road, the legend, the grand gesture" }
},
  a11y: {
  "energy": "How much energy today",
  "stretch": (label: string, note: string) => `effort: ${label}, ${note}`
},
};

export default en;
