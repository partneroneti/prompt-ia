import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';

/**
 * Rota protegida que verifica autenticação e opcionalmente permissões
 * @param {React.ReactNode} children - Conteúdo da rota
 * @param {string|Array<string>} requiredPermission - Permissão requerida (opcional)
 * @param {string} redirectTo - Rota para redirecionar se não tiver permissão (padrão: '/dashboard')
 */
const ProtectedRoute = ({ children, requiredPermission = null, redirectTo = '/dashboard' }) => {
    const { isAuthenticated, loading: authLoading } = useAuth();
    const { canAccess, loading: permLoading, isMaster } = usePermissions();

    if (authLoading || permLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Carregando...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Se há permissão requerida e não é MASTER, verificar
    if (requiredPermission && !isMaster()) {
        const hasAccess = Array.isArray(requiredPermission)
            ? requiredPermission.some(perm => canAccess(perm))
            : canAccess(requiredPermission);

        if (!hasAccess) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50">
                    <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Acesso Negado</h2>
                        <p className="text-slate-600 mb-6">
                            Você não tem permissão para acessar esta página.
                        </p>
                        <button
                            onClick={() => window.location.href = redirectTo}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Voltar ao Dashboard
                        </button>
                    </div>
                </div>
            );
        }
    }

    return children;
};

export default ProtectedRoute;


