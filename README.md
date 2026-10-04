# oficina-dgcar-auth-lambda

Lambda de autenticacao externa por CPF para clientes da Oficina Mecanica DGCar.

## Proposito

Este repositorio contem a Function Serverless implementada para:

- receber CPF informado pelo cliente externo;
- validar formato e digitos do CPF;
- consultar o cliente no PostgreSQL gerenciado;
- verificar existencia e status do cliente;
- emitir JWT externo com `tipo=CLIENTE`;
- separar o JWT de cliente do JWT interno usado por `ATENDENTE`, `MECANICO` e `GESTOR`.

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

Regras de contrato implementadas:

- o CPF e normalizado para apenas digitos antes da consulta;
- o CPF possui validacao de tamanho, formato e digitos verificadores;
- o cliente e consultado na tabela configurada por variaveis de ambiente;
- a autenticacao depende da existencia do cliente;
- o status do cliente e validado contra `CLIENT_ALLOWED_STATUSES`;
- o JWT externo sempre e emitido com `tipo=CLIENTE`;
- o JWT externo nao carrega roles internas da oficina.

Query de cliente padrao:

```text
tabela=clientes
coluna_id=id
coluna_documento=documento
status_padrao=ATIVO
```

Quando a coluna de status do cliente existir no banco, a configuracao prevista e:

```text
CLIENT_STATUS_COLUMN=status_cliente
CLIENT_ALLOWED_STATUSES=ATIVO
```

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

Enquanto o banco nao possui `status_cliente`, `CLIENT_STATUS_COLUMN` permanece vazio e `CLIENT_DEFAULT_STATUS=ATIVO` e usado como status padrao. Quando a coluna for criada, a configuracao esperada passa a ser `CLIENT_STATUS_COLUMN=status_cliente`.

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
- `npm audit`;
- empacotamento da Lambda em `dist/auth-cpf-lambda.zip`.
- validacao Terraform;
- `terraform plan -refresh=false` offline.

Deploy real ocorre apenas por `workflow_dispatch`, usando o environment `homolog` ou `prod`.

Acoes manuais disponiveis:

- `package`: valida e empacota a Lambda;
- `apply-infra`: provisiona ou atualiza a infraestrutura AWS da Lambda via Terraform;
- `deploy-code`: atualiza somente o codigo da Lambda ja existente.

## Infraestrutura Terraform

O diretorio `terraform/` provisiona:

- `aws_lambda_function` para Auth CPF;
- IAM Role da Lambda;
- policies gerenciadas `AWSLambdaBasicExecutionRole` e `AWSLambdaVPCAccessExecutionRole`;
- CloudWatch Log Group;
- Security Group da Lambda;
- configuracao de VPC com subnets privadas;
- variaveis de ambiente usadas em runtime.

Outputs publicados:

- `auth_lambda_function_name`;
- `auth_lambda_function_arn`;
- `auth_lambda_invoke_arn`;
- `auth_lambda_security_group_id`;
- `auth_lambda_log_group_name`.

Os outputs `auth_lambda_function_name`, `auth_lambda_invoke_arn` e `auth_lambda_function_arn` foram definidos para consumo pelo repositorio `oficina-dgcar-infra-k8s`, responsavel por conectar o API Gateway a rota `POST /auth/cpf`.

## Secrets Do GitHub

Os secrets foram organizados em GitHub Environments, nao como secrets globais do repositorio.

Ambientes configurados:

- `homolog`: usado pela branch `homolog`;
- `prod`: usado pela branch `main`.

Em `prod`, a aprovacao manual obrigatoria foi configurada antes de qualquer deploy.

O acesso fica em:

```text
Settings -> Environments -> homolog -> Environment secrets
Settings -> Environments -> prod -> Environment secrets
```

Valores reais nao foram versionados em `.tfvars`, README, codigo, prints ou arquivos locais.

### Bootstrap AWS Ja Confirmado

O projeto historico `mvp-posfiap-oficina-mecanica` foi usado como fonte de verdade para reaproveitar a configuracao AWS ja existente.

Conta AWS confirmada:

```text
Account: 857145323352
Region: us-east-1
IAM user local usado no bootstrap: arn:aws:iam::857145323352:user/16soat-tf
```

Bucket S3 de state reaproveitado:

```text
TF_STATE_BUCKET=oficina-dgcar-fiap-tfstate-tsoat16
```

Validacoes do bucket:

```text
Versioning: Enabled
Encryption: AES256
Public access: blocked
```

Lock do Terraform padronizado com lockfile nativo do backend S3:

```text
use_lockfile=true
```

Chaves de state separadas por ambiente:

```text
homolog -> TF_STATE_KEY=homolog/auth-lambda/terraform.tfstate
prod    -> TF_STATE_KEY=prod/auth-lambda/terraform.tfstate
```

Secrets ja configurados nos environments `homolog` e `prod` deste repositorio:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
CLIENT_JWT_SECRET
GH_AUTOMATION_TOKEN
TF_STATE_BUCKET
TF_STATE_KEY
```

Valores publicos configurados:

```text
AWS_REGION=us-east-1
TF_STATE_BUCKET=oficina-dgcar-fiap-tfstate-tsoat16
```

O valor de `AWS_SECRET_ACCESS_KEY` nao foi exibido em documentacao. Ele foi gravado diretamente nos GitHub Environments.

### Bootstrap Executado Via CLI

A conta AWS ativa foi confirmada com:

```powershell
aws sts get-caller-identity
```

O bucket S3 do Terraform state foi confirmado com:

```powershell
aws s3api head-bucket `
  --bucket oficina-dgcar-fiap-tfstate-tsoat16 `
  --region us-east-1
```

O lock do Terraform foi alinhado ao padrao do projeto historico, usando `use_lockfile=true` no backend S3.

Os secrets foram configurados via GitHub CLI com:

```powershell
$gh = 'C:\Program Files\GitHub CLI\gh.exe'
$repo = 'techdgconsulting/oficina-dgcar-auth-lambda'

$awsAccessKey = (aws configure get aws_access_key_id)
$awsSecretKey = (aws configure get aws_secret_access_key)

$commonSecrets = @{
  AWS_ACCESS_KEY_ID     = $awsAccessKey
  AWS_SECRET_ACCESS_KEY = $awsSecretKey
  AWS_REGION            = 'us-east-1'
  TF_STATE_BUCKET       = 'oficina-dgcar-fiap-tfstate-tsoat16'
}

foreach ($envName in @('homolog', 'prod')) {
  foreach ($item in $commonSecrets.GetEnumerator()) {
    & $gh secret set $item.Key --repo $repo --env $envName --body $item.Value
  }
}

& $gh secret set TF_STATE_KEY --repo $repo --env homolog --body 'homolog/auth-lambda/terraform.tfstate'
& $gh secret set TF_STATE_KEY --repo $repo --env prod --body 'prod/auth-lambda/terraform.tfstate'
```

```powershell
& 'C:\Program Files\GitHub CLI\gh.exe' secret list `
  --repo techdgconsulting/oficina-dgcar-auth-lambda `
  --env homolog

& 'C:\Program Files\GitHub CLI\gh.exe' secret list `
  --repo techdgconsulting/oficina-dgcar-auth-lambda `
  --env prod
```

### Secrets Pendentes

O `apply-infra` permanece bloqueado operacionalmente ate que estes secrets existam no environment escolhido:

```text
VPC_ID
PRIVATE_SUBNET_IDS
DB_HOST
DB_PORT
DB_NAME
DB_USERNAME
DB_PASSWORD
DB_SSL
```

Origem definida:

```text
oficina-dgcar-infra-k8s -> VPC_ID, PRIVATE_SUBNET_IDS
oficina-dgcar-infra-db  -> DB_HOST, DB_PORT, DB_NAME, DB_USERNAME, DB_PASSWORD, DB_SSL
```

`PRIVATE_SUBNET_IDS` foi padronizado como lista JSON:

```text
["subnet-xxxx","subnet-yyyy"]
```

Para RDS PostgreSQL, a configuracao definida foi:

```text
DB_PORT=5432
DB_SSL=true
```

`LAMBDA_ADDITIONAL_SECURITY_GROUP_IDS` e opcional. Se nao houver grupos adicionais:

```text
LAMBDA_ADDITIONAL_SECURITY_GROUP_IDS=[]
```

`CLIENT_STATUS_COLUMN` tambem e opcional. Enquanto o modelo relacional nao possui coluna de status do cliente, o valor permanece vazio e `CLIENT_DEFAULT_STATUS=ATIVO` e usado.

### Matriz De Origem Dos Secrets

| Secret | Origem | Momento de obtencao | Destino |
|---|---|---|---|
| `AWS_ACCESS_KEY_ID` | AWS IAM | Antes de qualquer `apply` Terraform | GitHub Environments `homolog` e `prod` |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM | Antes de qualquer `apply` Terraform | GitHub Environments `homolog` e `prod` |
| `AWS_REGION` | Decisao de arquitetura AWS | Antes de qualquer `apply` Terraform | GitHub Environments `homolog` e `prod` |
| `GH_AUTOMATION_TOKEN` | GitHub CLI/PAT com permissao de secrets | Antes da propagacao automatica entre repos | GitHub Environments `homolog` e `prod` |
| `TF_STATE_BUCKET` | Bucket S3 de state Terraform | Antes do `apply-infra` | GitHub Environments `homolog` e `prod` |
| `TF_STATE_KEY` | Chave segregada por repositorio e ambiente | Antes do `apply-infra` | GitHub Environments `homolog` e `prod` |
| `VPC_ID` | Output `vpc_id` de `oficina-dgcar-infra-k8s` | Depois do apply da VPC/Kubernetes | `oficina-dgcar-auth-lambda` |
| `PRIVATE_SUBNET_IDS` | Output `private_subnet_ids` de `oficina-dgcar-infra-k8s` | Depois do apply da VPC/Kubernetes | `oficina-dgcar-auth-lambda` |
| `LAMBDA_ADDITIONAL_SECURITY_GROUP_IDS` | Definicao de rede da Lambda | Depois da definicao de acesso ao RDS | `oficina-dgcar-auth-lambda` |
| `DB_HOST` | Output `rds_endpoint` de `oficina-dgcar-infra-db` | Depois do apply do RDS | `oficina-dgcar-auth-lambda` |
| `DB_PORT` | Output `rds_port` de `oficina-dgcar-infra-db` | Depois do apply do RDS | `oficina-dgcar-auth-lambda` |
| `DB_NAME` | Output `db_name` ou variavel do RDS | Depois do apply do RDS | `oficina-dgcar-auth-lambda` |
| `DB_USERNAME` | Variavel usada no RDS | Antes ou depois do apply do RDS | `oficina-dgcar-auth-lambda` |
| `DB_PASSWORD` | Variavel usada no RDS | Antes ou depois do apply do RDS | `oficina-dgcar-auth-lambda` |
| `DB_SSL` | Politica de conexao com RDS | Antes do `apply-infra` | `oficina-dgcar-auth-lambda` |
| `CLIENT_STATUS_COLUMN` | Modelo relacional | Quando a coluna de status existir | `oficina-dgcar-auth-lambda` |
| `CLIENT_JWT_SECRET` | Segredo externo de cliente | Antes do `apply-infra` | GitHub Environments `homolog` e `prod` |
| `AUTH_LAMBDA_FUNCTION_NAME` | Output `auth_lambda_function_name` | Depois do `apply-infra` da Lambda | `oficina-dgcar-auth-lambda` e `oficina-dgcar-infra-k8s` |
| `AUTH_LAMBDA_INVOKE_ARN` | Output `auth_lambda_invoke_arn` | Depois do `apply-infra` da Lambda | `oficina-dgcar-infra-k8s` |
| `AUTH_LAMBDA_FUNCTION_ARN` | Output `auth_lambda_function_arn` | Depois do `apply-infra` da Lambda | `oficina-dgcar-infra-k8s` |

### Ordem Operacional De Provisionamento

1. Usuario IAM do GitHub Actions selecionado: `16soat-tf`.
2. Backend Terraform reaproveitado no S3 com `use_lockfile=true`.
3. Secrets de bootstrap gravados nos environments `homolog` e `prod`.
4. Infraestrutura de Kubernetes/VPC fornece `VPC_ID` e `PRIVATE_SUBNET_IDS`.
5. Infraestrutura de RDS PostgreSQL fornece os secrets `DB_*`.
6. `apply-infra` da Lambda cria a Function Serverless e publica os outputs.
7. `oficina-dgcar-infra-k8s` consome os outputs da Lambda para integrar o API Gateway em `POST /auth/cpf`.

### Automacao Entre Repositorios

O workflow `apply-infra` publica automaticamente os outputs da Lambda em repositorios dependentes usando `GH_AUTOMATION_TOKEN`.

Secrets gravados neste repositorio apos o `apply-infra`:

- `AUTH_LAMBDA_FUNCTION_NAME`.

Secrets gravados em `oficina-dgcar-infra-k8s` apos o `apply-infra`:

- `AUTH_LAMBDA_FUNCTION_NAME`;
- `AUTH_LAMBDA_FUNCTION_ARN`;
- `AUTH_LAMBDA_INVOKE_ARN`.

Fluxo automatizado:

1. `oficina-dgcar-infra-k8s` publica `VPC_ID` e `PRIVATE_SUBNET_IDS`.
2. `oficina-dgcar-infra-db` publica `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` e `DB_SSL`.
3. `oficina-dgcar-auth-lambda` executa `apply-infra`.
4. O workflow da Lambda publica os outputs `AUTH_LAMBDA_*` para `oficina-dgcar-infra-k8s`.
5. `oficina-dgcar-infra-k8s` executa novo `apply` para conectar API Gateway a Lambda.

### Geracao Do Segredo JWT Externo

O segredo JWT externo foi gerado localmente com:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

O valor gerado foi salvo como `CLIENT_JWT_SECRET` nos environments `homolog` e `prod`.

Politica aplicada:

- o mesmo nome de secret foi usado nos dois ambientes;
- valores diferentes foram usados para `homolog` e `prod`;
- o `JWT_SECRET` interno da aplicacao Spring nao foi reutilizado;
- o token externo foi limitado a `tipo=CLIENTE`.

Secrets esperados para `apply-infra`:

- `AWS_ACCESS_KEY_ID`;
- `AWS_SECRET_ACCESS_KEY`;
- `AWS_REGION`;
- `GH_AUTOMATION_TOKEN`;
- `TF_STATE_BUCKET`;
- `TF_STATE_KEY`;
- `VPC_ID`;
- `PRIVATE_SUBNET_IDS`;
- `LAMBDA_ADDITIONAL_SECURITY_GROUP_IDS`, opcional;
- `DB_HOST`;
- `DB_PORT`;
- `DB_NAME`;
- `DB_USERNAME`;
- `DB_PASSWORD`;
- `DB_SSL`;
- `CLIENT_STATUS_COLUMN`, opcional;
- `CLIENT_JWT_SECRET`.

Secrets esperados para `deploy-code`:

- `AWS_ACCESS_KEY_ID`;
- `AWS_SECRET_ACCESS_KEY`;
- `AWS_REGION`;
- `AUTH_LAMBDA_FUNCTION_NAME`.

Secrets esperados em runtime da Lambda:

- variaveis de banco;
- variaveis de JWT;
- variaveis de consulta de cliente.

## Provisionamento

Execucao local para validar Terraform:

```bash
npm ci
npm run package
cd terraform
terraform init -backend=false
terraform fmt -check -recursive
terraform validate
terraform plan -refresh=false
```

A infraestrutura real e aplicada pelo workflow manual:

```text
Actions -> Auth CPF Lambda -> Run workflow -> action=apply-infra
```

A atualizacao exclusiva do codigo e feita pelo workflow manual:

```text
Actions -> Auth CPF Lambda -> Run workflow -> action=deploy-code
```

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
