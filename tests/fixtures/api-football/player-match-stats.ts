import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import type { SportmonksLineupPlayer } from "@/types/player-match-stats";

/**
 * `/fixtures?id=1550167` — AC Milan 2-4 Bologna (Serie A, 9. hafta, 2026-10-28). Gerçek yanıttan kırpılmıştır:
 * olaylar (gol, değişiklik, kart), dizilişler ve süre alan oyuncuların maç istatistikleri (Oyuncu İstatistikleri eşleyicisinin okuduğu alanlar).
 * Kalecilerde `goals.conceded` sağlayıcıda boş gelir — eksik veri testi.
 */
export const RAW_MILAN_BOLOGNA: ApiFootballFixtureResultRaw = {
 "fixture": {
  "id": 1550167,
  "date": "2026-10-28T17:30:00+00:00",
  "timestamp": 1793208600,
  "status": {
   "long": "Match Finished",
   "short": "FT",
   "elapsed": 90
  },
  "referee": "Juan Luca Sacchi",
  "venue": {
   "name": "San Siro/Giuseppe Meazza",
   "city": "Milan"
  }
 },
 "league": {
  "id": 135,
  "name": "Serie A",
  "country": "Italy",
  "season": 2026,
  "round": "Regular Season - 9",
  "logo": "https://media.api-sports.io/football/leagues/135.png"
 },
 "teams": {
  "home": {
   "id": 489,
   "name": "AC Milan",
   "logo": "https://media.api-sports.io/football/teams/489.png",
   "winner": false
  },
  "away": {
   "id": 500,
   "name": "Bologna",
   "logo": "https://media.api-sports.io/football/teams/500.png",
   "winner": true
  }
 },
 "goals": {
  "home": 2,
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
    "elapsed": 8,
    "extra": null
   },
   "team": {
    "id": 500
   },
   "player": {
    "id": 346866,
    "name": "Samuel Mbangula Tshifunda"
   },
   "assist": {
    "id": 128461,
    "name": "Nadir Zortea"
   },
   "type": "Goal",
   "detail": "Normal Goal",
   "comments": null
  },
  {
   "time": {
    "elapsed": 14,
    "extra": null
   },
   "team": {
    "id": 489
   },
   "player": {
    "id": 359100,
    "name": "Alphadjo Cissè"
   },
   "assist": {
    "id": null,
    "name": null
   },
   "type": "Goal",
   "detail": "Normal Goal",
   "comments": null
  },
  {
   "time": {
    "elapsed": 27,
    "extra": null
   },
   "team": {
    "id": 489
   },
   "player": {
    "id": 359100,
    "name": "Alphadjo Cissè"
   },
   "assist": {
    "id": 19209,
    "name": "Fikayo Tomori"
   },
   "type": "Goal",
   "detail": "Normal Goal",
   "comments": null
  },
  {
   "time": {
    "elapsed": 45,
    "extra": null
   },
   "team": {
    "id": 489
   },
   "player": {
    "id": 19209,
    "name": "Fikayo Tomori"
   },
   "assist": {
    "id": 754,
    "name": "Luka Modrić"
   },
   "type": "subst",
   "detail": "Substitution 1",
   "comments": null
  },
  {
   "time": {
    "elapsed": 58,
    "extra": null
   },
   "team": {
    "id": 489
   },
   "player": {
    "id": 46731,
    "name": "Pervis Estupinan"
   },
   "assist": {
    "id": 467860,
    "name": "Sankhoun Diawara"
   },
   "type": "subst",
   "detail": "Substitution 2",
   "comments": null
  },
  {
   "time": {
    "elapsed": 58,
    "extra": null
   },
   "team": {
    "id": 489
   },
   "player": {
    "id": 284428,
    "name": "Omari Hutchinson"
   },
   "assist": {
    "id": 17,
    "name": "Christian Pulisic"
   },
   "type": "subst",
   "detail": "Substitution 3",
   "comments": null
  },
  {
   "time": {
    "elapsed": 58,
    "extra": null
   },
   "team": {
    "id": 500
   },
   "player": {
    "id": 887,
    "name": "Matteo Darmian"
   },
   "assist": {
    "id": 287564,
    "name": "Martin Vitik"
   },
   "type": "subst",
   "detail": "Substitution 1",
   "comments": null
  },
  {
   "time": {
    "elapsed": 59,
    "extra": null
   },
   "team": {
    "id": 500
   },
   "player": {
    "id": 295223,
    "name": "Rahim Alhassane"
   },
   "assist": {
    "id": 134,
    "name": "Juan Miranda"
   },
   "type": "subst",
   "detail": "Substitution 2",
   "comments": null
  },
  {
   "time": {
    "elapsed": 59,
    "extra": null
   },
   "team": {
    "id": 500
   },
   "player": {
    "id": 873,
    "name": "Federico Bernardeschi"
   },
   "assist": {
    "id": 30438,
    "name": "Nicolo Cambiaghi"
   },
   "type": "subst",
   "detail": "Substitution 3",
   "comments": null
  },
  {
   "time": {
    "elapsed": 60,
    "extra": null
   },
   "team": {
    "id": 500
   },
   "player": {
    "id": 374359,
    "name": "Davide Bartesaghi"
   },
   "assist": {
    "id": null,
    "name": null
   },
   "type": "Goal",
   "detail": "Own Goal",
   "comments": null
  },
  {
   "time": {
    "elapsed": 62,
    "extra": null
   },
   "team": {
    "id": 500
   },
   "player": {
    "id": 346866,
    "name": "Samuel Mbangula Tshifunda"
   },
   "assist": {
    "id": 134,
    "name": "Juan Miranda"
   },
   "type": "Goal",
   "detail": "Normal Goal",
   "comments": null
  },
  {
   "time": {
    "elapsed": 63,
    "extra": null
   },
   "team": {
    "id": 489
   },
   "player": {
    "id": 374359,
    "name": "Davide Bartesaghi"
   },
   "assist": {
    "id": 436260,
    "name": "Francesco Camarda"
   },
   "type": "subst",
   "detail": "Substitution 4",
   "comments": null
  },
  {
   "time": {
    "elapsed": 70,
    "extra": null
   },
   "team": {
    "id": 500
   },
   "player": {
    "id": 204043,
    "name": "Arthur Theate"
   },
   "assist": {
    "id": 39254,
    "name": "Torbjørn Heggem"
   },
   "type": "subst",
   "detail": "Substitution 4",
   "comments": null
  },
  {
   "time": {
    "elapsed": 76,
    "extra": null
   },
   "team": {
    "id": 500
   },
   "player": {
    "id": 31273,
    "name": "Tommaso Pobega"
   },
   "assist": {
    "id": null,
    "name": null
   },
   "type": "Card",
   "detail": "Yellow Card",
   "comments": "Foul"
  },
  {
   "time": {
    "elapsed": 79,
    "extra": null
   },
   "team": {
    "id": 500
   },
   "player": {
    "id": 31099,
    "name": "Nicolo Casale"
   },
   "assist": {
    "id": 416062,
    "name": "Eivind Helland"
   },
   "type": "subst",
   "detail": "Substitution 5",
   "comments": null
  },
  {
   "time": {
    "elapsed": 84,
    "extra": null
   },
   "team": {
    "id": 500
   },
   "player": {
    "id": 39254,
    "name": "Torbjørn Heggem"
   },
   "assist": {
    "id": null,
    "name": null
   },
   "type": "Card",
   "detail": "Yellow Card",
   "comments": "Foul"
  },
  {
   "time": {
    "elapsed": 86,
    "extra": null
   },
   "team": {
    "id": 500
   },
   "player": {
    "id": 346866,
    "name": "Samuel Mbangula Tshifunda"
   },
   "assist": {
    "id": 30542,
    "name": "Jens Odgaard"
   },
   "type": "Goal",
   "detail": "Normal Goal",
   "comments": null
  },
  {
   "time": {
    "elapsed": 87,
    "extra": null
   },
   "team": {
    "id": 489
   },
   "player": {
    "id": 41585,
    "name": "Gonçalo Ramos"
   },
   "assist": {
    "id": 452330,
    "name": "Christian Comotto"
   },
   "type": "subst",
   "detail": "Substitution 5",
   "comments": null
  }
 ],
 "lineups": [
  {
   "team": {
    "id": 489,
    "colors": null
   },
   "formation": "4-2-3-1",
   "coach": {
    "name": "Ruben Amorim"
   },
   "startXI": [
    {
     "player": {
      "id": 22221,
      "name": "M. Maignan",
      "number": 16,
      "grid": "1:1"
     }
    },
    {
     "player": {
      "id": 19209,
      "name": "F. Tomori",
      "number": 23,
      "grid": "2:4"
     }
    },
    {
     "player": {
      "id": 162141,
      "name": "K. De Winter",
      "number": 5,
      "grid": "2:3"
     }
    },
    {
     "player": {
      "id": 45826,
      "name": "S. Pavlović",
      "number": 31,
      "grid": "2:2"
     }
    },
    {
     "player": {
      "id": 46731,
      "name": "P. Estupiñán",
      "number": 2,
      "grid": "2:1"
     }
    },
    {
     "player": {
      "id": 162106,
      "name": "Y. Musah",
      "number": 80,
      "grid": "3:2"
     }
    },
    {
     "player": {
      "id": 264705,
      "name": "A. Jashari",
      "number": 30,
      "grid": "3:1"
     }
    },
    {
     "player": {
      "id": 284428,
      "name": "O. Hutchinson",
      "number": 20,
      "grid": "4:3"
     }
    },
    {
     "player": {
      "id": 359100,
      "name": "A. Cissè",
      "number": 70,
      "grid": "4:2"
     }
    },
    {
     "player": {
      "id": 374359,
      "name": "D. Bartesaghi",
      "number": 33,
      "grid": "4:1"
     }
    },
    {
     "player": {
      "id": 41585,
      "name": "Gonçalo Ramos",
      "number": 9,
      "grid": "5:1"
     }
    }
   ]
  },
  {
   "team": {
    "id": 500,
    "colors": null
   },
   "formation": "3-4-3",
   "coach": {
    "name": "Raffaele Palladino"
   },
   "startXI": [
    {
     "player": {
      "id": 2998,
      "name": "Ł. Skorupski",
      "number": 1,
      "grid": "1:1"
     }
    },
    {
     "player": {
      "id": 887,
      "name": "M. Darmian",
      "number": 36,
      "grid": "2:3"
     }
    },
    {
     "player": {
      "id": 31099,
      "name": "N. Casale",
      "number": 16,
      "grid": "2:2"
     }
    },
    {
     "player": {
      "id": 204043,
      "name": "A. Theate",
      "number": 3,
      "grid": "2:1"
     }
    },
    {
     "player": {
      "id": 128461,
      "name": "N. Zortea",
      "number": 20,
      "grid": "3:4"
     }
    },
    {
     "player": {
      "id": 44814,
      "name": "L. Ferguson",
      "number": 19,
      "grid": "3:3"
     }
    },
    {
     "player": {
      "id": 31273,
      "name": "T. Pobega",
      "number": 4,
      "grid": "3:2"
     }
    },
    {
     "player": {
      "id": 295223,
      "name": "R. Alhassane",
      "number": 23,
      "grid": "3:1"
     }
    },
    {
     "player": {
      "id": 873,
      "name": "F. Bernardeschi",
      "number": 10,
      "grid": "4:3"
     }
    },
    {
     "player": {
      "id": 30542,
      "name": "J. Odgaard",
      "number": 21,
      "grid": "4:2"
     }
    },
    {
     "player": {
      "id": 346866,
      "name": "S. Mbangula",
      "number": 11,
      "grid": "4:1"
     }
    }
   ]
  }
 ],
 "statistics": [],
 "players": [
  {
   "team": {
    "id": 500
   },
   "players": [
    {
     "player": {
      "id": 30438,
      "name": "N. Cambiaghi"
     },
     "statistics": [
      {
       "games": {
        "minutes": 31,
        "position": "F",
        "rating": "6.61",
        "substitute": false
       },
       "shots": {
        "total": 1,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 0,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 8,
        "key": 0,
        "accuracy": "7"
       },
       "tackles": {
        "total": 1,
        "blocks": 0,
        "interceptions": 1
       },
       "duels": {
        "total": 5,
        "won": 2
       },
       "dribbles": {
        "attempts": 0,
        "success": 0
       },
       "fouls": {
        "drawn": 1
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 2998,
      "name": "Ł. Skorupski"
     },
     "statistics": [
      {
       "games": {
        "minutes": 90,
        "position": "G",
        "rating": "6",
        "substitute": false
       },
       "shots": {
        "total": 0,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 0,
        "conceded": null,
        "saves": 1
       },
       "passes": {
        "total": 27,
        "key": 0,
        "accuracy": "16"
       },
       "tackles": {
        "total": 0,
        "blocks": 0,
        "interceptions": 0
       },
       "duels": {
        "total": 0,
        "won": 0
       },
       "dribbles": {
        "attempts": 0,
        "success": 0
       },
       "fouls": {
        "drawn": 0
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 295223,
      "name": "R. Alhassane"
     },
     "statistics": [
      {
       "games": {
        "minutes": 59,
        "position": "M",
        "rating": "6.18",
        "substitute": false
       },
       "shots": {
        "total": 0,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 0,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 15,
        "key": 1,
        "accuracy": "15"
       },
       "tackles": {
        "total": 1,
        "blocks": 0,
        "interceptions": 1
       },
       "duels": {
        "total": 1,
        "won": 1
       },
       "dribbles": {
        "attempts": 0,
        "success": 0
       },
       "fouls": {
        "drawn": 0
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 873,
      "name": "F. Bernardeschi"
     },
     "statistics": [
      {
       "games": {
        "minutes": 59,
        "position": "F",
        "rating": "6.45",
        "substitute": false
       },
       "shots": {
        "total": 0,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 0,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 21,
        "key": 2,
        "accuracy": "17"
       },
       "tackles": {
        "total": 0,
        "blocks": 0,
        "interceptions": 0
       },
       "duels": {
        "total": 4,
        "won": 2
       },
       "dribbles": {
        "attempts": 1,
        "success": 1
       },
       "fouls": {
        "drawn": 0
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 31099,
      "name": "N. Casale"
     },
     "statistics": [
      {
       "games": {
        "minutes": 79,
        "position": "D",
        "rating": "6.18",
        "substitute": false
       },
       "shots": {
        "total": 0,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 0,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 28,
        "key": 0,
        "accuracy": "20"
       },
       "tackles": {
        "total": 0,
        "blocks": 0,
        "interceptions": 2
       },
       "duels": {
        "total": 8,
        "won": 4
       },
       "dribbles": {
        "attempts": 0,
        "success": 0
       },
       "fouls": {
        "drawn": 0
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 887,
      "name": "M. Darmian"
     },
     "statistics": [
      {
       "games": {
        "minutes": 58,
        "position": "D",
        "rating": "5.62",
        "substitute": false
       },
       "shots": {
        "total": 0,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 0,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 24,
        "key": 0,
        "accuracy": "16"
       },
       "tackles": {
        "total": 0,
        "blocks": 0,
        "interceptions": 0
       },
       "duels": {
        "total": 4,
        "won": 2
       },
       "dribbles": {
        "attempts": 0,
        "success": 0
       },
       "fouls": {
        "drawn": 1
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 44814,
      "name": "L. Ferguson"
     },
     "statistics": [
      {
       "games": {
        "minutes": 90,
        "position": "M",
        "rating": "6.59",
        "substitute": false
       },
       "shots": {
        "total": 0,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 0,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 51,
        "key": 0,
        "accuracy": "47"
       },
       "tackles": {
        "total": 2,
        "blocks": 0,
        "interceptions": 2
       },
       "duels": {
        "total": 13,
        "won": 8
       },
       "dribbles": {
        "attempts": 3,
        "success": 3
       },
       "fouls": {
        "drawn": 2
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 346866,
      "name": "S. Mbangula"
     },
     "statistics": [
      {
       "games": {
        "minutes": 90,
        "position": "F",
        "rating": "9.17",
        "substitute": false
       },
       "shots": {
        "total": 4,
        "on": 3
       },
       "goals": {
        "total": 3,
        "assists": 0,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 25,
        "key": 1,
        "accuracy": "23"
       },
       "tackles": {
        "total": 3,
        "blocks": 0,
        "interceptions": 2
       },
       "duels": {
        "total": 15,
        "won": 7
       },
       "dribbles": {
        "attempts": 4,
        "success": 1
       },
       "fouls": {
        "drawn": 3
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 30542,
      "name": "J. Odgaard"
     },
     "statistics": [
      {
       "games": {
        "minutes": 90,
        "position": "F",
        "rating": "7.18",
        "substitute": false
       },
       "shots": {
        "total": 2,
        "on": 1
       },
       "goals": {
        "total": 0,
        "assists": 1,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 15,
        "key": 2,
        "accuracy": "11"
       },
       "tackles": {
        "total": 1,
        "blocks": 0,
        "interceptions": 0
       },
       "duels": {
        "total": 15,
        "won": 5
       },
       "dribbles": {
        "attempts": 0,
        "success": 0
       },
       "fouls": {
        "drawn": 2
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 31273,
      "name": "T. Pobega"
     },
     "statistics": [
      {
       "games": {
        "minutes": 90,
        "position": "M",
        "rating": "6.42",
        "substitute": false
       },
       "shots": {
        "total": 1,
        "on": 1
       },
       "goals": {
        "total": 0,
        "assists": 0,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 34,
        "key": 0,
        "accuracy": "24"
       },
       "tackles": {
        "total": 5,
        "blocks": 0,
        "interceptions": 1
       },
       "duels": {
        "total": 9,
        "won": 5
       },
       "dribbles": {
        "attempts": 0,
        "success": 0
       },
       "fouls": {
        "drawn": 0
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 204043,
      "name": "A. Theate"
     },
     "statistics": [
      {
       "games": {
        "minutes": 70,
        "position": "D",
        "rating": "6.54",
        "substitute": false
       },
       "shots": {
        "total": 0,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 0,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 38,
        "key": 0,
        "accuracy": "33"
       },
       "tackles": {
        "total": 2,
        "blocks": 0,
        "interceptions": 1
       },
       "duels": {
        "total": 5,
        "won": 3
       },
       "dribbles": {
        "attempts": 0,
        "success": 0
       },
       "fouls": {
        "drawn": 0
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 128461,
      "name": "N. Zortea"
     },
     "statistics": [
      {
       "games": {
        "minutes": 90,
        "position": "M",
        "rating": "6.72",
        "substitute": false
       },
       "shots": {
        "total": 0,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 1,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 24,
        "key": 1,
        "accuracy": "20"
       },
       "tackles": {
        "total": 3,
        "blocks": 0,
        "interceptions": 0
       },
       "duels": {
        "total": 16,
        "won": 7
       },
       "dribbles": {
        "attempts": 4,
        "success": 2
       },
       "fouls": {
        "drawn": 1
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 416062,
      "name": "E. Helland"
     },
     "statistics": [
      {
       "games": {
        "minutes": 11,
        "position": "D",
        "rating": "6.14",
        "substitute": false
       },
       "shots": {
        "total": 0,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 0,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 5,
        "key": 0,
        "accuracy": "4"
       },
       "tackles": {
        "total": 0,
        "blocks": 0,
        "interceptions": 0
       },
       "duels": {
        "total": 1,
        "won": 1
       },
       "dribbles": {
        "attempts": 0,
        "success": 0
       },
       "fouls": {
        "drawn": 0
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 39254,
      "name": "T. Heggem"
     },
     "statistics": [
      {
       "games": {
        "minutes": 20,
        "position": "D",
        "rating": "5.8",
        "substitute": false
       },
       "shots": {
        "total": 0,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 0,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 5,
        "key": 0,
        "accuracy": "5"
       },
       "tackles": {
        "total": 0,
        "blocks": 0,
        "interceptions": 1
       },
       "duels": {
        "total": 2,
        "won": 1
       },
       "dribbles": {
        "attempts": 0,
        "success": 0
       },
       "fouls": {
        "drawn": 0
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 134,
      "name": "Juan Miranda"
     },
     "statistics": [
      {
       "games": {
        "minutes": 31,
        "position": "D",
        "rating": "6.33",
        "substitute": false
       },
       "shots": {
        "total": 1,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 1,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 12,
        "key": 1,
        "accuracy": "9"
       },
       "tackles": {
        "total": 0,
        "blocks": 1,
        "interceptions": 0
       },
       "duels": {
        "total": 1,
        "won": 0
       },
       "dribbles": {
        "attempts": 0,
        "success": 0
       },
       "fouls": {
        "drawn": 0
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 287564,
      "name": "M. Vitík"
     },
     "statistics": [
      {
       "games": {
        "minutes": 32,
        "position": "D",
        "rating": "5.93",
        "substitute": false
       },
       "shots": {
        "total": 0,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 0,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 6,
        "key": 1,
        "accuracy": "4"
       },
       "tackles": {
        "total": 1,
        "blocks": 0,
        "interceptions": 0
       },
       "duels": {
        "total": 2,
        "won": 1
       },
       "dribbles": {
        "attempts": 0,
        "success": 0
       },
       "fouls": {
        "drawn": 0
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    }
   ]
  },
  {
   "team": {
    "id": 489
   },
   "players": [
    {
     "player": {
      "id": 436260,
      "name": "F. Camarda"
     },
     "statistics": [
      {
       "games": {
        "minutes": 27,
        "position": "F",
        "rating": "6.21",
        "substitute": false
       },
       "shots": {
        "total": 2,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 0,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 8,
        "key": 0,
        "accuracy": "5"
       },
       "tackles": {
        "total": 0,
        "blocks": 0,
        "interceptions": 0
       },
       "duels": {
        "total": 3,
        "won": 2
       },
       "dribbles": {
        "attempts": 1,
        "success": 1
       },
       "fouls": {
        "drawn": 1
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 374359,
      "name": "D. Bartesaghi"
     },
     "statistics": [
      {
       "games": {
        "minutes": 63,
        "position": "M",
        "rating": "4.33",
        "substitute": false
       },
       "shots": {
        "total": 0,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 0,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 20,
        "key": 0,
        "accuracy": "13"
       },
       "tackles": {
        "total": 1,
        "blocks": 0,
        "interceptions": 0
       },
       "duels": {
        "total": 4,
        "won": 2
       },
       "dribbles": {
        "attempts": 1,
        "success": 0
       },
       "fouls": {
        "drawn": 1
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 359100,
      "name": "A. Cissè"
     },
     "statistics": [
      {
       "games": {
        "minutes": 90,
        "position": "M",
        "rating": "8.3",
        "substitute": false
       },
       "shots": {
        "total": 2,
        "on": 2
       },
       "goals": {
        "total": 2,
        "assists": 0,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 28,
        "key": 1,
        "accuracy": "23"
       },
       "tackles": {
        "total": 0,
        "blocks": 0,
        "interceptions": 1
       },
       "duels": {
        "total": 14,
        "won": 4
       },
       "dribbles": {
        "attempts": 4,
        "success": 2
       },
       "fouls": {
        "drawn": 1
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 162141,
      "name": "K. De Winter"
     },
     "statistics": [
      {
       "games": {
        "minutes": 90,
        "position": "D",
        "rating": "6",
        "substitute": false
       },
       "shots": {
        "total": 0,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 0,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 105,
        "key": 0,
        "accuracy": "100"
       },
       "tackles": {
        "total": 1,
        "blocks": 0,
        "interceptions": 0
       },
       "duels": {
        "total": 7,
        "won": 3
       },
       "dribbles": {
        "attempts": 0,
        "success": 0
       },
       "fouls": {
        "drawn": 0
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 46731,
      "name": "P. Estupiñán"
     },
     "statistics": [
      {
       "games": {
        "minutes": 58,
        "position": "D",
        "rating": "6.27",
        "substitute": false
       },
       "shots": {
        "total": 1,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 0,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 47,
        "key": 0,
        "accuracy": "40"
       },
       "tackles": {
        "total": 4,
        "blocks": 1,
        "interceptions": 1
       },
       "duels": {
        "total": 5,
        "won": 4
       },
       "dribbles": {
        "attempts": 0,
        "success": 0
       },
       "fouls": {
        "drawn": 0
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 284428,
      "name": "O. Hutchinson"
     },
     "statistics": [
      {
       "games": {
        "minutes": 58,
        "position": "M",
        "rating": "5.71",
        "substitute": false
       },
       "shots": {
        "total": 0,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 0,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 21,
        "key": 1,
        "accuracy": "17"
       },
       "tackles": {
        "total": 1,
        "blocks": 0,
        "interceptions": 1
       },
       "duels": {
        "total": 15,
        "won": 3
       },
       "dribbles": {
        "attempts": 10,
        "success": 2
       },
       "fouls": {
        "drawn": 0
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 264705,
      "name": "A. Jashari"
     },
     "statistics": [
      {
       "games": {
        "minutes": 90,
        "position": "M",
        "rating": "6.58",
        "substitute": false
       },
       "shots": {
        "total": 1,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 0,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 94,
        "key": 0,
        "accuracy": "89"
       },
       "tackles": {
        "total": 2,
        "blocks": 0,
        "interceptions": 1
       },
       "duels": {
        "total": 9,
        "won": 4
       },
       "dribbles": {
        "attempts": 0,
        "success": 0
       },
       "fouls": {
        "drawn": 1
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 162106,
      "name": "Y. Musah"
     },
     "statistics": [
      {
       "games": {
        "minutes": 90,
        "position": "M",
        "rating": "6.38",
        "substitute": false
       },
       "shots": {
        "total": 0,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 0,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 64,
        "key": 1,
        "accuracy": "57"
       },
       "tackles": {
        "total": 0,
        "blocks": 0,
        "interceptions": 0
       },
       "duels": {
        "total": 4,
        "won": 2
       },
       "dribbles": {
        "attempts": 0,
        "success": 0
       },
       "fouls": {
        "drawn": 2
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 45826,
      "name": "S. Pavlović"
     },
     "statistics": [
      {
       "games": {
        "minutes": 90,
        "position": "D",
        "rating": "6.36",
        "substitute": false
       },
       "shots": {
        "total": 0,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 0,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 110,
        "key": 0,
        "accuracy": "101"
       },
       "tackles": {
        "total": 2,
        "blocks": 0,
        "interceptions": 0
       },
       "duels": {
        "total": 14,
        "won": 10
       },
       "dribbles": {
        "attempts": 1,
        "success": 1
       },
       "fouls": {
        "drawn": 2
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 41585,
      "name": "Gonçalo Ramos"
     },
     "statistics": [
      {
       "games": {
        "minutes": 87,
        "position": "F",
        "rating": "6.13",
        "substitute": false
       },
       "shots": {
        "total": 0,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 0,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 17,
        "key": 0,
        "accuracy": "13"
       },
       "tackles": {
        "total": 0,
        "blocks": 0,
        "interceptions": 0
       },
       "duels": {
        "total": 12,
        "won": 6
       },
       "dribbles": {
        "attempts": 0,
        "success": 0
       },
       "fouls": {
        "drawn": 4
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 19209,
      "name": "F. Tomori"
     },
     "statistics": [
      {
       "games": {
        "minutes": 45,
        "position": "D",
        "rating": "6.82",
        "substitute": false
       },
       "shots": {
        "total": 1,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 1,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 27,
        "key": 1,
        "accuracy": "24"
       },
       "tackles": {
        "total": 4,
        "blocks": 0,
        "interceptions": 0
       },
       "duels": {
        "total": 7,
        "won": 6
       },
       "dribbles": {
        "attempts": 1,
        "success": 1
       },
       "fouls": {
        "drawn": 1
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 22221,
      "name": "M. Maignan"
     },
     "statistics": [
      {
       "games": {
        "minutes": 90,
        "position": "G",
        "rating": "6",
        "substitute": false
       },
       "shots": {
        "total": 0,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 0,
        "conceded": null,
        "saves": 2
       },
       "passes": {
        "total": 45,
        "key": 0,
        "accuracy": "36"
       },
       "tackles": {
        "total": 0,
        "blocks": 0,
        "interceptions": 0
       },
       "duels": {
        "total": 0,
        "won": 0
       },
       "dribbles": {
        "attempts": 0,
        "success": 0
       },
       "fouls": {
        "drawn": 0
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 452330,
      "name": "C. Comotto"
     },
     "statistics": [
      {
       "games": {
        "minutes": 3,
        "position": "M",
        "rating": "5.8",
        "substitute": false
       },
       "shots": {
        "total": 0,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 0,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 1,
        "key": 0,
        "accuracy": "1"
       },
       "tackles": {
        "total": 0,
        "blocks": 0,
        "interceptions": 0
       },
       "duels": {
        "total": 0,
        "won": 0
       },
       "dribbles": {
        "attempts": 0,
        "success": 0
       },
       "fouls": {
        "drawn": 0
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 467860,
      "name": "S. Bocoum"
     },
     "statistics": [
      {
       "games": {
        "minutes": 32,
        "position": "D",
        "rating": "5.86",
        "substitute": false
       },
       "shots": {
        "total": 0,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 0,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 19,
        "key": 0,
        "accuracy": "17"
       },
       "tackles": {
        "total": 1,
        "blocks": 0,
        "interceptions": 2
       },
       "duels": {
        "total": 2,
        "won": 2
       },
       "dribbles": {
        "attempts": 0,
        "success": 0
       },
       "fouls": {
        "drawn": 0
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 754,
      "name": "L. Modrić"
     },
     "statistics": [
      {
       "games": {
        "minutes": 45,
        "position": "M",
        "rating": "6.54",
        "substitute": false
       },
       "shots": {
        "total": 0,
        "on": 0
       },
       "goals": {
        "total": 0,
        "assists": 0,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 41,
        "key": 1,
        "accuracy": "39"
       },
       "tackles": {
        "total": 0,
        "blocks": 0,
        "interceptions": 1
       },
       "duels": {
        "total": 1,
        "won": 0
       },
       "dribbles": {
        "attempts": 0,
        "success": 0
       },
       "fouls": {
        "drawn": 0
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    },
    {
     "player": {
      "id": 17,
      "name": "C. Pulišić"
     },
     "statistics": [
      {
       "games": {
        "minutes": 32,
        "position": "M",
        "rating": "6.1",
        "substitute": false
       },
       "shots": {
        "total": 1,
        "on": 1
       },
       "goals": {
        "total": 0,
        "assists": 0,
        "conceded": null,
        "saves": 0
       },
       "passes": {
        "total": 21,
        "key": 0,
        "accuracy": "18"
       },
       "tackles": {
        "total": 0,
        "blocks": 0,
        "interceptions": 0
       },
       "duels": {
        "total": 4,
        "won": 4
       },
       "dribbles": {
        "attempts": 1,
        "success": 1
       },
       "fouls": {
        "drawn": 1
       },
       "penalty": {
        "saved": null
       }
      }
     ]
    }
   ]
  }
 ]
};

/** Aynı maçın Sportmonks dizilişi (fixture 19713534, `lineups.details.type`): dakika + xG; şut çekmeyende xG yok. */
export const SM_MILAN_BOLOGNA_LINEUP: SportmonksLineupPlayer[] = [
 {
  "teamId": 113,
  "name": "Pervis Estupiñán",
  "jersey": 2,
  "minutes": 58,
  "xg": 0.0186
 },
 {
  "teamId": 113,
  "name": "Koni De Winter",
  "jersey": 5,
  "minutes": 90,
  "xg": null
 },
 {
  "teamId": 113,
  "name": "Gonçalo Ramos",
  "jersey": 9,
  "minutes": 87,
  "xg": null
 },
 {
  "teamId": 113,
  "name": "Christian Pulisic",
  "jersey": 11,
  "minutes": 32,
  "xg": 0.1042
 },
 {
  "teamId": 113,
  "name": "Sankhoun Diawara",
  "jersey": 13,
  "minutes": 32,
  "xg": null
 },
 {
  "teamId": 113,
  "name": "Luka Modrić",
  "jersey": 14,
  "minutes": 44,
  "xg": null
 },
 {
  "teamId": 113,
  "name": "Mike Maignan",
  "jersey": 16,
  "minutes": 90,
  "xg": null
 },
 {
  "teamId": 113,
  "name": "Omari Hutchinson",
  "jersey": 20,
  "minutes": 58,
  "xg": null
 },
 {
  "teamId": 113,
  "name": "Fikayo Tomori",
  "jersey": 23,
  "minutes": 46,
  "xg": 0.0534
 },
 {
  "teamId": 113,
  "name": "Christian Comotto",
  "jersey": 28,
  "minutes": 3,
  "xg": null
 },
 {
  "teamId": 113,
  "name": "Ardon Jashari",
  "jersey": 30,
  "minutes": 90,
  "xg": 0.0173
 },
 {
  "teamId": 113,
  "name": "Strahinja Pavlović",
  "jersey": 31,
  "minutes": 90,
  "xg": null
 },
 {
  "teamId": 113,
  "name": "Davide Bartesaghi",
  "jersey": 33,
  "minutes": 63,
  "xg": null
 },
 {
  "teamId": 113,
  "name": "Valeri Vladimirov",
  "jersey": 35,
  "minutes": null,
  "xg": null
 },
 {
  "teamId": 113,
  "name": "Lorenzo Ossola",
  "jersey": 40,
  "minutes": null,
  "xg": null
 },
 {
  "teamId": 113,
  "name": "Léo Paul Bouyer",
  "jersey": 41,
  "minutes": null,
  "xg": null
 },
 {
  "teamId": 113,
  "name": "Filippo Terracciano",
  "jersey": 42,
  "minutes": null,
  "xg": null
 },
 {
  "teamId": 113,
  "name": "Nirash Perera",
  "jersey": 47,
  "minutes": null,
  "xg": null
 },
 {
  "teamId": 113,
  "name": "El Hadji Malick Cissé",
  "jersey": 48,
  "minutes": null,
  "xg": null
 },
 {
  "teamId": 113,
  "name": "Luca Menon",
  "jersey": 49,
  "minutes": null,
  "xg": null
 },
 {
  "teamId": 113,
  "name": "Silvano Vos",
  "jersey": 55,
  "minutes": null,
  "xg": null
 },
 {
  "teamId": 113,
  "name": "Alphadjo Cissè",
  "jersey": 70,
  "minutes": 90,
  "xg": 0.6545
 },
 {
  "teamId": 113,
  "name": "Francesco Camarda",
  "jersey": 73,
  "minutes": 27,
  "xg": 0.2332
 },
 {
  "teamId": 113,
  "name": "Yunus Musah",
  "jersey": 80,
  "minutes": 90,
  "xg": null
 },
 {
  "teamId": 113,
  "name": "Lorenzo Torriani",
  "jersey": 96,
  "minutes": null,
  "xg": null
 },
 {
  "teamId": 8513,
  "name": "Lukasz Skorupski",
  "jersey": 1,
  "minutes": 90,
  "xg": null
 },
 {
  "teamId": 8513,
  "name": "Arthur Theate",
  "jersey": 3,
  "minutes": 70,
  "xg": null
 },
 {
  "teamId": 8513,
  "name": "Tommaso Pobega",
  "jersey": 4,
  "minutes": 90,
  "xg": 0.039
 },
 {
  "teamId": 8513,
  "name": "Eivind Helland",
  "jersey": 5,
  "minutes": 11,
  "xg": null
 },
 {
  "teamId": 8513,
  "name": "Nikola Moro",
  "jersey": 6,
  "minutes": null,
  "xg": null
 },
 {
  "teamId": 8513,
  "name": "Mikel Amondarain",
  "jersey": 8,
  "minutes": null,
  "xg": null
 },
 {
  "teamId": 8513,
  "name": "Artem Dovbyk",
  "jersey": 9,
  "minutes": null,
  "xg": null
 },
 {
  "teamId": 8513,
  "name": "Federico Bernardeschi",
  "jersey": 10,
  "minutes": 59,
  "xg": null
 },
 {
  "teamId": 8513,
  "name": "Samuel Mbangula",
  "jersey": 11,
  "minutes": 90,
  "xg": 0.8655
 },
 {
  "teamId": 8513,
  "name": "Torbjørn Heggem",
  "jersey": 14,
  "minutes": 20,
  "xg": null
 },
 {
  "teamId": 8513,
  "name": "Nicolò Casale",
  "jersey": 16,
  "minutes": 79,
  "xg": null
 },
 {
  "teamId": 8513,
  "name": "Oussama El Azzouzi",
  "jersey": 17,
  "minutes": null,
  "xg": null
 },
 {
  "teamId": 8513,
  "name": "Marco Libra",
  "jersey": 18,
  "minutes": null,
  "xg": null
 },
 {
  "teamId": 8513,
  "name": "Lewis Ferguson",
  "jersey": 19,
  "minutes": 90,
  "xg": null
 },
 {
  "teamId": 8513,
  "name": "Nadir Zortea",
  "jersey": 20,
  "minutes": 90,
  "xg": null
 },
 {
  "teamId": 8513,
  "name": "Jens Odgaard",
  "jersey": 21,
  "minutes": 90,
  "xg": 0.2575
 },
 {
  "teamId": 8513,
  "name": "Rahim Alhassane",
  "jersey": 23,
  "minutes": 59,
  "xg": null
 },
 {
  "teamId": 8513,
  "name": "Massimo Pessina",
  "jersey": 25,
  "minutes": null,
  "xg": null
 },
 {
  "teamId": 8513,
  "name": "Nicolò Cambiaghi",
  "jersey": 28,
  "minutes": 31,
  "xg": 0.0671
 },
 {
  "teamId": 8513,
  "name": "Juan Miranda",
  "jersey": 33,
  "minutes": 31,
  "xg": 0.0309
 },
 {
  "teamId": 8513,
  "name": "Matteo Darmian",
  "jersey": 36,
  "minutes": 58,
  "xg": null
 },
 {
  "teamId": 8513,
  "name": "Martin Vitík",
  "jersey": 41,
  "minutes": 32,
  "xg": null
 },
 {
  "teamId": 8513,
  "name": "Luca Lo Monaco",
  "jersey": 43,
  "minutes": null,
  "xg": null
 },
 {
  "teamId": 8513,
  "name": "Ukko Happonen",
  "jersey": 72,
  "minutes": null,
  "xg": null
 }
];

export const SM_MILAN_BOLOGNA_IDS = {"home":113,"away":8513};
