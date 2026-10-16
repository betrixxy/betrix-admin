import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";

/**
 * `/fixtures?id=1636268` — Hoffenheim 2-3 Beşiktaş (UEFA Avrupa Ligi, Lig Aşaması 2. maç, 2026-10-15).
 * Gerçek yanıttan kırpılmıştır: yalnızca Maç Sonucu eşleyicisinin okuduğu alanlar; olaylarda goller
 * + kartlar, oyuncularda takım başına en yüksek 4 rating.
 */
export const RAW_HOFFENHEIM_BESIKTAS: ApiFootballFixtureResultRaw = {
  "fixture": {
    "id": 1636268,
    "date": "2026-10-15T19:00:00+00:00",
    "timestamp": 1792090800,
    "status": {
      "long": "Match Finished",
      "short": "FT",
      "elapsed": 90
    },
    "referee": "Lawrence Visser",
    "venue": {
      "name": "Prezero Arena",
      "city": "Sinsheim"
    }
  },
  "league": {
    "id": 3,
    "name": "UEFA Europa League",
    "country": "World",
    "season": 2026,
    "round": "League Stage - 2",
    "logo": "https://media.api-sports.io/football/leagues/3.png"
  },
  "teams": {
    "home": {
      "id": 167,
      "name": "1899 Hoffenheim",
      "logo": "https://media.api-sports.io/football/teams/167.png",
      "winner": false
    },
    "away": {
      "id": 549,
      "name": "Beşiktaş",
      "logo": "https://media.api-sports.io/football/teams/549.png",
      "winner": true
    }
  },
  "goals": {
    "home": 2,
    "away": 3
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
        "elapsed": 23,
        "extra": null
      },
      "team": {
        "id": 167
      },
      "player": {
        "id": 202501,
        "name": "Fisnik Asllani"
      },
      "type": "Card",
      "detail": "Yellow Card",
      "comments": "Foul"
    },
    {
      "time": {
        "elapsed": 60,
        "extra": null
      },
      "team": {
        "id": 549
      },
      "player": {
        "id": 2973,
        "name": "Amir Murillo"
      },
      "type": "Goal",
      "detail": "Normal Goal",
      "comments": null
    },
    {
      "time": {
        "elapsed": 67,
        "extra": null
      },
      "team": {
        "id": 167
      },
      "player": {
        "id": 26300,
        "name": "Ozan Kabak"
      },
      "type": "Card",
      "detail": "Yellow Card",
      "comments": "Dissent"
    },
    {
      "time": {
        "elapsed": 68,
        "extra": null
      },
      "team": {
        "id": 167
      },
      "player": {
        "id": 202501,
        "name": "Fisnik Asllani"
      },
      "type": "Goal",
      "detail": "Normal Goal",
      "comments": null
    },
    {
      "time": {
        "elapsed": 72,
        "extra": null
      },
      "team": {
        "id": 549
      },
      "player": {
        "id": 34710,
        "name": "Oh Hyeon-gyu"
      },
      "type": "Goal",
      "detail": "Normal Goal",
      "comments": null
    },
    {
      "time": {
        "elapsed": 79,
        "extra": null
      },
      "team": {
        "id": 549
      },
      "player": {
        "id": 34710,
        "name": "Oh Hyeon-gyu"
      },
      "type": "Goal",
      "detail": "Normal Goal",
      "comments": null
    },
    {
      "time": {
        "elapsed": 80,
        "extra": null
      },
      "team": {
        "id": 549
      },
      "player": {
        "id": 34710,
        "name": "Oh Hyeon-gyu"
      },
      "type": "Card",
      "detail": "Yellow Card",
      "comments": null
    },
    {
      "time": {
        "elapsed": 87,
        "extra": null
      },
      "team": {
        "id": 167
      },
      "player": {
        "id": 33067,
        "name": "Koki Machida"
      },
      "type": "Goal",
      "detail": "Normal Goal",
      "comments": null
    },
    {
      "time": {
        "elapsed": 90,
        "extra": null
      },
      "team": {
        "id": 167
      },
      "player": {
        "id": 203040,
        "name": "Tim Lemperle"
      },
      "type": "Card",
      "detail": "Yellow Card",
      "comments": "Foul"
    }
  ],
  "lineups": [
    {
      "team": {
        "id": 167,
        "colors": null
      },
      "formation": "4-2-3-1"
    },
    {
      "team": {
        "id": 549,
        "colors": null
      },
      "formation": "4-2-3-1"
    }
  ],
  "statistics": [],
  "players": [
    {
      "team": {
        "id": 549
      },
      "players": [
        {
          "player": {
            "id": 34710,
            "name": "Oh Hyeon-Gyu"
          },
          "statistics": [
            {
              "games": {
                "rating": "9.41"
              },
              "goals": {
                "total": 2
              }
            }
          ]
        },
        {
          "player": {
            "id": 2973,
            "name": "A. Murillo"
          },
          "statistics": [
            {
              "games": {
                "rating": "7.75"
              },
              "goals": {
                "total": 1
              }
            }
          ]
        },
        {
          "player": {
            "id": 333137,
            "name": "K. Ouattara"
          },
          "statistics": [
            {
              "games": {
                "rating": "7.1"
              },
              "goals": {
                "total": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 446824,
            "name": "I. Fakili"
          },
          "statistics": [
            {
              "games": {
                "rating": "6.83"
              },
              "goals": {
                "total": 0
              }
            }
          ]
        }
      ]
    },
    {
      "team": {
        "id": 167
      },
      "players": [
        {
          "player": {
            "id": 202501,
            "name": "F. Asllani"
          },
          "statistics": [
            {
              "games": {
                "rating": "6.94"
              },
              "goals": {
                "total": 1
              }
            }
          ]
        },
        {
          "player": {
            "id": 33067,
            "name": "K. Machida"
          },
          "statistics": [
            {
              "games": {
                "rating": "6.91"
              },
              "goals": {
                "total": 1
              }
            }
          ]
        },
        {
          "player": {
            "id": 390586,
            "name": "L. Avdullahu"
          },
          "statistics": [
            {
              "games": {
                "rating": "6.63"
              },
              "goals": {
                "total": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 18964,
            "name": "Bernardo"
          },
          "statistics": [
            {
              "games": {
                "rating": "6.48"
              },
              "goals": {
                "total": 0
              }
            }
          ]
        }
      ]
    }
  ]
};
