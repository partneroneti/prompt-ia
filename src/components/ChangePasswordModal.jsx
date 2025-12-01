import React, { useState } from 'react';
import { X, Lock, AlertCircle } from 'lucide-react';

const ChangePasswordModal = ({ isOpen, onClose, onSuccess, isRequired = true }) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validações
        if (!newPassword || newPassword.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('As senhas não coincidem');
            return;
        }

        setLoading(true);
        console.log('[ChangePasswordModal] Iniciando troca de senha...');

        try {
            const userId = JSON.parse(localStorage.getItem('user'))?.id;
            if (!userId) {
                console.error('[ChangePasswordModal] ❌ Usuário não encontrado no localStorage');
                setError('Usuário não encontrado. Faça login novamente.');
                setLoading(false);
                return;
            }

            console.log('[ChangePasswordModal] Enviando requisição para /api/auth/change-password');
            console.log('[ChangePasswordModal] User ID:', userId);

            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': userId.toString()
                },
                body: JSON.stringify({
                    newPassword: newPassword
                })
            });

            console.log('[ChangePasswordModal] Resposta recebida, status:', response.status);

            const data = await response.json();
            console.log('[ChangePasswordModal] Dados da resposta:', data);

            if (!response.ok) {
                console.error('[ChangePasswordModal] ❌ Erro na resposta:', data.error);
                setError(data.error || 'Erro ao alterar senha');
                setLoading(false);
                return;
            }

            // Sucesso - mostrar mensagem e fechar modal
            console.log('[ChangePasswordModal] ✅ Senha alterada com sucesso!');
            setLoading(false);
            setSuccess(true);
            setError('');
            
            // Chamar onSuccess para atualizar o estado do usuário
            if (onSuccess) {
                console.log('[ChangePasswordModal] Chamando onSuccess...');
                onSuccess();
            }
            
            // Fechar modal após mostrar mensagem de sucesso
            console.log('[ChangePasswordModal] Fechando modal em 2 segundos...');
            setTimeout(() => {
                setNewPassword('');
                setConfirmPassword('');
                setSuccess(false);
                onClose();
                console.log('[ChangePasswordModal] Modal fechado');
            }, 2000);
        } catch (error) {
            console.error('[ChangePasswordModal] ❌ Erro ao trocar senha:', error);
            console.error('[ChangePasswordModal] Stack:', error.stack);
            setError('Erro ao conectar com o servidor: ' + error.message);
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <AlertCircle className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Trocar Senha Obrigatória</h2>
                            <p className="text-sm text-gray-500">Você precisa definir uma nova senha</p>
                        </div>
                    </div>
                    {!isRequired && (
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            disabled={loading}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Nova Senha
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Digite sua nova senha"
                                required
                                minLength={6}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Confirmar Nova Senha
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Confirme sua nova senha"
                                required
                                minLength={6}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    {success && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-sm text-green-600 font-medium">
                                ✅ Senha alterada com sucesso! O modal será fechado em breve...
                            </p>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <button
                            type="submit"
                            disabled={loading || success}
                            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Alterando...' : success ? 'Senha Alterada!' : 'Alterar Senha'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChangePasswordModal;

