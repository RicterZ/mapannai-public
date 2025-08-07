import { useEffect } from 'react'
import { useMapStore } from '@/store/map-store'

export const useKeyboardShortcuts = () => {
    const { closeSidebar, closePopup, interactionState } = useMapStore()

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // ESC key to close sidebar or popup
            if (event.key === 'Escape') {
                if (interactionState.isPopupOpen) {
                    closePopup()
                } else if (interactionState.isSidebarOpen) {
                    closeSidebar()
                }
            }

            // Ctrl/Cmd + S to trigger save (prevent default browser save)
            if ((event.ctrlKey || event.metaKey) && event.key === 's') {
                event.preventDefault()
                // Save functionality can be handled by the editor component
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [interactionState, closeSidebar, closePopup])
} 