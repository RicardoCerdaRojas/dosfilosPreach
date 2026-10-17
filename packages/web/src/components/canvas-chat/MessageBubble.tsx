import { CanvasChatMessage } from '@dosfilos/domain';
import { cn } from '@/lib/utils';
import { User, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MessageBubbleProps {
  message: CanvasChatMessage;
  onApply?: (content: any) => void;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn(
      "flex gap-3 w-full items-start",
      isUser ? "justify-end" : "justify-start"
    )}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
      )}
      
      <div className={cn(
        "rounded-lg p-3 overflow-hidden flex-1 min-w-0 max-w-[75%] text-sm",
        isUser 
          ? "bg-primary-solid text-primary-foreground" 
          : "bg-muted"
      )}>
        <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
                p: ({children}) => <p className="mb-2 last:mb-0 leading-relaxed whitespace-pre-wrap">{children}</p>,
                ul: ({children}) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                ol: ({children}) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                li: ({children}) => <li className="leading-relaxed">{children}</li>,
                h1: ({children}) => <h1 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
                h2: ({children}) => <h2 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
                h3: ({children}) => <h3 className="text-sm font-bold mb-1 mt-2 first:mt-0">{children}</h3>,
                code: ({children}) => <code className={cn("px-1 py-0.5 rounded text-xs font-mono", isUser ? "bg-primary-foreground/20" : "bg-black/10")}>{children}</code>,
                pre: ({children}) => <pre className="p-2 rounded bg-black/10 overflow-x-auto my-2 text-xs">{children}</pre>,
                strong: ({children}) => <strong className="font-bold">{children}</strong>
            }}
        >
          {message.content}
        </ReactMarkdown>
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
