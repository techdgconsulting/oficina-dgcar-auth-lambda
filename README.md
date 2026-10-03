# oficina-dgcar-auth-lambda

Lambda de autenticacao externa por CPF para clientes da Oficina Mecanica DGCar.

## Proposito

Este repositorio contem a Function Serverless responsavel por:

- receber CPF informado pelo cliente externo;
- validar formato e digitos do CPF;
- consultar o cliente no PostgreSQL gerenciado;
- verificar existencia e status do cliente;
- emitir JWT externo com `tipo=CLIENTE`;
- manter o JWT de cliente separado do JWT interno usado por `ATENDENTE`, `MECANICO` e `GESTOR`.

## Contrato HTTP

Endpoint previsto no API Gateway:

```http
POST /auth/cpf
content-type: application/json
```

Entrada:

```json
{
  "cpf": "529.982.247-25"
}
```

Resposta `200`:

```json
{
  "tokenType": "Bearer",
  "accessToken": "jwt-do-cliente",
  "expiresIn": "15m"
}
```

Erros esperados:

- `400 CPF_INVALIDO`: CPF com formato ou digitos invalidos.
- `400 JSON_INVALIDO`: corpo da requisicao nao e JSON valido.
- `404 CLIENTE_NAO_ENCONTRADO`: CPF valido sem cliente cadastrado.
- `403 CLIENTE_SEM_ACESSO`: cliente existe, mas status nao permite autenticacao.
- `500 ERRO_INTERNO`: falha inesperada de banco, token ou configuracao.

## Claims Do JWT Externo

O token emitido possui claims especificas de cliente:

- `sub`: CPF normalizado;
- `clienteId`;
- `tipo`: `CLIENTE`;
- `status`;
- `iat`;
- `exp`;
- `iss`;
- `aud`.

Este token nao carrega perfis internos, como `ATENDENTE`, `MECANICO` ou `GESTOR`.

## Variaveis De Ambiente

Banco:

- `DB_HOST`;
- `DB_PORT`, padrao `5432`;
- `DB_NAME`;
- `DB_USERNAME`;
- `DB_PASSWORD`;
- `DB_SSL`, padrao `false`;
- `DB_POOL_MAX`, padrao `2`;
- `DB_IDLE_TIMEOUT_MS`, padrao `10000`.

Consulta de cliente:

- `CLIENT_TABLE`, padrao `clientes`;
- `CLIENT_ID_COLUMN`, padrao `id`;
- `CLIENT_DOCUMENT_COLUMN`, padrao `documento`;
- `CLIENT_STATUS_COLUMN`, opcional;
- `CLIENT_DEFAULT_STATUS`, padrao `ATIVO`;
- `CLIENT_ALLOWED_STATUSES`, padrao `ATIVO`.

Enquanto o banco nao tiver `status_cliente`, deixe `CLIENT_STATUS_COLUMN` vazio e use `CLIENT_DEFAULT_STATUS=ATIVO`. Quando a coluna existir, configure `CLIENT_STATUS_COLUMN=status_cliente`.

JWT:

- `CLIENT_JWT_SECRET`, minimo de 32 caracteres;
- `CLIENT_JWT_ISSUER`, padrao `oficina-dgcar-auth-lambda`;
- `CLIENT_JWT_AUDIENCE`, padrao `oficina-dgcar-api`;
- `CLIENT_JWT_EXPIRES_IN`, padrao `15m`.

## Execucao Local

```bash
npm ci
npm test
npm run package
```

Para simular chamada local:

```bash
node -e "const { handler } = require('./src/handler'); handler({ body: JSON.stringify({ cpf: '529.982.247-25' }) }).then(console.log)"
```

## Pipeline

Pull Requests e pushes executam:

- instalacao de dependencias;
- lint sintatico;
- testes automatizados com cobertura;
- empacotamento da Lambda em `dist/auth-cpf-lambda.zip`.

Deploy real ocorre apenas por `workflow_dispatch` com `action=deploy`, usando o environment `homolog` ou `prod`.

Secrets esperados para deploy:

- `AWS_ACCESS_KEY_ID`;
- `AWS_SECRET_ACCESS_KEY`;
- `AWS_REGION`;
- `AUTH_LAMBDA_FUNCTION_NAME`.

Secrets esperados em runtime da Lambda:

- variaveis de banco;
- variaveis de JWT;
- variaveis de consulta de cliente.

## Integracao Com Outros Repositorios

- `oficina-dgcar-infra-db`: fornece endpoint, porta, nome do banco e conectividade PostgreSQL.
- `oficina-dgcar-infra-k8s`: integra a Lambda ao API Gateway na rota `POST /auth/cpf`.
- `oficina-dgcar-api`: valida tambem o JWT externo de cliente nas rotas protegidas.

## Evidencia

A evidencia minima de funcionamento e composta por:

- testes automatizados verdes;
- package `dist/auth-cpf-lambda.zip` gerado;
- chamada `POST /auth/cpf` retornando JWT;
- JWT decodificado contendo `tipo=CLIENTE`, `clienteId`, `status`, `sub`, `iat` e `exp`.

## Origem Historica

O commit de origem e a rastreabilidade da extracao estao registrados em [`ORIGEM_HISTORICA.md`](./ORIGEM_HISTORICA.md).
