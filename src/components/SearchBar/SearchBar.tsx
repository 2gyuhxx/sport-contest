import { Search, X } from 'lucide-react'

interface SearchBarProps {
    searchTerm: string
    onSearchChange: (term: string) => void
}

export function SearchBar({ searchTerm, onSearchChange }: SearchBarProps) {
    const handleClear = () => {
        onSearchChange('')
    }

    return (
        <div className="relative">
            <Search className="absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#8e8e93]" />
            <input
                type="text"
                placeholder="행사 검색"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full rounded-[14px] bg-[#767680]/10 py-[11px] pl-11 pr-11 text-[17px] text-[#1d1d1f] placeholder-[#8e8e93] outline-none transition-all duration-200 focus:bg-[#767680]/15 focus:ring-2 focus:ring-[#007AFF]/30"
                style={{ letterSpacing: '-0.01em' }}
            />
            {searchTerm && (
                <button
                    onClick={handleClear}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-[#8e8e93]/30 p-1 transition-colors hover:bg-[#8e8e93]/40"
                >
                    <X className="h-3.5 w-3.5 text-white" />
                </button>
            )}
        </div>
    )
}
