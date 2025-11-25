-- ============================================
-- QUERIES PARA BUSCAR PERFIS E USUÁRIOS
-- ============================================

-- 1. Ver todos os perfis disponíveis
SELECT id_perfil, str_descricao, str_ativo
FROM tb_perfil
WHERE str_ativo = 'A'
ORDER BY str_descricao;

-- 2. Buscar usuários com perfil MASTER
SELECT 
    u.id_usuario,
    u.str_descricao as nome_usuario,
    u.str_login,
    u.email,
    p.str_descricao as perfil
FROM tb_usuario u
JOIN tb_usuario_perfil up ON u.id_usuario = up.id_usuario
JOIN tb_perfil p ON up.id_perfil = p.id_perfil
WHERE UPPER(p.str_descricao) = 'MASTER'
  AND u.str_ativo = 'A'
  AND u.bloqueado = false
  AND p.str_ativo = 'A'
ORDER BY u.str_descricao;

-- 3. Buscar usuários com perfil OPERACIONAL
SELECT 
    u.id_usuario,
    u.str_descricao as nome_usuario,
    u.str_login,
    u.email,
    p.str_descricao as perfil
FROM tb_usuario u
JOIN tb_usuario_perfil up ON u.id_usuario = up.id_usuario
JOIN tb_perfil p ON up.id_perfil = p.id_perfil
WHERE UPPER(p.str_descricao) = 'OPERACIONAL'
  AND u.str_ativo = 'A'
  AND u.bloqueado = false
  AND p.str_ativo = 'A'
ORDER BY u.str_descricao;

-- 4. Ver todos os usuários e seus perfis
SELECT 
    u.id_usuario,
    u.str_descricao as nome_usuario,
    u.str_login,
    u.email,
    STRING_AGG(p.str_descricao, ', ') as perfis
FROM tb_usuario u
LEFT JOIN tb_usuario_perfil up ON u.id_usuario = up.id_usuario
LEFT JOIN tb_perfil p ON up.id_perfil = p.id_perfil AND p.str_ativo = 'A'
WHERE u.str_ativo = 'A'
  AND u.bloqueado = false
GROUP BY u.id_usuario, u.str_descricao, u.str_login, u.email
ORDER BY u.str_descricao;

-- 5. Criar perfil MASTER se não existir
INSERT INTO tb_perfil (str_descricao, str_ativo)
SELECT 'MASTER', 'A'
WHERE NOT EXISTS (
    SELECT 1 FROM tb_perfil 
    WHERE UPPER(str_descricao) = 'MASTER' AND str_ativo = 'A'
)
RETURNING id_perfil, str_descricao;

-- 6. Criar perfil OPERACIONAL se não existir
INSERT INTO tb_perfil (str_descricao, str_ativo)
SELECT 'OPERACIONAL', 'A'
WHERE NOT EXISTS (
    SELECT 1 FROM tb_perfil 
    WHERE UPPER(str_descricao) = 'OPERACIONAL' AND str_ativo = 'A'
)
RETURNING id_perfil, str_descricao;

-- 7. Associar perfil MASTER a um usuário específico (substitua o ID_USUARIO)
-- Exemplo: associar ao usuário ID 306
/*
INSERT INTO tb_usuario_perfil (id_usuario, id_perfil)
SELECT 306, id_perfil
FROM tb_perfil
WHERE UPPER(str_descricao) = 'MASTER' AND str_ativo = 'A'
AND NOT EXISTS (
    SELECT 1 FROM tb_usuario_perfil 
    WHERE id_usuario = 306 
    AND id_perfil = (SELECT id_perfil FROM tb_perfil WHERE UPPER(str_descricao) = 'MASTER')
)
RETURNING id, id_usuario, id_perfil;
*/

-- 8. Associar perfil OPERACIONAL a um usuário específico (substitua o ID_USUARIO)
-- Exemplo: associar ao usuário ID 296
/*
INSERT INTO tb_usuario_perfil (id_usuario, id_perfil)
SELECT 296, id_perfil
FROM tb_perfil
WHERE UPPER(str_descricao) = 'OPERACIONAL' AND str_ativo = 'A'
AND NOT EXISTS (
    SELECT 1 FROM tb_usuario_perfil 
    WHERE id_usuario = 296 
    AND id_perfil = (SELECT id_perfil FROM tb_perfil WHERE UPPER(str_descricao) = 'OPERACIONAL')
)
RETURNING id, id_usuario, id_perfil;
*/

