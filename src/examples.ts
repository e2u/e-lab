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
  const nl1 = addDevice(c, "net-label", "NL1", "body", 6, 1);
  const nl2 = addDevice(c, "net-label", "NL2", "body", 6, 3);
  const sb = addDevice(c, "pb-no", "SB1", "body", 12, 4);
  const hl = addDevice(c, "lamp", "HL1", "body", 20, 4, { color: "green" });
  
  // Use net labels for power connections
  addWire(c, g.symbol, "L1", nl1.symbol, "1");
  addWire(c, g.symbol, "L2", nl2.symbol, "1");
  addWire(c, nl1.symbol, "1", sb.symbol, "1");
  addWire(c, sb.symbol, "2", hl.symbol, "1");
  addWire(c, hl.symbol, "2", nl2.symbol, "1");
  return c;
}

export function transformer(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "mains-3ph", "G1", "body", 2, 2);
  const nl1 = addDevice(c, "net-label", "NL1", "body", 10, 1);
  const nl2 = addDevice(c, "net-label", "NL2", "body", 10, 3);
  const tc = addDevice(c, "transformer", "TC1", "body", 18, 2, { ratio: "480/120" });
  const hl = addDevice(c, "lamp", "HL1", "body", 26, 2, { color: "green" });

  addWire(c, g.symbol, "L1", nl1.symbol, "1");
  addWire(c, g.symbol, "L2", nl2.symbol, "1");
  addWire(c, nl1.symbol, "1", tc.symbol, "H1");
  addWire(c, nl2.symbol, "1", tc.symbol, "H2");
  addWire(c, tc.symbol, "X1", hl.symbol, "1");
  addWire(c, hl.symbol, "2", tc.symbol, "X2");
  return c;
}

export function selfHoldMotor(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "mains-3ph", "G1", "body", 1, 1);
  const nl1 = addDevice(c, "net-label", "NL1", "body", 4, 1);
  const nl2 = addDevice(c, "net-label", "NL2", "body", 4, 3);
  const nl3 = addDevice(c, "net-label", "NL3", "body", 4, 5);
  const nlS1 = addDevice(c, "net-label", "NL_S1", "body", 1, 15);
  const nlS2 = addDevice(c, "net-label", "NL_S2", "body", 4, 17);
  const qf = addDevice(c, "breaker-3p", "QF1", "body", 8, 2);
  const km = addDevice(c, "contactor", "KM1", "coil", 30, 14);
  const kmMain = addSymbol(c, km.device.id, "main", 16, 2);
  const kmNo = addSymbol(c, km.device.id, "aux-no", 22, 13);
  const fr = addDevice(c, "overload", "FR1", "body", 24, 2);
  const m = addDevice(c, "motor-3ph", "M1", "body", 34, 2);
  const tc = addDevice(c, "transformer", "TC1", "body", 1, 13, { ratio: "480/120" });
  const stop = addDevice(c, "pb-nc", "SB1", "body", 10, 13);
  const start = addDevice(c, "pb-no", "SB2", "body", 16, 13);
  const hl = addDevice(c, "lamp", "HL1", "body", 30, 19, { color: "green" });

  // Power distribution using net labels
  addWire(c, g.symbol, "L1", nl1.symbol, "1");
  addWire(c, g.symbol, "L2", nl2.symbol, "1");
  addWire(c, g.symbol, "L3", nl3.symbol, "1");
  
  // Main power through breaker
  addWire(c, nl1.symbol, "1", qf.symbol, "L1");
  addWire(c, nl2.symbol, "1", qf.symbol, "L2");
  addWire(c, nl3.symbol, "1", qf.symbol, "L3");
  addWire(c, qf.symbol, "T1", kmMain, "L1");
  addWire(c, qf.symbol, "T2", kmMain, "L2");
  addWire(c, qf.symbol, "T3", kmMain, "L3");
  addWire(c, kmMain, "T1", fr.symbol, "L1");
  addWire(c, kmMain, "T2", fr.symbol, "L2");
  addWire(c, kmMain, "T3", fr.symbol, "L3");
  addWire(c, fr.symbol, "T1", m.symbol, "U");
  addWire(c, fr.symbol, "T2", m.symbol, "V");
  addWire(c, fr.symbol, "T3", m.symbol, "W");

  // Transformer power from net labels
  addWire(c, nl1.symbol, "1", tc.symbol, "H1");
  addWire(c, nl2.symbol, "1", tc.symbol, "H2");

  // Transformer secondary to net labels
  addWire(c, tc.symbol, "X1", nlS1.symbol, "1");
  addWire(c, tc.symbol, "X2", nlS2.symbol, "1");

  // Control circuit using net labels
  addWire(c, nlS1.symbol, "1", fr.symbol, "95");
  addWire(c, fr.symbol, "96", stop.symbol, "1");
  addWire(c, stop.symbol, "2", start.symbol, "1");
  addWire(c, stop.symbol, "2", kmNo, "13");
  addWire(c, start.symbol, "2", km.symbol, "A1");
  addWire(c, kmNo, "14", km.symbol, "A1");
  addWire(c, km.symbol, "A2", nlS2.symbol, "1");
  
  // Indicator light circuit using net labels
  addWire(c, km.symbol, "A1", hl.symbol, "1");
  addWire(c, hl.symbol, "2", nlS2.symbol, "1");
  return c;
}

export function fwdRevJog(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "mains-3ph", "G1", "body", 1, 1);
  const nl1 = addDevice(c, "net-label", "NL1", "body", 4, 1);
  const nl2 = addDevice(c, "net-label", "NL2", "body", 4, 3);
  const nl3 = addDevice(c, "net-label", "NL3", "body", 4, 5);
  const nlN = addDevice(c, "net-label", "N", "body", 4, 17);
  const qf = addDevice(c, "breaker-3p", "QF1", "body", 8, 2);
  const kmr = addDevice(c, "starter-rev-combo", "KMR1", "body", 16, 1);
  const m = addDevice(c, "motor-3ph", "M1", "body", 32, 2);
  const stop = addDevice(c, "pb-nc", "SB1", "body", 8, 14);
  const fwd = addDevice(c, "pb-no", "SB2", "body", 14, 14);
  const rev = addDevice(c, "pb-no", "SB3", "body", 20, 14);

  // Power distribution using net labels
  addWire(c, g.symbol, "L1", nl1.symbol, "1");
  addWire(c, g.symbol, "L2", nl2.symbol, "1");
  addWire(c, g.symbol, "L3", nl3.symbol, "1");
  addWire(c, g.symbol, "N", nlN.symbol, "1");
  
  // Main power through breaker
  addWire(c, nl1.symbol, "1", qf.symbol, "L1");
  addWire(c, nl2.symbol, "1", qf.symbol, "L2");
  addWire(c, nl3.symbol, "1", qf.symbol, "L3");
  addWire(c, qf.symbol, "T1", kmr.symbol, "L1");
  addWire(c, qf.symbol, "T2", kmr.symbol, "L2");
  addWire(c, qf.symbol, "T3", kmr.symbol, "L3");
  addWire(c, kmr.symbol, "T1", m.symbol, "U");
  addWire(c, kmr.symbol, "T2", m.symbol, "V");
  addWire(c, kmr.symbol, "T3", m.symbol, "W");

  // Control circuit using net labels
  addWire(c, nl1.symbol, "1", stop.symbol, "1");
  addWire(c, stop.symbol, "2", fwd.symbol, "1");
  addWire(c, stop.symbol, "2", rev.symbol, "1");
  addWire(c, fwd.symbol, "2", kmr.symbol, "A1F");
  addWire(c, rev.symbol, "2", kmr.symbol, "A1R");
  addWire(c, kmr.symbol, "A2F", nlN.symbol, "1");
  addWire(c, kmr.symbol, "A2R", nlN.symbol, "1");
  return c;
}

export function starDeltaStart(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "mains-3ph", "G1", "body", 1, 1);
  const nl1 = addDevice(c, "net-label", "NL1", "body", 4, 1);
  const nl2 = addDevice(c, "net-label", "NL2", "body", 4, 3);
  const nl3 = addDevice(c, "net-label", "NL3", "body", 4, 5);
  const nlS1 = addDevice(c, "net-label", "NL_S1", "body", 1, 18);
  const nlS2 = addDevice(c, "net-label", "NL_S2", "body", 4, 20);
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
  const tc = addDevice(c, "transformer", "TC1", "body", 1, 16, { ratio: "480/120" });
  const stop = addDevice(c, "pb-nc", "SB1", "body", 9, 16);
  const start = addDevice(c, "pb-no", "SB2", "body", 14, 16);
  const kt = addDevice(c, "timer-on", "KT1", "coil", 32, 16, { delayMs: 2000 });
  const ktNc = addSymbol(c, kt.device.id, "delayed-nc", 38, 16);
  const ktNo = addSymbol(c, kt.device.id, "delayed-no", 38, 19);
  const hlRun = addDevice(c, "lamp", "HL1", "body", 46, 16, { color: "green" });
  const hlY = addDevice(c, "lamp", "HL2", "body", 46, 21, { color: "yellow" });
  const hlD = addDevice(c, "lamp", "HL3", "body", 46, 26, { color: "blue" });

  // Power distribution using net labels
  addWire(c, g.symbol, "L1", nl1.symbol, "1");
  addWire(c, g.symbol, "L2", nl2.symbol, "1");
  addWire(c, g.symbol, "L3", nl3.symbol, "1");
  
  // Main power through breaker
  addWire(c, nl1.symbol, "1", qf.symbol, "L1");
  addWire(c, nl2.symbol, "1", qf.symbol, "L2");
  addWire(c, nl3.symbol, "1", qf.symbol, "L3");
  addWire(c, qf.symbol, "T1", kmLMain, "L1");
  addWire(c, qf.symbol, "T2", kmLMain, "L2");
  addWire(c, qf.symbol, "T3", kmLMain, "L3");
  addWire(c, kmLMain, "T1", fr.symbol, "L1");
  addWire(c, kmLMain, "T2", fr.symbol, "L2");
  addWire(c, kmLMain, "T3", fr.symbol, "L3");
  addWire(c, fr.symbol, "T1", m.symbol, "U");
  addWire(c, fr.symbol, "T2", m.symbol, "V");
  addWire(c, fr.symbol, "T3", m.symbol, "W");

  // Star connection
  addWire(c, kmYMain, "T1", kmYMain, "T2");
  addWire(c, kmYMain, "T2", kmYMain, "T3");

  // Transformer power from net labels
  addWire(c, nl1.symbol, "1", tc.symbol, "H1");
  addWire(c, nl2.symbol, "1", tc.symbol, "H2");

  // Transformer secondary to net labels
  addWire(c, tc.symbol, "X1", nlS1.symbol, "1");
  addWire(c, tc.symbol, "X2", nlS2.symbol, "1");

  // Control circuit using net labels
  addWire(c, nlS1.symbol, "1", fr.symbol, "95");
  addWire(c, fr.symbol, "96", stop.symbol, "1");
  addWire(c, stop.symbol, "2", start.symbol, "1");
  addWire(c, stop.symbol, "2", kmLNo, "13");
  addWire(c, start.symbol, "2", kmL.symbol, "A1");
  addWire(c, kmLNo, "14", kmL.symbol, "A1");
  addWire(c, kmL.symbol, "A2", nlS2.symbol, "1");
  addWire(c, kmL.symbol, "A1", kt.symbol, "A1");
  addWire(c, kt.symbol, "A2", nlS2.symbol, "1");
  addWire(c, kmL.symbol, "A1", ktNc, "15");
  addWire(c, ktNc, "16", kmDNc, "21");
  addWire(c, kmDNc, "22", kmY.symbol, "A1");
  addWire(c, kmY.symbol, "A2", nlS2.symbol, "1");
  addWire(c, kmL.symbol, "A1", ktNo, "15");
  addWire(c, ktNo, "18", kmYNc, "21");
  addWire(c, kmYNc, "22", kmD.symbol, "A1");
  addWire(c, kmD.symbol, "A2", nlS2.symbol, "1");
  addWire(c, kmL.symbol, "A1", hlRun.symbol, "1");
  addWire(c, hlRun.symbol, "2", nlS2.symbol, "1");
  addWire(c, kmY.symbol, "A1", hlY.symbol, "1");
  addWire(c, hlY.symbol, "2", nlS2.symbol, "1");
  addWire(c, kmD.symbol, "A1", hlD.symbol, "1");
  addWire(c, hlD.symbol, "2", nlS2.symbol, "1");
  return c;
}

export function selectorReversing(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "mains-3ph", "G1", "body", 1, 1);
  const nl1 = addDevice(c, "net-label", "NL1", "body", 4, 1);
  const nl2 = addDevice(c, "net-label", "NL2", "body", 4, 3);
  const nl3 = addDevice(c, "net-label", "NL3", "body", 4, 5);
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
  const nlA1F = addDevice(c, "net-label", "NA1F", "body", 36, 15);
  const nlA1R = addDevice(c, "net-label", "NA1R", "body", 36, 21);
  const nlA2 = addDevice(c, "net-label", "NA2", "body", 28, 17);
  const nl95 = addDevice(c, "net-label", "N95", "body", 26, 8);

  // Power distribution using net labels
  addWire(c, g.symbol, "L1", nl1.symbol, "1");
  addWire(c, g.symbol, "L2", nl2.symbol, "1");
  addWire(c, g.symbol, "L3", nl3.symbol, "1");
  
  // Main power through breaker
  addWire(c, nl1.symbol, "1", qf.symbol, "L1");
  addWire(c, nl2.symbol, "1", qf.symbol, "L2");
  addWire(c, nl3.symbol, "1", qf.symbol, "L3");
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

  // Control circuit
  addWire(c, nl1.symbol, "1", stop.symbol, "1");
  addWire(c, stop.symbol, "2", start.symbol, "1");
  addWire(c, stop.symbol, "2", fHold, "13");
  addWire(c, stop.symbol, "2", rHold, "13");
  addWire(c, start.symbol, "2", sa.symbol, "COM");
  addWire(c, fHold, "14", sa.symbol, "COM");
  addWire(c, rHold, "14", sa.symbol, "COM");
  addWire(c, sa.symbol, "FWD", rInt, "21");
  addWire(c, rInt, "22", nlA1F.symbol, "1");
  addWire(c, nlA1F.symbol, "1", f.symbol, "A1");
  addWire(c, f.symbol, "A2", nlA2.symbol, "1");
  addWire(c, sa.symbol, "REV", fInt, "21");
  addWire(c, fInt, "22", nlA1R.symbol, "1");
  addWire(c, nlA1R.symbol, "1", r.symbol, "A1");
  addWire(c, r.symbol, "A2", nlA2.symbol, "1");
  addWire(c, nlA2.symbol, "1", ol.symbol, "95");
  addWire(c, ol.symbol, "96", nl95.symbol, "1");
  addWire(c, nl95.symbol, "1", nl2.symbol, "1");
  addWire(c, f.symbol, "A1", nlA1F.symbol, "1");
  addWire(c, nlA1F.symbol, "1", hlF.symbol, "1");
  addWire(c, hlF.symbol, "2", nlA2.symbol, "1");
  addWire(c, r.symbol, "A1", nlA1R.symbol, "1");
  addWire(c, nlA1R.symbol, "1", hlR.symbol, "1");
  addWire(c, hlR.symbol, "2", nlA2.symbol, "1");
  return c;
}

export const EXAMPLES: Example[] = [
  {
    id: "transformer",
    title: "Transformer",
    blurb: "三相電源經變壓器降壓，驅動綠色指示燈。",
    build: transformer,
  },
];
