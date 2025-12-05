import { useRef } from 'react'
import { SPORT_CATEGORIES } from '../../constants'
import type { CategoryFilter } from '../../hooks/useEventFilters'

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
    all: '전체',
    'team-ball': '구기·팀',
    'racket-ball': '라켓·볼',
    'martial-arts': '무도·격투',
    'fitness-skill': '체력·기술',
    precision: '정밀·기술',
    'ice-snow': '빙상·설원',
    water: '수상·해양',
    leisure: '레저·환경',
    mind: '마인드',
    other: '기타',
}

interface CategoryChipsProps {
    categoryOptions: CategoryFilter[]
    selectedCategory: CategoryFilter
    onCategoryChange: (category: CategoryFilter) => void
}

export function CategoryChips({
    categoryOptions,
    selectedCategory,
    onCategoryChange
}: CategoryChipsProps) {
    const categoryScrollDraggingRef = useRef<boolean>(false)

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        // 왼쪽 마우스 버튼만 처리
        if (e.button !== 0) return

        const target = e.currentTarget
        const startX = e.pageX
        const startScrollLeft = target.scrollLeft

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = Math.abs(e.pageX - startX)
            if (deltaX > 3) {
                categoryScrollDraggingRef.current = true
                e.preventDefault()
                const walk = (e.pageX - startX) * 1
                target.scrollLeft = startScrollLeft - walk
            }
        }

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)

            // 드래그가 끝난 후 약간의 지연 후 드래그 상태 해제
            setTimeout(() => {
                categoryScrollDraggingRef.current = false
            }, 100)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }

    const handleCategoryClick = (option: CategoryFilter, e: React.MouseEvent) => {
        // 드래그 중이면 클릭 이벤트 방지
        if (categoryScrollDraggingRef.current) {
            e.preventDefault()
            e.stopPropagation()
            return
        }
        onCategoryChange(option)
    }

    return (
        <div className="flex-shrink-0 border-t border-[#3c3c43]/10 px-6 py-4">
            <div
                className="category-scroll flex gap-2 overflow-x-auto pb-1"
                onMouseDown={handleMouseDown}
            >
                {categoryOptions.map((option) => {
                    const categoryInfo = option === 'all'
                        ? { label: '전체', emoji: '🌐' }
                        : SPORT_CATEGORIES.find(cat => cat.value === option)
                    const isActive = selectedCategory === option

                    return (
                        <button
                            key={option}
                            onClick={(e) => handleCategoryClick(option, e)}
                            className={`flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-[9px] text-[15px] font-medium transition-all duration-200 active:scale-[0.97] ${isActive
                                ? 'bg-[#007AFF] text-white shadow-[0_2px_8px_rgba(0,122,255,0.35)]'
                                : 'bg-[#767680]/10 text-[#1d1d1f] hover:bg-[#767680]/15'
                                }`}
                        >
                            <span className="text-[14px]">{categoryInfo?.emoji}</span>
                            <span>{categoryInfo?.label || CATEGORY_LABELS[option]}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
