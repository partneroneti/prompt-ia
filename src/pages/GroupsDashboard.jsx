import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users, Layers, AlertCircle } from 'lucide-react';

const GroupsDashboard = () => {
    const [stats, setStats] = useState(null);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [statsRes, groupsRes] = await Promise.all([
                fetch('/api/groups/stats'),
                fetch('/api/groups')
            ]);

            if (!statsRes.ok || !groupsRes.ok) {
                throw new Error('Erro ao carregar dados');
            }

            const statsData = await statsRes.json();
            const groupsData = await groupsRes.json();

            setStats(statsData);
            setGroups(groupsData);
            setLoading(false);
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Carregando...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Dashboard de Grupos</h2>
                <div className="text-sm text-slate-500">
                    {stats?.totalGroups} grupos totais
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
                        <Layers size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Total de Grupos</p>
                        <h3 className="text-2xl font-bold text-slate-800">{stats?.totalGroups || 0}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-amber-100 text-amber-600 rounded-lg">
                        <AlertCircle size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Grupos de Exceção</p>
                        <h3 className="text-2xl font-bold text-slate-800">{stats?.exceptionGroups || 0}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Usuários Alocados</p>
                        <h3 className="text-2xl font-bold text-slate-800">
                            {stats?.userDistribution.reduce((acc, curr) => acc + parseInt(curr.value), 0) || 0}
                        </h3>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico de Usuários por Grupo */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-semibold text-slate-800 mb-6">Top Grupos por Usuários</h3>
                    <div className="h-80 min-h-[320px] w-full">
                        <ResponsiveContainer width="100%" height={320}>
                            <BarChart data={stats?.userDistribution} layout="vertical" margin={{ left: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={120} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Lista Hierárquica */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Estrutura de Grupos</h3>
                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 sticky top-0">
                                <tr>
                                    <th className="p-3">Ordem</th>
                                    <th className="p-3">Grupo</th>
                                    <th className="p-3">Operação</th>
                                    <th className="p-3 text-center">Tipo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {groups.map(group => (
                                    <tr key={group.id_grupo} className="hover:bg-slate-50">
                                        <td className="p-3 text-slate-400 font-mono">{group.ordem || '-'}</td>
                                        <td className="p-3 font-medium text-slate-700">{group.str_descricao}</td>
                                        <td className="p-3 text-slate-500">{group.nome_operacao || '-'}</td>
                                        <td className="p-3 text-center">
                                            {group.excecao ? (
                                                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                                                    Exceção
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-xs">
                                                    Padrão
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GroupsDashboard;
