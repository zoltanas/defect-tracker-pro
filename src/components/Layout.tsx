import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { FolderOpen, MapPin, LogOut, Settings, LayoutDashboard, ChevronRight, Menu, X } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Layout() {
  const { user, setUser, isDemoMode, projects } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    setUser(null);
    navigate('/login');
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-lidl-blue border-b border-white/10 flex items-center justify-between px-4 z-50">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 flex items-center justify-center bg-white rounded-md p-1">
            <img src="https://upload.wikimedia.org/wikipedia/commons/9/91/Lidl-Logo.svg" alt="Lidl Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">DefectTracker Pro</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-white/80 hover:text-white p-2"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed md:static inset-y-0 left-0 z-50 w-64 bg-lidl-blue text-white flex flex-col transform transition-transform duration-300 ease-in-out",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-4 hidden md:flex items-center space-x-3 border-b border-white/10">
          <div className="w-8 h-8 flex items-center justify-center bg-white rounded-md p-1">
            <img src="https://upload.wikimedia.org/wikipedia/commons/9/91/Lidl-Logo.svg" alt="Lidl Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">DefectTracker Pro</span>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto mt-16 md:mt-0">
          <Link
            to="/"
            onClick={closeMobileMenu}
            className={cn(
              "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              location.pathname === '/' 
                ? "bg-white/10 text-white" 
                : "hover:bg-white/5 hover:text-white text-white/80"
            )}
          >
            <LayoutDashboard className={cn("mr-3 w-5 h-5", location.pathname === '/' ? "text-lidl-yellow" : "text-white/60")} />
            Dashboard
          </Link>

          <div className="pt-4 pb-2">
            <div className="px-3 text-xs font-semibold text-white/50 uppercase tracking-wider">
              Projects
            </div>
          </div>

          {projects.map((project) => {
            const isActive = location.pathname.startsWith(`/projects/${project.id}`);
            return (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                onClick={closeMobileMenu}
                className={cn(
                  "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors group",
                  isActive 
                    ? "bg-white/10 text-white" 
                    : "hover:bg-white/5 hover:text-white text-white/80"
                )}
              >
                <FolderOpen className={cn("mr-3 w-4 h-4", isActive ? "text-lidl-yellow" : "text-white/60 group-hover:text-lidl-yellow/70")} />
                <span className="truncate">{project.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          {isDemoMode && (
            <div className="mb-4 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-xs text-amber-400 font-medium">Demo Mode Active</p>
              <p className="text-[10px] text-amber-500/80 mt-1 leading-tight">Changes are saved locally. Connect Google Drive to sync.</p>
            </div>
          )}
          
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center space-x-3 truncate">
              {user?.picture ? (
                <img src={user.picture} alt="" className="w-8 h-8 rounded-full bg-white/10" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium text-white">
                  {user?.name?.charAt(0) || 'U'}
                </div>
              )}
              <div className="truncate">
                <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                <p className="text-xs text-white/60 truncate">{user?.email}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-md transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative pt-16 md:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
