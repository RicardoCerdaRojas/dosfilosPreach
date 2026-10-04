import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { sermonService, exportService } from '@dosfilos/application';
import { SermonEntity, sermonPrintAuthor } from '@dosfilos/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Download, BookOpen, Minus, Plus, Type } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { LocalBibleService } from '@/services/LocalBibleService';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

export function PublicSermonPage() {
    const { token } = useParams<{ token: string }>();
    const [sermon, setSermon] = useState<SermonEntity | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    
    // Reader Tools State
    const [fontSize, setFontSize] = useState(18);
    const [selectedReference, setSelectedReference] = useState<string | null>(null);
    const [bibleText, setBibleText] = useState<string | null>(null);
    const [loadingBible, setLoadingBible] = useState(false);

    useEffect(() => {
        const fetchSermon = async () => {
            if (!token) return;
            try {
                const result = await sermonService.getSharedSermon(token);
                if (result) {
                    setSermon(result);
                } else {
                    setError('Sermón no encontrado o el enlace ha expirado');
                }
            } catch (err) {
                setError('Error al cargar el sermón');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchSermon();
    }, [token]);

    // Bible Fetching Logic
    const fetchBibleText = async (ref: string) => {
        setLoadingBible(true);
        setBibleText(null);
        try {
            await new Promise(resolve => setTimeout(resolve, 300));
            const text = LocalBibleService.getVerses(ref);
            if (text) {
                setBibleText(text);
            } else {
                setBibleText('No se pudo encontrar el texto. Verifique la referencia.');
            }
        } catch (error) {
            console.error('Error fetching bible text:', error);
            setBibleText('Error al cargar el texto bíblico.');
        } finally {
            setLoadingBible(false);
        }
    };

    useEffect(() => {
        if (selectedReference) {
            fetchBibleText(selectedReference);
        }
    }, [selectedReference]);

    // Markdown Processing
    const processContent = (content: string) => {
        if (!content) return '';
        const bibleRegex = /\b((?:[1-3]\s)?[A-Z][a-zá-ú]+\s\d+:\d+(?:-\d+)?)\b/g;
        // Add Bible reference links
        return content.replace(bibleRegex, (match, _, offset, string) => {
            // Prevent double-processing if already inside a markdown link
            const substringBefore = string.slice(Math.max(0, offset - 10), offset);
            const substringAfter = string.slice(offset + match.length, Math.min(string.length, offset + match.length + 20));
            
            if (substringBefore.includes('[📖') || substringAfter.includes('](#bible-') || substringBefore.includes('#bible-')) {
                return match;
            }
            return `[${match}](#bible-${encodeURIComponent(match)})`;
        });
    };

    const components = {
        a: ({ node, ...props }: any) => {
            const href = props.href || '';
            if (href.startsWith('#bible-')) {
                const ref = decodeURIComponent(href.replace('#bible-', ''));
                return (
                    <span 
                        className="text-primary font-semibold cursor-pointer hover:underline decoration-dotted underline-offset-4"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedReference(ref);
                        }}
                    >
                        {props.children}
                    </span>
                );
            }
            return <a {...props} className="text-primary underline" />;
        }
    };

    const handleExport = async () => {
        if (!sermon) return;
        try {
            setExporting(true);
            // Quien abre el enlace no es el autor: sólo el nombre guardado en el sermón.
            await exportService.exportSermonToPdf(sermon, { author: sermonPrintAuthor(sermon.authorName) });
            toast.success('Sermón exportado correctamente');
        } catch (error) {
            console.error('Error exporting sermon:', error);
            toast.error('Error al exportar el sermón');
        } finally {
            setExporting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-muted-foreground">Cargando sermón...</p>
                </div>
            </div>
        );
    }

    if (error || !sermon) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-4 p-4">
                <FileText className="h-16 w-16 text-muted-foreground" />
                <h2 className="text-2xl font-semibold text-center">{error || 'Sermón no encontrado'}</h2>
                <p className="text-muted-foreground text-center max-w-md">
                    El enlace que intentas acceder puede ser incorrecto o el sermón ha dejado de ser compartido.
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Top Bar with Tools */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 h-14 flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-lg">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <span className="hidden sm:inline">DosFilos</span>
                </div>
                
                <div className="flex items-center gap-4">
                    {/* Font Size Controls */}
                    <div className="flex items-center gap-1 bg-muted/30 rounded-full px-2 py-1 border">
                        <Type className="h-3 w-3 text-muted-foreground ml-1" />
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFontSize(s => Math.max(14, s - 1))}>
                            <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-xs w-6 text-center tabular-nums">{fontSize}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFontSize(s => Math.min(24, s + 1))}>
                            <Plus className="h-3 w-3" />
                        </Button>
                    </div>

                    <Button onClick={handleExport} disabled={exporting} variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                        <Download className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">{exporting ? 'Exportando...' : 'PDF'}</span>
                    </Button>
                </div>
            </div>

            <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-8">
                {/* Header */}
                <div className="text-center space-y-8 pb-8 border-b">
                    <div className="space-y-4">
                        <div className="flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-[0.2em]">
                            <span>{new Date(sermon.createdAt).toLocaleDateString('es-ES', { dateStyle: 'long' })}</span>
                            <span className="text-border">•</span>
                            <span>{sermon.authorName || 'Pastor'}</span>
                        </div>
                        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight font-serif text-foreground leading-tight">
                            {sermon.title}
                        </h1>
                    </div>

                    {/* Bible References Chips */}
                    {sermon.bibleReferences.length > 0 && (
                        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                            {sermon.bibleReferences.map((ref, index) => (
                                <div 
                                    key={index} 
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning/10 text-foreground border border-warning/30 text-sm font-medium shadow-sm cursor-pointer hover:bg-warning/15 transition-colors"
                                    onClick={() => setSelectedReference(ref)}
                                >
                                    <BookOpen className="h-3.5 w-3.5 text-warning" />
                                    {ref}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div 
                    className="prose prose-lg max-w-none dark:prose-invert sermon-content transition-all duration-200 font-serif leading-relaxed"
                    style={{ fontSize: `${fontSize}px` }}
                >
                    <ReactMarkdown components={components}>
                        {processContent(sermon.content)}
                    </ReactMarkdown>
                </div>

                {/* Footer Info */}
                <div className="pt-12 border-t space-y-8">
                    {(sermon.tags.length > 0 || sermon.category) && (
                        <div className="flex flex-wrap gap-2 justify-center">
                            {sermon.category && (
                                <Badge variant="outline" className="text-sm py-1 px-3 border-primary/20 bg-primary/5">
                                    {sermon.category}
                                </Badge>
                            )}
                            {sermon.tags.map((tag, i) => (
                                <Badge key={i} variant="outline" className="text-sm py-1 px-3">
                                    {tag}
                                </Badge>
                            ))}
                        </div>
                    )}
                    
                    <div className="text-center text-sm text-muted-foreground">
                        <p>Generado con <span className="font-semibold text-primary">DosFilos.Preach</span></p>
                    </div>
                </div>
            </div>

            {/* Bible Verse Dialog */}
            <Dialog open={!!selectedReference} onOpenChange={(open) => !open && setSelectedReference(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-primary" />
                            {selectedReference}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4 min-h-[100px]">
                        {loadingBible ? (
                            <div className="flex justify-center py-8">
                                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : (
                            <div className="text-lg leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
                                {bibleText}
                            </div>
                        )}
                        <div className="mt-4 text-xs text-muted-foreground text-right">
                            Fuente: Reina Valera 1960
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
