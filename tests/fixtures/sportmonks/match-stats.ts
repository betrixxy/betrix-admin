import type { SportmonksFixture } from "@/lib/services/sportmonks/advanced-stats-mappers";

/**
 * Sportmonks `/fixtures/between/2026-07-22/2026-07-24/554?include=statistics.type;participants` —
 * Beşiktaş (554) 1-0 FC Midtjylland (939). Gerçek yanıttan kırpılmıştır (istatistik tipi + değer).
 * Bu maçta xG ve büyük fırsat yok; direkten dönen, top çalma ve müdahale var.
 */
export const SM_BESIKTAS_MIDTJYLLAND: SportmonksFixture = {
  "id": 19720995,
  "starting_at": "2026-07-23 18:00:00",
  "participants": [
    {
      "id": 939,
      "name": "FC Midtjylland"
    },
    {
      "id": 554,
      "name": "Beşiktaş"
    }
  ],
  "statistics": [
    {
      "participant_id": 939,
      "type": {
        "developer_name": "CORNERS"
      },
      "data": {
        "value": 2
      }
    },
    {
      "participant_id": 554,
      "type": {
        "developer_name": "CORNERS"
      },
      "data": {
        "value": 5
      }
    },
    {
      "participant_id": 939,
      "type": {
        "developer_name": "SHOTS_OFF_TARGET"
      },
      "data": {
        "value": 4
      }
    },
    {
      "participant_id": 554,
      "type": {
        "developer_name": "SHOTS_OFF_TARGET"
      },
      "data": {
        "value": 21
      }
    },
    {
      "participant_id": 939,
      "type": {
        "developer_name": "SHOTS_TOTAL"
      },
      "data": {
        "value": 5
      }
    },
    {
      "participant_id": 554,
      "type": {
        "developer_name": "SHOTS_TOTAL"
      },
      "data": {
        "value": 28
      }
    },
    {
      "participant_id": 939,
      "type": {
        "developer_name": "ATTACKS"
      },
      "data": {
        "value": 59
      }
    },
    {
      "participant_id": 554,
      "type": {
        "developer_name": "ATTACKS"
      },
      "data": {
        "value": 153
      }
    },
    {
      "participant_id": 939,
      "type": {
        "developer_name": "DANGEROUS_ATTACKS"
      },
      "data": {
        "value": 19
      }
    },
    {
      "participant_id": 554,
      "type": {
        "developer_name": "DANGEROUS_ATTACKS"
      },
      "data": {
        "value": 94
      }
    },
    {
      "participant_id": 939,
      "type": {
        "developer_name": "BALL_POSSESSION"
      },
      "data": {
        "value": 25
      }
    },
    {
      "participant_id": 554,
      "type": {
        "developer_name": "BALL_POSSESSION"
      },
      "data": {
        "value": 75
      }
    },
    {
      "participant_id": 939,
      "type": {
        "developer_name": "OFFSIDES"
      },
      "data": {
        "value": 0
      }
    },
    {
      "participant_id": 554,
      "type": {
        "developer_name": "OFFSIDES"
      },
      "data": {
        "value": 1
      }
    },
    {
      "participant_id": 939,
      "type": {
        "developer_name": "GOALS"
      },
      "data": {
        "value": 0
      }
    },
    {
      "participant_id": 554,
      "type": {
        "developer_name": "GOALS"
      },
      "data": {
        "value": 1
      }
    },
    {
      "participant_id": 939,
      "type": {
        "developer_name": "FREE_KICKS"
      },
      "data": {
        "value": 12
      }
    },
    {
      "participant_id": 554,
      "type": {
        "developer_name": "FREE_KICKS"
      },
      "data": {
        "value": 9
      }
    },
    {
      "participant_id": 939,
      "type": {
        "developer_name": "FOULS"
      },
      "data": {
        "value": 9
      }
    },
    {
      "participant_id": 554,
      "type": {
        "developer_name": "FOULS"
      },
      "data": {
        "value": 12
      }
    },
    {
      "participant_id": 939,
      "type": {
        "developer_name": "SAVES"
      },
      "data": {
        "value": 6
      }
    },
    {
      "participant_id": 554,
      "type": {
        "developer_name": "SAVES"
      },
      "data": {
        "value": 1
      }
    },
    {
      "participant_id": 939,
      "type": {
        "developer_name": "SHOTS_BLOCKED"
      },
      "data": {
        "value": 3
      }
    },
    {
      "participant_id": 554,
      "type": {
        "developer_name": "SHOTS_BLOCKED"
      },
      "data": {
        "value": 5
      }
    },
    {
      "participant_id": 939,
      "type": {
        "developer_name": "SUBSTITUTIONS"
      },
      "data": {
        "value": 4
      }
    },
    {
      "participant_id": 554,
      "type": {
        "developer_name": "SUBSTITUTIONS"
      },
      "data": {
        "value": 5
      }
    },
    {
      "participant_id": 939,
      "type": {
        "developer_name": "THROWINS"
      },
      "data": {
        "value": 10
      }
    },
    {
      "participant_id": 554,
      "type": {
        "developer_name": "THROWINS"
      },
      "data": {
        "value": 16
      }
    },
    {
      "participant_id": 939,
      "type": {
        "developer_name": "LONG_PASSES"
      },
      "data": {
        "value": 25
      }
    },
    {
      "participant_id": 554,
      "type": {
        "developer_name": "LONG_PASSES"
      },
      "data": {
        "value": 17
      }
    },
    {
      "participant_id": 939,
      "type": {
        "developer_name": "HIT_WOODWORK"
      },
      "data": {
        "value": 0
      }
    },
    {
      "participant_id": 554,
      "type": {
        "developer_name": "HIT_WOODWORK"
      },
      "data": {
        "value": 1
      }
    },
    {
      "participant_id": 939,
      "type": {
        "developer_name": "TACKLES"
      },
      "data": {
        "value": 9
      }
    },
    {
      "participant_id": 554,
      "type": {
        "developer_name": "TACKLES"
      },
      "data": {
        "value": 6
      }
    },
    {
      "participant_id": 939,
      "type": {
        "developer_name": "PASSES"
      },
      "data": {
        "value": 237
      }
    },
    {
      "participant_id": 554,
      "type": {
        "developer_name": "PASSES"
      },
      "data": {
        "value": 685
      }
    },
    {
      "participant_id": 939,
      "type": {
        "developer_name": "SUCCESSFUL_PASSES_PERCENTAGE"
      },
      "data": {
        "value": 62
      }
    },
    {
      "participant_id": 554,
      "type": {
        "developer_name": "SUCCESSFUL_PASSES_PERCENTAGE"
      },
      "data": {
        "value": 88
      }
    },
    {
      "participant_id": 939,
      "type": {
        "developer_name": "REDCARDS"
      },
      "data": {
        "value": 1
      }
    },
    {
      "participant_id": 554,
      "type": {
        "developer_name": "REDCARDS"
      },
      "data": {
        "value": 0
      }
    },
    {
      "participant_id": 939,
      "type": {
        "developer_name": "SHOTS_ON_TARGET"
      },
      "data": {
        "value": 1
      }
    },
    {
      "participant_id": 554,
      "type": {
        "developer_name": "SHOTS_ON_TARGET"
      },
      "data": {
        "value": 7
      }
    },
    {
      "participant_id": 939,
      "type": {
        "developer_name": "TOTAL_CROSSES"
      },
      "data": {
        "value": 3
      }
    },
    {
      "participant_id": 554,
      "type": {
        "developer_name": "TOTAL_CROSSES"
      },
      "data": {
        "value": 25
      }
    },
    {
      "participant_id": 939,
      "type": {
        "developer_name": "INTERCEPTIONS"
      },
      "data": {
        "value": 16
      }
    },
    {
      "participant_id": 554,
      "type": {
        "developer_name": "INTERCEPTIONS"
      },
      "data": {
        "value": 5
      }
    },
    {
      "participant_id": 939,
      "type": {
        "developer_name": "DRIBBLED_ATTEMPTS"
      },
      "data": {
        "value": 6
      }
    },
    {
      "participant_id": 554,
      "type": {
        "developer_name": "DRIBBLED_ATTEMPTS"
      },
      "data": {
        "value": 6
      }
    },
    {
      "participant_id": 939,
      "type": {
        "developer_name": "KEY_PASSES"
      },
      "data": {
        "value": 1
      }
    },
    {
      "participant_id": 554,
      "type": {
        "developer_name": "KEY_PASSES"
      },
      "data": {
        "value": 22
      }
    },
    {
      "participant_id": 939,
      "type": {
        "developer_name": "TACKLES_WON"
      },
      "data": {
        "value": 9
      }
    },
    {
      "participant_id": 554,
      "type": {
        "developer_name": "TACKLES_WON"
      },
      "data": {
        "value": 6
      }
    }
  ]
};

export const SM_BESIKTAS_MIDTJYLLAND_IDS = { home: 554, away: 939 };
