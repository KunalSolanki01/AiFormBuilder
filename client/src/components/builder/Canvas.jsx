import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FIELD_TYPE_META, FILE_UPLOAD, allowedExtensions } from '@afb/shared';
import { Copy, GripVertical, Trash2 } from 'lucide-react';
import { Button, cn } from '../ui/index.jsx';

function SortableField({ field, index, selected, onSelect, onDuplicate, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group relative rounded-lg border bg-white p-4 transition-colors',
        selected ? 'border-brand-600 ring-1 ring-brand-600' : 'border-slate-200 hover:border-slate-400',
        isDragging && 'z-10 opacity-80',
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="mt-0.5 cursor-grab touch-none rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
          aria-label={`Reorder question ${index + 1}. Press space, then use arrow keys.`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>

        <button type="button" onClick={onSelect} className="min-w-0 flex-1 cursor-pointer text-left" aria-pressed={selected}>
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {index + 1} · {FIELD_TYPE_META[field.type]?.label}
          </span>
          <span className="mt-0.5 block truncate font-medium text-slate-900">
            {field.label || 'Untitled question'}
            {field.required && <span className="ml-0.5 text-red-500" aria-label="required">*</span>}
          </span>
          {field.description && <span className="block truncate text-sm text-slate-500">{field.description}</span>}
          {field.type === 'email' && field.verifyEmail && (
            <span className="mt-1 block text-xs text-brand-600">
              Verified with Google sign-in{field.uniqueEmail ? ' · one response per email' : ''}
            </span>
          )}
          {field.type === 'file' && (
            <span className="mt-1 block truncate text-xs text-slate-400">
              {allowedExtensions(field).map((e) => `.${e}`).join(' ')} · up to {FILE_UPLOAD.MAX_LABEL}
            </span>
          )}
          {field.options?.length > 0 && (
            <span className="mt-1 block truncate text-xs text-slate-400">{field.options.join(' · ')}</span>
          )}
        </button>

        <div className="flex gap-0.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <Button size="icon" variant="ghost" aria-label={`Duplicate "${field.label}"`} onClick={onDuplicate}>
            <Copy className="h-4 w-4" aria-hidden />
          </Button>
          <Button size="icon" variant="danger-ghost" aria-label={`Delete "${field.label}"`} onClick={onDelete}>
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </li>
  );
}

export function Canvas({ fields, selectedId, onSelect, onMove, onDuplicate, onDelete }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    onMove(fields.findIndex((f) => f.id === active.id), fields.findIndex((f) => f.id === over.id));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-3" aria-label="Form questions">
          {fields.map((field, i) => (
            <SortableField
              key={field.id}
              field={field}
              index={i}
              selected={field.id === selectedId}
              onSelect={() => onSelect(field.id)}
              onDuplicate={() => onDuplicate(field.id)}
              onDelete={() => onDelete(field.id)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
