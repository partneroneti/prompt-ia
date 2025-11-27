import React from 'react';
import { usePermissions } from '../hooks/usePermissions';

/**
 * Componente que renderiza children apenas se o usuário tiver a permissão necessária
 * @param {string|Array<string>} permission - Permissão ou array de permissões requeridas
 * @param {React.ReactNode} children - Conteúdo a ser renderizado se tiver permissão
 * @param {React.ReactNode} fallback - Conteúdo alternativo se não tiver permissão (opcional)
 * @param {boolean} requireAll - Se true, requer todas as permissões; se false, requer apenas uma (padrão: false)
 */
const RequirePermission = ({ 
    permission, 
    children, 
    fallback = null,
    requireAll = false 
}) => {
    const { hasFeatureAccess, isMaster, loading } = usePermissions();

    if (loading) {
        return (
            <div className="flex items-center justify-center p-4">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    // Se for MASTER, sempre permite
    if (isMaster()) {
        return <>{children}</>;
    }

    // Verificar permissões
    const hasPermission = requireAll
        ? (Array.isArray(permission) ? permission : [permission]).every(p => hasFeatureAccess(p))
        : hasFeatureAccess(permission);

    if (hasPermission) {
        return <>{children}</>;
    }

    return <>{fallback}</>;
};

export default RequirePermission;
