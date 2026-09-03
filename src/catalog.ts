import type {
  CatalogItem,
  Circuit,
  DeviceKind,
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
    t("L1", 1, 0, "L1"),
    t("L2", 3, 0, "L2"),
    t("L3", 5, 0, "L3"),
    t("T1", 1, 4, "T1"),
    t("T2", 3, 4, "T2"),
    t("T3", 5, 4, "T3"),
    t("1", 1, 0, "L1"),
    t("3", 3, 0, "L2"),
    t("5", 5, 0, "L3"),
    t("2", 1, 4, "T1"),
    t("4", 3, 4, "T2"),
    t("6", 5, 4, "T3"),
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

const pole3: VariantDef = {
  w: 6,
  h: 6,
  terminals: [
    t("L1", 0, 1),
    t("L2", 0, 3),
    t("L3", 0, 5),
    t("T1", 6, 1),
    t("T2", 6, 3),
    t("T3", 6, 5),
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
    prefix: "GEN",
    label: "三相電源",
    variants: {
      body: wyeMains,
      wye: wyeMains,
      delta: deltaMains,
    },
  },
  "dc-supply": {
    prefix: "PS",
    label: "直流電源",
    variants: {
      body: {
        w: 4,
        h: 4,
        terminals: [t("+", 4, 1, "+"), t("-", 4, 3, "−")],
      },
    },
  },
  transformer: {
    prefix: "TC",
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
    variants: { body: twoTermVert },
  },
  isolator: {
    prefix: "DISC",
    label: "隔離開關",
    variants: { body: isolatorBody },
  },
  overload: {
    prefix: "FR",
    label: "熱繼電器",
    variants: {
      body: {
        w: 6,
        h: 4,
        terminals: [
          t("L1", 1, 0, "L1"),
          t("L2", 3, 0, "L2"),
          t("L3", 5, 0, "L3"),
          t("T1", 1, 4, "T1"),
          t("T2", 3, 4, "T2"),
          t("T3", 5, 4, "T3"),
          t("1", 1, 0, "L1"),
          t("3", 3, 0, "L2"),
          t("5", 5, 0, "L3"),
          t("2", 1, 4, "T1"),
          t("4", 3, 4, "T2"),
          t("6", 5, 4, "T3"),
        ],
      },
      main: {
        w: 6,
        h: 4,
        terminals: [
          t("L1", 1, 0, "L1"),
          t("L2", 3, 0, "L2"),
          t("L3", 5, 0, "L3"),
          t("T1", 1, 4, "T1"),
          t("T2", 3, 4, "T2"),
          t("T3", 5, 4, "T3"),
          t("1", 1, 0, "L1"),
          t("3", 3, 0, "L2"),
          t("5", 5, 0, "L3"),
          t("2", 1, 4, "T1"),
          t("4", 3, 4, "T2"),
          t("6", 5, 4, "T3"),
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
  "pb-no": { prefix: "SB", label: "常開按鈕", variants: { body: pbBody } },
  "pb-nc": { prefix: "SB", label: "常閉按鈕", variants: { body: pbBody } },
  estop: { prefix: "SB", label: "急停按鈕", variants: { body: pbBody } },
  "estop-nc": {
    prefix: "SB",
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
    prefix: "SB",
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
    prefix: "SA",
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
    prefix: "SA",
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
  toggle: { prefix: "SA", label: "撥動開關", variants: { body: contactSpdt } },
  "toggle-spst": {
    prefix: "SA",
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
    prefix: "SA",
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
    prefix: "SA",
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
    prefix: "SA",
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
    prefix: "SA",
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
    prefix: "SQ",
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
    prefix: "SQ",
    label: "限位常閉",
    variants: {
      body: {
        w: 4,
        h: 2,
        terminals: [t("1", 0, 1), t("2", 4, 1)],
      },
    },
  },
  foot: { prefix: "SF", label: "腳踏開關", variants: { body: contactSpdt } },
  "foot-no": {
    prefix: "SF",
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
    prefix: "SF",
    label: "腳踏常閉",
    variants: {
      body: {
        w: 4,
        h: 2,
        terminals: [t("1", 0, 1), t("2", 4, 1)],
      },
    },
  },
  float: {
    prefix: "SL",
    label: "液位／浮球開關",
    variants: {
      body: {
        w: 4,
        h: 2,
        terminals: [t("1", 0, 1), t("2", 4, 1)],
      },
    },
  },
  "temp-no": {
    prefix: "ST",
    label: "溫度開關 常開",
    variants: { body: { w: 4, h: 2, terminals: [t("1", 0, 1), t("2", 4, 1)] } },
  },
  "temp-nc": {
    prefix: "ST",
    label: "溫度開關 常閉",
    variants: { body: { w: 4, h: 2, terminals: [t("1", 0, 1), t("2", 4, 1)] } },
  },
  "pressure-no": {
    prefix: "SP",
    label: "壓力開關 常開",
    variants: { body: { w: 4, h: 2, terminals: [t("1", 0, 1), t("2", 4, 1)] } },
  },
  "pressure-nc": {
    prefix: "SP",
    label: "壓力開關 常閉",
    variants: { body: { w: 4, h: 2, terminals: [t("1", 0, 1), t("2", 4, 1)] } },
  },
  "flow-no": {
    prefix: "FS",
    label: "流量開關 常開",
    variants: { body: { w: 4, h: 2, terminals: [t("1", 0, 1), t("2", 4, 1)] } },
  },
  "flow-nc": {
    prefix: "FS",
    label: "流量開關 常閉",
    variants: { body: { w: 4, h: 2, terminals: [t("1", 0, 1), t("2", 4, 1)] } },
  },
  "prox-no": { prefix: "SQ", label: "接近開關 常開", variants: { body: contactBody } },
  "prox-nc": { prefix: "SQ", label: "接近開關 常閉", variants: { body: contactBody } },
  prox: { prefix: "SQ", label: "接近開關", variants: { body: contactBody } },
  "photo-no": { prefix: "SQ", label: "光電開關 常開", variants: { body: contactBody } },
  "photo-nc": { prefix: "SQ", label: "光電開關 常閉", variants: { body: contactBody } },
  photo: { prefix: "SQ", label: "光電開關", variants: { body: contactBody } },
  contactor: {
    prefix: "KM",
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
    prefix: "KA",
    label: "Intermediate Relay",
    variants: {
      coil: coilBody,
      "aux-no": {
        w: CONTACT_W,
        h: 2,
        terminals: [t("1", 0, 1, "1"), t("2", CONTACT_W, 1, "2")],
      },
      "aux-nc": {
        w: CONTACT_W,
        h: 2,
        terminals: [t("3", 0, 1, "3"), t("4", CONTACT_W, 1, "4")],
      },
      "aux-no2": {
        w: CONTACT_W,
        h: 2,
        terminals: [t("5", 0, 1, "5"), t("6", CONTACT_W, 1, "6")],
      },
      "aux-nc2": {
        w: CONTACT_W,
        h: 2,
        terminals: [t("7", 0, 1, "7"), t("8", CONTACT_W, 1, "8")],
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
  counter: {
    prefix: "CT",
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
    prefix: "HL",
    label: "指示燈",
    variants: {
      body: {
        w: 2,
        h: 4,
        terminals: [t("1", 1, 0, "X1"), t("2", 1, 4, "X2")],
      },
    },
  },
  alarm: { prefix: "HA", label: "報警器", variants: { body: twoTermHoriz } },
  horn: { prefix: "HA", label: "電笛", variants: { body: twoTermHoriz } },
  fan: {
    prefix: "FF",
    label: "風扇",
    variants: {
      body: {
        w: 4,
        h: 4,
        terminals: [t("U1", 0, 2, "U1"), t("U2", 4, 2, "U2")],
      },
    },
  },
  heater: { prefix: "EH", label: "電熱器", variants: { body: twoTermHoriz } },
  solenoid: {
    prefix: "YV",
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
    prefix: "M",
    label: "三相異步電機",
    variants: {
      body: {
        w: 6,
        h: 6,
        terminals: [
          t("U", 1, 0, "U"),
          t("V", 3, 0, "V"),
          t("W", 5, 0, "W"),
        ],
      },
    },
  },
  "motor-1ph": {
    prefix: "M",
    label: "單相電機",
    variants: {
      body: {
        w: 4,
        h: 6,
        terminals: [t("U1", 1, 0, "U1"), t("U2", 3, 0, "U2")],
      },
    },
  },
  "motor-dc": {
    prefix: "M",
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
    prefix: "G",
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
    prefix: "G",
    label: "直流發電機",
    variants: {
      body: {
        w: 6,
        h: 4,
        terminals: [t("+", 6, 1, "+"), t("-", 6, 3, "−")],
      },
    },
  },
  "starter-dol": { prefix: "MS", label: "直接起動器", variants: { body: starterBody } },
  "starter-fwd": { prefix: "MF", label: "正轉起動器", variants: { body: starterBody } },
  "starter-rev": { prefix: "MR", label: "反轉起動器", variants: { body: starterBody } },
  "starter-rev-combo": {
    prefix: "KMR",
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
  ground: {
    prefix: "PE",
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
        w: 16,
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
    prefix: "CM",
    label: "鉗形電流表",
    variants: {
      body: meterBody,
    },
  },
};

export const CATALOG: CatalogItem[] = [
  { id: "mains-3ph", kind: "mains-3ph", variant: "wye", group: "電源與保護", label: "三相電源 (Y)", labelEn: "3Φ (Y)", prefix: "G", creates: "device" },
  { id: "mains-3ph-delta", kind: "mains-3ph", variant: "delta", group: "電源與保護", label: "三相電源 (Δ)", labelEn: "3Φ (Δ)", prefix: "G", creates: "device" },
  { id: "dc-supply", kind: "dc-supply", variant: "body", group: "電源與保護", label: "直流電源", labelEn: "DC Supply", prefix: "PS", creates: "device" },
  { id: "transformer", kind: "transformer", variant: "body", group: "電源與保護", label: "控制變壓器", labelEn: "Transformer", prefix: "TC", creates: "device" },
  { id: "breaker-1p", kind: "breaker-1p", variant: "body", group: "電源與保護", label: "單極斷路器", labelEn: "MCB 1P", prefix: "SCB", creates: "device" },
  { id: "breaker-3p", kind: "breaker-3p", variant: "body", group: "電源與保護", label: "三極斷路器", labelEn: "MCB 3P", prefix: "CB", creates: "device" },
  { id: "fuse", kind: "fuse", variant: "body", group: "電源與保護", label: "熔斷器", labelEn: "Fuse", prefix: "FU", creates: "device" },
  { id: "isolator", kind: "isolator", variant: "body", group: "電源與保護", label: "隔離開關", labelEn: "Isolator", prefix: "DISC", creates: "device" },
  { id: "overload", kind: "overload", variant: "body", group: "電源與保護", label: "熱繼電器", labelEn: "Overload FR", prefix: "OL", creates: "device" },
  { id: "fr-nc", kind: "overload", variant: "aux-nc", group: "電源與保護", label: "熱過載常閉 95-96", labelEn: "Overload Aux NC 95-96", prefix: "OL", creates: "attach", defaultRot: 0 },
  { id: "fr-no", kind: "overload", variant: "aux-no", group: "電源與保護", label: "熱過載常開 97-98", labelEn: "Overload Aux NO 97-98", prefix: "OL", creates: "attach", defaultRot: 0 },

  { id: "net-label", kind: "net-label", variant: "body", group: "接線", label: "標籤端子", labelEn: "Net label", prefix: "L1", creates: "device" },
  { id: "ground", kind: "ground", variant: "body", group: "接線", label: "接地", labelEn: "Ground", prefix: "PE", creates: "device" },

  { id: "pb-no", kind: "pb-no", variant: "body", group: "開關", label: "常開按鈕", labelEn: "PB NO", prefix: "SB", creates: "device" },
  { id: "pb-nc", kind: "pb-nc", variant: "body", group: "開關", label: "常閉按鈕", labelEn: "PB NC", prefix: "SB", creates: "device" },
  { id: "estop-nc", kind: "estop-nc", variant: "body", group: "開關", label: "急停常閉", labelEn: "E-Stop NC 11-12", prefix: "SB", creates: "device" },
  { id: "estop-no", kind: "estop-no", variant: "body", group: "開關", label: "急停常開", labelEn: "E-Stop NO 13-14", prefix: "SB", creates: "device" },
  { id: "selector-2", kind: "selector-2", variant: "body", group: "開關", label: "選擇開關 2 檔", labelEn: "Selector 2", prefix: "SA", creates: "device" },
  { id: "selector-3", kind: "selector-3", variant: "body", group: "開關", label: "正停反開關", labelEn: "F-O-R", prefix: "SA", creates: "device" },
  { id: "toggle-spst", kind: "toggle-spst", variant: "body", group: "開關", label: "SPST 撥動", labelEn: "SPST Toggle", prefix: "SA", creates: "device" },
  { id: "toggle-spdt", kind: "toggle-spdt", variant: "body", group: "開關", label: "SPDT 撥動", labelEn: "SPDT Toggle", prefix: "SA", creates: "device" },
  { id: "toggle-dpst", kind: "toggle-dpst", variant: "body", group: "開關", label: "DPST 撥動", labelEn: "DPST Toggle", prefix: "SA", creates: "device" },
  { id: "toggle-dpdt", kind: "toggle-dpdt", variant: "body", group: "開關", label: "DPDT 撥動", labelEn: "DPDT Toggle", prefix: "SA", creates: "device" },
  { id: "toggle-4pdt", kind: "toggle-4pdt", variant: "body", group: "開關", label: "4PDT 撥動", labelEn: "4PDT Toggle", prefix: "SA", creates: "device" },
  { id: "foot-no", kind: "foot-no", variant: "body", group: "開關", label: "腳踏常開", labelEn: "Foot SW NO", prefix: "SF", creates: "device" },
  { id: "foot-nc", kind: "foot-nc", variant: "body", group: "開關", label: "腳踏常閉", labelEn: "Foot SW NC", prefix: "SF", creates: "device" },

  { id: "limit-no", kind: "limit-no", variant: "body", group: "感測器", label: "限位常開", labelEn: "Limit NO", prefix: "SQ", creates: "device" },
  { id: "limit-nc", kind: "limit-nc", variant: "body", group: "感測器", label: "限位常閉", labelEn: "Limit NC", prefix: "SQ", creates: "device" },
  { id: "float", kind: "float", variant: "body", group: "感測器", label: "液位開關", labelEn: "Float", prefix: "SL", creates: "device" },
  { id: "temp-no", kind: "temp-no", variant: "body", group: "感測器", label: "溫度開關常開", labelEn: "Temp SW NO", prefix: "ST", creates: "device" },
  { id: "temp-nc", kind: "temp-nc", variant: "body", group: "感測器", label: "溫度開關常閉", labelEn: "Temp SW NC", prefix: "ST", creates: "device" },
  { id: "flow-no", kind: "flow-no", variant: "body", group: "感測器", label: "流量常開", labelEn: "Flow NO", prefix: "FS", creates: "device" },
  { id: "flow-nc", kind: "flow-nc", variant: "body", group: "感測器", label: "流量常閉", labelEn: "Flow NC", prefix: "FS", creates: "device" },
  { id: "pressure-no", kind: "pressure-no", variant: "body", group: "感測器", label: "壓力常開", labelEn: "Press NO", prefix: "SP", creates: "device" },
  { id: "pressure-nc", kind: "pressure-nc", variant: "body", group: "感測器", label: "壓力常閉", labelEn: "Press NC", prefix: "SP", creates: "device" },
  { id: "prox-no", kind: "prox-no", variant: "body", group: "感測器", label: "接近開關常開", labelEn: "Prox Sensor NO", prefix: "SQ", creates: "device" },
  { id: "prox-nc", kind: "prox-nc", variant: "body", group: "感測器", label: "接近開關常閉", labelEn: "Prox Sensor NC", prefix: "SQ", creates: "device" },
  { id: "photo-no", kind: "photo-no", variant: "body", group: "感測器", label: "光電開關常開", labelEn: "Photo Sensor NO", prefix: "SQ", creates: "device" },
  { id: "photo-nc", kind: "photo-nc", variant: "body", group: "感測器", label: "光電開關常閉", labelEn: "Photo Sensor NC", prefix: "SQ", creates: "device" },

  { id: "km-coil", kind: "contactor", variant: "coil", group: "Relays / Contactors", label: "Contactor Coil", labelEn: "Contactor Coil", prefix: "KM", creates: "device" },
  { id: "km-main", kind: "contactor", variant: "main", group: "Relays / Contactors", label: "Contactor Main", labelEn: "Contactor Main", prefix: "KM", creates: "attach" },
  { id: "km-no", kind: "contactor", variant: "aux-no", group: "Relays / Contactors", label: "Cont. Aux NO 13-14", labelEn: "Cont. Aux NO 13-14", prefix: "KM", creates: "attach", defaultRot: 0 },
  { id: "km-nc", kind: "contactor", variant: "aux-nc", group: "Relays / Contactors", label: "Cont. Aux NC 21-22", labelEn: "Cont. Aux NC 21-22", prefix: "KM", creates: "attach", defaultRot: 0 },
  { id: "km-no2", kind: "contactor", variant: "aux-no2", group: "Relays / Contactors", label: "Cont. Aux NO 43-44", labelEn: "Cont. Aux NO 43-44", prefix: "KM", creates: "attach", defaultRot: 0 },
  { id: "km-nc2", kind: "contactor", variant: "aux-nc2", group: "Relays / Contactors", label: "Cont. Aux NC 31-32", labelEn: "Cont. Aux NC 31-32", prefix: "KM", creates: "attach", defaultRot: 0 },
  { id: "ka-coil", kind: "relay", variant: "coil", group: "Relays / Contactors", label: "Relay Coil", labelEn: "Relay Coil", prefix: "KA", creates: "device" },
  { id: "ka-no", kind: "relay", variant: "aux-no", group: "Relays / Contactors", label: "Relay Aux NO 1-2", labelEn: "Relay Aux NO 1-2", prefix: "KA", creates: "attach", defaultRot: 0 },
  { id: "ka-nc", kind: "relay", variant: "aux-nc", group: "Relays / Contactors", label: "Relay Aux NC 3-4", labelEn: "Relay Aux NC 3-4", prefix: "KA", creates: "attach", defaultRot: 0 },
  { id: "ka-no2", kind: "relay", variant: "aux-no2", group: "Relays / Contactors", label: "Relay Aux NO 5-6", labelEn: "Relay Aux NO 5-6", prefix: "KA", creates: "attach", defaultRot: 0 },
  { id: "ka-nc2", kind: "relay", variant: "aux-nc2", group: "Relays / Contactors", label: "Relay Aux NC 7-8", labelEn: "Relay Aux NC 7-8", prefix: "KA", creates: "attach", defaultRot: 0 },

  { id: "timer-on", kind: "timer-on", variant: "coil", group: "計時與計數", label: "通電延時線圈", labelEn: "Timer ON Coil", prefix: "TR", creates: "device" },
  { id: "timer-on-nc", kind: "timer-on", variant: "delayed-nc", group: "計時與計數", label: "常閉延時斷開 NC 15-16", labelEn: "TON NC (Timed Open) 15-16", prefix: "TR", creates: "attach", defaultRot: 0 },
  { id: "timer-on-no", kind: "timer-on", variant: "delayed-no", group: "計時與計數", label: "常開延時閉合 NO 15-18", labelEn: "TON NO (Timed Close) 15-18", prefix: "TR", creates: "attach", defaultRot: 0 },
  { id: "timer-on-inst-nc", kind: "timer-on", variant: "inst-nc", group: "計時與計數", label: "通電延時瞬時常閉 NC 21-22", labelEn: "TON Inst NC 21-22", prefix: "TR", creates: "attach", defaultRot: 0 },
  { id: "timer-on-inst-no", kind: "timer-on", variant: "inst-no", group: "計時與計數", label: "通電延時瞬時常開 NO 21-24", labelEn: "TON Inst NO 21-24", prefix: "TR", creates: "attach", defaultRot: 0 },
  { id: "timer-off", kind: "timer-off", variant: "coil", group: "計時與計數", label: "斷電延時線圈", labelEn: "Timer OFF Coil", prefix: "TR", creates: "device" },
  { id: "timer-off-nc", kind: "timer-off", variant: "delayed-nc", group: "計時與計數", label: "常閉延時閉合 NC 15-16", labelEn: "TOF NC (Timed Close) 15-16", prefix: "TR", creates: "attach", defaultRot: 0 },
  { id: "timer-off-no", kind: "timer-off", variant: "delayed-no", group: "計時與計數", label: "常開延時斷開 NO 15-18", labelEn: "TOF NO (Timed Open) 15-18", prefix: "TR", creates: "attach", defaultRot: 0 },
  { id: "timer-off-inst-nc", kind: "timer-off", variant: "inst-nc", group: "計時與計數", label: "斷電延時瞬時常閉 NC 21-22", labelEn: "TOF Inst NC 21-22", prefix: "TR", creates: "attach", defaultRot: 0 },
  { id: "timer-off-inst-no", kind: "timer-off", variant: "inst-no", group: "計時與計數", label: "斷電延時瞬時常開 NO 21-24", labelEn: "TOF Inst NO 21-24", prefix: "TR", creates: "attach", defaultRot: 0 },
  { id: "counter", kind: "counter", variant: "body", group: "計時與計數", label: "計數器", labelEn: "Counter", prefix: "CT", creates: "device" },

  { id: "lamp", kind: "lamp", variant: "body", group: "指示與負載", label: "指示燈", labelEn: "Pilot lamp", prefix: "HL", creates: "device" },
  { id: "alarm", kind: "alarm", variant: "body", group: "指示與負載", label: "報警器", labelEn: "Alarm", prefix: "HA", creates: "device" },
  { id: "horn", kind: "horn", variant: "body", group: "指示與負載", label: "電笛", labelEn: "Horn", prefix: "HA", creates: "device" },
  { id: "fan", kind: "fan", variant: "body", group: "指示與負載", label: "風扇", labelEn: "Fan", prefix: "FF", creates: "device" },
  { id: "heater", kind: "heater", variant: "body", group: "指示與負載", label: "電熱器", labelEn: "Heater", prefix: "EH", creates: "device" },
  { id: "solenoid", kind: "solenoid", variant: "body", group: "指示與負載", label: "電磁閥", labelEn: "Solenoid", prefix: "YV", creates: "device" },

  { id: "motor-3ph", kind: "motor-3ph", variant: "body", group: "電機", label: "三相電機", labelEn: "Motor 3Φ", prefix: "M", creates: "device" },
  { id: "motor-1ph", kind: "motor-1ph", variant: "body", group: "電機", label: "單相電機", labelEn: "Motor 1Φ", prefix: "M", creates: "device" },

  { id: "voltmeter", kind: "voltmeter", variant: "body", group: "儀表與測量", label: "電壓表", labelEn: "Voltmeter", prefix: "VM", creates: "device" },
  { id: "ammeter", kind: "ammeter", variant: "body", group: "儀表與測量", label: "鉗形電流表", labelEn: "Clamp Meter", prefix: "CM", creates: "device" },

  { id: "starter-rev-combo", kind: "starter-rev-combo", variant: "body", group: "起動器", label: "正反轉組合起動器", labelEn: "Reversing Starter", prefix: "KMR", creates: "device" },
  { id: "title-block", kind: "title-block", variant: "body", group: "圖紙標註", label: "圖紙標題欄", labelEn: "Title Block", prefix: "TB", creates: "device" },
  { id: "comment", kind: "comment", variant: "body", group: "圖紙標註", label: "註釋文字框", labelEn: "Comment Box", prefix: "REM", creates: "device" },
];

export const GROUPS = [
  { id: "Power_Protection", label: "電源與保護", labelEn: "Power & Protection" },
  { id: "Meters", label: "儀表與測量", labelEn: "Meters & Probes" },
  { id: "Terminals", label: "接線", labelEn: "Terminals" },
  { id: "Controls", label: "開關", labelEn: "Controls" },
  { id: "Sensors", label: "感測器", labelEn: "Sensors" },
  { id: "Relays_Contactors", label: "繼電器／接觸器", labelEn: "Relays / Contactors" },
  { id: "Timer_Counter", label: "計時與計數", labelEn: "Timers & Counters" },
  { id: "Lighting_Load", label: "指示與負載", labelEn: "Lighting / Load" },
  { id: "Motor_Generator", label: "電機", labelEn: "Motors" },
  { id: "Starter", label: "起動器", labelEn: "Starter" },
  { id: "Annotations", label: "圖紙標註", labelEn: "Annotations" },
] as const;

export function variantDef(kind: DeviceKind, variant: string): VariantDef {
  const meta = KINDS[kind];
  const v = meta.variants[variant] ?? meta.variants[Object.keys(meta.variants)[0]];
  return v;
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

/** Reuse the selected / last net-label name so consecutive drops stay on the same net. */
export function suggestNetLabelTag(circuit: Circuit, selectedSymbolId?: string | null): string {
  if (selectedSymbolId) {
    const sym = circuit.symbols.find((s) => s.id === selectedSymbolId);
    const d = sym && circuit.devices.find((x) => x.id === sym.deviceId);
    if (d?.kind === "net-label" && d.tag.trim()) return d.tag;
  }
  for (let i = circuit.devices.length - 1; i >= 0; i -= 1) {
    const d = circuit.devices[i];
    if (d.kind === "net-label" && d.tag.trim()) return d.tag;
  }
  return "L1";
}
