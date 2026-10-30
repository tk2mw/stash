// File Tree from Magic UI (dillionverma), adapted for stash: Base UI Accordion instead of Radix, our icons and cx
// (no lucide, ScrollArea or Button dependencies). Added: `onSelect` reports clicks (folders open, files select),
// `element` can be any node and `triggerProps` reach the folder row (drop targets). Left out: the data-driven
// `elements`/sorting and CollapseButton, since stash builds the tree from its own folders.
import { createContext, forwardRef, useCallback, useContext, useEffect, useState, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { Accordion } from "@base-ui/react/accordion";
import { FileIcon, FolderIcon, FolderOpenIcon } from "./icons";
import { cx } from "./cx";

type TreeContextProps = {
  selectedId: string | undefined;
  expandedItems: string[];
  indicator: boolean;
  handleExpand: (id: string) => void;
  selectItem: (id: string) => void;
  openIcon?: ReactNode;
  closeIcon?: ReactNode;
};

const TreeContext = createContext<TreeContextProps | null>(null);

const useTree = () => {
  const context = useContext(TreeContext);
  if (!context) throw new Error("useTree must be used within a Tree");
  return context;
};

const mergeExpandedItems = (current: string[], next: string[]) => [...new Set([...current, ...next])];

type TreeProps = {
  selectedId?: string;
  initialExpandedItems?: string[];
  onSelect?: (id: string) => void;
  indicator?: boolean;
  openIcon?: ReactNode;
  closeIcon?: ReactNode;
  className?: string;
  children: ReactNode;
};

export const Tree = forwardRef<HTMLDivElement, TreeProps>(({ className, selectedId, initialExpandedItems = [], onSelect, indicator = true, openIcon, closeIcon, children }, ref) => {
  const [expandedItems, setExpandedItems] = useState<string[]>(initialExpandedItems);

  const selectItem = useCallback((id: string) => onSelect?.(id), [onSelect]);
  const handleExpand = useCallback((id: string) => setExpandedItems((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id])), []);

  // a folder picked from elsewhere opens its parents (the original does this for `initialSelectedId`)
  const opened = initialExpandedItems.join();
  useEffect(() => {
    setExpandedItems((prev) => mergeExpandedItems(prev, initialExpandedItems));
  }, [opened]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TreeContext.Provider value={{ selectedId, expandedItems, handleExpand, selectItem, indicator, openIcon, closeIcon }}>
      <div ref={ref} className={cx("relative overflow-y-auto px-1", className)}>
        <Accordion.Root multiple value={expandedItems} className="flex flex-col gap-0.5">
          {children}
        </Accordion.Root>
      </div>
    </TreeContext.Provider>
  );
});
Tree.displayName = "Tree";

const TreeIndicator = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cx("absolute left-[1.0625rem] h-full w-px rounded-md bg-line transition-colors duration-300 hover:bg-line-strong", className)} {...props} />
));
TreeIndicator.displayName = "TreeIndicator";

type FolderProps = {
  value: string;
  element: ReactNode;
  isSelectable?: boolean;
  isSelect?: boolean;
  className?: string;
  triggerProps?: HTMLAttributes<HTMLButtonElement>;
  children?: ReactNode;
};

export const Folder = forwardRef<HTMLDivElement, FolderProps>(({ className, element, value, isSelectable = true, isSelect, triggerProps, children }, ref) => {
  const { handleExpand, expandedItems, indicator, selectedId, selectItem, openIcon, closeIcon } = useTree();
  const isSelected = isSelect ?? selectedId === value;
  const open = expandedItems.includes(value);
  return (
    <Accordion.Item ref={ref} value={value} className="relative">
      <Accordion.Header className="m-0">
        <Accordion.Trigger
          {...triggerProps}
          disabled={!isSelectable}
          onClick={() => {
            selectItem(value);
            handleExpand(value);
          }}
          className={cx(
            "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-base transition-colors duration-200",
            isSelected && isSelectable ? "bg-surface-3 text-fg" : "text-fg/85 hover:bg-surface-2",
            isSelectable ? "cursor-pointer" : "cursor-not-allowed opacity-50",
            className,
            triggerProps?.className,
          )}
        >
          {open ? (openIcon ?? <FolderOpenIcon size="1rem" className="shrink-0" />) : (closeIcon ?? <FolderIcon size="1rem" className="shrink-0" />)}
          {element}
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel className="relative h-[var(--accordion-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0">
        {indicator && <TreeIndicator aria-hidden />}
        <Accordion.Root multiple value={expandedItems} className="ml-6 flex flex-col gap-0.5 py-0.5">
          {children}
        </Accordion.Root>
      </Accordion.Panel>
    </Accordion.Item>
  );
});
Folder.displayName = "Folder";

type FileProps = { value: string; isSelectable?: boolean; isSelect?: boolean; fileIcon?: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>;

export const File = forwardRef<HTMLButtonElement, FileProps>(({ value, className, onClick, isSelectable = true, isSelect, fileIcon, children, ...props }, ref) => {
  const { selectedId, selectItem } = useTree();
  const isSelected = isSelect ?? selectedId === value;
  return (
    <button
      ref={ref}
      type="button"
      disabled={!isSelectable}
      className={cx(
        "flex h-7 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm duration-200 ease-in-out",
        isSelected && isSelectable ? "bg-surface-3 text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
        isSelectable ? "cursor-pointer" : "cursor-not-allowed opacity-50",
        className,
      )}
      onClick={(event) => {
        selectItem(value);
        onClick?.(event);
      }}
      {...props}
    >
      {fileIcon ?? <FileIcon size="0.95rem" className="shrink-0" />}
      {children}
    </button>
  );
});
File.displayName = "File";
