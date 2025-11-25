import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, Building2, Users, FileText, LogOut, Shield, User } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout, switchProfile } = useAuth();

    const menuItems = [
        { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/operations', icon: Building2, label: 'Operações' },
        { path: '/groups', icon: Users, label: 'Grupos' },
        { path: '/audit', icon: FileText, label: 'Auditoria' },
        { path: '/prompt-manager', icon: MessageSquare, label: 'Prompt Manager' },
    ];

    return (
        <div className="w-64 bg-slate-900 text-white h-screen flex flex-col shadow-xl">
            <div className="p-6 border-b border-slate-800 flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                    <Users size={24} className="text-white" />
                </div>
                <div>
                    <h1 className="font-bold text-lg leading-tight">UserAI</h1>
                    <p className="text-xs text-slate-400">Management System</p>
                </div>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                {menuItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            clsx(
                                'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                                isActive
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            )
                        }
                    >
                        <item.icon size={20} />
                        <span className="font-medium">{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* User Info */}
            {user && (
                <div className="p-4 border-t border-slate-800 space-y-2">
                    <div className="bg-slate-800/50 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                                <User size={20} className="text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-200 truncate">{user.name}</p>
                                <p className="text-xs text-slate-400 truncate">{user.login}</p>
                            </div>
                        </div>
                        
                        {/* Perfil Atual */}
                        <div className="mb-3">
                            <label className="block text-xs text-slate-400 mb-2">Perfil Atual</label>
                            {user.profiles && user.profiles.length > 1 ? (
                                <select
                                    value={user.activeProfile?.id_perfil || ''}
                                    onChange={(e) => {
                                        const selected = user.profiles.find(p => p.id_perfil === parseInt(e.target.value));
                                        if (selected) switchProfile(selected);
                                    }}
                                    className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    {user.profiles.map((profile) => (
                                        <option key={profile.id_perfil} value={profile.id_perfil}>
                                            {profile.str_descricao}
                                            {profile.str_descricao.toUpperCase() === 'MASTER' && ' ⭐'}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-700 rounded">
                                    <Shield size={14} className="text-blue-400" />
                                    <span className="text-sm text-slate-200">
                                        {user.activeProfile?.str_descricao || 'Sem perfil'}
                                        {user.isMaster && ' ⭐'}
                                    </span>
                                </div>
                            )}
                        </div>
                        
                        {/* Status */}
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <span className="text-xs text-slate-400">Online</span>
                        </div>
                    </div>
                    
                    {/* Logout Button */}
                    <button
                        onClick={() => {
                            logout();
                            navigate('/login');
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <LogOut size={16} />
                        <span>Sair</span>
                    </button>
                </div>
            )}
            
            {!user && (
                <div className="p-4 border-t border-slate-800">
                    <div className="bg-slate-800/50 rounded-lg p-4">
                        <p className="text-xs text-slate-400 mb-1">Status do Sistema</p>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <span className="text-sm font-medium text-slate-200">Online</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sidebar;
