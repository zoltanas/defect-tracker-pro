import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Link } from 'react-router-dom';
import { MapPin, Search, Filter, Download, FolderOpen, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export default function Defects() {
  const { defects, drawings, projects, deleteDefect } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [defectToDelete, setDefectToDelete] = useState<string | null>(null);

  const filteredDefects = defects.filter(defect => {
    const matchesSearch = defect.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          defect.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || defect.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getProjectName = (id: string) => {
    return projects.find(p => p.id === id)?.name || 'Unknown Project';
  };

  const getDrawingName = (id: string) => {
    return drawings.find(d => d.id === id)?.name || 'Unknown Drawing';
  };

  return (
    <div className="flex-1 overflow-auto bg-zinc-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 tracking-tight">Defects List</h1>
            <p className="mt-1 md:mt-2 text-sm md:text-base text-zinc-500">Track and manage all project defects.</p>
          </div>
          
          <div className="flex space-x-3">
            <button className="inline-flex items-center px-4 py-2 border border-zinc-300 shadow-sm text-sm font-medium rounded-xl text-zinc-700 bg-white hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lidl-blue-500 transition-colors">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="mt-6 md:mt-8 bg-white shadow-sm border border-zinc-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-50/50">
            <div className="relative flex-1 w-full sm:max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-zinc-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2.5 border border-zinc-300 rounded-xl leading-5 bg-white placeholder-zinc-500 focus:outline-none focus:placeholder-zinc-400 focus:ring-1 focus:ring-lidl-blue-500 focus:border-lidl-blue-500 sm:text-sm transition-colors"
                placeholder="Search defects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <Filter className="w-5 h-5 text-zinc-400 flex-shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full sm:w-40 pl-3 pr-10 py-2.5 text-base border-zinc-300 focus:outline-none focus:ring-lidl-blue-500 focus:border-lidl-blue-500 sm:text-sm rounded-xl"
              >
                <option value="All">All Statuses</option>
                <option value="Open">Open</option>
                <option value="Waiting for feedback">Waiting for feedback</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="bg-zinc-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">ID / Title</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Project</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Drawing</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Assignee</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Created</th>
                  <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-zinc-200">
                {filteredDefects.map((defect) => (
                  <tr key={defect.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-zinc-100 flex items-center justify-center">
                          <MapPin className={`h-5 w-5 ${
                            defect.status === 'Open' ? 'text-red-500' :
                            defect.status === 'Waiting for feedback' ? 'text-blue-500' :
                            'text-lidl-blue-500'
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
                        defect.status === 'Waiting for feedback' ? 'bg-blue-100 text-blue-800' :
                        'bg-zinc-100 text-zinc-800'
                      }`}>
                        {defect.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                      <Link to={`/projects/${defect.projectId}`} className="flex items-center text-zinc-600 hover:text-lidl-blue-600">
                        <FolderOpen className="w-4 h-4 mr-1" />
                        {getProjectName(defect.projectId)}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                      <Link to={`/projects/${defect.projectId}/drawings/${defect.drawingId}`} className="text-lidl-blue-600 hover:text-lidl-blue-900 hover:underline">
                        {getDrawingName(defect.drawingId)}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                      {defect.assignee || 'Unassigned'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                      {format(new Date(defect.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                      {defect.drawingId && (
                        <Link to={`/projects/${defect.projectId}/drawings/${defect.drawingId}`} className="text-lidl-blue-600 hover:text-lidl-blue-900 font-semibold">
                          View on Plan
                        </Link>
                      )}
                      {defectToDelete === defect.id ? (
                        <div className="inline-flex items-center space-x-2">
                          <button onClick={() => deleteDefect(defect.id)} className="text-red-600 font-medium text-xs hover:underline">Confirm</button>
                          <button onClick={() => setDefectToDelete(null)} className="text-zinc-500 text-xs hover:underline">Cancel</button>
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
                
                {filteredDefects.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 text-sm">
                      No defects found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout */}
          <div className="md:hidden divide-y divide-zinc-200">
            {filteredDefects.map((defect) => (
              <div key={defect.id} className="p-4 hover:bg-zinc-50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-zinc-100 flex items-center justify-center">
                      <MapPin className={`h-5 w-5 ${
                        defect.status === 'Open' ? 'text-red-500' :
                        defect.status === 'Waiting for feedback' ? 'text-blue-500' :
                        'text-lidl-blue-500'
                      }`} />
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
                    <button 
                      onClick={() => setDefectToDelete(defect.id)}
                      className="p-1.5 text-zinc-400 hover:text-red-600 transition-colors bg-white rounded-md border border-zinc-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                
                {defect.description && (
                  <p className="text-xs text-zinc-500 mb-3 line-clamp-2">{defect.description}</p>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500 mb-3">
                  <div>
                    <span className="font-medium text-zinc-700 block">Project</span>
                    <Link to={`/projects/${defect.projectId}`} className="text-lidl-blue-600 hover:text-lidl-blue-900 truncate block">
                      {getProjectName(defect.projectId)}
                    </Link>
                  </div>
                  <div>
                    <span className="font-medium text-zinc-700 block">Drawing</span>
                    <Link to={`/projects/${defect.projectId}/drawings/${defect.drawingId}`} className="text-lidl-blue-600 hover:text-lidl-blue-900 truncate block">
                      {getDrawingName(defect.drawingId)}
                    </Link>
                  </div>
                  <div>
                    <span className="font-medium text-zinc-700 block">Assignee</span>
                    <span className="truncate block">{defect.assignee || 'Unassigned'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-zinc-700 block">Created</span>
                    <span className="truncate block">{format(new Date(defect.createdAt), 'MMM d, yyyy')}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end text-xs">
                  {defect.drawingId && (
                    <Link to={`/projects/${defect.projectId}/drawings/${defect.drawingId}`} className="text-lidl-blue-600 hover:text-lidl-blue-900 font-medium flex items-center">
                      <MapPin className="w-3 h-3 mr-1" /> View on Plan
                    </Link>
                  )}
                </div>
                
                {defectToDelete === defect.id && (
                  <div className="mt-3 p-3 bg-red-50 rounded-lg flex items-center justify-between border border-red-100">
                    <span className="text-xs text-red-800 font-medium">Delete this defect?</span>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => setDefectToDelete(null)} 
                        className="px-2 py-1 text-xs text-zinc-600 bg-white border border-zinc-300 rounded hover:bg-zinc-50"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => deleteDefect(defect.id)} 
                        className="px-2 py-1 text-xs text-white bg-red-600 rounded hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {filteredDefects.length === 0 && (
              <div className="p-8 text-center text-zinc-500 text-sm">
                No defects found matching your criteria.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
