import React, { useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { FolderOpen, Plus, FileText, UploadCloud, ArrowLeft, MapPin, Clock, CheckCircle2, Trash2, Paperclip, X, Camera, PenTool, Edit2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { DefectStatus, DefectAttachment, Role } from '../types';
import { getUserRole, canCreateDefect, canEditDefect, canDeleteDefect, canManagePermissions, canChangeDefectStatus } from '../lib/permissions';
import { DriveImage } from '../components/DriveImage';
import { getDriveFileId, useDriveFile } from '../hooks/useDriveFile';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { ImageAnnotator } from '../components/ImageAnnotator';

import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects, drawings, defects, addDrawing, deleteProject, deleteDefect, addDefect, updateDefect, deleteDrawing, user, updateProject } = useStore();
  
  const [activeTab, setActiveTab] = useState<'drawings' | 'defects' | 'permissions'>('defects');
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingDefect, setIsCreatingDefect] = useState(false);
  const [editingDefectId, setEditingDefectId] = useState<string | null>(null);
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
  const [annotatingAttachmentId, setAnnotatingAttachmentId] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<Role>('Consultant');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const defectAttachmentInputRef = useRef<HTMLInputElement>(null);

  const project = projects.find(p => p.id === id);
  const projectDrawings = drawings.filter(d => d.projectId === id);
  const projectDefects = defects.filter(d => d.projectId === id);

  const newDefectDrawing = projectDrawings.find(d => d.id === newDefectDrawingId);
  const { blobUrl: newDefectDrawingBlobUrl } = useDriveFile(newDefectDrawing?.url || '');

  const userRole = project && user ? getUserRole(project, user.email) : null;

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-zinc-900">Project not found</h2>
          <button onClick={() => navigate('/')} className="mt-4 text-lidl-blue-600 hover:underline">
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

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberEmail.trim() || !project) return;
    
    const members = project.members || [];
    if (members.some(m => m.email === newMemberEmail.trim())) {
      alert('Member already exists');
      return;
    }
    
    await updateProject(project.id, {
      members: [...members, { email: newMemberEmail.trim(), role: newMemberRole }]
    });
    
    setNewMemberEmail('');
    setIsAddingMember(false);
  };

  const handleRemoveMember = async (email: string) => {
    if (!project) return;
    const members = project.members || [];
    await updateProject(project.id, {
      members: members.filter(m => m.email !== email)
    });
  };

  const handleCreateDefect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDefectTitle.trim() || !project) return;

    setIsSubmittingDefect(true);
    try {
      if (editingDefectId) {
        if (!canEditCurrentDefect && !canChangeCurrentDefectStatus(newDefectStatus as DefectStatus)) {
          if (editingDefect && newDefectStatus === editingDefect.status) {
            setIsCreatingDefect(false);
            setEditingDefectId(null);
            setIsSubmittingDefect(false);
            return;
          }
          alert('You do not have permission to edit this defect.');
          setIsSubmittingDefect(false);
          return;
        }

        const updates: any = {};
        if (canEditCurrentDefect) {
          updates.title = newDefectTitle;
          updates.description = newDefectDesc;
          updates.drawingId = newDefectDrawingId || undefined;
          updates.x = newDefectX;
          updates.y = newDefectY;
          updates.attachments = newDefectAttachments;
        }
        if (canChangeCurrentDefectStatus(newDefectStatus as DefectStatus)) {
          updates.status = newDefectStatus;
        }

        await updateDefect(editingDefectId, updates);
      } else {
        if (!canCreateDefect(userRole)) {
          alert('You do not have permission to create defects.');
          setIsSubmittingDefect(false);
          return;
        }
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
      }

      setIsCreatingDefect(false);
      setEditingDefectId(null);
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

  const handleEditDefect = (defect: any) => {
    setEditingDefectId(defect.id);
    setNewDefectTitle(defect.title);
    setNewDefectDesc(defect.description || '');
    setNewDefectStatus(defect.status);
    setNewDefectDrawingId(defect.drawingId || '');
    setNewDefectX(defect.x);
    setNewDefectY(defect.y);
    setNewDefectAttachments(defect.attachments || []);
    setIsCreatingDefect(true);
  };

  const editingDefect = editingDefectId ? projectDefects.find(d => d.id === editingDefectId) : null;
  const canEditCurrentDefect = !editingDefectId || (editingDefect && canEditDefect(userRole, editingDefect, user?.email || ''));
  const canChangeCurrentDefectStatus = (status: DefectStatus) => !editingDefectId || (editingDefect && canChangeDefectStatus(userRole, status, editingDefect, user?.email || ''));

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-zinc-50">
      {isUploading && <LoadingOverlay message="Uploading drawing..." />}
      {isSubmittingDefect && <LoadingOverlay message="Creating defect and uploading attachments..." />}
      {isDeletingProject && <LoadingOverlay message="Deleting project..." />}
      {isDeletingDefectId && <LoadingOverlay message="Deleting defect..." />}
      {isDeletingDrawingId && <LoadingOverlay message="Deleting drawing..." />}
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-4 md:px-8 py-4 md:py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
            <div className="flex items-center space-x-2 md:space-x-4">
              <button 
                onClick={() => navigate('/')}
                className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-zinc-900 tracking-tight">{project.name}</h1>
                <p className="text-xs md:text-sm text-zinc-500">{project.description}</p>
              </div>
            </div>
            {userRole === 'Admin' && (
              showDeleteConfirm ? (
                <div className="flex items-center space-x-2 self-end sm:self-auto">
                  <span className="text-sm text-red-600 font-medium">Are you sure?</span>
                  <button 
                    onClick={handleDeleteProject} 
                    disabled={isDeletingProject}
                    className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center"
                  >
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
                  className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors self-end sm:self-auto"
                  title="Delete Project"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )
            )}
          </div>

          <div className="flex space-x-6 border-b border-zinc-200 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveTab('defects')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'defects' 
                  ? 'border-lidl-blue-500 text-lidl-blue-600' 
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
              }`}
            >
              Defects ({projectDefects.length})
            </button>
            <button
              onClick={() => setActiveTab('drawings')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'drawings' 
                  ? 'border-lidl-blue-500 text-lidl-blue-600' 
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
              }`}
            >
              Drawings ({projectDrawings.length})
            </button>
            <button
              onClick={() => setActiveTab('permissions')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'permissions' 
                  ? 'border-lidl-blue-500 text-lidl-blue-600' 
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
              }`}
            >
              Permissions and access
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 md:p-8">
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
                  className="inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-lidl-blue hover:bg-lidl-blue/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lidl-blue disabled:opacity-50 transition-colors"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Upload Drawing
                </button>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {projectDrawings.map((drawing) => (
                  <Link 
                    key={drawing.id} 
                    to={`/projects/${project.id}/drawings/${drawing.id}`}
                    className="group bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden hover:shadow-md transition-all hover:border-lidl-blue-500/30 relative"
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
                      <Trash2 className="w-4 h-4" />
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
                {canCreateDefect(userRole) && (
                  <button 
                    onClick={() => {
                      setEditingDefectId(null);
                      setNewDefectTitle('');
                      setNewDefectDesc('');
                      setNewDefectStatus('Open');
                      setNewDefectDrawingId('');
                      setNewDefectX(undefined);
                      setNewDefectY(undefined);
                      setNewDefectAttachments([]);
                      setIsCreatingDefect(true);
                    }}
                    className="inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-lidl-blue hover:bg-lidl-blue/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lidl-blue transition-colors"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    New Defect
                  </button>
                )}
              </div>

              {isCreatingDefect ? (
                <div className="mb-8 bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
                  <h2 className="text-lg font-semibold text-zinc-900 mb-4">{editingDefectId ? 'Edit Defect' : 'Create New Defect'}</h2>
                  <form onSubmit={handleCreateDefect} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Title</label>
                      <input
                        type="text"
                        required
                        value={newDefectTitle}
                        onChange={(e) => setNewDefectTitle(e.target.value)}
                        disabled={!canEditCurrentDefect}
                        className="block w-full rounded-xl border-zinc-300 shadow-sm focus:border-lidl-blue-500 focus:ring-lidl-blue-500 sm:text-sm px-4 py-2.5 border bg-zinc-50 disabled:opacity-50 disabled:bg-zinc-100"
                        placeholder="e.g., Crack in wall"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Description</label>
                      <textarea
                        value={newDefectDesc}
                        onChange={(e) => setNewDefectDesc(e.target.value)}
                        disabled={!canEditCurrentDefect}
                        className="block w-full rounded-xl border-zinc-300 shadow-sm focus:border-lidl-blue-500 focus:ring-lidl-blue-500 sm:text-sm px-4 py-2.5 border bg-zinc-50 resize-none disabled:opacity-50 disabled:bg-zinc-100"
                        placeholder="Detailed description..."
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Status</label>
                        <select
                          value={newDefectStatus}
                          onChange={(e) => setNewDefectStatus(e.target.value as DefectStatus)}
                          className="block w-full rounded-xl border-zinc-300 shadow-sm focus:border-lidl-blue-500 focus:ring-lidl-blue-500 sm:text-sm px-4 py-2.5 border bg-zinc-50"
                        >
                          <option value="Open" disabled={!canChangeCurrentDefectStatus('Open')}>Open</option>
                          <option value="Waiting for feedback" disabled={!canChangeCurrentDefectStatus('Waiting for feedback')}>Waiting for feedback</option>
                          <option value="Closed" disabled={!canChangeCurrentDefectStatus('Closed')}>Closed</option>
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
                          disabled={!canEditCurrentDefect}
                          className="block w-full rounded-xl border-zinc-300 shadow-sm focus:border-lidl-blue-500 focus:ring-lidl-blue-500 sm:text-sm px-4 py-2.5 border bg-zinc-50 disabled:opacity-50 disabled:bg-zinc-100"
                        >
                          <option value="">No Drawing</option>
                          {projectDrawings.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {newDefectDrawingId && (
                      <div className="col-span-1 sm:col-span-2">
                        <label className="block text-sm font-medium text-zinc-700 mb-1">
                          Mark Location <span className="text-zinc-400 font-normal">(Click on the drawing to place a pin)</span>
                        </label>
                        <div className="relative w-full h-[500px] border-2 border-zinc-200 rounded-xl overflow-hidden bg-zinc-100">
                          {(() => {
                            const selectedDrawing = projectDrawings.find(d => d.id === newDefectDrawingId);
                            if (!selectedDrawing) return null;
                            const isPdf = selectedDrawing.name.toLowerCase().endsWith('.pdf');
                            
                            return (
                              <TransformWrapper
                                initialScale={1}
                                minScale={0.5}
                                maxScale={5}
                                centerOnInit={true}
                                wheel={{ step: 0.1 }}
                              >
                                {({ zoomIn, zoomOut, resetTransform }) => (
                                  <>
                                    <div className="absolute top-4 right-4 z-30 flex flex-col gap-2 bg-white/90 backdrop-blur-sm p-2 rounded-xl shadow-sm border border-zinc-200">
                                      <button type="button" onClick={() => zoomIn()} className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-700 text-xl font-bold leading-none">+</button>
                                      <button type="button" onClick={() => zoomOut()} className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-700 text-xl font-bold leading-none">-</button>
                                      <button type="button" onClick={() => resetTransform()} className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-700 text-xs font-medium">Reset</button>
                                    </div>
                                    <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
                                      <div 
                                        className={`relative inline-block ${canEditCurrentDefect ? 'cursor-crosshair' : 'cursor-default'}`}
                                        onClick={(e) => {
                                          if (!canEditCurrentDefect) return;
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          setNewDefectX((e.clientX - rect.left) / rect.width);
                                          setNewDefectY((e.clientY - rect.top) / rect.height);
                                        }}
                                      >
                                        {isPdf ? (
                                          <Document
                                            file={
                                              newDefectDrawingBlobUrl || (getDriveFileId(selectedDrawing.url)
                                                ? {
                                                    url: `https://www.googleapis.com/drive/v3/files/${getDriveFileId(selectedDrawing.url)}?alt=media`,
                                                    httpHeaders: { Authorization: `Bearer ${user?.accessToken}` }
                                                  }
                                                : selectedDrawing.url) as any
                                            }
                                            loading={<div className="text-zinc-500 text-sm p-12">Loading PDF...</div>}
                                            error={<div className="text-red-500 text-sm p-12">Failed to load PDF</div>}
                                          >
                                            <Page 
                                              pageNumber={1} 
                                              width={800}
                                              renderTextLayer={false}
                                              renderAnnotationLayer={false}
                                              className="shadow-sm"
                                            />
                                          </Document>
                                        ) : (
                                          <DriveImage src={newDefectDrawingBlobUrl || selectedDrawing.url} alt="Drawing preview" className="max-w-none shadow-sm pointer-events-none" style={{ width: '800px', height: 'auto' }} />
                                        )}
                                        
                                        {newDefectX !== undefined && newDefectY !== undefined && (
                                          <div 
                                            className="absolute w-6 h-6 text-red-500 transform -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none drop-shadow-md"
                                            style={{ left: `${newDefectX * 100}%`, top: `${newDefectY * 100}%` }}
                                          >
                                            <MapPin className="w-full h-full fill-current" />
                                          </div>
                                        )}
                                      </div>
                                    </TransformComponent>
                                  </>
                                )}
                              </TransformWrapper>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-zinc-700">Attachments</label>
                        {canEditCurrentDefect && (
                          <button 
                            type="button"
                            onClick={() => defectAttachmentInputRef.current?.click()}
                            className="text-sm font-medium text-lidl-blue-600 hover:text-lidl-blue-500 flex items-center"
                          >
                            <Plus className="w-4 h-4 mr-1" /> Add Files
                          </button>
                        )}
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
                                <>
                                  <DriveImage src={att.url} alt={att.name} className="w-full h-full object-cover" />
                                  {att.annotations && (
                                    <div className="absolute top-2 left-2 p-1 bg-lidl-blue-500 text-white rounded-md shadow-sm">
                                      <PenTool className="w-3 h-3" />
                                    </div>
                                  )}
                                  {canEditCurrentDefect && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setAnnotatingAttachmentId(att.id);
                                      }}
                                      className="absolute bottom-2 left-2 right-2 py-1.5 bg-black/70 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      Annotate
                                    </button>
                                  )}
                                </>
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-4">
                                  <Paperclip className="w-8 h-8 text-zinc-400 mb-2" />
                                  <span className="text-xs text-zinc-500 text-center truncate w-full">{att.name}</span>
                                </div>
                              )}
                              {canEditCurrentDefect && (
                                <button 
                                  type="button"
                                  onClick={() => setNewDefectAttachments(prev => prev.filter(a => a.id !== att.id))}
                                  className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div 
                          onClick={() => {
                            if (canEditCurrentDefect) {
                              defectAttachmentInputRef.current?.click();
                            }
                          }}
                          className={`mt-2 border-2 border-dashed border-zinc-300 rounded-xl p-8 flex flex-col items-center justify-center text-zinc-500 transition-colors ${canEditCurrentDefect ? 'hover:bg-zinc-50 hover:border-lidl-blue-500/50 cursor-pointer' : 'cursor-default'}`}
                        >
                          <Camera className="w-8 h-8 mb-3 text-zinc-400" />
                          <span className="text-sm font-medium">{canEditCurrentDefect ? 'Click to add photos or documents' : 'No attachments'}</span>
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
                      {(canEditCurrentDefect || canChangeCurrentDefectStatus(newDefectStatus as DefectStatus)) && (
                        <button
                          type="submit"
                          disabled={isSubmittingDefect}
                          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-lidl-blue rounded-xl hover:bg-lidl-blue/90 disabled:opacity-50"
                        >
                          {editingDefectId ? 'Save Changes' : 'Create Defect'}
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              ) : (
              <div className="bg-white shadow-sm border border-zinc-200 rounded-2xl overflow-hidden">
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-200">
                    <thead className="bg-zinc-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Title</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Attachments</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Assignee</th>
                        <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-zinc-200">
                      {projectDefects.map((defect) => (
                        <tr key={defect.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 flex space-x-2 overflow-x-auto max-w-[240px] pb-1 items-center">
                                {defect.attachments && defect.attachments.filter(a => a.type.startsWith('image/')).length > 0 ? (
                                  defect.attachments.filter(a => a.type.startsWith('image/')).map((att) => (
                                    <div 
                                      key={att.id} 
                                      className="w-14 h-14 rounded-lg border border-zinc-200 overflow-hidden cursor-pointer relative group flex-shrink-0"
                                      onClick={() => setViewingImage(att.url)}
                                    >
                                      <DriveImage src={att.url} alt={att.name} className="w-full h-full object-cover" />
                                      {att.annotations && (
                                        <div className="absolute top-1 left-1 p-0.5 bg-lidl-blue-500 text-white rounded shadow-sm scale-75 origin-top-left">
                                          <PenTool className="w-3 h-3" />
                                        </div>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <div className="h-14 w-14 rounded-lg bg-zinc-100 flex items-center justify-center flex-shrink-0">
                                    <MapPin className={`h-6 w-6 ${
                                      defect.status === 'Open' ? 'text-red-500' :
                                      defect.status === 'Waiting for feedback' ? 'text-blue-500' :
                                      'text-lidl-blue-500'
                                    }`} />
                                  </div>
                                )}
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
                              defect.status === 'Waiting for feedback' ? 'bg-blue-100 text-blue-800' :
                              'bg-zinc-100 text-zinc-800'
                            }`}>
                              {defect.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                            {defect.attachments && defect.attachments.filter(a => !a.type.startsWith('image/')).length > 0 ? (
                              <div className="flex flex-col space-y-1">
                                {defect.attachments.filter(a => !a.type.startsWith('image/')).map(att => (
                                  <button
                                    key={att.id}
                                    onClick={() => {
                                      window.open(att.url, '_blank');
                                    }}
                                    className="text-lidl-blue-600 hover:text-lidl-blue-900 hover:underline text-left truncate max-w-[200px] flex items-center"
                                    title={att.name}
                                  >
                                    <Paperclip className="w-3 h-3 mr-1 flex-shrink-0" />
                                    <span className="truncate">{att.name}</span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className="text-zinc-400">No attachments</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                            {defect.assignee || 'Unassigned'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                            {defect.drawingId && (
                              <Link to={`/projects/${project.id}/drawings/${defect.drawingId}?defectId=${defect.id}`} className="text-lidl-blue-600 hover:text-lidl-blue-900 font-semibold">
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
                              <div className="inline-flex items-center space-x-3">
                                {(canEditDefect(userRole, defect, user?.email || '') || canChangeDefectStatus(userRole, defect.status, defect, user?.email || '')) && (
                                  <button 
                                    onClick={() => handleEditDefect(defect)}
                                    className="text-zinc-400 hover:text-lidl-blue-600 transition-colors"
                                    title="Edit Defect"
                                  >
                                    <Edit2 className="w-4 h-4 inline" />
                                  </button>
                                )}
                                {canDeleteDefect(userRole, defect, user?.email || '') && (
                                  <button 
                                    onClick={() => setDefectToDelete(defect.id)}
                                    className="text-zinc-400 hover:text-red-600 transition-colors"
                                    title="Delete Defect"
                                  >
                                    <Trash2 className="w-4 h-4 inline" />
                                  </button>
                                )}
                              </div>
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

                {/* Mobile Card Layout */}
                <div className="md:hidden divide-y divide-zinc-200">
                  {projectDefects.map((defect) => (
                    <div key={defect.id} className="p-4 hover:bg-zinc-50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            {defect.attachments && defect.attachments.filter(a => a.type.startsWith('image/')).length > 0 ? (
                              <div 
                                className="w-12 h-12 rounded-lg border border-zinc-200 overflow-hidden cursor-pointer relative group"
                                onClick={() => setViewingImage(defect.attachments!.filter(a => a.type.startsWith('image/'))[0].url)}
                              >
                                <DriveImage src={defect.attachments!.filter(a => a.type.startsWith('image/'))[0].url} alt={defect.attachments!.filter(a => a.type.startsWith('image/'))[0].name} className="w-full h-full object-cover" />
                                {defect.attachments!.filter(a => a.type.startsWith('image/'))[0].annotations && (
                                  <div className="absolute top-1 left-1 p-0.5 bg-lidl-blue-500 text-white rounded shadow-sm scale-75 origin-top-left">
                                    <PenTool className="w-3 h-3" />
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="h-12 w-12 rounded-lg bg-zinc-100 flex items-center justify-center">
                                <MapPin className={`h-5 w-5 ${
                                  defect.status === 'Open' ? 'text-red-500' :
                                  defect.status === 'Waiting for feedback' ? 'text-blue-500' :
                                  'text-lidl-blue-500'
                                }`} />
                              </div>
                            )}
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-zinc-900">{defect.title}</h3>
                            <span className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              defect.status === 'Open' ? 'bg-red-100 text-red-800' :
                              defect.status === 'Waiting for feedback' ? 'bg-blue-100 text-blue-800' :
                              'bg-zinc-100 text-zinc-800'
                            }`}>
                              {defect.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {(canEditDefect(userRole, defect, user?.email || '') || canChangeDefectStatus(userRole, defect.status, defect, user?.email || '')) && (
                            <button 
                              onClick={() => handleEditDefect(defect)}
                              className="p-1.5 text-zinc-400 hover:text-lidl-blue-600 transition-colors bg-white rounded-md border border-zinc-200"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDeleteDefect(userRole, defect, user?.email || '') && (
                            <button 
                              onClick={() => setDefectToDelete(defect.id)}
                              className="p-1.5 text-zinc-400 hover:text-red-600 transition-colors bg-white rounded-md border border-zinc-200"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {defect.description && (
                        <p className="text-xs text-zinc-500 mb-3 line-clamp-2">{defect.description}</p>
                      )}

                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <div className="flex items-center space-x-4">
                          <span className="flex items-center">
                            <span className="font-medium mr-1">Assignee:</span> {defect.assignee || 'Unassigned'}
                          </span>
                          {defect.attachments && defect.attachments.filter(a => !a.type.startsWith('image/')).length > 0 && (
                            <span className="flex items-center">
                              <Paperclip className="w-3 h-3 mr-1" />
                              {defect.attachments.filter(a => !a.type.startsWith('image/')).length} file(s)
                            </span>
                          )}
                        </div>
                        {defect.drawingId && (
                          <Link to={`/projects/${project.id}/drawings/${defect.drawingId}?defectId=${defect.id}`} className="text-lidl-blue-600 hover:text-lidl-blue-900 font-medium flex items-center">
                            <MapPin className="w-3 h-3 mr-1" /> View
                          </Link>
                        )}
                      </div>
                      
                      {defectToDelete === defect.id && (
                        <div className="mt-3 p-3 bg-red-50 rounded-lg flex items-center justify-between border border-red-100">
                          <span className="text-xs text-red-800 font-medium">Delete this defect?</span>
                          <div className="flex space-x-2">
                            <button 
                              onClick={() => setDefectToDelete(null)} 
                              disabled={isDeletingDefectId === defect.id}
                              className="px-2 py-1 text-xs text-zinc-600 bg-white border border-zinc-300 rounded hover:bg-zinc-50"
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={() => handleConfirmDeleteDefect(defect.id)} 
                              disabled={isDeletingDefectId === defect.id}
                              className="px-2 py-1 text-xs text-white bg-red-600 rounded hover:bg-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {projectDefects.length === 0 && (
                    <div className="p-8 text-center text-zinc-500 text-sm">
                      No defects found for this project.
                    </div>
                  )}
                </div>
              </div>
              )}
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
              <h2 className="text-lg font-semibold text-zinc-900 mb-4">Permissions and Access</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-zinc-700">Project Members</h3>
                  {canManagePermissions(userRole) && (
                    <button 
                      onClick={() => setIsAddingMember(!isAddingMember)}
                      className="text-sm font-medium text-lidl-blue-600 hover:text-lidl-blue-500"
                    >
                      {isAddingMember ? 'Cancel' : '+ Add Member'}
                    </button>
                  )}
                </div>
                
                {isAddingMember && canManagePermissions(userRole) && (
                  <form onSubmit={handleAddMember} className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 flex flex-col sm:flex-row sm:items-end space-y-4 sm:space-y-0 sm:space-x-4">
                    <div className="flex-1 w-full">
                      <label className="block text-xs font-medium text-zinc-700 mb-1">Email Address</label>
                      <input
                        type="email"
                        required
                        value={newMemberEmail}
                        onChange={(e) => setNewMemberEmail(e.target.value)}
                        className="block w-full rounded-lg border-zinc-300 shadow-sm focus:border-lidl-blue-500 focus:ring-lidl-blue-500 sm:text-sm px-3 py-2 border bg-white"
                        placeholder="colleague@example.com"
                      />
                    </div>
                    <div className="w-full sm:w-48">
                      <label className="block text-xs font-medium text-zinc-700 mb-1">Role</label>
                      <select
                        value={newMemberRole}
                        onChange={(e) => setNewMemberRole(e.target.value as Role)}
                        className="block w-full rounded-lg border-zinc-300 shadow-sm focus:border-lidl-blue-500 focus:ring-lidl-blue-500 sm:text-sm px-3 py-2 border bg-white"
                      >
                        <option value="Admin">Admin</option>
                        <option value="Lidl Project Manager">Lidl Project Manager</option>
                        <option value="General Contractor">General Contractor</option>
                        <option value="Consultant">Consultant</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-lidl-blue rounded-lg hover:bg-lidl-blue/90 transition-colors"
                    >
                      Add
                    </button>
                  </form>
                )}

                <div className="border border-zinc-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-zinc-200">
                      <thead className="bg-zinc-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Role</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-zinc-200">
                        {project.members?.map((member, idx) => (
                          <tr key={idx}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-900">{member.email}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">{member.role}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              {canManagePermissions(userRole) && (
                                <button 
                                  onClick={() => handleRemoveMember(member.email)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Remove
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {(!project.members || project.members.length === 0) && (
                          <tr>
                            <td colSpan={3} className="px-6 py-4 text-center text-sm text-zinc-500">
                              No members added yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Image Annotator */}
      {annotatingAttachmentId && (
        <ImageAnnotator
          imageUrl={newDefectAttachments.find(a => a.id === annotatingAttachmentId)?.url || ''}
          initialAnnotations={newDefectAttachments.find(a => a.id === annotatingAttachmentId)?.annotations}
          onSave={(annotations, dataUrl, file) => {
            setNewDefectAttachments(prev => prev.map(a => {
              if (a.id === annotatingAttachmentId) {
                const newFile = file ? new File([file], a.name || 'annotated-image.png', { type: file.type }) : a.file;
                // Clear annotations since they are now baked into the image
                return { ...a, annotations: undefined, url: dataUrl || a.url, file: newFile };
              }
              return a;
            }));
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
