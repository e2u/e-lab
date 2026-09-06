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
