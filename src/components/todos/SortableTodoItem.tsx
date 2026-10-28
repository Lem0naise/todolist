import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TodoItem } from "./TodoItem";
import type { Todo } from "./utils";

export function SortableTodoItem(props: {
  todo: Todo;
  onOpen: () => void;
  onToggleDone: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isCatchup?: boolean;
  isFocus?: boolean;
  onToggleFocus?: () => void;
  onSnooze?: (until?: string) => void;
  onStartPomo?: () => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: props.todo._id,
    disabled: props.todo.completed || props.isCatchup || props.selectable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TodoItem
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
