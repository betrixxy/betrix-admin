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

/**
 * `/fixtures?id=1636268` — 1899 Hoffenheim 2-3 Beşiktaş (UEFA Avrupa Ligi, Lig Aşaması 2. maç, 2026-10-15).
 * Gerçek yanıttan kırpılmıştır: istatistikler (xG dolu; "Passes %" yok — isabetli/toplam pastan
 * hesaplanır), oyuncularda dakika/rating/top çalma, olaylarda gol + kart, dizilişte forma rengi.
 */
export const RAW_HOFFENHEIM_BESIKTAS_STATS: ApiFootballFixtureResultRaw = {
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
    },
    {
      "time": {
        "elapsed": 90,
        "extra": 2
      },
      "team": {
        "id": 167
      },
      "player": {
        "id": 33067,
        "name": "Koki Machida"
      },
      "type": "Card",
      "detail": "Yellow Card",
      "comments": "Foul"
    },
    {
      "time": {
        "elapsed": 90,
        "extra": 5
      },
      "team": {
        "id": 167
      },
      "player": {
        "id": 1231,
        "name": "Vladimír Coufal"
      },
      "type": "Card",
      "detail": "Yellow Card",
      "comments": "Dissent"
    }
  ],
  "statistics": [
    {
      "team": {
        "id": 167
      },
      "statistics": [
        {
          "type": "expected_goals",
          "value": "1.23"
        },
        {
          "type": "Passes accurate",
          "value": 383
        },
        {
          "type": "Shots insidebox",
          "value": 9
        },
        {
          "type": "Shots outsidebox",
          "value": 4
        },
        {
          "type": "Blocked Shots",
          "value": 4
        },
        {
          "type": "Free Kicks",
          "value": 8
        },
        {
          "type": "Shots on Goal",
          "value": 3
        },
        {
          "type": "Goalkeeper Saves",
          "value": 2
        },
        {
          "type": "Shots off Goal",
          "value": 6
        },
        {
          "type": "Total passes",
          "value": 486
        },
        {
          "type": "Total Shots",
          "value": 13
        },
        {
          "type": "Yellow Cards",
          "value": 5
        },
        {
          "type": "Corner Kicks",
          "value": 7
        },
        {
          "type": "Fouls",
          "value": 18
        },
        {
          "type": "Red Cards",
          "value": 0
        },
        {
          "type": "Ball Possession",
          "value": "53%"
        }
      ]
    },
    {
      "team": {
        "id": 549
      },
      "statistics": [
        {
          "type": "expected_goals",
          "value": "3.39"
        },
        {
          "type": "Passes accurate",
          "value": 332
        },
        {
          "type": "Shots insidebox",
          "value": 16
        },
        {
          "type": "Shots outsidebox",
          "value": 3
        },
        {
          "type": "Blocked Shots",
          "value": 7
        },
        {
          "type": "Free Kicks",
          "value": 18
        },
        {
          "type": "Shots on Goal",
          "value": 5
        },
        {
          "type": "Goalkeeper Saves",
          "value": 1
        },
        {
          "type": "Shots off Goal",
          "value": 7
        },
        {
          "type": "Total passes",
          "value": 420
        },
        {
          "type": "Total Shots",
          "value": 19
        },
        {
          "type": "Yellow Cards",
          "value": 1
        },
        {
          "type": "Corner Kicks",
          "value": 5
        },
        {
          "type": "Fouls",
          "value": 8
        },
        {
          "type": "Red Cards",
          "value": 0
        },
        {
          "type": "Ball Possession",
          "value": "47%"
        }
      ]
    }
  ],
  "players": [
    {
      "team": {
        "id": 549
      },
      "players": [
        {
          "player": {
            "id": 50104,
            "name": "D. Alemdar"
          },
          "statistics": [
            {
              "games": {
                "minutes": 0,
                "rating": "0"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 135068,
            "name": "E. Agbadou"
          },
          "statistics": [
            {
              "games": {
                "minutes": 90,
                "rating": "6.14"
              },
              "tackles": {
                "total": 2,
                "interceptions": 1
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
                "minutes": 90,
                "rating": "6.83"
              },
              "tackles": {
                "total": 1,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 37155,
            "name": "O. Kökçü"
          },
          "statistics": [
            {
              "games": {
                "minutes": 45,
                "rating": "6.81"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
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
                "minutes": 90,
                "rating": "7.75"
              },
              "tackles": {
                "total": 2,
                "interceptions": 1
              }
            }
          ]
        },
        {
          "player": {
            "id": 18786,
            "name": "W. Ndidi"
          },
          "statistics": [
            {
              "games": {
                "minutes": 89,
                "rating": "6.4"
              },
              "tackles": {
                "total": 3,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 34710,
            "name": "Oh Hyeon-Gyu"
          },
          "statistics": [
            {
              "games": {
                "minutes": 85,
                "rating": "9.41"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 316904,
            "name": "J. Olaitan"
          },
          "statistics": [
            {
              "games": {
                "minutes": 78,
                "rating": "6.47"
              },
              "tackles": {
                "total": 0,
                "interceptions": 2
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
                "minutes": 89,
                "rating": "7.1"
              },
              "tackles": {
                "total": 4,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 50046,
            "name": "E. Topçu"
          },
          "statistics": [
            {
              "games": {
                "minutes": 90,
                "rating": "6.54"
              },
              "tackles": {
                "total": 3,
                "interceptions": 1
              }
            }
          ]
        },
        {
          "player": {
            "id": 1946,
            "name": "L. Trossard"
          },
          "statistics": [
            {
              "games": {
                "minutes": 90,
                "rating": "6.74"
              },
              "tackles": {
                "total": 1,
                "interceptions": 1
              }
            }
          ]
        },
        {
          "player": {
            "id": 367637,
            "name": "Ü. Akdağ"
          },
          "statistics": [
            {
              "games": {
                "minutes": 1,
                "rating": "6.1"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 399,
            "name": "A. Nübel"
          },
          "statistics": [
            {
              "games": {
                "minutes": 90,
                "rating": "6.04"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 394663,
            "name": "Taylan  Bulut"
          },
          "statistics": [
            {
              "games": {
                "minutes": 0,
                "rating": "0"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 1479,
            "name": "Tiago Djaló"
          },
          "statistics": [
            {
              "games": {
                "minutes": 0,
                "rating": "0"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 1998,
            "name": "K. Yılmaz"
          },
          "statistics": [
            {
              "games": {
                "minutes": 0,
                "rating": "0"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 336567,
            "name": "S. Kılıçsoy"
          },
          "statistics": [
            {
              "games": {
                "minutes": 5,
                "rating": "6.62"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 181808,
            "name": "F. Miretti"
          },
          "statistics": [
            {
              "games": {
                "minutes": 45,
                "rating": "6.34"
              },
              "tackles": {
                "total": 1,
                "interceptions": 2
              }
            }
          ]
        },
        {
          "player": {
            "id": 24807,
            "name": "S. Özcan"
          },
          "statistics": [
            {
              "games": {
                "minutes": 12,
                "rating": "5.75"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 376039,
            "name": "Y. Özcan"
          },
          "statistics": [
            {
              "games": {
                "minutes": 0,
                "rating": "0"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 312840,
            "name": "E. Poku"
          },
          "statistics": [
            {
              "games": {
                "minutes": 0,
                "rating": "0"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 1987,
            "name": "R. Yılmaz"
          },
          "statistics": [
            {
              "games": {
                "minutes": 1,
                "rating": "6.2"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 630520,
            "name": "Sami Bircan Ahmet"
          },
          "statistics": [
            {
              "games": {
                "minutes": 0,
                "rating": "0"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
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
            "id": 279905,
            "name": "B. Conté"
          },
          "statistics": [
            {
              "games": {
                "minutes": 18,
                "rating": "5.84"
              },
              "tackles": {
                "total": 0,
                "interceptions": 1
              }
            }
          ]
        },
        {
          "player": {
            "id": 202501,
            "name": "F. Asllani"
          },
          "statistics": [
            {
              "games": {
                "minutes": 90,
                "rating": "6.94"
              },
              "tackles": {
                "total": 2,
                "interceptions": 1
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
                "minutes": 90,
                "rating": "6.63"
              },
              "tackles": {
                "total": 3,
                "interceptions": 2
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
                "minutes": 90,
                "rating": "6.48"
              },
              "tackles": {
                "total": 1,
                "interceptions": 2
              }
            }
          ]
        },
        {
          "player": {
            "id": 37153,
            "name": "W. Burger"
          },
          "statistics": [
            {
              "games": {
                "minutes": 72,
                "rating": "5.87"
              },
              "tackles": {
                "total": 1,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 1231,
            "name": "V. Coufal"
          },
          "statistics": [
            {
              "games": {
                "minutes": 90,
                "rating": "6.4"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 362564,
            "name": "A. Daghim"
          },
          "statistics": [
            {
              "games": {
                "minutes": 59,
                "rating": "5.4"
              },
              "tackles": {
                "total": 5,
                "interceptions": 1
              }
            }
          ]
        },
        {
          "player": {
            "id": 66019,
            "name": "A. Hložek"
          },
          "statistics": [
            {
              "games": {
                "minutes": 59,
                "rating": "6.2"
              },
              "tackles": {
                "total": 1,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 26300,
            "name": "O. Kabak"
          },
          "statistics": [
            {
              "games": {
                "minutes": 85,
                "rating": "5.71"
              },
              "tackles": {
                "total": 1,
                "interceptions": 3
              }
            }
          ]
        },
        {
          "player": {
            "id": 726,
            "name": "A. Kramarić"
          },
          "statistics": [
            {
              "games": {
                "minutes": 72,
                "rating": "6.03"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
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
                "minutes": 90,
                "rating": "6.91"
              },
              "tackles": {
                "total": 1,
                "interceptions": 4
              }
            }
          ]
        },
        {
          "player": {
            "id": 637696,
            "name": "Natnael Abraha"
          },
          "statistics": [
            {
              "games": {
                "minutes": 0,
                "rating": "0"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 702,
            "name": "O. Baumann"
          },
          "statistics": [
            {
              "games": {
                "minutes": 90,
                "rating": "5.82"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 453903,
            "name": "Nathan De Cat"
          },
          "statistics": [
            {
              "games": {
                "minutes": 18,
                "rating": "5.55"
              },
              "tackles": {
                "total": 1,
                "interceptions": 1
              }
            }
          ]
        },
        {
          "player": {
            "id": 127631,
            "name": "V. Gendrey"
          },
          "statistics": [
            {
              "games": {
                "minutes": 0,
                "rating": "0"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 162964,
            "name": "R. Hranáč"
          },
          "statistics": [
            {
              "games": {
                "minutes": 5,
                "rating": "6.25"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 203040,
            "name": "T. Lemperle"
          },
          "statistics": [
            {
              "games": {
                "minutes": 31,
                "rating": "6.11"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 418888,
            "name": "Cajetan Benjamin Lenz"
          },
          "statistics": [
            {
              "games": {
                "minutes": 0,
                "rating": "0"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 387973,
            "name": "Max Moerstedt"
          },
          "statistics": [
            {
              "games": {
                "minutes": 0,
                "rating": "0"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 288097,
            "name": "L. Petersson"
          },
          "statistics": [
            {
              "games": {
                "minutes": 0,
                "rating": "0"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 163066,
            "name": "L. Philipp"
          },
          "statistics": [
            {
              "games": {
                "minutes": 0,
                "rating": "0"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 7327,
            "name": "A. Prass"
          },
          "statistics": [
            {
              "games": {
                "minutes": 31,
                "rating": "5.86"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
              }
            }
          ]
        },
        {
          "player": {
            "id": 408853,
            "name": "M. Rots"
          },
          "statistics": [
            {
              "games": {
                "minutes": 0,
                "rating": "0"
              },
              "tackles": {
                "total": 0,
                "interceptions": 0
              }
            }
          ]
        }
      ]
    }
  ],
  "lineups": [
    {
      "team": {
        "id": 167,
        "colors": {
          "player": {}
        }
      },
      "formation": "4-2-3-1",
      "startXI": [
        {
          "player": {
            "id": 702,
            "name": "O. Baumann",
            "number": 1,
            "grid": "1:1"
          }
        },
        {
          "player": {
            "id": 1231,
            "name": "V. Coufal",
            "number": 34,
            "grid": "2:4"
          }
        },
        {
          "player": {
            "id": 26300,
            "name": "O. Kabak",
            "number": 5,
            "grid": "2:3"
          }
        },
        {
          "player": {
            "id": 33067,
            "name": "K. Machida",
            "number": 28,
            "grid": "2:2"
          }
        },
        {
          "player": {
            "id": 18964,
            "name": "Bernardo",
            "number": 13,
            "grid": "2:1"
          }
        },
        {
          "player": {
            "id": 37153,
            "name": "W. Burger",
            "number": 18,
            "grid": "3:2"
          }
        },
        {
          "player": {
            "id": 390586,
            "name": "L. Avdullahu",
            "number": 7,
            "grid": "3:1"
          }
        },
        {
          "player": {
            "id": 726,
            "name": "A. Kramarić",
            "number": 27,
            "grid": "4:3"
          }
        },
        {
          "player": {
            "id": 202501,
            "name": "F. Asllani",
            "number": 11,
            "grid": "4:2"
          }
        },
        {
          "player": {
            "id": 362564,
            "name": "A. Daghim",
            "number": 14,
            "grid": "4:1"
          }
        },
        {
          "player": {
            "id": 66019,
            "name": "A. Hložek",
            "number": 10,
            "grid": "5:1"
          }
        }
      ]
    },
    {
      "team": {
        "id": 549,
        "colors": {
          "player": {}
        }
      },
      "formation": "4-2-3-1",
      "startXI": [
        {
          "player": {
            "id": 399,
            "name": "A. Nübel",
            "number": 1,
            "grid": "1:1"
          }
        },
        {
          "player": {
            "id": 2973,
            "name": "A. Murillo",
            "number": 62,
            "grid": "2:4"
          }
        },
        {
          "player": {
            "id": 135068,
            "name": "E. Agbadou",
            "number": 12,
            "grid": "2:3"
          }
        },
        {
          "player": {
            "id": 50046,
            "name": "E. Topçu",
            "number": 53,
            "grid": "2:2"
          }
        },
        {
          "player": {
            "id": 333137,
            "name": "K. Ouattara",
            "number": 11,
            "grid": "2:1"
          }
        },
        {
          "player": {
            "id": 18786,
            "name": "W. Ndidi",
            "number": 4,
            "grid": "3:2"
          }
        },
        {
          "player": {
            "id": 37155,
            "name": "O. Kökçü",
            "number": 10,
            "grid": "3:1"
          }
        },
        {
          "player": {
            "id": 446824,
            "name": "I. Fakili",
            "number": 29,
            "grid": "4:3"
          }
        },
        {
          "player": {
            "id": 316904,
            "name": "J. Olaitan",
            "number": 15,
            "grid": "4:2"
          }
        },
        {
          "player": {
            "id": 1946,
            "name": "L. Trossard",
            "number": 19,
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
    }
  ]
};
