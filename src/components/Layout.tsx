import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { FolderOpen, MapPin, LogOut, Settings, LayoutDashboard } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Layout() {
  const { user, setUser, isDemoMode } = useStore();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    setUser(null);
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'All Defects', path: '/defects', icon: MapPin },
  ];

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-900 text-zinc-300 flex flex-col">
        <div className="p-4 flex items-center space-x-3 border-b border-zinc-800">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <MapPin className="text-white w-5 h-5" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">DefectTracker Pro</span>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            
            return (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-zinc-800 text-white" 
                    : "hover:bg-zinc-800/50 hover:text-white"
                )}
              >
                <Icon className={cn("mr-3 w-5 h-5", isActive ? "text-emerald-400" : "text-zinc-400")} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-800">
          {isDemoMode && (
            <div className="mb-4 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-xs text-amber-400 font-medium">Demo Mode Active</p>
              <p className="text-[10px] text-amber-500/80 mt-1 leading-tight">Changes are saved locally. Connect Google Drive to sync.</p>
            </div>
          )}
          
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center space-x-3 truncate">
              {user?.picture ? (
                <img src={user.picture} alt="" className="w-8 h-8 rounded-full bg-zinc-800" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-medium text-white">
                  {user?.name?.charAt(0) || 'U'}
                </div>
              )}
              <div className="truncate">
                <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <Outlet />
      </main>
    </div>
  );
}
