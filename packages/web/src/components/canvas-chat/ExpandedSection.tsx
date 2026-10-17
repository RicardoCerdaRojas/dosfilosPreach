import { useState, Fragment, ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, History, Undo2, Redo2, Check, Pencil, BookOpen } from 'lucide-react';
import { SectionConfig } from './section-configs';
import { HistoryModal } from './HistoryModal';
import { MarkdownRenderer } from './MarkdownRenderer';
import { BiblePassageViewer } from '@/components/bible/BiblePassageViewer';
import { LocalBibleService } from '@/services/LocalBibleService';
import { SectionVersion } from '@/hooks/useContentHistory';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { MarkdownEditor } from '@/components/ui/MarkdownEditor';

// Bible reference pattern to detect scripture references in text
const BIBLE_REF_PATTERN = /(?:^|[^\wáéíóúñ])((?:[1-3]\s?)?(?:Génesis|Genesis|Gén|Gen|Gn|Éxodo|Exodo|Éx|Ex|Levítico|Levitico|Lev|Lv|Números|Numeros|Núm|Num|Nm|Deuteronomio|Deut|Dt|Josué|Josue|Jos|Jueces|Jue|Jc|Rut|Rt|Samuel|Sam|S|Reyes|Rey|R|Crónicas|Cronicas|Cr|Esdras|Esd|Ezr|Nehemías|Nehemias|Neh|Ne|Ester|Est|Et|Job|Jb|Salmos?|Sal|Sl|Ps|Proverbios|Prov|Pr|Prv|Eclesiastés|Eclesiastes|Ecl|Ec|Cantares|Cantar|Cnt|Ct|Isaías|Isaias|Is|Isa|Jeremías|Jeremias|Jer|Jr|Lamentaciones|Lam|Lm|Ezequiel|Ezeq|Ez|Daniel|Dan|Dn|Oseas|Os|Joel|Jl|Amós|Amos|Am|Abdías|Abdias|Abd|Ab|Jonás|Jonas|Jon|Miqueas|Miq|Mi|Nahúm|Nahum|Nah|Na|Habacuc|Hab|Sofonías|Sofonias|Sof|Hageo|Hag|Zacarías|Zacarias|Zac|Zc|Malaquías|Malaquias|Mal|Mateo|Mat|Mt|Marcos|Mar|Mc|Mr|Lucas|Luc|Lc|Juan|Jn|Hechos|Hch|Hec|Romanos|Rom|Ro|Rm|Corintios|Cor|Co|Gálatas|Galatas|Gál|Gal|Ga|Efesios|Ef|Efe|Filipenses|Fil|Fp|Colosenses|Col|Tesalonicenses|Tes|Ts|Timoteo|Tim|Ti|Tito|Tit|Filemón|Filemon|Flm|Flmn|Hebreos|Heb|He|Santiago|Sant|Stg|Pedro|Ped|Pe|P|Judas|Jud|Apocalipsis|Apoc|Ap)\s*\d+[:.]\d+(?:[-–]\d+)?)/gi;

/**
 * Props for ExpandedSection component
 */
interface ExpandedSectionProps {
  section: SectionConfig;
  content: any;
  onClose: () => void;
  onViewHistory?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isModified?: boolean;
  // History modal props
  versions?: SectionVersion[];
  currentVersionId?: string;
  onRestoreVersion?: (versionId: string) => void;
  /**
   * Abre el historial apenas se monta la sección.
   *
   * El botón de historial vive DENTRO de esta vista, así que quien llega desde
   * fuera —el aviso tras regenerar, o el indicador de la tarjeta— necesita que
   * se abra solo. Sin esto, el pastor aterriza en la sección expandida y
   * todavía tiene que encontrar el botón: el mismo problema que veníamos a
   * resolver, un paso más adelante.
   */
  initialShowHistory?: boolean;
  onSave?: (newContent: any) => void;
  onRegenerate?: (itemIndex?: number) => void;
}

/**
 * ExpandedSection Component
 * Single Responsibility: Display full section content when expanded
 * 
 * Shows the complete content of a section in focus mode
 */
export function ExpandedSection({
  section,
  content,
  onClose,
  onViewHistory,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  isModified = false,
  versions = [],
  currentVersionId,
  onRestoreVersion,
  initialShowHistory = false,
  onSave,
  onRegenerate
}: ExpandedSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState<string>('');
  const [showHistoryModal, setShowHistoryModal] = useState(initialShowHistory);
  const [selectedReference, setSelectedReference] = useState<string | null>(null);

  // Helper function to render text with clickable Bible references
  const renderTextWithBibleLinks = (text: string): ReactNode => {
    if (typeof text !== 'string') return String(text);
    
    // Helper to parse bold text
    const parseBold = (content: string): ReactNode => {
      const parts = content.split(/(\*\*[^*]+\*\*)/g);
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
        }
        return part;
      });
    };

    const parts: ReactNode[] = [];
    let lastIndex = 0;
    
    BIBLE_REF_PATTERN.lastIndex = 0;
    
    let match;
    while ((match = BIBLE_REF_PATTERN.exec(text)) !== null) {
      const fullMatch = match[1];
      if (!fullMatch) continue;
      
      const startIndex = text.indexOf(fullMatch, lastIndex);
      if (startIndex === -1) continue;
      
      // Validate that this is a parseable reference
      const isValid = LocalBibleService.parseReference(fullMatch.trim()) !== null;
      if (!isValid) continue;
      
      // Add text before the match (parsed for bold)
      if (startIndex > lastIndex) {
        parts.push(parseBold(text.substring(lastIndex, startIndex)));
      }
      
      // Add the clickable reference
      const ref = fullMatch.trim();
      parts.push(
        <button
          key={`ref-${startIndex}-${ref}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedReference(ref);
          }}
          className={cn(
            "inline-flex items-center gap-0.5 text-primary font-medium",
            "hover:underline decoration-dotted underline-offset-2",
            "cursor-pointer transition-colors hover:text-primary/80",
            "bg-primary/5 px-1 py-0.5 rounded"
          )}
          title={`Ver ${ref}`}
        >
          <BookOpen className="h-3 w-3 flex-shrink-0" />
          <span>{ref}</span>
        </button>
      );
      
      lastIndex = startIndex + fullMatch.length;
    }
    
    // Add remaining text (parsed for bold)
    if (lastIndex < text.length) {
      parts.push(parseBold(text.substring(lastIndex)));
    }
    
    return parts.length > 0 ? (
      <>
        {parts.map((part, index) => (
          <Fragment key={index}>{part}</Fragment>
        ))}
      </>
    ) : parseBold(text);
  };


  // Translation map for common field names
  const fieldTranslations: Record<string, string> = {
    // Sermon Points
    point: 'Punto',
    content: 'Contenido',
    illustration: 'Ilustración',
    // Exegesis Keywords
    original: 'Original',
    transliteration: 'Transliteración',
    lemma: 'Lema (Raíz)',
    literalTranslation: 'Traducción Literal',
    morphology: 'Morfología',
    syntacticFunction: 'Función Sintáctica',
    significance: 'Significado',
    audience: 'Audiencia',
    historical: 'Histórico',
    literary: 'Literario'
  };

  const translateFieldName = (key: string): string => {
    return fieldTranslations[key] || key.charAt(0).toUpperCase() + key.slice(1);
  };

  // Define preferred field order for keywords and sermon points
  const fieldOrder = [
    // Sermon Points
    'point',
    'content',
    'illustration',
    // Exegesis Keywords
    'original',
    'transliteration',
    'lemma',
    'literalTranslation',
    'morphology',
    'syntacticFunction',
    'significance'
  ];

  const sortObjectEntries = (entries: [string, any][]): [string, any][] => {
    return entries.sort((a, b) => {
      const indexA = fieldOrder.indexOf(a[0]);
      const indexB = fieldOrder.indexOf(b[0]);
      
      // If both are in the order list, sort by their position
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      // If only A is in the list, it comes first
      if (indexA !== -1) return -1;
      // If only B is in the list, it comes first
      if (indexB !== -1) return 1;
      // If neither is in the list, maintain original order
      return 0;
    });
  };

  // Granular Editing State (Generic for Arrays and Outline)
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editItemContent, setEditItemContent] = useState<any>(null);

  const handleUpdateItem = (field: string | null, value: any) => {
    // Handle Outline (Array of Objects)
    if (section.id === 'outline') {
      if (!editItemContent) return;
      
      if (field === 'scriptureReferences') {
        const refs = value.split(',').map((r: string) => r.trim()).filter((r: string) => r);
        setEditItemContent({ ...editItemContent, [field]: refs });
      } else if (field) {
        setEditItemContent({ ...editItemContent, [field]: value });
      }
      return;
    }

    // Handle Array Sections
    if (section.type === 'array') {
      if (typeof editItemContent === 'object' && editItemContent !== null && field) {
        // It's an object item (like Keyword)
        setEditItemContent({ ...editItemContent, [field]: value });
      } else {
        // It's a simple string item
        setEditItemContent(value);
      }
    }
  };

  const handleSaveItem = () => {
    if (editingItemIndex === null || !editItemContent || !onSave) return;

    // Clone the full content
    let newContent = JSON.parse(JSON.stringify(content));
    
    if (section.type === 'array') {
      // Handle simple array
      if (Array.isArray(newContent)) {
        newContent[editingItemIndex] = editItemContent;
        onSave(newContent);
      }
    } else if (section.id === 'outline' && newContent.mainPoints) {
      // Handle Outline
      newContent.mainPoints[editingItemIndex] = editItemContent;
      onSave(newContent);
    }

    setEditingItemIndex(null);
    setEditItemContent(null);
  };

  const handleStartEdit = () => {
    if (section.type === 'text' && typeof content === 'string') {
      setEditContent(content);
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    if (onSave) {
      onSave(editContent);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditContent('');
  };

  const renderFullContent = () => {
    // console.log(`🎯 ExpandedSection [${section.id}] rendering, type:`, section.type);
    
    if (isEditing && section.type === 'text') {
      return (
        <div className="space-y-4 h-full flex flex-col">
          <MarkdownEditor
            value={editContent}
            onChange={setEditContent}
            placeholder="Escribe el contenido aquí usando markdown..."
            height={500}
            preview="live"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              <Check className="mr-2 h-4 w-4" />
              Guardar Cambios
            </Button>
          </div>
        </div>
      );
    }

    if (section.type === 'text') {
      // console.log(`📝 Text content preview:`, content?.substring(0, 100));
      return <MarkdownRenderer content={content || 'Sin contenido'} reading />;
    }

    if (section.type === 'array') {
      const items = Array.isArray(content) ? content : [];
      return (
        <div className="space-y-3">
          {items.length > 0 ? (
            items.map((item, i) => {
              const isEditingItem = editingItemIndex === i;

              if (isEditingItem) {
                // Check if we are editing an object or a string
                if (typeof editItemContent === 'object' && editItemContent !== null) {
                   const sortedEntries = sortObjectEntries(Object.entries(editItemContent));
                   return (
                    <Card key={i} className="p-4 border-primary ring-1 ring-primary">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-solid text-primary-foreground flex items-center justify-center text-xs font-bold">
                            {i + 1}
                          </div>
                          <span className="font-semibold text-sm">Editando Elemento</span>
                        </div>
                        
                        <div className="space-y-3">
                          {sortedEntries.map(([key, value]) => (
                            <div key={key} className="space-y-1">
                              <Label htmlFor={`item-${i}-${key}`}>{translateFieldName(key)}</Label>
                              {(key === 'content' || key === 'illustration' || key === 'significance' || (typeof value === 'string' && value.length > 100)) ? (
                                <MarkdownEditor
                                  value={value as string}
                                  onChange={(newValue) => handleUpdateItem(key, newValue)}
                                  placeholder={`Escribe ${translateFieldName(key).toLowerCase()}...`}
                                  height={key === 'content' ? 400 : 250}
                                  preview="live"
                                />
                              ) : (typeof value === 'string' && value.length > 50) ? (
                                  <Textarea
                                    id={`item-${i}-${key}`}
                                    value={value as string}
                                    onChange={(e) => handleUpdateItem(key, e.target.value)}
                                    className="min-h-[80px]"
                                  />
                              ) : (
                                <Input
                                  id={`item-${i}-${key}`}
                                  value={value as string}
                                  onChange={(e) => handleUpdateItem(key, e.target.value)}
                                />
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEditingItemIndex(null)}>
                            Cancelar
                          </Button>
                          <Button size="sm" onClick={handleSaveItem}>
                            <Check className="mr-2 h-4 w-4" />
                            Guardar
                          </Button>
                        </div>
                      </div>
                    </Card>
                   );
                }

              // Editing a simple string
                return (
                  <Card key={i} className="p-4 border-primary ring-1 ring-primary">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-solid text-primary-foreground flex items-center justify-center text-xs font-bold">
                          {i + 1}
                        </div>
                        <span className="font-semibold text-sm">Editando Elemento</span>
                      </div>
                      
                      <Textarea
                        value={editItemContent || ''}
                        onChange={(e) => handleUpdateItem(null, e.target.value)}
                        className="min-h-[80px]"
                        placeholder="Contenido del elemento..."
                      />

                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditingItemIndex(null)}>
                          Cancelar
                        </Button>
                        <Button size="sm" onClick={handleSaveItem}>
                          <Check className="mr-2 h-4 w-4" />
                          Guardar
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              }

              // Special rendering for keywords section with table format
              if (section.id === 'keywords' && typeof item === 'object' && item !== null) {
                const keyword = item as any;
                return (
                  <Card key={i} className="p-4 bg-muted/30 group relative hover:border-primary/50 transition-colors space-y-4">
                    {onSave && !isEditing && (
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingItemIndex(i);
                            setEditItemContent(JSON.parse(JSON.stringify(item)));
                          }}
                          title="Editar este elemento"
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    
                    {/* Table Row: Original, Transliteración, Lema, Traducción */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-border/50">
                            <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Original</th>
                            <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Transliteración</th>
                            <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Lema (Raíz)</th>
                            <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Traducción Literal</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="py-2 px-3 font-medium text-lg">{keyword.original || '—'}</td>
                            <td className="py-2 px-3 italic">{keyword.transliteration || '—'}</td>
                            <td className="py-2 px-3">{keyword.lemma || '—'}</td>
                            <td className="py-2 px-3">{keyword.literalTranslation || '—'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Morfología */}
                    {keyword.morphology && (
                      <div className="border-l-2 border-primary/30 pl-3">
                        <h4 className="font-semibold text-sm text-primary mb-1">Morfología</h4>
                        <MarkdownRenderer content={keyword.morphology} className="text-sm" />
                      </div>
                    )}
                    
                    {/* Función Sintáctica */}
                    {keyword.syntacticFunction && (
                      <div className="border-l-2 border-primary/30 pl-3">
                        <h4 className="font-semibold text-sm text-primary mb-1">Función Sintáctica</h4>
                        <MarkdownRenderer content={keyword.syntacticFunction} className="text-sm" />
                      </div>
                    )}
                    
                    {/* Significado */}
                    {keyword.significance && (
                      <div className="border-l-2 border-primary/30 pl-3">
                        <h4 className="font-semibold text-sm text-primary mb-1">Significado</h4>
                        <MarkdownRenderer content={keyword.significance} className="text-sm" />
                      </div>
                    )}
                  </Card>
                );
              }

              // If item is an object, render it as a card with key-value pairs
              if (typeof item === 'object' && item !== null) {
                const sortedEntries = sortObjectEntries(Object.entries(item));
                return (
                  <Card key={i} className="p-4 bg-muted/30 group relative hover:border-primary/50 transition-colors">
                    {onSave && !isEditing && (
                      <div className="absolute top-2 right-2 z-10 flex gap-1 bg-background/80 backdrop-blur-sm rounded-md p-1 border shadow-sm">
                        {onRegenerate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRegenerate(i)}
                            title="Regenerar este punto"
                            className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
                          >
                            <Redo2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingItemIndex(i);
                            setEditItemContent(JSON.parse(JSON.stringify(item)));
                          }}
                          title="Editar este elemento"
                          className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <div className="space-y-2">
                      {sortedEntries.map(([key, value]) => (
                        <div key={key}>
                          <span className="font-semibold text-sm text-primary">
                            {translateFieldName(key)}
                          </span>
                          {Array.isArray(value) ? (
                            <ul className="list-disc list-inside pl-2 space-y-1 mt-1">
                              {value.map((v, idx) => (
                                <li key={idx} className="text-sm">
                                  {typeof v === 'string' ? renderTextWithBibleLinks(v) : JSON.stringify(v)}
                                </li>
                              ))}
                            </ul>
                          ) : typeof value === 'string' ? (
                            // Use MarkdownRenderer for content, illustration, and other long text fields
                            (key === 'content' || key === 'illustration' || key === 'significance' || value.length > 100) ? (
                              <div className="mt-1">
                                <MarkdownRenderer content={value} />
                              </div>
                            ) : (
                              <div className="mt-1 text-sm leading-relaxed">
                                {renderTextWithBibleLinks(value)}
                              </div>
                            )
                          ) : (
                            <p className="text-sm mt-1 text-foreground">
                              {JSON.stringify(value)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              }
              // If item is a string, render it as a list item with markdown
              return (
                <div key={i} className="group flex items-start gap-3 p-3 rounded-md border border-transparent hover:border-border hover:bg-muted/30 transition-all">
                  <div className="flex-shrink-0 w-6 h-6 mt-0.5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <MarkdownRenderer content={item} />
                  </div>
                  {onSave && !isEditing && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingItemIndex(i);
                        setEditItemContent(item);
                      }}
                      title="Editar este elemento"
                      className="flex-shrink-0 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-muted-foreground text-sm">Sin elementos</p>
          )}
        </div>
      );
    }

    if (section.type === 'object') {
      // Check if it's an outline
      if (content && Array.isArray(content.mainPoints)) {
        const points = content.mainPoints;
        
        return (
          <div className="space-y-6">
            {points.map((point: any, i: number) => {
              const isEditingPoint = editingItemIndex === i;
              
              if (isEditingPoint) {
                return (
                  <Card key={i} className="p-6 border-primary ring-1 ring-primary">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-solid text-primary-foreground flex items-center justify-center font-bold">
                            {i + 1}
                          </div>
                          <h3 className="font-semibold">Editando Punto {i + 1}</h3>
                        </div>
                        {onRegenerate && (
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={() => onRegenerate(i)}
                            className="gap-2"
                          >
                            <Redo2 className="h-3 w-3" />
                            Regenerar Punto
                          </Button>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label htmlFor={`point-title-${i}`}>Título</Label>
                          <Input
                            id={`point-title-${i}`}
                            value={editItemContent?.title || ''}
                            onChange={(e) => handleUpdateItem('title', e.target.value)}
                            placeholder="Título del punto"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor={`point-desc-${i}`}>Descripción</Label>
                          <Textarea
                            id={`point-desc-${i}`}
                            value={editItemContent?.description || ''}
                            onChange={(e) => handleUpdateItem('description', e.target.value)}
                            className="min-h-[100px]"
                            placeholder="Desarrollo del punto"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor={`point-refs-${i}`}>Referencias Bíblicas (separadas por coma)</Label>
                          <Input
                            id={`point-refs-${i}`}
                            value={editItemContent?.scriptureReferences?.join(', ') || ''}
                            onChange={(e) => handleUpdateItem('scriptureReferences', e.target.value)}
                            placeholder="Ej: Juan 3:16, Romanos 5:8"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={() => setEditingItemIndex(null)}>
                          Cancelar
                        </Button>
                        <Button size="sm" onClick={handleSaveItem}>
                          <Check className="mr-2 h-4 w-4" />
                          Guardar Punto
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              }

              return (
                <Card key={i} className="p-6 group relative hover:border-primary/50 transition-colors">
                  {onSave && !isEditing && (
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingItemIndex(i);
                          setEditItemContent(JSON.parse(JSON.stringify(point)));
                        }}
                        title="Editar este punto"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                      {i + 1}
                    </div>
                    <div className="flex-1 space-y-3">
                      <h3 className="text-lg font-semibold pr-8">{renderTextWithBibleLinks(point.title)}</h3>
                      <div className="markdown-content">
                        {/* We can't easily use MarkdownRenderer with the link replacer, so we use the helper for description if it's plain text, 
                            or just render it as markdown if it's complex. For now, let's try to render description with links if it's simple text */}
                        <MarkdownRenderer content={point.description} />
                      </div>
                      
                      {point.scriptureReferences && point.scriptureReferences.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {point.scriptureReferences.map((ref: string, j: number) => (
                            <button
                              key={j}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedReference(ref);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                              title={`Ver ${ref}`}
                            >
                              <BookOpen className="h-3 w-3" />
                              {ref}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        );
      }

      return (
        <pre className="text-sm bg-muted p-4 rounded overflow-auto">
          {JSON.stringify(content, null, 2)}
        </pre>
      );
    }

    return null;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="flex-shrink-0"
          >
            <X className="h-4 w-4 mr-1" />
            Cerrar
          </Button>
          
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-lg truncate">{section.label}</h2>
            {section.description && (
              <p className="text-sm text-muted-foreground truncate">
                {section.description}
              </p>
            )}
          </div>

          {isModified && (
            <Badge variant="outline" className="flex-shrink-0">
              Modificado
            </Badge>
          )}

          {/* Edit Button - Only for text sections for now */}
          {section.type === 'text' && onSave && !isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStartEdit}
              className="flex-shrink-0"
              title="Editar manualmente"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}

          {/* Undo/Redo buttons */}
          <div className="flex gap-1 flex-shrink-0">
            {onUndo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onUndo}
                disabled={!canUndo || isEditing}
                title="Deshacer"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            )}
            {onRedo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRedo}
                disabled={!canRedo || isEditing}
                title="Rehacer"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {versions.length > 0 && onRestoreVersion && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistoryModal(true)}
              className="flex-shrink-0"
              disabled={isEditing}
            >
              <History className="h-3 w-3 mr-1" />
              Historial ({versions.length})
            </Button>
          )}
        </div>
      </div>

      {/* Content - with proper overflow */}
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        {renderFullContent()}
      </div>

      {/* History Modal */}
      {onRestoreVersion && (
        <HistoryModal
          open={showHistoryModal}
          onOpenChange={setShowHistoryModal}
          section={section}
          versions={versions}
          currentVersionId={currentVersionId}
          onRestore={onRestoreVersion}
        />
      )}

      {/* Bible Passage Viewer Dialog */}
      <BiblePassageViewer
        reference={selectedReference}
        onClose={() => setSelectedReference(null)}
      />
    </div>
  );
}
