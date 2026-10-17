import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";

/**
 * `/fixtures?id=1556543` — Beşiktaş 1-0 FC Midtjylland (UEFA Avrupa Ligi, 2. Ön Eleme Turu, 2026-07-23).
 * Gerçek yanıttan kırpılmıştır (olaylarda gol + kart, dizilişte forma rengi + ilk 11). API-Football bu maçta
 * kart dışında hiçbir istatistik vermiyor ve oyuncu bloğu boş — Sportmonks'a düşme yolunu test eder.
 */
export const RAW_BESIKTAS_MIDTJYLLAND: ApiFootballFixtureResultRaw = {
  "fixture": {
    "id": 1556543,
    "date": "2026-07-23T18:00:00+00:00",
    "timestamp": 1784829600,
    "status": {
      "long": "Match Finished",
      "short": "FT",
      "elapsed": 90
    },
    "referee": "Ricardo De Burgos Bengoetxea, Spain",
    "venue": {
      "name": "Tüpraş Stadyumu",
      "city": "Istanbul"
    }
  },
  "league": {
    "id": 3,
    "name": "UEFA Europa League",
    "country": "World",
    "season": 2026,
    "round": "2nd Qualifying Round",
    "logo": "https://media.api-sports.io/football/leagues/3.png"
  },
  "teams": {
    "home": {
      "id": 549,
      "name": "Beşiktaş",
      "logo": "https://media.api-sports.io/football/teams/549.png",
      "winner": true
    },
    "away": {
      "id": 397,
      "name": "FC Midtjylland",
      "logo": "https://media.api-sports.io/football/teams/397.png",
      "winner": false
    }
  },
  "goals": {
    "home": 1,
    "away": 0
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
        "elapsed": 15,
        "extra": null
      },
      "team": {
        "id": 397
      },
      "player": {
        "id": 351146,
        "name": "Friday Etim"
      },
      "type": "Card",
      "detail": "Red Card",
      "comments": null
    },
    {
      "time": {
        "elapsed": 26,
        "extra": null
      },
      "team": {
        "id": 549
      },
      "player": {
        "id": 37155,
        "name": "O. Kokcu"
      },
      "type": "Goal",
      "detail": "Normal Goal",
      "comments": null
    }
  ],
  "statistics": [
    {
      "team": {
        "id": 549
      },
      "statistics": [
        {
          "type": "Shots on Goal",
          "value": null
        },
        {
          "type": "Shots off Goal",
          "value": null
        },
        {
          "type": "Total Shots",
          "value": null
        },
        {
          "type": "Blocked Shots",
          "value": null
        },
        {
          "type": "Shots insidebox",
          "value": null
        },
        {
          "type": "Shots outsidebox",
          "value": null
        },
        {
          "type": "Fouls",
          "value": null
        },
        {
          "type": "Corner Kicks",
          "value": null
        },
        {
          "type": "Offsides",
          "value": null
        },
        {
          "type": "Ball Possession",
          "value": null
        },
        {
          "type": "Yellow Cards",
          "value": 0
        },
        {
          "type": "Red Cards",
          "value": 0
        },
        {
          "type": "Goalkeeper Saves",
          "value": null
        },
        {
          "type": "Total passes",
          "value": null
        },
        {
          "type": "Passes accurate",
          "value": null
        },
        {
          "type": "Passes %",
          "value": null
        },
        {
          "type": "expected_goals",
          "value": null
        },
        {
          "type": "goals_prevented",
          "value": null
        }
      ]
    },
    {
      "team": {
        "id": 397
      },
      "statistics": [
        {
          "type": "Shots on Goal",
          "value": null
        },
        {
          "type": "Shots off Goal",
          "value": null
        },
        {
          "type": "Total Shots",
          "value": null
        },
        {
          "type": "Blocked Shots",
          "value": null
        },
        {
          "type": "Shots insidebox",
          "value": null
        },
        {
          "type": "Shots outsidebox",
          "value": null
        },
        {
          "type": "Fouls",
          "value": null
        },
        {
          "type": "Corner Kicks",
          "value": null
        },
        {
          "type": "Offsides",
          "value": null
        },
        {
          "type": "Ball Possession",
          "value": null
        },
        {
          "type": "Yellow Cards",
          "value": 0
        },
        {
          "type": "Red Cards",
          "value": 1
        },
        {
          "type": "Goalkeeper Saves",
          "value": null
        },
        {
          "type": "Total passes",
          "value": null
        },
        {
          "type": "Passes accurate",
          "value": null
        },
        {
          "type": "Passes %",
          "value": null
        },
        {
          "type": "expected_goals",
          "value": null
        },
        {
          "type": "goals_prevented",
          "value": null
        }
      ]
    }
  ],
  "players": [],
  "lineups": [
    {
      "team": {
        "id": 549,
        "colors": {
          "player": {
            "primary": "ffffff"
          }
        }
      },
      "formation": "4-1-4-1",
      "startXI": [
        {
          "player": {
            "id": 399,
            "name": "A. Nubel",
            "number": 1,
            "grid": "1:1"
          }
        },
        {
          "player": {
            "id": 2973,
            "name": "M. Murillo",
            "number": 62,
            "grid": "2:4"
          }
        },
        {
          "player": {
            "id": 1479,
            "name": "T. Djalo",
            "number": 35,
            "grid": "2:3"
          }
        },
        {
          "player": {
            "id": 50046,
            "name": "E. Topcu",
            "number": 53,
            "grid": "2:2"
          }
        },
        {
          "player": {
            "id": 1987,
            "name": "R. Yilmaz",
            "number": 33,
            "grid": "2:1"
          }
        },
        {
          "player": {
            "id": 24807,
            "name": "S. Ozcan",
            "number": 6,
            "grid": "3:1"
          }
        },
        {
          "player": {
            "id": 549,
            "name": "V. Cerny",
            "number": 18,
            "grid": "4:4"
          }
        },
        {
          "player": {
            "id": 316904,
            "name": "J. Olaitan",
            "number": 15,
            "grid": "4:3"
          }
        },
        {
          "player": {
            "id": 37155,
            "name": "O. Kokcu",
            "number": 10,
            "grid": "4:2"
          }
        },
        {
          "player": {
            "id": 446824,
            "name": "I. Fakili",
            "number": 29,
            "grid": "4:1"
          }
        },
        {
          "player": {
            "id": 34710,
            "name": "Oh Hyeon-Gyu",
            "number": 9,
            "grid": "5:1"
          }
        }
      ]
    },
    {
      "team": {
        "id": 397,
        "colors": {
          "player": {
            "primary": "000000"
          }
        }
      },
      "formation": "4-3-3",
      "startXI": [
        {
          "player": {
            "id": 89754,
            "name": "E. Olafsson",
            "number": 1,
            "grid": "1:1"
          }
        },
        {
          "player": {
            "id": 533,
            "name": "R. Kristensen",
            "number": 5,
            "grid": "2:4"
          }
        },
        {
          "player": {
            "id": 237218,
            "name": "Lee Han-Beom",
            "number": 3,
            "grid": "2:3"
          }
        },
        {
          "player": {
            "id": 19345,
            "name": "M. B. Sorensen",
            "number": 22,
            "grid": "2:2"
          }
        },
        {
          "player": {
            "id": 162218,
            "name": "V. Bak",
            "number": 55,
            "grid": "2:1"
          }
        },
        {
          "player": {
            "id": 2734,
            "name": "P. Billing",
            "number": 8,
            "grid": "3:3"
          }
        },
        {
          "player": {
            "id": 311432,
            "name": "P. Bravo",
            "number": 19,
            "grid": "3:2"
          }
        },
        {
          "player": {
            "id": 371909,
            "name": "V. Byskov",
            "number": 20,
            "grid": "3:1"
          }
        },
        {
          "player": {
            "id": 307117,
            "name": "D. Osorio",
            "number": 11,
            "grid": "4:3"
          }
        },
        {
          "player": {
            "id": 351146,
            "name": "F. Etim",
            "number": 90,
            "grid": "4:2"
          }
        },
        {
          "player": {
            "id": 340625,
            "name": "Franculino",
            "number": 7,
            "grid": "4:1"
          }
        }
      ]
    }
  ]
};
