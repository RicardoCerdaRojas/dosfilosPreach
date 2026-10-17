import { ReactNode, useState, useCallback, useEffect, useRef } from 'react';
import { PlannerChatPanel } from './PlannerChatPanel';
import { LibraryResourceEntity } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { MessageSquare, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlannerLayoutProps {
    children: ReactNode;
    context: {
        type: string;
        topicOrBook: string;
        resources: LibraryResourceEntity[];
    };
    isChatOpen?: boolean;
    onChatOpenChange?: (isOpen: boolean) => void;
}

const MIN_WIDTH = 320;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 450;
const STORAGE_KEY = 'plannerChatWidth';

export function PlannerLayout({ children, context, isChatOpen, onChatOpenChange }: PlannerLayoutProps) {
    // Fallback to internal state if not controlled
    const [internalShowChat, setInternalShowChat] = useState(true);
    const showChat = isChatOpen !== undefined ? isChatOpen : internalShowChat;
    const setShowChat = onChatOpenChange || setInternalShowChat;

    const [isMaximized, setIsMaximized] = useState(false);
    
    // Resizable panel state
    const [panelWidth, setPanelWidth] = useState(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? Math.min(Math.max(parseInt(stored), MIN_WIDTH), MAX_WIDTH) : DEFAULT_WIDTH;
    });
    const [isResizing, setIsResizing] = useState(false);
    const resizeRef = useRef<HTMLDivElement>(null);

    // Save width to localStorage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, panelWidth.toString());
    }, [panelWidth]);

    // Handle mouse move during resize
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizing) return;
        
        const windowWidth = window.innerWidth;
        const newWidth = windowWidth - e.clientX;
        
        if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
            setPanelWidth(newWidth);
        }
    }, [isResizing]);

    // Handle mouse up - stop resizing
    const handleMouseUp = useCallback(() => {
        setIsResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, []);

    // Add/remove event listeners
    useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }
        
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, handleMouseMove, handleMouseUp]);

    // Start resizing
    const startResize = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    return (
        <div className="flex h-[calc(100vh-var(--alto-barra))] overflow-hidden">
            {/* Main Content (Wizard) */}
            <div className={cn(
                "flex-1 overflow-y-auto bg-background transition-all duration-300",
                isMaximized ? "hidden" : "block"
            )}>
                {children}
            </div>

            {/* Chat Panel (Sidebar) */}
            <div 
                ref={resizeRef}
                className={cn(
                    "border-l bg-background transition-all ease-in-out absolute right-0 top-[var(--alto-barra)] bottom-0 z-20 lg:static lg:top-0 lg:h-full shadow-xl lg:shadow-none flex",
                    showChat ? "translate-x-0" : "translate-x-full lg:translate-x-0 lg:w-0 lg:border-l-0 lg:overflow-hidden",
                    isMaximized && "w-full border-l-0",
                    isResizing && "transition-none"
                )}
                style={{ 
                    width: isMaximized ? '100%' : `${panelWidth}px`
                }}
            >
                {/* Resize Handle */}
                {!isMaximized && showChat && (
                    <div
                        className={cn(
                            "w-1.5 cursor-col-resize hover:bg-primary/20 active:bg-primary/40 transition-colors flex items-center justify-center group absolute left-0 top-0 bottom-0 z-10",
                            isResizing && "bg-primary/40"
                        )}
                        onMouseDown={startResize}
                    >
                        <GripVertical className="h-6 w-6 text-muted-foreground/50 group-hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                )}
                
                <div className="h-full relative flex-1">
                    <PlannerChatPanel 
                        context={context} 
                        className="h-full" 
                        isMaximized={isMaximized}
                        onToggleMaximize={() => setIsMaximized(!isMaximized)}
                        onClose={() => setShowChat(false)}
                    />
                </div>
            </div>

            {/* Mobile Toggle Button */}
            {!showChat && (
                <Button
                    className="fixed bottom-6 right-6 z-30 rounded-full shadow-lg lg:hidden"
                    onClick={() => setShowChat(true)}
                >
                    <MessageSquare className="mr-2 h-4 w-4" /> Asistente
                </Button>
            )}
            
            {/* Desktop Toggle (Optional, if we want to allow collapsing on desktop) */}
            <Button
                variant="outline"
                size="sm"
                className={cn(
                    "fixed bottom-6 right-6 z-30 hidden lg:flex bg-background shadow-md transition-all",
                    showChat ? `translate-x-[${panelWidth}px] opacity-0 pointer-events-none` : "translate-x-0 opacity-100"
                )}
                onClick={() => setShowChat(true)}
            >
                <MessageSquare className="mr-2 h-4 w-4" /> Abrir Asistente
            </Button>
        </div>
    );
}
