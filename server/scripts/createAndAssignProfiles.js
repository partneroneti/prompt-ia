const db = require('../db');

async function createAndAssignProfiles() {
    try {
        console.log('🔍 Buscando perfis...');

        // 1. Buscar ou criar perfil MASTER
        let master = await db.query(
            `SELECT id_perfil FROM tb_perfil WHERE UPPER(str_descricao) = 'MASTER' AND str_ativo = 'A' LIMIT 1`
        );
        
        if (master.rows.length === 0) {
            console.log('📝 Criando perfil MASTER...');
            master = await db.query(
                `INSERT INTO tb_perfil (str_descricao, str_ativo) VALUES ('MASTER', 'A') RETURNING id_perfil`
            );
            console.log('✅ Perfil MASTER criado!');
        }
        const masterId = master.rows[0].id_perfil;

        // 2. Buscar ou criar perfil OPERACIONAL
        let operacional = await db.query(
            `SELECT id_perfil FROM tb_perfil WHERE UPPER(str_descricao) = 'OPERACIONAL' AND str_ativo = 'A' LIMIT 1`
        );
        
        if (operacional.rows.length === 0) {
            console.log('📝 Criando perfil OPERACIONAL...');
            operacional = await db.query(
                `INSERT INTO tb_perfil (str_descricao, str_ativo) VALUES ('OPERACIONAL', 'A') RETURNING id_perfil`
            );
            console.log('✅ Perfil OPERACIONAL criado!');
        }
        const operacionalId = operacional.rows[0].id_perfil;

        // 3. Buscar 2 usuários ativos
        const users = await db.query(
            `SELECT id_usuario, str_descricao, str_login 
             FROM tb_usuario 
             WHERE str_ativo = 'A' AND bloqueado = false
             ORDER BY id_usuario
             LIMIT 2`
        );

        if (users.rows.length < 2) {
            throw new Error('Precisa ter pelo menos 2 usuários ativos');
        }

        const user1 = users.rows[0];
        const user2 = users.rows[1];

        // 4. Associar primeiro usuário ao MASTER
        const checkMaster = await db.query(
            `SELECT id FROM tb_usuario_perfil WHERE id_usuario = $1 AND id_perfil = $2`,
            [user1.id_usuario, masterId]
        );
        
        if (checkMaster.rows.length === 0) {
            await db.query(
                `INSERT INTO tb_usuario_perfil (id_usuario, id_perfil) VALUES ($1, $2)`,
                [user1.id_usuario, masterId]
            );
            console.log(`✅ Usuário ${user1.str_descricao} (${user1.str_login}) associado ao MASTER`);
        } else {
            console.log(`✅ Usuário ${user1.str_descricao} já tem perfil MASTER`);
        }

        // 5. Associar segundo usuário ao OPERACIONAL
        const checkOperacional = await db.query(
            `SELECT id FROM tb_usuario_perfil WHERE id_usuario = $1 AND id_perfil = $2`,
            [user2.id_usuario, operacionalId]
        );
        
        if (checkOperacional.rows.length === 0) {
            await db.query(
                `INSERT INTO tb_usuario_perfil (id_usuario, id_perfil) VALUES ($1, $2)`,
                [user2.id_usuario, operacionalId]
            );
            console.log(`✅ Usuário ${user2.str_descricao} (${user2.str_login}) associado ao OPERACIONAL`);
        } else {
            console.log(`✅ Usuário ${user2.str_descricao} já tem perfil OPERACIONAL`);
        }

        return {
            master: {
                perfil_id: masterId,
                usuario: {
                    id: user1.id_usuario,
                    nome: user1.str_descricao,
                    login: user1.str_login
                }
            },
            operacional: {
                perfil_id: operacionalId,
                usuario: {
                    id: user2.id_usuario,
                    nome: user2.str_descricao,
                    login: user2.str_login
                }
            }
        };

    } catch (error) {
        console.error('❌ Erro:', error);
        throw error;
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    createAndAssignProfiles()
        .then(result => {
            console.log('\n📊 Resumo:');
            console.log(JSON.stringify(result, null, 2));
            console.log('\n✅ Concluído! Faça logout e login novamente com os usuários acima.');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Erro:', error);
            process.exit(1);
        });
}

module.exports = { createAndAssignProfiles };


