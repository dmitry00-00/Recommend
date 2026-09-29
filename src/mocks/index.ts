// Моки §15, выгружены из бандла дизайн-системы. Это единственный источник
// демонстрационных данных: правки вносятся здесь, а не в экранах.
import type {
  WorkCard, CognitiveState, CognitiveMapData, RecommendationSlate, Energy, Trajectory,
  JourneyEntryData, TropeInsightData, ExternalAnalysis, Debrief, ReflectionPromptData,
  AssessmentItemData, AnnotationReviewItem, AgreementReport, ContributorProfile,
  ContributorTask, PacketReport, UserSettings, RecommendationExplanation, DiscussionPlace,
} from '@/types/tmdf';

export const works: Record<string, WorkCard> = {
  "w01": {
    "id": "w01",
    "type": "film",
    "title": "Двенадцать разгневанных мужчин",
    "originalTitle": "12 Angry Men",
    "year": 1957,
    "creators": [
      "Сидни Люмет"
    ],
    "countries": [
      "США"
    ],
    "durationMinutes": 96,
    "primaryOperations": [
      {
        "op": "critical_analysis",
        "intensity": 0.9
      },
      {
        "op": "perspective_taking",
        "intensity": 0.7
      }
    ],
    "complexityLevel": 3,
    "warnings": [],
    "barriers": [],
    "isNicheMasterpiece": false
  },
  "w02": {
    "id": "w02",
    "type": "film",
    "title": "Расёмон",
    "originalTitle": "Rashômon",
    "year": 1950,
    "creators": [
      "Акира Куросава"
    ],
    "countries": [
      "Япония"
    ],
    "durationMinutes": 88,
    "primaryOperations": [
      {
        "op": "perspective_taking",
        "intensity": 0.95
      },
      {
        "op": "critical_analysis",
        "intensity": 0.7
      },
      {
        "op": "metacognition",
        "intensity": 0.5
      }
    ],
    "complexityLevel": 5,
    "warnings": [],
    "barriers": [
      "Условная актёрская манера"
    ],
    "isNicheMasterpiece": false
  },
  "w03": {
    "id": "w03",
    "type": "film",
    "title": "Помни",
    "originalTitle": "Memento",
    "year": 2000,
    "creators": [
      "Кристофер Нолан"
    ],
    "countries": [
      "США"
    ],
    "durationMinutes": 113,
    "primaryOperations": [
      {
        "op": "causal_reasoning",
        "intensity": 0.9
      },
      {
        "op": "pattern_recognition",
        "intensity": 0.7
      },
      {
        "op": "metacognition",
        "intensity": 0.6
      }
    ],
    "complexityLevel": 6,
    "warnings": [],
    "barriers": [
      "Нелинейное время"
    ],
    "isNicheMasterpiece": false
  },
  "w04": {
    "id": "w04",
    "type": "film",
    "title": "Прибытие",
    "originalTitle": "Arrival",
    "year": 2016,
    "creators": [
      "Дени Вильнёв"
    ],
    "countries": [
      "США"
    ],
    "durationMinutes": 116,
    "primaryOperations": [
      {
        "op": "perspective_taking",
        "intensity": 0.8
      },
      {
        "op": "analogical_thinking",
        "intensity": 0.7
      },
      {
        "op": "synthesis",
        "intensity": 0.6
      }
    ],
    "complexityLevel": 5,
    "warnings": [],
    "barriers": [],
    "isNicheMasterpiece": false
  },
  "w05": {
    "id": "w05",
    "type": "film",
    "title": "Иваново детство",
    "year": 1962,
    "creators": [
      "Андрей Тарковский"
    ],
    "countries": [
      "СССР"
    ],
    "durationMinutes": 95,
    "primaryOperations": [
      {
        "op": "perspective_taking",
        "intensity": 0.6
      },
      {
        "op": "synthesis",
        "intensity": 0.5
      }
    ],
    "complexityLevel": 5,
    "warnings": [
      "Сцены войны"
    ],
    "barriers": [],
    "isNicheMasterpiece": false
  },
  "w06": {
    "id": "w06",
    "type": "film",
    "title": "Солярис",
    "year": 1972,
    "creators": [
      "Андрей Тарковский"
    ],
    "countries": [
      "СССР"
    ],
    "durationMinutes": 167,
    "primaryOperations": [
      {
        "op": "abstraction",
        "intensity": 0.8
      },
      {
        "op": "metacognition",
        "intensity": 0.7
      }
    ],
    "complexityLevel": 7,
    "warnings": [],
    "barriers": [
      "Медленный темп"
    ],
    "isNicheMasterpiece": false
  },
  "w07": {
    "id": "w07",
    "type": "film",
    "title": "Зеркало",
    "year": 1975,
    "creators": [
      "Андрей Тарковский"
    ],
    "countries": [
      "СССР"
    ],
    "durationMinutes": 108,
    "primaryOperations": [
      {
        "op": "synthesis",
        "intensity": 0.95
      },
      {
        "op": "abstraction",
        "intensity": 0.8
      },
      {
        "op": "metacognition",
        "intensity": 0.7
      }
    ],
    "complexityLevel": 9,
    "warnings": [],
    "barriers": [
      "Фрагментарная структура",
      "Медленный темп"
    ],
    "isNicheMasterpiece": true
  },
  "w08": {
    "id": "w08",
    "type": "film",
    "title": "Начало",
    "originalTitle": "Inception",
    "year": 2010,
    "creators": [
      "Кристофер Нолан"
    ],
    "countries": [
      "США"
    ],
    "durationMinutes": 148,
    "primaryOperations": [
      {
        "op": "causal_reasoning",
        "intensity": 0.7
      },
      {
        "op": "pattern_recognition",
        "intensity": 0.6
      },
      {
        "op": "abstraction",
        "intensity": 0.5
      }
    ],
    "complexityLevel": 5,
    "warnings": [],
    "barriers": [],
    "isNicheMasterpiece": false
  },
  "w09": {
    "id": "w09",
    "type": "film",
    "title": "Паразиты",
    "originalTitle": "기생충",
    "year": 2019,
    "creators": [
      "Пон Джун-хо"
    ],
    "countries": [
      "Южная Корея"
    ],
    "durationMinutes": 132,
    "primaryOperations": [
      {
        "op": "critical_analysis",
        "intensity": 0.7
      },
      {
        "op": "pattern_recognition",
        "intensity": 0.6
      },
      {
        "op": "analogical_thinking",
        "intensity": 0.6
      }
    ],
    "complexityLevel": 4,
    "warnings": [
      "Насилие"
    ],
    "barriers": [],
    "isNicheMasterpiece": false
  },
  "w10": {
    "id": "w10",
    "type": "film",
    "title": "Синекдоха, Нью-Йорк",
    "originalTitle": "Synecdoche, New York",
    "year": 2008,
    "creators": [
      "Чарли Кауфман"
    ],
    "countries": [
      "США"
    ],
    "durationMinutes": 124,
    "primaryOperations": [
      {
        "op": "metacognition",
        "intensity": 0.9
      },
      {
        "op": "abstraction",
        "intensity": 0.8
      }
    ],
    "complexityLevel": 9,
    "warnings": [],
    "barriers": [
      "Размытая граница реальности"
    ],
    "isNicheMasterpiece": true
  },
  "w11": {
    "id": "w11",
    "type": "book",
    "title": "Бойня номер пять",
    "originalTitle": "Slaughterhouse-Five",
    "year": 1969,
    "creators": [
      "Курт Воннегут"
    ],
    "countries": [
      "США"
    ],
    "pages": 224,
    "primaryOperations": [
      {
        "op": "causal_reasoning",
        "intensity": 0.7
      },
      {
        "op": "perspective_taking",
        "intensity": 0.6
      },
      {
        "op": "metacognition",
        "intensity": 0.5
      }
    ],
    "complexityLevel": 5,
    "warnings": [
      "Сцены войны"
    ],
    "barriers": [
      "Нелинейное время"
    ],
    "isNicheMasterpiece": false
  },
  "w12": {
    "id": "w12",
    "type": "book",
    "title": "Имя розы",
    "originalTitle": "Il nome della rosa",
    "year": 1980,
    "creators": [
      "Умберто Эко"
    ],
    "countries": [
      "Италия"
    ],
    "pages": 640,
    "primaryOperations": [
      {
        "op": "pattern_recognition",
        "intensity": 0.8
      },
      {
        "op": "critical_analysis",
        "intensity": 0.8
      },
      {
        "op": "synthesis",
        "intensity": 0.6
      }
    ],
    "complexityLevel": 7,
    "warnings": [],
    "barriers": [
      "Исторический контекст",
      "Латинские вставки"
    ],
    "isNicheMasterpiece": false
  },
  "w13": {
    "id": "w13",
    "type": "book",
    "title": "Невидимые города",
    "originalTitle": "Le città invisibili",
    "year": 1972,
    "creators": [
      "Итало Кальвино"
    ],
    "countries": [
      "Италия"
    ],
    "pages": 168,
    "primaryOperations": [
      {
        "op": "abstraction",
        "intensity": 0.9
      },
      {
        "op": "analogical_thinking",
        "intensity": 0.8
      }
    ],
    "complexityLevel": 6,
    "warnings": [],
    "barriers": [
      "Без сюжета в привычном смысле"
    ],
    "isNicheMasterpiece": false
  },
  "w14": {
    "id": "w14",
    "type": "book",
    "title": "Шум и ярость",
    "originalTitle": "The Sound and the Fury",
    "year": 1929,
    "creators": [
      "Уильям Фолкнер"
    ],
    "countries": [
      "США"
    ],
    "pages": 336,
    "primaryOperations": [
      {
        "op": "perspective_taking",
        "intensity": 0.95
      },
      {
        "op": "synthesis",
        "intensity": 0.9
      }
    ],
    "complexityLevel": 9,
    "warnings": [],
    "barriers": [
      "Поток сознания",
      "Смена рассказчиков без предупреждения"
    ],
    "isNicheMasterpiece": true
  },
  "w15": {
    "id": "w15",
    "type": "book",
    "title": "Бледный огонь",
    "originalTitle": "Pale Fire",
    "year": 1962,
    "creators": [
      "Владимир Набоков"
    ],
    "countries": [
      "США"
    ],
    "pages": 288,
    "primaryOperations": [
      {
        "op": "metacognition",
        "intensity": 0.9
      },
      {
        "op": "critical_analysis",
        "intensity": 0.9
      },
      {
        "op": "pattern_recognition",
        "intensity": 0.8
      }
    ],
    "complexityLevel": 9,
    "warnings": [],
    "barriers": [
      "Комментарий вместо сюжета"
    ],
    "isNicheMasterpiece": true
  },
  "w16": {
    "id": "w16",
    "type": "book",
    "title": "Мастер и Маргарита",
    "year": 1967,
    "creators": [
      "Михаил Булгаков"
    ],
    "countries": [
      "СССР"
    ],
    "pages": 480,
    "primaryOperations": [
      {
        "op": "synthesis",
        "intensity": 0.6
      },
      {
        "op": "analogical_thinking",
        "intensity": 0.6
      }
    ],
    "complexityLevel": 5,
    "warnings": [],
    "barriers": [],
    "isNicheMasterpiece": false
  },
  "w17": {
    "id": "w17",
    "type": "book",
    "title": "Солярис",
    "originalTitle": "Solaris",
    "year": 1961,
    "creators": [
      "Станислав Лем"
    ],
    "countries": [
      "Польша"
    ],
    "pages": 204,
    "primaryOperations": [
      {
        "op": "abstraction",
        "intensity": 0.8
      },
      {
        "op": "critical_analysis",
        "intensity": 0.6
      }
    ],
    "complexityLevel": 6,
    "warnings": [],
    "barriers": [],
    "isNicheMasterpiece": false
  }
};

export const state: CognitiveState = {
  "userId": "u-aliya",
  "asOf": "2026-09-17",
  "operations": [
    {
      "op": "pattern_recognition",
      "level": 6.2,
      "range": [
        5.6,
        6.8
      ],
      "confidence": "medium",
      "trend": "flat"
    },
    {
      "op": "causal_reasoning",
      "level": 6.8,
      "range": [
        6.3,
        7.3
      ],
      "confidence": "high",
      "trend": "up"
    },
    {
      "op": "perspective_taking",
      "level": 3.9,
      "range": [
        2.8,
        5
      ],
      "confidence": "low",
      "trend": "up"
    },
    {
      "op": "analogical_thinking",
      "level": 5,
      "range": [
        3.6,
        6.4
      ],
      "confidence": "low",
      "trend": "unknown"
    },
    {
      "op": "synthesis",
      "level": 4.6,
      "range": [
        3.4,
        5.8
      ],
      "confidence": "low",
      "trend": "flat"
    },
    {
      "op": "abstraction",
      "level": 4.1,
      "range": [
        2.6,
        5.6
      ],
      "confidence": "low",
      "trend": "unknown"
    },
    {
      "op": "metacognition",
      "level": 3.2,
      "range": [
        1.6,
        4.8
      ],
      "confidence": "low",
      "trend": "unknown"
    },
    {
      "op": "critical_analysis",
      "level": 5.5,
      "range": [
        4.7,
        6.3
      ],
      "confidence": "medium",
      "trend": "flat"
    }
  ],
  "complexityComfort": 5.4,
  "mediaLiteracy": 5.1,
  "overallConfidence": "low",
  "source": "assessment_quick"
};

export const map: CognitiveMapData = {
  "state": {
    "userId": "u-aliya",
    "asOf": "2026-09-17",
    "operations": [
      {
        "op": "pattern_recognition",
        "level": 6.2,
        "range": [
          5.6,
          6.8
        ],
        "confidence": "medium",
        "trend": "flat"
      },
      {
        "op": "causal_reasoning",
        "level": 6.8,
        "range": [
          6.3,
          7.3
        ],
        "confidence": "high",
        "trend": "up"
      },
      {
        "op": "perspective_taking",
        "level": 3.9,
        "range": [
          2.8,
          5
        ],
        "confidence": "low",
        "trend": "up"
      },
      {
        "op": "analogical_thinking",
        "level": 5,
        "range": [
          3.6,
          6.4
        ],
        "confidence": "low",
        "trend": "unknown"
      },
      {
        "op": "synthesis",
        "level": 4.6,
        "range": [
          3.4,
          5.8
        ],
        "confidence": "low",
        "trend": "flat"
      },
      {
        "op": "abstraction",
        "level": 4.1,
        "range": [
          2.6,
          5.6
        ],
        "confidence": "low",
        "trend": "unknown"
      },
      {
        "op": "metacognition",
        "level": 3.2,
        "range": [
          1.6,
          4.8
        ],
        "confidence": "low",
        "trend": "unknown"
      },
      {
        "op": "critical_analysis",
        "level": 5.5,
        "range": [
          4.7,
          6.3
        ],
        "confidence": "medium",
        "trend": "flat"
      }
    ],
    "complexityComfort": 5.4,
    "mediaLiteracy": 5.1,
    "overallConfidence": "low",
    "source": "assessment_quick"
  },
  "targets": [
    {
      "id": "t1",
      "operations": [
        "perspective_taking"
      ],
      "label": "Смотреть чужими глазами",
      "source": "user",
      "createdAt": "2026-08-27",
      "active": true
    }
  ],
  "suggestedTargets": [
    {
      "id": "t2",
      "operations": [
        "synthesis"
      ],
      "label": "Собирать целое",
      "source": "system_suggested",
      "createdAt": "2026-09-17",
      "active": false
    },
    {
      "id": "t3",
      "operations": [
        "metacognition"
      ],
      "label": "Замечать своё мышление",
      "source": "system_suggested",
      "createdAt": "2026-09-17",
      "active": false
    }
  ],
  "history": [
    {
      "asOf": "2026-08-27",
      "cause": {
        "kind": "assessment",
        "label": "Быстрый старт",
        "changeType": "refined_estimate"
      },
      "operations": [
        {
          "op": "pattern_recognition",
          "level": 5.8,
          "range": [
            4.5,
            7.9
          ]
        },
        {
          "op": "causal_reasoning",
          "level": 6.3999999999999995,
          "range": [
            5.199999999999999,
            8.4
          ]
        },
        {
          "op": "perspective_taking",
          "level": 3.5,
          "range": [
            1.6999999999999997,
            6.1
          ]
        },
        {
          "op": "analogical_thinking",
          "level": 4.6,
          "range": [
            2.5,
            7.5
          ]
        },
        {
          "op": "synthesis",
          "level": 4.199999999999999,
          "range": [
            2.3,
            6.9
          ]
        },
        {
          "op": "abstraction",
          "level": 3.6999999999999997,
          "range": [
            1.5,
            6.699999999999999
          ]
        },
        {
          "op": "metacognition",
          "level": 2.8000000000000003,
          "range": [
            0.5,
            5.9
          ]
        },
        {
          "op": "critical_analysis",
          "level": 5.1,
          "range": [
            3.6,
            7.4
          ]
        }
      ]
    },
    {
      "asOf": "2026-09-02",
      "cause": {
        "kind": "work_finished",
        "label": "«Иваново детство»",
        "workId": "w05",
        "changeType": "refined_estimate"
      },
      "operations": [
        {
          "op": "pattern_recognition",
          "level": 6,
          "range": [
            5,
            7.3999999999999995
          ]
        },
        {
          "op": "causal_reasoning",
          "level": 6.6,
          "range": [
            5.7,
            7.8999999999999995
          ]
        },
        {
          "op": "perspective_taking",
          "level": 3.6999999999999997,
          "range": [
            2.1999999999999997,
            5.6
          ]
        },
        {
          "op": "analogical_thinking",
          "level": 4.8,
          "range": [
            3,
            7
          ]
        },
        {
          "op": "synthesis",
          "level": 4.3999999999999995,
          "range": [
            2.8,
            6.3999999999999995
          ]
        },
        {
          "op": "abstraction",
          "level": 3.8999999999999995,
          "range": [
            2,
            6.199999999999999
          ]
        },
        {
          "op": "metacognition",
          "level": 3,
          "range": [
            1,
            5.3999999999999995
          ]
        },
        {
          "op": "critical_analysis",
          "level": 5.3,
          "range": [
            4.1000000000000005,
            6.8999999999999995
          ]
        }
      ]
    },
    {
      "asOf": "2026-09-09",
      "cause": {
        "kind": "work_abandoned",
        "label": "«Солярис» Тарковского отложен",
        "workId": "w06",
        "changeType": "refined_estimate"
      },
      "operations": [
        {
          "op": "pattern_recognition",
          "level": 6.1000000000000005,
          "range": [
            5.3,
            7.1
          ]
        },
        {
          "op": "causal_reasoning",
          "level": 6.7,
          "range": [
            6,
            7.6
          ]
        },
        {
          "op": "perspective_taking",
          "level": 3.8,
          "range": [
            2.5,
            5.3
          ]
        },
        {
          "op": "analogical_thinking",
          "level": 4.9,
          "range": [
            3.3000000000000003,
            6.7
          ]
        },
        {
          "op": "synthesis",
          "level": 4.5,
          "range": [
            3.1,
            6.1
          ]
        },
        {
          "op": "abstraction",
          "level": 3.9999999999999996,
          "range": [
            2.3000000000000003,
            5.8999999999999995
          ]
        },
        {
          "op": "metacognition",
          "level": 3.1,
          "range": [
            1.3,
            5.1
          ]
        },
        {
          "op": "critical_analysis",
          "level": 5.4,
          "range": [
            4.4,
            6.6
          ]
        }
      ]
    },
    {
      "asOf": "2026-09-14",
      "cause": {
        "kind": "work_finished",
        "label": "«Мастер и Маргарита»",
        "workId": "w16",
        "changeType": "refined_estimate"
      },
      "operations": [
        {
          "op": "pattern_recognition",
          "level": 6.2,
          "range": [
            5.6,
            6.8
          ]
        },
        {
          "op": "causal_reasoning",
          "level": 6.8,
          "range": [
            6.3,
            7.3
          ]
        },
        {
          "op": "perspective_taking",
          "level": 3.9,
          "range": [
            2.8,
            5
          ]
        },
        {
          "op": "analogical_thinking",
          "level": 5,
          "range": [
            3.6,
            6.4
          ]
        },
        {
          "op": "synthesis",
          "level": 4.6,
          "range": [
            3.4,
            5.8
          ]
        },
        {
          "op": "abstraction",
          "level": 4.1,
          "range": [
            2.6,
            5.6
          ]
        },
        {
          "op": "metacognition",
          "level": 3.2,
          "range": [
            1.6,
            4.8
          ]
        },
        {
          "op": "critical_analysis",
          "level": 5.5,
          "range": [
            4.7,
            6.3
          ]
        }
      ]
    }
  ],
  "traces": [
    {
      "work": {
        "id": "w05",
        "type": "film",
        "title": "Иваново детство",
        "year": 1962,
        "creators": [
          "Андрей Тарковский"
        ],
        "countries": [
          "СССР"
        ],
        "durationMinutes": 95,
        "primaryOperations": [
          {
            "op": "perspective_taking",
            "intensity": 0.6
          },
          {
            "op": "synthesis",
            "intensity": 0.5
          }
        ],
        "complexityLevel": 5,
        "warnings": [
          "Сцены войны"
        ],
        "barriers": [],
        "isNicheMasterpiece": false
      },
      "finishedAt": "2026-09-02",
      "operations": [
        {
          "op": "perspective_taking",
          "intensity": 0.6
        },
        {
          "op": "synthesis",
          "intensity": 0.5
        }
      ]
    },
    {
      "work": {
        "id": "w01",
        "type": "film",
        "title": "Двенадцать разгневанных мужчин",
        "originalTitle": "12 Angry Men",
        "year": 1957,
        "creators": [
          "Сидни Люмет"
        ],
        "countries": [
          "США"
        ],
        "durationMinutes": 96,
        "primaryOperations": [
          {
            "op": "critical_analysis",
            "intensity": 0.9
          },
          {
            "op": "perspective_taking",
            "intensity": 0.7
          }
        ],
        "complexityLevel": 3,
        "warnings": [],
        "barriers": [],
        "isNicheMasterpiece": false
      },
      "finishedAt": "2026-08-30",
      "operations": [
        {
          "op": "critical_analysis",
          "intensity": 0.9
        },
        {
          "op": "perspective_taking",
          "intensity": 0.7
        }
      ]
    },
    {
      "work": {
        "id": "w08",
        "type": "film",
        "title": "Начало",
        "originalTitle": "Inception",
        "year": 2010,
        "creators": [
          "Кристофер Нолан"
        ],
        "countries": [
          "США"
        ],
        "durationMinutes": 148,
        "primaryOperations": [
          {
            "op": "causal_reasoning",
            "intensity": 0.7
          },
          {
            "op": "pattern_recognition",
            "intensity": 0.6
          },
          {
            "op": "abstraction",
            "intensity": 0.5
          }
        ],
        "complexityLevel": 5,
        "warnings": [],
        "barriers": [],
        "isNicheMasterpiece": false
      },
      "finishedAt": "2026-09-06",
      "operations": [
        {
          "op": "causal_reasoning",
          "intensity": 0.7
        },
        {
          "op": "pattern_recognition",
          "intensity": 0.6
        },
        {
          "op": "abstraction",
          "intensity": 0.5
        }
      ]
    },
    {
      "work": {
        "id": "w09",
        "type": "film",
        "title": "Паразиты",
        "originalTitle": "기생충",
        "year": 2019,
        "creators": [
          "Пон Джун-хо"
        ],
        "countries": [
          "Южная Корея"
        ],
        "durationMinutes": 132,
        "primaryOperations": [
          {
            "op": "critical_analysis",
            "intensity": 0.7
          },
          {
            "op": "pattern_recognition",
            "intensity": 0.6
          },
          {
            "op": "analogical_thinking",
            "intensity": 0.6
          }
        ],
        "complexityLevel": 4,
        "warnings": [
          "Насилие"
        ],
        "barriers": [],
        "isNicheMasterpiece": false
      },
      "finishedAt": "2026-09-11",
      "operations": [
        {
          "op": "critical_analysis",
          "intensity": 0.7
        },
        {
          "op": "pattern_recognition",
          "intensity": 0.6
        },
        {
          "op": "analogical_thinking",
          "intensity": 0.6
        }
      ]
    },
    {
      "work": {
        "id": "w16",
        "type": "book",
        "title": "Мастер и Маргарита",
        "year": 1967,
        "creators": [
          "Михаил Булгаков"
        ],
        "countries": [
          "СССР"
        ],
        "pages": 480,
        "primaryOperations": [
          {
            "op": "synthesis",
            "intensity": 0.6
          },
          {
            "op": "analogical_thinking",
            "intensity": 0.6
          }
        ],
        "complexityLevel": 5,
        "warnings": [],
        "barriers": [],
        "isNicheMasterpiece": false
      },
      "finishedAt": "2026-09-14",
      "operations": [
        {
          "op": "synthesis",
          "intensity": 0.6
        },
        {
          "op": "analogical_thinking",
          "intensity": 0.6
        }
      ]
    }
  ]
};

export const slates: Record<Energy, RecommendationSlate> = {
  "normal": {
    "id": "s-normal",
    "generatedAt": "2026-09-17T18:10:00+03:00",
    "energy": "normal",
    "items": [
      {
        "id": "r1",
        "work": {
          "id": "w02",
          "type": "film",
          "title": "Расёмон",
          "originalTitle": "Rashômon",
          "year": 1950,
          "creators": [
            "Акира Куросава"
          ],
          "countries": [
            "Япония"
          ],
          "durationMinutes": 88,
          "primaryOperations": [
            {
              "op": "perspective_taking",
              "intensity": 0.95
            },
            {
              "op": "critical_analysis",
              "intensity": 0.7
            },
            {
              "op": "metacognition",
              "intensity": 0.5
            }
          ],
          "complexityLevel": 5,
          "warnings": [],
          "barriers": [
            "Условная актёрская манера"
          ],
          "isNicheMasterpiece": false
        },
        "slot": "next_step",
        "stretch": "productive",
        "targetOperations": [
          "perspective_taking",
          "critical_analysis"
        ],
        "explanation": {
          "what": "Одно преступление в пересказе четырёх свидетелей, и версии не сходятся.",
          "why": "Вы уверенно выстраиваете причинно-следственные цепочки — здесь эта сила встретит событие, у которого нет одной правильной цепочки.",
          "whyNow": "«Двенадцать разгневанных мужчин» показали, как мнение меняется под новым углом. «Расёмон» делает следующий ход: угол зрения меняет сам факт.",
          "whatNext": "«Прибытие» — там перспектива затрагивает восприятие времени."
        },
        "readiness": {
          "ready": true,
          "missing": []
        },
        "createdAt": "2026-09-17",
        "trajectoryId": "tr1"
      },
      {
        "id": "r2",
        "work": {
          "id": "w12",
          "type": "book",
          "title": "Имя розы",
          "originalTitle": "Il nome della rosa",
          "year": 1980,
          "creators": [
            "Умберто Эко"
          ],
          "countries": [
            "Италия"
          ],
          "pages": 640,
          "primaryOperations": [
            {
              "op": "pattern_recognition",
              "intensity": 0.8
            },
            {
              "op": "critical_analysis",
              "intensity": 0.8
            },
            {
              "op": "synthesis",
              "intensity": 0.6
            }
          ],
          "complexityLevel": 7,
          "warnings": [],
          "barriers": [
            "Исторический контекст",
            "Латинские вставки"
          ],
          "isNicheMasterpiece": false
        },
        "slot": "stretch",
        "stretch": "challenge",
        "targetOperations": [
          "pattern_recognition",
          "critical_analysis"
        ],
        "explanation": {
          "what": "Детективная структура, в которой расследуется и сам способ толковать знаки.",
          "why": "Вы хорошо замечаете повторы — роман даёт им объём: знак здесь может значить не то, чем кажется.",
          "whyNow": "После «Расёмона» проверка версий перестаёт быть механикой сюжета и становится темой.",
          "whatNext": "Отсюда открывается «Бледный огонь» — комментарий, который спорит со своим текстом."
        },
        "readiness": {
          "ready": true,
          "missing": []
        },
        "createdAt": "2026-09-17"
      },
      {
        "id": "r3",
        "work": {
          "id": "w13",
          "type": "book",
          "title": "Невидимые города",
          "originalTitle": "Le città invisibili",
          "year": 1972,
          "creators": [
            "Итало Кальвино"
          ],
          "countries": [
            "Италия"
          ],
          "pages": 168,
          "primaryOperations": [
            {
              "op": "abstraction",
              "intensity": 0.9
            },
            {
              "op": "analogical_thinking",
              "intensity": 0.8
            }
          ],
          "complexityLevel": 6,
          "warnings": [],
          "barriers": [
            "Без сюжета в привычном смысле"
          ],
          "isNicheMasterpiece": false
        },
        "slot": "side_step",
        "stretch": "productive",
        "targetOperations": [
          "abstraction",
          "analogical_thinking"
        ],
        "explanation": {
          "what": "Книга без привычного сюжета: пятьдесят пять городов, каждый — модель одной мысли.",
          "why": "Вы ещё не встречали повествование, построенное как набор вариаций, — это не случайный выбор, а недостающая форма.",
          "whyNow": "Короткие главы позволяют попробовать непривычное устройство без большого вложения времени.",
          "whatNext": "Дальше — «Зеркало», где вариации собираются в одну жизнь."
        },
        "readiness": {
          "ready": true,
          "missing": []
        },
        "createdAt": "2026-09-17"
      }
    ]
  },
  "low": {
    "id": "s-low",
    "generatedAt": "2026-09-17T18:10:00+03:00",
    "energy": "low",
    "items": [
      {
        "id": "r1",
        "work": {
          "id": "w02",
          "type": "film",
          "title": "Расёмон",
          "originalTitle": "Rashômon",
          "year": 1950,
          "creators": [
            "Акира Куросава"
          ],
          "countries": [
            "Япония"
          ],
          "durationMinutes": 88,
          "primaryOperations": [
            {
              "op": "perspective_taking",
              "intensity": 0.95
            },
            {
              "op": "critical_analysis",
              "intensity": 0.7
            },
            {
              "op": "metacognition",
              "intensity": 0.5
            }
          ],
          "complexityLevel": 5,
          "warnings": [],
          "barriers": [
            "Условная актёрская манера"
          ],
          "isNicheMasterpiece": false
        },
        "slot": "next_step",
        "stretch": "productive",
        "targetOperations": [
          "perspective_taking"
        ],
        "explanation": {
          "what": "Одно преступление в пересказе четырёх свидетелей, и версии не сходятся.",
          "why": "Вы уверенно выстраиваете причинно-следственные цепочки — здесь эта сила встретит событие, у которого нет одной правильной цепочки.",
          "whyNow": "«Двенадцать разгневанных мужчин» показали, как мнение меняется под новым углом. «Расёмон» делает следующий ход: угол зрения меняет сам факт.",
          "whatNext": "«Прибытие» — там перспектива затрагивает восприятие времени."
        },
        "readiness": {
          "ready": true,
          "missing": []
        },
        "createdAt": "2026-09-17",
        "trajectoryId": "tr1"
      },
      {
        "id": "r4",
        "work": {
          "id": "w03",
          "type": "film",
          "title": "Помни",
          "originalTitle": "Memento",
          "year": 2000,
          "creators": [
            "Кристофер Нолан"
          ],
          "countries": [
            "США"
          ],
          "durationMinutes": 113,
          "primaryOperations": [
            {
              "op": "causal_reasoning",
              "intensity": 0.9
            },
            {
              "op": "pattern_recognition",
              "intensity": 0.7
            },
            {
              "op": "metacognition",
              "intensity": 0.6
            }
          ],
          "complexityLevel": 6,
          "warnings": [],
          "barriers": [
            "Нелинейное время"
          ],
          "isNicheMasterpiece": false
        },
        "slot": "side_step",
        "stretch": "easy_entry",
        "targetOperations": [
          "causal_reasoning"
        ],
        "explanation": {
          "what": "Человек без короткой памяти восстанавливает события по запискам — а фильм идёт в обратном порядке.",
          "why": "Опирается на вашу сильную сторону — причинные цепочки, но собранные наоборот.",
          "whyNow": "Сегодня вы выбрали «полегче»: здесь усилие уходит в структуру, а не в темп.",
          "whatNext": "Первый шаг к «Бледному огню»: рассказчик, которому нельзя верить."
        },
        "readiness": {
          "ready": true,
          "missing": []
        },
        "createdAt": "2026-09-17"
      }
    ]
  },
  "high": {
    "id": "s-high",
    "generatedAt": "2026-09-17T18:10:00+03:00",
    "energy": "high",
    "items": [
      {
        "id": "r1",
        "work": {
          "id": "w02",
          "type": "film",
          "title": "Расёмон",
          "originalTitle": "Rashômon",
          "year": 1950,
          "creators": [
            "Акира Куросава"
          ],
          "countries": [
            "Япония"
          ],
          "durationMinutes": 88,
          "primaryOperations": [
            {
              "op": "perspective_taking",
              "intensity": 0.95
            },
            {
              "op": "critical_analysis",
              "intensity": 0.7
            },
            {
              "op": "metacognition",
              "intensity": 0.5
            }
          ],
          "complexityLevel": 5,
          "warnings": [],
          "barriers": [
            "Условная актёрская манера"
          ],
          "isNicheMasterpiece": false
        },
        "slot": "next_step",
        "stretch": "productive",
        "targetOperations": [
          "perspective_taking",
          "critical_analysis"
        ],
        "explanation": {
          "what": "Одно преступление в пересказе четырёх свидетелей, и версии не сходятся.",
          "why": "Вы уверенно выстраиваете причинно-следственные цепочки — здесь эта сила встретит событие, у которого нет одной правильной цепочки.",
          "whyNow": "«Двенадцать разгневанных мужчин» показали, как мнение меняется под новым углом. «Расёмон» делает следующий ход: угол зрения меняет сам факт.",
          "whatNext": "«Прибытие» — там перспектива затрагивает восприятие времени."
        },
        "readiness": {
          "ready": true,
          "missing": []
        },
        "createdAt": "2026-09-17",
        "trajectoryId": "tr1"
      },
      {
        "id": "r2",
        "work": {
          "id": "w12",
          "type": "book",
          "title": "Имя розы",
          "originalTitle": "Il nome della rosa",
          "year": 1980,
          "creators": [
            "Умберто Эко"
          ],
          "countries": [
            "Италия"
          ],
          "pages": 640,
          "primaryOperations": [
            {
              "op": "pattern_recognition",
              "intensity": 0.8
            },
            {
              "op": "critical_analysis",
              "intensity": 0.8
            },
            {
              "op": "synthesis",
              "intensity": 0.6
            }
          ],
          "complexityLevel": 7,
          "warnings": [],
          "barriers": [
            "Исторический контекст",
            "Латинские вставки"
          ],
          "isNicheMasterpiece": false
        },
        "slot": "stretch",
        "stretch": "challenge",
        "targetOperations": [
          "pattern_recognition",
          "critical_analysis"
        ],
        "explanation": {
          "what": "Детективная структура, в которой расследуется и сам способ толковать знаки.",
          "why": "Вы хорошо замечаете повторы — роман даёт им объём: знак здесь может значить не то, чем кажется.",
          "whyNow": "После «Расёмона» проверка версий перестаёт быть механикой сюжета и становится темой.",
          "whatNext": "Отсюда открывается «Бледный огонь» — комментарий, который спорит со своим текстом."
        },
        "readiness": {
          "ready": true,
          "missing": []
        },
        "createdAt": "2026-09-17"
      },
      {
        "id": "r3",
        "work": {
          "id": "w13",
          "type": "book",
          "title": "Невидимые города",
          "originalTitle": "Le città invisibili",
          "year": 1972,
          "creators": [
            "Итало Кальвино"
          ],
          "countries": [
            "Италия"
          ],
          "pages": 168,
          "primaryOperations": [
            {
              "op": "abstraction",
              "intensity": 0.9
            },
            {
              "op": "analogical_thinking",
              "intensity": 0.8
            }
          ],
          "complexityLevel": 6,
          "warnings": [],
          "barriers": [
            "Без сюжета в привычном смысле"
          ],
          "isNicheMasterpiece": false
        },
        "slot": "side_step",
        "stretch": "productive",
        "targetOperations": [
          "abstraction",
          "analogical_thinking"
        ],
        "explanation": {
          "what": "Книга без привычного сюжета: пятьдесят пять городов, каждый — модель одной мысли.",
          "why": "Вы ещё не встречали повествование, построенное как набор вариаций, — это не случайный выбор, а недостающая форма.",
          "whyNow": "Короткие главы позволяют попробовать непривычное устройство без большого вложения времени.",
          "whatNext": "Дальше — «Зеркало», где вариации собираются в одну жизнь."
        },
        "readiness": {
          "ready": true,
          "missing": []
        },
        "createdAt": "2026-09-17"
      },
      {
        "id": "r5",
        "work": {
          "id": "w03",
          "type": "film",
          "title": "Помни",
          "originalTitle": "Memento",
          "year": 2000,
          "creators": [
            "Кристофер Нолан"
          ],
          "countries": [
            "США"
          ],
          "durationMinutes": 113,
          "primaryOperations": [
            {
              "op": "causal_reasoning",
              "intensity": 0.9
            },
            {
              "op": "pattern_recognition",
              "intensity": 0.7
            },
            {
              "op": "metacognition",
              "intensity": 0.6
            }
          ],
          "complexityLevel": 6,
          "warnings": [],
          "barriers": [
            "Нелинейное время"
          ],
          "isNicheMasterpiece": false
        },
        "slot": "preparation",
        "stretch": "productive",
        "targetOperations": [
          "metacognition"
        ],
        "explanation": {
          "what": "Человек без короткой памяти восстанавливает события по запискам — а фильм идёт в обратном порядке.",
          "why": "Опирается на вашу сильную сторону — причинные цепочки, но собранные наоборот.",
          "whyNow": "Сегодня вы выбрали «полегче»: здесь усилие уходит в структуру, а не в темп.",
          "whatNext": "Первый шаг к «Бледному огню»: рассказчик, которому нельзя верить."
        },
        "readiness": {
          "ready": false,
          "missing": [
            {
              "kind": "work",
              "label": "«Бойня номер пять»",
              "work": {
                "id": "w11",
                "type": "book",
                "title": "Бойня номер пять",
                "originalTitle": "Slaughterhouse-Five",
                "year": 1969,
                "creators": [
                  "Курт Воннегут"
                ],
                "countries": [
                  "США"
                ],
                "pages": 224,
                "primaryOperations": [
                  {
                    "op": "causal_reasoning",
                    "intensity": 0.7
                  },
                  {
                    "op": "perspective_taking",
                    "intensity": 0.6
                  },
                  {
                    "op": "metacognition",
                    "intensity": 0.5
                  }
                ],
                "complexityLevel": 5,
                "warnings": [
                  "Сцены войны"
                ],
                "barriers": [
                  "Нелинейное время"
                ],
                "isNicheMasterpiece": false
              },
              "necessity": "helpful",
              "met": false
            }
          ]
        },
        "createdAt": "2026-09-17"
      }
    ]
  }
};

export const trajectories: Trajectory[] = [
  {
    "id": "tr1",
    "title": "Смотреть чужими глазами",
    "kind": "development",
    "target": {
      "id": "t1",
      "operations": [
        "perspective_taking"
      ],
      "label": "Смотреть чужими глазами",
      "source": "user",
      "createdAt": "2026-08-27",
      "active": true
    },
    "progress": 0.2,
    "createdAt": "2026-08-27",
    "replanHistory": [],
    "steps": [
      {
        "order": 1,
        "work": {
          "id": "w01",
          "type": "film",
          "title": "Двенадцать разгневанных мужчин",
          "originalTitle": "12 Angry Men",
          "year": 1957,
          "creators": [
            "Сидни Люмет"
          ],
          "countries": [
            "США"
          ],
          "durationMinutes": 96,
          "primaryOperations": [
            {
              "op": "critical_analysis",
              "intensity": 0.9
            },
            {
              "op": "perspective_taking",
              "intensity": 0.7
            }
          ],
          "complexityLevel": 3,
          "warnings": [],
          "barriers": [],
          "isNicheMasterpiece": false
        },
        "purpose": "мнение меняется, когда меняется угол зрения",
        "status": "completed",
        "stretch": "easy_entry",
        "operationsIntroduced": [
          "perspective_taking"
        ],
        "operationsReinforced": [
          "critical_analysis"
        ]
      },
      {
        "order": 2,
        "work": {
          "id": "w02",
          "type": "film",
          "title": "Расёмон",
          "originalTitle": "Rashômon",
          "year": 1950,
          "creators": [
            "Акира Куросава"
          ],
          "countries": [
            "Япония"
          ],
          "durationMinutes": 88,
          "primaryOperations": [
            {
              "op": "perspective_taking",
              "intensity": 0.95
            },
            {
              "op": "critical_analysis",
              "intensity": 0.7
            },
            {
              "op": "metacognition",
              "intensity": 0.5
            }
          ],
          "complexityLevel": 5,
          "warnings": [],
          "barriers": [
            "Условная актёрская манера"
          ],
          "isNicheMasterpiece": false
        },
        "purpose": "угол зрения меняет сам факт",
        "status": "available",
        "stretch": "productive",
        "operationsIntroduced": [
          "metacognition"
        ],
        "operationsReinforced": [
          "perspective_taking"
        ]
      },
      {
        "order": 3,
        "work": {
          "id": "w04",
          "type": "film",
          "title": "Прибытие",
          "originalTitle": "Arrival",
          "year": 2016,
          "creators": [
            "Дени Вильнёв"
          ],
          "countries": [
            "США"
          ],
          "durationMinutes": 116,
          "primaryOperations": [
            {
              "op": "perspective_taking",
              "intensity": 0.8
            },
            {
              "op": "analogical_thinking",
              "intensity": 0.7
            },
            {
              "op": "synthesis",
              "intensity": 0.6
            }
          ],
          "complexityLevel": 5,
          "warnings": [],
          "barriers": [],
          "isNicheMasterpiece": false
        },
        "purpose": "перспектива меняет даже восприятие времени",
        "status": "locked",
        "stretch": "productive",
        "operationsIntroduced": [
          "analogical_thinking"
        ],
        "operationsReinforced": [
          "perspective_taking",
          "synthesis"
        ]
      },
      {
        "order": 4,
        "work": {
          "id": "w11",
          "type": "book",
          "title": "Бойня номер пять",
          "originalTitle": "Slaughterhouse-Five",
          "year": 1969,
          "creators": [
            "Курт Воннегут"
          ],
          "countries": [
            "США"
          ],
          "pages": 224,
          "primaryOperations": [
            {
              "op": "causal_reasoning",
              "intensity": 0.7
            },
            {
              "op": "perspective_taking",
              "intensity": 0.6
            },
            {
              "op": "metacognition",
              "intensity": 0.5
            }
          ],
          "complexityLevel": 5,
          "warnings": [
            "Сцены войны"
          ],
          "barriers": [
            "Нелинейное время"
          ],
          "isNicheMasterpiece": false
        },
        "purpose": "одна жизнь, увиденная вне порядка событий",
        "status": "locked",
        "stretch": "productive",
        "operationsIntroduced": [],
        "operationsReinforced": [
          "perspective_taking",
          "causal_reasoning"
        ]
      },
      {
        "order": 5,
        "work": {
          "id": "w14",
          "type": "book",
          "title": "Шум и ярость",
          "originalTitle": "The Sound and the Fury",
          "year": 1929,
          "creators": [
            "Уильям Фолкнер"
          ],
          "countries": [
            "США"
          ],
          "pages": 336,
          "primaryOperations": [
            {
              "op": "perspective_taking",
              "intensity": 0.95
            },
            {
              "op": "synthesis",
              "intensity": 0.9
            }
          ],
          "complexityLevel": 9,
          "warnings": [],
          "barriers": [
            "Поток сознания",
            "Смена рассказчиков без предупреждения"
          ],
          "isNicheMasterpiece": true
        },
        "purpose": "одна история в четырёх несовместимых сознаниях",
        "status": "locked",
        "stretch": "challenge",
        "operationsIntroduced": [],
        "operationsReinforced": [
          "perspective_taking",
          "synthesis"
        ]
      }
    ]
  },
  {
    "id": "tr2",
    "title": "Путь к «Зеркалу»",
    "kind": "peak_path",
    "peakWork": {
      "id": "w07",
      "type": "film",
      "title": "Зеркало",
      "year": 1975,
      "creators": [
        "Андрей Тарковский"
      ],
      "countries": [
        "СССР"
      ],
      "durationMinutes": 108,
      "primaryOperations": [
        {
          "op": "synthesis",
          "intensity": 0.95
        },
        {
          "op": "abstraction",
          "intensity": 0.8
        },
        {
          "op": "metacognition",
          "intensity": 0.7
        }
      ],
      "complexityLevel": 9,
      "warnings": [],
      "barriers": [
        "Фрагментарная структура",
        "Медленный темп"
      ],
      "isNicheMasterpiece": true
    },
    "target": {
      "id": "t4",
      "operations": [
        "synthesis",
        "abstraction"
      ],
      "label": "Собирать целое",
      "source": "system_suggested",
      "createdAt": "2026-08-27",
      "active": true
    },
    "progress": 0.375,
    "createdAt": "2026-08-27",
    "replanHistory": [
      {
        "at": "2026-09-09",
        "reason": "Фильм «Солярис» отложен — темп оказался барьером. Добавлен роман Лема: та же история в более привычном ритме."
      }
    ],
    "steps": [
      {
        "order": 1,
        "work": {
          "id": "w05",
          "type": "film",
          "title": "Иваново детство",
          "year": 1962,
          "creators": [
            "Андрей Тарковский"
          ],
          "countries": [
            "СССР"
          ],
          "durationMinutes": 95,
          "primaryOperations": [
            {
              "op": "perspective_taking",
              "intensity": 0.6
            },
            {
              "op": "synthesis",
              "intensity": 0.5
            }
          ],
          "complexityLevel": 5,
          "warnings": [
            "Сцены войны"
          ],
          "barriers": [],
          "isNicheMasterpiece": false
        },
        "purpose": "язык Тарковского в понятной военной истории",
        "status": "completed",
        "stretch": "productive",
        "operationsIntroduced": [
          "synthesis"
        ],
        "operationsReinforced": [
          "perspective_taking"
        ]
      },
      {
        "order": 2,
        "work": {
          "id": "w17",
          "type": "book",
          "title": "Солярис",
          "originalTitle": "Solaris",
          "year": 1961,
          "creators": [
            "Станислав Лем"
          ],
          "countries": [
            "Польша"
          ],
          "pages": 204,
          "primaryOperations": [
            {
              "op": "abstraction",
              "intensity": 0.8
            },
            {
              "op": "critical_analysis",
              "intensity": 0.6
            }
          ],
          "complexityLevel": 6,
          "warnings": [],
          "barriers": [],
          "isNicheMasterpiece": false
        },
        "purpose": "та же история в привычном ритме романа",
        "status": "in_progress",
        "stretch": "productive",
        "operationsIntroduced": [
          "abstraction"
        ],
        "operationsReinforced": [
          "critical_analysis"
        ]
      },
      {
        "order": 3,
        "work": {
          "id": "w06",
          "type": "film",
          "title": "Солярис",
          "year": 1972,
          "creators": [
            "Андрей Тарковский"
          ],
          "countries": [
            "СССР"
          ],
          "durationMinutes": 167,
          "primaryOperations": [
            {
              "op": "abstraction",
              "intensity": 0.8
            },
            {
              "op": "metacognition",
              "intensity": 0.7
            }
          ],
          "complexityLevel": 7,
          "warnings": [],
          "barriers": [
            "Медленный темп"
          ],
          "isNicheMasterpiece": false
        },
        "purpose": "вторая попытка, уже зная сюжет",
        "status": "skipped",
        "stretch": "challenge",
        "operationsIntroduced": [],
        "operationsReinforced": [
          "abstraction",
          "metacognition"
        ]
      },
      {
        "order": 4,
        "work": {
          "id": "w07",
          "type": "film",
          "title": "Зеркало",
          "year": 1975,
          "creators": [
            "Андрей Тарковский"
          ],
          "countries": [
            "СССР"
          ],
          "durationMinutes": 108,
          "primaryOperations": [
            {
              "op": "synthesis",
              "intensity": 0.95
            },
            {
              "op": "abstraction",
              "intensity": 0.8
            },
            {
              "op": "metacognition",
              "intensity": 0.7
            }
          ],
          "complexityLevel": 9,
          "warnings": [],
          "barriers": [
            "Фрагментарная структура",
            "Медленный темп"
          ],
          "isNicheMasterpiece": true
        },
        "purpose": "вершина",
        "status": "locked",
        "stretch": "challenge",
        "operationsIntroduced": [],
        "operationsReinforced": [
          "synthesis",
          "abstraction",
          "metacognition"
        ]
      }
    ]
  }
];

export const journal: JourneyEntryData[] = [
  {
    "id": "j7",
    "work": {
      "id": "w17",
      "type": "book",
      "title": "Солярис",
      "originalTitle": "Solaris",
      "year": 1961,
      "creators": [
        "Станислав Лем"
      ],
      "countries": [
        "Польша"
      ],
      "pages": 204,
      "primaryOperations": [
        {
          "op": "abstraction",
          "intensity": 0.8
        },
        {
          "op": "critical_analysis",
          "intensity": 0.6
        }
      ],
      "complexityLevel": 6,
      "warnings": [],
      "barriers": [],
      "isNicheMasterpiece": false
    },
    "status": "in_progress",
    "progress": 0.4,
    "startedAt": "2026-09-15",
    "reflections": [],
    "stateChanges": []
  },
  {
    "id": "j6",
    "work": {
      "id": "w16",
      "type": "book",
      "title": "Мастер и Маргарита",
      "year": 1967,
      "creators": [
        "Михаил Булгаков"
      ],
      "countries": [
        "СССР"
      ],
      "pages": 480,
      "primaryOperations": [
        {
          "op": "synthesis",
          "intensity": 0.6
        },
        {
          "op": "analogical_thinking",
          "intensity": 0.6
        }
      ],
      "complexityLevel": 5,
      "warnings": [],
      "barriers": [],
      "isNicheMasterpiece": false
    },
    "status": "finished",
    "startedAt": "2026-09-10",
    "finishedAt": "2026-09-14",
    "perceivedDifficulty": "just_right",
    "reflections": [
      {
        "promptId": "p1",
        "answer": "Две линии сошлись не сюжетом, а рифмой сцен — я заметила это только к концу."
      }
    ],
    "stateChanges": [
      {
        "op": "synthesis",
        "delta": 0.3,
        "changeType": "refined_estimate"
      }
    ]
  },
  {
    "id": "j5",
    "work": {
      "id": "w06",
      "type": "film",
      "title": "Солярис",
      "year": 1972,
      "creators": [
        "Андрей Тарковский"
      ],
      "countries": [
        "СССР"
      ],
      "durationMinutes": 167,
      "primaryOperations": [
        {
          "op": "abstraction",
          "intensity": 0.8
        },
        {
          "op": "metacognition",
          "intensity": 0.7
        }
      ],
      "complexityLevel": 7,
      "warnings": [],
      "barriers": [
        "Медленный темп"
      ],
      "isNicheMasterpiece": false
    },
    "status": "abandoned",
    "startedAt": "2026-09-07",
    "finishedAt": "2026-09-09",
    "abandonReason": "not_engaging",
    "reflections": [],
    "stateChanges": []
  },
  {
    "id": "j4",
    "work": {
      "id": "w09",
      "type": "film",
      "title": "Паразиты",
      "originalTitle": "기생충",
      "year": 2019,
      "creators": [
        "Пон Джун-хо"
      ],
      "countries": [
        "Южная Корея"
      ],
      "durationMinutes": 132,
      "primaryOperations": [
        {
          "op": "critical_analysis",
          "intensity": 0.7
        },
        {
          "op": "pattern_recognition",
          "intensity": 0.6
        },
        {
          "op": "analogical_thinking",
          "intensity": 0.6
        }
      ],
      "complexityLevel": 4,
      "warnings": [
        "Насилие"
      ],
      "barriers": [],
      "isNicheMasterpiece": false
    },
    "status": "finished",
    "startedAt": "2026-09-10",
    "finishedAt": "2026-09-11",
    "perceivedDifficulty": "just_right",
    "reflections": [],
    "stateChanges": [
      {
        "op": "critical_analysis",
        "delta": 0.2,
        "changeType": "refined_estimate"
      }
    ]
  },
  {
    "id": "j3",
    "work": {
      "id": "w08",
      "type": "film",
      "title": "Начало",
      "originalTitle": "Inception",
      "year": 2010,
      "creators": [
        "Кристофер Нолан"
      ],
      "countries": [
        "США"
      ],
      "durationMinutes": 148,
      "primaryOperations": [
        {
          "op": "causal_reasoning",
          "intensity": 0.7
        },
        {
          "op": "pattern_recognition",
          "intensity": 0.6
        },
        {
          "op": "abstraction",
          "intensity": 0.5
        }
      ],
      "complexityLevel": 5,
      "warnings": [],
      "barriers": [],
      "isNicheMasterpiece": false
    },
    "status": "finished",
    "startedAt": "2026-09-05",
    "finishedAt": "2026-09-06",
    "perceivedDifficulty": "just_right",
    "reflections": [],
    "stateChanges": [
      {
        "op": "causal_reasoning",
        "delta": 0.4,
        "changeType": "refined_estimate"
      }
    ]
  },
  {
    "id": "j2",
    "work": {
      "id": "w05",
      "type": "film",
      "title": "Иваново детство",
      "year": 1962,
      "creators": [
        "Андрей Тарковский"
      ],
      "countries": [
        "СССР"
      ],
      "durationMinutes": 95,
      "primaryOperations": [
        {
          "op": "perspective_taking",
          "intensity": 0.6
        },
        {
          "op": "synthesis",
          "intensity": 0.5
        }
      ],
      "complexityLevel": 5,
      "warnings": [
        "Сцены войны"
      ],
      "barriers": [],
      "isNicheMasterpiece": false
    },
    "status": "finished",
    "startedAt": "2026-09-01",
    "finishedAt": "2026-09-02",
    "perceivedDifficulty": "just_right",
    "reflections": [],
    "stateChanges": [
      {
        "op": "perspective_taking",
        "delta": 0.3,
        "changeType": "refined_estimate"
      }
    ]
  },
  {
    "id": "j1",
    "work": {
      "id": "w01",
      "type": "film",
      "title": "Двенадцать разгневанных мужчин",
      "originalTitle": "12 Angry Men",
      "year": 1957,
      "creators": [
        "Сидни Люмет"
      ],
      "countries": [
        "США"
      ],
      "durationMinutes": 96,
      "primaryOperations": [
        {
          "op": "critical_analysis",
          "intensity": 0.9
        },
        {
          "op": "perspective_taking",
          "intensity": 0.7
        }
      ],
      "complexityLevel": 3,
      "warnings": [],
      "barriers": [],
      "isNicheMasterpiece": false
    },
    "status": "finished",
    "startedAt": "2026-08-29",
    "finishedAt": "2026-08-30",
    "perceivedDifficulty": "too_easy",
    "reflections": [],
    "stateChanges": [
      {
        "op": "critical_analysis",
        "delta": 0.5,
        "changeType": "refined_estimate"
      }
    ]
  },
  {
    "id": "j0",
    "work": {
      "id": "w04",
      "type": "film",
      "title": "Прибытие",
      "originalTitle": "Arrival",
      "year": 2016,
      "creators": [
        "Дени Вильнёв"
      ],
      "countries": [
        "США"
      ],
      "durationMinutes": 116,
      "primaryOperations": [
        {
          "op": "perspective_taking",
          "intensity": 0.8
        },
        {
          "op": "analogical_thinking",
          "intensity": 0.7
        },
        {
          "op": "synthesis",
          "intensity": 0.6
        }
      ],
      "complexityLevel": 5,
      "warnings": [],
      "barriers": [],
      "isNicheMasterpiece": false
    },
    "status": "planned",
    "reflections": [],
    "stateChanges": []
  }
];

export const tropeInsights: TropeInsightData[] = [
  {
    "tropeId": "tr-01",
    "tropePath": [
      "Структура",
      "Конфликт",
      "Один против группы",
      "Одиночка против большинства"
    ],
    "name": "Одиночка против большинства",
    "usage": "straight",
    "operations": [
      "critical_analysis",
      "perspective_taking"
    ],
    "spoilerLevel": 1,
    "plainExplanation": "Один человек не соглашается с остальными — и фильму приходится показать, чем держится уверенность каждого из одиннадцати."
  },
  {
    "tropeId": "tr-02",
    "tropePath": [
      "Персонажи",
      "Состав",
      "Срез общества",
      "Присяжные как срез общества"
    ],
    "name": "Присяжные как срез общества",
    "usage": "straight",
    "operations": [
      "analogical_thinking"
    ],
    "spoilerLevel": 1,
    "plainExplanation": "Каждый заседатель несёт свою предвзятость, и спор о деле оказывается спором о том, кто как устроен."
  },
  {
    "tropeId": "tr-03",
    "tropePath": [
      "Механизмы",
      "Улики",
      "Переоценка улики",
      "Улика, которая перестаёт быть уликой"
    ],
    "name": "Улика, которая перестаёт быть уликой",
    "usage": "deconstruction",
    "operations": [
      "pattern_recognition",
      "critical_analysis"
    ],
    "spoilerLevel": 2,
    "plainExplanation": "Деталь разбирают второй раз — и она разворачивается против того вывода, который держала."
  }
];

export const externalAnalyses: ExternalAnalysis[] = [
  {
    "id": "ea1",
    "title": "Комната, стол, одиннадцать против одного",
    "author": "Марк Лаврентьев",
    "platform": "youtube",
    "url": "https://example.com/lavrentiev/12-men",
    "language": "ru",
    "spoilerLevel": 1,
    "operations": [
      "critical_analysis"
    ]
  },
  {
    "id": "ea2",
    "title": "Как монтаж делает сомнение видимым",
    "author": "Ника",
    "platform": "telegram",
    "url": "https://example.com/nika/montage-doubt",
    "language": "ru",
    "spoilerLevel": 2,
    "operations": [
      "pattern_recognition"
    ]
  },
  {
    "id": "ea3",
    "title": "Four testimonies, one gate",
    "author": "J. Oram",
    "platform": "article",
    "url": "https://example.com/oram/rashomon-gate",
    "language": "en",
    "spoilerLevel": 0,
    "operations": [
      "perspective_taking"
    ]
  }
];

export const debrief: Debrief = {
  "summary": "Фильм почти целиком в одной комнате, и напряжение строится не на событиях, а на том, как по одному рушатся уверенные выводы.",
  "tropeInsights": [
    {
      "tropeId": "tr-01",
      "tropePath": [
        "Структура",
        "Конфликт",
        "Один против группы",
        "Одиночка против большинства"
      ],
      "name": "Одиночка против большинства",
      "usage": "straight",
      "operations": [
        "critical_analysis",
        "perspective_taking"
      ],
      "spoilerLevel": 1,
      "plainExplanation": "Один человек не соглашается с остальными — и фильму приходится показать, чем держится уверенность каждого из одиннадцати."
    },
    {
      "tropeId": "tr-02",
      "tropePath": [
        "Персонажи",
        "Состав",
        "Срез общества",
        "Присяжные как срез общества"
      ],
      "name": "Присяжные как срез общества",
      "usage": "straight",
      "operations": [
        "analogical_thinking"
      ],
      "spoilerLevel": 1,
      "plainExplanation": "Каждый заседатель несёт свою предвзятость, и спор о деле оказывается спором о том, кто как устроен."
    },
    {
      "tropeId": "tr-03",
      "tropePath": [
        "Механизмы",
        "Улики",
        "Переоценка улики",
        "Улика, которая перестаёт быть уликой"
      ],
      "name": "Улика, которая перестаёт быть уликой",
      "usage": "deconstruction",
      "operations": [
        "pattern_recognition",
        "critical_analysis"
      ],
      "spoilerLevel": 2,
      "plainExplanation": "Деталь разбирают второй раз — и она разворачивается против того вывода, который держала."
    }
  ],
  "externalAnalyses": [
    {
      "id": "ea1",
      "title": "Комната, стол, одиннадцать против одного",
      "author": "Марк Лаврентьев",
      "platform": "youtube",
      "url": "https://example.com/lavrentiev/12-men",
      "language": "ru",
      "spoilerLevel": 1,
      "operations": [
        "critical_analysis"
      ]
    },
    {
      "id": "ea2",
      "title": "Как монтаж делает сомнение видимым",
      "author": "Ника",
      "platform": "telegram",
      "url": "https://example.com/nika/montage-doubt",
      "language": "ru",
      "spoilerLevel": 2,
      "operations": [
        "pattern_recognition"
      ]
    }
  ]
};

export const reflectionPrompts: ReflectionPromptData[] = [
  {
    "id": "p1",
    "op": "perspective_taking",
    "question": "Чья версия показалась самой убедительной и что именно убедило?",
    "kind": "free_text"
  },
  {
    "id": "p2",
    "op": "metacognition",
    "question": "В какой момент вы поменяли мнение о том, что произошло?",
    "kind": "free_text"
  },
  {
    "id": "p3",
    "op": "critical_analysis",
    "question": "Что фильм говорит о правде?",
    "kind": "choice",
    "options": [
      "её можно восстановить",
      "нельзя восстановить",
      "вопрос поставлен неверно",
      "сложно сказать"
    ]
  }
];

export const assessmentItems: AssessmentItemData[] = [
  {
    "id": "a1",
    "kind": "media_familiarity",
    "prompt": "Что из этого вы смотрели или читали?",
    "targetOperations": [],
    "response": {
      "type": "familiarity_grid",
      "works": [
        {
          "id": "w01",
          "type": "film",
          "title": "Двенадцать разгневанных мужчин",
          "originalTitle": "12 Angry Men",
          "year": 1957,
          "creators": [
            "Сидни Люмет"
          ],
          "countries": [
            "США"
          ],
          "durationMinutes": 96,
          "primaryOperations": [
            {
              "op": "critical_analysis",
              "intensity": 0.9
            },
            {
              "op": "perspective_taking",
              "intensity": 0.7
            }
          ],
          "complexityLevel": 3,
          "warnings": [],
          "barriers": [],
          "isNicheMasterpiece": false
        },
        {
          "id": "w02",
          "type": "film",
          "title": "Расёмон",
          "originalTitle": "Rashômon",
          "year": 1950,
          "creators": [
            "Акира Куросава"
          ],
          "countries": [
            "Япония"
          ],
          "durationMinutes": 88,
          "primaryOperations": [
            {
              "op": "perspective_taking",
              "intensity": 0.95
            },
            {
              "op": "critical_analysis",
              "intensity": 0.7
            },
            {
              "op": "metacognition",
              "intensity": 0.5
            }
          ],
          "complexityLevel": 5,
          "warnings": [],
          "barriers": [
            "Условная актёрская манера"
          ],
          "isNicheMasterpiece": false
        },
        {
          "id": "w08",
          "type": "film",
          "title": "Начало",
          "originalTitle": "Inception",
          "year": 2010,
          "creators": [
            "Кристофер Нолан"
          ],
          "countries": [
            "США"
          ],
          "durationMinutes": 148,
          "primaryOperations": [
            {
              "op": "causal_reasoning",
              "intensity": 0.7
            },
            {
              "op": "pattern_recognition",
              "intensity": 0.6
            },
            {
              "op": "abstraction",
              "intensity": 0.5
            }
          ],
          "complexityLevel": 5,
          "warnings": [],
          "barriers": [],
          "isNicheMasterpiece": false
        },
        {
          "id": "w11",
          "type": "book",
          "title": "Бойня номер пять",
          "originalTitle": "Slaughterhouse-Five",
          "year": 1969,
          "creators": [
            "Курт Воннегут"
          ],
          "countries": [
            "США"
          ],
          "pages": 224,
          "primaryOperations": [
            {
              "op": "causal_reasoning",
              "intensity": 0.7
            },
            {
              "op": "perspective_taking",
              "intensity": 0.6
            },
            {
              "op": "metacognition",
              "intensity": 0.5
            }
          ],
          "complexityLevel": 5,
          "warnings": [
            "Сцены войны"
          ],
          "barriers": [
            "Нелинейное время"
          ],
          "isNicheMasterpiece": false
        },
        {
          "id": "w16",
          "type": "book",
          "title": "Мастер и Маргарита",
          "year": 1967,
          "creators": [
            "Михаил Булгаков"
          ],
          "countries": [
            "СССР"
          ],
          "pages": 480,
          "primaryOperations": [
            {
              "op": "synthesis",
              "intensity": 0.6
            },
            {
              "op": "analogical_thinking",
              "intensity": 0.6
            }
          ],
          "complexityLevel": 5,
          "warnings": [],
          "barriers": [],
          "isNicheMasterpiece": false
        },
        {
          "id": "w09",
          "type": "film",
          "title": "Паразиты",
          "originalTitle": "기생충",
          "year": 2019,
          "creators": [
            "Пон Джун-хо"
          ],
          "countries": [
            "Южная Корея"
          ],
          "durationMinutes": 132,
          "primaryOperations": [
            {
              "op": "critical_analysis",
              "intensity": 0.7
            },
            {
              "op": "pattern_recognition",
              "intensity": 0.6
            },
            {
              "op": "analogical_thinking",
              "intensity": 0.6
            }
          ],
          "complexityLevel": 4,
          "warnings": [
            "Насилие"
          ],
          "barriers": [],
          "isNicheMasterpiece": false
        }
      ],
      "levels": [
        "unknown",
        "seen",
        "remember_well",
        "revisited",
        "analyzed"
      ]
    }
  },
  {
    "id": "a2",
    "kind": "scenario",
    "prompt": "Какие объяснения совместимы с обеими версиями?",
    "body": "Соседка уверена, что курьер оставил посылку у двери. Курьер говорит, что дверь не открыли и он увёз посылку. Камера в подъезде не работала.",
    "targetOperations": [
      "causal_reasoning",
      "critical_analysis"
    ],
    "response": {
      "type": "multi_choice",
      "options": [
        {
          "id": "o1",
          "label": "Посылку забрал кто-то другой до возвращения соседки"
        },
        {
          "id": "o2",
          "label": "Курьер приходил к другой двери"
        },
        {
          "id": "o3",
          "label": "Соседка помнит другой день"
        },
        {
          "id": "o4",
          "label": "Кто-то из двоих говорит неправду"
        }
      ]
    }
  },
  {
    "id": "a3",
    "kind": "pattern",
    "prompt": "Расставьте события в том порядке, в каком они произошли",
    "targetOperations": [
      "pattern_recognition",
      "causal_reasoning"
    ],
    "response": {
      "type": "ordering",
      "items": [
        {
          "id": "i1",
          "label": "Письмо приходит второй раз"
        },
        {
          "id": "i2",
          "label": "Героиня узнаёт почерк"
        },
        {
          "id": "i3",
          "label": "Поезд отменяют"
        },
        {
          "id": "i4",
          "label": "Она возвращается на станцию"
        },
        {
          "id": "i5",
          "label": "Конверт остаётся нераспечатанным"
        }
      ]
    }
  },
  {
    "id": "a4",
    "kind": "self_report",
    "prompt": "Когда у фильма открытый финал, я скорее…",
    "targetOperations": [
      "metacognition"
    ],
    "response": {
      "type": "scale",
      "min": 1,
      "max": 7,
      "minLabel": "раздражаюсь",
      "maxLabel": "получаю удовольствие от неясности"
    }
  },
  {
    "id": "a5",
    "kind": "perspective",
    "prompt": "Что каждый из них не видит?",
    "body": "Один и тот же вечер: он ушёл, не дождавшись ответа. Она весь вечер держала телефон в руках.",
    "targetOperations": [
      "perspective_taking"
    ],
    "response": {
      "type": "free_text",
      "maxLength": 400
    }
  }
];

export const curatorQueue: AnnotationReviewItem[] = [
  {
    "annotationId": "an-01",
    "work": {
      "id": "w07",
      "type": "film",
      "title": "Зеркало",
      "year": 1975,
      "creators": [
        "Андрей Тарковский"
      ]
    },
    "status": "needs_review",
    "tmdfVersion": "0.3.1",
    "provider": "local",
    "model": "qwen2.5-32b",
    "modelTier": "standard",
    "overallConfidence": "low",
    "lowConfidenceFields": [
      "cognitive_operations.synthesis.demand",
      "tropes[3].usage"
    ],
    "validationErrors": [],
    "knowledgeSufficiency": "partial",
    "usage": {
      "inputTokens": 18420,
      "outputTokens": 3110,
      "durationMs": 41200,
      "costUsd": 0
    },
    "isGold": false,
    "createdAt": "2026-09-16"
  },
  {
    "annotationId": "an-02",
    "work": {
      "id": "w15",
      "type": "book",
      "title": "Бледный огонь",
      "year": 1962,
      "creators": [
        "Владимир Набоков"
      ]
    },
    "status": "validation_failed",
    "tmdfVersion": "0.3.1",
    "provider": "local",
    "model": "qwen2.5-32b",
    "modelTier": "standard",
    "overallConfidence": "low",
    "lowConfidenceFields": [
      "barriers[1].severity"
    ],
    "validationErrors": [
      {
        "path": "tropes[2].usage",
        "message": "Значение «ironic» вне перечня TropeUsageType"
      },
      {
        "path": "prerequisites[0].necessity",
        "message": "Пустое поле при met = false"
      }
    ],
    "knowledgeSufficiency": "insufficient",
    "usage": {
      "inputTokens": 21050,
      "outputTokens": 2870,
      "durationMs": 38900,
      "costUsd": 0
    },
    "isGold": false,
    "createdAt": "2026-09-16"
  },
  {
    "annotationId": "an-03",
    "work": {
      "id": "w02",
      "type": "film",
      "title": "Расёмон",
      "year": 1950,
      "creators": [
        "Акира Куросава"
      ]
    },
    "status": "approved",
    "tmdfVersion": "0.3.1",
    "provider": "human",
    "model": "куратор: Д.",
    "modelTier": "light",
    "overallConfidence": "high",
    "lowConfidenceFields": [],
    "validationErrors": [],
    "knowledgeSufficiency": "sufficient",
    "usage": {
      "inputTokens": 0,
      "outputTokens": 0,
      "durationMs": 2760000,
      "costUsd": 0
    },
    "isGold": true,
    "createdAt": "2026-09-12"
  },
  {
    "annotationId": "an-04",
    "work": {
      "id": "w13",
      "type": "book",
      "title": "Невидимые города",
      "year": 1972,
      "creators": [
        "Итало Кальвино"
      ]
    },
    "status": "needs_review",
    "tmdfVersion": "0.3.1",
    "provider": "packet",
    "model": "пакет 2026-09-14",
    "modelTier": "heavy",
    "overallConfidence": "medium",
    "lowConfidenceFields": [
      "cognitive_operations.abstraction.activation"
    ],
    "validationErrors": [],
    "knowledgeSufficiency": "sufficient",
    "usage": {
      "inputTokens": 14300,
      "outputTokens": 2410,
      "durationMs": 0,
      "costUsd": 0
    },
    "isGold": false,
    "createdAt": "2026-09-15"
  },
  {
    "annotationId": "an-05",
    "work": {
      "id": "w09",
      "type": "film",
      "title": "Паразиты",
      "year": 2019,
      "creators": [
        "Пон Джун-хо"
      ]
    },
    "status": "published",
    "tmdfVersion": "0.3.0",
    "provider": "packet",
    "model": "пакет 2026-09-02",
    "modelTier": "heavy",
    "overallConfidence": "high",
    "lowConfidenceFields": [],
    "validationErrors": [],
    "knowledgeSufficiency": "sufficient",
    "usage": {
      "inputTokens": 15980,
      "outputTokens": 2650,
      "durationMs": 0,
      "costUsd": 0
    },
    "isGold": false,
    "createdAt": "2026-09-03"
  },
  {
    "annotationId": "an-06",
    "work": {
      "id": "w12",
      "type": "book",
      "title": "Имя розы",
      "year": 1980,
      "creators": [
        "Умберто Эко"
      ]
    },
    "status": "queued",
    "tmdfVersion": "0.3.1",
    "provider": "local",
    "model": "qwen2.5-32b",
    "modelTier": "standard",
    "overallConfidence": "medium",
    "lowConfidenceFields": [],
    "validationErrors": [],
    "knowledgeSufficiency": "partial",
    "usage": {
      "inputTokens": 0,
      "outputTokens": 0,
      "durationMs": 0,
      "costUsd": 0
    },
    "isGold": false,
    "createdAt": "2026-09-17"
  },
  {
    "annotationId": "an-07",
    "work": {
      "id": "w03",
      "type": "film",
      "title": "Помни",
      "year": 2000,
      "creators": [
        "Кристофер Нолан"
      ]
    },
    "status": "annotating",
    "tmdfVersion": "0.3.1",
    "provider": "local",
    "model": "qwen2.5-32b",
    "modelTier": "standard",
    "overallConfidence": "medium",
    "lowConfidenceFields": [],
    "validationErrors": [],
    "knowledgeSufficiency": "sufficient",
    "usage": {
      "inputTokens": 9100,
      "outputTokens": 1200,
      "durationMs": 12400,
      "costUsd": 0
    },
    "isGold": false,
    "createdAt": "2026-09-17"
  },
  {
    "annotationId": "an-08",
    "work": {
      "id": "w14",
      "type": "book",
      "title": "Шум и ярость",
      "year": 1929,
      "creators": [
        "Уильям Фолкнер"
      ]
    },
    "status": "rejected",
    "tmdfVersion": "0.3.0",
    "provider": "tvtropes",
    "model": "отображение 2026-08-30",
    "modelTier": "light",
    "overallConfidence": "low",
    "lowConfidenceFields": [
      "tropes[0].name"
    ],
    "validationErrors": [
      {
        "path": "tropes[0].tropePath",
        "message": "Нет соответствия в таксономии TMDF"
      }
    ],
    "knowledgeSufficiency": "partial",
    "usage": {
      "inputTokens": 0,
      "outputTokens": 0,
      "durationMs": 0,
      "costUsd": 0
    },
    "isGold": false,
    "createdAt": "2026-08-30"
  },
  {
    "annotationId": "an-09",
    "work": {
      "id": "w10",
      "type": "film",
      "title": "Синекдоха, Нью-Йорк",
      "year": 2008,
      "creators": [
        "Чарли Кауфман"
      ]
    },
    "status": "needs_review",
    "tmdfVersion": "0.3.1",
    "provider": "expert_consensus",
    "model": "эксперты, 4 ответа",
    "modelTier": "light",
    "overallConfidence": "medium",
    "lowConfidenceFields": [
      "cognitive_operations.metacognition.demand"
    ],
    "validationErrors": [],
    "knowledgeSufficiency": "sufficient",
    "usage": {
      "inputTokens": 0,
      "outputTokens": 0,
      "durationMs": 0,
      "costUsd": 0
    },
    "isGold": false,
    "createdAt": "2026-09-14"
  }
];

export const agreement: AgreementReport[] = [
  {
    "field": "tropes.category",
    "raterGroup": "experts",
    "raters": 6,
    "alpha": 0.81,
    "status": "reliable"
  },
  {
    "field": "tropes.category",
    "raterGroup": "community",
    "raters": 19,
    "alpha": 0.74,
    "status": "reliable"
  },
  {
    "field": "tropes.usage",
    "raterGroup": "experts",
    "raters": 6,
    "alpha": 0.68,
    "status": "tentative"
  },
  {
    "field": "cognitive_operations.perspective_taking.demand",
    "raterGroup": "experts",
    "raters": 5,
    "alpha": 0.72,
    "status": "reliable"
  },
  {
    "field": "cognitive_operations.perspective_taking.demand",
    "raterGroup": "community",
    "raters": 17,
    "alpha": 0.61,
    "status": "tentative"
  },
  {
    "field": "cognitive_operations.metacognition.demand",
    "raterGroup": "experts",
    "raters": 5,
    "alpha": 0.44,
    "status": "unreliable"
  },
  {
    "field": "cognitive_operations.metacognition.demand",
    "raterGroup": "community",
    "raters": 14,
    "alpha": 0.22,
    "status": "unreliable"
  },
  {
    "field": "barriers.pace",
    "raterGroup": "all",
    "raters": 23,
    "alpha": 0.77,
    "status": "reliable"
  }
];

export const contributors: ContributorProfile[] = [
  {
    "id": "c1",
    "displayName": "Марк Лаврентьев",
    "role": "expert",
    "bio": "Автор видеоэссе о кино",
    "links": [
      {
        "label": "Канал",
        "url": "https://example.com/lavrentiev"
      }
    ],
    "creditConsent": "public_name",
    "contribution": {
      "tasksCompleted": 34,
      "worksCovered": 9,
      "scalesRefined": [
        "Смотреть чужими глазами",
        "Барьеры: темп"
      ]
    }
  },
  {
    "id": "c2",
    "displayName": "Ника",
    "role": "community",
    "links": [
      {
        "label": "Телеграм",
        "url": "https://example.com/nika"
      }
    ],
    "creditConsent": "public_name",
    "contribution": {
      "tasksCompleted": 58,
      "worksCovered": 21,
      "scalesRefined": [
        "Тропы: способ использования"
      ]
    }
  },
  {
    "id": "c3",
    "displayName": "Участник без имени",
    "role": "community",
    "links": [],
    "creditConsent": "anonymous",
    "contribution": {
      "tasksCompleted": 12,
      "worksCovered": 7,
      "scalesRefined": [
        "Барьеры: нелинейное время"
      ]
    }
  }
];

export const contributorTasks: ContributorTask[] = [
  {
    "id": "ct1",
    "kind": "pairwise",
    "instructions": "Сравните два произведения по одному умению.",
    "estimatedSeconds": 25,
    "payload": {
      "kind": "pairwise",
      "op": "perspective_taking",
      "dimension": "demand",
      "question": "Где сильнее приходится смотреть чужими глазами?",
      "left": {
        "id": "w02",
        "type": "film",
        "title": "Расёмон",
        "originalTitle": "Rashômon",
        "year": 1950,
        "creators": [
          "Акира Куросава"
        ],
        "countries": [
          "Япония"
        ],
        "durationMinutes": 88,
        "primaryOperations": [
          {
            "op": "perspective_taking",
            "intensity": 0.95
          },
          {
            "op": "critical_analysis",
            "intensity": 0.7
          },
          {
            "op": "metacognition",
            "intensity": 0.5
          }
        ],
        "complexityLevel": 5,
        "warnings": [],
        "barriers": [
          "Условная актёрская манера"
        ],
        "isNicheMasterpiece": false
      },
      "right": {
        "id": "w04",
        "type": "film",
        "title": "Прибытие",
        "originalTitle": "Arrival",
        "year": 2016,
        "creators": [
          "Дени Вильнёв"
        ],
        "countries": [
          "США"
        ],
        "durationMinutes": 116,
        "primaryOperations": [
          {
            "op": "perspective_taking",
            "intensity": 0.8
          },
          {
            "op": "analogical_thinking",
            "intensity": 0.7
          },
          {
            "op": "synthesis",
            "intensity": 0.6
          }
        ],
        "complexityLevel": 5,
        "warnings": [],
        "barriers": [],
        "isNicheMasterpiece": false
      }
    }
  },
  {
    "id": "ct2",
    "kind": "trope_check",
    "instructions": "Отметьте, какие приёмы действительно есть в произведении.",
    "estimatedSeconds": 50,
    "payload": {
      "kind": "trope_check",
      "work": {
        "id": "w03",
        "type": "film",
        "title": "Помни",
        "originalTitle": "Memento",
        "year": 2000,
        "creators": [
          "Кристофер Нолан"
        ],
        "countries": [
          "США"
        ],
        "durationMinutes": 113,
        "primaryOperations": [
          {
            "op": "causal_reasoning",
            "intensity": 0.9
          },
          {
            "op": "pattern_recognition",
            "intensity": 0.7
          },
          {
            "op": "metacognition",
            "intensity": 0.6
          }
        ],
        "complexityLevel": 6,
        "warnings": [],
        "barriers": [
          "Нелинейное время"
        ],
        "isNicheMasterpiece": false
      },
      "candidates": [
        {
          "tropeId": "tc1",
          "name": "Ненадёжный рассказчик",
          "definition": "Рассказчику нельзя верить, и произведение даёт это понять."
        },
        {
          "tropeId": "tc2",
          "name": "Обратная хронология",
          "definition": "События показаны в порядке, обратном произошедшему."
        },
        {
          "tropeId": "tc3",
          "name": "Память как улика",
          "definition": "Записи и предметы заменяют героям память."
        },
        {
          "tropeId": "tc4",
          "name": "Двойник",
          "definition": "Персонаж встречает свою зеркальную версию."
        },
        {
          "tropeId": "tc5",
          "name": "Кольцевая композиция",
          "definition": "Финал возвращает к начальной сцене."
        }
      ]
    }
  },
  {
    "id": "ct3",
    "kind": "barrier_vote",
    "instructions": "Насколько заметны эти барьеры?",
    "estimatedSeconds": 35,
    "payload": {
      "kind": "barrier_vote",
      "work": {
        "id": "w07",
        "type": "film",
        "title": "Зеркало",
        "year": 1975,
        "creators": [
          "Андрей Тарковский"
        ],
        "countries": [
          "СССР"
        ],
        "durationMinutes": 108,
        "primaryOperations": [
          {
            "op": "synthesis",
            "intensity": 0.95
          },
          {
            "op": "abstraction",
            "intensity": 0.8
          },
          {
            "op": "metacognition",
            "intensity": 0.7
          }
        ],
        "complexityLevel": 9,
        "warnings": [],
        "barriers": [
          "Фрагментарная структура",
          "Медленный темп"
        ],
        "isNicheMasterpiece": true
      },
      "barriers": [
        {
          "kind": "pace",
          "label": "Медленный темп"
        },
        {
          "kind": "structure",
          "label": "Фрагментарная структура"
        },
        {
          "kind": "context",
          "label": "Исторический контекст"
        }
      ]
    }
  },
  {
    "id": "ct4",
    "kind": "mechanism_note",
    "instructions": "Коротко: как это устроено?",
    "estimatedSeconds": 60,
    "payload": {
      "kind": "mechanism_note",
      "work": {
        "id": "w15",
        "type": "book",
        "title": "Бледный огонь",
        "originalTitle": "Pale Fire",
        "year": 1962,
        "creators": [
          "Владимир Набоков"
        ],
        "countries": [
          "США"
        ],
        "pages": 288,
        "primaryOperations": [
          {
            "op": "metacognition",
            "intensity": 0.9
          },
          {
            "op": "critical_analysis",
            "intensity": 0.9
          },
          {
            "op": "pattern_recognition",
            "intensity": 0.8
          }
        ],
        "complexityLevel": 9,
        "warnings": [],
        "barriers": [
          "Комментарий вместо сюжета"
        ],
        "isNicheMasterpiece": true
      },
      "op": "metacognition",
      "prompt": "Что именно в устройстве книги заставляет читателя следить за собственным чтением?"
    }
  },
  {
    "id": "ct5",
    "kind": "desire_check",
    "instructions": "Модель предположила, чего герои хотят на самом деле. Согласны?",
    "estimatedSeconds": 45,
    "payload": {
      "kind": "desire_check",
      "work": works.w02,
      "candidates": [
        { "character": "Тадзёмару", "explicit": "Признаться в убийстве — как в подвиге.",
          "suppressed": "Быть грозным разбойником, а не жалким.", "visibility": 2, "spoilerLevel": 1, "confidence": "medium" },
        { "character": "Жена самурая", "explicit": "Рассказать, как стала жертвой.",
          "suppressed": "Не оказаться той, кто подтолкнул к убийству.", "visibility": 2, "spoilerLevel": 2, "confidence": "medium" },
        { "character": "Дровосек", "explicit": "Быть сторонним свидетелем.",
          "suppressed": "Скрыть, что унёс кинжал.", "visibility": 1, "spoilerLevel": 2, "confidence": "high" }
      ]
    }
  }
];

export const packetReport: PacketReport = {
  "packetId": "pk-2026-09-14",
  "works": 5,
  "layers": [
    "tropes",
    "operations"
  ],
  "files": 10,
  "passed": 8,
  "failed": 2,
  "rows": [
    {
      "file": "w02.tropes.json",
      "status": "ok",
      "note": "в ревью"
    },
    {
      "file": "w02.operations.json",
      "status": "ok",
      "note": "в ревью"
    },
    {
      "file": "w13.tropes.json",
      "status": "ok",
      "note": "в ревью"
    },
    {
      "file": "w13.operations.json",
      "status": "fail",
      "note": "operations: сумма activation вне 0..1"
    },
    {
      "file": "w09.tropes.json",
      "status": "ok",
      "note": "опубликовано"
    },
    {
      "file": "w09.operations.json",
      "status": "ok",
      "note": "опубликовано"
    },
    {
      "file": "w12.tropes.json",
      "status": "fail",
      "note": "tropePath: уровень Atomic не найден"
    },
    {
      "file": "w12.operations.json",
      "status": "ok",
      "note": "в ревью"
    },
    {
      "file": "w03.tropes.json",
      "status": "ok",
      "note": "в ревью"
    },
    {
      "file": "w03.operations.json",
      "status": "ok",
      "note": "в ревью"
    }
  ]
};

export const settings: UserSettings = {
  // норма участника по его собственным словам (22.09): семёрка — «остался базово
  // удовлетворён, не жалею о потраченном времени». Его медиана по выгрузке — восьмёрка,
  // так что угадывание тут ошибается: норму надо спрашивать.
  "ratingNorm": 7,
  "language": "ru",
  "mediaTypes": [
    "film",
    "book"
  ],
  "spoilerLevel": 0,
  "excludedWarnings": [],
  "showDetails": false,
  "researchConsent": true,
  "theme": "system"
};

export const explanations: Record<string, RecommendationExplanation> = {
  "w02": {
    "what": "Одно преступление в пересказе четырёх свидетелей, и версии не сходятся.",
    "why": "Вы уверенно выстраиваете причинно-следственные цепочки — здесь эта сила встретит событие, у которого нет одной правильной цепочки.",
    "whyNow": "«Двенадцать разгневанных мужчин» показали, как мнение меняется под новым углом. «Расёмон» делает следующий ход: угол зрения меняет сам факт.",
    "whatNext": "«Прибытие» — там перспектива затрагивает восприятие времени."
  },
  "w12": {
    "what": "Детективная структура, в которой расследуется и сам способ толковать знаки.",
    "why": "Вы хорошо замечаете повторы — роман даёт им объём: знак здесь может значить не то, чем кажется.",
    "whyNow": "После «Расёмона» проверка версий перестаёт быть механикой сюжета и становится темой.",
    "whatNext": "Отсюда открывается «Бледный огонь» — комментарий, который спорит со своим текстом."
  },
  "w13": {
    "what": "Книга без привычного сюжета: пятьдесят пять городов, каждый — модель одной мысли.",
    "why": "Вы ещё не встречали повествование, построенное как набор вариаций, — это не случайный выбор, а недостающая форма.",
    "whyNow": "Короткие главы позволяют попробовать непривычное устройство без большого вложения времени.",
    "whatNext": "Дальше — «Зеркало», где вариации собираются в одну жизнь."
  },
  "w03": {
    "what": "Человек без короткой памяти восстанавливает события по запискам — а фильм идёт в обратном порядке.",
    "why": "Опирается на вашу сильную сторону — причинные цепочки, но собранные наоборот.",
    "whyNow": "Сегодня вы выбрали «полегче»: здесь усилие уходит в структуру, а не в темп.",
    "whatNext": "Первый шаг к «Бледному огню»: рассказчик, которому нельзя верить."
  }
};

export const discussions: DiscussionPlace[] = [
  {
    "id": "d1",
    "workId": "w02",
    "kind": "telegram_channel",
    "title": "Разбор Марка Лаврентьева",
    "why": "разбирает, почему четыре версии не складываются в одну — и почему это не приём, а тема",
    "url": "https://example.com/t/lavrentiev/412",
    "lastTalkedAt": "12 сентября",
    "language": "ru",
    "spoilers": true,
    "curatedBy": "Марка"
  },
  {
    "id": "d2",
    "workId": "w02",
    "kind": "telegram_chat",
    "title": "Чат «Смотрим внимательно»",
    "why": "спорят, чья версия правдива, и каждый раз приходят к разному",
    "url": "https://example.com/t/watchclose/8891",
    "lastTalkedAt": "3 сентября",
    "language": "ru",
    "spoilers": true
  },
  {
    "id": "d3",
    "workId": "w02",
    "kind": "comments",
    "title": "Комментарии под видеоэссе Ники",
    "why": "короткая ветка о том, что делает с фильмом финальная сцена у ворот",
    "url": "https://example.com/t/nika/77",
    "lastTalkedAt": "28 августа",
    "language": "ru",
    "spoilers": true
  },
  {
    "id": "d4",
    "workId": "w07",
    "kind": "telegram_chat",
    "title": "Чат «Тарковский по кадрам»",
    "why": "идут по фильму сценами, есть отдельная ветка про сон с молоком",
    "url": "https://example.com/t/tarkovsky/1204",
    "lastTalkedAt": "9 сентября",
    "language": "ru",
    "spoilers": true
  }
];
