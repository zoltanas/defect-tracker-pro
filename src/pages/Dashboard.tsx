import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Link } from 'react-router-dom';
import { FolderOpen, Plus, MapPin, Clock, CheckCircle2, RefreshCw, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Project } from '../types';

export default function Dashboard() {
  const { projects, defects, addProject, syncWithGoogle, isDemoMode } = useStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);

  useEffect(() => {
    if (!isDemoMode) {
      handleSync();
    }
  }, [isDemoMode]);

  const handleSync = async () => {
    setIsSyncing(true);
    await syncWithGoogle();
    setIsSyncing(false);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setIsSubmittingProject(true);
    try {
      const project: Project = {
        id: uuidv4(),
        name: newProjectName,
        description: newProjectDesc,
        createdAt: new Date().toISOString(),
        createdBy: 'Current User', // In a real app, use actual user name
      };

      await addProject(project);
      setIsCreating(false);
      setNewProjectName('');
      setNewProjectDesc('');
    } finally {
      setIsSubmittingProject(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-zinc-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Projects Dashboard</h1>
            <p className="mt-2 text-zinc-500">Manage your construction projects and track their overall status.</p>
          </div>
          
          <div className="flex items-center space-x-3">
            {!isDemoMode && (
              <button 
                onClick={handleSync}
                disabled={isSyncing}
                className="inline-flex items-center px-4 py-2 border border-zinc-300 shadow-sm text-sm font-medium rounded-xl text-zinc-700 bg-white hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                Sync
              </button>
            )}
            <button 
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Project
            </button>
          </div>
        </div>

        {isCreating && (
          <div className="mb-8 bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
            <h2 className="text-lg font-semibold text-zinc-900 mb-4">Create New Project</h2>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="block w-full rounded-xl border-zinc-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-4 py-2.5 border bg-zinc-50"
                  placeholder="e.g., Downtown Skyscraper"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Description</label>
                <textarea
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  className="block w-full rounded-xl border-zinc-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-4 py-2.5 border bg-zinc-50 resize-none"
                  placeholder="Brief description of the project..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  disabled={isSubmittingProject}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-xl hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingProject}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center"
                >
                  {isSubmittingProject && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Project
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const projectDefects = defects.filter(d => d.projectId === project.id);
            const openCount = projectDefects.filter(d => d.status === 'Open').length;
            const waitingCount = projectDefects.filter(d => d.status === 'Waiting for Feedback').length;
            const closedCount = projectDefects.filter(d => d.status === 'Resolved' || d.status === 'Closed').length;

            return (
              <Link 
                key={project.id} 
                to={`/projects/${project.id}`}
                className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden hover:shadow-md transition-all hover:border-emerald-500/30 flex flex-col"
              >
                <div className="p-6 border-b border-zinc-100 flex-1">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <FolderOpen className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-zinc-900 truncate">{project.name}</h3>
                      <p className="text-xs text-zinc-500">Created {new Date(project.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-600 line-clamp-2">{project.description || 'No description provided.'}</p>
                </div>
                
                <div className="bg-zinc-50 px-6 py-4 grid grid-cols-3 gap-4 divide-x divide-zinc-200">
                  <div className="text-center">
                    <p className="text-xs font-medium text-zinc-500 mb-1 flex items-center justify-center">
                      <MapPin className="w-3 h-3 mr-1 text-red-500" /> Open
                    </p>
                    <p className="text-lg font-semibold text-zinc-900">{openCount}</p>
                  </div>
                  <div className="text-center pl-4">
                    <p className="text-xs font-medium text-zinc-500 mb-1 flex items-center justify-center">
                      <Clock className="w-3 h-3 mr-1 text-amber-500" /> Waiting
                    </p>
                    <p className="text-lg font-semibold text-zinc-900">{waitingCount}</p>
                  </div>
                  <div className="text-center pl-4">
                    <p className="text-xs font-medium text-zinc-500 mb-1 flex items-center justify-center">
                      <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" /> Closed
                    </p>
                    <p className="text-lg font-semibold text-zinc-900">{closedCount}</p>
                  </div>
                </div>
              </Link>
            );
          })}

          {projects.length === 0 && !isCreating && (
            <div className="col-span-full py-12 text-center border-2 border-dashed border-zinc-300 rounded-2xl">
              <FolderOpen className="mx-auto h-12 w-12 text-zinc-400" />
              <h3 className="mt-2 text-sm font-semibold text-zinc-900">No projects</h3>
              <p className="mt-1 text-sm text-zinc-500">Get started by creating a new project.</p>
              <div className="mt-6">
                <button
                  onClick={() => setIsCreating(true)}
                  className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500"
                >
                  <Plus className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
                  New Project
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
