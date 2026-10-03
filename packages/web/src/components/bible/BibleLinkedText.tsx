import { useState, Fragment, ReactNode } from 'react';
import { BookOpen } from 'lucide-react';
import { BiblePassageViewer } from './BiblePassageViewer';
import { LocalBibleService } from '@/services/LocalBibleService';
import { cn } from '@/lib/utils';
import { BIBLE_REF_PATTERN } from '@/lib/bible/bibleReferencePattern';

interface BibleLinkedTextProps {
    text: string;
    className?: string;
}

/**
 * BibleLinkedText Component
 * Detects Bible references in text and makes them clickable to view the passage
 */
export function BibleLinkedText({ text, className }: BibleLinkedTextProps) {
    const [selectedReference, setSelectedReference] = useState<string | null>(null);

    // Find all Bible references in the text
    const parseTextWithReferences = (inputText: string): ReactNode[] => {
        const parts: ReactNode[] = [];
        let lastIndex = 0;
        
        // Reset regex state
        BIBLE_REF_PATTERN.lastIndex = 0;
        
        let match;
        while ((match = BIBLE_REF_PATTERN.exec(inputText)) !== null) {
            const fullMatch = match[0];
            const startIndex = match.index;
            
            // Validate that this is a parseable reference
            const isValid = LocalBibleService.parseReference(fullMatch.trim()) !== null;
            
            if (!isValid) {
                continue;
            }
            
            // Add text before the match
            if (startIndex > lastIndex) {
                parts.push(inputText.substring(lastIndex, startIndex));
            }
            
            // Add the clickable reference
            parts.push(
                <BibleReferenceLink
                    key={`ref-${startIndex}`}
                    reference={fullMatch.trim()}
                    onClick={() => setSelectedReference(fullMatch.trim())}
                />
            );
            
            lastIndex = startIndex + fullMatch.length;
        }
        
        // Add remaining text
        if (lastIndex < inputText.length) {
            parts.push(inputText.substring(lastIndex));
        }
        
        return parts.length > 0 ? parts : [inputText];
    };

    const parts = parseTextWithReferences(text);

    return (
        <>
            <span className={className}>
                {parts.map((part, index) => (
                    <Fragment key={index}>{part}</Fragment>
                ))}
            </span>
            
            {/* Bible Passage Viewer Dialog */}
            <BiblePassageViewer
                reference={selectedReference}
                onClose={() => setSelectedReference(null)}
            />
        </>
    );
}

/**
 * Clickable Bible reference link
 */
interface BibleReferenceLinkProps {
    reference: string;
    onClick: () => void;
    className?: string;
}

function BibleReferenceLink({ reference, onClick, className }: BibleReferenceLinkProps) {
    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            className={cn(
                "inline-flex items-center gap-0.5 text-primary font-medium",
                "hover:underline decoration-dotted underline-offset-2",
                "cursor-pointer transition-colors hover:text-primary/80",
                "bg-primary/5 px-1 py-0.5 rounded",
                className
            )}
            title={`Ver ${reference}`}
        >
            <BookOpen className="h-3 w-3 flex-shrink-0" />
            <span>{reference}</span>
        </button>
    );
}
