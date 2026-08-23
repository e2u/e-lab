import { addDevice, addSymbol, addWire, emptyCircuit } from "./circuitBuilder";
import type { Circuit } from "./types";

export interface Example {
  id: string;
  title: string;
  blurb: string;
  build: () => Circuit;
}

export function lampJog(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "mains-3ph", "G1", "body", 2, 4);
  const sb = addDevice(c, "pb-no", "SB1", "body", 12, 4);
  const hl = addDevice(c, "lamp", "HL1", "body", 20, 4, { color: "green" });
  addWire(c, g.symbol, "L1", sb.symbol, "1");
  addWire(c, sb.symbol, "2", hl.symbol, "1");
  addWire(c, hl.symbol, "2", g.symbol, "N");
  return c;
}

export function selfHoldMotor(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "mains-3ph", "G1", "body", 1, 1);
  const qf = addDevice(c, "breaker-3p", "QF1", "body", 8, 2);
  const km = addDevice(c, "contactor", "KM1", "coil", 30, 14);
  const kmMain = addSymbol(c, km.device.id, "main", 16, 2);
  const kmNo = addSymbol(c, km.device.id, "aux-no", 22, 13);
  const fr = addDevice(c, "overload", "FR1", "body", 24, 2);
  const m = addDevice(c, "motor-3ph", "M1", "body", 34, 2);
  const tc = addDevice(c, "transformer", "TC1", "body", 1, 13, { ratio: "380/220" });
  const stop = addDevice(c, "pb-nc", "SB1", "body", 10, 13);
  const start = addDevice(c, "pb-no", "SB2", "body", 16, 13);
  const hl = addDevice(c, "lamp", "HL1", "body", 30, 19, { color: "green" });

  addWire(c, g.symbol, "L1", qf.symbol, "L1");
  addWire(c, g.symbol, "L2", qf.symbol, "L2");
  addWire(c, g.symbol, "L3", qf.symbol, "L3");
  addWire(c, qf.symbol, "T1", kmMain, "L1");
  addWire(c, qf.symbol, "T2", kmMain, "L2");
  addWire(c, qf.symbol, "T3", kmMain, "L3");
  addWire(c, kmMain, "T1", fr.symbol, "L1");
  addWire(c, kmMain, "T2", fr.symbol, "L2");
  addWire(c, kmMain, "T3", fr.symbol, "L3");
  addWire(c, fr.symbol, "T1", m.symbol, "U");
  addWire(c, fr.symbol, "T2", m.symbol, "V");
  addWire(c, fr.symbol, "T3", m.symbol, "W");

  addWire(c, g.symbol, "L1", tc.symbol, "P1");
  addWire(c, g.symbol, "L2", tc.symbol, "P2");
  addWire(c, tc.symbol, "S1", stop.symbol, "1");
  addWire(c, stop.symbol, "2", start.symbol, "1");
  addWire(c, stop.symbol, "2", kmNo, "13");
  addWire(c, start.symbol, "2", fr.symbol, "95");
  addWire(c, kmNo, "14", fr.symbol, "95");
  addWire(c, fr.symbol, "96", km.symbol, "A1");
  addWire(c, km.symbol, "A2", tc.symbol, "S2");
  addWire(c, km.symbol, "A1", hl.symbol, "1");
  addWire(c, hl.symbol, "2", km.symbol, "A2");
  return c;
}

export function fwdRevJog(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "mains-3ph", "G1", "body", 1, 1);
  const qf = addDevice(c, "breaker-3p", "QF1", "body", 8, 2);
  const kmr = addDevice(c, "starter-rev-combo", "KMR1", "body", 16, 1);
  const m = addDevice(c, "motor-3ph", "M1", "body", 32, 2);
  const stop = addDevice(c, "pb-nc", "SB1", "body", 8, 14);
  const fwd = addDevice(c, "pb-no", "SB2", "body", 14, 14);
  const rev = addDevice(c, "pb-no", "SB3", "body", 20, 14);

  addWire(c, g.symbol, "L1", qf.symbol, "L1");
  addWire(c, g.symbol, "L2", qf.symbol, "L2");
  addWire(c, g.symbol, "L3", qf.symbol, "L3");
  addWire(c, qf.symbol, "T1", kmr.symbol, "L1");
  addWire(c, qf.symbol, "T2", kmr.symbol, "L2");
  addWire(c, qf.symbol, "T3", kmr.symbol, "L3");
  addWire(c, kmr.symbol, "T1", m.symbol, "U");
  addWire(c, kmr.symbol, "T2", m.symbol, "V");
  addWire(c, kmr.symbol, "T3", m.symbol, "W");

  addWire(c, g.symbol, "L1", stop.symbol, "1");
  addWire(c, stop.symbol, "2", fwd.symbol, "1");
  addWire(c, stop.symbol, "2", rev.symbol, "1");
  addWire(c, fwd.symbol, "2", kmr.symbol, "A1F");
  addWire(c, rev.symbol, "2", kmr.symbol, "A1R");
  addWire(c, kmr.symbol, "A2F", g.symbol, "N");
  addWire(c, kmr.symbol, "A2R", g.symbol, "N");
  return c;
}

export function starDeltaStart(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "mains-3ph", "G1", "body", 1, 1);
  const qf = addDevice(c, "breaker-3p", "QF1", "body", 8, 2);
  const kmL = addDevice(c, "contactor", "KM1", "coil", 26, 16);
  const kmLMain = addSymbol(c, kmL.device.id, "main", 16, 2);
  const kmLNo = addSymbol(c, kmL.device.id, "aux-no", 20, 16);
  const kmY = addDevice(c, "contactor", "KM2", "coil", 26, 22);
  const kmYMain = addSymbol(c, kmY.device.id, "main", 42, 2);
  const kmYNc = addSymbol(c, kmY.device.id, "aux-nc", 20, 22);
  const kmD = addDevice(c, "contactor", "KM3", "coil", 38, 22);
  addSymbol(c, kmD.device.id, "main", 16, 10);
  const kmDNc = addSymbol(c, kmD.device.id, "aux-nc", 32, 22);
  const fr = addDevice(c, "overload", "FR1", "body", 24, 2);
  const m = addDevice(c, "motor-3ph", "M1", "body", 32, 1);
  const tc = addDevice(c, "transformer", "TC1", "body", 1, 16, { ratio: "380/220" });
  const stop = addDevice(c, "pb-nc", "SB1", "body", 9, 16);
  const start = addDevice(c, "pb-no", "SB2", "body", 14, 16);
  const kt = addDevice(c, "timer-on", "KT1", "coil", 32, 16, { delayMs: 2000 });
  const ktNc = addSymbol(c, kt.device.id, "delayed-nc", 38, 16);
  const ktNo = addSymbol(c, kt.device.id, "delayed-no", 38, 19);
  const hlRun = addDevice(c, "lamp", "HL1", "body", 46, 16, { color: "green" });
  const hlY = addDevice(c, "lamp", "HL2", "body", 46, 21, { color: "yellow" });
  const hlD = addDevice(c, "lamp", "HL3", "body", 46, 26, { color: "blue" });

  addWire(c, g.symbol, "L1", qf.symbol, "L1");
  addWire(c, g.symbol, "L2", qf.symbol, "L2");
  addWire(c, g.symbol, "L3", qf.symbol, "L3");
  addWire(c, qf.symbol, "T1", kmLMain, "L1");
  addWire(c, qf.symbol, "T2", kmLMain, "L2");
  addWire(c, qf.symbol, "T3", kmLMain, "L3");
  addWire(c, kmLMain, "T1", fr.symbol, "L1");
  addWire(c, kmLMain, "T2", fr.symbol, "L2");
  addWire(c, kmLMain, "T3", fr.symbol, "L3");
  addWire(c, fr.symbol, "T1", m.symbol, "U");
  addWire(c, fr.symbol, "T2", m.symbol, "V");
  addWire(c, fr.symbol, "T3", m.symbol, "W");

  addWire(c, kmYMain, "T1", kmYMain, "T2");
  addWire(c, kmYMain, "T2", kmYMain, "T3");

  addWire(c, g.symbol, "L1", tc.symbol, "P1");
  addWire(c, g.symbol, "L2", tc.symbol, "P2");
  addWire(c, tc.symbol, "S1", stop.symbol, "1");
  addWire(c, stop.symbol, "2", start.symbol, "1");
  addWire(c, stop.symbol, "2", kmLNo, "13");
  addWire(c, start.symbol, "2", fr.symbol, "95");
  addWire(c, kmLNo, "14", fr.symbol, "95");
  addWire(c, fr.symbol, "96", kmL.symbol, "A1");
  addWire(c, kmL.symbol, "A2", tc.symbol, "S2");
  addWire(c, fr.symbol, "96", kt.symbol, "A1");
  addWire(c, kt.symbol, "A2", tc.symbol, "S2");
  addWire(c, fr.symbol, "96", ktNc, "15");
  addWire(c, ktNc, "16", kmDNc, "21");
  addWire(c, kmDNc, "22", kmY.symbol, "A1");
  addWire(c, kmY.symbol, "A2", tc.symbol, "S2");
  addWire(c, fr.symbol, "96", ktNo, "15");
  addWire(c, ktNo, "18", kmYNc, "21");
  addWire(c, kmYNc, "22", kmD.symbol, "A1");
  addWire(c, kmD.symbol, "A2", tc.symbol, "S2");
  addWire(c, kmL.symbol, "A1", hlRun.symbol, "1");
  addWire(c, hlRun.symbol, "2", kmL.symbol, "A2");
  addWire(c, kmY.symbol, "A1", hlY.symbol, "1");
  addWire(c, hlY.symbol, "2", kmY.symbol, "A2");
  addWire(c, kmD.symbol, "A1", hlD.symbol, "1");
  addWire(c, hlD.symbol, "2", kmD.symbol, "A2");
  return c;
}

export function selectorReversing(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "mains-3ph", "G1", "body", 1, 1);
  const qf = addDevice(c, "breaker-3p", "QF1", "body", 8, 2);
  const f = addDevice(c, "contactor", "F", "coil", 38, 14);
  const fMain = addSymbol(c, f.device.id, "main", 16, 2);
  const fHold = addSymbol(c, f.device.id, "aux-no", 16, 18);
  const fInt = addSymbol(c, f.device.id, "aux-nc", 30, 20);
  const r = addDevice(c, "contactor", "R", "coil", 38, 20);
  const rMain = addSymbol(c, r.device.id, "main", 16, 9);
  const rHold = addSymbol(c, r.device.id, "aux-no", 16, 22);
  const rInt = addSymbol(c, r.device.id, "aux-nc", 30, 14);
  const ol = addDevice(c, "overload", "OL", "body", 24, 2);
  const m = addDevice(c, "motor-3ph", "M1", "body", 32, 1);
  const stop = addDevice(c, "pb-nc", "STOP", "body", 8, 14, {}, 90);
  const start = addDevice(c, "pb-no", "START", "body", 14, 14, {}, 90);
  const sa = addDevice(c, "selector-3", "SA1", "body", 22, 13);
  const hlF = addDevice(c, "lamp", "LF", "body", 22, 27, { color: "green" }, 90);
  const hlR = addDevice(c, "lamp", "LR", "body", 30, 27, { color: "red" }, 90);

  addWire(c, g.symbol, "L1", qf.symbol, "L1");
  addWire(c, g.symbol, "L2", qf.symbol, "L2");
  addWire(c, g.symbol, "L3", qf.symbol, "L3");
  addWire(c, qf.symbol, "T1", fMain, "L1");
  addWire(c, qf.symbol, "T2", fMain, "L2");
  addWire(c, qf.symbol, "T3", fMain, "L3");
  addWire(c, qf.symbol, "T1", rMain, "L2");
  addWire(c, qf.symbol, "T2", rMain, "L1");
  addWire(c, qf.symbol, "T3", rMain, "L3");
  addWire(c, fMain, "T1", ol.symbol, "L1");
  addWire(c, fMain, "T2", ol.symbol, "L2");
  addWire(c, fMain, "T3", ol.symbol, "L3");
  addWire(c, rMain, "T1", ol.symbol, "L1");
  addWire(c, rMain, "T2", ol.symbol, "L2");
  addWire(c, rMain, "T3", ol.symbol, "L3");
  addWire(c, ol.symbol, "T1", m.symbol, "U");
  addWire(c, ol.symbol, "T2", m.symbol, "V");
  addWire(c, ol.symbol, "T3", m.symbol, "W");

  addWire(c, g.symbol, "L1", stop.symbol, "1");
  addWire(c, stop.symbol, "2", start.symbol, "1");
  addWire(c, stop.symbol, "2", fHold, "13");
  addWire(c, stop.symbol, "2", rHold, "13");
  addWire(c, start.symbol, "2", sa.symbol, "COM");
  addWire(c, fHold, "14", sa.symbol, "COM");
  addWire(c, rHold, "14", sa.symbol, "COM");
  addWire(c, sa.symbol, "FWD", rInt, "21");
  addWire(c, rInt, "22", f.symbol, "A1");
  addWire(c, sa.symbol, "REV", fInt, "21");
  addWire(c, fInt, "22", r.symbol, "A1");
  addWire(c, f.symbol, "A2", ol.symbol, "95");
  addWire(c, r.symbol, "A2", ol.symbol, "95");
  addWire(c, ol.symbol, "96", g.symbol, "L2");
  addWire(c, f.symbol, "A1", hlF.symbol, "1");
  addWire(c, hlF.symbol, "2", g.symbol, "L2");
  addWire(c, r.symbol, "A1", hlR.symbol, "1");
  addWire(c, hlR.symbol, "2", g.symbol, "L2");
  return c;
}

export const EXAMPLES: Example[] = [
  {
    id: "lamp",
    title: "指示燈點動",
    blurb: "按常開按鈕，L1 經按鈕點亮指示燈。",
    build: lampJog,
  },
  {
    id: "dol",
    title: "接觸器自鎖起動",
    blurb: "停止常閉、起動常開、KM 自鎖、熱繼電保護三相電機。",
    build: selfHoldMotor,
  },
  {
    id: "rev",
    title: "正反轉點動",
    blurb: "正反轉起動器，綠鈕正轉、另一綠鈕反轉，紅鈕停止。",
    build: fwdRevJog,
  },
  {
    id: "yd",
    title: "星三角降壓起動",
    blurb: "KM1 線路、KM2 星形、KM3 三角形，KT 延時由星切三角。",
    build: starDeltaStart,
  },
  {
    id: "selrev",
    title: "選擇開關正反轉",
    blurb: "NEMA 梯形圖：STOP／START、FWD-OFF-REV 選擇開關、F／R 互鎖。先撳選擇開關再 START。",
    build: selectorReversing,
  },
];
