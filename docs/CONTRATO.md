# Contrato Da Lambda Auth CPF

## Requisicao

```json
{
  "cpf": "529.982.247-25"
}
```

## Resposta De Sucesso

```json
{
  "tokenType": "Bearer",
  "accessToken": "jwt",
  "expiresIn": "15m"
}
```

## Regras

- CPF e normalizado para apenas digitos antes da consulta.
- CPF deve possuir 11 digitos e digitos verificadores validos.
- Cliente deve existir na tabela configurada.
- Cliente deve ter status permitido por `CLIENT_ALLOWED_STATUSES`.
- JWT externo deve sempre usar `tipo=CLIENTE`.
- JWT externo nao deve conter roles internas da oficina.

## Query De Cliente

Por padrao:

- tabela: `clientes`;
- coluna de ID: `id`;
- coluna de documento: `documento`;
- status padrao: `ATIVO`.

Quando `status_cliente` existir no banco, configurar:

```text
CLIENT_STATUS_COLUMN=status_cliente
CLIENT_ALLOWED_STATUSES=ATIVO
```
