import React, { useState, useEffect } from 'react';
import { Search, Clock, User, FileText, Filter } from 'lucide-react';

const UserAuditReport = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchType, setSearchType] = useState('user'); // 'user' or 'general'

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/audit/users?limit=50');
            if (!res.ok) {
                throw new Error('Erro ao carregar logs');
            }
            const data = await res.json();
            setLogs(data);
            setLoading(false);
        } catch (error) {
            console.error('Erro ao carregar logs:', error);
            setLoading(false);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchTerm) {
            fetchLogs();
            return;
        }

        try {
            setLoading(true);
            // Se for busca por usuário específico
            const res = await fetch(`/api/audit/users/${searchTerm}/history`);
            if (!res.ok) {
                throw new Error('Erro na busca');
            }
            const data = await res.json();
            setLogs(data);
            setLoading(false);
        } catch (error) {
            console.error('Erro na busca:', error);
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Auditoria de Usuários</h2>
            </div>

            {/* Barra de Busca */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <form onSubmit={handleSearch} className="flex gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar por login de usuário..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                        Buscar Histórico
                    </button>
                </form>
            </div>

            {/* Timeline / Lista */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">Carregando histórico...</div>
                ) : logs.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">Nenhum registro encontrado.</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {logs.map((log) => (
                            <div key={log.id} className="p-6 hover:bg-slate-50 transition-colors">
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 p-2 bg-slate-100 text-slate-600 rounded-lg">
                                        <Clock size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-medium text-slate-800">
                                                    {log.objeto || 'Alteração de Registro'}
                                                </h4>
                                                <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                                                    <User size={14} />
                                                    <span>Autor: <span className="font-medium text-slate-700">{log.login || log.autor || 'Sistema'}</span></span>
                                                    <span>•</span>
                                                    <span>Aplicação: {log.aplicacao || 'N/A'}</span>
                                                </div>
                                            </div>
                                            <span className="text-sm text-slate-400">
                                                {new Date(log.dh_log).toLocaleString()}
                                            </span>
                                        </div>

                                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-xs text-slate-600 overflow-x-auto">
                                            {log.script || 'Sem detalhes técnicos disponíveis'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserAuditReport;
