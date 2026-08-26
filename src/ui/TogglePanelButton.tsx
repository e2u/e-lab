import { t } from "../i18n";

interface TogglePanelButtonProps {
  direction: "left" | "right";
  isOpen: boolean;
  onClick: () => void;
}

export function TogglePanelButton({ direction, isOpen, onClick }: TogglePanelButtonProps) {
  const title =
    direction === "left"
      ? isOpen
        ? t("toolbar.collapseLeft")
        : t("toolbar.expandLeft")
      : isOpen
        ? t("toolbar.collapseRight")
        : t("toolbar.expandRight");

  const icon =
    direction === "left"
      ? isOpen
        ? "◀"
        : "▶"
      : isOpen
        ? "▶"
        : "◀";

  return (
    <button
      type="button"
      className={`panel-toggle ${direction} ${isOpen ? "open" : "collapsed"}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      aria-label={title}
    >
      {icon}
    </button>
  );
}
