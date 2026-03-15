import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Defect, Drawing, User, Project } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { 
  appendDefectToSheet, 
  appendProjectToSheet,
  appendDrawingToSheet,
  getDatabaseData, 
  createOrGetDatabaseSheet, 
  uploadFileToDrive,
  overwriteSheetData,
  createDriveFolder,
  deleteDriveFile
} from '../services/googleApi';
import { getDriveFileId } from '../hooks/useDriveFile';

interface AppState {
  user: User | null;
  projects: Project[];
  drawings: Drawing[];
  defects: Defect[];
  isDemoMode: boolean;
  spreadsheetId: string | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setProjects: (projects: Project[]) => void;
  setDrawings: (drawings: Drawing[]) => void;
  setDefects: (defects: Defect[]) => void;
  
  addProject: (project: Project) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  addDrawing: (drawing: Drawing) => Promise<void>;
  addDefect: (defect: Defect) => Promise<void>;
  updateDefect: (id: string, updates: Partial<Defect>) => Promise<void>;
  deleteDefect: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  deleteDrawing: (id: string) => Promise<void>;
  
  setDemoMode: (isDemo: boolean) => void;
  syncWithGoogle: () => Promise<void>;
}

// Fallback folder ID if not provided in env
const DEFAULT_FOLDER_ID = '1Q8VML74j6mt3nt_BJI9_e2C_O-2m9i48';

let syncPromise: Promise<void> | null = null;

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      projects: [],
      drawings: [],
      defects: [],
      isDemoMode: false,
      spreadsheetId: null,

      setUser: (user) => set({ user }),
      setProjects: (projects) => set({ projects }),
      setDrawings: (drawings) => set({ drawings }),
      setDefects: (defects) => set({ defects }),
      
      addProject: async (project) => {
        const state = get();
        let finalProject = { ...project };
        
        if (!state.isDemoMode && state.user && state.spreadsheetId) {
          try {
            const parentFolderId = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID || DEFAULT_FOLDER_ID;
            const folderId = await createDriveFolder(project.name, parentFolderId, state.user.accessToken);
            finalProject.folderId = folderId;
            
            set((state) => ({ projects: [...state.projects, finalProject] }));
            await appendProjectToSheet(state.spreadsheetId, finalProject, state.user.accessToken);
          } catch (error: any) {
            console.error('Failed to save project to Google Sheets', error);
            if (error.message === 'AUTH_EXPIRED') {
              set({ user: null, spreadsheetId: null });
              window.location.href = '/login?error=auth_expired';
            } else if (error.message === 'MISSING_SCOPES') {
              set({ user: null, spreadsheetId: null });
              window.location.href = '/login?error=missing_scopes';
            }
          }
        } else {
          set((state) => ({ projects: [...state.projects, finalProject] }));
        }
      },

      updateProject: async (id, updates) => {
        const state = get();
        const originalProjects = state.projects;
        
        // Optimistically update
        const newProjects = state.projects.map(p => p.id === id ? { ...p, ...updates } : p);
        set({ projects: newProjects });
        
        if (!state.isDemoMode && state.user && state.spreadsheetId) {
          try {
            await overwriteSheetData(state.spreadsheetId, get().projects, state.drawings, state.defects, state.user.accessToken);
          } catch (e: any) {
            console.error('Failed to sync project update', e);
            // Revert on failure
            set({ projects: originalProjects });
            if (e.message === 'AUTH_EXPIRED') {
              set({ user: null, spreadsheetId: null });
              window.location.href = '/login?error=auth_expired';
            } else if (e.message === 'MISSING_SCOPES') {
              set({ user: null, spreadsheetId: null });
              window.location.href = '/login?error=missing_scopes';
            }
          }
        }
      },

      addDrawing: async (drawing) => {
        const state = get();
        // We can't optimistically update drawing if it needs URL from Drive upload
        // But we can add it with a temporary local URL
        set((state) => ({ drawings: [...state.drawings, drawing] }));
        if (!state.isDemoMode && state.user && drawing.file) {
          try {
            const project = state.projects.find(p => p.id === drawing.projectId);
            const folderId = project?.folderId || import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID || DEFAULT_FOLDER_ID;
            const { url } = await uploadFileToDrive(drawing.file, folderId, state.user.accessToken);
            
            // Update the drawing with the real URL
            set((state) => ({
              drawings: state.drawings.map(d => d.id === drawing.id ? { ...d, url } : d)
            }));
            
            if (state.spreadsheetId) {
              await appendDrawingToSheet(state.spreadsheetId, { ...drawing, url }, state.user.accessToken);
            }
          } catch (error: any) {
            console.error('Failed to upload drawing to Google Drive', error);
            // Revert state on failure
            set((state) => ({ drawings: state.drawings.filter(d => d.id !== drawing.id) }));
            if (error.message === 'AUTH_EXPIRED') {
              set({ user: null, spreadsheetId: null });
              window.location.href = '/login?error=auth_expired';
            } else if (error.message === 'MISSING_SCOPES') {
              set({ user: null, spreadsheetId: null });
              window.location.href = '/login?error=missing_scopes';
            }
          }
        }
      },

      addDefect: async (defect) => {
        const state = get();
        let finalDefect = { ...defect };
        
        if (!state.isDemoMode && state.user) {
          try {
            const project = state.projects.find(p => p.id === defect.projectId);
            const parentFolderId = project?.folderId || import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID || DEFAULT_FOLDER_ID;
            const defectFolderId = await createDriveFolder(`Defect: ${defect.title}`, parentFolderId, state.user.accessToken);
            finalDefect.folderId = defectFolderId;

            if (defect.attachments && defect.attachments.length > 0) {
              const processedAttachments = [];
              
              for (const att of defect.attachments) {
                if (att.file) {
                  try {
                    const { url } = await uploadFileToDrive(att.file, defectFolderId, state.user.accessToken);
                    processedAttachments.push({ ...att, url, file: undefined });
                  } catch (e: any) {
                    console.error('Failed to upload attachment', e);
                    if (e.message === 'AUTH_EXPIRED') {
                      set({ user: null, spreadsheetId: null });
                      window.location.href = '/login?error=auth_expired';
                      return;
                    } else if (e.message === 'MISSING_SCOPES') {
                      set({ user: null, spreadsheetId: null });
                      window.location.href = '/login?error=missing_scopes';
                      return;
                    }
                    processedAttachments.push({ ...att, file: undefined });
                  }
                } else {
                  processedAttachments.push(att);
                }
              }
              finalDefect.attachments = processedAttachments;
            }
            
            set((state) => ({ defects: [...state.defects, finalDefect] }));
            if (state.spreadsheetId) {
              await appendDefectToSheet(state.spreadsheetId, finalDefect, state.user.accessToken);
            }
          } catch (error: any) {
            console.error('Failed to create defect', error);
            if (error.message === 'AUTH_EXPIRED') {
              set({ user: null, spreadsheetId: null });
              window.location.href = '/login?error=auth_expired';
            } else if (error.message === 'MISSING_SCOPES') {
              set({ user: null, spreadsheetId: null });
              window.location.href = '/login?error=missing_scopes';
            }
          }
        } else {
          if (state.isDemoMode && defect.attachments) {
            finalDefect.attachments = defect.attachments.map(att => ({ ...att, file: undefined }));
          }
          set((state) => ({ defects: [...state.defects, finalDefect] }));
        }
      },

      updateDefect: async (id, updates) => {
        const state = get();
        
        let finalUpdates = { ...updates };
        const originalDefects = state.defects;
        
        // Optimistically update
        const newDefects = state.defects.map(d => d.id === id ? { ...d, ...finalUpdates } : d);
        set({ defects: newDefects });
        
        if (!state.isDemoMode && state.user && updates.attachments) {
          const folderId = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID || DEFAULT_FOLDER_ID;
          const processedAttachments = [];
          
          for (const att of updates.attachments) {
            if (att.file) {
              try {
                const { url } = await uploadFileToDrive(att.file, folderId, state.user.accessToken);
                processedAttachments.push({ ...att, url, file: undefined });
              } catch (e: any) {
                console.error('Failed to upload attachment', e);
                if (e.message === 'AUTH_EXPIRED') {
                  set({ user: null, spreadsheetId: null });
                  window.location.href = '/login?error=auth_expired';
                  return;
                } else if (e.message === 'MISSING_SCOPES') {
                  set({ user: null, spreadsheetId: null });
                  window.location.href = '/login?error=missing_scopes';
                  return;
                }
                processedAttachments.push(att);
              }
            } else {
              processedAttachments.push(att);
            }
          }
          finalUpdates.attachments = processedAttachments;
          
          // Update again with real URLs
          const updatedDefectsWithUrls = state.defects.map(d => d.id === id ? { ...d, ...finalUpdates } : d);
          set({ defects: updatedDefectsWithUrls });
        }

        if (!state.isDemoMode && state.user && state.spreadsheetId) {
          try {
            await overwriteSheetData(state.spreadsheetId, state.projects, state.drawings, get().defects, state.user.accessToken);
          } catch (e: any) {
            console.error('Failed to sync update', e);
            // Revert on failure
            set({ defects: originalDefects });
            if (e.message === 'AUTH_EXPIRED') {
              set({ user: null, spreadsheetId: null });
              window.location.href = '/login?error=auth_expired';
              return;
            } else if (e.message === 'MISSING_SCOPES') {
              set({ user: null, spreadsheetId: null });
              window.location.href = '/login?error=missing_scopes';
              return;
            }
          }
        }
      },

      deleteDefect: async (id) => {
        const state = get();
        const originalDefects = state.defects;
        const defectToDelete = state.defects.find(d => d.id === id);
        const newDefects = state.defects.filter(d => d.id !== id);
        
        // Optimistically update
        set({ defects: newDefects });
        
        if (!state.isDemoMode && state.user && state.spreadsheetId) {
          try {
            await overwriteSheetData(state.spreadsheetId, state.projects, state.drawings, newDefects, state.user.accessToken);
            if (defectToDelete?.folderId) {
              try {
                await deleteDriveFile(defectToDelete.folderId, state.user.accessToken);
              } catch (e) {
                console.error('Failed to delete defect folder from Drive', e);
              }
            }
          } catch (e: any) {
            console.error('Failed to sync deletion', e);
            // Revert on failure
            set({ defects: originalDefects });
            if (e.message === 'AUTH_EXPIRED') {
              set({ user: null, spreadsheetId: null });
              window.location.href = '/login?error=auth_expired';
              return;
            } else if (e.message === 'MISSING_SCOPES') {
              set({ user: null, spreadsheetId: null });
              window.location.href = '/login?error=missing_scopes';
              return;
            }
          }
        }
      },

      deleteProject: async (id) => {
        const state = get();
        const originalProjects = state.projects;
        const originalDefects = state.defects;
        const originalDrawings = state.drawings;
        const projectToDelete = state.projects.find(p => p.id === id);
        
        const newProjects = state.projects.filter(p => p.id !== id);
        const newDefects = state.defects.filter(d => d.projectId !== id);
        const newDrawings = state.drawings.filter(d => d.projectId !== id);
        
        // Optimistically update
        set({
          projects: newProjects,
          defects: newDefects,
          drawings: newDrawings
        });
        
        if (!state.isDemoMode && state.user && state.spreadsheetId) {
          try {
            await overwriteSheetData(state.spreadsheetId, newProjects, newDrawings, newDefects, state.user.accessToken);
            if (projectToDelete?.folderId) {
              try {
                await deleteDriveFile(projectToDelete.folderId, state.user.accessToken);
              } catch (e) {
                console.error('Failed to delete project folder from Drive', e);
              }
            }
          } catch (e: any) {
            console.error('Failed to sync project deletion', e);
            // Revert on failure
            set({
              projects: originalProjects,
              defects: originalDefects,
              drawings: originalDrawings
            });
            if (e.message === 'AUTH_EXPIRED') {
              set({ user: null, spreadsheetId: null });
              window.location.href = '/login?error=auth_expired';
              return;
            } else if (e.message === 'MISSING_SCOPES') {
              set({ user: null, spreadsheetId: null });
              window.location.href = '/login?error=missing_scopes';
              return;
            }
          }
        }
      },

      deleteDrawing: async (id) => {
        const state = get();
        const originalDrawings = state.drawings;
        const originalDefects = state.defects;
        const drawingToDelete = state.drawings.find(d => d.id === id);
        
        const newDrawings = state.drawings.filter(d => d.id !== id);
        const newDefects = state.defects.filter(d => d.drawingId !== id);
        
        // Optimistically update
        set({
          drawings: newDrawings,
          defects: newDefects
        });
        
        if (!state.isDemoMode && state.user && state.spreadsheetId) {
          try {
            await overwriteSheetData(state.spreadsheetId, state.projects, newDrawings, newDefects, state.user.accessToken);
            if (drawingToDelete?.url) {
              const fileId = getDriveFileId(drawingToDelete.url);
              if (fileId) {
                try {
                  await deleteDriveFile(fileId, state.user.accessToken);
                } catch (e) {
                  console.error('Failed to delete drawing file from Drive', e);
                }
              }
            }
          } catch (e: any) {
            console.error('Failed to sync drawing deletion', e);
            // Revert on failure
            set({
              drawings: originalDrawings,
              defects: originalDefects
            });
            if (e.message === 'AUTH_EXPIRED') {
              set({ user: null, spreadsheetId: null });
              window.location.href = '/login?error=auth_expired';
              return;
            } else if (e.message === 'MISSING_SCOPES') {
              set({ user: null, spreadsheetId: null });
              window.location.href = '/login?error=missing_scopes';
              return;
            }
          }
        }
      },

      setDemoMode: (isDemo) => set({ isDemoMode: isDemo }),
      
      syncWithGoogle: async () => {
        const state = get();
        if (state.isDemoMode || !state.user) return;
        
        if (syncPromise) {
          return syncPromise;
        }

        syncPromise = (async () => {
          try {
            const folderId = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID || DEFAULT_FOLDER_ID;
            const spreadsheetId = await createOrGetDatabaseSheet(folderId, state.user.accessToken);
            set({ spreadsheetId });
            
            const { projects, drawings, defects } = await getDatabaseData(spreadsheetId, state.user.accessToken);
            
            // Always overwrite local state with remote data to ensure consistency.
            // If the user deleted the database in Google Drive, this will clear the local state.
            set({
              projects,
              drawings,
              defects
            });
          } catch (error: any) {
            console.error('Failed to sync with Google', error);
            if (error.message === 'AUTH_EXPIRED') {
              set({ user: null, spreadsheetId: null });
              window.location.href = '/login?error=auth_expired';
            } else if (error.message === 'MISSING_SCOPES') {
              set({ user: null, spreadsheetId: null });
              window.location.href = '/login?error=missing_scopes';
            }
          } finally {
            syncPromise = null;
          }
        })();

        return syncPromise;
      },
    }),
    {
      name: 'defect-tracker-storage',
      partialize: (state) => ({ 
        user: state.user, 
        projects: state.projects,
        drawings: state.drawings, 
        defects: state.defects,
        isDemoMode: state.isDemoMode,
        spreadsheetId: state.spreadsheetId
      }),
    }
  )
);
