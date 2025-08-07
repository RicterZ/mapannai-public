import { cn } from '@/utils/cn'

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg'
    className?: string
}

export const LoadingSpinner = ({ size = 'md', className }: LoadingSpinnerProps) => {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-6 h-6',
        lg: 'w-8 h-8',
    }

    return (
        <div
            className={cn(
                'animate-spin rounded-full border-2 border-gray-300 border-t-blue-600',
                sizeClasses[size],
                className
            )}
            role="status"
            aria-label="加载中"
        >
            <span className="sr-only">加载中...</span>
        </div>
    )
} 