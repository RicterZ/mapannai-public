'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MarkerIconType, MARKER_ICONS } from '@/types/marker'
import { cn } from '@/utils/cn'

interface IconSelectorProps {
    selectedIcon?: MarkerIconType
    onSelect: (iconType: MarkerIconType) => void
    className?: string
}

export const IconSelector = ({ selectedIcon = 'location', onSelect, className }: IconSelectorProps) => {
    const [isOpen, setIsOpen] = useState(false)
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 })
    const buttonRef = useRef<HTMLButtonElement>(null)

    const handleSelect = (iconType: MarkerIconType) => {
        onSelect(iconType)
        setIsOpen(false)
    }

    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect()
            setPosition({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width
            })
        }
    }, [isOpen])

    return (
        <div className={cn('relative', className)}>
            {/* 选择器按钮 */}
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <div className="flex items-center space-x-2">
                    <span className="text-lg">{MARKER_ICONS[selectedIcon].emoji}</span>
                    <span className="text-sm text-gray-700">{MARKER_ICONS[selectedIcon].name}</span>
                </div>
                <svg
                    className={cn('w-4 h-4 text-gray-400 transition-transform', isOpen && 'rotate-180')}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* 下拉菜单 - 使用Portal渲染到body */}
            {isOpen && createPortal(
                <>
                    {/* 背景遮罩 */}
                    <div
                        className="fixed inset-0 z-[110]"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* 选项列表 */}
                    <div 
                        className="fixed z-[120] bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto"
                        style={{
                            top: position.top,
                            left: position.left,
                            width: position.width,
                            minWidth: '200px'
                        }}
                    >
                        <div className="py-1">
                            {Object.entries(MARKER_ICONS).map(([iconType, config]) => (
                                <button
                                    key={iconType}
                                    type="button"
                                    onClick={() => handleSelect(iconType as MarkerIconType)}
                                    className={cn(
                                        'w-full flex items-center px-3 py-2 text-left hover:bg-gray-100 transition-colors',
                                        selectedIcon === iconType && 'bg-blue-50 text-blue-700'
                                    )}
                                >
                                    <span className="text-lg mr-3">{config.emoji}</span>
                                    <div className="flex-1">
                                        <div className="text-sm font-medium">{config.name}</div>
                                        <div className="text-xs text-gray-500">{config.description}</div>
                                    </div>
                                    {selectedIcon === iconType && (
                                        <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    )
} 