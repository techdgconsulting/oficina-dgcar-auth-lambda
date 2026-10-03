# oficina-dgcar-auth-lambda

Repositório da Function Serverless responsável pela autenticação externa de clientes por CPF no Tech Challenge 3 da Oficina Mecânica DGCar.

## Propósito

- Receber CPF de cliente externo.
- Validar formato e dígitos do CPF.
- Consultar existência e status do cliente no PostgreSQL gerenciado.
- Emitir JWT externo de cliente com `tipo=CLIENTE`.
- Manter autenticação de cliente separada da autenticação interna de funcionários.

## Tecnologia Alvo

- AWS Lambda
- Node.js 20.x
- PostgreSQL
- JWT
- GitHub Actions

## Branches E Ambientes

- `main`: produção, protegida e sem commits diretos.
- `homolog`: homologação, com deploy automático quando configurado.
- GitHub Environments esperados: `homolog` e `prod`.

## Secrets Esperados

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USERNAME`
- `DB_PASSWORD`
- `CLIENT_JWT_SECRET`
- `CLIENT_JWT_ISSUER`

## Relação Com Os Demais Repositórios

- Consome dados e conectividade definidos por `oficina-dgcar-infra-db`.
- É integrada ao API Gateway definido em `oficina-dgcar-infra-k8s`.
- Emite token validado também pela aplicação `oficina-dgcar-api`.

## Status

Estrutura inicial criada. Código da Lambda e pipeline de deploy serão adicionados nas próximas etapas.
