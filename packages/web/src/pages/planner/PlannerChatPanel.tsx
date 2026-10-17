import { useState, useRef, useEffect } from 'react';

import { plannerChatService, SourceReference } from '@dosfilos/application';
import { LibraryResourceEntity, ChatMessage, CoachingStyle } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Bot, User, Maximize2, Minimize2, X, BookOpen, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface MessageWithSources {
    message: ChatMessage;
    sources?: SourceReference[];
    strategyUsed?: CoachingStyle;
}

interface PlannerChatPanelProps {
    context: {
        type: string;
        topicOrBook: string;
        resources: LibraryResourceEntity[];
    };
    className?: string;
    isMaximized?: boolean;
    onToggleMaximize?: () => void;
    onClose?: () => void;
}

export function PlannerChatPanel({ context, className, isMaximized, onToggleMaximize, onClose }: PlannerChatPanelProps) {
    const [messagesWithSources, setMessagesWithSources] = useState<MessageWithSources[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set());
    const [selectedStyle, setSelectedStyle] = useState<CoachingStyle | 'auto'>('auto');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Initialize from history
    useEffect(() => {
        const history = plannerChatService.getHistory();
        setMessagesWithSources(history.map(msg => ({
            message: msg,
            sources: undefined // Historical messages don't have sources stored
        })));
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messagesWithSources, isLoading]);

    const toggleSources = (idx: number) => {
        setExpandedSources(prev => {
            const newSet = new Set(prev);
            if (newSet.has(idx)) {
                newSet.delete(idx);
            } else {
                newSet.add(idx);
            }
            return newSet;
        });
    };

    const handleStyleChange = (value: string) => {
        const style = value as CoachingStyle | 'auto';
        setSelectedStyle(style);
        plannerChatService.setCoachingStyle(style);
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg = input;
        setInput('');
        setIsLoading(true);

        // Add user message to local state immediately
        const userMessageObj: MessageWithSources = {
            message: { role: 'user', content: userMsg, timestamp: new Date() }
        };
        setMessagesWithSources(prev => [...prev, userMessageObj]);

        try {
            const response = await plannerChatService.sendMessage(userMsg, context);
            
            console.log('📚 [Chat Response] Sources received:', response.sources?.length || 0, response.sources);
            
            // Add assistant message with sources to local state
            const assistantMessageObj: MessageWithSources = {
                message: { role: 'assistant', content: response.content, timestamp: new Date() },
                sources: response.sources,
                strategyUsed: response.strategyUsed
            };
            setMessagesWithSources(prev => [...prev, assistantMessageObj]);
        } catch (error) {
            console.error(error);
            // Remove the user message on error
            setMessagesWithSources(prev => prev.slice(0, -1));
        } finally {
            setIsLoading(false);
        }
    };

    const getStrategyLabel = (style: CoachingStyle): string => {
        switch (style) {
            case CoachingStyle.SOCRATIC: return '🧠 Socrático';
            case CoachingStyle.DIRECT: return '⚡ Directo';
            case CoachingStyle.EXPLORATORY: return '🔍 Exploratorio';
            case CoachingStyle.DIDACTIC: return '📚 Didáctico';
            default: return style;
        }
    };

    return (
        <div className={cn("flex flex-col h-full border-l bg-background relative overflow-hidden", className)}>
            {/* Animated border effect when loading */}
            {isLoading && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
                    <div className="absolute inset-0 border-l-4 border-transparent bg-gradient-to-b from-primary via-purple-500 to-primary bg-[length:100%_200%] animate-[gradient_3s_linear_infinite]" 
                        style={{ 
                            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                            WebkitMaskComposite: 'xor',
                            maskComposite: 'exclude',
                            padding: '0 0 0 4px'
                        }} 
                    />
                </div>
            )}

            <div className="p-4 border-b flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Asistente Experto</h3>
                </div>
                <div className="flex items-center gap-2">
                    {/* Strategy Selector */}
                    <Select value={selectedStyle} onValueChange={handleStyleChange}>
                        <SelectTrigger className="w-[160px] h-9 text-sm font-medium">
                            <span className="flex items-center gap-1.5">
                                <Sparkles className="h-4 w-4 text-primary" />
                                <SelectValue placeholder="Modo" />
                            </span>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="auto">🤖 Automático</SelectItem>
                            <SelectItem value={CoachingStyle.SOCRATIC}>🧠 Socrático</SelectItem>
                            <SelectItem value={CoachingStyle.DIRECT}>⚡ Directo</SelectItem>
                            <SelectItem value={CoachingStyle.EXPLORATORY}>🔍 Exploratorio</SelectItem>
                            <SelectItem value={CoachingStyle.DIDACTIC}>📚 Didáctico</SelectItem>
                        </SelectContent>
                    </Select>
                    {onToggleMaximize && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={onToggleMaximize}
                            title={isMaximized ? "Minimizar" : "Pantalla Completa"}
                        >
                            {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </Button>
                    )}
                    {onClose && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={onClose}
                            title="Cerrar Chat"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            <ScrollArea className="flex-1 p-4 min-h-0">
                <div className="space-y-4">
                    {messagesWithSources.length === 0 && (
                        <div className="text-center text-muted-foreground text-sm py-8">
                            <p>Hola, soy tu asistente experto en homilética.</p>
                            <p className="mt-2">Puedo ayudarte a refinar tu objetivo, sugerir títulos o responder dudas sobre tus recursos.</p>
                        </div>
                    )}
                    {messagesWithSources.filter(item => 
                        !item.message.content.startsWith('[HIDDEN]') && 
                        !(item.message.role === 'assistant' && item.message.content.includes('"reformulatedText"'))
                    ).map((item, idx) => (
                        <div key={idx} className={cn(
                            "flex gap-2 max-w-[90%]",
                            item.message.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                        )}>
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                item.message.role === 'user' ? "bg-primary-solid text-primary-foreground" : "bg-muted"
                            )}>
                                {item.message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                            </div>
                            <div className="flex flex-col gap-1">
                                <div className={cn(
                                    "p-3 rounded-lg text-sm",
                                    item.message.role === 'user' ? "bg-primary-solid text-primary-foreground" : "bg-muted"
                                )}>
                                    <div className={cn(
                                        "prose prose-sm max-w-none break-words",
                                        item.message.role === 'user' ? "prose-invert" : "dark:prose-invert"
                                    )}>
                                        <ReactMarkdown 
                                            components={{
                                                p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                                                ul: ({children}) => <ul className="list-disc pl-4 mb-2 last:mb-0">{children}</ul>,
                                                ol: ({children}) => <ol className="list-decimal pl-4 mb-2 last:mb-0">{children}</ol>,
                                                li: ({children}) => <li className="mb-1">{children}</li>,
                                                strong: ({children}) => <span className="font-bold">{children}</span>,
                                                h1: ({children}) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                                                h2: ({children}) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                                                h3: ({children}) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                                            }}
                                        >
                                            {item.message.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                                
                                {/* Collapsible Sources Section */}
                                {item.message.role === 'assistant' && (item.sources && item.sources.length > 0 || item.strategyUsed) && (
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        {/* Strategy Badge */}
                                        {item.strategyUsed && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                                {getStrategyLabel(item.strategyUsed)}
                                            </span>
                                        )}
                                        
                                        {/* Sources Button */}
                                        {item.sources && item.sources.length > 0 && (
                                            <Collapsible 
                                                open={expandedSources.has(idx)}
                                                onOpenChange={() => toggleSources(idx)}
                                            >
                                                <CollapsibleTrigger asChild>
                                                    <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded hover:bg-muted/50">
                                                        <BookOpen className="h-3 w-3" />
                                                        <span>Fuentes consultadas ({item.sources.length})</span>
                                                        {expandedSources.has(idx) ? (
                                                            <ChevronDown className="h-3 w-3" />
                                                        ) : (
                                                            <ChevronRight className="h-3 w-3" />
                                                        )}
                                                    </button>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent className="mt-1">
                                                    <div className="text-xs bg-muted/30 border rounded-lg p-2 space-y-2">
                                                        {item.sources.map((source, sIdx) => (
                                                            <div key={sIdx} className="border-l-2 border-primary/30 pl-2">
                                                                <div className="font-medium text-foreground">
                                                                    {source.author} - {source.title}
                                                                    {source.page && <span className="text-muted-foreground"> (p.{source.page})</span>}
                                                                </div>
                                                                <p className="text-muted-foreground italic mt-0.5 line-clamp-2">
                                                                    "{source.snippet}"
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </CollapsibleContent>
                                            </Collapsible>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex gap-3 justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <Bot className="h-4 w-4 text-primary animate-pulse" />
                            </div>
                            <div className="max-w-[80%] rounded-lg p-4 bg-primary/5 border border-primary/10">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm text-muted-foreground font-medium">El experto está pensando</span>
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>

            <div className="p-4 border-t bg-background">
                <form 
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="flex gap-2 items-end"
                >
                    <Textarea 
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            // Enter sends, Shift+Enter adds new line
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Escribe tu consulta... (Shift+Enter para nueva línea)"
                        disabled={isLoading}
                        className="min-h-[44px] max-h-[200px] resize-none"
                        rows={1}
                    />
                    <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="shrink-0">
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </div>
        </div>
    );
}
