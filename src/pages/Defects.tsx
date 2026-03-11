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
    <div className="flex-1 overflow-auto bg-zinc-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Defects List</h1>
            <p className="mt-2 text-zinc-500">Track and manage all project defects.</p>
          </div>
          
          <div className="flex space-x-3">
            <button className="inline-flex items-center px-4 py-2 border border-zinc-300 shadow-sm text-sm font-medium rounded-xl text-zinc-700 bg-white hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="mt-8 bg-white shadow-sm border border-zinc-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-50/50">
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-zinc-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2.5 border border-zinc-300 rounded-xl leading-5 bg-white placeholder-zinc-500 focus:outline-none focus:placeholder-zinc-400 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm transition-colors"
                placeholder="Search defects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-zinc-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-40 pl-3 pr-10 py-2.5 text-base border-zinc-300 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm rounded-xl"
              >
                <option value="All">All Statuses</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Waiting for Feedback">Waiting for Feedback</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
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
                      <Link to={`/projects/${defect.projectId}`} className="flex items-center text-zinc-600 hover:text-emerald-600">
                        <FolderOpen className="w-4 h-4 mr-1" />
                        {getProjectName(defect.projectId)}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                      <Link to={`/projects/${defect.projectId}/drawings/${defect.drawingId}`} className="text-emerald-600 hover:text-emerald-900 hover:underline">
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
                        <Link to={`/projects/${defect.projectId}/drawings/${defect.drawingId}`} className="text-emerald-600 hover:text-emerald-900 font-semibold">
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
        </div>
      </div>
    </div>
  );
}
