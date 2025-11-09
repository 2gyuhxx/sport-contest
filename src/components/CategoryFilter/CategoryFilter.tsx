import type { Category } from '../../types/events'
import { classNames } from '../../utils/classNames'

interface CategoryFilterProps {
  categories: Category[]
  selected?: Category | null
  onSelect: (category: Category | null) => void
}

export function CategoryFilter({
  categories,
  selected,
  onSelect,
}: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={classNames(
          'rounded-full border px-4 py-2 text-sm transition',
          selected === null
            ? 'border-brand-primary bg-brand-primary text-white'
            : 'border-surface-subtle bg-white hover:border-brand-primary hover:text-brand-primary',
        )}
      >
        전체
      </button>
      {categories.map((category) => {
        const isActive = selected === category
        return (
          <button
            key={category}
            type="button"
            onClick={() => onSelect(category)}
            className={classNames(
              'rounded-full border px-4 py-2 text-sm capitalize transition',
              isActive
                ? 'border-brand-primary bg-brand-primary text-white'
                : 'border-surface-subtle bg-white hover:border-brand-primary hover:text-brand-primary',
            )}
            aria-pressed={isActive}
          >
            {category}
          </button>
        )
      })}
    </div>
  )
}
