import { t, tOr } from "./i18n";
import { areWiresConnected } from "./geometry";
import { useLab, type LabState } from "./store";

/**
 * Categories of commands in e-lab.
 */
export type CommandCategory = "mode" | "edit" | "view" | "file" | "selection";

/**
 * Context passed to command condition and execution handlers.
 */
export interface CommandContext {
  state: LabState;
  event: KeyboardEvent;
  key: string;
  code: string;
  isCmdOrCtrl: boolean;
  shift: boolean;
  alt: boolean;
  isTyping: boolean;
}

/**
 * Definition of an executable command and its shortcut bindings.
 */
export interface Command {
  id: string;
  category: CommandCategory;
  titleKey?: string;
  description?: string;
  shortcuts: string[];
  allowInInput?: boolean;
  when?: (ctx: CommandContext) => boolean;
  run: (ctx: CommandContext) => boolean | void;
}

/**
 * Checks if the given element is an active editable text field.
 */
export function isTextInputElement(el: HTMLElement | null): boolean {
  if (!el || !el.tagName) return false;
  // If element is detached from DOM, it's not active
  if (typeof el.isConnected === "boolean" && !el.isConnected) return false;

  const tag = el.tagName.toUpperCase();
  if (tag === "TEXTAREA") return true;
  if (el.isContentEditable) return true;
  if (tag === "INPUT") {
    const input = el as HTMLInputElement;
    const type = (input.type || "text").toLowerCase();
    const nonTextTypes = new Set([
      "button",
      "checkbox",
      "radio",
      "submit",
      "reset",
      "range",
      "color",
      "file",
      "image",
    ]);
    return !nonTextTypes.has(type);
  }
  return false;
}

/**
 * Checks if user is currently typing in an active text input element.
 */
export function isTextInputActive(): boolean {
  if (typeof document === "undefined") return false;
  return isTextInputElement(document.activeElement as HTMLElement | null);
}

/**
 * Blurs any active text input, select, or editable element in document.
 */
export function blurActiveInput() {
  if (typeof document === "undefined") return;
  const active = document.activeElement as HTMLElement | null;
  if (!active) return;
  if (
    active.tagName === "INPUT" ||
    active.tagName === "TEXTAREA" ||
    active.tagName === "SELECT" ||
    active.isContentEditable
  ) {
    active.blur();
  }
}

/**
 * Normalizes a raw KeyboardEvent for reliable cross-platform matching.
 */
export function normalizeKeyEvent(e: KeyboardEvent): CommandContext {
  const active = (typeof document !== "undefined" ? document.activeElement : null) as HTMLElement | null;
  const target = (e.target || active) as HTMLElement | null;
  const isTyping = isTextInputElement(target) || isTextInputElement(active);

  return {
    state: useLab.getState(),
    event: e,
    key: (e.key || "").toLowerCase(),
    code: e.code || "",
    isCmdOrCtrl: Boolean(e.metaKey || e.ctrlKey),
    shift: Boolean(e.shiftKey),
    alt: Boolean(e.altKey),
    isTyping,
  };
}

/**
 * Parsed key shortcut pattern for fast and strict matching.
 */
interface ParsedShortcut {
  raw: string;
  requireMod: boolean;
  requireShift: boolean;
  requireAlt: boolean;
  key?: string;
  code?: string;
}

function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.split("+").map((p) => p.trim());
  let requireMod = false;
  let requireShift = false;
  let requireAlt = false;
  let keyOrCode = "";

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const lower = part.toLowerCase();
    if (lower === "mod" || lower === "cmd" || lower === "ctrl" || lower === "command" || lower === "control") {
      requireMod = true;
    } else if (lower === "shift") {
      requireShift = true;
    } else if (lower === "alt" || lower === "option") {
      requireAlt = true;
    } else {
      keyOrCode = part;
    }
  }

  // If part was e.g. "+" itself
  if (!keyOrCode && parts.length > 0 && shortcut.endsWith("++")) {
    keyOrCode = "+";
  }

  const result: ParsedShortcut = {
    raw: shortcut,
    requireMod,
    requireShift,
    requireAlt,
  };

  if (
    keyOrCode.startsWith("Key") ||
    keyOrCode.startsWith("Digit") ||
    keyOrCode.startsWith("Arrow") ||
    keyOrCode.startsWith("Numpad") ||
    keyOrCode === "Space" ||
    keyOrCode === "Escape" ||
    keyOrCode === "Enter" ||
    keyOrCode === "Tab" ||
    keyOrCode === "Backspace" ||
    keyOrCode === "Delete" ||
    keyOrCode === "Del" ||
    keyOrCode === "Equal" ||
    keyOrCode === "Minus" ||
    keyOrCode === "BracketLeft" ||
    keyOrCode === "BracketRight"
  ) {
    result.code = keyOrCode;
    result.key = keyOrCode.toLowerCase();
  } else {
    result.key = keyOrCode.toLowerCase();
  }

  return result;
}

/**
 * Tests if a normalized keyboard context matches a parsed shortcut.
 */
function matchesShortcut(ctx: CommandContext, s: ParsedShortcut): boolean {
  if (ctx.isCmdOrCtrl !== s.requireMod) return false;
  if (ctx.shift !== s.requireShift) return false;
  if (ctx.alt !== s.requireAlt) return false;

  const targetKey = s.key;
  const targetCode = s.code;

  if (targetCode && ctx.code === targetCode) {
    return true;
  }

  if (targetKey) {
    if (ctx.key === targetKey) return true;
    // Handle special key name equivalences
    if (targetKey === "space" && (ctx.key === " " || ctx.code === "Space")) return true;
    if (targetKey === "plus" && (ctx.key === "+" || ctx.key === "=" || ctx.code === "Equal" || ctx.code === "NumpadAdd")) return true;
    if (targetKey === "equal" && (ctx.key === "=" || ctx.key === "+" || ctx.code === "Equal" || ctx.code === "NumpadAdd")) return true;
    if (targetKey === "minus" && (ctx.key === "-" || ctx.key === "_" || ctx.code === "Minus" || ctx.code === "NumpadSubtract")) return true;
    if (targetKey === "underscore" && (ctx.key === "-" || ctx.key === "_" || ctx.code === "Minus" || ctx.code === "NumpadSubtract")) return true;
    if (targetKey === "[" && (ctx.key === "[" || ctx.code === "BracketLeft")) return true;
    if (targetKey === "]" && (ctx.key === "]" || ctx.code === "BracketRight")) return true;
    if (targetKey === "escape" && (ctx.key === "escape" || ctx.code === "Escape")) return true;
    if (targetKey === "enter" && (ctx.key === "enter" || ctx.code === "Enter" || ctx.code === "NumpadEnter")) return true;
    if (targetKey === "tab" && (ctx.key === "tab" || ctx.code === "Tab")) return true;
    if (
      (targetKey === "delete" || targetKey === "del" || targetCode === "Delete" || targetCode === "Del") &&
      (ctx.key === "delete" || ctx.key === "del" || ctx.code === "Delete" || ctx.code === "NumpadDecimal")
    ) {
      return true;
    }
    if (
      (targetKey === "backspace" || targetCode === "Backspace") &&
      (ctx.key === "backspace" || ctx.code === "Backspace")
    ) {
      return true;
    }
    if (targetKey === "0" && (ctx.key === "0" || ctx.code === "Digit0" || ctx.code === "Numpad0")) return true;
    if (targetKey === "1" && (ctx.key === "1" || ctx.code === "Digit1" || ctx.code === "Numpad1")) return true;
    if (targetKey === "2" && (ctx.key === "2" || ctx.code === "Digit2" || ctx.code === "Numpad2")) return true;
    if (targetKey === "9" && (ctx.key === "9" || ctx.code === "Digit9" || ctx.code === "Numpad9")) return true;

    // Standard letters
    if (targetKey.length === 1 && targetKey >= "a" && targetKey <= "z") {
      const expectedCode = `Key${targetKey.toUpperCase()}`;
      if (ctx.code === expectedCode) return true;
      if (ctx.key === targetKey) return true;
    }
  }

  return false;
}

/**
 * Central Command Registry for e-lab.
 */
class CommandRegistry {
  private commands = new Map<string, Command>();
  private parsedShortcuts = new Map<string, ParsedShortcut[]>();

  register(command: Command) {
    this.commands.set(command.id, command);
    this.parsedShortcuts.set(
      command.id,
      command.shortcuts.map((s) => parseShortcut(s))
    );
  }

  unregister(id: string) {
    this.commands.delete(id);
    this.parsedShortcuts.delete(id);
  }

  getCommand(id: string): Command | undefined {
    return this.commands.get(id);
  }

  getAllCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  /**
   * Executes a command by ID. Returns true if executed successfully.
   */
  execute(id: string, customContext?: Partial<CommandContext>): boolean {
    const cmd = this.commands.get(id);
    if (!cmd) return false;

    const dummyEvent = {
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as KeyboardEvent;

    const ctx: CommandContext = {
      state: useLab.getState(),
      event: (customContext?.event || (typeof KeyboardEvent !== "undefined" ? new KeyboardEvent("keydown") : dummyEvent)) as KeyboardEvent,
      key: customContext?.key || "",
      code: customContext?.code || "",
      isCmdOrCtrl: customContext?.isCmdOrCtrl || false,
      shift: customContext?.shift || false,
      alt: customContext?.alt || false,
      isTyping: customContext?.isTyping || false,
      ...customContext,
    };

    if (cmd.when && !cmd.when(ctx)) return false;
    const res = cmd.run(ctx);
    return res !== false;
  }

  /**
   * Dispatches a KeyboardEvent against all registered commands.
   * Returns true if a command handled and prevented the event.
   */
  dispatch(event: KeyboardEvent): boolean {
    const ctx = normalizeKeyEvent(event);

    // Enter in single-line input: blur input to complete text entry
    if (ctx.isTyping && (ctx.key === "enter" || ctx.code === "Enter" || ctx.code === "NumpadEnter")) {
      const target = event.target as HTMLElement | null;
      if (target && target.tagName === "INPUT") {
        target.blur();
        blurActiveInput();
        event.preventDefault();
        return true;
      }
    }

    for (const cmd of this.commands.values()) {
      // If typing in input and command is not allowed while typing, skip
      if (ctx.isTyping && !cmd.allowInInput) {
        continue;
      }

      const parsedList = this.parsedShortcuts.get(cmd.id) || [];
      const isMatched = parsedList.some((s) => matchesShortcut(ctx, s));
      if (!isMatched) continue;

      if (cmd.when && !cmd.when(ctx)) {
        continue;
      }

      event.preventDefault();
      event.stopPropagation();
      const res = cmd.run(ctx);
      if (res !== false) {
        return true;
      }
    }

    return false;
  }
}

export const registry = new CommandRegistry();

// Initialize all core commands
function initCoreCommands() {
  // Mode & Submode Commands
  registry.register({
    id: "mode.wiring",
    category: "mode",
    titleKey: "toolbar.wiring",
    shortcuts: ["KeyW", "w", "Digit2", "2"],
    run: ({ state }) => {
      if (state.mode !== "edit") state.setMode("edit");
      state.setEditSubMode("wiring");
    },
  });

  registry.register({
    id: "mode.editing",
    category: "mode",
    titleKey: "toolbar.editing",
    shortcuts: ["KeyE", "e", "Digit1", "1"],
    run: ({ state }) => {
      if (state.mode !== "edit") state.setMode("edit");
      state.setEditSubMode("editing");
    },
  });

  registry.register({
    id: "mode.toggleSubmode",
    category: "mode",
    shortcuts: ["Tab"],
    run: ({ state }) => {
      if (state.mode !== "edit") state.setMode("edit");
      state.toggleEditSubMode();
    },
  });

  registry.register({
    id: "mode.toggleLayout",
    category: "mode",
    shortcuts: ["KeyL", "l"],
    run: ({ state }) => {
      state.toggleLayoutMode();
    },
  });

  registry.register({
    id: "sim.toggleRun",
    category: "mode",
    shortcuts: ["Space"],
    run: ({ state }) => {
      if (state.mode === "run") {
        state.setRunning(!state.running);
      } else {
        state.setMode("run");
      }
    },
  });

  // History & Clipboard Commands
  registry.register({
    id: "edit.undo",
    category: "edit",
    titleKey: "toolbar.undo",
    shortcuts: ["Mod+KeyZ", "Mod+z"],
    run: ({ state }) => {
      state.undo();
    },
  });

  registry.register({
    id: "edit.redo",
    category: "edit",
    titleKey: "toolbar.redo",
    shortcuts: ["Mod+Shift+KeyZ", "Mod+Shift+z", "Mod+KeyY", "Mod+y"],
    run: ({ state }) => {
      state.redo();
    },
  });

  registry.register({
    id: "edit.cut",
    category: "edit",
    titleKey: "ctx.cut",
    shortcuts: ["Mod+KeyX", "Mod+x"],
    when: ({ state }) => state.mode === "edit",
    run: ({ state }) => {
      state.copySelected();
      state.deleteSelected();
    },
  });

  registry.register({
    id: "edit.copy",
    category: "edit",
    titleKey: "ctx.copy",
    shortcuts: ["Mod+KeyC", "Mod+c"],
    when: ({ state }) => state.mode === "edit",
    run: ({ state }) => {
      state.copySelected();
    },
  });

  registry.register({
    id: "edit.paste",
    category: "edit",
    titleKey: "ctx.paste",
    shortcuts: ["Mod+KeyV", "Mod+v"],
    when: ({ state }) => state.mode === "edit",
    run: ({ state }) => {
      state.pasteClipboard();
    },
  });

  registry.register({
    id: "edit.duplicate",
    category: "edit",
    titleKey: "ctx.duplicate",
    shortcuts: ["Mod+KeyD", "Mod+d"],
    when: ({ state }) => state.mode === "edit",
    run: ({ state }) => {
      state.duplicateSelected();
    },
  });

  registry.register({
    id: "edit.selectAll",
    category: "selection",
    shortcuts: ["Mod+KeyA", "Mod+a"],
    run: ({ state }) => {
      state.selectAll();
    },
  });

  registry.register({
    id: "edit.delete",
    category: "edit",
    titleKey: "toolbar.delete",
    shortcuts: [
      "Delete",
      "Backspace",
      "Del",
      "NumpadDecimal",
      "Mod+Backspace",
      "Mod+Delete",
      "Shift+Delete",
      "Shift+Backspace",
    ],
    when: ({ state }) => state.mode === "edit",
    run: ({ state }) => {
      state.deleteSelected();
    },
  });

  registry.register({
    id: "edit.group",
    category: "selection",
    shortcuts: ["Mod+KeyG", "Mod+g"],
    when: ({ state }) => state.mode === "edit",
    run: ({ state }) => {
      state.groupSelected();
    },
  });

  registry.register({
    id: "edit.ungroup",
    category: "selection",
    shortcuts: ["Mod+Shift+KeyG", "Mod+Shift+g"],
    when: ({ state }) => state.mode === "edit",
    run: ({ state }) => {
      state.ungroupSelected();
    },
  });

  // Rotation & Manipulation Commands
  registry.register({
    id: "edit.rotateCw",
    category: "edit",
    titleKey: "toolbar.rotate",
    shortcuts: ["KeyR", "r"],
    when: ({ state }) => state.mode === "edit",
    run: ({ state }) => {
      if (state.placing) {
        state.rotatePlacing(1);
      } else if (state.selectedWireIds && state.selectedWireIds.length > 0) {
        for (const id of state.selectedWireIds) {
          state.straightenWire(id);
        }
      } else if (state.selected?.type === "wire") {
        state.straightenWire(state.selected.id);
      } else {
        state.rotateSelected(1);
      }
    },
  });

  registry.register({
    id: "edit.rotateCcw",
    category: "edit",
    shortcuts: ["Shift+KeyR", "Shift+r"],
    when: ({ state }) => state.mode === "edit",
    run: ({ state }) => {
      if (state.placing) {
        state.rotatePlacing(-1);
      } else if (state.selectedWireIds && state.selectedWireIds.length > 0) {
        for (const id of state.selectedWireIds) {
          state.straightenWire(id);
        }
      } else if (state.selected?.type === "wire") {
        state.straightenWire(state.selected.id);
      } else {
        state.rotateSelected(-1);
      }
    },
  });

  registry.register({
    id: "edit.mergeWires",
    category: "edit",
    titleKey: "ctx.mergeWires",
    shortcuts: ["Mod+KeyM", "Mod+m", "KeyM", "m"],
    when: ({ state }) =>
      state.mode === "edit" &&
      state.selectedWireIds?.length === 2 &&
      areWiresConnected(state.circuit, state.selectedWireIds[0], state.selectedWireIds[1]),
    run: ({ state }) => {
      state.mergeSelectedWires();
    },
  });

  registry.register({
    id: "edit.flipH",
    category: "edit",
    titleKey: "toolbar.flipH",
    shortcuts: ["KeyH", "h"],
    when: ({ state }) => state.mode === "edit",
    run: ({ state }) => {
      if (state.placing) {
        state.flipPlacing?.("h");
      } else {
        state.flipSelected("h");
      }
    },
  });

  registry.register({
    id: "edit.flipV",
    category: "edit",
    titleKey: "toolbar.flipV",
    shortcuts: ["KeyV", "v"],
    when: ({ state }) => state.mode === "edit",
    run: ({ state }) => {
      if (state.placing) {
        state.flipPlacing?.("v");
      } else {
        state.flipSelected("v");
      }
    },
  });

  registry.register({
    id: "edit.snap",
    category: "edit",
    titleKey: "ctx.snapToGrid",
    shortcuts: ["KeyS", "s"],
    when: ({ state }) => state.mode === "edit",
    run: ({ state }) => {
      state.snapSelected();
    },
  });

  registry.register({
    id: "edit.autoLayout",
    category: "edit",
    titleKey: "toolbar.autoLayout",
    shortcuts: ["Shift+KeyL", "Shift+l", "Mod+Shift+KeyL", "Mod+Shift+l"],
    when: ({ state }) => state.mode === "edit",
    run: ({ state }) => {
      state.autoLayout();
    },
  });

  // Nudge Selection Commands
  registry.register({
    id: "edit.nudgeLeft",
    category: "selection",
    shortcuts: ["ArrowLeft", "Shift+ArrowLeft"],
    when: ({ state }) => state.mode === "edit",
    run: ({ state, shift }) => {
      state.nudgeSelected(shift ? -5 : -1, 0);
    },
  });

  registry.register({
    id: "edit.nudgeRight",
    category: "selection",
    shortcuts: ["ArrowRight", "Shift+ArrowRight"],
    when: ({ state }) => state.mode === "edit",
    run: ({ state, shift }) => {
      state.nudgeSelected(shift ? 5 : 1, 0);
    },
  });

  registry.register({
    id: "edit.nudgeUp",
    category: "selection",
    shortcuts: ["ArrowUp", "Shift+ArrowUp"],
    when: ({ state }) => state.mode === "edit",
    run: ({ state, shift }) => {
      state.nudgeSelected(0, shift ? -5 : -1);
    },
  });

  registry.register({
    id: "edit.nudgeDown",
    category: "selection",
    shortcuts: ["ArrowDown", "Shift+ArrowDown"],
    when: ({ state }) => state.mode === "edit",
    run: ({ state, shift }) => {
      state.nudgeSelected(0, shift ? 5 : 1);
    },
  });

  // Zoom & View Commands
  registry.register({
    id: "view.zoomIn",
    category: "view",
    shortcuts: [
      "Mod+Equal",
      "Mod+=",
      "Mod+Plus",
      "Mod++",
      "Mod+Shift+Equal",
      "Mod+Shift+=",
      "Mod+Shift+Plus",
      "Mod+Shift++",
      "Equal",
      "=",
      "Plus",
      "+",
      "Shift+Equal",
      "Shift+=",
      "Shift+Plus",
      "Shift++",
    ],
    run: ({ state }) => {
      state.zoomIn();
    },
  });

  registry.register({
    id: "view.zoomOut",
    category: "view",
    shortcuts: ["Mod+Minus", "Mod+-", "Mod+Underscore", "Mod+_", "Minus", "-", "Underscore", "_"],
    run: ({ state }) => {
      state.zoomOut();
    },
  });

  registry.register({
    id: "view.zoomReset",
    category: "view",
    shortcuts: ["Mod+Digit0", "Mod+0", "Digit0", "0"],
    run: ({ state }) => {
      state.resetZoom();
    },
  });

  registry.register({
    id: "view.zoomFit",
    category: "view",
    shortcuts: ["Mod+Digit9", "Mod+9", "Digit9", "9"],
    run: ({ state }) => {
      state.zoomFit();
    },
  });

  registry.register({
    id: "view.togglePalette",
    category: "view",
    shortcuts: ["BracketLeft", "[", "Mod+BracketLeft", "Mod+["],
    run: ({ state }) => {
      state.togglePalette();
    },
  });

  registry.register({
    id: "view.toggleSide",
    category: "view",
    shortcuts: ["BracketRight", "]", "Mod+BracketRight", "Mod+]"],
    run: ({ state }) => {
      state.toggleSide();
    },
  });

  // File & Export Commands
  registry.register({
    id: "file.save",
    category: "file",
    titleKey: "file.saveDraft",
    shortcuts: ["Mod+KeyS", "Mod+s"],
    allowInInput: true,
    run: ({ state }) => {
      state.persistDraft();
      state.setNotice(t("notice.savedDoc", { title: state.docName || tOr("doc.untitled", "Untitled") }));
    },
  });

  registry.register({
    id: "file.print",
    category: "file",
    titleKey: "file.print",
    shortcuts: ["Mod+KeyP", "Mod+p"],
    allowInInput: true,
    run: ({ state }) => {
      state.openPrint();
    },
  });

  // Multi-tier Escape Hierarchy Command
  registry.register({
    id: "global.escape",
    category: "mode",
    shortcuts: ["Escape"],
    allowInInput: true,
    run: ({ state, isTyping, event }) => {
      if (isTyping) {
        (event.target as HTMLElement)?.blur?.();
        blurActiveInput();
        return;
      }
      if (state.placing) {
        state.setPlacing(null);
      } else if (state.wiringFrom) {
        useLab.setState({ wiringFrom: null, hoverPort: null });
      } else if (state.selected || state.selectedIds.length) {
        state.select(null);
      } else if (state.mode === "run") {
        state.setMode("edit");
      }
    },
  });
}

// Initialize on module load
initCoreCommands();

/**
 * Handles global keydown events via Command Registry.
 */
export function handleGlobalKeyDown(e: KeyboardEvent): boolean {
  return registry.dispatch(e);
}

/**
 * Executes a registered command by its ID.
 */
export function executeCommand(id: string, customContext?: Partial<CommandContext>): boolean {
  return registry.execute(id, customContext);
}

/**
 * Retrieves all registered commands.
 */
export function getRegisteredCommands(): Command[] {
  return registry.getAllCommands();
}

/**
 * Initializes global keyboard and pointer listeners to ensure shortcuts work reliably everywhere.
 */
export function setupKeyboardShortcuts(): () => void {
  if (typeof window === "undefined") return () => {};

  const onKeyDown = (e: KeyboardEvent) => {
    handleGlobalKeyDown(e);
  };

  const onPointerDown = (e: PointerEvent | MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    // If clicking outside an active text input or select, ensure active input loses focus immediately
    if (!isTextInputElement(target) && target.tagName !== "SELECT") {
      blurActiveInput();
    }
  };

  window.addEventListener("keydown", onKeyDown, { capture: true });
  window.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });

  return () => {
    window.removeEventListener("keydown", onKeyDown, { capture: true });
    window.removeEventListener("pointerdown", onPointerDown, { capture: true });
  };
}
