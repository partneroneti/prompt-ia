-- Query para verificar como as senhas estão armazenadas na tabela tb_usuario
-- Mostra apenas o comprimento e primeiros caracteres (para segurança)

SELECT 
    id_usuario,
    str_login,
    str_descricao,
    LENGTH(str_senha) as tamanho_senha,
    LEFT(str_senha, 10) as primeiros_10_chars,
    CASE 
        WHEN str_senha IS NULL THEN 'NULL'
        WHEN str_senha = '' THEN 'VAZIA'
        WHEN LENGTH(str_senha) = 64 THEN 'POSSIVEL SHA-256 (64 chars hex)'
        WHEN LENGTH(str_senha) < 20 THEN 'POSSIVEL TEXTO PLANO'
        ELSE 'OUTRO FORMATO'
    END as tipo_senha
FROM tb_usuario
WHERE str_ativo = 'A'
ORDER BY id_usuario
LIMIT 10;

