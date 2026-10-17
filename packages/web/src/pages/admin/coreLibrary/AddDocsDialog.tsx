import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload, AlertTriangle, CheckCircle } from 'lucide-react';
import { categoryService, coreLibraryAdminService, libraryService } from '@dosfilos/application';
import type { LibraryCategory, ResourceType } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/** Por encima de esto la extracción se vuelve lenta y cara; se avisa, no se impide. */
const MAX_OPTIMAL_SIZE_MB = 50;

interface Props {
    open: boolean;
    /** Almacén al que se añaden o sube el documento. */
    contextKey: string;
    userId: string | undefined;
    onClose: () => void;
    /** Tras añadir o subir, para que el padre recargue lo que muestra. */
    onDone: () => void | Promise<void>;
}

/**
 * Añadir documentos al corpus base: enlazando los que ya están en la biblioteca,
 * o subiendo uno nuevo.
 *
 * TODO SU ESTADO VIVE ACÁ — nueve piezas que antes eran estado de un componente
 * de 2.400 líneas. Escribir el título de un archivo que se está subiendo
 * repintaba la página entera, listas de documentos de todos los almacenes
 * incluidas; ahora sólo se redibuja este diálogo.
 *
 * LOS DOCUMENTOS SE CARGAN AL ABRIR, no al montar. La lista depende del almacén
 * y de lo que ya esté enlazado, así que pedirla antes de que el diálogo se abra
 * sería traer datos que suelen no mirarse nunca.
 */
export function AddDocsDialog({ open, contextKey, userId, onClose, onDone }: Props) {
    const [availableDocs, setAvailableDocs] = useState<any[]>([]);
    const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
    const [isLoadingDocs, setIsLoadingDocs] = useState(false);
    const [isAddingDocs, setIsAddingDocs] = useState(false);
    const [categories, setCategories] = useState<LibraryCategory[]>([]);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadMetadata, setUploadMetadata] = useState({ title: '', author: '', type: 'theology' as ResourceType });
    const [isUploading, setIsUploading] = useState(false);
    const [fileSizeWarning, setFileSizeWarning] = useState(false);

    useEffect(() => {
        if (!open || !userId) return;
        categoryService.getCategories(userId).then(setCategories).catch(console.error);
    }, [open, userId]);

    /** Recarga los elegibles: los de su biblioteca que NO estén ya enlazados acá. */
    const cargarDisponibles = async () => {
        if (!userId) return;
        setIsLoadingDocs(true);
        try {
            const docs = await coreLibraryAdminService.getUserResources(userId);
            setAvailableDocs(docs.filter((d) => !d.coreStores?.includes(contextKey)));
        } catch (error: any) {
            toast.error('Error cargando documentos: ' + error.message);
        } finally {
            setIsLoadingDocs(false);
        }
    };

    useEffect(() => {
        if (!open) return;
        setSelectedDocs(new Set());
        void cargarDisponibles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, contextKey, userId]);

    const anadirSeleccionados = async () => {
        if (selectedDocs.size === 0) return;
        setIsAddingDocs(true);
        try {
            await coreLibraryAdminService.addResourcesToStore(Array.from(selectedDocs), contextKey);
            toast.success(`${selectedDocs.size} documentos añadidos al store`);
            onClose();
            await onDone();
            await cargarDisponibles();
        } catch (error: any) {
            toast.error('Error al añadir documentos: ' + error.message);
        } finally {
            setIsAddingDocs(false);
        }
    };

    const alElegirArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            const validTypes = ['application/pdf', 'application/epub+zip'];
            if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(pdf|epub)$/i)) {
                toast.error('Solo se permiten archivos PDF o EPUB');
                return;
            }
            const fileSizeMB = selectedFile.size / (1024 * 1024);
            setFileSizeWarning(fileSizeMB > MAX_OPTIMAL_SIZE_MB);
            setUploadFile(selectedFile);
            setUploadMetadata((prev) => ({
                ...prev,
                title: selectedFile.name.replace(/\.[^/.]+$/, '') || '',
            }));
        }
    };

    const subir = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId || !uploadFile) return;
        setIsUploading(true);
        try {
            const resource = await libraryService.uploadResource(userId, uploadFile, uploadMetadata);
            await coreLibraryAdminService.addResourceToStore(resource.id, contextKey);
            toast.success(`Documento subido y añadido a ${contextKey}. Procesando en segundo plano...`);
            setUploadFile(null);
            setFileSizeWarning(false);
            setUploadMetadata({ title: '', author: '', type: 'theology' });
            onClose();
            await onDone();
            // La extracción + indexado disparan solos por el trigger de Storage.
        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error('Error al subir el recurso: ' + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Añadir Documentos al Store</DialogTitle>
                    <DialogDescription>
                        Selecciona documentos existentes de tu biblioteca o sube uno nuevo.
                    </DialogDescription>
                </DialogHeader>
                
                <Tabs defaultValue="select" className="flex-1 flex flex-col min-h-0 mt-4">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="select">Seleccionar de Biblioteca</TabsTrigger>
                        <TabsTrigger value="upload">Subir Nuevo Documento</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="select" className="flex-1 overflow-hidden flex flex-col mt-0 data-[state=inactive]:hidden">
                        <div className="flex-1 overflow-y-auto border rounded-md">
                            {isLoadingDocs ? (
                                <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                            ) : availableDocs.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">No hay documentos disponibles en tu biblioteca para añadir.</div>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                        <TableRow>
                                            <TableHead className="w-[50px] text-center">
                                                <CheckCircle className="h-4 w-4 mx-auto text-muted-foreground" />
                                            </TableHead>
                                            <TableHead>Nombre</TableHead>
                                            <TableHead>Autor</TableHead>
                                            <TableHead>Páginas</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {availableDocs.map(doc => {
                                            const isSelected = selectedDocs.has(doc.id);
                                            return (
                                                <TableRow 
                                                    key={doc.id}
                                                    className={cn("cursor-pointer", isSelected && "bg-primary/5")}
                                                    onClick={() => {
                                                        const newSet = new Set(selectedDocs);
                                                        if (isSelected) newSet.delete(doc.id);
                                                        else newSet.add(doc.id);
                                                        setSelectedDocs(newSet);
                                                    }}
                                                >
                                                    <TableCell className="text-center">
                                                        <div className={cn("h-4 w-4 mx-auto rounded-sm border flex items-center justify-center shrink-0", isSelected ? "bg-primary-solid border-primary text-primary-foreground" : "border-muted-foreground")}>
                                                            {isSelected && <CheckCircle className="h-3 w-3" />}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-medium">{doc.title}</TableCell>
                                                    <TableCell className="text-muted-foreground">{doc.author || '---'}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{doc.metadata?.pages || 0} pág</Badge>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </div>

                        <div className="flex justify-end pt-4 mt-auto">
                            <Button variant="outline" className="mr-2" onClick={() => onClose()}>Cancelar</Button>
                            <Button 
                                onClick={() => anadirSeleccionados()} 
                                disabled={isAddingDocs || selectedDocs.size === 0}
                            >
                                {isAddingDocs && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Añadir {selectedDocs.size > 0 ? `(${selectedDocs.size})` : ''} Documentos
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="upload" className="flex-1 overflow-y-auto mt-0 data-[state=inactive]:hidden px-1">
                        <form onSubmit={(e) => subir(e)} className="space-y-4 pt-2">
                            <div className="space-y-2">
                                <Label htmlFor="file">Archivo</Label>
                                <Input 
                                    id="file" 
                                    type="file" 
                                    accept=".pdf,.epub"
                                    onChange={alElegirArchivo}
                                    required
                                />
                                {fileSizeWarning && (
                                    <Alert variant="destructive" className="bg-warning/5 border-warning/30 py-2">
                                        <AlertTriangle className="h-3 w-3 text-warning" />
                                        <AlertDescription className="text-warning text-xs">
                                            Archivo &gt;50MB: calidad reducida o posible rechazo de la API de IA.
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="title">Título</Label>
                                <Input 
                                    id="title" 
                                    value={uploadMetadata.title}
                                    onChange={e => setUploadMetadata({...uploadMetadata, title: e.target.value})}
                                    placeholder="Título del documento"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="author">Autor</Label>
                                <Input 
                                    id="author" 
                                    value={uploadMetadata.author}
                                    onChange={e => setUploadMetadata({...uploadMetadata, author: e.target.value})}
                                    placeholder="Nombre del autor"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="type">Categoría</Label>
                                <Select 
                                    value={uploadMetadata.type} 
                                    onValueChange={(v: ResourceType) => setUploadMetadata({...uploadMetadata, type: v})}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona una categoría" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map((cat) => (
                                            <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="flex justify-end pt-4 border-t mt-4">
                                <Button type="button" variant="outline" className="mr-2" onClick={() => onClose()}>Cancelar</Button>
                                <Button type="submit" disabled={isUploading || !uploadFile}>
                                    {isUploading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Upload className="mr-2 h-4 w-4" />
                                    )}
                                    Subir y Añadir a Store
                                </Button>
                            </div>
                        </form>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
