import { busbarDef, isNamedNetKind, netTerminalDef, termBlockDef, NET_TERMINAL_DEFAULT_PINS } from "./namedNets";
import type {
  CatalogGroup,
  CatalogItem,
  Circuit,
  DeviceKind,
  DeviceParams,
  TerminalDef,
} from "./types";

export interface VariantDef {
  w: number;
  h: number;
  terminals: TerminalDef[];
}

export interface KindMeta {
  prefix: string;
  label: string;
  variants: Record<string, VariantDef>;
}

function t(id: string, x: number, y: number, label = id): TerminalDef {
  return { id, label, x, y };
}

/** Grids from each terminal to the contact bars. */
export const CONTACT_LEAD = 1;
const CONTACT_W = 4;

const contactBody: VariantDef = {
  w: CONTACT_W,
  h: 2,
  terminals: [t("1", 0, 1), t("2", CONTACT_W, 1)],
};

/** SPDT: 1-2 working throw, 3-4 opposite throw. */
const contactSpdt: VariantDef = {
  w: CONTACT_W,
  h: 4,
  terminals: [
    t("1", 0, 1),
    t("2", CONTACT_W, 1),
    t("3", 0, 3),
    t("4", CONTACT_W, 3),
  ],
};

const pbBody: VariantDef = {
  w: 4,
  h: 2,
  terminals: [t("1", 0, 1), t("2", 4, 1)],
};

const coilBody: VariantDef = {
  w: 4,
  h: 2,
  terminals: [t("A1", 0, 1, "A1"), t("A2", 4, 1, "A2")],
};

const meterBody: VariantDef = {
  w: 4,
  h: 2,
  terminals: [t("1", 0, 1, "+"), t("2", 4, 1, "-")],
};

const timerVariants: KindMeta["variants"] = {
  coil: coilBody,
  "delayed-nc": {
    w: CONTACT_W,
    h: 2,
    terminals: [t("15", 0, 1, "15"), t("16", CONTACT_W, 1, "16")],
  },
  "delayed-no": {
    w: CONTACT_W,
    h: 2,
    terminals: [t("15", 0, 1, "15"), t("18", CONTACT_W, 1, "18")],
  },
  "inst-nc": {
    w: CONTACT_W,
    h: 2,
    terminals: [t("21", 0, 1, "21"), t("22", CONTACT_W, 1, "22")],
  },
  "inst-no": {
    w: CONTACT_W,
    h: 2,
    terminals: [t("21", 0, 1, "21"), t("24", CONTACT_W, 1, "24")],
  },
};

const timerSsOnVariants: KindMeta["variants"] = {
  coil: {
    w: 4,
    h: 2,
    terminals: [t("2", 0, 1, "2"), t("7", 4, 1, "7")],
  },
  "delayed-nc": {
    w: CONTACT_W,
    h: 2,
    terminals: [t("1", 0, 1, "1"), t("4", CONTACT_W, 1, "4")],
  },
  "delayed-no": {
    w: CONTACT_W,
    h: 2,
    terminals: [t("1", 0, 1, "1"), t("3", CONTACT_W, 1, "3")],
  },
  "delayed-nc2": {
    w: CONTACT_W,
    h: 2,
    terminals: [t("8", 0, 1, "8"), t("5", CONTACT_W, 1, "5")],
  },
  "delayed-no2": {
    w: CONTACT_W,
    h: 2,
    terminals: [t("8", 0, 1, "8"), t("6", CONTACT_W, 1, "6")],
  },
  "inst-nc": {
    w: CONTACT_W,
    h: 2,
    terminals: [t("1", 0, 1, "1"), t("4", CONTACT_W, 1, "4")],
  },
  "inst-no": {
    w: CONTACT_W,
    h: 2,
    terminals: [t("1", 0, 1, "1"), t("3", CONTACT_W, 1, "3")],
  },
};

const timerSsOffVariants: KindMeta["variants"] = {
  coil: {
    w: 6,
    h: 4,
    terminals: [
      t("2", 0, 1, "2"),
      t("10", 6, 1, "10"),
      t("5", 0, 3, "5"),
      t("6", 6, 3, "6"),
    ],
  },
  "delayed-nc": {
    w: CONTACT_W,
    h: 2,
    terminals: [t("1", 0, 1, "1"), t("4", CONTACT_W, 1, "4")],
  },
  "delayed-no": {
    w: CONTACT_W,
    h: 2,
    terminals: [t("1", 0, 1, "1"), t("3", CONTACT_W, 1, "3")],
  },
  "delayed-nc2": {
    w: CONTACT_W,
    h: 2,
    terminals: [t("11", 0, 1, "11"), t("8", CONTACT_W, 1, "8")],
  },
  "delayed-no2": {
    w: CONTACT_W,
    h: 2,
    terminals: [t("11", 0, 1, "11"), t("9", CONTACT_W, 1, "9")],
  },
  "inst-nc": {
    w: CONTACT_W,
    h: 2,
    terminals: [t("1", 0, 1, "1"), t("4", CONTACT_W, 1, "4")],
  },
  "inst-no": {
    w: CONTACT_W,
    h: 2,
    terminals: [t("1", 0, 1, "1"), t("3", CONTACT_W, 1, "3")],
  },
};

const twoTermVert: VariantDef = {
  w: 2,
  h: 4,
  terminals: [t("1", 1, 0), t("2", 1, 4)],
};

const twoTermHoriz: VariantDef = {
  w: 4,
  h: 2,
  terminals: [t("1", 0, 1), t("2", 4, 1)],
};

const breaker3pBody: VariantDef = {
  w: 6,
  h: 4,
  terminals: [
    t("L3", 1, 0, "L3"),
    t("L2", 3, 0, "L2"),
    t("L1", 5, 0, "L1"),
    t("T3", 1, 4, "T3"),
    t("T2", 3, 4, "T2"),
    t("T1", 5, 4, "T1"),
    t("5", 1, 0, "L3"),
    t("3", 3, 0, "L2"),
    t("1", 5, 0, "L1"),
    t("6", 1, 4, "T3"),
    t("4", 3, 4, "T2"),
    t("2", 5, 4, "T1"),
  ],
};

const isolatorBody: VariantDef = {
  w: 4,
  h: 6,
  terminals: [
    t("L1", 0, 1, "L1"),
    t("L2", 0, 3, "L2"),
    t("L3", 0, 5, "L3"),
    t("T1", 4, 1, "T1"),
    t("T2", 4, 3, "T2"),
    t("T3", 4, 5, "T3"),
    t("1", 0, 1, "L1"),
    t("3", 0, 3, "L2"),
    t("5", 0, 5, "L3"),
    t("2", 4, 1, "T1"),
    t("4", 4, 3, "T2"),
    t("6", 4, 5, "T3"),
  ],
};

const fuse2pBody: VariantDef = {
  w: 4,
  h: 4,
  terminals: [
    t("1", 1, 0),
    t("3", 3, 0),
    t("2", 1, 4),
    t("4", 3, 4),
  ],
};

const fuse3pBody: VariantDef = {
  w: 6,
  h: 4,
  terminals: [
    t("1", 1, 0),
    t("3", 3, 0),
    t("5", 5, 0),
    t("2", 1, 4),
    t("4", 3, 4),
    t("6", 5, 4),
  ],
};

const starterBody: VariantDef = {
  w: 8,
  h: 10,
  terminals: [
    t("L1", 0, 1),
    t("L2", 0, 3),
    t("L3", 0, 5),
    t("T1", 8, 1),
    t("T2", 8, 3),
    t("T3", 8, 5),
    t("A1", 0, 7),
    t("A2", 8, 7),
    t("95", 1, 10, "95"),
    t("96", 3, 10, "96"),
    t("97", 5, 10, "97"),
    t("98", 7, 10, "98"),
    t("13", 1, 0, "13"),
    t("14", 3, 0, "14"),
    t("21", 5, 0, "21"),
    t("22", 7, 0, "22"),
  ],
};

const wyeMains: VariantDef = {
  w: 4,
  h: 10,
  terminals: [
    t("L1", 4, 1),
    t("L2", 4, 3),
    t("L3", 4, 5),
    t("N", 4, 7),
    t("PE", 4, 9),
  ],
};

const deltaMains: VariantDef = {
  w: 4,
  h: 8,
  terminals: [
    t("L1", 4, 1),
    t("L2", 4, 3),
    t("L3", 4, 5),
    t("PE", 4, 7),
  ],
};

export const KINDS: Record<DeviceKind, KindMeta> = {
  "mains-3ph": {
    prefix: "PWR",
    label: "三相電源",
    variants: {
      body: wyeMains,
      wye: wyeMains,
      delta: deltaMains,
    },
  },
  "dc-supply": {
    prefix: "PWS",
    label: "直流電源",
    variants: {
      body: {
        w: 4,
        h: 6,
        terminals: [t("+", 4, 1, "+"), t("-", 4, 3, "−"), t("PE", 4, 5, "PE")],
      },
    },
  },
  transformer: {
    prefix: "T",
    label: "控制變壓器",
    variants: {
      body: {
        w: 6,
        h: 8,
        terminals: [
          t("H1", 0, 1, "H1"),
          t("H2", 0, 3, "H2"),
          t("H3", 0, 5, "H3"),
          t("H4", 0, 7, "H4"),
          t("X1", 6, 1, "X1"),
          t("X2", 6, 7, "X2"),
        ],
      },
    },
  },
  "breaker-1p": {
    prefix: "CB",
    label: "單極斷路器",
    variants: {
      body: {
        w: 2,
        h: 4,
        terminals: [t("1", 1, 0), t("2", 1, 4)],
      },
    },
  },
  "breaker-3p": {
    prefix: "CB",
    label: "三極斷路器",
    variants: { body: breaker3pBody },
  },
  rcd: {
    prefix: "GFCI",
    label: "接地故障斷路器",
    variants: {
      body: {
        w: 6,
        h: 8,
        terminals: [
          t("L1", 0, 1),
          t("L2", 0, 3),
          t("L3", 0, 5),
          t("N", 0, 7),
          t("T1", 6, 1),
          t("T2", 6, 3),
          t("T3", 6, 5),
          t("TN", 6, 7, "N"),
        ],
      },
    },
  },
  fuse: {
    prefix: "FU",
    label: "熔斷器",
    variants: {
      body: twoTermVert,     // Single pole
      body2: fuse2pBody,     // Two poles
      body3: fuse3pBody,     // Three poles
    },
  },
  isolator: {
    prefix: "DISC",
    label: "隔離開關",
    variants: {
      body: isolatorBody,
      body1: {
        w: 4,
        h: 2,
        terminals: [t("L1", 0, 1, "L1"), t("T1", 4, 1, "T1"), t("1", 0, 1, "L1"), t("2", 4, 1, "T1")],
      },
      body2: {
        w: 4,
        h: 4,
        terminals: [
          t("L1", 0, 1, "L1"),
          t("L2", 0, 3, "L2"),
          t("T1", 4, 1, "T1"),
          t("T2", 4, 3, "T2"),
          t("1", 0, 1, "L1"),
          t("3", 0, 3, "L2"),
          t("2", 4, 1, "T1"),
          t("4", 4, 3, "T2"),
        ],
      },
    },
  },
  "breaker-2p": {
    prefix: "CB",
    label: "雙極斷路器",
    variants: {
      body: {
        w: 4,
        h: 4,
        terminals: [t("1", 1, 0), t("3", 3, 0), t("2", 1, 4), t("4", 3, 4)],
      },
    },
  },
  overload: {
    prefix: "OL",
    label: "熱繼電器",
    variants: {
      body: {
        w: 6,
        h: 4,
        terminals: [
          t("L3", 1, 0, "L3"),
          t("L2", 3, 0, "L2"),
          t("L1", 5, 0, "L1"),
          t("T3", 1, 4, "T3"),
          t("T2", 3, 4, "T2"),
          t("T1", 5, 4, "T1"),
          t("5", 1, 0, "L3"),
          t("3", 3, 0, "L2"),
          t("1", 5, 0, "L1"),
          t("6", 1, 4, "T3"),
          t("4", 3, 4, "T2"),
          t("2", 5, 4, "T1"),
        ],
      },
      main: {
        w: 6,
        h: 4,
        terminals: [
          t("L3", 1, 0, "L3"),
          t("L2", 3, 0, "L2"),
          t("L1", 5, 0, "L1"),
          t("T3", 1, 4, "T3"),
          t("T2", 3, 4, "T2"),
          t("T1", 5, 4, "T1"),
          t("5", 1, 0, "L3"),
          t("3", 3, 0, "L2"),
          t("1", 5, 0, "L1"),
          t("6", 1, 4, "T3"),
          t("4", 3, 4, "T2"),
          t("2", 5, 4, "T1"),
        ],
      },
      "aux-nc": {
        w: CONTACT_W,
        h: 2,
        terminals: [t("95", 0, 1, "95"), t("96", CONTACT_W, 1, "96")],
      },
      "aux-no": {
        w: CONTACT_W,
        h: 2,
        terminals: [t("97", 0, 1, "97"), t("98", CONTACT_W, 1, "98")],
      },
    },
  },
  "pb-no": { prefix: "PB", label: "常開按鈕", variants: { body: pbBody } },
  "pb-nc": { prefix: "PB", label: "常閉按鈕", variants: { body: pbBody } },
  estop: { prefix: "PB", label: "急停按鈕", variants: { body: pbBody } },
  "estop-nc": {
    prefix: "PB",
    label: "急停常閉",
    variants: {
      body: {
        w: 4,
        h: 2,
        terminals: [t("11", 0, 1, "11"), t("12", 4, 1, "12")],
      },
    },
  },
  "estop-no": {
    prefix: "PB",
    label: "急停常開",
    variants: {
      body: {
        w: 4,
        h: 2,
        terminals: [t("13", 0, 1, "13"), t("14", 4, 1, "14")],
      },
    },
  },
  "selector-2": {
    prefix: "SS",
    label: "選擇開關 2 檔",
    variants: {
      body: {
        w: 4,
        h: 4,
        terminals: [t("1", 0, 1, "1"), t("2", 4, 1, "2"), t("3", 0, 3, "3"), t("4", 4, 3, "4")],
      },
    },
  },
  "selector-3": {
    prefix: "SS",
    label: "正-停-反 選擇開關",
    variants: {
      body: {
        w: 4,
        h: 4,
        terminals: [
          t("COM", 0, 1, "COM"),
          t("FWD", 4, 1, "FWD"),
          t("COM2", 0, 3, "COM2"),
          t("REV", 4, 3, "REV"),
        ],
      },
    },
  },
  toggle: { prefix: "TGS", label: "撥動開關", variants: { body: contactSpdt } },
  "toggle-spst": {
    prefix: "TGS",
    label: "SPST 撥動開關",
    variants: {
      body: {
        w: 4,
        h: 2,
        terminals: [t("1", 0, 1, "1"), t("2", 4, 1, "2")],
      },
    },
  },
  "toggle-spdt": {
    prefix: "TGS",
    label: "SPDT 撥動開關",
    variants: {
      body: {
        w: 4,
        h: 4,
        terminals: [t("1", 0, 2, "COM"), t("2", 4, 1, "NC"), t("3", 4, 3, "NO")],
      },
    },
  },
  "toggle-dpst": {
    prefix: "TGS",
    label: "DPST 撥動開關",
    variants: {
      body: {
        w: 4,
        h: 4,
        terminals: [t("1", 0, 1, "1"), t("2", 4, 1, "2"), t("3", 0, 3, "3"), t("4", 4, 3, "4")],
      },
    },
  },
  "toggle-dpdt": {
    prefix: "TGS",
    label: "DPDT 撥動開關",
    variants: {
      body: {
        w: 4,
        h: 8,
        terminals: [
          t("1", 0, 2, "COM1"), t("2", 4, 1, "NC1"), t("3", 4, 3, "NO1"),
          t("4", 0, 6, "COM2"), t("5", 4, 5, "NC2"), t("6", 4, 7, "NO2"),
        ],
      },
    },
  },
  "toggle-4pdt": {
    prefix: "TGS",
    label: "4PDT 撥動開關",
    variants: {
      body: {
        w: 4,
        h: 16,
        terminals: [
          t("1", 0, 2, "COM1"), t("2", 4, 1, "NC1"), t("3", 4, 3, "NO1"),
          t("4", 0, 6, "COM2"), t("5", 4, 5, "NC2"), t("6", 4, 7, "NO2"),
          t("7", 0, 10, "COM3"), t("8", 4, 9, "NC3"), t("9", 4, 11, "NO3"),
          t("10", 0, 14, "COM4"), t("11", 4, 13, "NC4"), t("12", 4, 15, "NO4"),
        ],
      },
    },
  },
  "limit-no": {
    prefix: "LS",
    label: "限位常開",
    variants: {
      body: {
        w: 4,
        h: 2,
        terminals: [t("1", 0, 1), t("2", 4, 1)],
      },
    },
  },
  "limit-nc": {
    prefix: "LS",
    label: "限位常閉",
    variants: {
      body: {
        w: 4,
        h: 2,
        terminals: [t("1", 0, 1), t("2", 4, 1)],
      },
    },
  },
  foot: { prefix: "FTS", label: "腳踏開關", variants: { body: contactSpdt } },
  "foot-no": {
    prefix: "FTS",
    label: "腳踏常開",
    variants: {
      body: {
        w: 4,
        h: 2,
        terminals: [t("1", 0, 1), t("2", 4, 1)],
      },
    },
  },
  "foot-nc": {
    prefix: "FTS",
    label: "腳踏常閉",
    variants: {
      body: {
        w: 4,
        h: 2,
        terminals: [t("1", 0, 1), t("2", 4, 1)],
      },
    },
  },
  "float-no": {
    prefix: "FS",
    label: "液位開關 常開",
    variants: { body: { w: 4, h: 2, terminals: [t("1", 0, 1), t("2", 4, 1)] } },
  },
  "float-nc": {
    prefix: "FS",
    label: "液位開關 常閉",
    variants: { body: { w: 4, h: 2, terminals: [t("1", 0, 1), t("2", 4, 1)] } },
  },
  float: {
    prefix: "FS",
    label: "液位／浮球開關",
    variants: {
      body: {
        w: 4,
        h: 2,
        terminals: [
          t("1", 0, 1),
          t("2", 4, 1),
          t("COM", 0, 1, "1"),
          t("NC", 4, 1, "2"),
          t("NO", 4, 1, "2"),
        ],
      },
    },
  },
  "temp-no": {
    prefix: "TAS",
    label: "溫度開關 常開",
    variants: { body: { w: 4, h: 2, terminals: [t("1", 0, 1), t("2", 4, 1)] } },
  },
  "temp-nc": {
    prefix: "TAS",
    label: "溫度開關 常閉",
    variants: { body: { w: 4, h: 2, terminals: [t("1", 0, 1), t("2", 4, 1)] } },
  },
  "pressure-no": {
    prefix: "PS",
    label: "壓力開關 常開",
    variants: { body: { w: 4, h: 2, terminals: [t("1", 0, 1), t("2", 4, 1)] } },
  },
  "pressure-nc": {
    prefix: "PS",
    label: "壓力開關 常閉",
    variants: { body: { w: 4, h: 2, terminals: [t("1", 0, 1), t("2", 4, 1)] } },
  },
  "flow-no": {
    prefix: "FLS",
    label: "流量開關 常開",
    variants: { body: { w: 4, h: 2, terminals: [t("1", 0, 1), t("2", 4, 1)] } },
  },
  "flow-nc": {
    prefix: "FLS",
    label: "流量開關 常閉",
    variants: { body: { w: 4, h: 2, terminals: [t("1", 0, 1), t("2", 4, 1)] } },
  },
  "prox-no": { prefix: "PRS", label: "接近開關 常開", variants: { body: contactBody } },
  "prox-nc": { prefix: "PRS", label: "接近開關 常閉", variants: { body: contactBody } },
  prox: { prefix: "PRS", label: "接近開關", variants: { body: contactBody } },
  "photo-no": { prefix: "PEC", label: "光電開關 常開", variants: { body: contactBody } },
  "photo-nc": { prefix: "PEC", label: "光電開關 常閉", variants: { body: contactBody } },
  photo: { prefix: "PEC", label: "光電開關", variants: { body: contactBody } },
  contactor: {
    prefix: "M",
    label: "接觸器",
    variants: {
      coil: coilBody,
      main: {
        w: 6,
        h: 6,
        terminals: [
          t("L1", 0, 1),
          t("L2", 0, 3),
          t("L3", 0, 5),
          t("T1", 6, 1),
          t("T2", 6, 3),
          t("T3", 6, 5),
          t("1", 0, 1, "L1"),
          t("3", 0, 3, "L2"),
          t("5", 0, 5, "L3"),
          t("2", 6, 1, "T1"),
          t("4", 6, 3, "T2"),
          t("6", 6, 5, "T3"),
        ],
      },
      "aux-no": {
        w: CONTACT_W,
        h: 2,
        terminals: [t("13", 0, 1, "13"), t("14", CONTACT_W, 1, "14")],
      },
      "aux-nc": {
        w: CONTACT_W,
        h: 2,
        terminals: [t("21", 0, 1, "21"), t("22", CONTACT_W, 1, "22")],
      },
      "aux-no2": {
        w: CONTACT_W,
        h: 2,
        terminals: [t("43", 0, 1, "43"), t("44", CONTACT_W, 1, "44")],
      },
      "aux-nc2": {
        w: CONTACT_W,
        h: 2,
        terminals: [t("31", 0, 1, "31"), t("32", CONTACT_W, 1, "32")],
      },
    },
  },
  relay: {
    prefix: "CR",
    label: "Intermediate Relay",
    variants: {
      coil: coilBody,
      "aux-no": {
        w: CONTACT_W,
        h: 2,
        terminals: [
          t("13", 0, 1, "13"),
          t("14", CONTACT_W, 1, "14"),
          t("1", 0, 1, "13"),
          t("2", CONTACT_W, 1, "14"),
        ],
      },
      "aux-nc": {
        w: CONTACT_W,
        h: 2,
        terminals: [
          t("21", 0, 1, "21"),
          t("22", CONTACT_W, 1, "22"),
          t("3", 0, 1, "21"),
          t("4", CONTACT_W, 1, "22"),
        ],
      },
      "aux-no2": {
        w: CONTACT_W,
        h: 2,
        terminals: [
          t("43", 0, 1, "43"),
          t("44", CONTACT_W, 1, "44"),
          t("5", 0, 1, "43"),
          t("6", CONTACT_W, 1, "44"),
        ],
      },
      "aux-nc2": {
        w: CONTACT_W,
        h: 2,
        terminals: [
          t("31", 0, 1, "31"),
          t("32", CONTACT_W, 1, "32"),
          t("7", 0, 1, "31"),
          t("8", CONTACT_W, 1, "32"),
        ],
      },
    },
  },
  "timer-on": {
    prefix: "TR",
    label: "通電延時",
    variants: timerVariants,
  },
  "timer-off": {
    prefix: "TR",
    label: "斷電延時",
    variants: timerVariants,
  },
  "timer-ss-on": {
    prefix: "TR",
    label: "固態通電延時",
    variants: timerSsOnVariants,
  },
  "timer-ss-off": {
    prefix: "TR",
    label: "固態斷電延時",
    variants: timerSsOffVariants,
  },
  counter: {
    prefix: "CTR",
    label: "計數器",
    variants: {
      body: {
        w: 6,
        h: 6,
        terminals: [
          t("A1", 0, 2, "A1"),
          t("A2", 6, 2, "A2"),
          t("R1", 0, 4, "R1"),
          t("R2", 6, 4, "R2"),
          t("1", 2, 6, "1"),
          t("2", 4, 6, "2"),
        ],
      },
    },
  },
  lamp: {
    prefix: "LT",
    label: "指示燈",
    variants: {
      body: {
        w: 2,
        h: 4,
        terminals: [t("1", 1, 0, "1"), t("2", 1, 4, "2")],
      },
    },
  },
  alarm: { prefix: "ABE", label: "報警器", variants: { body: twoTermHoriz } },
  horn: { prefix: "AH", label: "電笛", variants: { body: twoTermHoriz } },
  fan: {
    prefix: "FAN",
    label: "風扇",
    variants: {
      body: {
        w: 4,
        h: 4,
        terminals: [t("U1", 0, 2, "U1"), t("U2", 4, 2, "U2")],
      },
    },
  },
  heater: { prefix: "HTR", label: "電熱器", variants: { body: twoTermHoriz } },
  solenoid: {
    prefix: "SOL",
    label: "電磁閥",
    variants: {
      body: {
        w: 4,
        h: 2,
        terminals: [t("A1", 0, 1, "A1"), t("A2", 4, 1, "A2")],
      },
    },
  },
  "motor-3ph": {
    prefix: "MTR",
    label: "三相異步電機",
    variants: {
      body: {
        w: 6,
        h: 6,
        terminals: [
          t("U", 1, 0, "U"),
          t("V", 3, 0, "V"),
          t("W", 5, 0, "W"),
          t("PE", 0, 5, "PE"),
        ],
      },
    },
  },
  "motor-1ph": {
    prefix: "MTR",
    label: "單相電機",
    variants: {
      body: {
        w: 6,
        h: 6,
        terminals: [
          t("U1", 1, 0, "U1"),
          t("U2", 3, 0, "U2"),
          t("Z1", 0, 3, "Z1"),
          t("Z2", 6, 3, "Z2"),
        ],
      },
    },
  },
  "motor-dc": {
    prefix: "MTR",
    label: "直流電機",
    variants: {
      body: {
        w: 6,
        h: 4,
        terminals: [t("A1", 0, 1, "A+"), t("A2", 0, 3, "A−")],
      },
    },
  },
  "gen-ac": {
    prefix: "GEN",
    label: "交流發電機",
    variants: {
      body: {
        w: 6,
        h: 8,
        terminals: [
          t("U", 6, 1, "U"),
          t("V", 6, 3, "V"),
          t("W", 6, 5, "W"),
          t("N", 6, 7, "N"),
        ],
      },
    },
  },
  "gen-dc": {
    prefix: "GEN",
    label: "直流發電機",
    variants: {
      body: {
        w: 6,
        h: 4,
        terminals: [t("+", 6, 1, "+"), t("-", 6, 3, "−")],
      },
    },
  },
  "starter-dol": { prefix: "M", label: "直接起動器", variants: { body: starterBody } },
  "starter-fwd": { prefix: "MF", label: "正轉起動器", variants: { body: starterBody } },
  "starter-rev": { prefix: "MR", label: "反轉起動器", variants: { body: starterBody } },
  "starter-rev-combo": {
    prefix: "M",
    label: "正反轉起動器",
    variants: {
      body: {
        w: 12,
        h: 11,
        terminals: [
          t("L1", 0, 1),
          t("L2", 0, 3),
          t("L3", 0, 5),
          t("T1", 12, 1),
          t("T2", 12, 3),
          t("T3", 12, 5),
          t("A1F", 0, 7, "A1F"),
          t("A2F", 0, 9, "A2F"),
          t("A1R", 12, 7, "A1R"),
          t("A2R", 12, 9, "A2R"),
          t("13", 2, 11, "13"),
          t("14", 3, 11, "14"),
          t("21", 4, 11, "21"),
          t("22", 5, 11, "22"),
          t("13R", 7, 11, "13"),
          t("14R", 8, 11, "14"),
          t("21R", 9, 11, "21"),
          t("22R", 10, 11, "22"),
        ],
      },
    },
  },
  "pb-illum-no": {
    prefix: "PB",
    label: "帶燈常開按鈕",
    variants: {
      body: {
        w: 4,
        h: 4,
        terminals: [
          t("13", 0, 1, "13"),
          t("14", 4, 1, "14"),
          t("X1", 0, 3, "X1"),
          t("X2", 4, 3, "X2"),
        ],
      },
    },
  },
  "pb-illum-nc": {
    prefix: "PB",
    label: "帶燈常閉按鈕",
    variants: {
      body: {
        w: 4,
        h: 4,
        terminals: [
          t("11", 0, 1, "11"),
          t("12", 4, 1, "12"),
          t("X1", 0, 3, "X1"),
          t("X2", 4, 3, "X2"),
        ],
      },
    },
  },
  "selector-hoa": {
    prefix: "SS",
    label: "手／停／自動",
    variants: {
      body: {
        w: 4,
        h: 4,
        terminals: [
          t("COM", 0, 1, "COM"),
          t("H", 4, 1, "H"),
          t("COM2", 0, 3, "COM"),
          t("A", 4, 3, "A"),
        ],
      },
    },
  },
  "selector-key": {
    prefix: "SS",
    label: "鑰匙選擇開關",
    variants: {
      body: {
        w: 6,
        h: 4,
        terminals: [t("1", 0, 1, "1"), t("2", 4, 1, "2"), t("3", 0, 3, "3"), t("4", 4, 3, "4")],
      },
    },
  },
  "door-nc": {
    prefix: "DS",
    label: "門限常閉",
    variants: { body: { w: 4, h: 2, terminals: [t("11", 0, 1, "11"), t("12", 4, 1, "12")] } },
  },
  "pull-cord": {
    prefix: "ES",
    label: "拉繩急停",
    variants: { body: { w: 4, h: 2, terminals: [t("11", 0, 1, "11"), t("12", 4, 1, "12")] } },
  },
  ssr: {
    prefix: "SSR",
    label: "固態繼電器",
    variants: {
      body: {
        w: 4,
        h: 4,
        terminals: [t("A1", 0, 1, "A1"), t("A2", 4, 1, "A2"), t("1", 0, 3, "1"), t("2", 4, 3, "2")],
      },
    },
  },
  "safety-relay": {
    prefix: "KSR",
    label: "安全繼電器",
    variants: {
      body: {
        w: 8,
        h: 8,
        terminals: [
          t("A1", 0, 1, "A1"),
          t("A2", 8, 1, "A2"),
          t("S11", 0, 3, "S11"),
          t("S12", 8, 3, "S12"),
          t("S21", 0, 5, "S21"),
          t("S22", 8, 5, "S22"),
          t("13", 0, 7, "13"),
          t("14", 8, 7, "14"),
          t("Y1", 2, 8, "Y1"),
          t("Y2", 6, 8, "Y2"),
        ],
      },
    },
  },
  "phase-relay": {
    prefix: "KPS",
    label: "相序／缺相繼電器",
    variants: {
      body: {
        w: 6,
        h: 8,
        terminals: [
          t("L1", 0, 2, "L1"),
          t("L2", 0, 4, "L2"),
          t("L3", 0, 6, "L3"),
          t("12", 6, 2, "NC"),
          t("11", 6, 4, "COM"),
          t("14", 6, 6, "NO"),
        ],
      },
    },
  },
  "relay-uv": {
    prefix: "KUV",
    label: "欠壓繼電器",
    variants: {
      body: {
        w: 6,
        h: 8,
        terminals: [
          t("L1", 0, 2, "L1"),
          t("L2", 0, 4, "L2"),
          t("L3", 0, 6, "L3"),
          t("12", 6, 2, "NC"),
          t("11", 6, 4, "COM"),
          t("14", 6, 6, "NO"),
        ],
      },
    },
  },
  "relay-ov": {
    prefix: "KOV",
    label: "過壓繼電器",
    variants: {
      body: {
        w: 6,
        h: 8,
        terminals: [
          t("L1", 0, 2, "L1"),
          t("L2", 0, 4, "L2"),
          t("L3", 0, 6, "L3"),
          t("12", 6, 2, "NC"),
          t("11", 6, 4, "COM"),
          t("14", 6, 6, "NO"),
        ],
      },
    },
  },
  ptc: {
    prefix: "PTC",
    label: "熱敏電阻保護",
    variants: {
      body: {
        w: 6,
        h: 8,
        terminals: [
          t("A1", 0, 1, "A1"),
          t("A2", 6, 1, "A2"),
          t("T1", 0, 3, "T1"),
          t("T2", 6, 3, "T2"),
          t("95", 0, 5, "95 NC"),
          t("96", 6, 5, "96"),
          t("97", 0, 7, "97 NO"),
          t("98", 6, 7, "98"),
        ],
      },
    },
  },
  "timer-flash": { prefix: "TR", label: "閃爍繼電器", variants: timerVariants },
  "timer-pulse": { prefix: "TR", label: "脈衝繼電器", variants: timerVariants },
  "timer-star-delta": {
    prefix: "TR",
    label: "星三角計時器",
    variants: {
      coil: coilBody,
      "inst-no": {
        w: CONTACT_W,
        h: 2,
        terminals: [t("17", 0, 1, "17"), t("18", CONTACT_W, 1, "18")],
      },
      "delayed-no": {
        w: CONTACT_W,
        h: 2,
        terminals: [t("17", 0, 1, "17"), t("28", CONTACT_W, 1, "28")],
      },
    },
  },
  capacitor: {
    prefix: "C",
    label: "電容器",
    variants: { body: { w: 4, h: 2, terminals: [t("1", 0, 1, "1"), t("2", 4, 1, "2")] } },
  },
  vfd: {
    prefix: "VFD",
    label: "變頻器",
    variants: {
      body: {
        w: 8,
        h: 10,
        terminals: [
          t("L1", 0, 1, "L1"),
          t("L2", 0, 3, "L2"),
          t("L3", 0, 5, "L3"),
          t("U", 8, 1, "U"),
          t("V", 8, 3, "V"),
          t("W", 8, 5, "W"),
          t("DI1", 0, 7, "DI1"),
          t("COM", 0, 9, "COM"),
          t("PE", 8, 9, "PE"),
        ],
      },
    },
  },
  "psu-24v": {
    prefix: "PS",
    label: "開關電源",
    variants: {
      body: {
        w: 6,
        h: 6,
        terminals: [
          t("L", 0, 1, "L"),
          t("N", 0, 3, "N"),
          t("PE", 0, 5, "PE"),
          t("+", 6, 1, "+"),
          t("-", 6, 3, "0V"),
        ],
      },
    },
  },
  "term-block": {
    prefix: "X",
    label: "端子排",
    variants: { body: termBlockDef(NET_TERMINAL_DEFAULT_PINS) },
  },
  busbar: {
    prefix: "L1",
    label: "網絡匯流排",
    variants: { body: busbarDef(NET_TERMINAL_DEFAULT_PINS) },
  },
  "net-label": {
    prefix: "L1",
    label: "標籤端子",
    variants: {
      body: {
        w: 3,
        h: 2,
        terminals: [t("1", 0, 1)],
      },
    },
  },
  "net-terminal": {
    prefix: "L1",
    label: "網絡端子",
    variants: {
      body: netTerminalDef(NET_TERMINAL_DEFAULT_PINS),
    },
  },
  ground: {
    prefix: "GND",
    label: "接地",
    variants: {
      body: {
        w: 2,
        h: 2,
        terminals: [t("1", 1, 0, "PE")],
      },
    },
  },
  "title-block": {
    prefix: "TB",
    label: "圖紙標題欄",
    variants: {
      body: {
        w: 26,
        h: 5,
        terminals: [],
      },
    },
  },
  comment: {
    prefix: "REM",
    label: "註釋文字框",
    variants: {
      body: {
        w: 6,
        h: 3,
        terminals: [],
      },
    },
  },
  junction: {
    prefix: "",
    label: "連接點",
    variants: {
      body: {
        w: 1,
        h: 1,
        terminals: [t("1", 0, 0)],
      },
    },
  },
  voltmeter: {
    prefix: "VM",
    label: "電壓表",
    variants: {
      body: meterBody,
    },
  },
  ammeter: {
    prefix: "AM",
    label: "鉗形電流表",
    variants: {
      body: meterBody,
    },
  },
  "ammeter-series": {
    prefix: "AM",
    label: "串聯電流表",
    variants: { body: meterBody },
  },
};

export const CATALOG: CatalogItem[] = [
  { id: "mains-3ph", kind: "mains-3ph", variant: "wye", group: "電源與保護", subgroupId: "Power_Supply", label: "三相電源 (Y)", labelEn: "3Φ (Y)", prefix: "PWR", creates: "device" },
  { id: "mains-3ph-delta", kind: "mains-3ph", variant: "delta", group: "電源與保護", subgroupId: "Power_Supply", label: "三相電源 (Δ)", labelEn: "3Φ (Δ)", prefix: "PWR", creates: "device" },
  { id: "dc-supply", kind: "dc-supply", variant: "body", group: "電源與保護", subgroupId: "Power_Supply", label: "直流電源", labelEn: "DC Supply", prefix: "PWS", creates: "device", defaultParams: { voltage: 24 } },
  { id: "psu-24v", kind: "psu-24v", variant: "body", group: "電源與保護", subgroupId: "Power_Supply", label: "開關電源", labelEn: "Switching PSU", prefix: "PS", creates: "device", defaultParams: { voltage: 24 } },
  { id: "transformer", kind: "transformer", variant: "body", group: "電源與保護", subgroupId: "Power_Supply", label: "控制變壓器", labelEn: "Transformer", prefix: "T", creates: "device" },
  { id: "breaker-1p", kind: "breaker-1p", variant: "body", group: "電源與保護", subgroupId: "Breakers_Fuses", label: "單極斷路器", labelEn: "MCB 1P", prefix: "CB", creates: "device" },
  { id: "breaker-2p", kind: "breaker-2p", variant: "body", group: "電源與保護", subgroupId: "Breakers_Fuses", label: "雙極斷路器", labelEn: "MCB 2P", prefix: "CB", creates: "device" },
  { id: "breaker-3p", kind: "breaker-3p", variant: "body", group: "電源與保護", subgroupId: "Breakers_Fuses", label: "三極斷路器", labelEn: "MCB 3P", prefix: "CB", creates: "device" },
  { id: "fuse", kind: "fuse", variant: "body", group: "電源與保護", subgroupId: "Breakers_Fuses", label: "熔斷器 (1P)", labelEn: "Fuse 1P", prefix: "FU", creates: "device" },
  { id: "fuse-2p", kind: "fuse", variant: "body2", group: "電源與保護", subgroupId: "Breakers_Fuses", label: "熔斷器 (2P)", labelEn: "Fuse 2P", prefix: "FU", creates: "device" },
  { id: "fuse-3p", kind: "fuse", variant: "body3", group: "電源與保護", subgroupId: "Breakers_Fuses", label: "熔斷器 (3P)", labelEn: "Fuse 3P", prefix: "FU", creates: "device" },
  { id: "isolator-1p", kind: "isolator", variant: "body1", group: "電源與保護", subgroupId: "Breakers_Fuses", label: "單極隔離", labelEn: "Isolator 1P", prefix: "DISC", creates: "device" },
  { id: "isolator-2p", kind: "isolator", variant: "body2", group: "電源與保護", subgroupId: "Breakers_Fuses", label: "雙極隔離", labelEn: "Isolator 2P", prefix: "DISC", creates: "device" },
  { id: "isolator", kind: "isolator", variant: "body", group: "電源與保護", subgroupId: "Breakers_Fuses", label: "三極隔離", labelEn: "Isolator 3P", prefix: "DISC", creates: "device" },
  { id: "overload", kind: "overload", variant: "body", group: "電源與保護", subgroupId: "Overload_Relays", label: "熱繼電器", labelEn: "Overload FR", prefix: "OL", creates: "device" },
  { id: "fr-nc", kind: "overload", variant: "aux-nc", group: "電源與保護", subgroupId: "Overload_Relays", label: "熱過載常閉 95-96", labelEn: "Overload Aux NC 95-96", prefix: "OL", creates: "attach", defaultRot: 0 },
  { id: "fr-no", kind: "overload", variant: "aux-no", group: "電源與保護", subgroupId: "Overload_Relays", label: "熱過載常開 97-98", labelEn: "Overload Aux NO 97-98", prefix: "OL", creates: "attach", defaultRot: 0 },
  { id: "phase-relay", kind: "phase-relay", variant: "body", group: "電源與保護", subgroupId: "Overload_Relays", label: "相序／缺相", labelEn: "Phase Relay", prefix: "KPS", creates: "device" },
  { id: "relay-uv", kind: "relay-uv", variant: "body", group: "電源與保護", subgroupId: "Overload_Relays", label: "欠壓繼電器", labelEn: "Undervoltage Relay", prefix: "KUV", creates: "device" },
  { id: "relay-ov", kind: "relay-ov", variant: "body", group: "電源與保護", subgroupId: "Overload_Relays", label: "過壓繼電器", labelEn: "Overvoltage Relay", prefix: "KOV", creates: "device" },
  { id: "ptc", kind: "ptc", variant: "body", group: "電源與保護", subgroupId: "Overload_Relays", label: "PTC 保護", labelEn: "PTC Protection", prefix: "PTC", creates: "device" },

  { id: "net-label", kind: "net-label", variant: "body", group: "接線", subgroupId: "Terminals", label: "標籤端子", labelEn: "Net label", prefix: "L1", creates: "device" },
  { id: "net-terminal", kind: "net-terminal", variant: "body", group: "接線", subgroupId: "Terminals", label: "網絡端子", labelEn: "Net terminal", prefix: "L1", creates: "device", defaultParams: { pinCount: 4 } },
  { id: "term-block", kind: "term-block", variant: "body", group: "接線", subgroupId: "Terminals", label: "端子排", labelEn: "Terminal strip", prefix: "X", creates: "device", defaultParams: { pinCount: 4 } },
  { id: "busbar", kind: "busbar", variant: "body", group: "接線", subgroupId: "Terminals", label: "網絡匯流排", labelEn: "Net Busbar", prefix: "L1", creates: "device", defaultParams: { pinCount: 6 } },
  { id: "ground", kind: "ground", variant: "body", group: "接線", subgroupId: "Terminals", label: "接地", labelEn: "Ground", prefix: "GND", creates: "device" },

  { id: "pb-no", kind: "pb-no", variant: "body", group: "開關", subgroupId: "Pushbuttons", label: "常開按鈕", labelEn: "PB NO", prefix: "PB", creates: "device" },
  { id: "pb-nc", kind: "pb-nc", variant: "body", group: "開關", subgroupId: "Pushbuttons", label: "常閉按鈕", labelEn: "PB NC", prefix: "PB", creates: "device" },
  { id: "estop-nc", kind: "estop-nc", variant: "body", group: "開關", subgroupId: "Pushbuttons", label: "急停常閉", labelEn: "E-Stop NC 11-12", prefix: "PB", creates: "device" },
  { id: "estop-no", kind: "estop-no", variant: "body", group: "開關", subgroupId: "Pushbuttons", label: "急停常開", labelEn: "E-Stop NO 13-14", prefix: "PB", creates: "device" },
  { id: "pb-illum-no", kind: "pb-illum-no", variant: "body", group: "開關", subgroupId: "Pushbuttons", label: "帶燈常開", labelEn: "Illum. PB NO", prefix: "PB", creates: "device" },
  { id: "pb-illum-nc", kind: "pb-illum-nc", variant: "body", group: "開關", subgroupId: "Pushbuttons", label: "帶燈常閉", labelEn: "Illum. PB NC", prefix: "PB", creates: "device" },
  { id: "pull-cord", kind: "pull-cord", variant: "body", group: "開關", subgroupId: "Pushbuttons", label: "拉繩急停", labelEn: "Pull-cord E-Stop", prefix: "ES", creates: "device" },
  { id: "door-nc", kind: "door-nc", variant: "body", group: "開關", subgroupId: "Pushbuttons", label: "門限常閉", labelEn: "Door Interlock NC", prefix: "DS", creates: "device" },
  { id: "selector-2", kind: "selector-2", variant: "body", group: "開關", subgroupId: "Selectors", label: "選擇開關 2 檔", labelEn: "Selector 2", prefix: "SS", creates: "device" },
  { id: "selector-3", kind: "selector-3", variant: "body", group: "開關", subgroupId: "Selectors", label: "正停反開關", labelEn: "F-O-R", prefix: "SS", creates: "device" },
  { id: "selector-hoa", kind: "selector-hoa", variant: "body", group: "開關", subgroupId: "Selectors", label: "手／停／自動", labelEn: "HOA", prefix: "SS", creates: "device" },
  { id: "selector-key", kind: "selector-key", variant: "body", group: "開關", subgroupId: "Selectors", label: "鑰匙選擇", labelEn: "Key Selector", prefix: "SS", creates: "device" },
  { id: "toggle-spst", kind: "toggle-spst", variant: "body", group: "開關", subgroupId: "Toggles", label: "SPST 撥動", labelEn: "SPST Toggle", prefix: "TGS", creates: "device" },
  { id: "toggle-spdt", kind: "toggle-spdt", variant: "body", group: "開關", subgroupId: "Toggles", label: "SPDT 撥動", labelEn: "SPDT Toggle", prefix: "TGS", creates: "device" },
  { id: "toggle-dpst", kind: "toggle-dpst", variant: "body", group: "開關", subgroupId: "Toggles", label: "DPST 撥動", labelEn: "DPST Toggle", prefix: "TGS", creates: "device" },
  { id: "toggle-dpdt", kind: "toggle-dpdt", variant: "body", group: "開關", subgroupId: "Toggles", label: "DPDT 撥動", labelEn: "DPDT Toggle", prefix: "TGS", creates: "device" },
  { id: "toggle-4pdt", kind: "toggle-4pdt", variant: "body", group: "開關", subgroupId: "Toggles", label: "4PDT 撥動", labelEn: "4PDT Toggle", prefix: "TGS", creates: "device" },
  { id: "foot-no", kind: "foot-no", variant: "body", group: "開關", subgroupId: "Foot_Switches", label: "腳踏常開", labelEn: "Foot SW NO", prefix: "FTS", creates: "device" },
  { id: "foot-nc", kind: "foot-nc", variant: "body", group: "開關", subgroupId: "Foot_Switches", label: "腳踏常閉", labelEn: "Foot SW NC", prefix: "FTS", creates: "device" },

  { id: "limit-no", kind: "limit-no", variant: "body", group: "感測器", subgroupId: "Mechanical_Level", label: "限位常開", labelEn: "Limit NO", prefix: "LS", creates: "device" },
  { id: "limit-nc", kind: "limit-nc", variant: "body", group: "感測器", subgroupId: "Mechanical_Level", label: "限位常閉", labelEn: "Limit NC", prefix: "LS", creates: "device" },
  { id: "float-no", kind: "float-no", variant: "body", group: "感測器", subgroupId: "Mechanical_Level", label: "液位常開", labelEn: "Float Switch NO", prefix: "FS", creates: "device" },
  { id: "float-nc", kind: "float-nc", variant: "body", group: "感測器", subgroupId: "Mechanical_Level", label: "液位常閉", labelEn: "Float Switch NC", prefix: "FS", creates: "device" },
  { id: "temp-no", kind: "temp-no", variant: "body", group: "感測器", subgroupId: "Process_Sensors", label: "溫度開關常開", labelEn: "Temp SW NO", prefix: "TAS", creates: "device" },
  { id: "temp-nc", kind: "temp-nc", variant: "body", group: "感測器", subgroupId: "Process_Sensors", label: "溫度開關常閉", labelEn: "Temp SW NC", prefix: "TAS", creates: "device" },
  { id: "flow-no", kind: "flow-no", variant: "body", group: "感測器", subgroupId: "Process_Sensors", label: "流量常開", labelEn: "Flow NO", prefix: "FLS", creates: "device" },
  { id: "flow-nc", kind: "flow-nc", variant: "body", group: "感測器", subgroupId: "Process_Sensors", label: "流量常閉", labelEn: "Flow NC", prefix: "FLS", creates: "device" },
  { id: "pressure-no", kind: "pressure-no", variant: "body", group: "感測器", subgroupId: "Process_Sensors", label: "壓力常開", labelEn: "Press NO", prefix: "PS", creates: "device" },
  { id: "pressure-nc", kind: "pressure-nc", variant: "body", group: "感測器", subgroupId: "Process_Sensors", label: "壓力常閉", labelEn: "Press NC", prefix: "PS", creates: "device" },
  { id: "prox-no", kind: "prox-no", variant: "body", group: "感測器", subgroupId: "Electronic_Sensors", label: "接近開關常開", labelEn: "Prox Sensor NO", prefix: "PRS", creates: "device" },
  { id: "prox-nc", kind: "prox-nc", variant: "body", group: "感測器", subgroupId: "Electronic_Sensors", label: "接近開關常閉", labelEn: "Prox Sensor NC", prefix: "PRS", creates: "device" },
  { id: "photo-no", kind: "photo-no", variant: "body", group: "感測器", subgroupId: "Electronic_Sensors", label: "光電開關常開", labelEn: "Photo Sensor NO", prefix: "PEC", creates: "device" },
  { id: "photo-nc", kind: "photo-nc", variant: "body", group: "感測器", subgroupId: "Electronic_Sensors", label: "光電開關常閉", labelEn: "Photo Sensor NC", prefix: "PEC", creates: "device" },

  { id: "km-coil", kind: "contactor", variant: "coil", group: "繼電器／接觸器", subgroupId: "Contactors", label: "Contactor Coil", labelEn: "Contactor Coil", prefix: "M", creates: "device" },
  { id: "km-main", kind: "contactor", variant: "main", group: "繼電器／接觸器", subgroupId: "Contactors", label: "Contactor Main", labelEn: "Contactor Main", prefix: "M", creates: "attach" },
  { id: "km-no", kind: "contactor", variant: "aux-no", group: "繼電器／接觸器", subgroupId: "Contactors", label: "Cont. Aux NO 13-14", labelEn: "Cont. Aux NO 13-14", prefix: "M", creates: "attach", defaultRot: 0 },
  { id: "km-nc", kind: "contactor", variant: "aux-nc", group: "繼電器／接觸器", subgroupId: "Contactors", label: "Cont. Aux NC 21-22", labelEn: "Cont. Aux NC 21-22", prefix: "M", creates: "attach", defaultRot: 0 },
  { id: "km-no2", kind: "contactor", variant: "aux-no2", group: "繼電器／接觸器", subgroupId: "Contactors", label: "Cont. Aux NO 43-44", labelEn: "Cont. Aux NO 43-44", prefix: "M", creates: "attach", defaultRot: 0 },
  { id: "km-nc2", kind: "contactor", variant: "aux-nc2", group: "繼電器／接觸器", subgroupId: "Contactors", label: "Cont. Aux NC 31-32", labelEn: "Cont. Aux NC 31-32", prefix: "M", creates: "attach", defaultRot: 0 },
  { id: "ka-coil", kind: "relay", variant: "coil", group: "繼電器／接觸器", subgroupId: "Control_Relays", label: "Relay Coil", labelEn: "Relay Coil", prefix: "CR", creates: "device" },
  { id: "ka-no", kind: "relay", variant: "aux-no", group: "繼電器／接觸器", subgroupId: "Control_Relays", label: "Relay Aux NO 13-14", labelEn: "Relay Aux NO 13-14", prefix: "CR", creates: "attach", defaultRot: 0 },
  { id: "ka-nc", kind: "relay", variant: "aux-nc", group: "繼電器／接觸器", subgroupId: "Control_Relays", label: "Relay Aux NC 21-22", labelEn: "Relay Aux NC 21-22", prefix: "CR", creates: "attach", defaultRot: 0 },
  { id: "ka-no2", kind: "relay", variant: "aux-no2", group: "繼電器／接觸器", subgroupId: "Control_Relays", label: "Relay Aux NO 43-44", labelEn: "Relay Aux NO 43-44", prefix: "CR", creates: "attach", defaultRot: 0 },
  { id: "ka-nc2", kind: "relay", variant: "aux-nc2", group: "繼電器／接觸器", subgroupId: "Control_Relays", label: "Relay Aux NC 31-32", labelEn: "Relay Aux NC 31-32", prefix: "CR", creates: "attach", defaultRot: 0 },

  { id: "timer-on", kind: "timer-on", variant: "coil", group: "計時與計數", subgroupId: "Pneumatic_TON", label: "通電延時線圈", labelEn: "Timer ON Coil", prefix: "TR", creates: "device" },
  { id: "timer-on-nc", kind: "timer-on", variant: "delayed-nc", group: "計時與計數", subgroupId: "Pneumatic_TON", label: "常閉延時斷開 NC 15-16", labelEn: "TON NC (Timed Open) 15-16", prefix: "TR", creates: "attach", defaultRot: 0 },
  { id: "timer-on-no", kind: "timer-on", variant: "delayed-no", group: "計時與計數", subgroupId: "Pneumatic_TON", label: "常開延時閉合 NO 15-18", labelEn: "TON NO (Timed Close) 15-18", prefix: "TR", creates: "attach", defaultRot: 0 },
  { id: "timer-on-inst-nc", kind: "timer-on", variant: "inst-nc", group: "計時與計數", subgroupId: "Pneumatic_TON", label: "通電延時瞬時常閉 NC 21-22", labelEn: "TON Inst NC 21-22", prefix: "TR", creates: "attach", defaultRot: 0 },
  { id: "timer-on-inst-no", kind: "timer-on", variant: "inst-no", group: "計時與計數", subgroupId: "Pneumatic_TON", label: "通電延時瞬時常開 NO 21-24", labelEn: "TON Inst NO 21-24", prefix: "TR", creates: "attach", defaultRot: 0 },
  { id: "timer-off", kind: "timer-off", variant: "coil", group: "計時與計數", subgroupId: "Pneumatic_TOF", label: "斷電延時線圈", labelEn: "Timer OFF Coil", prefix: "TR", creates: "device" },
  { id: "timer-off-nc", kind: "timer-off", variant: "delayed-nc", group: "計時與計數", subgroupId: "Pneumatic_TOF", label: "常閉延時閉合 NC 15-16", labelEn: "TOF NC (Timed Close) 15-16", prefix: "TR", creates: "attach", defaultRot: 0 },
  { id: "timer-off-no", kind: "timer-off", variant: "delayed-no", group: "計時與計數", subgroupId: "Pneumatic_TOF", label: "常開延時斷開 NO 15-18", labelEn: "TOF NO (Timed Open) 15-18", prefix: "TR", creates: "attach", defaultRot: 0 },
  { id: "timer-off-inst-nc", kind: "timer-off", variant: "inst-nc", group: "計時與計數", subgroupId: "Pneumatic_TOF", label: "斷電延時瞬時常閉 NC 21-22", labelEn: "TOF Inst NC 21-22", prefix: "TR", creates: "attach", defaultRot: 0 },
  { id: "timer-off-inst-no", kind: "timer-off", variant: "inst-no", group: "計時與計數", subgroupId: "Pneumatic_TOF", label: "斷電延時瞬時常開 NO 21-24", labelEn: "TOF Inst NO 21-24", prefix: "TR", creates: "attach", defaultRot: 0 },

  { id: "timer-ss-on", kind: "timer-ss-on", variant: "coil", group: "計時與計數", subgroupId: "SolidState_TON", label: "固態通電延時線圈 (8-Pin)", labelEn: "Solid-State ON Timer Coil (8-Pin)", prefix: "TR", creates: "device" },
  { id: "timer-ss-on-no", kind: "timer-ss-on", variant: "delayed-no", group: "計時與計數", subgroupId: "SolidState_TON", label: "固態通電延時常開 1-3", labelEn: "SS TON NO 1-3", prefix: "TR", creates: "attach", defaultRot: 0 },
  { id: "timer-ss-on-nc", kind: "timer-ss-on", variant: "delayed-nc", group: "計時與計數", subgroupId: "SolidState_TON", label: "固態通電延時常閉 1-4", labelEn: "SS TON NC 1-4", prefix: "TR", creates: "attach", defaultRot: 0 },
  { id: "timer-ss-on-no2", kind: "timer-ss-on", variant: "delayed-no2", group: "計時與計數", subgroupId: "SolidState_TON", label: "固態通電延時常開 8-6", labelEn: "SS TON NO 8-6", prefix: "TR", creates: "attach", defaultRot: 0 },
  { id: "timer-ss-on-nc2", kind: "timer-ss-on", variant: "delayed-nc2", group: "計時與計數", subgroupId: "SolidState_TON", label: "固態通電延時常閉 8-5", labelEn: "SS TON NC 8-5", prefix: "TR", creates: "attach", defaultRot: 0 },

  { id: "timer-ss-off", kind: "timer-ss-off", variant: "coil", group: "計時與計數", subgroupId: "SolidState_TOF", label: "固態斷電延時線圈 (11-Pin)", labelEn: "Solid-State OFF Timer Coil (11-Pin)", prefix: "TR", creates: "device" },
  { id: "timer-ss-off-no", kind: "timer-ss-off", variant: "delayed-no", group: "計時與計數", subgroupId: "SolidState_TOF", label: "固態斷電延時常開 1-3", labelEn: "SS TOF NO 1-3", prefix: "TR", creates: "attach", defaultRot: 0 },
  { id: "timer-ss-off-nc", kind: "timer-ss-off", variant: "delayed-nc", group: "計時與計數", subgroupId: "SolidState_TOF", label: "固態斷電延時常閉 1-4", labelEn: "SS TOF NC 1-4", prefix: "TR", creates: "attach", defaultRot: 0 },
  { id: "timer-ss-off-no2", kind: "timer-ss-off", variant: "delayed-no2", group: "計時與計數", subgroupId: "SolidState_TOF", label: "固態斷電延時常開 11-9", labelEn: "SS TOF NO 11-9", prefix: "TR", creates: "attach", defaultRot: 0 },
  { id: "timer-ss-off-nc2", kind: "timer-ss-off", variant: "delayed-nc2", group: "計時與計數", subgroupId: "SolidState_TOF", label: "固態斷電延時常閉 11-8", labelEn: "SS TOF NC 11-8", prefix: "TR", creates: "attach", defaultRot: 0 },

  { id: "counter", kind: "counter", variant: "body", group: "計時與計數", subgroupId: "Counters", label: "計數器", labelEn: "Counter", prefix: "CTR", creates: "device" },

  { id: "lamp", kind: "lamp", variant: "body", group: "指示與負載", subgroupId: "Indicators", label: "指示燈", labelEn: "Pilot lamp", prefix: "LT", creates: "device" },
  { id: "alarm", kind: "alarm", variant: "body", group: "指示與負載", subgroupId: "Indicators", label: "報警器", labelEn: "Alarm", prefix: "ABE", creates: "device" },
  { id: "horn", kind: "horn", variant: "body", group: "指示與負載", subgroupId: "Indicators", label: "電笛", labelEn: "Horn", prefix: "AH", creates: "device" },
  { id: "fan", kind: "fan", variant: "body", group: "指示與負載", subgroupId: "Loads", label: "風扇", labelEn: "Fan", prefix: "FAN", creates: "device" },
  { id: "heater", kind: "heater", variant: "body", group: "指示與負載", subgroupId: "Loads", label: "電熱器", labelEn: "Heater", prefix: "HTR", creates: "device" },
  { id: "solenoid", kind: "solenoid", variant: "body", group: "指示與負載", subgroupId: "Loads", label: "電磁閥", labelEn: "Solenoid", prefix: "SOL", creates: "device" },
  { id: "capacitor", kind: "capacitor", variant: "body", group: "指示與負載", subgroupId: "Loads", label: "電容器", labelEn: "Capacitor", prefix: "C", creates: "device" },

  { id: "motor-3ph", kind: "motor-3ph", variant: "body", group: "電機", subgroupId: "Motors", label: "三相電機", labelEn: "Motor 3Φ", prefix: "MTR", creates: "device" },
  { id: "motor-1ph", kind: "motor-1ph", variant: "body", group: "電機", subgroupId: "Motors", label: "單相電機", labelEn: "Motor 1Φ", prefix: "MTR", creates: "device" },
  { id: "motor-dc", kind: "motor-dc", variant: "body", group: "電機", subgroupId: "Motors", label: "直流電機", labelEn: "Motor DC", prefix: "MTR", creates: "device" },
  { id: "gen-ac", kind: "gen-ac", variant: "body", group: "電機", subgroupId: "Motors", label: "交流發電機", labelEn: "Generator AC", prefix: "GEN", creates: "device" },
  { id: "gen-dc", kind: "gen-dc", variant: "body", group: "電機", subgroupId: "Motors", label: "直流發電機", labelEn: "Generator DC", prefix: "GEN", creates: "device" },

  { id: "voltmeter", kind: "voltmeter", variant: "body", group: "儀表與測量", subgroupId: "Meters", label: "電壓表", labelEn: "Voltmeter", prefix: "VM", creates: "device" },
  { id: "ammeter", kind: "ammeter", variant: "body", group: "儀表與測量", subgroupId: "Meters", label: "鉗形電流表", labelEn: "Clamp Meter", prefix: "AM", creates: "device" },
  { id: "ammeter-series", kind: "ammeter-series", variant: "body", group: "儀表與測量", subgroupId: "Meters", label: "串聯電流表", labelEn: "Ammeter", prefix: "AM", creates: "device" },

  { id: "title-block", kind: "title-block", variant: "body", group: "圖紙標註", subgroupId: "Annotations", label: "圖紙標題欄", labelEn: "Title Block", prefix: "TB", creates: "device" },
  { id: "comment", kind: "comment", variant: "body", group: "圖紙標註", subgroupId: "Annotations", label: "註釋文字框", labelEn: "Comment Box", prefix: "REM", creates: "device" },
];

export const GROUPS: readonly CatalogGroup[] = [
  {
    id: "Power_Protection",
    label: "電源與保護",
    labelEn: "Power & Protection",
    subgroups: [
      { id: "Power_Supply", groupId: "Power_Protection", label: "電源與變壓器", labelEn: "Power & Transformer" },
      { id: "Breakers_Fuses", groupId: "Power_Protection", label: "斷路器與熔斷器", labelEn: "Breakers & Fuses" },
      { id: "Overload_Relays", groupId: "Power_Protection", label: "熱過載保護", labelEn: "Thermal Overload" },
    ],
  },
  {
    id: "Meters",
    label: "儀表與測量",
    labelEn: "Meters & Probes",
    subgroups: [
      { id: "Meters", groupId: "Meters", label: "測量儀表", labelEn: "Meters & Probes" },
    ],
  },
  {
    id: "Terminals",
    label: "接線",
    labelEn: "Terminals",
    subgroups: [
      { id: "Terminals", groupId: "Terminals", label: "接線與標籤", labelEn: "Terminals & Net Labels" },
    ],
  },
  {
    id: "Controls",
    label: "開關",
    labelEn: "Controls",
    subgroups: [
      { id: "Pushbuttons", groupId: "Controls", label: "按鈕與急停", labelEn: "Pushbuttons & E-Stop" },
      { id: "Selectors", groupId: "Controls", label: "選擇開關", labelEn: "Selector Switches" },
      { id: "Toggles", groupId: "Controls", label: "撥動開關", labelEn: "Toggle Switches" },
      { id: "Foot_Switches", groupId: "Controls", label: "腳踏開關", labelEn: "Foot Switches" },
    ],
  },
  {
    id: "Sensors",
    label: "感測器",
    labelEn: "Sensors",
    subgroups: [
      { id: "Mechanical_Level", groupId: "Sensors", label: "機械與液位開關", labelEn: "Limit & Level Switches" },
      { id: "Process_Sensors", groupId: "Sensors", label: "過程感測器 (溫/壓/流)", labelEn: "Process Sensors (Temp/Press/Flow)" },
      { id: "Electronic_Sensors", groupId: "Sensors", label: "接近與光電感測器", labelEn: "Prox & Photo Sensors" },
    ],
  },
  {
    id: "Relays_Contactors",
    label: "繼電器／接觸器",
    labelEn: "Relays / Contactors",
    subgroups: [
      { id: "Contactors", groupId: "Relays_Contactors", label: "交流接觸器 (KM)", labelEn: "Contactors (KM)" },
      { id: "Control_Relays", groupId: "Relays_Contactors", label: "中間繼電器 (CR/KA)", labelEn: "Control Relays (CR/KA)" },
    ],
  },
  {
    id: "Timer_Counter",
    label: "計時與計數",
    labelEn: "Timers & Counters",
    subgroups: [
      { id: "Pneumatic_TON", groupId: "Timer_Counter", label: "通電延時 (TON)", labelEn: "Pneumatic ON-Delay (TON)" },
      { id: "Pneumatic_TOF", groupId: "Timer_Counter", label: "斷電延時 (TOF)", labelEn: "Pneumatic OFF-Delay (TOF)" },
      { id: "SolidState_TON", groupId: "Timer_Counter", label: "固態通電延時 (8-Pin)", labelEn: "Solid-State ON-Delay (8-Pin)" },
      { id: "SolidState_TOF", groupId: "Timer_Counter", label: "固態斷電延時 (11-Pin)", labelEn: "Solid-State OFF-Delay (11-Pin)" },
      { id: "Counters", groupId: "Timer_Counter", label: "計數器", labelEn: "Counters" },
    ],
  },
  {
    id: "Lighting_Load",
    label: "指示與負載",
    labelEn: "Lighting / Load",
    subgroups: [
      { id: "Indicators", groupId: "Lighting_Load", label: "聲光信號與警報", labelEn: "Pilot & Alarm Signals" },
      { id: "Loads", groupId: "Lighting_Load", label: "執行負載設備", labelEn: "Loads & Actuators" },
    ],
  },
  {
    id: "Motor_Generator",
    label: "電機",
    labelEn: "Motors",
    subgroups: [
      { id: "Motors", groupId: "Motor_Generator", label: "電機與驅動", labelEn: "Motors & Drives" },
    ],
  },
  {
    id: "Annotations",
    label: "圖紙標註",
    labelEn: "Annotations",
    subgroups: [
      { id: "Annotations", groupId: "Annotations", label: "圖紙標註", labelEn: "Annotations" },
    ],
  },
] as const;

export function variantDef(kind: DeviceKind, variant: string): VariantDef {
  const meta = KINDS[kind];
  const v = meta.variants[variant] ?? meta.variants[Object.keys(meta.variants)[0]];
  return v;
}

/** Size/terminals for a placed device. Net Terminal pin count rides `params`. */
export function resolvedVariant(
  kind: DeviceKind,
  variant: string,
  params?: DeviceParams,
): VariantDef {
  if (kind === "net-terminal" || kind === "term-block") return kind === "term-block" ? termBlockDef(params?.pinCount) : netTerminalDef(params?.pinCount);
  if (kind === "busbar") return busbarDef(params?.pinCount);
  return variantDef(kind, variant);
}

export function catalogItem(id: string): CatalogItem {
  const item = CATALOG.find((c) => c.id === id);
  if (!item) throw new Error(`Unknown catalog item ${id}`);
  return item;
}

export const LAMP_COLORS = ["red", "green", "yellow", "white", "blue"] as const;

export const GROUP_COLORS = [
  "#3b7de0",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#9333ea",
  "#06b6d4",
  "#ec4899",
  "#8b5cf6",
  "#64748b",
] as const;

/** Reuse the selected / last named-net name so consecutive drops stay on the same net. */
export function suggestNetLabelTag(circuit: Circuit, selectedSymbolId?: string | null): string {
  if (selectedSymbolId) {
    const sym = circuit.symbols.find((s) => s.id === selectedSymbolId);
    const d = sym && circuit.devices.find((x) => x.id === sym.deviceId);
    if (d && isNamedNetKind(d.kind) && d.tag.trim()) return d.tag;
  }
  for (let i = circuit.devices.length - 1; i >= 0; i -= 1) {
    const d = circuit.devices[i];
    if (isNamedNetKind(d.kind) && d.tag.trim()) return d.tag;
  }
  return "L1";
}
