import type { ApiFootballHalfTeamStatisticsRaw } from "@/lib/services/api-football/half-stats-types";
import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import type { SportmonksPeriodRaw } from "@/lib/services/sportmonks/period-stats-mappers";

/**
 * Konyaspor 0-4 Galatasaray (Trendyol Süper Lig, 10. hafta, 2026-10-30) — gerçek yanıtlardan kırpılmıştır:
 * `/fixtures?id=1584455` (olaylar; istatistik/oyuncu/diziliş blokları boş), `/fixtures/statistics?half=true`
 * (yalnızca devre blokları) ve Sportmonks `/fixtures/19746568?include=periods.statistics.type` (02 satırlarının
 * tipleri; katılımcı 2632 = Konyaspor, 34 = Galatasaray).
 */
export const RAW_KONYASPOR_GALATASARAY: ApiFootballFixtureResultRaw = {
  "fixture": {
    "id": 1584455,
    "date": "2026-10-30T17:00:00+00:00",
    "timestamp": 1793379600,
    "status": {
      "long": "Match Finished",
      "short": "FT",
      "elapsed": 90
    },
    "referee": "Cihan Aydin, Türkiye",
    "venue": {
      "name": "Medas Konya Büyüksehir Belediyesi Stadium",
      "city": "Konya"
    }
  },
  "league": {
    "id": 203,
    "name": "Süper Lig",
    "country": "Turkey",
    "season": 2026,
    "round": "Regular Season - 10",
    "logo": "https://media.api-sports.io/football/leagues/203.png"
  },
  "teams": {
    "home": {
      "id": 607,
      "name": "Konyaspor",
      "logo": "https://media.api-sports.io/football/teams/607.png",
      "winner": false
    },
    "away": {
      "id": 645,
      "name": "Galatasaray",
      "logo": "https://media.api-sports.io/football/teams/645.png",
      "winner": true
    }
  },
  "goals": {
    "home": 0,
    "away": 4
  },
  "score": {
    "penalty": {
      "home": null,
      "away": null
    }
  },
  "events": [
    {
      "time": {
        "elapsed": 12,
        "extra": null
      },
      "team": {
        "id": 645
      },
      "player": {
        "id": 2780,
        "name": "V. Osimhen"
      },
      "assist": {
        "id": 80552,
        "name": "Gabriel Sara"
      },
      "type": "Goal",
      "detail": "Normal Goal",
      "comments": null
    },
    {
      "time": {
        "elapsed": 28,
        "extra": null
      },
      "team": {
        "id": 645
      },
      "player": {
        "id": 454,
        "name": "Y. Akgun"
      },
      "assist": {
        "id": 401073,
        "name": "A. Batrakov"
      },
      "type": "Goal",
      "detail": "Normal Goal",
      "comments": null
    },
    {
      "time": {
        "elapsed": 31,
        "extra": null
      },
      "team": {
        "id": 645
      },
      "player": {
        "id": 80552,
        "name": "Gabriel Sara"
      },
      "assist": {
        "id": null,
        "name": null
      },
      "type": "Card",
      "detail": "Yellow Card",
      "comments": "Tripping"
    },
    {
      "time": {
        "elapsed": 40,
        "extra": null
      },
      "team": {
        "id": 607
      },
      "player": {
        "id": 194689,
        "name": "B. Gungordu"
      },
      "assist": {
        "id": 402493,
        "name": "D. Ertas"
      },
      "type": "subst",
      "detail": "Substitution 1",
      "comments": null
    },
    {
      "time": {
        "elapsed": 45,
        "extra": 6
      },
      "team": {
        "id": 607
      },
      "player": {
        "id": 50126,
        "name": "D. Turuc"
      },
      "assist": {
        "id": null,
        "name": null
      },
      "type": "Card",
      "detail": "Yellow Card",
      "comments": "misses next match"
    },
    {
      "time": {
        "elapsed": 46,
        "extra": null
      },
      "team": {
        "id": 607
      },
      "player": {
        "id": 419517,
        "name": "R. Toth"
      },
      "assist": {
        "id": 47461,
        "name": "E. Bardhi"
      },
      "type": "subst",
      "detail": "Substitution 2",
      "comments": null
    },
    {
      "time": {
        "elapsed": 46,
        "extra": null
      },
      "team": {
        "id": 607
      },
      "player": {
        "id": 144656,
        "name": "J. Muleka"
      },
      "assist": {
        "id": 2668,
        "name": "Mostafa Mohamed"
      },
      "type": "subst",
      "detail": "Substitution 3",
      "comments": null
    },
    {
      "time": {
        "elapsed": 49,
        "extra": null
      },
      "team": {
        "id": 645
      },
      "player": {
        "id": 401073,
        "name": "A. Batrakov"
      },
      "assist": {
        "id": 80552,
        "name": "Gabriel Sara"
      },
      "type": "Goal",
      "detail": "Normal Goal",
      "comments": null
    },
    {
      "time": {
        "elapsed": 55,
        "extra": null
      },
      "team": {
        "id": 645
      },
      "player": {
        "id": 22236,
        "name": "R. Leao"
      },
      "assist": {
        "id": null,
        "name": null
      },
      "type": "Goal",
      "detail": "Penalty",
      "comments": null
    },
    {
      "time": {
        "elapsed": 56,
        "extra": null
      },
      "team": {
        "id": 607
      },
      "player": {
        "id": 47512,
        "name": "Y. Andzouana"
      },
      "assist": {
        "id": 50063,
        "name": "U. Yazgili"
      },
      "type": "subst",
      "detail": "Substitution 4",
      "comments": null
    },
    {
      "time": {
        "elapsed": 61,
        "extra": null
      },
      "team": {
        "id": 645
      },
      "player": {
        "id": 454,
        "name": "Y. Akgun"
      },
      "assist": {
        "id": 644,
        "name": "L. Sane"
      },
      "type": "subst",
      "detail": "Substitution 1",
      "comments": null
    },
    {
      "time": {
        "elapsed": 61,
        "extra": null
      },
      "team": {
        "id": 645
      },
      "player": {
        "id": 401073,
        "name": "A. Batrakov"
      },
      "assist": {
        "id": 633,
        "name": "I. Gundogan"
      },
      "type": "subst",
      "detail": "Substitution 2",
      "comments": null
    },
    {
      "time": {
        "elapsed": 61,
        "extra": null
      },
      "team": {
        "id": 645
      },
      "player": {
        "id": 2780,
        "name": "V. Osimhen"
      },
      "assist": {
        "id": 388570,
        "name": "D. Gul"
      },
      "type": "subst",
      "detail": "Substitution 3",
      "comments": null
    },
    {
      "time": {
        "elapsed": 61,
        "extra": null
      },
      "team": {
        "id": 645
      },
      "player": {
        "id": 1462,
        "name": "L. Torreira"
      },
      "assist": {
        "id": 270508,
        "name": "L. Ugochukwu"
      },
      "type": "subst",
      "detail": "Substitution 4",
      "comments": null
    },
    {
      "time": {
        "elapsed": 61,
        "extra": null
      },
      "team": {
        "id": 645
      },
      "player": {
        "id": 80552,
        "name": "Gabriel Sara"
      },
      "assist": {
        "id": 518567,
        "name": "R. Nhaga"
      },
      "type": "subst",
      "detail": "Substitution 5",
      "comments": null
    },
    {
      "time": {
        "elapsed": 69,
        "extra": null
      },
      "team": {
        "id": 645
      },
      "player": {
        "id": 168,
        "name": "D. Sanchez"
      },
      "assist": {
        "id": 268571,
        "name": "E. Bitshiabu"
      },
      "type": "subst",
      "detail": "Substitution 6",
      "comments": null
    },
    {
      "time": {
        "elapsed": 71,
        "extra": null
      },
      "team": {
        "id": 607
      },
      "player": {
        "id": 8483,
        "name": "J. Dompe"
      },
      "assist": {
        "id": 140847,
        "name": "E. Colley"
      },
      "type": "subst",
      "detail": "Substitution 5",
      "comments": null
    },
    {
      "time": {
        "elapsed": 82,
        "extra": null
      },
      "team": {
        "id": 607
      },
      "player": {
        "id": 152845,
        "name": "M. Ibrahimoglu"
      },
      "assist": {
        "id": 182422,
        "name": "E. Destan"
      },
      "type": "subst",
      "detail": "Substitution 6",
      "comments": null
    },
    {
      "time": {
        "elapsed": 90,
        "extra": null
      },
      "team": {
        "id": 607
      },
      "player": {
        "id": 50008,
        "name": "M. Jevtovic"
      },
      "assist": {
        "id": null,
        "name": null
      },
      "type": "Card",
      "detail": "Yellow Card",
      "comments": "Holding"
    }
  ],
  "statistics": [],
  "players": [],
  "lineups": []
};

export const HALF_KONYASPOR_GALATASARAY: ApiFootballHalfTeamStatisticsRaw[] = [
  {
    "team": {
      "id": 607
    },
    "statistics": [],
    "statistics_1h": [
      {
        "type": "Shots on Goal",
        "value": 1
      },
      {
        "type": "Shots off Goal",
        "value": 3
      },
      {
        "type": "Total Shots",
        "value": 5
      },
      {
        "type": "Blocked Shots",
        "value": 1
      },
      {
        "type": "Shots insidebox",
        "value": 3
      },
      {
        "type": "Shots outsidebox",
        "value": 2
      },
      {
        "type": "Fouls",
        "value": null
      },
      {
        "type": "Corner Kicks",
        "value": 3
      },
      {
        "type": "Offsides",
        "value": 0
      },
      {
        "type": "Ball Possession",
        "value": "47%"
      },
      {
        "type": "Yellow Cards",
        "value": 1
      },
      {
        "type": "Red Cards",
        "value": null
      },
      {
        "type": "Goalkeeper Saves",
        "value": 2
      },
      {
        "type": "Total passes",
        "value": 182
      },
      {
        "type": "Passes accurate",
        "value": 152
      },
      {
        "type": "Passes %",
        "value": "84%"
      },
      {
        "type": "expected_goals",
        "value": "1.01"
      },
      {
        "type": "goals_prevented",
        "value": null
      }
    ],
    "statistics_2h": [
      {
        "type": "Shots on Goal",
        "value": 0
      },
      {
        "type": "Shots off Goal",
        "value": 2
      },
      {
        "type": "Total Shots",
        "value": 2
      },
      {
        "type": "Blocked Shots",
        "value": 0
      },
      {
        "type": "Shots insidebox",
        "value": 0
      },
      {
        "type": "Shots outsidebox",
        "value": 2
      },
      {
        "type": "Fouls",
        "value": null
      },
      {
        "type": "Corner Kicks",
        "value": 0
      },
      {
        "type": "Offsides",
        "value": 2
      },
      {
        "type": "Ball Possession",
        "value": "46%"
      },
      {
        "type": "Yellow Cards",
        "value": 0
      },
      {
        "type": "Red Cards",
        "value": null
      },
      {
        "type": "Goalkeeper Saves",
        "value": 2
      },
      {
        "type": "Total passes",
        "value": 159
      },
      {
        "type": "Passes accurate",
        "value": 136
      },
      {
        "type": "Passes %",
        "value": "86%"
      },
      {
        "type": "expected_goals",
        "value": "0.18"
      },
      {
        "type": "goals_prevented",
        "value": null
      }
    ]
  },
  {
    "team": {
      "id": 645
    },
    "statistics": [],
    "statistics_1h": [
      {
        "type": "Shots on Goal",
        "value": 4
      },
      {
        "type": "Shots off Goal",
        "value": 4
      },
      {
        "type": "Total Shots",
        "value": 8
      },
      {
        "type": "Blocked Shots",
        "value": 0
      },
      {
        "type": "Shots insidebox",
        "value": 6
      },
      {
        "type": "Shots outsidebox",
        "value": 2
      },
      {
        "type": "Fouls",
        "value": null
      },
      {
        "type": "Corner Kicks",
        "value": 5
      },
      {
        "type": "Offsides",
        "value": 1
      },
      {
        "type": "Ball Possession",
        "value": "53%"
      },
      {
        "type": "Yellow Cards",
        "value": 1
      },
      {
        "type": "Red Cards",
        "value": null
      },
      {
        "type": "Goalkeeper Saves",
        "value": 2
      },
      {
        "type": "Total passes",
        "value": 210
      },
      {
        "type": "Passes accurate",
        "value": 185
      },
      {
        "type": "Passes %",
        "value": "88%"
      },
      {
        "type": "expected_goals",
        "value": "0.86"
      },
      {
        "type": "goals_prevented",
        "value": null
      }
    ],
    "statistics_2h": [
      {
        "type": "Shots on Goal",
        "value": 4
      },
      {
        "type": "Shots off Goal",
        "value": 2
      },
      {
        "type": "Total Shots",
        "value": 6
      },
      {
        "type": "Blocked Shots",
        "value": 0
      },
      {
        "type": "Shots insidebox",
        "value": 6
      },
      {
        "type": "Shots outsidebox",
        "value": 0
      },
      {
        "type": "Fouls",
        "value": null
      },
      {
        "type": "Corner Kicks",
        "value": 3
      },
      {
        "type": "Offsides",
        "value": 1
      },
      {
        "type": "Ball Possession",
        "value": "54%"
      },
      {
        "type": "Yellow Cards",
        "value": 0
      },
      {
        "type": "Red Cards",
        "value": null
      },
      {
        "type": "Goalkeeper Saves",
        "value": 0
      },
      {
        "type": "Total passes",
        "value": 188
      },
      {
        "type": "Passes accurate",
        "value": 174
      },
      {
        "type": "Passes %",
        "value": "93%"
      },
      {
        "type": "expected_goals",
        "value": "1.67"
      },
      {
        "type": "goals_prevented",
        "value": null
      }
    ]
  }
];

export const SM_KONYASPOR_GALATASARAY_IDS = { home: 2632, away: 34 } as const;

export const SM_PERIODS_KONYASPOR_GALATASARAY: SportmonksPeriodRaw[] = [
  {
    "type_id": 1,
    "description": "1st-half",
    "statistics": [
      {
        "participant_id": 34,
        "type": {
          "developer_name": "SHOTS_TOTAL"
        },
        "data": {
          "value": 8
        }
      },
      {
        "participant_id": 2632,
        "type": {
          "developer_name": "SHOTS_TOTAL"
        },
        "data": {
          "value": 5
        }
      },
      {
        "participant_id": 34,
        "type": {
          "developer_name": "CORNERS"
        },
        "data": {
          "value": 5
        }
      },
      {
        "participant_id": 2632,
        "type": {
          "developer_name": "BALL_POSSESSION"
        },
        "data": {
          "value": 47
        }
      },
      {
        "participant_id": 34,
        "type": {
          "developer_name": "BALL_POSSESSION"
        },
        "data": {
          "value": 53
        }
      },
      {
        "participant_id": 2632,
        "type": {
          "developer_name": "CORNERS"
        },
        "data": {
          "value": 3
        }
      },
      {
        "participant_id": 2632,
        "type": {
          "developer_name": "SHOTS_ON_TARGET"
        },
        "data": {
          "value": 1
        }
      },
      {
        "participant_id": 34,
        "type": {
          "developer_name": "SHOTS_ON_TARGET"
        },
        "data": {
          "value": 4
        }
      }
    ]
  },
  {
    "type_id": 2,
    "description": "2nd-half",
    "statistics": [
      {
        "participant_id": 34,
        "type": {
          "developer_name": "SHOTS_TOTAL"
        },
        "data": {
          "value": 8
        }
      },
      {
        "participant_id": 34,
        "type": {
          "developer_name": "CORNERS"
        },
        "data": {
          "value": 4
        }
      },
      {
        "participant_id": 34,
        "type": {
          "developer_name": "BALL_POSSESSION"
        },
        "data": {
          "value": 54
        }
      },
      {
        "participant_id": 2632,
        "type": {
          "developer_name": "BALL_POSSESSION"
        },
        "data": {
          "value": 46
        }
      },
      {
        "participant_id": 2632,
        "type": {
          "developer_name": "CORNERS"
        },
        "data": {
          "value": 0
        }
      },
      {
        "participant_id": 34,
        "type": {
          "developer_name": "SHOTS_ON_TARGET"
        },
        "data": {
          "value": 4
        }
      },
      {
        "participant_id": 2632,
        "type": {
          "developer_name": "SHOTS_ON_TARGET"
        },
        "data": {
          "value": 0
        }
      },
      {
        "participant_id": 2632,
        "type": {
          "developer_name": "SHOTS_TOTAL"
        },
        "data": {
          "value": 4
        }
      }
    ]
  }
];
