import { FIELD_TYPES, FIELD_TYPE_META } from '@afb/shared';
import {
  AlignLeft, Calendar, CheckSquare, ChevronDownSquare, CircleDot, Hash, Mail, Paperclip, Phone, Star, ToggleLeft, Type,
} from 'lucide-react';

const ICONS = {
  text: Type, textarea: AlignLeft, email: Mail, number: Hash, phone: Phone, select: ChevronDownSquare,
  radio: CircleDot, checkbox: CheckSquare, rating: Star, date: Calendar, boolean: ToggleLeft, file: Paperclip,
};

export function FieldPalette({ onAdd, disabled }) {
  return (
    <div>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Add a question</h2>
      <ul className="grid grid-cols-2 gap-2 lg:grid-cols-1">
        {FIELD_TYPES.map((type) => {
          const Icon = ICONS[type];
          return (
            <li key={type}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onAdd(type)}
                title={FIELD_TYPE_META[type].description}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:border-brand-500 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                {FIELD_TYPE_META[type].label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
