import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, User, Shield } from 'lucide-react';

const Login = () => {
    const [users, setUsers] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [availableProfiles, setAvailableProfiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const { login, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        // Se já estiver autenticado, redirecionar
        if (isAuthenticated) {
            navigate('/dashboard');
            return;
        }
        
        // Buscar lista de usuários ativos
        fetchUsers();
    }, [isAuthenticated, navigate]);

    useEffect(() => {
        // Quando selecionar um usuário, buscar seus perfis
        if (selectedUserId) {
            fetchUserProfiles(selectedUserId);
        } else {
            setAvailableProfiles([]);
            setSelectedProfile(null);
        }
    }, [selectedUserId]);

    const fetchUsers = async () => {
        try {
            const response = await fetch('/api/users?status=ATIVO&limit=100');
            if (!response.ok) {
                throw new Error('Erro ao buscar usuários');
            }
            const data = await response.json();
            setUsers(data.filter(u => !u.bloqueado && u.status === 'ATIVO'));
        } catch (error) {
            console.error('Erro ao buscar usuários:', error);
            setError('Erro ao carregar lista de usuários');
        }
    };

    const fetchUserProfiles = async (userId) => {
        try {
            const response = await fetch(`/api/auth/user/${userId}`);
            if (!response.ok) {
                if (response.status === 404) {
                    setError('Usuário não encontrado ou inativo');
                    setAvailableProfiles([]);
                    return;
                }
                throw new Error('Erro ao buscar perfis do usuário');
            }
            const data = await response.json();
            setAvailableProfiles(data.profiles || []);
            setError(''); // Limpar erro anterior
            // Selecionar o primeiro perfil por padrão
            if (data.profiles && data.profiles.length > 0) {
                setSelectedProfile(data.profiles[0]);
            } else {
                setSelectedProfile(null); // Sem perfis, permitir login mesmo assim
            }
        } catch (error) {
            console.error('Erro ao buscar perfis:', error);
            setError('Erro ao carregar perfis do usuário: ' + error.message);
            setAvailableProfiles([]);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        
        if (!selectedUserId) {
            setError('Por favor, selecione um usuário');
            return;
        }

        setLoading(true);
        setError('');

        // Se não houver perfil selecionado mas houver perfis disponíveis, usar o primeiro
        const profileToUse = selectedProfile || (availableProfiles.length > 0 ? availableProfiles[0] : null);
        
        const result = await login(selectedUserId, profileToUse);
        
        setLoading(false);

        if (result.success) {
            navigate('/dashboard');
        } else {
            setError(result.error || 'Erro ao fazer login');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <div className="bg-white rounded-2xl shadow-2xl p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl mb-4">
                            <Shield size={32} className="text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-2">UserAI System</h1>
                        <p className="text-slate-500 text-sm">Selecione um usuário para continuar</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-6">
                        {/* Seleção de Usuário */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                <User size={16} className="inline mr-2" />
                                Usuário
                            </label>
                            <select
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                required
                            >
                                <option value="">Selecione um usuário...</option>
                                {users.map(user => (
                                    <option key={user.id} value={user.id}>
                                        {user.name} ({user.login})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Seleção de Perfil (se houver perfis disponíveis) */}
                        {availableProfiles.length > 0 ? (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    <Shield size={16} className="inline mr-2" />
                                    Perfil
                                </label>
                                <div className="space-y-2">
                                    {availableProfiles.map((profile, index) => (
                                        <label
                                            key={index}
                                            className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                                selectedProfile?.id_perfil === profile.id_perfil
                                                    ? 'border-blue-500 bg-blue-50'
                                                    : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="profile"
                                                value={profile.id_perfil}
                                                checked={selectedProfile?.id_perfil === profile.id_perfil}
                                                onChange={() => setSelectedProfile(profile)}
                                                className="mr-3 text-blue-600 focus:ring-blue-500"
                                            />
                                            <div className="flex-1">
                                                <div className="font-medium text-slate-800">
                                                    {profile.str_descricao}
                                                </div>
                                                {profile.str_descricao.toUpperCase() === 'MASTER' && (
                                                    <div className="text-xs text-amber-600 font-medium">
                                                        Acesso total ao sistema
                                                    </div>
                                                )}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ) : selectedUserId && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <p className="text-sm text-amber-800">
                                    ⚠️ Este usuário não possui perfis configurados. O acesso será limitado.
                                </p>
                            </div>
                        )}

                        {/* Erro */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        {/* Botão de Login */}
                        <button
                            type="submit"
                            disabled={loading || !selectedUserId}
                            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Entrando...
                                </>
                            ) : (
                                <>
                                    <LogIn size={20} />
                                    Entrar
                                </>
                            )}
                        </button>
                    </form>

                    {/* Info */}
                    <div className="mt-6 pt-6 border-t border-slate-200">
                        <p className="text-xs text-slate-500 text-center">
                            Sistema de gestão de usuários com controle de acesso baseado em perfis
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;

