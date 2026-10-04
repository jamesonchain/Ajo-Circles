/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/ajo_circles.json`.
 */
export type AjoCircles = {
  "address": "B7YcA9vqKUF2Gkj6Ct8AG71a3upQftd7VwPBV7qjn3cw",
  "metadata": {
    "name": "ajoCircles",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "cancelCircle",
      "discriminator": [
        235,
        90,
        15,
        94,
        27,
        245,
        101,
        23
      ],
      "accounts": [
        {
          "name": "creator",
          "signer": true,
          "relations": [
            "circle"
          ]
        },
        {
          "name": "circle",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  105,
                  114,
                  99,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "account",
                "path": "circle.circle_id",
                "account": "circle"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "claimForfeitShare",
      "discriminator": [
        209,
        239,
        204,
        250,
        44,
        247,
        188,
        192
      ],
      "accounts": [
        {
          "name": "caller",
          "signer": true
        },
        {
          "name": "circle",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  105,
                  114,
                  99,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "circle.creator",
                "account": "circle"
              },
              {
                "kind": "account",
                "path": "circle.circle_id",
                "account": "circle"
              }
            ]
          },
          "relations": [
            "member"
          ]
        },
        {
          "name": "member",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              },
              {
                "kind": "account",
                "path": "member.wallet",
                "account": "member"
              }
            ]
          }
        },
        {
          "name": "depositVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  112,
                  111,
                  115,
                  105,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              }
            ]
          }
        },
        {
          "name": "destination",
          "writable": true
        },
        {
          "name": "mint"
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "claimPayout",
      "discriminator": [
        127,
        240,
        132,
        62,
        227,
        198,
        146,
        133
      ],
      "accounts": [
        {
          "name": "caller",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "circle",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  105,
                  114,
                  99,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "circle.creator",
                "account": "circle"
              },
              {
                "kind": "account",
                "path": "circle.circle_id",
                "account": "circle"
              }
            ]
          },
          "relations": [
            "recipientMember"
          ]
        },
        {
          "name": "recipientMember",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              },
              {
                "kind": "account",
                "path": "recipient_member.wallet",
                "account": "member"
              }
            ]
          }
        },
        {
          "name": "recipientWallet"
        },
        {
          "name": "potVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              }
            ]
          }
        },
        {
          "name": "depositVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  112,
                  111,
                  115,
                  105,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "mint"
        },
        {
          "name": "recipientTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "recipientWallet"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "contribute",
      "discriminator": [
        82,
        33,
        68,
        131,
        32,
        0,
        205,
        95
      ],
      "accounts": [
        {
          "name": "wallet",
          "writable": true,
          "signer": true,
          "relations": [
            "member"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "circle",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  105,
                  114,
                  99,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "circle.creator",
                "account": "circle"
              },
              {
                "kind": "account",
                "path": "circle.circle_id",
                "account": "circle"
              }
            ]
          },
          "relations": [
            "member"
          ]
        },
        {
          "name": "member",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              },
              {
                "kind": "account",
                "path": "wallet"
              }
            ]
          }
        },
        {
          "name": "source",
          "writable": true
        },
        {
          "name": "potVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "createCircle",
      "discriminator": [
        186,
        99,
        49,
        131,
        31,
        51,
        13,
        198
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "circle",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  105,
                  114,
                  99,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "arg",
                "path": "circleId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "circleId",
          "type": "u64"
        },
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "contribution",
          "type": "u64"
        },
        {
          "name": "periodSecs",
          "type": "i64"
        },
        {
          "name": "maxMembers",
          "type": "u8"
        }
      ]
    },
    {
      "name": "finalizeScore",
      "discriminator": [
        119,
        186,
        228,
        50,
        179,
        150,
        237,
        35
      ],
      "accounts": [
        {
          "name": "caller",
          "writable": true,
          "signer": true
        },
        {
          "name": "circle",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  105,
                  114,
                  99,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "circle.creator",
                "account": "circle"
              },
              {
                "kind": "account",
                "path": "circle.circle_id",
                "account": "circle"
              }
            ]
          },
          "relations": [
            "member"
          ]
        },
        {
          "name": "member",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              },
              {
                "kind": "account",
                "path": "member.wallet",
                "account": "member"
              }
            ]
          }
        },
        {
          "name": "score",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  99,
                  111,
                  114,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "member.wallet",
                "account": "member"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initConfig",
      "discriminator": [
        23,
        235,
        115,
        232,
        168,
        96,
        1,
        231
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "treasury"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "feeBps",
          "type": "u16"
        },
        {
          "name": "minPeriodSecs",
          "type": "i64"
        }
      ]
    },
    {
      "name": "initializeDepositVault",
      "discriminator": [
        186,
        57,
        99,
        237,
        54,
        248,
        125,
        207
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true,
          "relations": [
            "circle"
          ]
        },
        {
          "name": "circle",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  105,
                  114,
                  99,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "account",
                "path": "circle.circle_id",
                "account": "circle"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "depositVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  112,
                  111,
                  115,
                  105,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              }
            ]
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializePotVault",
      "discriminator": [
        23,
        204,
        87,
        161,
        192,
        159,
        233,
        84
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true,
          "relations": [
            "circle"
          ]
        },
        {
          "name": "circle",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  105,
                  114,
                  99,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "account",
                "path": "circle.circle_id",
                "account": "circle"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "potVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              }
            ]
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "joinCircle",
      "discriminator": [
        231,
        168,
        235,
        18,
        99,
        12,
        22,
        7
      ],
      "accounts": [
        {
          "name": "wallet",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "circle",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  105,
                  114,
                  99,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "circle.creator",
                "account": "circle"
              },
              {
                "kind": "account",
                "path": "circle.circle_id",
                "account": "circle"
              }
            ]
          }
        },
        {
          "name": "member",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              },
              {
                "kind": "account",
                "path": "wallet"
              }
            ]
          }
        },
        {
          "name": "source",
          "writable": true
        },
        {
          "name": "depositVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  112,
                  111,
                  115,
                  105,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "slot",
          "type": "u8"
        }
      ]
    },
    {
      "name": "refundDeposit",
      "discriminator": [
        19,
        19,
        78,
        50,
        187,
        10,
        162,
        229
      ],
      "accounts": [
        {
          "name": "wallet",
          "signer": true,
          "relations": [
            "member"
          ]
        },
        {
          "name": "circle",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  105,
                  114,
                  99,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "circle.creator",
                "account": "circle"
              },
              {
                "kind": "account",
                "path": "circle.circle_id",
                "account": "circle"
              }
            ]
          },
          "relations": [
            "member"
          ]
        },
        {
          "name": "member",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              },
              {
                "kind": "account",
                "path": "wallet"
              }
            ]
          }
        },
        {
          "name": "depositVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  112,
                  111,
                  115,
                  105,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              }
            ]
          }
        },
        {
          "name": "destination",
          "writable": true
        },
        {
          "name": "mint"
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "settleDefault",
      "discriminator": [
        246,
        228,
        125,
        180,
        94,
        53,
        233,
        137
      ],
      "accounts": [
        {
          "name": "caller",
          "signer": true
        },
        {
          "name": "circle",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  105,
                  114,
                  99,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "circle.creator",
                "account": "circle"
              },
              {
                "kind": "account",
                "path": "circle.circle_id",
                "account": "circle"
              }
            ]
          },
          "relations": [
            "member"
          ]
        },
        {
          "name": "member",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              },
              {
                "kind": "account",
                "path": "member.wallet",
                "account": "member"
              }
            ]
          }
        },
        {
          "name": "depositVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  112,
                  111,
                  115,
                  105,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              }
            ]
          }
        },
        {
          "name": "potVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "withdrawDeposit",
      "discriminator": [
        197,
        59,
        182,
        208,
        73,
        187,
        119,
        25
      ],
      "accounts": [
        {
          "name": "wallet",
          "signer": true,
          "relations": [
            "member"
          ]
        },
        {
          "name": "circle",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  105,
                  114,
                  99,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "circle.creator",
                "account": "circle"
              },
              {
                "kind": "account",
                "path": "circle.circle_id",
                "account": "circle"
              }
            ]
          },
          "relations": [
            "member"
          ]
        },
        {
          "name": "member",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              },
              {
                "kind": "account",
                "path": "wallet"
              }
            ]
          }
        },
        {
          "name": "depositVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  112,
                  111,
                  115,
                  105,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              }
            ]
          }
        },
        {
          "name": "destination",
          "writable": true
        },
        {
          "name": "mint"
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "ajoScore",
      "discriminator": [
        63,
        149,
        124,
        201,
        10,
        95,
        122,
        96
      ]
    },
    {
      "name": "circle",
      "discriminator": [
        27,
        59,
        8,
        117,
        62,
        199,
        222,
        252
      ]
    },
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "member",
      "discriminator": [
        54,
        19,
        162,
        21,
        29,
        166,
        17,
        198
      ]
    }
  ],
  "events": [
    {
      "name": "circleCancelled",
      "discriminator": [
        157,
        78,
        233,
        166,
        164,
        172,
        132,
        75
      ]
    },
    {
      "name": "circleCompleted",
      "discriminator": [
        188,
        139,
        54,
        215,
        94,
        34,
        139,
        54
      ]
    },
    {
      "name": "circleCreated",
      "discriminator": [
        210,
        110,
        215,
        179,
        247,
        145,
        243,
        135
      ]
    },
    {
      "name": "contributed",
      "discriminator": [
        196,
        199,
        157,
        136,
        180,
        222,
        100,
        118
      ]
    },
    {
      "name": "defaultSettled",
      "discriminator": [
        157,
        103,
        28,
        104,
        9,
        29,
        56,
        40
      ]
    },
    {
      "name": "depositRefunded",
      "discriminator": [
        182,
        155,
        48,
        105,
        176,
        178,
        212,
        215
      ]
    },
    {
      "name": "depositWithdrawn",
      "discriminator": [
        152,
        139,
        194,
        204,
        237,
        235,
        26,
        134
      ]
    },
    {
      "name": "memberJoined",
      "discriminator": [
        156,
        199,
        149,
        88,
        193,
        203,
        191,
        210
      ]
    },
    {
      "name": "payoutClaimed",
      "discriminator": [
        200,
        39,
        105,
        112,
        116,
        63,
        58,
        149
      ]
    },
    {
      "name": "payoutForfeited",
      "discriminator": [
        182,
        23,
        225,
        144,
        254,
        239,
        229,
        79
      ]
    },
    {
      "name": "scoreUpdated",
      "discriminator": [
        175,
        144,
        206,
        62,
        108,
        213,
        230,
        183
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidFee",
      "msg": "The fee is outside the allowed range"
    },
    {
      "code": 6001,
      "name": "invalidMinimumPeriod",
      "msg": "The minimum period must be positive"
    },
    {
      "code": 6002,
      "name": "nameTooLong",
      "msg": "The circle name is too long"
    },
    {
      "code": 6003,
      "name": "invalidContribution",
      "msg": "The contribution must be positive"
    },
    {
      "code": 6004,
      "name": "periodTooShort",
      "msg": "The period is below the configured minimum"
    },
    {
      "code": 6005,
      "name": "invalidMemberCount",
      "msg": "The member count must be between 3 and 12"
    },
    {
      "code": 6006,
      "name": "invalidSlot",
      "msg": "The selected slot is outside the circle"
    },
    {
      "code": 6007,
      "name": "slotTaken",
      "msg": "The selected slot is already taken"
    },
    {
      "code": 6008,
      "name": "circleNotForming",
      "msg": "The circle is not forming"
    },
    {
      "code": 6009,
      "name": "circleNotActive",
      "msg": "The circle is not active"
    },
    {
      "code": 6010,
      "name": "alreadyPaid",
      "msg": "The member has already paid this round"
    },
    {
      "code": 6011,
      "name": "deadlinePassed",
      "msg": "The round deadline has passed"
    },
    {
      "code": 6012,
      "name": "mintMismatch",
      "msg": "The account mint does not match the circle mint"
    },
    {
      "code": 6013,
      "name": "tokenOwnerMismatch",
      "msg": "The token account is not owned by the expected wallet"
    },
    {
      "code": 6014,
      "name": "mathOverflow",
      "msg": "The arithmetic operation would overflow"
    },
    {
      "code": 6015,
      "name": "circleNotFull",
      "msg": "The circle must have all members before this action"
    },
    {
      "code": 6016,
      "name": "deadlineNotPassed",
      "msg": "The round is still open"
    },
    {
      "code": 6017,
      "name": "alreadySettled",
      "msg": "The member has already been settled for this round"
    },
    {
      "code": 6018,
      "name": "payoutNotReady",
      "msg": "The payout is not ready"
    },
    {
      "code": 6019,
      "name": "wrongRecipient",
      "msg": "The payout recipient does not match the current turn"
    },
    {
      "code": 6020,
      "name": "circleComplete",
      "msg": "The circle is already complete"
    },
    {
      "code": 6021,
      "name": "circleNotCancelled",
      "msg": "The circle is not cancelled"
    },
    {
      "code": 6022,
      "name": "noDeposit",
      "msg": "The member has no deposit remaining"
    },
    {
      "code": 6023,
      "name": "depositAlreadyWithdrawn",
      "msg": "The deposit has already been withdrawn"
    },
    {
      "code": 6024,
      "name": "circleNotCompleted",
      "msg": "The circle is not completed"
    },
    {
      "code": 6025,
      "name": "payoutAlreadyClaimed",
      "msg": "The payout has already been claimed"
    },
    {
      "code": 6026,
      "name": "noForfeitShare",
      "msg": "No eligible forfeiture share remains"
    },
    {
      "code": 6027,
      "name": "forfeitShareAlreadyClaimed",
      "msg": "The forfeiture share has already been claimed"
    },
    {
      "code": 6028,
      "name": "scoreAlreadyRecorded",
      "msg": "The score has already been recorded"
    },
    {
      "code": 6029,
      "name": "memberMismatch",
      "msg": "The account is not the expected circle member"
    }
  ],
  "types": [
    {
      "name": "ajoScore",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "circlesJoined",
            "type": "u32"
          },
          {
            "name": "circlesCompleted",
            "type": "u32"
          },
          {
            "name": "roundsPaidOnTime",
            "type": "u64"
          },
          {
            "name": "roundsDefaulted",
            "type": "u64"
          },
          {
            "name": "totalContributed",
            "type": "u64"
          },
          {
            "name": "lastUpdatedTs",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "circle",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "circleId",
            "type": "u64"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "contribution",
            "type": "u64"
          },
          {
            "name": "periodSecs",
            "type": "i64"
          },
          {
            "name": "maxMembers",
            "type": "u8"
          },
          {
            "name": "memberCount",
            "type": "u8"
          },
          {
            "name": "slotsTaken",
            "type": "u16"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "circleStatus"
              }
            }
          },
          {
            "name": "currentRound",
            "type": "u8"
          },
          {
            "name": "roundStartTs",
            "type": "i64"
          },
          {
            "name": "contributionsThisRound",
            "type": "u8"
          },
          {
            "name": "totalPaidOut",
            "type": "u64"
          },
          {
            "name": "createdTs",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "shortfallTotal",
            "type": "u64"
          },
          {
            "name": "forfeitPool",
            "type": "u64"
          },
          {
            "name": "forfeitTotal",
            "type": "u64"
          },
          {
            "name": "forfeitClaims",
            "type": "u8"
          },
          {
            "name": "eligibleMembers",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "circleCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "circle",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "circleCompleted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "circle",
            "type": "pubkey"
          },
          {
            "name": "totalPaidOut",
            "type": "u64"
          },
          {
            "name": "forfeitPool",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "circleCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "circle",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "circleId",
            "type": "u64"
          },
          {
            "name": "contribution",
            "type": "u64"
          },
          {
            "name": "maxMembers",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "circleStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "forming"
          },
          {
            "name": "active"
          },
          {
            "name": "completed"
          },
          {
            "name": "cancelled"
          }
        ]
      }
    },
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "minPeriodSecs",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "contributed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "circle",
            "type": "pubkey"
          },
          {
            "name": "member",
            "type": "pubkey"
          },
          {
            "name": "round",
            "type": "u8"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "defaultSettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "circle",
            "type": "pubkey"
          },
          {
            "name": "member",
            "type": "pubkey"
          },
          {
            "name": "round",
            "type": "u8"
          },
          {
            "name": "covered",
            "type": "u64"
          },
          {
            "name": "shortfall",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "depositRefunded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "circle",
            "type": "pubkey"
          },
          {
            "name": "member",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "depositWithdrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "circle",
            "type": "pubkey"
          },
          {
            "name": "member",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "member",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "circle",
            "type": "pubkey"
          },
          {
            "name": "slot",
            "type": "u8"
          },
          {
            "name": "depositTotal",
            "type": "u64"
          },
          {
            "name": "depositRemaining",
            "type": "u64"
          },
          {
            "name": "paidBitmask",
            "type": "u16"
          },
          {
            "name": "defaults",
            "type": "u8"
          },
          {
            "name": "received",
            "type": "bool"
          },
          {
            "name": "depositWithdrawn",
            "type": "bool"
          },
          {
            "name": "scoreRecorded",
            "type": "bool"
          },
          {
            "name": "paidOnTime",
            "type": "u8"
          },
          {
            "name": "contributedTotal",
            "type": "u64"
          },
          {
            "name": "forfeitClaimed",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "memberJoined",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "circle",
            "type": "pubkey"
          },
          {
            "name": "member",
            "type": "pubkey"
          },
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "slot",
            "type": "u8"
          },
          {
            "name": "deposit",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "payoutClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "circle",
            "type": "pubkey"
          },
          {
            "name": "member",
            "type": "pubkey"
          },
          {
            "name": "round",
            "type": "u8"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "payoutForfeited",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "circle",
            "type": "pubkey"
          },
          {
            "name": "member",
            "type": "pubkey"
          },
          {
            "name": "round",
            "type": "u8"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "scoreUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "circlesCompleted",
            "type": "u32"
          },
          {
            "name": "roundsPaidOnTime",
            "type": "u64"
          },
          {
            "name": "roundsDefaulted",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
