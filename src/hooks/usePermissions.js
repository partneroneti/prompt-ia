import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { hasAccess, hasAnyRole, canAccessMenu } from '../utils/permissions';

/**
 * Hook para gerenciar permissões do usuário
 * Carrega as roles do usuário e fornece métodos para verificar permissões
 */
export function usePermissions() {
    const { user } = useAuth();
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [permissions, setPermissions] = useState(null);

    useEffect(() => {
        if (!user || !user.id) {
            setLoading(false);
            return;
        }

        loadPermissions();
    }, [user]);

    const loadPermissions = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/auth/permissions`, {
                headers: {
                    'x-user-id': user.id.toString()
                }
            });

            if (response.ok) {
                const data = await response.json();
                setRoles(data.roles || []);
                setPermissions(data);
            } else {
                console.error('Erro ao carregar permissões:', response.statusText);
                setRoles([]);
                setPermissions(null);
            }
        } catch (error) {
            console.error('Erro ao carregar permissões:', error);
            setRoles([]);
            setPermissions(null);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Verifica se o usuário tem acesso a uma funcionalidade
     */
    const hasFeatureAccess = (feature) => {
        if (!user) return false;
        return hasAccess(roles, user.isMaster || false, feature);
    };

    /**
     * Verifica se o usuário tem qualquer uma das roles especificadas
     */
    const hasRole = (requiredRoles) => {
        if (!user) return false;
        return hasAnyRole(roles, user.isMaster || false, requiredRoles);
    };

    /**
     * Verifica se o usuário pode acessar um menu específico
     */
    const canAccess = (menuPath) => {
        if (!user) return false;
        
        // Prompt Manager é sempre acessível para usuários logados
        if (menuPath === 'prompt-manager') {
            return true;
        }
        
        return canAccessMenu(roles, user.isMaster || false, menuPath);
    };

    /**
     * Verifica se o usuário é MASTER
     */
    const isMaster = () => {
        return user?.isMaster || false;
    };

    return {
        roles,
        permissions,
        loading,
        hasFeatureAccess,
        hasRole,
        canAccess,
        isMaster,
        reload: loadPermissions
    };
}
