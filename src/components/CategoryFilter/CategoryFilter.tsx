import type { Category } from '../../types/events'
import { classNames } from '../../utils/classNames'

interface CategoryFilterProps {
  categories: Category[]
  selected?: Category | null
  onSelect: (category: Category | null) => void
}

// 카테고리 한글 매핑
const CATEGORY_LABELS: Record<Category, string> = {
  football: '축구',
  basketball: '농구',
  baseball: '야구',
  volleyball: '배구',
  marathon: '마라톤',
  fitness: '피트니스',
  esports: 'e스포츠',
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
              'rounded-full border px-4 py-2 text-sm transition',
              isActive
                ? 'border-brand-primary bg-brand-primary text-white'
                : 'border-surface-subtle bg-white hover:border-brand-primary hover:text-brand-primary',
            )}
            aria-pressed={isActive}
          >
            {CATEGORY_LABELS[category]}
          </button>
        )
      })}
    </div>
  )
}
