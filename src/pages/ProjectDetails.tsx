import React, { useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { FolderOpen, Plus, FileText, UploadCloud, ArrowLeft, MapPin, Clock, CheckCircle2, Trash2, Paperclip, X, Camera, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { DefectStatus, DefectAttachment } from '../types';
import { DriveImage } from '../components/DriveImage';
import { getDriveFileId } from '../hooks/useDriveFile';

import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects, drawings, defects, addDrawing, deleteProject, deleteDefect, addDefect, deleteDrawing, user } = useStore();
  
  const [activeTab, setActiveTab] = useState<'drawings' | 'defects'>('defects');
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingDefect, setIsCreatingDefect] = useState(false);
  const [newDefectTitle, setNewDefectTitle] = useState('');
  const [newDefectDesc, setNewDefectDesc] = useState('');
  const [newDefectStatus, setNewDefectStatus] = useState<DefectStatus>('Open');
  const [newDefectDrawingId, setNewDefectDrawingId] = useState<string>('');
  const [newDefectX, setNewDefectX] = useState<number | undefined>(undefined);
  const [newDefectY, setNewDefectY] = useState<number | undefined>(undefined);
  const [newDefectAttachments, setNewDefectAttachments] = useState<DefectAttachment[]>([]);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [defectToDelete, setDefectToDelete] = useState<string | null>(null);
  const [isDeletingDefectId, setIsDeletingDefectId] = useState<string | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [isSubmittingDefect, setIsSubmittingDefect] = useState(false);
  const [isDeletingDrawingId, setIsDeletingDrawingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const defectAttachmentInputRef = useRef<HTMLInputElement>(null);

  const project = projects.find(p => p.id === id);
  const projectDrawings = drawings.filter(d => d.projectId === id);
  const projectDefects = defects.filter(d => d.projectId === id);

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-zinc-900">Project not found</h2>
          <button onClick={() => navigate('/')} className="mt-4 text-emerald-600 hover:underline">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const newDrawing = {
        id: uuidv4(),
        projectId: project.id,
        name: file.name,
        url: URL.createObjectURL(file), // Local preview url
        file: file,
      };
      
      await addDrawing(newDrawing);
    } catch (error) {
      console.error('Upload failed', error);
      alert('Failed to upload drawing.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteProject = async () => {
    setIsDeletingProject(true);
    try {
      await deleteProject(project.id);
      navigate('/');
    } catch (e) {
      console.error(e);
      setIsDeletingProject(false);
    }
  };

  const handleDeleteDrawing = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this drawing? All associated defects will also be deleted.')) {
      setIsDeletingDrawingId(id);
      try {
        await deleteDrawing(id);
      } finally {
        setIsDeletingDrawingId(null);
      }
    }
  };

  const handleConfirmDeleteDefect = async (id: string) => {
    setIsDeletingDefectId(id);
    try {
      await deleteDefect(id);
    } finally {
      setIsDeletingDefectId(null);
      setDefectToDelete(null);
    }
  };

  const handleDefectAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: DefectAttachment[] = Array.from(files).map((file: File) => ({
      id: uuidv4(),
      name: file.name,
      url: URL.createObjectURL(file),
      type: file.type,
      file: file,
    }));

    setNewDefectAttachments(prev => [...prev, ...newAttachments]);
  };

  const handleCreateDefect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDefectTitle.trim()) return;

    setIsSubmittingDefect(true);
    try {
      await addDefect({
        id: uuidv4(),
        projectId: project.id,
        title: newDefectTitle,
        description: newDefectDesc,
        status: newDefectStatus,
        drawingId: newDefectDrawingId || undefined,
        x: newDefectX,
        y: newDefectY,
        createdAt: new Date().toISOString(),
        createdBy: 'Current User',
        assignee: '',
        attachments: newDefectAttachments
      });

      setIsCreatingDefect(false);
      setNewDefectTitle('');
      setNewDefectDesc('');
      setNewDefectStatus('Open');
      setNewDefectDrawingId('');
      setNewDefectX(undefined);
      setNewDefectY(undefined);
      setNewDefectAttachments([]);
    } finally {
      setIsSubmittingDefect(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-zinc-50">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => navigate('/')}
                className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">{project.name}</h1>
                <p className="text-sm text-zinc-500">{project.description}</p>
              </div>
            </div>
            {showDeleteConfirm ? (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-red-600 font-medium">Are you sure?</span>
                <button 
                  onClick={handleDeleteProject} 
                  disabled={isDeletingProject}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center"
                >
                  {isDeletingProject && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  Yes
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)} 
                  disabled={isDeletingProject}
                  className="px-3 py-1 bg-zinc-200 text-zinc-800 text-sm rounded-lg hover:bg-zinc-300 disabled:opacity-50"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete Project"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex space-x-6 border-b border-zinc-200">
            <button
              onClick={() => setActiveTab('defects')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'defects' 
                  ? 'border-emerald-500 text-emerald-600' 
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
              }`}
            >
              Defects ({projectDefects.length})
            </button>
            <button
              onClick={() => setActiveTab('drawings')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'drawings' 
                  ? 'border-emerald-500 text-emerald-600' 
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
              }`}
            >
              Drawings ({projectDrawings.length})
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto">
          
          {activeTab === 'drawings' && (
            <div>
              <div className="flex justify-end mb-6">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="application/pdf,image/*"
                  onChange={handleFileUpload}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
                >
                  {isUploading ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-5 h-5 mr-2" />
                  )}
                  {isUploading ? 'Uploading...' : 'Upload Drawing'}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {projectDrawings.map((drawing) => (
                  <Link 
                    key={drawing.id} 
                    to={`/projects/${project.id}/drawings/${drawing.id}`}
                    className="group bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden hover:shadow-md transition-all hover:border-emerald-500/30 relative"
                  >
                    <div className="aspect-[4/3] bg-zinc-100 flex items-center justify-center relative overflow-hidden">
                      <FileText className="w-16 h-16 text-zinc-300 group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="p-4">
                      <h3 className="text-sm font-medium text-zinc-900 truncate pr-8" title={drawing.name}>
                        {drawing.name}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500 flex items-center">
                        <FolderOpen className="w-3 h-3 mr-1" />
                        Project Files
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteDrawing(e, drawing.id)}
                      disabled={isDeletingDrawingId === drawing.id}
                      className="absolute bottom-4 right-4 p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all disabled:opacity-100"
                      title="Delete Drawing"
                    >
                      {isDeletingDrawingId === drawing.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </Link>
                ))}

                {projectDrawings.length === 0 && (
                  <div className="col-span-full py-12 text-center border-2 border-dashed border-zinc-300 rounded-2xl">
                    <FileText className="mx-auto h-12 w-12 text-zinc-400" />
                    <h3 className="mt-2 text-sm font-semibold text-zinc-900">No drawings</h3>
                    <p className="mt-1 text-sm text-zinc-500">Get started by uploading a new drawing.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'defects' && (
            <div>
              <div className="flex justify-end mb-6">
                <button 
                  onClick={() => setIsCreatingDefect(true)}
                  className="inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  New Defect
                </button>
              </div>

              {isCreatingDefect && (
                <div className="mb-8 bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
                  <h2 className="text-lg font-semibold text-zinc-900 mb-4">Create New Defect</h2>
                  <form onSubmit={handleCreateDefect} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Title</label>
                      <input
                        type="text"
                        required
                        value={newDefectTitle}
                        onChange={(e) => setNewDefectTitle(e.target.value)}
                        className="block w-full rounded-xl border-zinc-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-4 py-2.5 border bg-zinc-50"
                        placeholder="e.g., Crack in wall"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Description</label>
                      <textarea
                        value={newDefectDesc}
                        onChange={(e) => setNewDefectDesc(e.target.value)}
                        className="block w-full rounded-xl border-zinc-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-4 py-2.5 border bg-zinc-50 resize-none"
                        placeholder="Detailed description..."
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Status</label>
                        <select
                          value={newDefectStatus}
                          onChange={(e) => setNewDefectStatus(e.target.value as DefectStatus)}
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
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Drawing (Optional)</label>
                        <select
                          value={newDefectDrawingId}
                          onChange={(e) => {
                            setNewDefectDrawingId(e.target.value);
                            setNewDefectX(undefined);
                            setNewDefectY(undefined);
                          }}
                          className="block w-full rounded-xl border-zinc-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-4 py-2.5 border bg-zinc-50"
                        >
                          <option value="">No Drawing</option>
                          {projectDrawings.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {newDefectDrawingId && (
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">
                          Mark Location <span className="text-zinc-400 font-normal">(Click on the drawing to place a pin)</span>
                        </label>
                        <div className="relative w-full h-64 border-2 border-zinc-200 rounded-xl overflow-hidden bg-zinc-100">
                          {(() => {
                            const selectedDrawing = projectDrawings.find(d => d.id === newDefectDrawingId);
                            if (!selectedDrawing) return null;
                            const isPdf = selectedDrawing.name.toLowerCase().endsWith('.pdf');
                            
                            return (
                              <>
                                {isPdf ? (
                                  <div className="w-full h-full flex items-center justify-center pointer-events-none">
                                    <Document
                                      file={
                                        getDriveFileId(selectedDrawing.url)
                                          ? {
                                              url: `https://www.googleapis.com/drive/v3/files/${getDriveFileId(selectedDrawing.url)}?alt=media`,
                                              httpHeaders: { Authorization: `Bearer ${user?.accessToken}` }
                                            }
                                          : selectedDrawing.url
                                      }
                                      loading={<div className="text-zinc-500 text-sm">Loading PDF...</div>}
                                      error={<div className="text-red-500 text-sm">Failed to load PDF</div>}
                                    >
                                      <Page 
                                        pageNumber={1} 
                                        height={256}
                                        renderTextLayer={false}
                                        renderAnnotationLayer={false}
                                      />
                                    </Document>
                                  </div>
                                ) : (
                                  <DriveImage src={selectedDrawing.url} alt="Drawing preview" className="w-full h-full object-contain pointer-events-none" />
                                )}
                                <div 
                                  className="absolute inset-0 cursor-crosshair z-10"
                                  onClick={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setNewDefectX((e.clientX - rect.left) / rect.width);
                                    setNewDefectY((e.clientY - rect.top) / rect.height);
                                  }}
                                />
                                {newDefectX !== undefined && newDefectY !== undefined && (
                                  <div 
                                    className="absolute w-6 h-6 text-red-500 transform -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none drop-shadow-md"
                                    style={{ left: `${newDefectX * 100}%`, top: `${newDefectY * 100}%` }}
                                  >
                                    <MapPin className="w-full h-full fill-current" />
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-zinc-700">Attachments</label>
                        <button 
                          type="button"
                          onClick={() => defectAttachmentInputRef.current?.click()}
                          className="text-sm font-medium text-emerald-600 hover:text-emerald-500 flex items-center"
                        >
                          <Plus className="w-4 h-4 mr-1" /> Add Files
                        </button>
                      </div>
                      <input 
                        type="file" 
                        ref={defectAttachmentInputRef} 
                        className="hidden" 
                        multiple 
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={handleDefectAttachmentUpload}
                      />
                      
                      {newDefectAttachments.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
                          {newDefectAttachments.map((att) => (
                            <div key={att.id} className="relative group rounded-xl overflow-hidden border border-zinc-200 bg-zinc-50 aspect-square">
                              {att.type.startsWith('image/') ? (
                                <DriveImage src={att.url} alt={att.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-4">
                                  <Paperclip className="w-8 h-8 text-zinc-400 mb-2" />
                                  <span className="text-xs text-zinc-500 text-center truncate w-full">{att.name}</span>
                                </div>
                              )}
                              <button 
                                type="button"
                                onClick={() => setNewDefectAttachments(prev => prev.filter(a => a.id !== att.id))}
                                className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div 
                          onClick={() => defectAttachmentInputRef.current?.click()}
                          className="mt-2 border-2 border-dashed border-zinc-300 rounded-xl p-8 flex flex-col items-center justify-center text-zinc-500 hover:bg-zinc-50 hover:border-emerald-500/50 transition-colors cursor-pointer"
                        >
                          <Camera className="w-8 h-8 mb-3 text-zinc-400" />
                          <span className="text-sm font-medium">Click to add photos or documents</span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end space-x-3 mt-6">
                      <button
                        type="button"
                        onClick={() => setIsCreatingDefect(false)}
                        disabled={isSubmittingDefect}
                        className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-xl hover:bg-zinc-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingDefect}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {isSubmittingDefect && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Create Defect
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="bg-white shadow-sm border border-zinc-200 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-200">
                    <thead className="bg-zinc-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Title</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Drawing</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Assignee</th>
                        <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-zinc-200">
                      {projectDefects.map((defect) => (
                        <tr key={defect.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-zinc-100 flex items-center justify-center">
                                <MapPin className={`h-5 w-5 ${
                                  defect.status === 'Open' ? 'text-red-500' :
                                  defect.status === 'In Progress' ? 'text-amber-500' :
                                  defect.status === 'Waiting for Feedback' ? 'text-blue-500' :
                                  'text-emerald-500'
                                }`} />
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-zinc-900">{defect.title}</div>
                                <div className="text-sm text-zinc-500 truncate max-w-[200px]">{defect.description}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              defect.status === 'Open' ? 'bg-red-100 text-red-800' :
                              defect.status === 'In Progress' ? 'bg-amber-100 text-amber-800' :
                              defect.status === 'Waiting for Feedback' ? 'bg-blue-100 text-blue-800' :
                              defect.status === 'Resolved' ? 'bg-emerald-100 text-emerald-800' :
                              'bg-zinc-100 text-zinc-800'
                            }`}>
                              {defect.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                            {defect.drawingId ? (
                              <Link to={`/projects/${project.id}/drawings/${defect.drawingId}`} className="text-emerald-600 hover:text-emerald-900 hover:underline">
                                {drawings.find(d => d.id === defect.drawingId)?.name || 'Unknown'}
                              </Link>
                            ) : (
                              <span className="text-zinc-400">No drawing</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                            {defect.assignee || 'Unassigned'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                            {defect.drawingId && (
                              <Link to={`/projects/${project.id}/drawings/${defect.drawingId}`} className="text-emerald-600 hover:text-emerald-900 font-semibold">
                                View on Plan
                              </Link>
                            )}
                            {defectToDelete === defect.id ? (
                              <div className="inline-flex items-center space-x-2">
                                <button 
                                  onClick={() => handleConfirmDeleteDefect(defect.id)} 
                                  disabled={isDeletingDefectId === defect.id}
                                  className="text-red-600 font-medium text-xs hover:underline disabled:opacity-50 flex items-center"
                                >
                                  {isDeletingDefectId === defect.id && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                                  Confirm
                                </button>
                                <button 
                                  onClick={() => setDefectToDelete(null)} 
                                  disabled={isDeletingDefectId === defect.id}
                                  className="text-zinc-500 text-xs hover:underline disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => setDefectToDelete(defect.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4 inline" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      
                      {projectDefects.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-zinc-500 text-sm">
                            No defects found for this project.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
