import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ArrowLeft, Plus, X, Camera, Paperclip, Save, Trash2, PenTool } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Defect, DefectStatus, DefectAttachment, Role } from '../types';
import { getUserRole, canCreateDefect, canEditDefect, canDeleteDefect, canChangeDefectStatus } from '../lib/permissions';
import { cn } from '../lib/utils';
import { DriveImage } from '../components/DriveImage';
import { getDriveFileId, useDriveFile } from '../hooks/useDriveFile';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { ImageAnnotator } from '../components/ImageAnnotator';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function DrawingViewer() {
  const { projectId, drawingId } = useParams<{ projectId: string, drawingId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { projects, drawings, defects, addDefect, updateDefect, deleteDefect, user } = useStore();
  
  const project = projects.find(p => p.id === projectId);
  const drawing = drawings.find(d => d.id === drawingId);
  const { blobUrl: drawingBlobUrl } = useDriveFile(drawing?.url || '');
  const drawingDefects = defects.filter(d => d.drawingId === drawingId && d.x !== undefined && d.y !== undefined);
  
  const userRole = project && user ? getUserRole(project, user.email) : null;
  
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.5);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeDefect, setActiveDefect] = useState<Partial<Defect> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingDefect, setIsSavingDefect] = useState(false);
  const [isDeletingDefect, setIsDeletingDefect] = useState(false);
  const [annotatingAttachmentId, setAnnotatingAttachmentId] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const defectId = searchParams.get('defectId');
    if (defectId) {
      const defect = drawingDefects.find(d => d.id === defectId);
      if (defect) {
        setActiveDefect(defect);
        setIsCreating(false);
      }
    }
  }, [location.search, drawingDefects]);

  // Handle resize for PDF scaling
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeDefect && !isCreating) {
      setActiveDefect(null);
      return;
    }

    if (!canCreateDefect(userRole)) {
      alert('You do not have permission to create defects.');
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const newDefect: Partial<Defect> = {
      id: uuidv4(),
      projectId: projectId!,
      drawingId: drawingId!,
      x,
      y,
      status: 'Open',
      title: '',
      description: '',
      assignee: '',
      attachments: [],
      createdBy: user?.name || 'Unknown',
      createdAt: new Date().toISOString(),
    };

    setActiveDefect(newDefect);
    setIsCreating(true);
  };

  const handlePinClick = (e: React.MouseEvent, defect: Defect) => {
    e.stopPropagation();
    setActiveDefect(defect);
    setIsCreating(false);
  };

  const handleSaveDefect = async () => {
    if (!activeDefect || !activeDefect.title) {
      alert('Please enter a title for the defect.');
      return;
    }

    setIsSavingDefect(true);
    try {
      if (isCreating) {
        if (!canCreateDefect(userRole)) {
          alert('You do not have permission to create defects.');
          return;
        }
        await addDefect(activeDefect as Defect);
      } else {
        const originalDefect = drawingDefects.find(d => d.id === activeDefect.id);
        if (!originalDefect) return;

        const canEdit = canEditDefect(userRole, originalDefect, user?.email || '');
        const canChangeStatus = canChangeDefectStatus(userRole, activeDefect.status as DefectStatus, originalDefect, user?.email || '');

        if (!canEdit && !canChangeStatus) {
          if (originalDefect && activeDefect.status === originalDefect.status) {
            setActiveDefect(null);
            setIsCreating(false);
            setIsSavingDefect(false);
            return;
          }
          alert('You do not have permission to edit this defect.');
          return;
        }

        const updates: any = {};
        if (canEdit) {
          updates.title = activeDefect.title;
          updates.description = activeDefect.description;
          updates.assignee = activeDefect.assignee;
          updates.attachments = activeDefect.attachments;
        }
        if (canChangeStatus) {
          updates.status = activeDefect.status;
        }

        await updateDefect(activeDefect.id!, updates);
      }

      setActiveDefect(null);
      setIsCreating(false);
    } finally {
      setIsSavingDefect(false);
    }
  };

  const handleDeleteDefect = async () => {
    if (!activeDefect?.id) return;
    
    const originalDefect = drawingDefects.find(d => d.id === activeDefect.id);
    if (!originalDefect || !canDeleteDefect(userRole, originalDefect, user?.email || '')) {
      alert('You do not have permission to delete this defect.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this defect?')) {
      setIsDeletingDefect(true);
      try {
        await deleteDefect(activeDefect.id);
        setActiveDefect(null);
        setIsCreating(false);
      } finally {
        setIsDeletingDefect(false);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !activeDefect) return;

    const newAttachments: DefectAttachment[] = Array.from(files).map((file: File) => ({
      id: uuidv4(),
      name: file.name,
      url: URL.createObjectURL(file),
      type: file.type,
      file: file,
    }));

    setActiveDefect(prev => ({
      ...prev!,
      attachments: [...(prev?.attachments || []), ...newAttachments]
    }));
  };

  if (!drawing) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-zinc-900">Drawing not found</h2>
          <button onClick={() => navigate('/drawings')} className="mt-4 text-lidl-blue-600 hover:underline">
            Back to Drawings
          </button>
        </div>
      </div>
    );
  }

  const isPdf = drawing.name.toLowerCase().endsWith('.pdf');

  return (
    <div className="flex-1 flex overflow-hidden bg-zinc-100">
      {isSavingDefect && <LoadingOverlay message={isCreating ? "Creating defect..." : "Saving defect..."} />}
      {isDeletingDefect && <LoadingOverlay message="Deleting defect..." />}
      {/* Main Viewer Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Toolbar */}
        <div className="h-14 bg-white border-b border-zinc-200 flex items-center justify-between px-2 md:px-4 z-10 shadow-sm">
          <div className="flex items-center space-x-2 md:space-x-4">
            <button 
              onClick={() => navigate(`/projects/${projectId}`)}
              className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-base md:text-lg font-semibold text-zinc-900 truncate max-w-[120px] sm:max-w-[200px] md:max-w-md">{drawing.name}</h1>
          </div>
          
          <div className="flex items-center space-x-1 md:space-x-2">
            <button 
              onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
              className="px-2 md:px-3 py-1.5 text-xs md:text-sm font-medium text-zinc-700 bg-zinc-100 rounded-md hover:bg-zinc-200"
            >
              -
            </button>
            <span className="text-xs md:text-sm font-medium text-zinc-500 w-10 md:w-12 text-center">{Math.round(scale * 100)}%</span>
            <button 
              onClick={() => setScale(s => Math.min(3, s + 0.25))}
              className="px-2 md:px-3 py-1.5 text-xs md:text-sm font-medium text-zinc-700 bg-zinc-100 rounded-md hover:bg-zinc-200"
            >
              +
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div 
          className="flex-1 overflow-auto relative bg-zinc-200/50 p-2 md:p-8 flex justify-center"
          ref={containerRef}
        >
          <div 
            className="relative bg-white shadow-xl ring-1 ring-zinc-900/5 cursor-crosshair inline-block"
            onClick={handleCanvasClick}
            style={{ 
              transformOrigin: 'top center',
            }}
          >
            {isPdf ? (
              <Document
                file={
                  drawingBlobUrl || (getDriveFileId(drawing.url)
                    ? {
                        url: `https://www.googleapis.com/drive/v3/files/${getDriveFileId(drawing.url)}?alt=media`,
                        httpHeaders: { Authorization: `Bearer ${user?.accessToken}` }
                      }
                    : drawing.url) as any
                }
                onLoadSuccess={onDocumentLoadSuccess}
                loading={<div className="p-12 text-zinc-500">Loading PDF...</div>}
                error={<div className="p-12 text-red-500">Failed to load PDF. Please try another file.</div>}
              >
                <Page 
                  pageNumber={pageNumber} 
                  scale={scale} 
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="shadow-sm"
                />
              </Document>
            ) : (
              <DriveImage 
                src={drawing.url} 
                alt={drawing.name} 
                className="max-w-none"
                style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
              />
            )}

            {/* Render Pins */}
            {drawingDefects.map((defect) => (
              <div
                key={defect.id}
                className={cn(
                  "absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white shadow-md flex items-center justify-center cursor-pointer transform transition-transform hover:scale-125 z-20",
                  defect.status === 'Open' ? 'bg-red-500' :
                  defect.status === 'Waiting for feedback' ? 'bg-blue-500' :
                  'bg-lidl-blue-500',
                  activeDefect?.id === defect.id ? 'ring-4 ring-blue-500/50 scale-125' : ''
                )}
                style={{ left: `${defect.x * 100}%`, top: `${defect.y * 100}%` }}
                onClick={(e) => handlePinClick(e, defect)}
              >
                <span className="text-[10px] font-bold text-white leading-none">
                  {drawingDefects.indexOf(defect) + 1}
                </span>
              </div>
            ))}

            {/* Render Active New Pin */}
            {isCreating && activeDefect && (
              <div
                className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white bg-blue-500 shadow-md flex items-center justify-center z-30 animate-pulse ring-4 ring-blue-500/30"
                style={{ left: `${activeDefect.x! * 100}%`, top: `${activeDefect.y! * 100}%` }}
              >
                <Plus className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Defect Sidebar */}
      {activeDefect && (
        <div className="absolute md:relative right-0 top-0 bottom-0 w-full md:w-96 bg-white border-l border-zinc-200 flex flex-col shadow-2xl z-40 md:z-20">
          <div className="h-14 border-b border-zinc-200 flex items-center justify-between px-4 bg-zinc-50">
            <h2 className="text-sm font-semibold text-zinc-900">
              {isCreating ? 'New Defect' : 'Edit Defect'}
            </h2>
            <button 
              onClick={() => { setActiveDefect(null); setIsCreating(false); }}
              className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <label className="block text-xs font-medium text-zinc-700 uppercase tracking-wider mb-2">Title</label>
              <input
                type="text"
                value={activeDefect.title || ''}
                onChange={(e) => setActiveDefect({ ...activeDefect, title: e.target.value })}
                disabled={!isCreating && !canEditDefect(userRole, activeDefect as Defect, user?.email || '')}
                className="block w-full rounded-xl border-zinc-300 shadow-sm focus:border-lidl-blue-500 focus:ring-lidl-blue-500 sm:text-sm px-4 py-2.5 border bg-zinc-50 disabled:opacity-50 disabled:bg-zinc-100"
                placeholder="e.g., Cracked drywall"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 uppercase tracking-wider mb-2">Status</label>
              <select
                value={activeDefect.status || 'Open'}
                onChange={(e) => setActiveDefect({ ...activeDefect, status: e.target.value as DefectStatus })}
                className="block w-full rounded-xl border-zinc-300 shadow-sm focus:border-lidl-blue-500 focus:ring-lidl-blue-500 sm:text-sm px-4 py-2.5 border bg-zinc-50"
              >
                <option value="Open" disabled={!isCreating && !canChangeDefectStatus(userRole, 'Open', activeDefect as Defect, user?.email || '')}>Open</option>
                <option value="Waiting for feedback" disabled={!isCreating && !canChangeDefectStatus(userRole, 'Waiting for feedback', activeDefect as Defect, user?.email || '')}>Waiting for feedback</option>
                <option value="Closed" disabled={!isCreating && !canChangeDefectStatus(userRole, 'Closed', activeDefect as Defect, user?.email || '')}>Closed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 uppercase tracking-wider mb-2">Description</label>
              <textarea
                rows={4}
                value={activeDefect.description || ''}
                onChange={(e) => setActiveDefect({ ...activeDefect, description: e.target.value })}
                disabled={!isCreating && !canEditDefect(userRole, activeDefect as Defect, user?.email || '')}
                className="block w-full rounded-xl border-zinc-300 shadow-sm focus:border-lidl-blue-500 focus:ring-lidl-blue-500 sm:text-sm px-4 py-2.5 border bg-zinc-50 resize-none disabled:opacity-50 disabled:bg-zinc-100"
                placeholder="Add detailed description..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 uppercase tracking-wider mb-2">Assignee</label>
              <input
                type="text"
                value={activeDefect.assignee || ''}
                onChange={(e) => setActiveDefect({ ...activeDefect, assignee: e.target.value })}
                disabled={!isCreating && !canEditDefect(userRole, activeDefect as Defect, user?.email || '')}
                className="block w-full rounded-xl border-zinc-300 shadow-sm focus:border-lidl-blue-500 focus:ring-lidl-blue-500 sm:text-sm px-4 py-2.5 border bg-zinc-50 disabled:opacity-50 disabled:bg-zinc-100"
                placeholder="e.g., Contractor A"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-zinc-700 uppercase tracking-wider">Attachments</label>
                {(isCreating || canEditDefect(userRole, activeDefect as Defect, user?.email || '')) && (
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-medium text-lidl-blue-600 hover:text-lidl-blue-500 flex items-center"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </button>
                )}
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                multiple 
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFileUpload}
              />
              
              {activeDefect.attachments && activeDefect.attachments.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {activeDefect.attachments.map((att) => (
                    <div 
                      key={att.id} 
                      className="relative group rounded-lg overflow-hidden border border-zinc-200 bg-zinc-50 aspect-square cursor-pointer"
                      onClick={() => {
                        if (att.type.startsWith('image/')) {
                          setViewingImage(att.url);
                        } else {
                          window.open(att.url, '_blank');
                        }
                      }}
                    >
                      {att.type.startsWith('image/') ? (
                        <>
                          <DriveImage src={att.url} alt={att.name} className="w-full h-full object-cover" />
                          {att.annotations && (
                            <div className="absolute top-1 left-1 p-0.5 bg-lidl-blue-500 text-white rounded shadow-sm">
                              <PenTool className="w-2 h-2" />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAnnotatingAttachmentId(att.id);
                            }}
                            className="absolute bottom-1 left-1 right-1 py-1 bg-black/70 text-white text-[10px] font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Annotate
                          </button>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-2">
                          <Paperclip className="w-6 h-6 text-zinc-400 mb-1" />
                          <span className="text-[10px] text-zinc-500 text-center truncate w-full">{att.name}</span>
                        </div>
                      )}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDefect(prev => ({
                            ...prev!,
                            attachments: prev!.attachments!.filter(a => a.id !== att.id)
                          }));
                        }}
                        className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 border-2 border-dashed border-zinc-300 rounded-xl p-6 flex flex-col items-center justify-center text-zinc-500 hover:bg-zinc-50 hover:border-lidl-blue-500/50 transition-colors cursor-pointer"
                >
                  <Camera className="w-6 h-6 mb-2 text-zinc-400" />
                  <span className="text-xs font-medium">Click to add photos</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex space-x-3">
            {!isCreating && canDeleteDefect(userRole, activeDefect as Defect, user?.email || '') && (
              <button
                onClick={handleDeleteDefect}
                disabled={isDeletingDefect || isSavingDefect}
                className="flex-1 flex justify-center items-center py-2.5 px-4 border border-red-200 rounded-xl shadow-sm text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </button>
            )}
            {(isCreating || canEditDefect(userRole, activeDefect as Defect, user?.email || '') || canChangeDefectStatus(userRole, activeDefect.status || 'Open', activeDefect as Defect, user?.email || '')) && (
              <button
                onClick={handleSaveDefect}
                disabled={isSavingDefect || isDeletingDefect}
                className="flex-[2] flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-lidl-blue hover:bg-lidl-blue/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lidl-blue transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2" />
                {isCreating ? 'Save Defect' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Image Annotator */}
      {annotatingAttachmentId && (
        <ImageAnnotator
          imageUrl={activeDefect?.attachments?.find(a => a.id === annotatingAttachmentId)?.url || ''}
          initialAnnotations={activeDefect?.attachments?.find(a => a.id === annotatingAttachmentId)?.annotations}
          onSave={(annotations, dataUrl, file) => {
            setActiveDefect(prev => {
              if (!prev || !prev.attachments) return prev;
              return {
                ...prev,
                attachments: prev.attachments.map(a => {
                  if (a.id === annotatingAttachmentId) {
                    const newFile = file ? new File([file], a.name || 'annotated-image.png', { type: file.type }) : a.file;
                    // Clear annotations since they are now baked into the image
                    return { ...a, annotations: undefined, url: dataUrl || a.url, file: newFile };
                  }
                  return a;
                })
              };
            });
            setAnnotatingAttachmentId(null);
          }}
          onClose={() => setAnnotatingAttachmentId(null)}
        />
      )}

      {/* Image Viewer Lightbox */}
      {viewingImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <button 
            onClick={() => setViewingImage(null)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-black/50 hover:bg-black/70 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <DriveImage 
            src={viewingImage} 
            alt="Full screen view" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
