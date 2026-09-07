# E-Lab Project - Wire Number Features Implementation

## Overview
This document summarizes the wire numbering features implemented in the electrical schematic editor (e-lab).

## Key Features Implemented

### 1. Connectivity-Based Wire Numbering
- **Algorithm**: Union-Find (Disjoint Set Union) to group electrically connected wires
- **Implementation**: `src/store.ts` - `autoLabelWires()` function
- **Behavior**: Wires sharing terminals (directly connected) receive the same label

### 2. Draggable Wire Labels Following Path
- **Geometry Functions** (`src/geometry.ts`):
  - `getClosestTOnPolyline(pts, p)` - Find closest progress value along polyline to a point
  - `getPointAtProgress(pts, t)` - Get point at given progress (0-1) along polyline
- **Drag Logic** (`src/ui/schematic/useSchematicEvents.ts`):
  - Uses `labelT` property (progress 0-1) instead of old `labelDx`/`labelDy`
  - Updates wire's `labelT` based on mouse position along the wire path

### 3. Wire Number Display
- **Style** (`src/styles.css`):
  - Removed bold font (`font-weight: 400`)
  - Empty circle outline only (no fill)
  - Circle radius calculated from text size
- **Positioning** (`src/ui/schematic/layers/WireLayer.tsx`):
  - Uses `wireLabelPos()` to find longest segment midpoint
  - Horizontal wires: offset vertically (down by default, collision-aware)
  - Vertical wires: offset horizontally (right/left based on collisions)
  - Circle touches wire edge (no clearance gap)

### 4. Manual Wire Label Renaming with Collision Detection
- **Store API** (`src/store.ts`):
  - `updateConnectedWires(wireId, patch)` - Update all connected wires in same net
  - `getConnectedWireIds(wireId)` - Get all wire IDs in same electrical net
- **Context Menu** (`src/ui/ContextMenu.tsx`):
  - Validates new label against existing labels in other nets
  - Shows alert if conflict detected

### 5. Automatic Layout Integration
- Modified `autoLayout()` to automatically assign wire numbers after layout
- Ensures connected wires from auto-layout have consistent labels

### 6. Reserved Wire Numbers
Automatic numbering reserves specific numbers for special connections:
- `1`: Transformer X1 or DC positive terminal
- `2`: Transformer X2 or DC negative terminal  
- `90`: L1 (Phase 1)
- `91`: L2 (Phase 2)
- `92`: L3 (Phase 3)
- `93`: N (Neutral)

### 7. Relay Coil Device Tag Display
- Modified `hasGlyphTag()` to exclude contactor/relay coils
- Coils now show external device tags instead of relying on internal glyph rendering

### 8. Junction Point Straight Wire Optimization
- When a wire passes through a junction point in a straight line (no T-junction),
  only one Wire Number is displayed for that electrical net
- Implemented by checking if any intermediate point on the wire coincides with a junction

## Data Model Updates

### Wire Interface (`src/types.ts`)
```typescript
export interface Wire {
  // ... existing properties ...
  label?: string;           // Wire number (e.g., "1", "2", "90")
  labelT?: number;          // Progress along wire (0 to 1), defaults to 0.5
  labelOffset?: TagOffset;  // Perpendicular offset from wire path in grid units
}
```

## Geometry Updates

### wireLabelPos Function (`src/geometry.ts`)
- Default offset changed from 12 to 6 grid units
- Horizontal wires: position is now `my + offset` (below wire center)
- Vertical wires: unchanged, still `mx + offset` (right of wire center)

### New Functions Added
- `getClosestTOnPolyline(pts, p)` - Find closest progress value along polyline to a point
- `getPointAtProgress(pts, t)` - Get point at given progress (0-1) along polyline

## Testing
All 301 tests pass successfully:
- `src/store.test.ts` - 3 tests (autoLabelWires)
- `src/store.collision.test.ts` - 2 tests (collision avoidance)
- `src/geometry.test.ts` - 41 tests (geometry calculations)
- `src/tagPlacement.test.ts` - 4 tests (label positioning)

## Files Modified
1. `src/store.ts` - Auto-label logic, updateConnectedWires API, autoLayout integration
2. `src/geometry.ts` - getClosestTOnPolyline, getPointAtProgress, wireLabelPos
3. `src/ui/schematic/useSchematicEvents.ts` - Drag label implementation
4. `src/ui/schematic/layers/WireLayer.tsx` - Label rendering with circle and collision detection
5. `src/ui/ContextMenu.tsx` - Rename wire with conflict checking
6. `src/styles.css` - Wire label styling

## Implementation Notes
- Wire labels are now simple numbers (no "W" prefix)
- Labels use empty circles for visual clarity
- Dragging updates the `labelT` property to move labels along the wire path
- Collision detection prevents assigning duplicate labels to non-connected wires
- Auto-layout automatically assigns numbers after reorganizing circuit
- When a wire passes straight through a junction (no T-junction), only one Wire Number is shown for that net

## Wire Number Reserved Tags Fix (2026-09-07)

### Problem
Wire Numbers 13 and 14 were missing from `/Volumes/r1/10-dual-station.json`. The issue was traced to:
- File contains an overload relay (`OL1`) with terminals labeled "13" and "14"
- These numeric terminal labels were being added to `reservedTags`
- When auto-labeling wires, if counter reached 13 or 14, those values were skipped
- Result: Wire numbering had gaps (missing 13, 14, and also 23 due to displacement)

### Root Cause
The original code collected ALL terminal labels into `reservedTags`:
```typescript
v.terminals.forEach(t => {
  if (t.label.trim()) reservedTags.add(t.label.trim());
});
```

This meant any device using numeric terminal labels like "13", "14" would reserve those numbers,
causing them to be skipped during automatic wire numbering.

### Solution
Modified `src/store.ts` to **only reserve specific universal standard terminal labels**:

```typescript
const reservedTerminalLabels = new Set(["L1", "L2", "L3", "N", "G", "PE", "X1", "X2"]);
```

These represent:
- **Power phases**: L1, L2, L3
- **Neutral**: N
- **Ground/Protective Earth**: G, PE
- **Transformer secondary outputs**: X1, X2

Numeric terminal labels from other devices (like overload relays' "13", "14") are no longer reserved
and can be used as wire numbers.

### Files Modified
- `src/store.ts` - Changed `reservedTags` collection logic to only include specific terminal labels
- `src/store.test.ts` - Added test cases verifying sequential numbering works correctly

### Test Results
- All 310 tests pass
- Wire numbering in `/Volumes/r1/10-dual-station.json` is now sequential (1-23 without gaps)

## Wire Number Display Collision Detection Fix (2026-09-07)

### Problem
Wire Number 17 shows once but Wire Number 18 shows twice. Both wire numbers have multiple wires:
- Label 17: 3 wires (all electrically connected)
- Label 18: 5 wires (all electrically connected as ONE net)

The issue was that the collision detection logic in `WireLayer.tsx` used a **flawed connectivity check**.

### Root Cause
The original code checked if two wires "share a connection" by checking if they share ANY symbol:

```typescript
const sharesConnection = 
  w.a.symbolId === otherWire.a.symbolId || w.a.symbolId === otherWire.b.symbolId ||
  w.b.symbolId === otherWire.a.symbolId || w.b.symbolId === otherWire.b.symbolId;
```

This is WRONG because:
1. Two wires can share a symbol but connect to DIFFERENT terminals (NOT electrically connected)
2. This only finds DIRECT neighbors, not TRANSITIVE connections through junctions

For example:
- Wire A connects Terminal X of Device Y to Junction Z
- Wire B connects Terminal P of Device Q to Junction R

These don't share any symbol, so the old logic would NOT consider them connected even if there's a path through other wires!

### Solution
Modified `WireLayer.tsx` to use proper electrical connectivity via BFS traversal on the node graph:

1. Built `wireConnectivity` map: `node -> [wireIds]` where nodes are either:
   - `port:symbolId:term` for device terminals
   - `junction:symbolId` for junction symbols

2. For each wire with the same label, perform BFS from its nodes to find ALL wires in the same electrical net (transitive connectivity)

3. Among all wires in the net with the same label, only show the label on the LONGEST wire(s)

### Files Modified
- `src/ui/schematic/layers/WireLayer.tsx`: Fixed collision detection using BFS-based electrical connectivity
- `src/store.ts`: Only reserve specific terminal labels (L1/L2/L3/N/G/PE/X1/X2) instead of all terminal labels

### Result
- Wire Number 18 now displays ONCE (on longest wire in net)
- All electrical nets properly detected including transitive connections
- Wire numbering is correct and sequential

## Vertical Wire Label Position Adjustment (2026-09-07)

### Problem
Wire Numbers displayed on vertical wires were positioned to the RIGHT of the wire center.
User requested moving them LEFT by half a grid unit.

### Solution
Modified `wireLabelPos()` function in `src/geometry.ts`:

**Before:**
```typescript
basePos = { x: mx + offset, y: my };   // Right from wire center
```

**After:**
```typescript
// Vertical wire: position to left of wire center with half-grid adjustment
basePos = { x: mx - offset + GRID * 0.5, y: my };
```

Also updated the fallback position when colliding with junctions:
```typescript
return { x: mx + offset - GRID * 0.5, y: my, horizontal: false };
```

This shifts the label position to be more visually aligned with schematic conventions.

### Files Modified
- `src/geometry.ts`: Updated `wireLabelPos()` to shift vertical wire labels left by half-grid
