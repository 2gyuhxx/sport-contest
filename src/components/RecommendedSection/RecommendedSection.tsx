import { Star } from 'lucide-react'
import type { Event } from '../../types/events'
import { REGION_INFO } from '../../constants'

interface RecommendedSectionProps {
    events: Event[]
    isAuthenticated: boolean
}

export function RecommendedSection({ events, isAuthenticated }: RecommendedSectionProps) {
    if (!isAuthenticated || events.length === 0) {
        return null
    }

    return (
        <div className="flex-shrink-0 border-t border-[#3c3c43]/10 px-6 py-4">
            <div className="mb-3 flex items-center gap-2">
                <Star className="h-4 w-4 text-[#FF9500]" fill="currentColor" />
                <span className="text-[15px] font-semibold text-[#1d1d1f]">맞춤 추천</span>
                <span className="ml-auto rounded-full bg-[#FF9500]/15 px-2.5 py-0.5 text-[12px] font-semibold text-[#FF9500]">
                    {events.length}
                </span>
            </div>
            <div className="recommended-scroll max-h-[240px] overflow-y-auto space-y-2">
                {events.map((event) => (
                    <a
                        key={event.id}
                        href={`/events/${event.id}`}
                        className="group block rounded-2xl bg-gradient-to-r from-[#FF9500]/8 to-transparent p-3.5 transition-all duration-200 hover:from-[#FF9500]/12"
                    >
                        <h4 className="text-[15px] font-semibold text-[#1d1d1f] line-clamp-1 transition-colors group-hover:text-[#007AFF]">
                            {event.title}
                        </h4>
                        <p className="mt-1 text-[13px] text-[#8e8e93]">
                            {REGION_INFO[event.region]?.shortName} · {event.city}
                        </p>
                    </a>
                ))}
            </div>
        </div>
    )
}
