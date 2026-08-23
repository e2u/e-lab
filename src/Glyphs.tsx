import {createContext, useContext, type SVGProps} from "react";
import {CONTACT_LEAD} from "./catalog";
import type {Device, DeviceRuntime} from "./types";
import {GRID} from "./types";

const ink = "#1b1a16";

const FlipCtx = createContext({fx: 1, fy: 1});

function Txt({x = 0, y = 0, transform, ...rest}: SVGProps<SVGTextElement>) {
    const {fx, fy} = useContext(FlipCtx);
    const nx = Number(x);
    const ny = Number(y);
    const unflip =
        fx === 1 && fy === 1
            ? undefined
            : `translate(${nx} ${ny}) scale(${fx} ${fy}) translate(${-nx} ${-ny})`;
    const t = [unflip, transform].filter(Boolean).join(" ") || undefined;
    return <text x={x} y={y} transform={t} {...rest} />;
}

function S(props: SVGProps<SVGSVGElement> & { w: number; h: number }) {
    const {w, h, children, ...rest} = props;
    return (
        <svg
            width={w * GRID}
            height={h * GRID}
            viewBox={`0 0 ${w * GRID} ${h * GRID}`}
            overflow="visible"
            {...rest}
        >
            {children}
        </svg>
    );
}

function Tag({x, y, text, light = false}: { x: number; y: number; text: string; light?: boolean }) {
    return (
        <Txt x={x} y={y} className="sym-tag" fill={light ? "#e0e0e0" : ink}>
            {text}
        </Txt>
    );
}

type ContactExtra = "pb" | "limit" | "temp" | "press" | "float" | "prox" | "photo" | "foot" | "estop";

function contactOperator(
    cx: number,
    mid: number,
    extra?: ContactExtra,
) {
    if (extra === "pb") {
        return <circle cx={cx} cy={mid - 16} r="7" fill="none" stroke={ink} strokeWidth="2"/>;
    }
    if (extra === "limit") {
        return (
            <polyline
                points={`${cx + 10},${mid - 18} ${cx + 16},${mid - 4} ${cx + 10},${mid + 10}`}
                fill="none"
                stroke={ink}
                strokeWidth="2"
            />
        );
    }
    if (extra === "temp") {
        return (
            <Txt x={cx + 12} y={mid} fontSize="11" fill={ink}>
                θ
            </Txt>
        );
    }
    if (extra === "press") {
        return (
            <Txt x={cx + 12} y={mid} fontSize="10" fill={ink}>
                P
            </Txt>
        );
    }
    if (extra === "float") {
        return (
            <Txt x={cx + 12} y={mid} fontSize="10" fill={ink}>
                ∇
            </Txt>
        );
    }
    if (extra === "prox") {
        return (
            <Txt x={cx + 12} y={mid} fontSize="10" fill={ink}>
                PR
            </Txt>
        );
    }
    if (extra === "photo") {
        return (
            <Txt x={cx + 12} y={mid} fontSize="10" fill={ink}>
                PE
            </Txt>
        );
    }
    if (extra === "foot") {
        return (
            <Txt x={cx + 10} y={mid - 14} fontSize="9" fill={ink}>
                FS
            </Txt>
        );
    }
    return null;
}

/** Closed-contact slash that overshoots both vertical bars. */
function closedSlash(xL: number, xR: number, cy: number, barH: number) {
    const pad = 5;
    return (
        <line
            x1={xL - pad}
            y1={cy + barH + pad * 0.4}
            x2={xR + pad}
            y2={cy - barH - pad * 0.4}
            stroke={ink}
            strokeWidth="2"
        />
    );
}

/** Open-lever slope shared with TON NO: drop OPEN_DROP over a run that stops OPEN_GAP before the right dot. */
const OPEN_DROP = 16;
const OPEN_GAP = 3;

/** NEMA timed contact: N.O.T.C (open lever) / N.C.T.O (closed bar), optional Y delay mark. */
function timedContact(w: number, closed: boolean, timed: boolean, offDelay = false) {
    const xL = 0;
    const xR = w * GRID;
    const y = 1 * GRID;
    const r = 4.4;
    const cx = (xL + xR) / 2;
    const xArm = closed ? xR : xR - OPEN_GAP;
    const yArm = closed ? y : y + OPEN_DROP;
    const t = (cx - xL) / Math.max(1, xArm - xL);
    const yJoin = y + (yArm - y) * Math.min(1, t);
    const yFork = yJoin + 15;
    return (
        <>
            <line
                x1={xL}
                y1={y}
                x2={xArm}
                y2={yArm}
                stroke={ink}
                strokeWidth="2.6"
                strokeLinecap="round"
            />
            {timed && (
                offDelay ? (
                    <>
                        <line x1={cx} y1={yJoin} x2={cx} y2={yJoin + 36} stroke={ink} strokeWidth="2"/>
                        <line
                            x1={cx}
                            y1={yJoin + 36}
                            x2={cx - 8}
                            y2={yJoin + 26}
                            stroke={ink}
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                        <line
                            x1={cx}
                            y1={yJoin + 36}
                            x2={cx + 8}
                            y2={yJoin + 26}
                            stroke={ink}
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                    </>
                ) : (
                    <>
                        <line x1={cx} y1={yJoin} x2={cx} y2={yFork} stroke={ink} strokeWidth="2"/>
                        <line
                            x1={cx}
                            y1={yFork}
                            x2={cx - 8}
                            y2={yFork + 10}
                            stroke={ink}
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                        <line
                            x1={cx}
                            y1={yFork}
                            x2={cx + 8}
                            y2={yFork + 10}
                            stroke={ink}
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                    </>
                )
            )}
            <circle cx={xL} cy={y} r={r} fill={ink}/>
            <circle cx={xR} cy={y} r={r} fill={ink}/>
        </>
    );
}

function barContact(
    w: number,
    y: number,
    conducting: boolean,
    labL?: string,
    labR?: string,
) {
    const gap = 0.4 * GRID;
    const xMid = (w * GRID) / 2;
    const xBarL = xMid - gap / 2;
    const xBarR = xMid + gap / 2;
    const barH = 0.55 * GRID;
    return (
        <g>
            <line x1={0} y1={y} x2={xBarL} y2={y} stroke={ink} strokeWidth="2"/>
            <line x1={xBarR} y1={y} x2={w * GRID} y2={y} stroke={ink} strokeWidth="2"/>
            <line x1={xBarL} y1={y - barH} x2={xBarL} y2={y + barH} stroke={ink} strokeWidth="2.4"/>
            <line x1={xBarR} y1={y - barH} x2={xBarR} y2={y + barH} stroke={ink} strokeWidth="2.4"/>
            {conducting && closedSlash(xBarL, xBarR, y, barH)}
            {labL && (
                <Txt x={10} y={y - 6} className="term-lab">
                    {labL}
                </Txt>
            )}
            {labR && (
                <Txt x={w * GRID - 10} y={y - 6} textAnchor="end" className="term-lab">
                    {labR}
                </Txt>
            )}
        </g>
    );
}

function contactLines(
    w: number,
    h: number,
    nc: boolean,
    extra: ContactExtra | undefined,
    pressed = false,
    conducting?: boolean,
) {
    const cx = (w * GRID) / 2;
    const cy = (h * GRID) / 2;
    const xBarL = CONTACT_LEAD * GRID;
    const xBarR = (w - CONTACT_LEAD) * GRID;
    const barH = 0.55 * GRID;
    if (extra === "pb" || extra === "estop") {
        const r = 5.5;
        const xL = 0.85 * GRID;
        const xR = 2.15 * GRID;
        const yC = 1.65 * GRID;
        const barW = 18;
        const stemArc = (yTop: number) => {
            if (extra !== "estop") return null;
            const ar = 9;
            return (
                <path
                    d={`M ${cx - ar} ${yTop +4} A ${ar} ${ar} 0 0 1 ${cx + ar} ${yTop+4}`}
                    fill="none"
                    stroke={ink}
                    strokeWidth="2"
                />
            );
        };
        if (nc) {
            const barY = yC + r + 1;
            const stemTop = yC - r - 12;
            const travel = pressed ? 9 : 0;
            return (
                <>
                    <circle cx={xL} cy={yC} r={r} fill="#efe6d0" stroke={ink} strokeWidth="2"/>
                    <circle cx={xR} cy={yC} r={r} fill="#efe6d0" stroke={ink} strokeWidth="2"/>
                    <g className="pb-plunger" style={{transform: `translateY(${travel}px)`}}>
                        <line x1={cx - barW} y1={barY} x2={cx + barW} y2={barY} stroke={ink} strokeWidth="2.6"/>
                        <line x1={cx} y1={barY} x2={cx} y2={stemTop} stroke={ink} strokeWidth="2"/>
                        {stemArc(stemTop)}
                    </g>
                </>
            );
        }
        const barY = yC - r - 12;
        const stemTop = barY - 14;
        const travel = pressed ? 10 : 0;
        return (
            <>
                <g className="pb-plunger" style={{transform: `translateY(${travel}px)`}}>
                    <line x1={cx} y1={stemTop} x2={cx} y2={barY} stroke={ink} strokeWidth="2"/>
                    <line x1={cx - barW} y1={barY} x2={cx + barW} y2={barY} stroke={ink} strokeWidth="2.6"/>
                    {stemArc(stemTop)}
                </g>
                <circle cx={xL} cy={yC} r={r} fill={pressed ? "#f0d27a" : "#efe6d0"} stroke={ink} strokeWidth="2"/>
                <circle cx={xR} cy={yC} r={r} fill={pressed ? "#f0d27a" : "#efe6d0"} stroke={ink} strokeWidth="2"/>
            </>
        );
    }
    return (
        <>
            <line x1={0} y1={cy} x2={xBarL} y2={cy} stroke={ink} strokeWidth="2"/>
            <line x1={xBarR} y1={cy} x2={w * GRID} y2={cy} stroke={ink} strokeWidth="2"/>
            <line x1={xBarL} y1={cy - barH} x2={xBarL} y2={cy + barH} stroke={ink} strokeWidth="2.4"/>
            <line x1={xBarR} y1={cy - barH} x2={xBarR} y2={cy + barH} stroke={ink} strokeWidth="2.4"/>
            {(conducting ?? nc) && closedSlash(xBarL, xBarR, cy, barH)}
            {contactOperator(cx, cy - barH, extra)}
        </>
    );
}

function coilBox(w: number, h: number, label: string, hot: boolean) {
    const cx = (w * GRID) / 2;
    const cy = (h * GRID) / 2;
    return (
        <>
            <line x1={2} y1={cy} x2={cx - 17} y2={cy} stroke={ink} strokeWidth="2"/>
            <line x1={cx + 17} y1={cy} x2={w * GRID - 2} y2={cy} stroke={ink} strokeWidth="2"/>
            <circle
                cx={cx}
                cy={cy}
                r="16"
                fill={hot ? "#f0d27a" : "#efe6d0"}
                stroke={ink}
                strokeWidth="2"
            />
            <Txt x={cx} y={cy + 4} textAnchor="middle" className="sym-tag">
                {label}
            </Txt>
        </>
    );
}

function poles(
    w: number,
    h: number,
    n: number,
    closed: boolean,
    labels?: [string, string][],
    contact: "bar" | "arc" | "thermal" = "bar",
    gang = false,
) {
    const rows = n;
    const items = [];
    const xL = w * GRID * 0.38;
    const xR = w * GRID * 0.62;
    const xM = (xL + xR) / 2;
    const lift = closed ? 0 : 8;
    for (let i = 0; i < rows; i += 1) {
        const y = ((i + 0.5) * h * GRID) / rows;
        const rx = (xR - xL) / 2;
        const ry = rx * 0.85;
        const stroke = closed ? "#c45a12" : ink;
        const thR = 10;
        const thA = xM - 2 * thR;
        const thB = xM + 2 * thR;
        const leadL = contact === "thermal" ? thA : xL;
        const leadR = contact === "thermal" ? thB : xR;
        items.push(
            <g key={i}>
                <line x1={4} y1={y} x2={leadL} y2={y} stroke={ink} strokeWidth="2"/>
                <line
                    x1={leadR}
                    y1={y}
                    x2={w * GRID - 4}
                    y2={y}
                    stroke={ink}
                    strokeWidth="2"
                />
                {contact === "arc" ? (
                    <path
                        d={`M ${xL} ${y - lift} A ${rx} ${ry} 0 0 0 ${xR} ${y - lift}`}
                        fill="none"
                        stroke={stroke}
                        strokeWidth="2.2"
                    />
                ) : contact === "thermal" ? (
                    <path
                        d={`M ${thA} ${y} A ${thR} ${thR} 0 0 1 ${xM} ${y} A ${thR} ${thR} 0 0 0 ${thB} ${y}`}
                        fill="none"
                        stroke={stroke}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                    />
                ) : (
                    <line
                        x1={w * GRID * 0.34}
                        y1={y - (closed ? 0 : 7)}
                        x2={w * GRID * 0.66}
                        y2={y + (closed ? 0 : 7)}
                        stroke={stroke}
                        strokeWidth="2"
                    />
                )}
                {labels && (
                    <Txt x={6} y={y - 4} className="term-lab">
                        {labels[i]?.[0]}
                    </Txt>
                )}
            </g>,
        );
    }
    if (gang && rows >= 2) {
        const yAt = (i: number) => ((i + 0.5) * h * GRID) / rows - (contact === "arc" ? lift : 0);
        const y0 = yAt(0);
        const y1 = yAt(rows - 1);
        items.push(
            <g key="gang">
                <line
                    x1={xM}
                    y1={y0}
                    x2={xM}
                    y2={y1}
                    stroke={ink}
                    strokeWidth="1.5"
                    strokeDasharray="5 3"
                />
                {Array.from({length: rows}, (_, i) => (
                    <line
                        key={i}
                        x1={xM - 5}
                        y1={yAt(i)}
                        x2={xM + 5}
                        y2={yAt(i)}
                        stroke={ink}
                        strokeWidth="1.6"
                    />
                ))}
            </g>,
        );
    }
    return items;
}

/** Horizontal aux contact on a device body. `conducting` = electrically closed now. */
/** Schematic toggle: SPST (one throw) or SPDT (NC above, NO below). `thrown` = actuated. */
function togglePoles(w: number, h: number, n: number, doubleThrow: boolean, thrown: boolean) {
    const pitch = (h * GRID) / n;
    const xPivot = 1.15 * GRID;
    const xThrow = doubleThrow ? w * GRID - 1.2 * GRID : w * GRID - 0.55 * GRID;
    const dy = 0.42 * GRID;
    const jog = 8;
    const items = [];
    const pivots: number[] = [];
    for (let i = 0; i < n; i += 1) {
        const cy = (i + 0.5) * pitch;
        pivots.push(cy);
        items.push(
            <line key={`c${i}`} x1={0} y1={cy} x2={xPivot} y2={cy} stroke={ink} strokeWidth="2.2"/>,
            <circle key={`p${i}`} cx={xPivot} cy={cy} r={3.6} fill={ink}/>,
        );
        if (doubleThrow) {
            const yNc = cy - dy;
            const yNo = cy + dy;
            const yB = thrown ? yNo : yNc;
            items.push(
                <line key={`b${i}`} x1={xPivot} y1={cy} x2={xThrow} y2={yB} stroke={ink} strokeWidth="2.4"/>,
                <circle key={`nc${i}`} cx={xThrow} cy={yNc} r={3.6} fill={ink}/>,
                <circle key={`no${i}`} cx={xThrow} cy={yNo} r={3.6} fill={ink}/>,
                <polyline
                    key={`lnc${i}`}
                    points={`${xThrow},${yNc} ${xThrow},${yNc - jog} ${w * GRID},${yNc - jog}`}
                    fill="none"
                    stroke={ink}
                    strokeWidth="2.2"
                />,
                <polyline
                    key={`lno${i}`}
                    points={`${xThrow},${yNo} ${xThrow},${yNo + jog} ${w * GRID},${yNo + jog}`}
                    fill="none"
                    stroke={ink}
                    strokeWidth="2.2"
                />,
            );
        } else {
            const xB = thrown ? xThrow : xThrow - 8;
            const yB = thrown ? cy : cy - 11;
            items.push(
                <line key={`b${i}`} x1={xPivot} y1={cy} x2={xB} y2={yB} stroke={ink} strokeWidth="2.4"/>,
                <circle key={`t${i}`} cx={xThrow} cy={cy} r={3.6} fill={ink}/>,
                <line key={`r${i}`} x1={xThrow} y1={cy} x2={w * GRID} y2={cy} stroke={ink} strokeWidth="2.2"/>,
            );
        }
    }
    if (n > 1) {
        items.push(
            <line
                key="gang"
                x1={xPivot}
                y1={pivots[0]}
                x2={xPivot}
                y2={pivots[n - 1]}
                stroke={ink}
                strokeWidth="1.5"
                strokeDasharray="4 3"
            />,
        );
    }
    return items;
}

function sensorDots(w: number, y: number, xL: number, xR: number, r: number) {
    return (
        <>
            <line x1={0} y1={y} x2={xL} y2={y} stroke={ink} strokeWidth="2"/>
            <line x1={xR} y1={y} x2={w * GRID} y2={y} stroke={ink} strokeWidth="2"/>
            <circle cx={xL} cy={y} r={r} fill={ink}/>
            <circle cx={xR} cy={y} r={r} fill={ink}/>
        </>
    );
}

/** Temperature switch: lever plus hanging thermal zigzag (bimetal). */
function tempSwitch(w: number, closed: boolean) {
    const y = 1.3 * GRID;
    const xL = 0.95 * GRID;
    const xR = w * GRID - 0.95 * GRID;
    const r = 5;
    const p2x = closed ? xR - r * 0.1 : xR - OPEN_GAP;
    const p2y = closed ? y + r + 2 : y + r + OPEN_DROP;
    const hx = xL + (p2x - xL) * 0.38;
    const hy = y + (p2y - y) * 0.38;
    const zig = 6;
    const zw = 8;
    let zx = hx;
    let zy = hy + 6;
    const pts = [`${hx},${hy}`, `${zx},${zy}`];
    zx += zw;
    pts.push(`${zx},${zy}`);
    zy += zig;
    pts.push(`${zx},${zy}`);
    zx -= zw;
    pts.push(`${zx},${zy}`);
    zy += zig;
    pts.push(`${zx},${zy}`);
    zx += zw;
    pts.push(`${zx},${zy}`);
    zy += zig;
    pts.push(`${zx},${zy}`);
    zx -= zw;
    pts.push(`${zx},${zy}`);
    return (
        <>
            {sensorDots(w, y, xL, xR, r)}
            <line x1={xL} y1={y} x2={p2x} y2={p2y} stroke={ink} strokeWidth="2"/>
            <polyline points={pts.join(" ")} fill="none" stroke={ink} strokeWidth="2"/>
        </>
    );
}

/** Flow switch: vane triangle hanging from the arm. */
function flowSwitch(w: number, closed: boolean) {
    const y = 1.3 * GRID;
    const xL = 0.95 * GRID;
    const xR = w * GRID - 0.95 * GRID;
    const r = 5;
    const p2x = closed ? xR - r * 0.1 : xR + r * 0.25;
    const p2y = closed ? y + r + 2 : y + r + 18;
    const hx = xL + (p2x - xL) * 0.36;
    const hy = y + (p2y - y) * 0.36;
    const stem = 16;
    const tw = 24;
    const th = 24;
    return (
        <>
            {sensorDots(w, y, xL, xR, r)}
            <line x1={xL} y1={y} x2={p2x} y2={p2y} stroke={ink} strokeWidth="2"/>
            <line x1={hx} y1={hy} x2={hx} y2={hy + stem + th} stroke={ink} strokeWidth="2"/>
            <polygon
                points={`${hx},${hy + stem} ${hx},${hy + stem + th} ${hx + tw},${hy + stem + th}`}
                fill="none"
                stroke={ink}
                strokeWidth="2"
            />
        </>
    );
}

/** Pressure switch: diaphragm bowl hanging from the arm. */
function pressureSwitch(w: number, closed: boolean) {
    const y = 1.3 * GRID;
    const xL = 0.95 * GRID;
    const xR = w * GRID - 0.95 * GRID;
    const r = 5;
    const p2x = closed ? xR - r * 0.1 : xR + r * 0.25;
    const p2y = closed ? y + r + 2 : y + r + 18;
    const hx = xL + (p2x - xL) * 0.38;
    const hy = y + (p2y - y) * 0.38;
    const stem = closed ? 14 : 16;
    const br = 10;
    const by = hy + stem;
    return (
        <>
            {sensorDots(w, y, xL, xR, r)}
            <line x1={xL} y1={y} x2={p2x} y2={p2y} stroke={ink} strokeWidth="2"/>
            <line x1={hx} y1={hy} x2={hx} y2={by} stroke={ink} strokeWidth="2"/>
            <line x1={hx - br} y1={by} x2={hx + br} y2={by} stroke={ink} strokeWidth="2"/>
            <path
                d={`M ${hx - br} ${by} A ${br} ${br} 0 0 0 ${hx + br} ${by}`}
                fill="none"
                stroke={ink}
                strokeWidth="2"
            />
        </>
    );
}

/** Limit switch: slanted arm with a triangular actuator. Closed = arm nearly on the right circle. */
function limitArm(w: number, closed: boolean) {
    const y = 1.5 * GRID;
    const xL = 0.9 * GRID;
    const xR = w * GRID - 0.9 * GRID;
    const r = 6.5;
    const p1x = xL;
    const p1y = y;
    const p2x = closed ? xR - r * 0.12 : xR - OPEN_GAP;
    const p2y = closed ? y - 3 : y + OPEN_DROP;
    const dx = p2x - p1x;
    const dy = p2y - p1y;
    const len = Math.hypot(dx, dy);
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    const a = len * 0.32;
    const b = len * 0.78;
    const tip = 11;
    return (
        <>
            <line x1={0} y1={y} x2={xL - r} y2={y} stroke={ink} strokeWidth="2"/>
            <line x1={xR + r} y1={y} x2={w * GRID} y2={y} stroke={ink} strokeWidth="2"/>
            <circle cx={xL} cy={y} r={r} fill="#efe6d0" stroke={ink} strokeWidth="2"/>
            <circle cx={xR} cy={y} r={r} fill="#efe6d0" stroke={ink} strokeWidth="2"/>
            <g transform={`translate(${p1x} ${p1y}) rotate(${ang})`}>
                <line x1={0} y1={0} x2={len} y2={0} stroke={ink} strokeWidth="2"/>
                <polygon
                    points={`${a},0 ${b},0 ${(a + b) / 2},${tip}`}
                    fill={ink}
                />
            </g>
        </>
    );
}

/** Foot switch: slanted pedal with a pad. Closed = pedal down on the right circle. */
function footPedal(w: number, closed: boolean, openDown = false) {
    const y = 1.5 * GRID;
    const xL = 0.85 * GRID;
    const xR = w * GRID - 0.85 * GRID;
    const r = 6.5;
    const p1x = xL + r * 0.45;
    const p1y = y;
    const p2x = closed ? xR - r * 0.05 : xR - OPEN_GAP;
    const p2y = closed ? y + 2 : y + (openDown ? OPEN_DROP : -OPEN_DROP);
    const ang = (Math.atan2(p2y - p1y, p2x - p1x) * 180) / Math.PI;
    const mx = p1x + (p2x - p1x) * 0.62;
    const my = p1y + (p2y - p1y) * 0.62;
    return (
        <>
            <line x1={0} y1={y} x2={xL - r} y2={y} stroke={ink} strokeWidth="2"/>
            <line x1={xR + r} y1={y} x2={w * GRID} y2={y} stroke={ink} strokeWidth="2"/>
            <circle cx={xL} cy={y} r={r} fill="#efe6d0" stroke={ink} strokeWidth="2"/>
            <circle cx={xR} cy={y} r={r} fill="#efe6d0" stroke={ink} strokeWidth="2"/>
            <line x1={p1x} y1={p1y} x2={p2x} y2={p2y} stroke={ink} strokeWidth="2"/>
            <g transform={`translate(${mx} ${my}) rotate(${ang})`}>
                <rect x={-9} y={-6.5} width={16} height={5} fill="#efe6d0" stroke={ink} strokeWidth="1.8"/>
            </g>
        </>
    );
}

function contactPair(
    w: number,
    y: number,
    nc: boolean,
    conducting: boolean,
    labL?: string,
    labR?: string,
) {
    const xL = 4;
    const xR = w * GRID - 4;
    const barL = w * GRID * 0.38;
    const barR = w * GRID * 0.62;
    const barH = 0.4 * GRID;
    return (
        <g>
            <line x1={xL} y1={y} x2={barL} y2={y} stroke={ink} strokeWidth="2"/>
            <line x1={barR} y1={y} x2={xR} y2={y} stroke={ink} strokeWidth="2"/>
            <line x1={barL} y1={y - barH} x2={barL} y2={y + barH} stroke={ink} strokeWidth="2.2"/>
            <line x1={barR} y1={y - barH} x2={barR} y2={y + barH} stroke={ink} strokeWidth="2.2"/>
            {conducting && (
                nc ? (
                    <line x1={barL} y1={y + barH} x2={barR} y2={y - barH} stroke={ink} strokeWidth="2"/>
                ) : (
                    <line x1={barL} y1={y} x2={barR} y2={y} stroke={ink} strokeWidth="2"/>
                )
            )}
            {labL && (
                <Txt x={8} y={y - 8} className="term-lab">
                    {labL}
                </Txt>
            )}
            {labR && (
                <Txt x={w * GRID - 8} y={y - 8} textAnchor="end" className="term-lab">
                    {labR}
                </Txt>
            )}
        </g>
    );
}

const LAMP: Record<string, string> = {
    red: "#e23d2b",
    green: "#3dd16a",
    yellow: "#f0c42e",
    white: "#f4f0e1",
    blue: "#3b7de0",
};

export function SymbolGlyph({
                                device,
                                variant,
                                w,
                                h,
                                rt,
                                pressed,
                                flipX,
                                flipY,
                            }: {
    device: Device;
    variant: string;
    w: number;
    h: number;
    rt?: DeviceRuntime;
    pressed?: boolean;
    flipX?: boolean;
    flipY?: boolean;
}) {
    return (
        <FlipCtx.Provider value={{fx: flipX ? -1 : 1, fy: flipY ? -1 : 1}}>
            <GlyphBody
                device={device}
                variant={variant}
                w={w}
                h={h}
                rt={rt}
                pressed={pressed}
            />
        </FlipCtx.Provider>
    );
}

function GlyphBody({
                       device,
                       variant,
                       w,
                       h,
                       rt,
                       pressed,
                   }: {
    device: Device;
    variant: string;
    w: number;
    h: number;
    rt?: DeviceRuntime;
    pressed?: boolean;
}) {
    const kind = device.kind;
    const hot = Boolean(rt?.energized);
    const closed = Boolean(rt && (kind.includes("nc") || kind === "estop" || kind === "estop-nc" ? !rt.actuated : rt.actuated));
    const key = `${kind}:${variant}`;
    const isPressed = pressed ?? Boolean(rt?.actuated);

    if (kind === "pb-no") {
        return (
            <S w={w} h={h}>
                {contactLines(w, h, false, "pb", isPressed)}
                <Tag x={4} y={h * GRID + 12} text={device.tag}/>
            </S>
        );
    }
    if (kind === "pb-nc") {
        return (
            <S w={w} h={h}>
                {contactLines(w, h, true, "pb", isPressed)}
                <Tag x={4} y={h * GRID + 12} text={device.tag}/>
            </S>
        );
    }
    if (kind === "estop" || kind === "estop-nc" || kind === "estop-no") {
        return (
            <S w={w} h={h}>
                {contactLines(w, h, kind !== "estop-no", "estop", isPressed)}
                <Tag x={4} y={h * GRID + 12} text={device.tag}/>
            </S>
        );
    }
    if (kind === "toggle") {
        return (
            <S w={w} h={h}>
                {contactPair(w, 1 * GRID, false, Boolean(rt?.actuated), "1", "2")}
                {contactPair(w, 2.4 * GRID, true, !rt?.actuated, "3", "4")}
                <line x1={w * GRID / 2 - 8} y1={8} x2={w * GRID / 2 + 8} y2={2} stroke={ink} strokeWidth="2"/>
                <Tag x={4} y={h * GRID + 12} text={device.tag}/>
            </S>
        );
    }
    if (kind === "toggle-spst" || kind === "toggle-spdt" || kind === "toggle-dpst" || kind === "toggle-dpdt" || kind === "toggle-4pdt") {
        const n = kind === "toggle-spst" || kind === "toggle-spdt" ? 1 : kind === "toggle-dpst" || kind === "toggle-dpdt" ? 2 : 4;
        const dt = kind === "toggle-spdt" || kind === "toggle-dpdt" || kind === "toggle-4pdt";
        return (
            <S w={w} h={h}>
                {togglePoles(w, h, n, dt, Boolean(rt?.actuated))}
                <Tag x={4} y={h * GRID + 12} text={device.tag}/>
            </S>
        );
    }
    if (kind === "limit-no" || kind === "limit-nc") {
        const closed = kind === "limit-nc" ? !rt?.actuated : Boolean(rt?.actuated);
        return (
            <S w={w} h={h}>
                {limitArm(w, closed)}
                <Tag x={4} y={h * GRID + 12} text={device.tag}/>
            </S>
        );
    }
    if (kind === "foot") {
        return (
            <S w={w} h={h}>
                {contactPair(w, 1 * GRID, false, Boolean(rt?.actuated), "1", "2")}
                {contactPair(w, 2.4 * GRID, true, !rt?.actuated, "3", "4")}
                <Txt x={w * GRID / 2 + 10} y={1 * GRID} fontSize="9" fill={ink}>FS</Txt>
                <Tag x={4} y={h * GRID + 12} text={device.tag}/>
            </S>
        );
    }
    if (kind === "foot-no" || kind === "foot-nc") {
        const closed = kind === "foot-nc" ? !isPressed : isPressed;
        return (
            <S w={w} h={h}>
                {footPedal(w, closed, kind === "foot-nc")}
                <Tag x={4} y={h * GRID + 12} text={device.tag}/>
            </S>
        );
    }
    if (kind === "float") {
        const closed = Boolean(rt?.actuated);
        const y = 1.4 * GRID;
        const xL = 0.9 * GRID;
        const xR = w * GRID - 0.9 * GRID;
        const r = 5.5;
        const p2x = closed ? xR - r * 0.12 : xR - OPEN_GAP;
        const p2y = closed ? y + 1.5 : y + OPEN_DROP;
        const hx = xL + (p2x - xL) * 0.42;
        const hy = y + (p2y - y) * 0.42;
        const fr = 9;
        const fy = hy + (closed ? 12 : 20) + fr;
        return (
            <S w={w} h={h}>
                <line x1={0} y1={y} x2={xL - r} y2={y} stroke={ink} strokeWidth="2"/>
                <line x1={xR + r} y1={y} x2={w * GRID} y2={y} stroke={ink} strokeWidth="2"/>
                <circle cx={xL} cy={y} r={r} fill="#efe6d0" stroke={ink} strokeWidth="2"/>
                <circle cx={xR} cy={y} r={r} fill="#efe6d0" stroke={ink} strokeWidth="2"/>
                <line x1={xL} y1={y} x2={p2x} y2={p2y} stroke={ink} strokeWidth="2"/>
                <line x1={hx} y1={hy} x2={hx} y2={fy - fr} stroke={ink} strokeWidth="2"/>
                <circle cx={hx} cy={fy} r={fr} fill="#efe6d0" stroke={ink} strokeWidth="2.2"/>
                <Tag x={4} y={h * GRID + 12} text={device.tag}/>
            </S>
        );
    }
    if (kind === "temp-no" || kind === "temp-nc") {
        const closed = kind === "temp-nc" ? !rt?.actuated : Boolean(rt?.actuated);
        return (
            <S w={w} h={h}>
                {tempSwitch(w, closed)}
                <Tag x={4} y={h * GRID + 12} text={device.tag}/>
            </S>
        );
    }
    if (kind === "pressure-no" || kind === "pressure-nc") {
        const closed = kind === "pressure-nc" ? !rt?.actuated : Boolean(rt?.actuated);
        return (
            <S w={w} h={h}>
                {pressureSwitch(w, closed)}
                <Tag x={4} y={h * GRID + 12} text={device.tag}/>
            </S>
        );
    }
    if (kind === "flow-no" || kind === "flow-nc") {
        const closed = kind === "flow-nc" ? !rt?.actuated : Boolean(rt?.actuated);
        return (
            <S w={w} h={h}>
                {flowSwitch(w, closed)}
                <Tag x={4} y={h * GRID + 12} text={device.tag}/>
            </S>
        );
    }
    if (kind === "prox" || kind === "photo") {
        return (
            <S w={w} h={h}>
                {contactLines(w, h, false, kind)}
                <Tag x={4} y={h * GRID + 12} text={device.tag}/>
            </S>
        );
    }
    if (kind === "contactor" && variant === "coil") {
        return (
            <S w={w} h={h}>
                {coilBox(w, h, device.tag, hot)}
            </S>
        );
    }
    if (kind === "contactor" && variant === "main") {
        const poles = [
            {y: 1, l: "L1", t: "T1"},
            {y: 3, l: "L2", t: "T2"},
            {y: 5, l: "L3", t: "T3"},
        ];
        return (
            <S w={w} h={h}>
                <rect
                    x="1"
                    y="1"
                    width={w * GRID - 2}
                    height={h * GRID - 2}
                    fill="#efe6d0"
                    stroke={ink}
                    strokeWidth="1.5"
                />
                {poles.map((p) => (
                    <g key={p.l}>{barContact(w, p.y * GRID, hot, p.l, p.t)}</g>
                ))}
                <Tag x={4} y={h * GRID + 12} text={device.tag}/>
            </S>
        );
    }
    if (kind === "contactor" && (variant === "aux-no" || variant === "aux-no2")) {
        const lab = variant === "aux-no2" ? "43-44" : "13-14";
        return (
            <S w={w} h={h}>
                {contactLines(w, h, false, undefined, false, hot)}
                <Tag x={4} y={h * GRID + 12} text={`${device.tag} NO ${lab}`}/>
            </S>
        );
    }
    if (kind === "contactor" && (variant === "aux-nc" || variant === "aux-nc2")) {
        const lab = variant === "aux-nc2" ? "31-32" : "21-22";
        return (
            <S w={w} h={h}>
                {contactLines(w, h, true, undefined, false, !hot)}
                <Tag x={4} y={h * GRID + 12} text={`${device.tag} NC ${lab}`}/>
            </S>
        );
    }
    if (kind === "relay" && variant === "coil") {
        return (
            <S w={w} h={h}>
                {coilBox(w, h, device.tag, hot)}
            </S>
        );
    }
    if (kind === "relay") {
        const nc = variant === "aux-nc" || variant === "aux-nc2";
        const lab =
            variant === "aux-no2" ? "5-6" : variant === "aux-nc2" ? "7-8" : variant === "aux-nc" ? "3-4" : "1-2";
        return (
            <S w={w} h={h}>
                {contactLines(w, h, nc, undefined, false, nc ? !hot : hot)}
                <Tag x={4} y={h * GRID + 12} text={`${device.tag} ${nc ? "NC" : "NO"} ${lab}`}/>
            </S>
        );
    }
    if (kind === "lamp") {
        const col = LAMP[device.params.color ?? "green"] ?? LAMP.green;
        const cx = (w * GRID) / 2;
        const cy = (h * GRID) / 2;
        const letter =
            (device.params.color ?? "green") === "red"
                ? "R"
                : (device.params.color ?? "green") === "green"
                    ? "G"
                    : (device.params.color ?? "green") === "yellow"
                        ? "A"
                        : (device.params.color ?? "green") === "blue"
                            ? "B"
                            : "W";
        return (
            <S w={w} h={h}>
                <line x1={cx} y1={4} x2={cx} y2={cy - 14} stroke={ink} strokeWidth="2"/>
                <line x1={cx} y1={cy + 14} x2={cx} y2={h * GRID - 4} stroke={ink} strokeWidth="2"/>
                <circle
                    cx={cx}
                    cy={cy}
                    r="13"
                    fill={rt?.lit ? col : "#efe6d0"}
                    stroke={ink}
                    strokeWidth="2"
                    style={rt?.lit ? {filter: `drop-shadow(0 0 8px ${col})`} : undefined}
                />
                {[45, 135, 225, 315].map((deg) => {
                    const a = (deg * Math.PI) / 180;
                    const x1 = cx + Math.cos(a) * 13;
                    const y1 = cy + Math.sin(a) * 13;
                    const x2 = cx + Math.cos(a) * 20;
                    const y2 = cy + Math.sin(a) * 20;
                    return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={ink} strokeWidth="2"/>;
                })}
                <Txt x={cx} y={cy + 4} textAnchor="middle" className="sym-tag">
                    {letter}
                </Txt>
                <Tag x={4} y={h * GRID + 12} text={device.tag}/>
            </S>
        );
    }
    if (kind === "alarm" || kind === "horn") {
        const cx = (w * GRID) / 2;
        const cy = (h * GRID) / 2;
        return (
            <S w={w} h={h}>
                <polygon
                    points={`${cx - 10},${cy - 10} ${cx + 8},${cy - 16} ${cx + 8},${cy + 16} ${cx - 10},${cy + 10}`}
                    fill={rt?.lit ? "#e23d2b" : "#efe6d0"}
                    stroke={ink}
                    strokeWidth="2"
                />
                <path d={`M ${cx + 12} ${cy - 10} q 10 10 0 20`} fill="none" stroke={ink} strokeWidth="1.5"/>
                <Tag x={4} y={h * GRID + 12} text={device.tag}/>
            </S>
        );
    }
    if (kind === "breaker-1p" || kind === "fuse") {
        const cx = (w * GRID) / 2;
        const live = Boolean(rt?.on && !rt?.tripped);
        return (
            <S w={w} h={h}>
                <line x1={cx} y1={4} x2={cx} y2={h * GRID - 4} stroke={ink} strokeWidth="2"/>
                {kind === "fuse" ? (
                    <rect
                        x={cx - 9}
                        y={h * GRID * 0.28}
                        width="18"
                        height={h * GRID * 0.44}
                        rx="2"
                        fill={live ? "#cfe8c4" : "#e8c4c4"}
                        stroke={ink}
                        strokeWidth="2"
                    />
                ) : (
                    <rect
                        x={cx - 8}
                        y={h * GRID * 0.3}
                        width="16"
                        height={h * GRID * 0.4}
                        fill={live ? "#cfe8c4" : "#e8c4c4"}
                        stroke={ink}
                        strokeWidth="2"
                    />
                )}
                <Txt x={cx} y={h * GRID * 0.52} textAnchor="middle" className="term-lab">
                    {kind === "fuse" ? "FU" : "CB"}
                </Txt>
                <Tag x={4} y={h * GRID + 12} text={device.tag}/>
            </S>
        );
    }
    if (kind === "overload") {
        const tripped = Boolean(rt?.tripped);
        return (
            <S w={w} h={h}>
                <rect x="1" y="1" width={w * GRID - 2} height={h * GRID - 2} fill="#efe6d0" stroke={ink}
                      strokeWidth="1.5"/>
                {poles(w, 6, 3, !tripped, undefined, "thermal")}
                {barContact(w, 7 * GRID, !tripped, "95", "96")}
                {barContact(w, 9 * GRID, tripped, "97", "98")}
                <Tag x={6} y={12} text={`${device.tag} OL`}/>
            </S>
        );
    }
    if (kind === "breaker-3p" || kind === "isolator" || kind === "rcd") {
        const n = kind === "rcd" ? 4 : 3;
        const title =
            kind === "isolator"
                ? "DISC"
                : kind === "rcd"
                    ? "GFCI"
                    : "CB";
        return (
            <S w={w} h={h}>
                <rect x="1" y="1" width={w * GRID - 2} height={h * GRID - 2} fill="#efe6d0" stroke={ink}
                      strokeWidth="1.5"/>
                {poles(
                    w,
                    h,
                    Math.min(n, 3),
                    Boolean(rt?.on && !rt?.tripped),
                    undefined,
                    kind === "breaker-3p" || kind === "isolator" ? "arc" : "bar",
                    kind === "breaker-3p" || kind === "isolator",
                )}
                <Tag x={6} y={12} text={`${device.tag} ${title}`}/>
            </S>
        );
    }
    if (kind === "junction") {
        return (
            <S w={Math.max(w, 1)} h={Math.max(h, 1)}>
                <circle
                    cx={0}
                    cy={0}
                    r={hot ? 5.6 : 4.8}
                    fill={hot ? "#e6c11e" : ink}
                    stroke="#efe6d0"
                    strokeWidth="1.2"
                />
            </S>
        );
    }
    if (kind === "net-label") {
        const cy = 0.8 * GRID;
        const label = device.tag.trim() || "?";
        const boxX = 10;
        const boxW = w * GRID - boxX - 1;
        const boxH = 22;
        const boxY = cy - boxH / 2;
        return (
            <S w={w} h={h}>
                <line x1={0} y1={cy} x2={boxX} y2={cy} stroke={ink} strokeWidth="2"/>
                <polygon
                    points={`${boxX},${cy} ${boxX + 8},${boxY} ${boxX + boxW},${boxY} ${boxX + boxW},${boxY + boxH} ${boxX + 8},${boxY + boxH}`}
                    fill={hot ? "#f0d27a" : "#efe6d0"}
                    stroke={ink}
                    strokeWidth="1.6"
                />
                <Txt
                    x={boxX + 8 + (boxW - 8) / 2}
                    y={cy + 4}
                    textAnchor="middle"
                    className="sym-tag"
                >
                    {label}
                </Txt>
            </S>
        );
    }
    if (kind === "mains-3ph") {
        // Terminal X position and color circle offset
        const termX = w * GRID - 14;
        const baseY = (h * GRID) / 5;
        const cols = ["#a65628", "#ff7f00", "#eccd26", "#ffffff", "#2ca02c"]; // Brown, Orange, Yellow, White, Green
        // L1, L2, L3, N, G positions
        const positions = [
            {y: baseY * 0.7 - 0.1 * GRID, label: "L1"}, // L1
            {y: baseY * 1.7 - 0.21 * GRID, label: "L2"}, // L2
            {y: baseY * 2.7 - 0.3 * GRID, label: "L3"}, // L3
            {y: baseY * 3.7 - 0.4 * GRID, label: "N"},   // N
            {y: baseY * 4.7 - 0.5 * GRID, label: "G"},   // G
        ];
        return (
            <S w={w} h={h}>
                <rect x="1" y="1" width={w * GRID - 2} height={h * GRID - 2} fill="#1c2416" stroke="#e6c11e"
                      strokeWidth="2"/>
                {positions.map((pos, i) => (
                    <g key={pos.label}>
                        <circle cx={termX} cy={pos.y} r="6" fill={cols[i]}/>
                        <Txt x={8} y={pos.y + 10} fill="#efe6d0" fontSize="11" fontFamily="Red Hat Mono, monospace">
                            {pos.label}
                        </Txt>
                    </g>
                ))}
                <Txt x={18} y={14} textAnchor="start" fill="#ffffff" fontSize="12" fontWeight="bold"
                     fontFamily="Red Hat Mono, monospace">
                    {device.tag}
                </Txt>
            </S>
        );
    }
    if (kind === "dc-supply") {
        const cx = (w * GRID) / 2;
        const cy = (h * GRID) / 2;
        return (
            <S w={w} h={h}>
                <rect x="1" y="1" width={w * GRID - 2} height={h * GRID - 2} fill="#1c2416" stroke="#e07020"
                      strokeWidth="2"/>
                <Txt x={cx} y={cy - 1} textAnchor="middle" fill="#e07020" fontSize="25" fontFamily="Teko, sans-serif">
                    DC
                </Txt>
                {/* Positive terminal */}
                <circle cx={w * GRID - 15} cy={cy - 21} r="6" fill="#ffffff"/>
                <Txt x={w * GRID - 15} y={cy - 16} textAnchor="middle" fontSize="18" fontWeight="bold" fill="#1b1a16">
                    +
                </Txt>
                {/* Negative terminal */}
                <circle cx={w * GRID - 15} cy={cy + 22} r="6" fill="#ffffff"/>
                <Txt x={w * GRID - 15} y={cy + 27} textAnchor="middle" fontSize="18" fontWeight="bold" fill="#1b1a16">
                    -
                </Txt>
                <Txt x={18} y={14} textAnchor="start" fill="#ffffff" fontSize="12" fontWeight="bold"
                     fontFamily="Red Hat Mono, monospace">
                    {device.tag}
                </Txt>
            </S>
        );
    }

    if (kind === "transformer") {
        const cx = (w * GRID) / 2;
        const cy = (h * GRID) / 2;
        const leftLine = -22;
        const rightLine = 22;
        const coilTop = cy - 24;
        const coilBottom = cy + 14;
        // Primary coil (left side)
        const primaryCoil = (
            <path
                d={`
      M ${cx - 8} ${coilTop}
      c -14 0 -14 10 0 10
      c -14 0 -14 10 0 10
      c -14 0 -14 10 0 10
      M ${cx - 8} ${coilTop}
      l ${leftLine} 0
      M ${cx - 8} ${coilBottom}
      l ${leftLine} 0
    `}
                fill="none"
                stroke={ink}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        );

        // Secondary coil (right side)
        const secondaryCoil = (
            <path
                d={`
      M ${cx + 8} ${coilTop}
      c 14 0 14 10 0 10
      c 14 0 14 10 0 10
      c 14 0 14 10 0 10
      M ${cx + 8} ${coilTop}
      l ${rightLine} 0
      M ${cx + 8} ${coilBottom}
      l ${rightLine} 0
    `}
                fill="none"
                stroke={ink}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        );

        return (
            <S w={w} h={h}>
                {/* Border */}
                <rect x="1" y="1" width={w * GRID - 2} height={h * GRID - 2} fill="none" stroke={ink} strokeWidth="1.5" />
                {primaryCoil}
                {secondaryCoil}
                {/* Core - two parallel lines */}
                <line x1={cx - 2} y1={coilTop} x2={cx - 2} y2={coilBottom} stroke={ink} strokeWidth="1.6" />
                <line x1={cx + 2} y1={coilTop} x2={cx + 2} y2={coilBottom} stroke={ink} strokeWidth="1.6" />


                <Tag x={6} y={14} text={device.tag} />
                <Txt x={cx} y={h * GRID - 4} textAnchor="middle" fontSize="16">
                    {device.params.ratio ?? "480/120"}
                </Txt>
            </S>
        );
    }

    if (kind === "transformer3ph") {
        const cx = (w * GRID) / 2;
        const cy = (h * GRID) / 2;
        const coilLeft = -24;
        const coilTop = cy - 28;
        const coilBottom = cy + 18;
        const termY = [1, 3, 5, 7]; // Terminal Y positions (L1, L2, L3, N)

        // Helper to draw a coil
        const drawCoil = (offsetX: number, direction: 1 | -1) => (
            <path
                d={`
          M ${cx + offsetX} ${coilTop}
          c ${direction * 46} 0 ${direction * 46} 10 ${direction * 0} 11
          c ${direction * 46} 0 ${direction * 46} 10 ${direction * 0} 11
          c ${direction * 46} 0 ${direction * 46} 10 ${direction * 0} 11
          c ${direction * 46} 0 ${direction * 46} 10 ${direction * 0} 13
          M ${cx + offsetX} ${coilTop}
          l ${coilLeft * (direction as number)} 0
          M ${cx + offsetX} ${coilBottom}
          l ${coilLeft * (direction as number)} 0
        `}
                fill="none"
                stroke={ink}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        );

        // Primary coil (left side)
        const primaryCoil = drawCoil(-40, 1);

        // Secondary coil (right side)
        const secondaryCoil = drawCoil(40, -1);

        // Core - three parallel lines
        const core = (
            <>
                <line x1={cx - 4} y1={coilTop} x2={cx - 4} y2={coilBottom} stroke={ink} strokeWidth="1.6" />
                <line x1={cx} y1={coilTop} x2={cx} y2={coilBottom} stroke={ink} strokeWidth="1.6" />
                <line x1={cx + 4} y1={coilTop} x2={cx + 4} y2={coilBottom} stroke={ink} strokeWidth="1.6" />
            </>
        );

        // Draw connection lines for Wye (Y) - 3 phase lines + 1 neutral line (total 4)
        const drawWyeConnection = (side: "left" | "right") => {
            const x = side === "left" ? 0 : w * GRID;
            const neutralY = termY[3] * GRID; // N terminal position
            const termRadius = 6;
            return (
                <g>
                    {/* Phase lines (L1, L2, L3) - stop before terminal circle */}
                    <line x1={x} y1={termY[0] * GRID} x2={x} y2={neutralY - termRadius} stroke={ink} strokeWidth="1.6" />
                    <line x1={x} y1={termY[1] * GRID} x2={x} y2={neutralY - termRadius} stroke={ink} strokeWidth="1.6" />
                    <line x1={x} y1={termY[2] * GRID} x2={x} y2={neutralY - termRadius} stroke={ink} strokeWidth="1.6" />
                    {/* Neutral line (N) - starts from terminal circle */}
                    <line x1={x} y1={neutralY + termRadius} x2={x} y2={termY[3] * GRID} stroke={ink} strokeWidth="1.6" />
                </g>
            );
        };

        // Draw connection lines for Delta (Δ) - 3 phase lines only (no neutral)
        const drawDeltaConnection = (side: "left" | "right") => {
            const x = side === "left" ? 0 : w * GRID;
            const termRadius = 6;
            const topY = termY[0] * GRID;
            const bottomY = termY[2] * GRID;
            return (
                <g>
                    {/* Vertical line connecting L1 to L3 - stop before terminal circles */}
                    <line x1={x} y1={topY + termRadius} x2={x} y2={bottomY - termRadius} stroke={ink} strokeWidth="1.6" />
                    {/* Small diagonal marks to indicate delta - L1 side */}
                    <line x1={x} y1={topY + termRadius} x2={x - 6} y2={topY + termRadius + 6} stroke={ink} strokeWidth="1.6" />
                    <line x1={x} y1={bottomY - termRadius} x2={x - 6} y2={bottomY - termRadius - 6} stroke={ink} strokeWidth="1.6" />
                    {side === "right" && (
                        <>
                            {/* Small diagonal marks to indicate delta - L3 side */}
                            <line x1={x} y1={topY + termRadius} x2={x + 6} y2={topY + termRadius + 6} stroke={ink} strokeWidth="1.6" />
                            <line x1={x} y1={bottomY - termRadius} x2={x + 6} y2={bottomY - termRadius - 6} stroke={ink} strokeWidth="1.6" />
                        </>
                    )}
                </g>
            );
        };

        // Winding labels
        const windingLabel = (text: string, x: number, y: number) => (
            <Txt x={x} y={y} fontSize="12" textAnchor="middle" fill={ink}>
                {text}
            </Txt>
        );

        // Terminal colors for L1, L2, L3, N
        const termColors = ["#a65628", "#ff7f00", "#eccd26", "#ffffff"]; // brown, orange, yellow, white

        // Draw terminal circles and labels for each phase
        const drawTerminal = (side: "left" | "right", label: string, colorIndex: number, y: number, show: boolean) => {
            const termX = side === "left" ? 13 : w * GRID - 13;
            const textX = side === "left" ? 25 : w * GRID - 32;
            const color = termColors[colorIndex];
            return (
                <g key={label} style={{opacity: show ? 1 : 0}}>
                    <circle cx={termX} cy={y * GRID} r="6" fill={color} stroke={ink} strokeWidth="1.5" />
                    <Txt x={textX} y={y * GRID + 8} fill={ink} fontSize="11" fontWeight="bold">
                        {label}
                    </Txt>
                </g>
            );
        };

        return (
            <S w={w} h={h}>
                {/* Border */}
                <rect x="1" y="1" width={w * GRID - 2} height={h * GRID - 2} fill="none" stroke={ink} strokeWidth="1.5" />
                {primaryCoil}
                {secondaryCoil}
                {core}
                {/* Connection lines - Primary (left) */}
                {device.params.primaryConn === "wye"
                    ? drawWyeConnection("left")
                    : drawDeltaConnection("left")}
                {/* Connection lines - Secondary (right) */}
                {device.params.secondaryConn === "wye"
                    ? drawWyeConnection("right")
                    : drawDeltaConnection("right")}
                {/* Terminals - Primary (left) */}
                {drawTerminal("left", "L1", 0, termY[0], true)}
                {drawTerminal("left", "L2", 1, termY[1], true)}
                {drawTerminal("left", "L3", 2, termY[2], true)}
                {drawTerminal("left", "N", 3, termY[3], device.params.primaryConn === "wye")}
                {/* Terminals - Secondary (right) */}
                {drawTerminal("right", "T1", 0, termY[0], true)}
                {drawTerminal("right", "T2", 1, termY[1], true)}
                {drawTerminal("right", "T3", 2, termY[2], true)}
                {drawTerminal("right", "TN", 3, termY[3], device.params.secondaryConn === "wye")}
                {/* Device tag */}
                <Tag x={26} y={12} text={device.tag} />
                {/* Winding labels */}
                {windingLabel("P", 0, coilTop - 4)}
                {windingLabel("S", w * GRID, coilTop - 4)}
                {/* Connection type labels */}
                {device.params.primaryConn === "wye" && <Txt x={50} y={coilTop + 80} fontSize="32" fill={ink}>Y</Txt>}
                {device.params.primaryConn === "delta" && <Txt x={50} y={coilTop + 80} fontSize="32" fill={ink}>Δ</Txt>}
                {device.params.secondaryConn === "wye" && <Txt x={w * GRID - 80} y={coilTop + 80} fontSize="32" fill={ink}>Y</Txt>}
                {device.params.secondaryConn === "delta" && <Txt x={w * GRID - 80} y={coilTop + 80} fontSize="32" fill={ink}>Δ</Txt>}
                {/* Voltage display */}
                <Txt x={cx} y={h * GRID - 4} textAnchor="middle" fontSize="16">
                    {device.params.primaryVolts ?? "480"} / {device.params.secondaryVolts ?? "120"}
                </Txt>
            </S>
        );
    }

    if (kind === "timer-on" || kind === "timer-off") {
        if (variant === "coil") {
            const kindLab = kind === "timer-on" ? "TON" : "TOF";
            const elapsed = rt ? `${Math.round(rt.elapsedMs / 100) / 10}s` : "";
            return (
                <S w={w} h={h}>
                    {coilBox(w, h, device.tag, hot)}
                    <Tag x={4} y={h * GRID + 12} text={`${kindLab} ${elapsed}`.trim()}/>
                </S>
            );
        }
        const delayed = variant === "delayed-nc" || variant === "delayed-no";
        const nc = variant === "delayed-nc" || variant === "inst-nc";
        const lab =
            variant === "delayed-nc"
                ? "15-16"
                : variant === "delayed-no"
                    ? "15-18"
                    : variant === "inst-nc"
                        ? "21-22"
                        : "21-24";
        const conducting = delayed
            ? nc
                ? !Boolean(rt?.done)
                : Boolean(rt?.done)
            : nc
                ? !hot
                : hot;
        return (
            <S w={w} h={h}>
                {timedContact(w, conducting, delayed, kind === "timer-off")}
                <Tag x={4} y={h * GRID + 12} text={`${device.tag} ${nc ? "NC" : "NO"} ${lab}`}/>
            </S>
        );
    }
    if (kind === "counter") {
        return (
            <S w={w} h={h}>
                {coilBox(w, h, device.tag, rt?.done ?? false)}
                <Txt x={(w * GRID) / 2} y={h * GRID - 6} textAnchor="middle" className="term-lab">
                    {rt ? `${rt.count}/${device.params.preset ?? 5}` : ""}
                </Txt>
            </S>
        );
    }
    if (kind === "fan") {
        const cx = (w * GRID) / 2;
        const cy = (h * GRID) / 2;
        const spin = rt ? Math.abs(rt.rpm) * 720 : 0;
        return (
            <S w={w} h={h}>
                <circle cx={cx} cy={cy} r="20" fill="#efe6d0" stroke={ink} strokeWidth="2"/>
                <g style={{transformOrigin: `${cx}px ${cy}px`, transform: `rotate(${spin}deg)`}}
                   className={hot ? "spinning" : undefined}>
                    <path d={`M ${cx} ${cy - 16} Q ${cx + 8} ${cy} ${cx} ${cy + 16} Q ${cx - 8} ${cy} ${cx} ${cy - 16}`}
                          fill="#3a4a32"/>
                </g>
                <Tag x={6} y={12} text={device.tag}/>
            </S>
        );
    }
    if (kind === "solenoid") {
        const y = 1.5 * GRID;
        const xL = 0.85 * GRID;
        const xR = w * GRID - 0.85 * GRID;
        const r = 6;
        const amp = 11;
        const mid = (xL + xR) / 2;
        const fill = hot ? "#f0d27a" : "#efe6d0";
        return (
            <S w={w} h={h}>
                <polyline
                    points={`${xL + r},${y} ${mid - 6},${y - amp} ${mid + 6},${y + amp} ${xR - r},${y}`}
                    fill="none"
                    stroke={ink}
                    strokeWidth="2.2"
                    strokeLinejoin="miter"
                    strokeMiterlimit="8"
                />
                <circle cx={xL} cy={y} r={r} fill={fill} stroke={ink} strokeWidth="2"/>
                <circle cx={xR} cy={y} r={r} fill={fill} stroke={ink} strokeWidth="2"/>
                <Txt x={8} y={y - r - 5} className="term-lab">
                    A1
                </Txt>
                <Txt x={w * GRID - 8} y={y - r - 5} textAnchor="end" className="term-lab">
                    A2
                </Txt>
                <Tag x={4} y={h * GRID + 12} text={device.tag}/>
            </S>
        );
    }
    if (kind === "heater") {
        return (
            <S w={w} h={h}>
                {coilBox(w, h, device.tag, hot)}
            </S>
        );
    }
    if (kind === "motor-3ph") {
        const cx = (w * GRID) / 2;
        const rO = 1.85 * GRID;
        const rI = 1.4 * GRID;
        const cy = h * GRID - rO;
        const leadXs = [cx - 0.95 * GRID, cx, cx + 0.95 * GRID];
        const yTop = 0;
        const yJoin = cy - rO;
        const fill = hot ? "#d9c48a" : "#efe6d0";
        return (
            <S w={w} h={h}>
                {leadXs.map((x, i) => (
                    <line key={i} x1={x} y1={yTop} x2={x} y2={yJoin} stroke={ink} strokeWidth="2.2"/>
                ))}
                <circle cx={cx} cy={cy} r={rO} fill={fill} stroke={ink} strokeWidth="2.4"/>
                <circle cx={cx} cy={cy} r={rI} fill={fill} stroke={ink} strokeWidth="2.2"/>
                <Txt x={cx} y={cy + 8} textAnchor="middle" fontSize="28" fill={ink} fontWeight="700">
                    M
                </Txt>
                <Tag x={4} y={h * GRID + 12} text={device.tag}/>
            </S>
        );
    }
    if (kind === "motor-1ph") {
        const cx = (w * GRID) / 2;
        const r = 1.85 * GRID;
        const cy = h * GRID - r;
        const yTop = 0;
        const yJoin = cy - r;
        const x1 = 1.7 * GRID;
        const x2 = 3.3 * GRID;
        const fill = hot ? "#d9c48a" : "#efe6d0";
        return (
            <S w={w} h={h}>
                <line x1={x1} y1={yTop} x2={x1} y2={yJoin} stroke={ink} strokeWidth="2.2"/>
                <line x1={x2} y1={yTop} x2={x2} y2={yJoin} stroke={ink} strokeWidth="2.2"/>
                <circle cx={cx} cy={cy} r={r} fill={fill} stroke={ink} strokeWidth="2.4"/>
                <Txt x={cx} y={cy - 4} textAnchor="middle" fontSize="26" fill={ink} fontWeight="700">
                    M
                </Txt>
                <Txt x={cx} y={cy + 18} textAnchor="middle" fontSize="16" fill={ink}>
                    1~
                </Txt>
                <Tag x={4} y={h * GRID + 12} text={device.tag}/>
            </S>
        );
    }
    if (kind === "motor-dc") {
        const cx = (w * GRID) / 2 + 8;
        const cy = (h * GRID) / 2;
        return (
            <S w={w} h={h}>
                <circle
                    cx={cx}
                    cy={cy}
                    r="24"
                    fill={hot ? "#d9c48a" : "#efe6d0"}
                    stroke={ink}
                    strokeWidth="2.5"
                />
                <circle cx={cx} cy={cy} r="8" fill="#1b1a16"/>
                <Txt x={cx} y={cy + 36} textAnchor="middle" className="sym-tag">
                    M DC
                </Txt>
                <Tag x={4} y={14} text={device.tag}/>
            </S>
        );
    }
    if (kind === "gen-ac" || kind === "gen-dc") {
        const cx = (w * GRID) / 2 - 6;
        const cy = (h * GRID) / 2;
        return (
            <S w={w} h={h}>
                <circle cx={cx} cy={cy} r="24" fill={hot ? "#cfe0f5" : "#efe6d0"} stroke={ink} strokeWidth="2.5"/>
                <Txt x={cx} y={cy + 4} textAnchor="middle" className="sym-tag">
                    {kind === "gen-ac" ? "G~" : "G="}
                </Txt>
                <Tag x={4} y={14} text={device.tag}/>
            </S>
        );
    }
    if (kind === "starter-rev-combo") {
        const fwd = hot && !Boolean(rt?.energizedAlt);
        const rev = Boolean(rt?.energizedAlt) && !hot;
        const gap = 0.4 * GRID;
        const barH = 0.5 * GRID;
        const poleY = [1.5, 3.5, 5.5].map((v) => v * GRID);
        const xF = 3.5 * GRID;
        const xRev = 8.5 * GRID;
        const pair = (xMid: number, y: number, on: boolean) => {
            const xL = xMid - gap / 2;
            const xRbar = xMid + gap / 2;
            return (
                <g>
                    <line x1={xL} y1={y - barH} x2={xL} y2={y + barH} stroke={ink} strokeWidth="2.2"/>
                    <line x1={xRbar} y1={y - barH} x2={xRbar} y2={y + barH} stroke={ink} strokeWidth="2.2"/>
                    {on && closedSlash(xL, xRbar, y, barH)}
                </g>
            );
        };
        return (
            <S w={w} h={h}>
                <rect
                    x="1"
                    y="1"
                    width={w * GRID - 2}
                    height={h * GRID - 2}
                    fill="#efe6d0"
                    stroke={ink}
                    strokeWidth="1.5"
                />
                <Txt x={xF} y={1.15 * GRID} textAnchor="middle" className="term-lab">
                    F
                </Txt>
                <Txt x={xRev} y={1.15 * GRID} textAnchor="middle" className="term-lab">
                    R
                </Txt>
                {poleY.map((y, i) => {
                    const labL = ["L1", "L2", "L3"][i];
                    const labT = ["T1", "T2", "T3"][i];
                    return (
                        <g key={labL}>
                            <line x1={0} y1={y} x2={xF - gap / 2} y2={y} stroke={ink} strokeWidth="2"/>
                            {pair(xF, y, fwd)}
                            <line x1={xF + gap / 2} y1={y} x2={xRev - gap / 2} y2={y} stroke={ink} strokeWidth="2"/>
                            {pair(xRev, y, rev)}
                            <line x1={xRev + gap / 2} y1={y} x2={w * GRID} y2={y} stroke={ink} strokeWidth="2"/>
                            <Txt x={8} y={y - 6} className="term-lab">
                                {labL}
                            </Txt>
                            <Txt x={w * GRID - 8} y={y - 6} textAnchor="end" className="term-lab">
                                {labT}
                            </Txt>
                        </g>
                    );
                })}
                <line
                    x1={xF}
                    y1={poleY[0]}
                    x2={xF}
                    y2={poleY[2]}
                    stroke={ink}
                    strokeWidth="1.4"
                    strokeDasharray="4 3"
                />
                <line
                    x1={xRev}
                    y1={poleY[0]}
                    x2={xRev}
                    y2={poleY[2]}
                    stroke={ink}
                    strokeWidth="1.4"
                    strokeDasharray="4 3"
                />
                <line
                    x1={xF + 12}
                    y1={6.4 * GRID}
                    x2={xRev - 12}
                    y2={6.4 * GRID}
                    stroke={ink}
                    strokeWidth="1.4"
                    strokeDasharray="3 3"
                />
                {([
                    {lab: "F", cx: 3.5 * GRID, on: fwd, side: -1, labs: ["A1F", "A2F"] as const, y1: 7.3, y2: 8.5, anchor: "start" as const, lx: 8},
                    {lab: "R", cx: 8.5 * GRID, on: rev, side: 1, labs: ["A1R", "A2R"] as const, y1: 7.3, y2: 8.5, anchor: "end" as const, lx: w * GRID - 8},
                ]).map((c) => {
                    const y1 = c.y1 * GRID;
                    const y2 = c.y2 * GRID;
                    const cy = (y1 + y2) / 2;
                    const cr = 14;
                    const xEdge = c.side < 0 ? 0 : w * GRID;
                    const join = (yy: number) => {
                        const dy = yy - cy;
                        const dx = Math.sqrt(Math.max(0, cr * cr - dy * dy));
                        return c.cx + c.side * dx;
                    };
                    return (
                        <g key={c.lab}>
                            <line x1={xEdge} y1={y1} x2={join(y1)} y2={y1} stroke={ink} strokeWidth="2"/>
                            <line x1={xEdge} y1={y2} x2={join(y2)} y2={y2} stroke={ink} strokeWidth="2"/>
                            <circle
                                cx={c.cx}
                                cy={cy}
                                r={cr}
                                fill={c.on ? "#f0d27a" : "#efe6d0"}
                                stroke={ink}
                                strokeWidth="2"
                            />
                            <Txt x={c.cx} y={cy + 4} textAnchor="middle" className="sym-tag">
                                {c.lab}
                            </Txt>
                            <Txt x={c.lx} y={y1 - 6} textAnchor={c.anchor} className="term-lab">
                                {c.labs[0]}
                            </Txt>
                            <Txt x={c.lx} y={y2 - 6} textAnchor={c.anchor} className="term-lab">
                                {c.labs[1]}
                            </Txt>
                        </g>
                    );
                })}
                {([
                    {id: "13", x: 2, lab: "13"},
                    {id: "14", x: 3, lab: "14"},
                    {id: "21", x: 4, lab: "21"},
                    {id: "22", x: 5, lab: "22"},
                    {id: "13R", x: 7, lab: "13"},
                    {id: "14R", x: 8, lab: "14"},
                    {id: "21R", x: 9, lab: "21"},
                    {id: "22R", x: 10, lab: "22"},
                ]).map((p) => (
                    <g key={p.id}>
                        <line
                            x1={p.x * GRID}
                            y1={9.1 * GRID}
                            x2={p.x * GRID}
                            y2={11 * GRID}
                            stroke={ink}
                            strokeWidth="2"
                        />
                        <Txt x={p.x * GRID + 7} y={9.5 * GRID} className="term-lab">
                            {p.lab}
                        </Txt>
                    </g>
                ))}
                <Tag x={6} y={18} text={device.tag}/>
            </S>
        );
    }
    if (kind.startsWith("starter")) {
        return (
            <S w={w} h={h}>
                <rect x="1" y="1" width={w * GRID - 2} height={h * GRID - 2} fill="#efe6d0" stroke={ink}
                      strokeWidth="2"/>
                {poles(w, h * 0.7, 3, hot || Boolean(rt?.energizedAlt))}
                <Txt x={(w * GRID) / 2} y={h * GRID - 16} textAnchor="middle" className="sym-tag">
                    {device.tag}
                </Txt>
            </S>
        );
    }
    if (kind === "selector-2") {
        const pos = rt?.position ?? 0;
        const y1 = 1.5 * GRID;
        const y2 = 3.5 * GRID;
        const xL = 0.9 * GRID;
        const xR = w * GRID - 0.9 * GRID;
        const cx = (w * GRID) / 2;
        const cr = 5.5;
        const shaftTop = y1 - 16;
        const row = (y: number, closed: boolean) => (
            <>
                <line x1={0} y1={y} x2={xL - cr} y2={y} stroke={ink} strokeWidth="2"/>
                <line x1={xR + cr} y1={y} x2={w * GRID} y2={y} stroke={ink} strokeWidth="2"/>
                <circle cx={xL} cy={y} r={cr} fill="#efe6d0" stroke={ink} strokeWidth="2"/>
                <circle cx={xR} cy={y} r={cr} fill="#efe6d0" stroke={ink} strokeWidth="2"/>
                {closed ? (
                    <line x1={xL + cr} y1={y} x2={xR - cr} y2={y} stroke={ink} strokeWidth="2"/>
                ) : (
                    <line
                        x1={xL + cr + 6}
                        y1={y}
                        x2={xR - cr - 6}
                        y2={y}
                        stroke={ink}
                        strokeWidth="2"
                        strokeDasharray="4 3"
                    />
                )}
            </>
        );
        const arm = (dx: number, dy: number, on: boolean) => (
            <line
                x1={cx}
                y1={shaftTop}
                x2={cx + dx}
                y2={shaftTop + dy}
                stroke={ink}
                strokeWidth="2"
                strokeDasharray={on ? undefined : "4 3"}
                markerEnd={on ? "url(#sa2-arrow)" : undefined}
            />
        );
        return (
            <S w={w} h={h}>
                <defs>
                    <marker id="sa2-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                        <path d="M0,0 L6,3 L0,6 Z" fill={ink}/>
                    </marker>
                </defs>
                {row(y1, pos === 0)}
                {row(y2, pos === 1)}
                <line x1={cx} y1={shaftTop} x2={cx} y2={y2} stroke={ink} strokeWidth="2"/>
                {arm(-14, -12, pos === 0)}
                {arm(14, -12, pos === 1)}
                <Tag x={4} y={h * GRID + 12} text={device.tag}/>
            </S>
        );
    }
    if (kind === "selector-3") {
        const pos = rt?.position ?? 0;
        const y1 = 1.8 * GRID;
        const yM = 3.2 * GRID;
        const y2 = 4.6 * GRID;
        const xL = 0.9 * GRID;
        const xR = w * GRID - 0.9 * GRID;
        const cx = (w * GRID) / 2;
        const cr = 5.5;
        const shaftTop = y1 - 16;
        const row = (y: number, closed: boolean, circles: boolean) => (
            <>
                {circles ? (
                    <>
                        <line x1={0} y1={y} x2={xL - cr} y2={y} stroke={ink} strokeWidth="2"/>
                        <line x1={xR + cr} y1={y} x2={w * GRID} y2={y} stroke={ink} strokeWidth="2"/>
                        <circle cx={xL} cy={y} r={cr} fill="#efe6d0" stroke={ink} strokeWidth="2"/>
                        <circle cx={xR} cy={y} r={cr} fill="#efe6d0" stroke={ink} strokeWidth="2"/>
                    </>
                ) : null}
                {closed ? (
                    <line x1={circles ? xL + cr : 8} y1={y} x2={circles ? xR - cr : w * GRID - 8} y2={y} stroke={ink} strokeWidth="2"/>
                ) : (
                    <line
                        x1={circles ? xL + cr + 6 : 8}
                        y1={y}
                        x2={circles ? xR - cr - 6 : w * GRID - 8}
                        y2={y}
                        stroke={ink}
                        strokeWidth="2"
                        strokeDasharray="4 3"
                    />
                )}
            </>
        );
        const arm = (dx: number, dy: number, on: boolean) => (
            <line
                x1={cx}
                y1={shaftTop}
                x2={cx + dx}
                y2={shaftTop + dy}
                stroke={ink}
                strokeWidth="2"
                strokeDasharray={on ? undefined : "4 3"}
                markerEnd={on ? "url(#sa3-arrow)" : undefined}
            />
        );
        return (
            <S w={w} h={h}>
                <defs>
                    <marker id="sa3-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                        <path d="M0,0 L6,3 L0,6 Z" fill={ink}/>
                    </marker>
                </defs>
                {row(y1, pos === 1, true)}
                {row(yM, false, false)}
                {row(y2, pos === 2, true)}
                <line x1={cx} y1={shaftTop} x2={cx} y2={y2} stroke={ink} strokeWidth="2"/>
                {arm(-14, -10, pos === 1)}
                {arm(0, -16, pos === 0)}
                {arm(14, -10, pos === 2)}
                <Tag x={4} y={h * GRID + 12} text={device.tag}/>
            </S>
        );
    }

    void key;
    void closed;
    return (
        <S w={w} h={h}>
            <rect x="1" y="1" width={w * GRID - 2} height={h * GRID - 2} fill="#efe6d0" stroke={ink} strokeWidth="1.5"/>
            <Tag x={8} y={20} text={device.tag}/>
        </S>
    );
}
