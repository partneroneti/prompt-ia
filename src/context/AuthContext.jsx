import React, { createContext, useContext, useState, useEffect } from 'react';
import ChangePasswordModal from '../components/ChangePasswordModal';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

    // Verificar se há usuário salvo no localStorage ao carregar
    useEffect(() => {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            try {
                const parsedUser = JSON.parse(savedUser);
                console.log('[AuthContext] Usuário recuperado do localStorage:', parsedUser);
                if (parsedUser && parsedUser.id) {
                    setUser(parsedUser);
                    // Verificar se precisa trocar senha ao carregar do localStorage
                    // Buscar dados atualizados do servidor para verificar flag
                    fetch(`/api/auth/user/${parsedUser.id}`)
                        .then(res => res.json())
                        .then(userData => {
                            console.log('[AuthContext] Dados do usuário do servidor:', userData);
                            if (userData.trocar_senha) {
                                console.log('[AuthContext] Flag trocar_senha detectado, mostrando modal');
                                setShowChangePasswordModal(true);
                                // Atualizar flag no estado do usuário
                                const updatedUser = {
                                    ...parsedUser,
                                    trocar_senha: true
                                };
                                setUser(updatedUser);
                                localStorage.setItem('user', JSON.stringify(updatedUser));
                            }
                        })
                        .catch(error => {
                            console.warn('[AuthContext] Erro ao verificar flag trocar_senha:', error);
                        });
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
            
            console.log('[AuthContext] ===========================================');
            console.log('[AuthContext] Dados do usuário recebidos do servidor:');
            console.log('[AuthContext]   ID:', userData.id_usuario);
            console.log('[AuthContext]   Login:', userData.str_login);
            console.log('[AuthContext]   Nome:', userData.str_descricao);
            console.log('[AuthContext]   trocar_senha (raw):', userData.trocar_senha);
            console.log('[AuthContext]   Tipo de trocar_senha:', typeof userData.trocar_senha);
            console.log('[AuthContext]   trocar_senha (boolean):', Boolean(userData.trocar_senha));
            console.log('[AuthContext]   trocar_senha (coalesce):', userData.trocar_senha || false);
            console.log('[AuthContext] ===========================================');
            
            // Se não houver perfis, criar um perfil padrão "SEM PERFIL" para permitir login
            const profiles = (userData.profiles && userData.profiles.length > 0) 
                ? userData.profiles 
                : [{ id_perfil: null, str_descricao: 'SEM PERFIL' }];
            
            // Se um perfil específico foi selecionado, usar ele, senão usar o primeiro perfil
            const activeProfile = selectedProfile || profiles[0];
            
            // Buscar roles e permissões do usuário
            let roles = [];
            let isMaster = profiles.some(p => p.str_descricao && p.str_descricao.toUpperCase() === 'MASTER');
            
            try {
                const permissionsResponse = await fetch(`/api/auth/permissions`, {
                    headers: {
                        'x-user-id': userData.id_usuario.toString()
                    }
                });
                if (permissionsResponse.ok) {
                    const permissionsData = await permissionsResponse.json();
                    roles = permissionsData.roles || [];
                    isMaster = permissionsData.is_master || isMaster;
                }
            } catch (error) {
                console.warn('Erro ao carregar permissões no login:', error);
            }

            // Converter trocar_senha para boolean explicitamente
            const trocarSenha = userData.trocar_senha === true || userData.trocar_senha === 'true' || userData.trocar_senha === 1;

            const userToSave = {
                id: userData.id_usuario,
                name: userData.str_descricao,
                login: userData.str_login,
                email: userData.email || '',
                profiles: profiles,
                activeProfile: activeProfile,
                isMaster: isMaster,
                roles: roles,
                trocar_senha: trocarSenha
            };

            console.log('[AuthContext] ===========================================');
            console.log('[AuthContext] Usuário a ser salvo:');
            console.log('[AuthContext]   trocar_senha (final):', trocarSenha);
            console.log('[AuthContext]   Vai mostrar modal?', trocarSenha);
            console.log('[AuthContext] ===========================================');

            setUser(userToSave);
            localStorage.setItem('user', JSON.stringify(userToSave));
            
            // Se precisar trocar senha, mostrar modal
            if (trocarSenha) {
                console.log('[AuthContext] ✅✅✅ MOSTRANDO MODAL DE TROCA DE SENHA ✅✅✅');
                // Usar setTimeout para garantir que o estado seja atualizado
                setTimeout(() => {
                    setShowChangePasswordModal(true);
                }, 100);
            } else {
                console.log('[AuthContext] ❌ Não precisa trocar senha (trocar_senha = false)');
            }
            
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

    const handlePasswordChangeSuccess = async () => {
        console.log('[AuthContext] handlePasswordChangeSuccess chamado');
        // Buscar dados atualizados do servidor para garantir que trocar_senha está false
        if (user && user.id) {
            try {
                const response = await fetch(`/api/auth/user/${user.id}`);
                if (response.ok) {
                    const userData = await response.json();
                    const updatedUser = {
                        ...user,
                        trocar_senha: userData.trocar_senha || false
                    };
                    console.log('[AuthContext] Atualizando usuário após troca de senha:', updatedUser);
                    console.log('[AuthContext] trocar_senha atualizado para:', updatedUser.trocar_senha);
                    setUser(updatedUser);
                    localStorage.setItem('user', JSON.stringify(updatedUser));
                }
            } catch (error) {
                console.warn('[AuthContext] Erro ao atualizar usuário após troca de senha:', error);
                // Mesmo assim, atualizar o flag localmente
                const updatedUser = {
                    ...user,
                    trocar_senha: false
                };
                setUser(updatedUser);
                localStorage.setItem('user', JSON.stringify(updatedUser));
            }
        }
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
            <ChangePasswordModal
                isOpen={showChangePasswordModal}
                onClose={() => {
                    console.log('[AuthContext] onClose do modal chamado');
                    console.log('[AuthContext] user?.trocar_senha:', user?.trocar_senha);
                    // Sempre permitir fechar - o modal só aparece se trocar_senha for true
                    // Se chegou aqui, é porque a senha foi alterada ou o usuário quer fechar
                    console.log('[AuthContext] Fechando modal');
                    setShowChangePasswordModal(false);
                }}
                onSuccess={() => {
                    console.log('[AuthContext] onSuccess do modal chamado');
                    handlePasswordChangeSuccess();
                    // Fechar modal após atualizar o estado
                    setTimeout(() => {
                        setShowChangePasswordModal(false);
                    }, 500);
                }}
                isRequired={user?.trocar_senha || false}
            />
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

