import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Verificar se há usuário salvo no localStorage ao carregar
    useEffect(() => {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            try {
                const parsedUser = JSON.parse(savedUser);
                console.log('[AuthContext] Usuário recuperado do localStorage:', parsedUser);
                if (parsedUser && parsedUser.id) {
                    setUser(parsedUser);
                } else {
                    console.warn('[AuthContext] Usuário no localStorage sem ID válido, removendo...');
                    localStorage.removeItem('user');
                }
            } catch (error) {
                console.error('Erro ao recuperar usuário do localStorage:', error);
                localStorage.removeItem('user');
            }
        } else {
            console.log('[AuthContext] Nenhum usuário encontrado no localStorage');
        }
        setLoading(false);
    }, []);

    const login = async (userId, selectedProfile = null) => {
        try {
            // Buscar informações do usuário e perfis
            const response = await fetch(`/api/auth/user/${userId}`);
            if (!response.ok) {
                throw new Error('Erro ao buscar informações do usuário');
            }

            const userData = await response.json();
            
            // Se não houver perfis, criar um perfil padrão "SEM PERFIL" para permitir login
            const profiles = (userData.profiles && userData.profiles.length > 0) 
                ? userData.profiles 
                : [{ id_perfil: null, str_descricao: 'SEM PERFIL' }];
            
            // Se um perfil específico foi selecionado, usar ele, senão usar o primeiro perfil
            const activeProfile = selectedProfile || profiles[0];
            
            const userToSave = {
                id: userData.id_usuario,
                name: userData.str_descricao,
                login: userData.str_login,
                email: userData.email || '',
                profiles: profiles,
                activeProfile: activeProfile,
                isMaster: profiles.some(p => p.str_descricao && p.str_descricao.toUpperCase() === 'MASTER')
            };

            setUser(userToSave);
            localStorage.setItem('user', JSON.stringify(userToSave));
            return { success: true, user: userToSave };
        } catch (error) {
            console.error('Erro no login:', error);
            return { success: false, error: error.message };
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('user');
    };

    const switchProfile = (profile) => {
        if (!user) return;
        
        const updatedUser = {
            ...user,
            activeProfile: profile
        };
        
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
    };

    const getAuthHeaders = () => {
        console.log('[AuthContext] getAuthHeaders chamado, user:', user);
        if (!user || !user.id) {
            console.warn('[AuthContext] Tentativa de obter headers sem usuário logado', { user, hasUser: !!user, hasId: user?.id });
            return {};
        }
        const userId = user.id.toString();
        if (!userId || userId === 'undefined' || userId === 'null') {
            console.error('[AuthContext] ID do usuário inválido:', user.id, 'userId:', userId);
            return {};
        }
        const headers = {
            'x-user-id': userId
        };
        console.log('[AuthContext] Headers gerados:', headers);
        return headers;
    };

    const value = {
        user,
        login,
        logout,
        switchProfile,
        getAuthHeaders,
        isAuthenticated: !!user,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth deve ser usado dentro de um AuthProvider');
    }
    return context;
};

