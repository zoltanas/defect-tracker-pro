import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ArrowLeft, Plus, X, Camera, Paperclip, Save, Trash2, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Defect, DefectStatus, DefectAttachment } from '../types';
import { cn } from '../lib/utils';
import { DriveImage } from '../components/DriveImage';
import { getDriveFileId } from '../hooks/useDriveFile';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function DrawingViewer() {
  const { projectId, drawingId } = useParams<{ projectId: string, drawingId: string }>();
  const navigate = useNavigate();
  const { drawings, defects, addDefect, updateDefect, deleteDefect, user } = useStore();
  
  const drawing = drawings.find(d => d.id === drawingId);
  const drawingDefects = defects.filter(d => d.drawingId === drawingId && d.x !== undefined && d.y !== undefined);
  
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
        await addDefect(activeDefect as Defect);
      } else {
        await updateDefect(activeDefect.id!, activeDefect);
      }

      setActiveDefect(null);
      setIsCreating(false);
    } finally {
      setIsSavingDefect(false);
    }
  };

  const handleDeleteDefect = async () => {
    if (!activeDefect?.id) return;
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
          <button onClick={() => navigate('/drawings')} className="mt-4 text-emerald-600 hover:underline">
            Back to Drawings
          </button>
        </div>
      </div>
    );
  }

  const isPdf = drawing.name.toLowerCase().endsWith('.pdf');

  return (
    <div className="flex-1 flex overflow-hidden bg-zinc-100">
      {/* Main Viewer Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Toolbar */}
        <div className="h-14 bg-white border-b border-zinc-200 flex items-center justify-between px-4 z-10 shadow-sm">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => navigate(`/projects/${projectId}`)}
              className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-zinc-900 truncate max-w-md">{drawing.name}</h1>
          </div>
          
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
              className="px-3 py-1.5 text-sm font-medium text-zinc-700 bg-zinc-100 rounded-md hover:bg-zinc-200"
            >
              Zoom Out
            </button>
            <span className="text-sm font-medium text-zinc-500 w-12 text-center">{Math.round(scale * 100)}%</span>
            <button 
              onClick={() => setScale(s => Math.min(3, s + 0.25))}
              className="px-3 py-1.5 text-sm font-medium text-zinc-700 bg-zinc-100 rounded-md hover:bg-zinc-200"
            >
              Zoom In
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div 
          className="flex-1 overflow-auto relative bg-zinc-200/50 p-8 flex justify-center"
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
                  getDriveFileId(drawing.url)
                    ? {
                        url: `https://www.googleapis.com/drive/v3/files/${getDriveFileId(drawing.url)}?alt=media`,
                        httpHeaders: { Authorization: `Bearer ${user?.accessToken}` }
                      }
                    : drawing.url
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
                  defect.status === 'In Progress' ? 'bg-amber-500' :
                  defect.status === 'Waiting for Feedback' ? 'bg-blue-500' :
                  'bg-emerald-500',
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
        <div className="w-96 bg-white border-l border-zinc-200 flex flex-col shadow-2xl z-20">
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
                className="block w-full rounded-xl border-zinc-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-4 py-2.5 border bg-zinc-50"
                placeholder="e.g., Cracked drywall"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 uppercase tracking-wider mb-2">Status</label>
              <select
                value={activeDefect.status || 'Open'}
                onChange={(e) => setActiveDefect({ ...activeDefect, status: e.target.value as DefectStatus })}
                className="block w-full rounded-xl border-zinc-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-4 py-2.5 border bg-zinc-50"
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Waiting for Feedback">Waiting for Feedback</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 uppercase tracking-wider mb-2">Description</label>
              <textarea
                rows={4}
                value={activeDefect.description || ''}
                onChange={(e) => setActiveDefect({ ...activeDefect, description: e.target.value })}
                className="block w-full rounded-xl border-zinc-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-4 py-2.5 border bg-zinc-50 resize-none"
                placeholder="Add detailed description..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 uppercase tracking-wider mb-2">Assignee</label>
              <input
                type="text"
                value={activeDefect.assignee || ''}
                onChange={(e) => setActiveDefect({ ...activeDefect, assignee: e.target.value })}
                className="block w-full rounded-xl border-zinc-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-4 py-2.5 border bg-zinc-50"
                placeholder="e.g., Contractor A"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-zinc-700 uppercase tracking-wider">Attachments</label>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-500 flex items-center"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add
                </button>
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
                    <div key={att.id} className="relative group rounded-lg overflow-hidden border border-zinc-200 bg-zinc-50 aspect-square">
                      {att.type.startsWith('image/') ? (
                        <DriveImage src={att.url} alt={att.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-2">
                          <Paperclip className="w-6 h-6 text-zinc-400 mb-1" />
                          <span className="text-[10px] text-zinc-500 text-center truncate w-full">{att.name}</span>
                        </div>
                      )}
                      <button 
                        onClick={() => setActiveDefect(prev => ({
                          ...prev!,
                          attachments: prev!.attachments!.filter(a => a.id !== att.id)
                        }))}
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
                  className="mt-2 border-2 border-dashed border-zinc-300 rounded-xl p-6 flex flex-col items-center justify-center text-zinc-500 hover:bg-zinc-50 hover:border-emerald-500/50 transition-colors cursor-pointer"
                >
                  <Camera className="w-6 h-6 mb-2 text-zinc-400" />
                  <span className="text-xs font-medium">Click to add photos</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex space-x-3">
            {!isCreating && (
              <button
                onClick={handleDeleteDefect}
                disabled={isDeletingDefect || isSavingDefect}
                className="flex-1 flex justify-center items-center py-2.5 px-4 border border-red-200 rounded-xl shadow-sm text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors disabled:opacity-50"
              >
                {isDeletingDefect ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Delete
              </button>
            )}
            <button
              onClick={handleSaveDefect}
              disabled={isSavingDefect || isDeletingDefect}
              className="flex-[2] flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors disabled:opacity-50"
            >
              {isSavingDefect ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Defect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
