# Sidebar Collapse Feature - Detailed Design Document

## Overview
Add expand/collapse functionality to both left (Palette) and right (Side/Bench/Inspector) panels in the E-LAB application.

---

## Current State Analysis

### Panel Structure
```
┌─────────────┬──────────────────┬──────────────┐
│   Palette   │     Schematic    │     Side     │
│  (Left)     │       Area       │ (Right)      │
│  250px      │                  │  300px       │
└─────────────┴──────────────────┴──────────────┘
```

**Current CSS Grid Layout:**
```css
.workspace {
  display: grid;
  grid-template-columns: 250px 1fr 300px; /* Fixed widths */
}

.palette, .side {
  background: linear-gradient(...);
  border-right/left: 1px solid #10150d;
  overflow: auto;
  padding: 10px;
}
```

### Components Involved
- **Palette.tsx**: Left panel with component library
- **Bench.tsx**: Right-side bench controls
- **ProcessRack.tsx**: Process variables rack  
- **Inspector.tsx**: Component properties inspector

---

## Design Requirements

### User Experience Goals
1. ✅ Users can collapse either or both side panels independently
2. ✅ Collapsed state is persisted across sessions (localStorage)
3. ✅ Visual indicator shows collapsed state clearly
4. ✅ Quick toggle via keyboard shortcut
5. ✅ Smooth animation when expanding/collapsing
6. ✅ Works on mobile devices (optional)

### Technical Constraints
1. Minimal code changes to existing components
2. No breaking changes to current layout logic
3. Maintain accessibility (keyboard navigation still works)
4. Responsive behavior for different screen sizes

---

## Proposed Implementation Plan

### Phase 1: Core UI Changes

#### 1. Add Toggle Button Component
Create a new reusable `TogglePanelButton` component:

**File:** `src/ui/TogglePanelButton.tsx`
```tsx
interface TogglePanelButtonProps {
  direction: 'left' | 'right';
  isOpen: boolean;
  onClick: () => void;
  label?: string;
}

export function TogglePanelButton({ 
  direction, 
  isOpen, 
  onClick,
  label = '' 
}: TogglePanelButtonProps) {
  return (
    <button
      className={`toggle-panel-btn ${direction}`}
      title={label || (isOpen ? 'Collapse panel' : 'Expand panel')}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      {direction === 'left' 
        ? (isOpen ? '«' : '»') 
        : (isOpen ? '»' : '«')
      }
    </button>
  );
}
```

#### 2. Update Palette Component
Add toggle button and manage open/close state.

**Changes in `src/ui/Palette.tsx`:**
- Import Zustand store hook
- Add local state: `const [isOpen, setIsOpen] = useState(true)`
- Load saved state from localStorage on mount
- Save state to localStorage on change
- Wrap content in conditional render based on `isOpen`
- Add toggle button at top of palette

#### 3. Update Side Container
Group Bench/ProcessRack/Inspector together with single toggle.

**Option A - Single Toggle for All Right Panels:**
```
┌────┬───────────┐
│ « │   Schematic│
└────┴───────────┘
     ┌───────────┐
     │  Bench    │
     ├───────────┤
     │ Process   │
     │ Rack      │
     ├───────────┤
     │ Inspector │
     └───────────┘
```

**Option B - Individual Toggles per Panel:**
Each panel has its own collapse control.

*Recommendation:* **Option A** is simpler and more user-friendly since these panels work as a unit.

#### 4. CSS Updates
Update styles to support variable width panels:

```css
.workspace {
  display: grid;
  /* Default widths */
  grid-template-columns: var(--palette-width, 250px) 1fr var(--side-width, 300px);
}

.palette.collapsed,
.side.collapsed {
  flex: 0 0 auto; /* Don't grow/shrink */
  overflow: hidden;
}

/* Collapsed states */
.palette.collapsed .collapsible-content,
.side.collapsed .collapsible-content {
  display: none;
}

.toggle-panel-btn {
  position: absolute;
  z-index: 100;
  background: #2a3223;
  border: 1px solid #3d4634;
  color: #ece6d2;
  font-size: 18px;
  line-height: 1;
  padding: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-panel-btn.left {
  right: -20px;
  top: 10px;
}

.toggle-panel-btn.right {
  left: -20px;
  top: 10px;
}

.toggle-panel-btn:hover {
  background: #3d4634;
}
```

### Phase 2: State Management

#### Store Integration (Optional Enhancement)
Add to existing `useLab` store or create separate settings slice:

```typescript
// In src/store.ts or new src/settingsStore.ts
interface SidebarSettings {
  paletteOpen: boolean;
  sideOpen: boolean;
}

const defaultSidebarState = {
  paletteOpen: true,
  sideOpen: true,
};
```

**Benefits of using Zustand:**
- Centralized state management
- Automatic persistence via middleware
- React context not needed
- DevTools integration possible

### Phase 3: Keyboard Shortcuts

Implement shortcuts for power users:
- `Ctrl/Cmd + [` : Toggle Palette (left sidebar)
- `Ctrl/Cmd + ]` : Toggle Side (right sidebar)

---

## Implementation Steps

### Step-by-step Execution Plan

1. **Create TogglePanelButton component** (`src/ui/TogglePanelButton.tsx`)
   - Simple button with «/» icons
   - Direction-aware styling
   
2. **Update Palette.tsx**
   ```tsx
   import { useState, useEffect } from 'react';
   
   export function Palette() {
     const [isOpen, setIsOpen] = useState(true);
     
     // Load saved preference on mount
     useEffect(() => {
       const saved = localStorage.getItem('elab.sidebar.paletteOpen');
       if (saved !== null) setIsOpen(saved === 'true');
     }, []);
     
     // Save when changed
     useEffect(() => {
       localStorage.setItem('elab.sidebar.paletteOpen', String(isOpen));
     }, [isOpen]);
     
     return (
       <aside className={`palette ${!isOpen ? 'collapsed' : ''}`}>
         <TogglePanelButton 
           direction="left" 
           isOpen={isOpen} 
           onClick={() => setIsOpen(!isOpen)} 
         />
         
         {!isOpen && <div className="collapsible-content">...</div>}
       </aside>
     );
   }
   ```

3. **Wrap Existing Content in Collapsible Container**
   - Add `.collapsible-content` class wrapper around main content
   - This allows smooth CSS transitions later if desired
   
4. **Update Right Panel Structure**
   - Create a container `<SidePanels />` component
   - Or modify current structure directly in App.tsx
   
5. **CSS Updates**
   - Update `.workspace` grid template variables
   - Add collapsed states and toggle buttons styles
   - Ensure proper z-index layering
   
6. **Keyboard Shortcuts**
   - Add event listeners in App.tsx or effect hooks
   - Map `[` and `]` keys to toggle functions
   
7. **Testing & Verification**
   - Test expand/collapse functionality
   - Verify state persists across page reloads
   - Check responsive behavior at different screen sizes
   - Confirm keyboard navigation still works

---

## Alternative Approaches Considered

### Approach A: Drawer Pattern (Recommended)
```
[« Button] → Slide out panel
[» Button] → Hide panel completely
```
**Pros:** Smooth animations, familiar UX pattern  
**Cons:** More complex implementation

### Approach B: Tabbed Interface
Keep panels but switch via tabs instead of full collapse.
**Pros:** Always accessible without expanding  
**Cons:** Changes user workflow significantly

### Approach C: Floating Panels
Make panels draggable/floating windows.
**Pros:** Maximum flexibility  
**Cons:** Too complex for this project scope

*Decision:* Stick with simple collapsible approach as it meets requirements while being maintainable.

---

## Mobile Responsiveness Considerations

For future mobile support:
```css
@media (max-width: 768px) {
  .workspace {
    grid-template-columns: auto;
  }
  
  .palette,
  .side {
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 100vh;
    width: 250px !important;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }
  
  .palette.open { transform: translateX(0); }
}
```

This can be implemented separately from desktop version.

---

## Testing Checklist

- [ ] Palette collapses/expands correctly
- [ ] Side panels group collapses/expands correctly
- [ ] State persists after refresh
- [ ] Toggle button is visible on hover/always-on
- [ ] No layout shifts when toggling
- [ ] Keyboard shortcuts work (`Ctrl+[`, `Ctrl+]`)
- [ ] All existing features remain functional
- [ ] Works in both English and Chinese languages
- [ ] Touch-friendly on tablets

---

## Estimated Effort

| Task | Time Estimate |
|------|---------------|
| Create TogglePanelButton component | ~15 min |
| Update Palette.tsx | ~20 min |
| Update Right Panel structure | ~20 min |
| CSS updates | ~30 min |
| Store integration (optional) | ~15 min |
| Keyboard shortcuts | ~10 min |
| Testing & bug fixes | ~30 min |

**Total: ~2 hours**

---

## Rollout Strategy

1. **Branch:** Continue working on `dev` branch
2. **Commit strategy:** Multiple small commits per feature phase
   - Commit 1: Add toggle button component
   - Commit 2: Implement palette collapse logic
   - Commit 3: Implement side panel collapse
   - Commit 4: Add keyboard shortcuts
   - Commit 5: Polish styles and testing

3. **PR Review:** Request review before merging to main
4. **Deployment:** Push to GitHub Pages for live testing
