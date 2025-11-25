-- Script SQL para atualizar o CPF do usuário luis.eri.santos
-- Execute este script diretamente no banco de dados usando um usuário com permissões adequadas

UPDATE tb_usuario 
SET str_cpf = '412.229.618-81', 
    dh_edita = NOW() 
WHERE str_login = 'luis.eri.santos'
RETURNING id_usuario, str_descricao, str_login, email, str_cpf;

-- Verificar se a atualização foi bem-sucedida
SELECT id_usuario, str_descricao, str_login, email, str_cpf, dh_edita
FROM tb_usuario 
WHERE str_login = 'luis.eri.santos';


