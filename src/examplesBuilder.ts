import { addDevice, addSymbol, addWire, emptyCircuit } from "./circuitBuilder";
import type { Circuit } from "./types";

/**
 * 01# Basic Lamp Circuit
 */
export function ex01BasicLamp(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "dc-supply", "G1", "body", 4, 4);
  const sb = addDevice(c, "pb-no", "SB1", "body", 14, 4);
  const hl = addDevice(c, "lamp", "HL1", "body", 22, 3.5, { color: "green" });

  addWire(c, g.symbol, "+", sb.symbol, "1");
  addWire(c, sb.symbol, "2", hl.symbol, "1");
  addWire(c, hl.symbol, "2", g.symbol, "-");
  return c;
}

/**
 * 02# Start-Stop Dual Indicators
 */
export function ex02StartStopLamp(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "dc-supply", "G1", "body", 4, 4);
  const sb1 = addDevice(c, "pb-nc", "SB1", "body", 14, 4);
  const sb2 = addDevice(c, "pb-no", "SB2", "body", 20, 4);
  const hl1 = addDevice(c, "lamp", "HL1", "body", 28, 3.5, { color: "green" });
  const hl2 = addDevice(c, "lamp", "HL2", "body", 28, 8.5, { color: "red" });

  addWire(c, g.symbol, "+", sb1.symbol, "1");
  addWire(c, sb1.symbol, "2", sb2.symbol, "1");
  addWire(c, sb2.symbol, "2", hl1.symbol, "1");
  addWire(c, hl1.symbol, "2", g.symbol, "-");

  // Red lamp indicates power ready when stop button is unpressed
  addWire(c, sb1.symbol, "2", hl2.symbol, "1");
  addWire(c, hl2.symbol, "2", g.symbol, "-");
  return c;
}

/**
 * 03# Control Transformer & Fuse Protection
 */
export function ex03TransformerFuse(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "mains-3ph", "G1", "delta", 4, 4, { supplyType: "delta", voltage: 480 });
  const fu1 = addDevice(c, "fuse", "FU1", "body", 14, 4);
  const fu2 = addDevice(c, "fuse", "FU2", "body", 14, 6);
  const tc = addDevice(c, "transformer", "TC1", "body", 22, 4, {
    ratio: "480/120",
    primaryVoltage: 480,
    secondaryVoltage: 120,
  });
  const fu3 = addDevice(c, "fuse", "FU3", "body", 34, 4);
  const vm = addDevice(c, "voltmeter", "VM1", "body", 42, 3.5);
  const hl = addDevice(c, "lamp", "HL1", "body", 42, 8.5, { color: "green" });
  const pe = addDevice(c, "ground", "PE1", "body", 22, 10);

  addWire(c, g.symbol, "L1", fu1.symbol, "1");
  addWire(c, fu1.symbol, "2", tc.symbol, "H1");
  addWire(c, g.symbol, "L2", fu2.symbol, "1");
  addWire(c, fu2.symbol, "2", tc.symbol, "H2");

  addWire(c, tc.symbol, "X1", fu3.symbol, "1");
  addWire(c, fu3.symbol, "2", vm.symbol, "1");
  addWire(c, tc.symbol, "X2", vm.symbol, "2");

  addWire(c, fu3.symbol, "2", hl.symbol, "1");
  addWire(c, hl.symbol, "2", tc.symbol, "X2");

  addWire(c, tc.symbol, "X2", pe.symbol, "1");
  addWire(c, g.symbol, "PE", pe.symbol, "1");
  return c;
}

/**
 * 04# Relay Self-Holding Circuit
 */
export function ex04RelaySelfHolding(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "dc-supply", "G1", "body", 4, 4);
  const sb1 = addDevice(c, "pb-nc", "SB1", "body", 14, 4);
  const sb2 = addDevice(c, "pb-no", "SB2", "body", 20, 4);
  const ka1 = addDevice(c, "relay", "KA1", "coil", 30, 3.5);
  const ka1No = addSymbol(c, ka1.device.id, "aux-no", 20, 8);
  const ka1Nc = addSymbol(c, ka1.device.id, "aux-nc", 20, 13);
  const hl1 = addDevice(c, "lamp", "HL1", "body", 30, 7.5, { color: "green" });
  const hl2 = addDevice(c, "lamp", "HL2", "body", 30, 12.5, { color: "red" });

  addWire(c, g.symbol, "+", sb1.symbol, "1");
  addWire(c, sb1.symbol, "2", sb2.symbol, "1");
  addWire(c, sb1.symbol, "2", ka1No, "1");
  addWire(c, sb2.symbol, "2", ka1.symbol, "A1");
  addWire(c, ka1No, "2", ka1.symbol, "A1");
  addWire(c, ka1.symbol, "A2", g.symbol, "-");

  addWire(c, ka1.symbol, "A1", hl1.symbol, "1");
  addWire(c, hl1.symbol, "2", g.symbol, "-");

  addWire(c, g.symbol, "+", ka1Nc, "3");
  addWire(c, ka1Nc, "4", hl2.symbol, "1");
  addWire(c, hl2.symbol, "2", g.symbol, "-");
  return c;
}

/**
 * 05# Single-Phase Motor Manual Control
 */
export function ex05Motor1phManual(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "mains-3ph", "G1", "wye", 4, 4, { supplyType: "wye", voltage: 208 });
  const qf = addDevice(c, "breaker-1p", "QF1", "body", 14, 4);
  const sa = addDevice(c, "toggle-spst", "SA1", "body", 20, 4);
  const am = addDevice(c, "ammeter", "AM1", "body", 26, 3.5);
  const m = addDevice(c, "motor-1ph", "M1", "body", 36, 3.5, { power: 1.5 });
  const vm = addDevice(c, "voltmeter", "VM1", "body", 26, 9.5);
  const pe = addDevice(c, "ground", "PE1", "body", 36, 11);

  addWire(c, g.symbol, "L1", qf.symbol, "1");
  addWire(c, qf.symbol, "2", sa.symbol, "1");
  addWire(c, sa.symbol, "2", am.symbol, "1");
  addWire(c, am.symbol, "2", m.symbol, "U1");
  addWire(c, g.symbol, "N", m.symbol, "U2");

  addWire(c, sa.symbol, "2", vm.symbol, "1");
  addWire(c, g.symbol, "N", vm.symbol, "2");

  addWire(c, g.symbol, "PE", pe.symbol, "1");
  return c;
}

/**
 * 06# Three-Phase Motor DOL Starter
 */
export function ex06Motor3phDol(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "mains-3ph", "G1", "delta", 4, 4, { supplyType: "delta", voltage: 480, maxCurrent: 400 });
  const qs = addDevice(c, "isolator", "QS1", "body", 14, 4);
  const qf = addDevice(c, "breaker-3p", "QF1", "body", 22, 4);
  const km = addDevice(c, "contactor", "KM1", "coil", 36, 13.5);
  const kmMain = addSymbol(c, km.device.id, "main", 30, 4);
  const kmNo = addSymbol(c, km.device.id, "aux-no", 26, 18);
  const m = addDevice(c, "motor-3ph", "M1", "body", 38, 4, { power: 5.5 });

  const tc = addDevice(c, "transformer", "TC1", "body", 12, 14, { ratio: "480/120", primaryVoltage: 480, secondaryVoltage: 120 });
  const stop = addDevice(c, "pb-nc", "SB1", "body", 20, 14);
  const start = addDevice(c, "pb-no", "SB2", "body", 26, 14);
  const hl = addDevice(c, "lamp", "HL1", "body", 36, 17.5, { color: "green" });
  const pe = addDevice(c, "ground", "PE1", "body", 4, 16);

  // 3-Phase Power (Y=5, 7, 9 straight lines)
  addWire(c, g.symbol, "L1", qs.symbol, "L1");
  addWire(c, g.symbol, "L2", qs.symbol, "L2");
  addWire(c, g.symbol, "L3", qs.symbol, "L3");
  addWire(c, qs.symbol, "T1", qf.symbol, "L1");
  addWire(c, qs.symbol, "T2", qf.symbol, "L2");
  addWire(c, qs.symbol, "T3", qf.symbol, "L3");
  addWire(c, qf.symbol, "T1", kmMain, "L1");
  addWire(c, qf.symbol, "T2", kmMain, "L2");
  addWire(c, qf.symbol, "T3", kmMain, "L3");
  addWire(c, kmMain, "T1", m.symbol, "U");
  addWire(c, kmMain, "T2", m.symbol, "V");
  addWire(c, kmMain, "T3", m.symbol, "W");
  addWire(c, g.symbol, "PE", pe.symbol, "1");

  // Control Transformer & Circuit (Y=15 straight line)
  addWire(c, qs.symbol, "T1", tc.symbol, "H1");
  addWire(c, qs.symbol, "T2", tc.symbol, "H2");
  addWire(c, tc.symbol, "X1", stop.symbol, "1");
  addWire(c, stop.symbol, "2", start.symbol, "1");
  addWire(c, stop.symbol, "2", kmNo, "13");
  addWire(c, start.symbol, "2", km.symbol, "A1");
  addWire(c, kmNo, "14", km.symbol, "A1");
  addWire(c, km.symbol, "A2", tc.symbol, "X2");
  addWire(c, tc.symbol, "X2", pe.symbol, "1");

  // Indicator
  addWire(c, km.symbol, "A1", hl.symbol, "1");
  addWire(c, hl.symbol, "2", tc.symbol, "X2");
  return c;
}

/**
 * 07# Motor Overload Protection & Alarm
 */
export function ex07OverloadAlarm(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "mains-3ph", "G1", "delta", 4, 4, { supplyType: "delta", voltage: 480 });
  const qf = addDevice(c, "breaker-3p", "QF1", "body", 14, 4);
  const km = addDevice(c, "contactor", "KM1", "coil", 36, 13.5);
  const kmMain = addSymbol(c, km.device.id, "main", 22, 4);
  const kmNo = addSymbol(c, km.device.id, "aux-no", 26, 18);
  const fr = addDevice(c, "overload", "FR1", "body", 30, 4);
  const frNc = addSymbol(c, fr.device.id, "aux-nc", 15, 14);
  const frNo = addSymbol(c, fr.device.id, "aux-no", 20, 22.5);
  const m = addDevice(c, "motor-3ph", "M1", "body", 38, 4, { power: 7.5 });

  const tc = addDevice(c, "transformer", "TC1", "body", 10, 14, { ratio: "480/120" });
  const stop = addDevice(c, "pb-nc", "SB1", "body", 20, 14);
  const start = addDevice(c, "pb-no", "SB2", "body", 26, 14);
  const hlRun = addDevice(c, "lamp", "HL1", "body", 36, 17.5, { color: "green" });
  const alTrip = addDevice(c, "alarm", "AL1", "body", 36, 22.5);
  const horn = addDevice(c, "horn", "HA1", "body", 42, 22.5);
  const pe = addDevice(c, "ground", "PE1", "body", 4, 16);

  // Power (Y=5, 7, 9 straight lines)
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
  addWire(c, g.symbol, "PE", pe.symbol, "1");

  // Control (Y=15 straight line)
  addWire(c, qf.symbol, "T1", tc.symbol, "H1");
  addWire(c, qf.symbol, "T2", tc.symbol, "H2");
  addWire(c, tc.symbol, "X1", frNc, "95");
  addWire(c, frNc, "96", stop.symbol, "1");
  addWire(c, stop.symbol, "2", start.symbol, "1");
  addWire(c, stop.symbol, "2", kmNo, "13");
  addWire(c, start.symbol, "2", km.symbol, "A1");
  addWire(c, kmNo, "14", km.symbol, "A1");
  addWire(c, km.symbol, "A2", tc.symbol, "X2");
  addWire(c, tc.symbol, "X2", pe.symbol, "1");

  // Run Lamp
  addWire(c, km.symbol, "A1", hlRun.symbol, "1");
  addWire(c, hlRun.symbol, "2", tc.symbol, "X2");

  // Trip Alarm Branch via 97-98 (Y=24)
  addWire(c, tc.symbol, "X1", frNo, "97");
  addWire(c, frNo, "98", alTrip.symbol, "1");
  addWire(c, frNo, "98", horn.symbol, "1");
  addWire(c, alTrip.symbol, "2", tc.symbol, "X2");
  addWire(c, horn.symbol, "2", tc.symbol, "X2");
  return c;
}

/**
 * 08# Emergency Stop Safety Interlock
 */
export function ex08EstopSafety(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "mains-3ph", "G1", "delta", 4, 4, { supplyType: "delta", voltage: 480 });
  const qf = addDevice(c, "breaker-3p", "QF1", "body", 14, 4);
  const km = addDevice(c, "contactor", "KM1", "coil", 38, 21.5);
  const kmMain = addSymbol(c, km.device.id, "main", 22, 4);
  const kmNo = addSymbol(c, km.device.id, "aux-no", 30, 26);
  const m = addDevice(c, "motor-3ph", "M1", "body", 30, 4, { power: 5.5 });

  const tc = addDevice(c, "transformer", "TC1", "body", 10, 14, { ratio: "480/120" });
  const estop = addDevice(c, "estop-nc", "SB0", "body", 18, 14);
  const sbRst = addDevice(c, "pb-no", "SB_RST", "body", 24, 14);
  const ka0 = addDevice(c, "relay", "KA0", "coil", 34, 13.5);
  const ka0Hold = addSymbol(c, ka0.device.id, "aux-no", 24, 18);
  const ka0Gate = addSymbol(c, ka0.device.id, "aux-no", 18, 22);
  const ka0Estop = addSymbol(c, ka0.device.id, "aux-nc", 18, 30);

  const stop = addDevice(c, "pb-nc", "SB1", "body", 24, 22);
  const start = addDevice(c, "pb-no", "SB2", "body", 30, 22);
  const hlSafe = addDevice(c, "lamp", "HL_SAFE", "body", 42, 13.5, { color: "green" });
  const hlEstop = addDevice(c, "lamp", "HL_ESTOP", "body", 34, 29.5, { color: "red" });
  const hlRun = addDevice(c, "lamp", "HL_RUN", "body", 44, 21.5, { color: "blue" });
  const pe = addDevice(c, "ground", "PE1", "body", 4, 16);

  // Power (Y=5, 7, 9 straight lines)
  addWire(c, g.symbol, "L1", qf.symbol, "L1");
  addWire(c, g.symbol, "L2", qf.symbol, "L2");
  addWire(c, g.symbol, "L3", qf.symbol, "L3");
  addWire(c, qf.symbol, "T1", kmMain, "L1");
  addWire(c, qf.symbol, "T2", kmMain, "L2");
  addWire(c, qf.symbol, "T3", kmMain, "L3");
  addWire(c, kmMain, "T1", m.symbol, "U");
  addWire(c, kmMain, "T2", m.symbol, "V");
  addWire(c, kmMain, "T3", m.symbol, "W");
  addWire(c, g.symbol, "PE", pe.symbol, "1");

  // Transformer
  addWire(c, qf.symbol, "T1", tc.symbol, "H1");
  addWire(c, qf.symbol, "T2", tc.symbol, "H2");
  addWire(c, tc.symbol, "X2", pe.symbol, "1");

  // Safety Master Relay KA0 (Y=15 straight line)
  addWire(c, tc.symbol, "X1", estop.symbol, "11");
  addWire(c, estop.symbol, "12", sbRst.symbol, "1");
  addWire(c, estop.symbol, "12", ka0Hold, "1");
  addWire(c, sbRst.symbol, "2", ka0.symbol, "A1");
  addWire(c, ka0Hold, "2", ka0.symbol, "A1");
  addWire(c, ka0.symbol, "A2", tc.symbol, "X2");

  addWire(c, ka0.symbol, "A1", hlSafe.symbol, "1");
  addWire(c, hlSafe.symbol, "2", tc.symbol, "X2");

  // E-Stop Indicator via KA0 NC (Y=31)
  addWire(c, tc.symbol, "X1", ka0Estop, "3");
  addWire(c, ka0Estop, "4", hlEstop.symbol, "1");
  addWire(c, hlEstop.symbol, "2", tc.symbol, "X2");

  // Downstream Motor Control Gated by KA0 NO (Y=23 straight line)
  addWire(c, tc.symbol, "X1", ka0Gate, "1");
  addWire(c, ka0Gate, "2", stop.symbol, "1");
  addWire(c, stop.symbol, "2", start.symbol, "1");
  addWire(c, stop.symbol, "2", kmNo, "13");
  addWire(c, start.symbol, "2", km.symbol, "A1");
  addWire(c, kmNo, "14", km.symbol, "A1");
  addWire(c, km.symbol, "A2", tc.symbol, "X2");

  addWire(c, km.symbol, "A1", hlRun.symbol, "1");
  addWire(c, hlRun.symbol, "2", tc.symbol, "X2");
  return c;
}

/**
 * 09# Hand-Off-Auto Selector & Pump
 */
export function ex09HoaSelector(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "mains-3ph", "G1", "wye", 4, 4, { supplyType: "wye", voltage: 208 });
  const qf = addDevice(c, "breaker-1p", "QF1", "body", 14, 4);
  const kmMain = addDevice(c, "contactor", "KM1", "coil", 32, 13.5);
  const kmMainCont = addSymbol(c, kmMain.device.id, "main", 22, 4);
  const kmNo = addSymbol(c, kmMain.device.id, "aux-no", 22, 25);
  const m = addDevice(c, "motor-1ph", "M1", "body", 32, 3.5, { power: 1.5 });

  const sa = addDevice(c, "selector-3", "SA1", "body", 14, 14);
  const sb = addDevice(c, "pb-no", "SB1", "body", 22, 14);
  const sl = addDevice(c, "float", "SL1", "body", 22, 19);
  const yv = addDevice(c, "solenoid", "YV1", "body", 32, 24.5);
  const hlHand = addDevice(c, "lamp", "HL_MAN", "body", 40, 13.5, { color: "green" });
  const hlAuto = addDevice(c, "lamp", "HL_AUTO", "body", 40, 18.5, { color: "blue" });
  const pe = addDevice(c, "ground", "PE1", "body", 4, 14);

  // Power
  addWire(c, g.symbol, "L1", qf.symbol, "1");
  addWire(c, qf.symbol, "2", kmMainCont, "L1");
  addWire(c, kmMainCont, "T1", m.symbol, "U1");
  addWire(c, g.symbol, "N", m.symbol, "U2");
  addWire(c, g.symbol, "PE", pe.symbol, "1");

  // Control Selector (Y=15 straight line)
  addWire(c, qf.symbol, "2", sa.symbol, "COM");
  addWire(c, sa.symbol, "FWD", sb.symbol, "1");
  addWire(c, sb.symbol, "2", kmMain.symbol, "A1");
  addWire(c, sa.symbol, "FWD", hlHand.symbol, "1");
  addWire(c, hlHand.symbol, "2", g.symbol, "N");

  // Auto Branch (Y=20)
  addWire(c, sa.symbol, "REV", sl.symbol, "1");
  addWire(c, sl.symbol, "2", kmMain.symbol, "A1");
  addWire(c, sa.symbol, "REV", hlAuto.symbol, "1");
  addWire(c, hlAuto.symbol, "2", g.symbol, "N");

  addWire(c, kmMain.symbol, "A2", g.symbol, "N");

  // Solenoid Valve Gated by KM1 NO (Y=26)
  addWire(c, qf.symbol, "2", kmNo, "13");
  addWire(c, kmNo, "14", yv.symbol, "A1");
  addWire(c, yv.symbol, "A2", g.symbol, "N");
  return c;
}

/**
 * 10# Dual-Station Remote Motor Control
 */
export function ex10DualStation(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "mains-3ph", "G1", "delta", 4, 4, { supplyType: "delta", voltage: 480 });
  const qs = addDevice(c, "isolator", "QS1", "body", 14, 4);
  const qf = addDevice(c, "breaker-3p", "QF1", "body", 22, 4);
  const km = addDevice(c, "contactor", "KM1", "coil", 38, 13.5);
  const kmMain = addSymbol(c, km.device.id, "main", 30, 4);
  const kmNo = addSymbol(c, km.device.id, "aux-no", 28, 22);
  const fr = addDevice(c, "overload", "FR1", "body", 38, 4);
  const frNc = addSymbol(c, fr.device.id, "aux-nc", 12, 14);
  const m = addDevice(c, "motor-3ph", "M1", "body", 46, 4, { power: 5.5 });

  const tc = addDevice(c, "transformer", "TC1", "body", 8, 14, { ratio: "480/120" });
  const sb1Loc = addDevice(c, "pb-nc", "SB1_LOC", "body", 16, 14);
  const sb2Rem = addDevice(c, "pb-nc", "SB2_REM", "body", 22, 14);
  const sb3Loc = addDevice(c, "pb-no", "SB3_LOC", "body", 28, 14);
  const sb4Rem = addDevice(c, "pb-no", "SB4_REM", "body", 28, 18);
  const hl = addDevice(c, "lamp", "HL1", "body", 46, 13.5, { color: "green" });
  const pe = addDevice(c, "ground", "PE1", "body", 4, 16);

  // Power (Y=5, 7, 9 straight lines)
  addWire(c, g.symbol, "L1", qs.symbol, "L1");
  addWire(c, g.symbol, "L2", qs.symbol, "L2");
  addWire(c, g.symbol, "L3", qs.symbol, "L3");
  addWire(c, qs.symbol, "T1", qf.symbol, "L1");
  addWire(c, qs.symbol, "T2", qf.symbol, "L2");
  addWire(c, qs.symbol, "T3", qf.symbol, "L3");
  addWire(c, qf.symbol, "T1", kmMain, "L1");
  addWire(c, qf.symbol, "T2", kmMain, "L2");
  addWire(c, qf.symbol, "T3", kmMain, "L3");
  addWire(c, kmMain, "T1", fr.symbol, "L1");
  addWire(c, kmMain, "T2", fr.symbol, "L2");
  addWire(c, kmMain, "T3", fr.symbol, "L3");
  addWire(c, fr.symbol, "T1", m.symbol, "U");
  addWire(c, fr.symbol, "T2", m.symbol, "V");
  addWire(c, fr.symbol, "T3", m.symbol, "W");
  addWire(c, g.symbol, "PE", pe.symbol, "1");

  // Transformer & Control (Y=15 straight line)
  addWire(c, qf.symbol, "T1", tc.symbol, "H1");
  addWire(c, qf.symbol, "T2", tc.symbol, "H2");
  addWire(c, tc.symbol, "X2", pe.symbol, "1");

  // Series Stops (Y=15)
  addWire(c, tc.symbol, "X1", frNc, "95");
  addWire(c, frNc, "96", sb1Loc.symbol, "1");
  addWire(c, sb1Loc.symbol, "2", sb2Rem.symbol, "1");

  // Parallel Starts & Self-Holding
  addWire(c, sb2Rem.symbol, "2", sb3Loc.symbol, "1");
  addWire(c, sb2Rem.symbol, "2", sb4Rem.symbol, "1");
  addWire(c, sb2Rem.symbol, "2", kmNo, "13");

  addWire(c, sb3Loc.symbol, "2", km.symbol, "A1");
  addWire(c, sb4Rem.symbol, "2", km.symbol, "A1");
  addWire(c, kmNo, "14", km.symbol, "A1");

  addWire(c, km.symbol, "A2", tc.symbol, "X2");

  addWire(c, km.symbol, "A1", hl.symbol, "1");
  addWire(c, hl.symbol, "2", tc.symbol, "X2");
  return c;
}

/**
 * 11# Forward / Reverse Interlock Starter
 */
export function ex11FwdRevInterlock(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "mains-3ph", "G1", "delta", 4, 4, { supplyType: "delta", voltage: 480 });
  const qf = addDevice(c, "breaker-3p", "QF1", "body", 14, 4);

  const kmFwd = addDevice(c, "contactor", "KM_FWD", "coil", 34, 17.5);
  const kmFwdMain = addSymbol(c, kmFwd.device.id, "main", 22, 4);
  const kmFwdHold = addSymbol(c, kmFwd.device.id, "aux-no", 22, 22);
  const kmFwdLock = addSymbol(c, kmFwd.device.id, "aux-nc", 28, 26);

  const kmRev = addDevice(c, "contactor", "KM_REV", "coil", 34, 25.5);
  const kmRevMain = addSymbol(c, kmRev.device.id, "main", 22, 11);
  const kmRevHold = addSymbol(c, kmRev.device.id, "aux-no", 22, 30);
  const kmRevLock = addSymbol(c, kmRev.device.id, "aux-nc", 28, 18);

  const fr = addDevice(c, "overload", "FR1", "body", 34, 4);
  const frNc = addSymbol(c, fr.device.id, "aux-nc", 12, 18);
  const m = addDevice(c, "motor-3ph", "M1", "body", 42, 4, { power: 7.5 });

  const tc = addDevice(c, "transformer", "TC1", "body", 8, 18, { ratio: "480/120" });
  const stop = addDevice(c, "pb-nc", "SB_STOP", "body", 16, 18);
  const fwd = addDevice(c, "pb-no", "SB_FWD", "body", 22, 18);
  const rev = addDevice(c, "pb-no", "SB_REV", "body", 22, 26);

  const hlFwd = addDevice(c, "lamp", "HL_FWD", "body", 42, 17.5, { color: "green" });
  const hlRev = addDevice(c, "lamp", "HL_REV", "body", 42, 25.5, { color: "yellow" });
  const pe = addDevice(c, "ground", "PE1", "body", 4, 18);

  // Power Main
  addWire(c, g.symbol, "L1", qf.symbol, "L1");
  addWire(c, g.symbol, "L2", qf.symbol, "L2");
  addWire(c, g.symbol, "L3", qf.symbol, "L3");

  addWire(c, qf.symbol, "T1", kmFwdMain, "L1");
  addWire(c, qf.symbol, "T2", kmFwdMain, "L2");
  addWire(c, qf.symbol, "T3", kmFwdMain, "L3");
  addWire(c, kmFwdMain, "T1", fr.symbol, "L1");
  addWire(c, kmFwdMain, "T2", fr.symbol, "L2");
  addWire(c, kmFwdMain, "T3", fr.symbol, "L3");

  // Phase swap for reverse (L1->T2, L2->T1, L3->T3)
  addWire(c, qf.symbol, "T1", kmRevMain, "L1");
  addWire(c, qf.symbol, "T2", kmRevMain, "L2");
  addWire(c, qf.symbol, "T3", kmRevMain, "L3");
  addWire(c, kmRevMain, "T1", fr.symbol, "L2");
  addWire(c, kmRevMain, "T2", fr.symbol, "L1");
  addWire(c, kmRevMain, "T3", fr.symbol, "L3");

  addWire(c, fr.symbol, "T1", m.symbol, "U");
  addWire(c, fr.symbol, "T2", m.symbol, "V");
  addWire(c, fr.symbol, "T3", m.symbol, "W");
  addWire(c, g.symbol, "PE", pe.symbol, "1");

  // Transformer
  addWire(c, qf.symbol, "T1", tc.symbol, "H1");
  addWire(c, qf.symbol, "T2", tc.symbol, "H2");
  addWire(c, tc.symbol, "X2", pe.symbol, "1");

  // Control Circuit
  addWire(c, tc.symbol, "X1", frNc, "95");
  addWire(c, frNc, "96", stop.symbol, "1");

  // Forward Branch (Y=19 straight line)
  addWire(c, stop.symbol, "2", fwd.symbol, "1");
  addWire(c, stop.symbol, "2", kmFwdHold, "13");
  addWire(c, fwd.symbol, "2", kmRevLock, "21");
  addWire(c, kmFwdHold, "14", kmRevLock, "21");
  addWire(c, kmRevLock, "22", kmFwd.symbol, "A1");
  addWire(c, kmFwd.symbol, "A2", tc.symbol, "X2");

  // Reverse Branch (Y=27 straight line)
  addWire(c, stop.symbol, "2", rev.symbol, "1");
  addWire(c, stop.symbol, "2", kmRevHold, "13");
  addWire(c, rev.symbol, "2", kmFwdLock, "21");
  addWire(c, kmRevHold, "14", kmFwdLock, "21");
  addWire(c, kmFwdLock, "22", kmRev.symbol, "A1");
  addWire(c, kmRev.symbol, "A2", tc.symbol, "X2");

  // Indicators
  addWire(c, kmFwd.symbol, "A1", hlFwd.symbol, "1");
  addWire(c, hlFwd.symbol, "2", tc.symbol, "X2");
  addWire(c, kmRev.symbol, "A1", hlRev.symbol, "1");
  addWire(c, hlRev.symbol, "2", tc.symbol, "X2");
  return c;
}

/**
 * 12# Limit Switch Auto-Cycle Travel
 */
export function ex12LimitReciprocating(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "mains-3ph", "G1", "delta", 4, 4, { supplyType: "delta", voltage: 480 });
  const qf = addDevice(c, "breaker-3p", "QF1", "body", 14, 4);

  const kmFwd = addDevice(c, "contactor", "KM1", "coil", 40, 17.5);
  const kmFwdMain = addSymbol(c, kmFwd.device.id, "main", 22, 4);
  const kmFwdHold = addSymbol(c, kmFwd.device.id, "aux-no", 22, 22);
  const kmFwdLock = addSymbol(c, kmFwd.device.id, "aux-nc", 34, 26);

  const kmRev = addDevice(c, "contactor", "KM2", "coil", 40, 25.5);
  const kmRevMain = addSymbol(c, kmRev.device.id, "main", 22, 11);
  const kmRevHold = addSymbol(c, kmRev.device.id, "aux-no", 22, 30);
  const kmRevLock = addSymbol(c, kmRev.device.id, "aux-nc", 34, 18);

  const m = addDevice(c, "motor-3ph", "M1", "body", 32, 4, { power: 5.5 });

  const tc = addDevice(c, "transformer", "TC1", "body", 8, 18, { ratio: "480/120" });
  const stop = addDevice(c, "pb-nc", "SB_STOP", "body", 16, 18);
  const start = addDevice(c, "pb-no", "SB_START", "body", 22, 18);
  const sqFwd = addDevice(c, "limit-nc", "SQ_FWD", "body", 28, 18);
  const sqRev = addDevice(c, "limit-nc", "SQ_REV", "body", 28, 26);

  const hlFwd = addDevice(c, "lamp", "HL_FWD", "body", 48, 17.5, { color: "green" });
  const hlRev = addDevice(c, "lamp", "HL_REV", "body", 48, 25.5, { color: "yellow" });
  const pe = addDevice(c, "ground", "PE1", "body", 4, 18);

  // Power
  addWire(c, g.symbol, "L1", qf.symbol, "L1");
  addWire(c, g.symbol, "L2", qf.symbol, "L2");
  addWire(c, g.symbol, "L3", qf.symbol, "L3");
  addWire(c, qf.symbol, "T1", kmFwdMain, "L1");
  addWire(c, qf.symbol, "T2", kmFwdMain, "L2");
  addWire(c, qf.symbol, "T3", kmFwdMain, "L3");
  addWire(c, kmFwdMain, "T1", m.symbol, "U");
  addWire(c, kmFwdMain, "T2", m.symbol, "V");
  addWire(c, kmFwdMain, "T3", m.symbol, "W");

  addWire(c, qf.symbol, "T1", kmRevMain, "L1");
  addWire(c, qf.symbol, "T2", kmRevMain, "L2");
  addWire(c, qf.symbol, "T3", kmRevMain, "L3");
  addWire(c, kmRevMain, "T1", m.symbol, "V");
  addWire(c, kmRevMain, "T2", m.symbol, "U");
  addWire(c, kmRevMain, "T3", m.symbol, "W");

  addWire(c, g.symbol, "PE", pe.symbol, "1");

  // Control
  addWire(c, qf.symbol, "T1", tc.symbol, "H1");
  addWire(c, qf.symbol, "T2", tc.symbol, "H2");
  addWire(c, tc.symbol, "X2", pe.symbol, "1");

  addWire(c, tc.symbol, "X1", stop.symbol, "1");
  addWire(c, stop.symbol, "2", start.symbol, "1");
  addWire(c, stop.symbol, "2", kmFwdHold, "13");

  // Forward branch (Y=19 straight line)
  addWire(c, start.symbol, "2", sqFwd.symbol, "1");
  addWire(c, kmFwdHold, "14", sqFwd.symbol, "1");
  addWire(c, sqFwd.symbol, "2", kmRevLock, "21");
  addWire(c, kmRevLock, "22", kmFwd.symbol, "A1");
  addWire(c, kmFwd.symbol, "A2", tc.symbol, "X2");

  // Reverse limit trigger branch (Y=27 straight line)
  addWire(c, stop.symbol, "2", kmRevHold, "13");
  addWire(c, kmRevHold, "14", sqRev.symbol, "1");
  addWire(c, sqRev.symbol, "2", kmFwdLock, "21");
  addWire(c, kmFwdLock, "22", kmRev.symbol, "A1");
  addWire(c, kmRev.symbol, "A2", tc.symbol, "X2");

  addWire(c, kmFwd.symbol, "A1", hlFwd.symbol, "1");
  addWire(c, hlFwd.symbol, "2", tc.symbol, "X2");
  addWire(c, kmRev.symbol, "A1", hlRev.symbol, "1");
  addWire(c, hlRev.symbol, "2", tc.symbol, "X2");
  return c;
}

/**
 * 13# On-Delay Timer Sequential Start
 */
export function ex13TimerOnSequence(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "mains-3ph", "G1", "delta", 4, 4, { supplyType: "delta", voltage: 480 });
  const qf = addDevice(c, "breaker-3p", "QF1", "body", 14, 4);

  const km1 = addDevice(c, "contactor", "KM1", "coil", 30, 17.5);
  const km1Main = addSymbol(c, km1.device.id, "main", 22, 4);
  const km1No = addSymbol(c, km1.device.id, "aux-no", 22, 22);
  const m1 = addDevice(c, "motor-3ph", "M1", "body", 30, 4, { power: 5.5 });

  const km2 = addDevice(c, "contactor", "KM2", "coil", 30, 25.5);
  const km2Main = addSymbol(c, km2.device.id, "main", 38, 4);
  const m2 = addDevice(c, "motor-3ph", "M2", "body", 46, 4, { power: 3.7 });

  const kt = addDevice(c, "timer-on", "KT1", "coil", 38, 17.5, { delayMs: 3000 });
  const ktNo = addSymbol(c, kt.device.id, "delayed-no", 22, 26);

  const tc = addDevice(c, "transformer", "TC1", "body", 8, 18, { ratio: "480/120" });
  const stop = addDevice(c, "pb-nc", "SB1", "body", 16, 18);
  const start = addDevice(c, "pb-no", "SB2", "body", 22, 18);
  const hl1 = addDevice(c, "lamp", "HL1", "body", 46, 17.5, { color: "green" });
  const hl2 = addDevice(c, "lamp", "HL2", "body", 46, 25.5, { color: "blue" });
  const pe = addDevice(c, "ground", "PE1", "body", 4, 18);

  // Power
  addWire(c, g.symbol, "L1", qf.symbol, "L1");
  addWire(c, g.symbol, "L2", qf.symbol, "L2");
  addWire(c, g.symbol, "L3", qf.symbol, "L3");

  addWire(c, qf.symbol, "T1", km1Main, "L1");
  addWire(c, qf.symbol, "T2", km1Main, "L2");
  addWire(c, qf.symbol, "T3", km1Main, "L3");
  addWire(c, km1Main, "T1", m1.symbol, "U");
  addWire(c, km1Main, "T2", m1.symbol, "V");
  addWire(c, km1Main, "T3", m1.symbol, "W");

  addWire(c, qf.symbol, "T1", km2Main, "L1");
  addWire(c, qf.symbol, "T2", km2Main, "L2");
  addWire(c, qf.symbol, "T3", km2Main, "L3");
  addWire(c, km2Main, "T1", m2.symbol, "U");
  addWire(c, km2Main, "T2", m2.symbol, "V");
  addWire(c, km2Main, "T3", m2.symbol, "W");

  addWire(c, g.symbol, "PE", pe.symbol, "1");

  // Control
  addWire(c, qf.symbol, "T1", tc.symbol, "H1");
  addWire(c, qf.symbol, "T2", tc.symbol, "H2");
  addWire(c, tc.symbol, "X2", pe.symbol, "1");

  // Conveyor KM1 Rung (Y=19 straight line)
  addWire(c, tc.symbol, "X1", stop.symbol, "1");
  addWire(c, stop.symbol, "2", start.symbol, "1");
  addWire(c, stop.symbol, "2", km1No, "13");
  addWire(c, start.symbol, "2", km1.symbol, "A1");
  addWire(c, km1No, "14", km1.symbol, "A1");
  addWire(c, km1.symbol, "A2", tc.symbol, "X2");

  // Timer KT1 in parallel with KM1
  addWire(c, km1.symbol, "A1", kt.symbol, "A1");
  addWire(c, kt.symbol, "A2", tc.symbol, "X2");

  // KM2 Feeder Rung via KT1 Delayed NO (Y=27 straight line)
  addWire(c, km1.symbol, "A1", ktNo, "15");
  addWire(c, ktNo, "18", km2.symbol, "A1");
  addWire(c, km2.symbol, "A2", tc.symbol, "X2");

  // Indicators
  addWire(c, km1.symbol, "A1", hl1.symbol, "1");
  addWire(c, hl1.symbol, "2", tc.symbol, "X2");
  addWire(c, km2.symbol, "A1", hl2.symbol, "1");
  addWire(c, hl2.symbol, "2", tc.symbol, "X2");
  return c;
}

/**
 * 14# Off-Delay Timer Fan Cooling Cycle
 */
export function ex14TimerOffCooling(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "mains-3ph", "G1", "delta", 4, 4, { supplyType: "delta", voltage: 480 });
  const qf = addDevice(c, "breaker-3p", "QF1", "body", 14, 4);

  const kmHeat = addDevice(c, "contactor", "KM_HEAT", "coil", 30, 17.5);
  const kmHeatMain = addSymbol(c, kmHeat.device.id, "main", 22, 4);
  const kmHeatNo = addSymbol(c, kmHeat.device.id, "aux-no", 22, 22);
  const heater = addDevice(c, "heater", "EH1", "body", 32, 3.5);

  const kmFan = addDevice(c, "contactor", "KM_FAN", "coil", 30, 25.5);
  const kmFanMain = addSymbol(c, kmFan.device.id, "main", 38, 4);
  const fan = addDevice(c, "fan", "FAN1", "body", 46, 3.5);

  const ktOff = addDevice(c, "timer-off", "KT1", "coil", 38, 17.5, { delayMs: 4000 });
  const ktDelayed = addSymbol(c, ktOff.device.id, "delayed-no", 22, 26);

  const tc = addDevice(c, "transformer", "TC1", "body", 8, 18, { ratio: "480/120" });
  const stop = addDevice(c, "pb-nc", "SB_STOP", "body", 16, 18);
  const start = addDevice(c, "pb-no", "SB_START", "body", 22, 18);
  const hlHeat = addDevice(c, "lamp", "HL_HEAT", "body", 46, 17.5, { color: "red" });
  const hlFan = addDevice(c, "lamp", "HL_FAN", "body", 46, 25.5, { color: "blue" });
  const pe = addDevice(c, "ground", "PE1", "body", 4, 18);

  // Power
  addWire(c, g.symbol, "L1", qf.symbol, "L1");
  addWire(c, g.symbol, "L2", qf.symbol, "L2");
  addWire(c, g.symbol, "L3", qf.symbol, "L3");

  addWire(c, qf.symbol, "T1", kmHeatMain, "L1");
  addWire(c, qf.symbol, "T2", kmHeatMain, "L2");
  addWire(c, kmHeatMain, "T1", heater.symbol, "1");
  addWire(c, kmHeatMain, "T2", heater.symbol, "2");

  addWire(c, qf.symbol, "T1", kmFanMain, "L1");
  addWire(c, qf.symbol, "T2", kmFanMain, "L2");
  addWire(c, kmFanMain, "T1", fan.symbol, "U1");
  addWire(c, kmFanMain, "T2", fan.symbol, "U2");

  // Control
  addWire(c, qf.symbol, "T1", tc.symbol, "H1");
  addWire(c, qf.symbol, "T2", tc.symbol, "H2");
  addWire(c, tc.symbol, "X2", pe.symbol, "1");

  // Heater Rung (Y=19 straight line)
  addWire(c, tc.symbol, "X1", stop.symbol, "1");
  addWire(c, stop.symbol, "2", start.symbol, "1");
  addWire(c, stop.symbol, "2", kmHeatNo, "13");
  addWire(c, start.symbol, "2", kmHeat.symbol, "A1");
  addWire(c, kmHeatNo, "14", kmHeat.symbol, "A1");
  addWire(c, kmHeat.symbol, "A2", tc.symbol, "X2");

  // Off-delay Timer coil
  addWire(c, kmHeat.symbol, "A1", ktOff.symbol, "A1");
  addWire(c, ktOff.symbol, "A2", tc.symbol, "X2");

  // Fan coil driven by KT1 Off-Delay contact (Y=27 straight line)
  addWire(c, tc.symbol, "X1", ktDelayed, "15");
  addWire(c, ktDelayed, "18", kmFan.symbol, "A1");
  addWire(c, kmFan.symbol, "A2", tc.symbol, "X2");

  // Indicators
  addWire(c, kmHeat.symbol, "A1", hlHeat.symbol, "1");
  addWire(c, hlHeat.symbol, "2", tc.symbol, "X2");
  addWire(c, kmFan.symbol, "A1", hlFan.symbol, "1");
  addWire(c, hlFan.symbol, "2", tc.symbol, "X2");
  return c;
}

/**
 * 15# Star-Delta (Y-Δ) Reduced Starter
 */
export function ex15StarDeltaStarter(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "mains-3ph", "G1", "delta", 4, 4, { supplyType: "delta", voltage: 480 });
  const qf = addDevice(c, "breaker-3p", "QF1", "body", 14, 4);

  const kmMain = addDevice(c, "contactor", "KM1", "coil", 30, 17.5);
  const kmMainCont = addSymbol(c, kmMain.device.id, "main", 22, 4);
  const kmMainNo = addSymbol(c, kmMain.device.id, "aux-no", 22, 22);

  const kmStar = addDevice(c, "contactor", "KM2", "coil", 38, 25.5);
  const kmStarMain = addSymbol(c, kmStar.device.id, "main", 30, 11);
  const kmStarNc = addSymbol(c, kmStar.device.id, "aux-nc", 30, 34);

  const kmDelta = addDevice(c, "contactor", "KM3", "coil", 38, 33.5);
  const kmDeltaNc = addSymbol(c, kmDelta.device.id, "aux-nc", 30, 26);

  const kt = addDevice(c, "timer-on", "KT1", "coil", 38, 17.5, { delayMs: 2500 });
  const ktNc = addSymbol(c, kt.device.id, "delayed-nc", 22, 26);
  const ktNo = addSymbol(c, kt.device.id, "delayed-no", 22, 34);

  const fr = addDevice(c, "overload", "FR1", "body", 30, 4);
  const frNc = addSymbol(c, fr.device.id, "aux-nc", 12, 18);
  const m = addDevice(c, "motor-3ph", "M1", "body", 38, 4, { power: 11 });

  const tc = addDevice(c, "transformer", "TC1", "body", 8, 18, { ratio: "480/120" });
  const stop = addDevice(c, "pb-nc", "SB1", "body", 16, 18);
  const start = addDevice(c, "pb-no", "SB2", "body", 22, 18);

  const hlRun = addDevice(c, "lamp", "HL_RUN", "body", 48, 17.5, { color: "green" });
  const hlStar = addDevice(c, "lamp", "HL_STAR", "body", 48, 25.5, { color: "yellow" });
  const hlDelta = addDevice(c, "lamp", "HL_DELTA", "body", 48, 33.5, { color: "blue" });
  const pe = addDevice(c, "ground", "PE1", "body", 4, 18);

  // Power
  addWire(c, g.symbol, "L1", qf.symbol, "L1");
  addWire(c, g.symbol, "L2", qf.symbol, "L2");
  addWire(c, g.symbol, "L3", qf.symbol, "L3");

  addWire(c, qf.symbol, "T1", kmMainCont, "L1");
  addWire(c, qf.symbol, "T2", kmMainCont, "L2");
  addWire(c, qf.symbol, "T3", kmMainCont, "L3");

  addWire(c, kmMainCont, "T1", fr.symbol, "L1");
  addWire(c, kmMainCont, "T2", fr.symbol, "L2");
  addWire(c, kmMainCont, "T3", fr.symbol, "L3");
  addWire(c, fr.symbol, "T1", m.symbol, "U");
  addWire(c, fr.symbol, "T2", m.symbol, "V");
  addWire(c, fr.symbol, "T3", m.symbol, "W");

  // Star bridge
  addWire(c, kmStarMain, "T1", kmStarMain, "T2");
  addWire(c, kmStarMain, "T2", kmStarMain, "T3");

  // Control
  addWire(c, qf.symbol, "T1", tc.symbol, "H1");
  addWire(c, qf.symbol, "T2", tc.symbol, "H2");
  addWire(c, tc.symbol, "X2", pe.symbol, "1");

  // Main Rung (Y=19 straight line)
  addWire(c, tc.symbol, "X1", frNc, "95");
  addWire(c, frNc, "96", stop.symbol, "1");
  addWire(c, stop.symbol, "2", start.symbol, "1");
  addWire(c, stop.symbol, "2", kmMainNo, "13");
  addWire(c, start.symbol, "2", kmMain.symbol, "A1");
  addWire(c, kmMainNo, "14", kmMain.symbol, "A1");
  addWire(c, kmMain.symbol, "A2", tc.symbol, "X2");

  // Timer KT1
  addWire(c, kmMain.symbol, "A1", kt.symbol, "A1");
  addWire(c, kt.symbol, "A2", tc.symbol, "X2");

  // Star KM2 path via KT1 NC and KM3 NC (Y=27 straight line)
  addWire(c, kmMain.symbol, "A1", ktNc, "15");
  addWire(c, ktNc, "16", kmDeltaNc, "21");
  addWire(c, kmDeltaNc, "22", kmStar.symbol, "A1");
  addWire(c, kmStar.symbol, "A2", tc.symbol, "X2");

  // Delta KM3 path via KT1 NO and KM2 NC (Y=35 straight line)
  addWire(c, kmMain.symbol, "A1", ktNo, "15");
  addWire(c, ktNo, "18", kmStarNc, "21");
  addWire(c, kmStarNc, "22", kmDelta.symbol, "A1");
  addWire(c, kmDelta.symbol, "A2", tc.symbol, "X2");

  // Indicators
  addWire(c, kmMain.symbol, "A1", hlRun.symbol, "1");
  addWire(c, hlRun.symbol, "2", tc.symbol, "X2");
  addWire(c, kmStar.symbol, "A1", hlStar.symbol, "1");
  addWire(c, hlStar.symbol, "2", tc.symbol, "X2");
  addWire(c, kmDelta.symbol, "A1", hlDelta.symbol, "1");
  addWire(c, hlDelta.symbol, "2", tc.symbol, "X2");
  return c;
}

/**
 * 16# Tank Liquid Level Automatic Pump & High-Alarm
 */
export function ex16TankLevelPump(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "dc-supply", "G1", "body", 4, 4);
  const slLow = addDevice(c, "float", "SL_LOW", "body", 14, 4);
  const slHigh = addDevice(c, "float", "SL_HIGH", "body", 20, 4);
  const slOver = addDevice(c, "float", "SL_OVER", "body", 20, 20);

  const kaPump = addDevice(c, "relay", "KA_PUMP", "coil", 30, 3.5);
  const kaHold = addSymbol(c, kaPump.device.id, "aux-no", 20, 8);
  const kaPower = addSymbol(c, kaPump.device.id, "aux-no", 20, 12);

  const m = addDevice(c, "motor-dc", "M_PUMP", "body", 30, 11.5);
  const yv = addDevice(c, "solenoid", "YV_VALVE", "body", 38, 11.5);

  const horn = addDevice(c, "horn", "HA_OVERFLOW", "body", 30, 19.5);
  const al = addDevice(c, "alarm", "AL_OVERFLOW", "body", 38, 19.5);
  const hlPump = addDevice(c, "lamp", "HL_PUMPING", "body", 38, 3.5, { color: "blue" });

  // Low float and High float start & self hold (Y=5 straight line)
  addWire(c, g.symbol, "+", slLow.symbol, "1");
  addWire(c, slLow.symbol, "2", slHigh.symbol, "1");
  addWire(c, slLow.symbol, "2", kaHold, "1");
  addWire(c, slHigh.symbol, "2", kaPump.symbol, "A1");
  addWire(c, kaHold, "2", kaPump.symbol, "A1");
  addWire(c, kaPump.symbol, "A2", g.symbol, "-");

  // Indicator
  addWire(c, kaPump.symbol, "A1", hlPump.symbol, "1");
  addWire(c, hlPump.symbol, "2", g.symbol, "-");

  // Output Pump & Valve (Y=13 straight line)
  addWire(c, g.symbol, "+", kaPower, "1");
  addWire(c, kaPower, "2", m.symbol, "A1");
  addWire(c, kaPower, "2", yv.symbol, "A1");
  addWire(c, m.symbol, "A2", g.symbol, "-");
  addWire(c, yv.symbol, "A2", g.symbol, "-");

  // Overflow Alarm (Y=21 straight line)
  addWire(c, g.symbol, "+", slOver.symbol, "1");
  addWire(c, slOver.symbol, "2", horn.symbol, "1");
  addWire(c, slOver.symbol, "2", al.symbol, "1");
  addWire(c, horn.symbol, "2", g.symbol, "-");
  addWire(c, al.symbol, "2", g.symbol, "-");
  return c;
}

/**
 * 17# Temp & Pressure Interlock Chamber
 */
export function ex17TempPressureHeater(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "mains-3ph", "G1", "delta", 4, 4, { supplyType: "delta", voltage: 480 });
  const qf = addDevice(c, "breaker-3p", "QF1", "body", 14, 4);

  const kmHeat = addDevice(c, "contactor", "KM1", "coil", 50, 13.5);
  const kmHeatMain = addSymbol(c, kmHeat.device.id, "main", 22, 4);
  const kmHeatNo = addSymbol(c, kmHeat.device.id, "aux-no", 40, 18);
  const heater = addDevice(c, "heater", "EH1", "body", 32, 3.5);
  const fan = addDevice(c, "fan", "FAN1", "body", 40, 3.5);

  const tc = addDevice(c, "transformer", "TC1", "body", 8, 14, { ratio: "480/120" });
  const flow = addDevice(c, "flow-no", "SQ_FLOW", "body", 16, 14);
  const temp = addDevice(c, "temp-nc", "ST_TEMP", "body", 22, 14);
  const press = addDevice(c, "pressure-nc", "SP_PRESS", "body", 28, 14);

  const stop = addDevice(c, "pb-nc", "SB_STOP", "body", 34, 14);
  const start = addDevice(c, "pb-no", "SB_START", "body", 40, 14);

  const hlHeat = addDevice(c, "lamp", "HL_HEAT", "body", 58, 13.5, { color: "red" });
  const pe = addDevice(c, "ground", "PE1", "body", 4, 14);

  // Power (Y=5, 7 straight lines)
  addWire(c, g.symbol, "L1", qf.symbol, "L1");
  addWire(c, g.symbol, "L2", qf.symbol, "L2");
  addWire(c, g.symbol, "L3", qf.symbol, "L3");

  addWire(c, qf.symbol, "T1", kmHeatMain, "L1");
  addWire(c, qf.symbol, "T2", kmHeatMain, "L2");
  addWire(c, kmHeatMain, "T1", heater.symbol, "1");
  addWire(c, kmHeatMain, "T2", heater.symbol, "2");

  addWire(c, qf.symbol, "T1", fan.symbol, "U1");
  addWire(c, qf.symbol, "T2", fan.symbol, "U2");

  // Control
  addWire(c, qf.symbol, "T1", tc.symbol, "H1");
  addWire(c, qf.symbol, "T2", tc.symbol, "H2");
  addWire(c, tc.symbol, "X2", pe.symbol, "1");

  // Multi-sensor Safety Interlock String (100% Straight line at Y=15!)
  addWire(c, tc.symbol, "X1", flow.symbol, "1");
  addWire(c, flow.symbol, "2", temp.symbol, "1");
  addWire(c, temp.symbol, "2", press.symbol, "1");
  addWire(c, press.symbol, "2", stop.symbol, "1");

  addWire(c, stop.symbol, "2", start.symbol, "1");
  addWire(c, stop.symbol, "2", kmHeatNo, "13");
  addWire(c, start.symbol, "2", kmHeat.symbol, "A1");
  addWire(c, kmHeatNo, "14", kmHeat.symbol, "A1");
  addWire(c, kmHeat.symbol, "A2", tc.symbol, "X2");

  // Indicators & Fault
  addWire(c, kmHeat.symbol, "A1", hlHeat.symbol, "1");
  addWire(c, hlHeat.symbol, "2", tc.symbol, "X2");
  return c;
}

/**
 * 18# Conveyor Counter & Sorting Solenoid
 */
export function ex18ConveyorCounterSorter(): Circuit {
  const c = emptyCircuit();
  const g = addDevice(c, "dc-supply", "G1", "body", 4, 4);
  const photo = addDevice(c, "photo", "SQ_PHOTO", "body", 14, 4);
  const ct = addDevice(c, "counter", "CT1", "body", 22, 4, { preset: 5 });
  const hlCount = addDevice(c, "lamp", "HL_COUNT", "body", 30, 3.5, { color: "yellow" });

  const sbReset = addDevice(c, "pb-no", "SB_RST", "body", 14, 7.5);

  const prox = addDevice(c, "prox", "SQ_PROX", "body", 14, 13);
  const mConv = addDevice(c, "motor-dc", "M_CONV", "body", 22, 12.5);

  const yvPush = addDevice(c, "solenoid", "YV_PUSH", "body", 30, 20.5);
  const hlDone = addDevice(c, "lamp", "HL_DONE", "body", 38, 20.5, { color: "green" });

  // Photo Sensor counting pulse & count indicator (Y=5 straight line)
  addWire(c, g.symbol, "+", photo.symbol, "1");
  addWire(c, photo.symbol, "2", ct.symbol, "A1");
  addWire(c, ct.symbol, "A2", g.symbol, "-");
  addWire(c, photo.symbol, "2", hlCount.symbol, "1");
  addWire(c, hlCount.symbol, "2", g.symbol, "-");

  // Counter Reset Pushbutton (Y=8 straight line into R1-R2)
  addWire(c, g.symbol, "+", sbReset.symbol, "1");
  addWire(c, sbReset.symbol, "2", ct.symbol, "R1");
  addWire(c, ct.symbol, "R2", g.symbol, "-");

  // Conveyor motor runs when proximity sensor detects presence (Y=14 straight line)
  addWire(c, g.symbol, "+", prox.symbol, "1");
  addWire(c, prox.symbol, "2", mConv.symbol, "A1");
  addWire(c, mConv.symbol, "A2", g.symbol, "-");

  // Counter Output (1-2) triggers Pusher Solenoid YV1 and Done Lamp (Y=22 straight line)
  addWire(c, g.symbol, "+", ct.symbol, "1");
  addWire(c, ct.symbol, "2", yvPush.symbol, "A1");
  addWire(c, ct.symbol, "2", hlDone.symbol, "1");
  addWire(c, yvPush.symbol, "A2", g.symbol, "-");
  addWire(c, hlDone.symbol, "2", g.symbol, "-");
  return c;
}

/**
 * 19# Automatic Transfer Switch (ATS) Dual Power System
 */
export function ex19AtsDualPower(): Circuit {
  const c = emptyCircuit();
  const g1 = addDevice(c, "mains-3ph", "Utility Grid", "delta", 4, 4, { supplyType: "delta", voltage: 480 });
  const g2 = addDevice(c, "gen-ac", "Diesel Gen", "body", 4, 14);

  const qf1 = addDevice(c, "breaker-3p", "QF_GRID", "body", 14, 4);
  const qf2 = addDevice(c, "breaker-3p", "QF_GEN", "body", 14, 14);

  const kmGrid = addDevice(c, "contactor", "KM_GRID", "coil", 32, 23.5);
  const kmGridMain = addSymbol(c, kmGrid.device.id, "main", 22, 4);
  const kmGridLock = addSymbol(c, kmGrid.device.id, "aux-nc", 22, 32);

  const kmGen = addDevice(c, "contactor", "KM_GEN", "coil", 32, 31.5);
  const kmGenMain = addSymbol(c, kmGen.device.id, "main", 22, 14);
  const kmGenLock = addSymbol(c, kmGen.device.id, "aux-nc", 22, 24);

  const m = addDevice(c, "motor-3ph", "Critical Load M1", "body", 42, 4, { power: 15 });
  const vm1 = addDevice(c, "voltmeter", "VM_GRID", "body", 14, 9.5);
  const vm2 = addDevice(c, "voltmeter", "VM_GEN", "body", 14, 19.5);
  const am = addDevice(c, "ammeter", "AM_LOAD", "body", 34, 3.5);

  const hlGrid = addDevice(c, "lamp", "HL_GRID", "body", 40, 23.5, { color: "green" });
  const hlGen = addDevice(c, "lamp", "HL_GEN", "body", 40, 31.5, { color: "yellow" });
  const pe = addDevice(c, "ground", "PE1", "body", 4, 24);

  // Grid Power Path (Y=5, 7, 9 straight line)
  addWire(c, g1.symbol, "L1", qf1.symbol, "L1");
  addWire(c, g1.symbol, "L2", qf1.symbol, "L2");
  addWire(c, g1.symbol, "L3", qf1.symbol, "L3");
  addWire(c, qf1.symbol, "T1", kmGridMain, "L1");
  addWire(c, qf1.symbol, "T2", kmGridMain, "L2");
  addWire(c, qf1.symbol, "T3", kmGridMain, "L3");

  // Gen Power Path (Y=15, 17, 19 straight line)
  addWire(c, g2.symbol, "U", qf2.symbol, "L1");
  addWire(c, g2.symbol, "V", qf2.symbol, "L2");
  addWire(c, g2.symbol, "W", qf2.symbol, "L3");
  addWire(c, qf2.symbol, "T1", kmGenMain, "L1");
  addWire(c, qf2.symbol, "T2", kmGenMain, "L2");
  addWire(c, qf2.symbol, "T3", kmGenMain, "L3");

  // Common Load Bus
  addWire(c, kmGridMain, "T1", am.symbol, "1");
  addWire(c, am.symbol, "2", m.symbol, "U");
  addWire(c, kmGridMain, "T2", m.symbol, "V");
  addWire(c, kmGridMain, "T3", m.symbol, "W");

  addWire(c, kmGenMain, "T1", kmGridMain, "T1");
  addWire(c, kmGenMain, "T2", kmGridMain, "T2");
  addWire(c, kmGenMain, "T3", kmGridMain, "T3");

  addWire(c, g1.symbol, "PE", pe.symbol, "1");
  addWire(c, g2.symbol, "N", pe.symbol, "1");

  // Voltmeters
  addWire(c, qf1.symbol, "T1", vm1.symbol, "1");
  addWire(c, qf1.symbol, "T2", vm1.symbol, "2");
  addWire(c, qf2.symbol, "T1", vm2.symbol, "1");
  addWire(c, qf2.symbol, "T2", vm2.symbol, "2");

  // Grid Auto Switch Rung (Y=25 straight line)
  addWire(c, qf1.symbol, "T1", kmGenLock, "21");
  addWire(c, kmGenLock, "22", kmGrid.symbol, "A1");
  addWire(c, kmGrid.symbol, "A2", qf1.symbol, "T2");

  // Gen Auto Switch Rung (Y=33 straight line)
  addWire(c, qf2.symbol, "T1", kmGridLock, "21");
  addWire(c, kmGridLock, "22", kmGen.symbol, "A1");
  addWire(c, kmGen.symbol, "A2", qf2.symbol, "T2");

  // Indicators
  addWire(c, kmGrid.symbol, "A1", hlGrid.symbol, "1");
  addWire(c, hlGrid.symbol, "2", qf1.symbol, "T2");
  addWire(c, kmGen.symbol, "A1", hlGrid.symbol, "1");
  addWire(c, hlGen.symbol, "2", qf2.symbol, "T2");
  return c;
}

/**
 * 20# Automated Manufacturing Machine Cell
 */
export function ex20AutomatedCell(): Circuit {
  const c = emptyCircuit();

  // 1. Engineering Title Block
  addDevice(c, "title-block", "TB1", "body", 2, 2, {
    projectName: "AUTOMATED MANUFACTURING CELL",
    projectNo: "ELAB-2026-020",
    rev: "1.0",
    sheetNum: "1",
    sheetTotal: "1",
    description: "MULTI-STATION MACHINING & CLAMPING CELL",
    designedBy: "DW",
    date: "08/29/2026",
    scale: 0.9,
  });

  // 2. Main Power Distribution (480V 3Φ, Y=14)
  const g = addDevice(c, "mains-3ph", "G1", "delta", 4, 14, { supplyType: "delta", voltage: 480, maxCurrent: 400 });
  const qs = addDevice(c, "isolator", "Main Disconnect", "body", 14, 14);
  const qfMain = addDevice(c, "breaker-3p", "Main Breaker", "body", 22, 14);

  // 3. Spindle Motor Branch (15kW, Y=14)
  const kmSpindle = addDevice(c, "contactor", "KM_SPINDLE", "coil", 48, 29.5);
  const kmSpindleMain = addSymbol(c, kmSpindle.device.id, "main", 30, 14);
  const kmSpindleNo = addSymbol(c, kmSpindle.device.id, "aux-no", 38, 34);
  const frSpindle = addDevice(c, "overload", "Spindle OL", "body", 38, 14);
  const frSpindleNc = addSymbol(c, frSpindle.device.id, "aux-nc", 28, 30);
  const frSpindleNo = addSymbol(c, frSpindle.device.id, "aux-no", 38, 48);
  const mSpindle = addDevice(c, "motor-3ph", "Main Spindle 15kW", "body", 46, 14, { power: 15 });

  // 4. Feed Axis Motor Branch (3.7kW, Y=22)
  const kmFeed = addDevice(c, "contactor", "KM_FEED", "coil", 48, 37.5);
  const kmFeedMain = addSymbol(c, kmFeed.device.id, "main", 30, 22);
  const amFeed = addDevice(c, "ammeter", "AM1", "body", 38, 21.5);
  const mFeed = addDevice(c, "motor-3ph", "Feed Axis 3.7kW", "body", 46, 21.5, { power: 3.7 });

  // 5. Control Transformer 480/120V & DC 24V Power Supply
  const tc = addDevice(c, "transformer", "TC1", "body", 12, 30, { ratio: "480/120", primaryVoltage: 480, secondaryVoltage: 120 });
  const dcSupply = addDevice(c, "dc-supply", "24VDC Supply", "body", 12, 40);

  // 6. Safety & Sensors String (Y=31)
  const estop = addDevice(c, "estop-nc", "SB_ESTOP", "body", 20, 30);
  const temp = addDevice(c, "temp-nc", "Spindle Temp Cutoff", "body", 26, 30);
  const stop = addDevice(c, "pb-nc", "SB_STOP", "body", 32, 30);
  const start = addDevice(c, "pb-no", "SB_START", "body", 38, 30);

  // 7. Workholding & Optical Curtain (Y=41)
  const photo = addDevice(c, "photo", "Safety Light Curtain", "body", 20, 40);
  const foot = addDevice(c, "foot-no", "Foot Clamp Switch", "body", 26, 40);
  const yvClamp = addDevice(c, "solenoid", "Hydraulic Clamp", "body", 38, 39.5);
  const hlClamp = addDevice(c, "lamp", "HL_CLAMP", "body", 46, 39.5, { color: "blue" });

  // 8. Cabinet Cooling & Clamping (Y=49)
  const stCabinet = addDevice(c, "temp-no", "Cabinet Thermostat", "body", 26, 48);
  const fan = addDevice(c, "fan", "Cabinet Cooler", "body", 38, 47.5);
  const horn = addDevice(c, "horn", "HA_FAULT", "body", 46, 47.5);
  const al = addDevice(c, "alarm", "AL_FAULT", "body", 54, 47.5);

  // 9. Indicators & Metering
  const vm = addDevice(c, "voltmeter", "VM1", "body", 22, 23.5);
  const hlRun = addDevice(c, "lamp", "HL_RUN", "body", 56, 29.5, { color: "green" });
  const pe = addDevice(c, "ground", "PE1", "body", 4, 30);

  // Power Connections (Y=15, 17, 19 straight line)
  addWire(c, g.symbol, "L1", qs.symbol, "L1");
  addWire(c, g.symbol, "L2", qs.symbol, "L2");
  addWire(c, g.symbol, "L3", qs.symbol, "L3");

  addWire(c, qs.symbol, "T1", qfMain.symbol, "L1");
  addWire(c, qs.symbol, "T2", qfMain.symbol, "L2");
  addWire(c, qs.symbol, "T3", qfMain.symbol, "L3");

  // Spindle path (Y=15, 17, 19 straight line)
  addWire(c, qfMain.symbol, "T1", kmSpindleMain, "L1");
  addWire(c, qfMain.symbol, "T2", kmSpindleMain, "L2");
  addWire(c, qfMain.symbol, "T3", kmSpindleMain, "L3");
  addWire(c, kmSpindleMain, "T1", frSpindle.symbol, "L1");
  addWire(c, kmSpindleMain, "T2", frSpindle.symbol, "L2");
  addWire(c, kmSpindleMain, "T3", frSpindle.symbol, "L3");
  addWire(c, frSpindle.symbol, "T1", mSpindle.symbol, "U");
  addWire(c, frSpindle.symbol, "T2", mSpindle.symbol, "V");
  addWire(c, frSpindle.symbol, "T3", mSpindle.symbol, "W");

  // Feed Axis path (Y=23, 25, 27 straight line)
  addWire(c, qfMain.symbol, "T1", kmFeedMain, "L1");
  addWire(c, qfMain.symbol, "T2", kmFeedMain, "L2");
  addWire(c, qfMain.symbol, "T3", kmFeedMain, "L3");
  addWire(c, kmFeedMain, "T1", amFeed.symbol, "1");
  addWire(c, amFeed.symbol, "2", mFeed.symbol, "U");
  addWire(c, kmFeedMain, "T2", mFeed.symbol, "V");
  addWire(c, kmFeedMain, "T3", mFeed.symbol, "W");

  addWire(c, g.symbol, "PE", pe.symbol, "1");

  // Transformer & DC Supply
  addWire(c, qs.symbol, "T1", tc.symbol, "H1");
  addWire(c, qs.symbol, "T2", tc.symbol, "H2");
  addWire(c, tc.symbol, "X2", pe.symbol, "1");

  addWire(c, tc.symbol, "X1", vm.symbol, "1");
  addWire(c, tc.symbol, "X2", vm.symbol, "2");

  // DC Power loop for Sensors & Hydraulic Clamping (Y=41 straight line)
  addWire(c, dcSupply.symbol, "+", photo.symbol, "1");
  addWire(c, photo.symbol, "2", dcSupply.symbol, "-");

  addWire(c, dcSupply.symbol, "+", foot.symbol, "1");
  addWire(c, foot.symbol, "2", yvClamp.symbol, "A1");
  addWire(c, foot.symbol, "2", hlClamp.symbol, "1");
  addWire(c, yvClamp.symbol, "A2", dcSupply.symbol, "-");
  addWire(c, hlClamp.symbol, "2", dcSupply.symbol, "-");

  // 120V Control Loop (Y=31 straight line across all switches)
  addWire(c, tc.symbol, "X1", estop.symbol, "11");
  addWire(c, estop.symbol, "12", temp.symbol, "1");
  addWire(c, temp.symbol, "2", frSpindleNc, "95");
  addWire(c, frSpindleNc, "96", stop.symbol, "1");

  addWire(c, stop.symbol, "2", start.symbol, "1");
  addWire(c, stop.symbol, "2", kmSpindleNo, "13");
  addWire(c, start.symbol, "2", kmSpindle.symbol, "A1");
  addWire(c, kmSpindleNo, "14", kmSpindle.symbol, "A1");
  addWire(c, kmSpindle.symbol, "A2", tc.symbol, "X2");

  // Feed motor runs along with Spindle
  addWire(c, kmSpindle.symbol, "A1", kmFeed.symbol, "A1");
  addWire(c, kmFeed.symbol, "A2", tc.symbol, "X2");

  // Cabinet Cooler Fan (Y=49)
  addWire(c, tc.symbol, "X1", stCabinet.symbol, "1");
  addWire(c, stCabinet.symbol, "2", fan.symbol, "U1");
  addWire(c, fan.symbol, "U2", tc.symbol, "X2");

  // Spindle Run Lamp
  addWire(c, kmSpindle.symbol, "A1", hlRun.symbol, "1");
  addWire(c, hlRun.symbol, "2", tc.symbol, "X2");

  // Overload trip alarm (Y=49)
  addWire(c, tc.symbol, "X1", frSpindleNo, "97");
  addWire(c, frSpindleNo, "98", horn.symbol, "1");
  addWire(c, frSpindleNo, "98", al.symbol, "1");
  addWire(c, horn.symbol, "2", tc.symbol, "X2");
  addWire(c, al.symbol, "2", tc.symbol, "X2");
  return c;
}

export const ALL_20_EXAMPLES = [
  { id: "01-basic-lamp", title: "01# Basic Lamp Circuit", blurb: "直流電源驅動常開按鈕與綠色指示燈基礎電路。", build: ex01BasicLamp },
  { id: "02-start-stop-lamp", title: "02# Start-Stop Dual Indicators", blurb: "啟動/停止雙按鈕與紅綠雙色狀態指示電路。", build: ex02StartStopLamp },
  { id: "03-transformer-fuse", title: "03# Control Transformer & Fuses", blurb: "控制變壓器降壓 480V/120V、一次側二次側熔斷保護與電壓表監測。", build: ex03TransformerFuse },
  { id: "04-relay-self-holding", title: "04# Relay Self-Holding Circuit", blurb: "中間繼電器經典啟停自鎖自保電路與運行/停止雙燈指示。", build: ex04RelaySelfHolding },
  { id: "05-motor-1ph-manual", title: "05# Single-Phase Motor Manual Control", blurb: "單相交流馬達單極斷路器、開關控制、電壓表與鉗形電流表監測。", build: ex05Motor1phManual },
  { id: "06-motor-3ph-dol", title: "06# 3-Phase Motor DOL Starter", blurb: "三相馬達直接起動 (DOL) 隔離刀閘、三極斷路器、接觸器自鎖控制迴路。", build: ex06Motor3phDol },
  { id: "07-overload-alarm", title: "07# Motor Overload Protection & Alarm", blurb: "三相馬達熱過載繼電器脫扣保護與 97-98 故障聲光警報迴路。", build: ex07OverloadAlarm },
  { id: "08-estop-safety", title: "08# Emergency Stop Safety Interlock", blurb: "急停安全主繼電器迴路，拍下急停即時切斷全系統並觸發紅燈警報。", build: ex08EstopSafety },
  { id: "09-hoa-selector", title: "09# Hand-Off-Auto Selector & Pump", blurb: "三檔選擇開關 (HOA) 手動點動/自動浮球控制抽水泵與排污電磁閥。", build: ex09HoaSelector },
  { id: "10-dual-station", title: "10# Dual-Station Remote Motor Control", blurb: "兩地異地控制電路：雙按鈕串聯停止與並聯啟動三相馬達。", build: ex10DualStation },
  { id: "11-fwd-rev-interlock", title: "11# Forward / Reverse Interlock Starter", blurb: "三相馬達正反轉雙接觸器電氣互鎖與相序切換控制迴路。", build: ex11FwdRevInterlock },
  { id: "12-limit-reciprocating", title: "12# Limit Switch Auto-Cycle Travel", blurb: "雙行程開關端點碰撞自動反轉往返工作台運動控制系統。", build: ex12LimitReciprocating },
  { id: "13-timer-on-sequence", title: "13# On-Delay Timer Sequential Start", blurb: "通電延時繼電器 (TON) 主輸送帶與進料馬達延時順序起動控制。", build: ex13TimerOnSequence },
  { id: "14-timer-off-cooling", title: "14# Off-Delay Timer Fan Cooling Cycle", blurb: "斷電延時繼電器 (TOF) 電熱爐停機後冷卻風扇延時自動散熱排風。", build: ex14TimerOffCooling },
  { id: "15-star-delta-starter", title: "15# Star-Delta (Y-Δ) Reduced Starter", blurb: "三相馬達星三角降壓起動：星形起動延時自動切換角形全壓運轉。", build: ex15StarDeltaStarter },
  { id: "16-tank-level-pump", title: "16# Water Tank Automatic Pump & Horn", blurb: "水箱高低雙浮球自動抽水泵自鎖排水與極限溢流電笛警報系統。", build: ex16TankLevelPump },
  { id: "17-temp-pressure-heater", title: "17# Temp & Pressure Interlock Chamber", blurb: "冷卻水流量、溫度與壓力三重安全閉環聯鎖工業加熱爐控制系統。", build: ex17TempPressureHeater },
  { id: "18-conveyor-counter-sorter", title: "18# Conveyor Counter & Sorting Solenoid", blurb: "接近與光電感測器輸送帶自動計數、批量完成氣動分揀推料。", build: ex18ConveyorCounterSorter },
  { id: "19-ats-dual-power", title: "19# Automatic Transfer Switch (ATS)", blurb: "市電與柴油發電機雙電源自動切換 ATS 系統，即時電壓與負載監測。", build: ex19AtsDualPower },
  { id: "20-automated-cell", title: "20# Automated Manufacturing Machine Cell", blurb: "全功能工業自動化多工位加工單元：工程圖框、雙電壓、安全光柵、雙馬達與液壓夾緊。", build: ex20AutomatedCell },
];
