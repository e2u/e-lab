interface TogglePanelButtonProps {
  direction: 'left' | 'right';
  isOpen: boolean;
  onClick: () => void;
}

export function TogglePanelButton({ 
  direction, 
  isOpen, 
  onClick 
}: TogglePanelButtonProps) {
  return (
    <button
      className={`toggle-panel-btn ${direction}`}
      title={isOpen ? (direction === 'left' ? 'Collapse left panel' : 'Collapse right panel') : (direction === 'left' ? 'Expand left panel' : 'Expand right panel')}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      {direction === 'left' 
        ? (isOpen ? '«' : '»') 
        : (isOpen ? '»' : '«')
      }
    </button>
  );
}
