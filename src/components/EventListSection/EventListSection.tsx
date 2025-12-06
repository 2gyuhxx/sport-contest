import { Calendar, MapPin, ChevronRight } from 'lucide-react'
import type { Event } from '../../types/events'
import { SPORT_CATEGORIES, REGION_INFO, CATEGORY_LABELS as CATEGORY_LABEL_MAP } from '../../constants'

const CATEGORY_LABELS = {
    all: '전체',
    ...CATEGORY_LABEL_MAP,
}

interface EventListSectionProps {
    events: Event[]
    totalCount?: number
    isLoading: boolean
}

export function EventListSection({ events, totalCount, isLoading }: EventListSectionProps) {
    const displayCount = totalCount !== undefined ? totalCount : events.length
    
    return (
        <div className="flex-1 overflow-hidden border-t border-[#3c3c43]/10">
            <div className="flex h-full flex-col">
                {/* 리스트 헤더 */}
                <div className="flex items-center justify-between px-6 py-3">
                    <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#007AFF]/10">
                            <Calendar className="h-3.5 w-3.5 text-[#007AFF]" />
                        </div>
                        <span className="text-[15px] font-semibold text-[#1d1d1f]">행사 목록</span>
                    </div>
                    <span className="rounded-full bg-[#767680]/10 px-2.5 py-1 text-[12px] font-semibold text-[#8e8e93]">
                        {displayCount}건
                    </span>
                </div>

                {isLoading ? (
                    <div className="flex flex-1 items-center justify-center">
                        <div className="text-center">
                            <div className="relative mx-auto mb-4 h-10 w-10">
                                <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-[#007AFF]/20"></div>
                                <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-[#007AFF]"></div>
                            </div>
                            <p className="text-[14px] text-[#8e8e93]">불러오는 중...</p>
                        </div>
                    </div>
                ) : (
                    <div className="recommended-scroll flex-1 overflow-y-auto px-6 pb-6">
                        {events.length > 0 ? (
                            <div className="space-y-3">
                                {events.map((event) => (
                                    <a
                                        key={event.id}
                                        href={`/events/${event.id}`}
                                        className="group block overflow-hidden rounded-[20px] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)]"
                                    >
                                        <div className="flex gap-4">
                                            {/* 썸네일 */}
                                            <div className="h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-2xl bg-[#f5f5f7]">
                                                {event.image ? (
                                                    <img
                                                        src={event.image}
                                                        alt={event.title}
                                                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                    />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center text-2xl bg-gradient-to-br from-[#f5f5f7] to-[#e8e8ed]">
                                                        {SPORT_CATEGORIES.find(c => c.value === event.category)?.emoji || '🏆'}
                                                    </div>
                                                )}
                                            </div>

                                            {/* 정보 */}
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-[15px] font-semibold text-[#1d1d1f] line-clamp-2 leading-snug transition-colors group-hover:text-[#007AFF]">
                                                    {event.title}
                                                </h4>
                                                <div className="mt-2 flex items-center gap-1.5 text-[13px] text-[#8e8e93]">
                                                    <MapPin className="h-3.5 w-3.5" />
                                                    <span className="truncate">{REGION_INFO[event.region]?.shortName} · {event.city}</span>
                                                </div>
                                                <div className="mt-2 flex items-center justify-between">
                                                    <span className="rounded-full bg-[#f5f5f7] px-2.5 py-1 text-[11px] font-medium text-[#1d1d1f]">
                                                        {CATEGORY_LABELS[event.category]}
                                                    </span>
                                                    <ChevronRight className="h-4 w-4 text-[#c7c7cc] transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[#007AFF]" />
                                                </div>
                                            </div>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-1 items-center justify-center py-16">
                                <div className="text-center">
                                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f5f5f7]">
                                        <Calendar className="h-8 w-8 text-[#c7c7cc]" />
                                    </div>
                                    <p className="text-[17px] font-semibold text-[#1d1d1f]">행사가 없습니다</p>
                                    <p className="mt-1 text-[15px] text-[#8e8e93]">다른 조건으로 검색해보세요</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
