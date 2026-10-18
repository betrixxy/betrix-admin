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

/**
 * `/fixtures?id=1584435` — Gençlerbirliği 0-1 Galatasaray (Süper Lig, 2026-10-17). Gerçek yanıttan
 * kırpılmıştır (yukarıdakiyle aynı kural; Eğribayat da oyuncu listesinde). Tek gol kendi kalesine:
 * API olayı KK'da `team` alanını GOLÜN YARADIĞI takımla (Galatasaray) verir, oyuncu ise Gençlerbirliği'nden.
 */
export const RAW_GENCLERBIRLIGI_GALATASARAY: ApiFootballFixtureResultRaw = {
  "fixture": {
    "id": 1584435,
    "date": "2026-10-17T13:00:00+00:00",
    "timestamp": 1792242000,
    "status": {
      "long": "Match Finished",
      "short": "FT",
      "elapsed": 90
    },
    "referee": "Resat Onur Coskunses, Türkiye",
    "venue": {
      "name": "Eryaman Stadyumu",
      "city": "Ankara"
    }
  },
  "league": {
    "id": 203,
    "name": "Süper Lig",
    "country": "Turkey",
    "season": 2026,
    "round": "Regular Season - 8",
    "logo": "https://media.api-sports.io/football/leagues/203.png"
  },
  "teams": {
    "home": {
      "id": 997,
      "name": "Gençlerbirliği S.K.",
      "logo": "https://media.api-sports.io/football/teams/997.png",
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
    "away": 1
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
        "elapsed": 88,
        "extra": null
      },
      "team": {
        "id": 645
      },
      "player": {
        "id": 62137,
        "name": "İrfan Can Eğribayat"
      },
      "type": "Goal",
      "detail": "Own Goal",
      "comments": null
    },
    {
      "time": {
        "elapsed": 90,
        "extra": null
      },
      "team": {
        "id": 645
      },
      "player": {
        "id": 2780,
        "name": "Victor Osimhen"
      },
      "type": "Card",
      "detail": "Yellow Card",
      "comments": null
    }
  ],
  "lineups": [
    {
      "team": {
        "id": 997,
        "colors": {
          "player": {
            "primary": "ce2c2e"
          }
        }
      },
      "formation": "4-1-4-1"
    },
    {
      "team": {
        "id": 645,
        "colors": {
          "player": {
            "primary": "ffffff"
          }
        }
      },
      "formation": "4-2-3-1"
    }
  ],
  "statistics": [],
  "players": [
    {
      "team": {
        "id": 997
      },
      "players": [
        {
          "player": {
            "id": 40547,
            "name": "Dimitris Goutas"
          },
          "statistics": [
            {
              "games": {
                "rating": "7.7"
              },
              "goals": {
                "total": null
              }
            }
          ]
        },
        {
          "player": {
            "id": 31058,
            "name": "Salih Uçan"
          },
          "statistics": [
            {
              "games": {
                "rating": "7.5"
              },
              "goals": {
                "total": null
              }
            }
          ]
        },
        {
          "player": {
            "id": 9737,
            "name": "Thalisson"
          },
          "statistics": [
            {
              "games": {
                "rating": "7.2"
              },
              "goals": {
                "total": null
              }
            }
          ]
        },
        {
          "player": {
            "id": 631912,
            "name": "Ousmane Diabate"
          },
          "statistics": [
            {
              "games": {
                "rating": "7.2"
              },
              "goals": {
                "total": null
              }
            }
          ]
        },
        {
          "player": {
            "id": 62137,
            "name": "İrfan Can Eğribayat"
          },
          "statistics": [
            {
              "games": {
                "rating": "6.7"
              },
              "goals": {
                "total": null
              }
            }
          ]
        }
      ]
    },
    {
      "team": {
        "id": 645
      },
      "players": [
        {
          "player": {
            "id": 49866,
            "name": "Uğurcan Çakır"
          },
          "statistics": [
            {
              "games": {
                "rating": "8.9"
              },
              "goals": {
                "total": null
              }
            }
          ]
        },
        {
          "player": {
            "id": 61837,
            "name": "Abdülkerim Bardakcı"
          },
          "statistics": [
            {
              "games": {
                "rating": "7.6"
              },
              "goals": {
                "total": null
              }
            }
          ]
        },
        {
          "player": {
            "id": 168,
            "name": "Davinson Sánchez"
          },
          "statistics": [
            {
              "games": {
                "rating": "7.5"
              },
              "goals": {
                "total": null
              }
            }
          ]
        },
        {
          "player": {
            "id": 63274,
            "name": "Barış Alper Yılmaz"
          },
          "statistics": [
            {
              "games": {
                "rating": "7.5"
              },
              "goals": {
                "total": null
              }
            }
          ]
        }
      ]
    }
  ]
};
