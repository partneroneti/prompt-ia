const path = require('path');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente do .env na raiz do projeto
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const db = require('../db');

/**
 * Script para verificar quais roles um perfil possui
 * Uso: node server/scripts/checkProfileRoles.js [nome_do_perfil]
 * Exemplo: node server/scripts/checkProfileRoles.js MASTER
 */

async function checkProfileRoles(profileName) {
    try {
        console.log(`\n🔍 Verificando roles do perfil: ${profileName}\n`);

        // Buscar o perfil e suas roles
        const result = await db.query(
            `SELECT 
                p.id_perfil,
                p.str_descricao as perfil_nome,
                r.id_role,
                r.str_descricao as role_nome,
                pr.id as relacionamento_id
             FROM tb_perfil p
             LEFT JOIN tb_perfil_role pr ON p.id_perfil = pr.id_perfil AND pr.str_ativo = 'A'
             LEFT JOIN tb_role r ON pr.id_role = r.id_role AND r.str_ativo = 'A'
             WHERE UPPER(p.str_descricao) = UPPER($1)
               AND p.str_ativo = 'A'
             ORDER BY r.str_descricao`,
            [profileName]
        );

        if (result.rows.length === 0) {
            console.log(`❌ Perfil "${profileName}" não encontrado ou está inativo.\n`);
            return;
        }

        const profile = result.rows[0];
        const roles = result.rows.filter(row => row.role_nome !== null);

        console.log(`📋 Informações do Perfil:`);
        console.log(`   ID: ${profile.id_perfil}`);
        console.log(`   Nome: ${profile.perfil_nome}\n`);

        if (roles.length === 0) {
            console.log(`⚠️  Este perfil não possui roles associadas.\n`);
        } else {
            console.log(`✅ Roles associadas (${roles.length}):\n`);
            roles.forEach((role, index) => {
                console.log(`   ${index + 1}. ${role.role_nome} (ID: ${role.id_role})`);
            });
            console.log('');
        }

        // Listar todos os perfis para comparação
        console.log(`\n📊 Comparação com outros perfis:\n`);
        const allProfiles = await db.query(
            `SELECT 
                p.str_descricao as perfil_nome,
                COUNT(DISTINCT r.id_role) as quantidade_roles,
                STRING_AGG(DISTINCT r.str_descricao, ', ' ORDER BY r.str_descricao) as roles_associadas
             FROM tb_perfil p
             LEFT JOIN tb_perfil_role pr ON p.id_perfil = pr.id_perfil AND pr.str_ativo = 'A'
             LEFT JOIN tb_role r ON pr.id_role = r.id_role AND r.str_ativo = 'A'
             WHERE p.str_ativo = 'A'
             GROUP BY p.id_perfil, p.str_descricao
             ORDER BY p.str_descricao`
        );

        allProfiles.rows.forEach(profile => {
            if (profile.quantidade_roles === 0) {
                console.log(`   • ${profile.perfil_nome}: Sem roles`);
            } else {
                console.log(`   • ${profile.perfil_nome}: ${profile.quantidade_roles} role(s) - ${profile.roles_associadas}`);
            }
        });
        console.log('');

    } catch (error) {
        console.error('❌ Erro ao verificar roles:', error.message);
        process.exit(1);
    }
}

// Executar
const profileName = process.argv[2] || 'MASTER';
checkProfileRoles(profileName);
