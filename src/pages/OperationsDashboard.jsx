import React, { useState, useEffect } from 'react';
import { BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { Building2, Users, Activity, Filter } from 'lucide-react';

const OperationsDashboard = () => {
    const [stats, setStats] = useState(null);
    const [operations, setOperations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOp, setSelectedOp] = useState(null);
    const [opUsers, setOpUsers] = useState([]);

    const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#ef4444'];

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (selectedOp) {
            fetchOpUsers(selectedOp);
        }
    }, [selectedOp]);

    const fetchData = async () => {
        try {
            const [statsRes, opsRes] = await Promise.all([
                fetch('/api/operations/stats'),
                fetch('/api/operations')
            ]);

            if (!statsRes.ok || !opsRes.ok) {
                throw new Error('Erro ao carregar dados');
            }

            const statsData = await statsRes.json();
            const opsData = await opsRes.json();

            setStats(statsData);
            setOperations(opsData);
            setLoading(false);
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            setLoading(false);
        }
    };

    const fetchOpUsers = async (opId) => {
        try {
            const res = await fetch(`/api/operations/${opId}/users`);
            if (!res.ok) {
                throw new Error('Erro ao carregar usuários');
            }
            const data = await res.json();
            setOpUsers(data);
        } catch (error) {
            console.error('Erro ao carregar usuários da operação:', error);
        }
    };

    if (loading) return <div className="p-8 text-center">Carregando...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Dashboard de Operações</h2>
                <div className="text-sm text-slate-500">
                    {operations.length} operações cadastradas
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                        <Building2 size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Operações Ativas</p>
                        <h3 className="text-2xl font-bold text-slate-800">{stats?.totalActive || 0}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-green-100 text-green-600 rounded-lg">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Usuários em Operações</p>
                        <h3 className="text-2xl font-bold text-slate-800">
                            {stats?.userDistribution.reduce((acc, curr) => acc + parseInt(curr.value), 0) || 0}
                        </h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
                        <Activity size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Média Usuários/Op</p>
                        <h3 className="text-2xl font-bold text-slate-800">
                            {stats?.totalActive ? Math.round(stats.userDistribution.reduce((acc, curr) => acc + parseInt(curr.value), 0) / stats.totalActive) : 0}
                        </h3>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico de Distribuição */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-semibold text-slate-800 mb-6">Usuários por Operação</h3>
                    <div className="h-80 min-h-[320px] w-full">
                        <ResponsiveContainer width="100%" height={320}>
                            <BarChart data={stats?.userDistribution} layout="vertical" margin={{ left: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={100} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                                    {stats?.userDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Lista de Operações */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Detalhes da Operação</h3>
                    <div className="mb-4">
                        <select
                            className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onChange={(e) => setSelectedOp(e.target.value)}
                            value={selectedOp || ''}
                        >
                            <option value="">Selecione uma operação...</option>
                            {operations.map(op => (
                                <option key={op.id_operacao} value={op.id_operacao}>
                                    {op.str_descricao}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedOp && (
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 rounded-lg">
                                <h4 className="font-medium text-slate-700 mb-2">Informações</h4>
                                {(() => {
                                    const op = operations.find(o => o.id_operacao == selectedOp);
                                    return op ? (
                                        <div className="text-sm text-slate-600 space-y-1">
                                            <p><span className="font-medium">CNPJ:</span> {op.str_documento || 'N/A'}</p>
                                            <p><span className="font-medium">Status:</span> {op.str_ativo === 'A' ? 'Ativo' : 'Inativo'}</p>
                                            <p><span className="font-medium">Config:</span> {op.config ? 'Personalizada' : 'Padrão'}</p>
                                        </div>
                                    ) : null;
                                })()}
                            </div>

                            <div>
                                <h4 className="font-medium text-slate-700 mb-2">Usuários ({opUsers.length})</h4>
                                <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-lg">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 sticky top-0">
                                            <tr>
                                                <th className="p-2">Nome</th>
                                                <th className="p-2">Login</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {opUsers.map(user => (
                                                <tr key={user.id_usuario}>
                                                    <td className="p-2">{user.str_descricao}</td>
                                                    <td className="p-2 text-slate-500">{user.str_login}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OperationsDashboard;
