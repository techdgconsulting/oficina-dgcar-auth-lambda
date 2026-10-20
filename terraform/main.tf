locals {
  name = "${var.project_name}-${var.environment}-auth-cpf"

  lambda_environment_variables = merge(
    {
      DB_HOST                 = var.db_host
      DB_PORT                 = var.db_port
      DB_NAME                 = var.db_name
      DB_USERNAME             = var.db_username
      DB_PASSWORD             = var.db_password
      DB_SSL                  = var.db_ssl
      CLIENT_TABLE            = var.client_table
      CLIENT_ID_COLUMN        = var.client_id_column
      CLIENT_DOCUMENT_COLUMN  = var.client_document_column
      CLIENT_DEFAULT_STATUS   = var.client_default_status
      CLIENT_ALLOWED_STATUSES = var.client_allowed_statuses
      CLIENT_JWT_SECRET       = var.client_jwt_secret
      CLIENT_JWT_ISSUER       = var.client_jwt_issuer
      CLIENT_JWT_AUDIENCE     = var.client_jwt_audience
      CLIENT_JWT_EXPIRES_IN   = var.client_jwt_expires_in
    },
    var.client_status_column != "" ? {
      CLIENT_STATUS_COLUMN = var.client_status_column
    } : {}
  )
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.name}"
  retention_in_days = var.log_retention_days
}

resource "aws_security_group" "lambda" {
  name        = "${local.name}-sg"
  description = "Security group for CPF authentication Lambda"
  vpc_id      = var.vpc_id

  egress {
    description = "Allow outbound access to RDS and AWS services"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name}-sg"
  }
}

resource "aws_iam_role" "lambda" {
  name = "${local.name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "basic_execution" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "vpc_access" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_lambda_function" "auth_cpf" {
  function_name = local.name
  description   = "Authenticates external DGCar clients by CPF and returns client JWT."

  filename         = var.lambda_package_path
  source_code_hash = filebase64sha256(var.lambda_package_path)

  role    = aws_iam_role.lambda.arn
  handler = "src/handler.handler"
  runtime = "nodejs20.x"

  timeout     = var.lambda_timeout_seconds
  memory_size = var.lambda_memory_size_mb

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = concat([aws_security_group.lambda.id], var.additional_security_group_ids)
  }

  environment {
    variables = local.lambda_environment_variables
  }

  depends_on = [
    aws_cloudwatch_log_group.lambda,
    aws_iam_role_policy_attachment.basic_execution,
    aws_iam_role_policy_attachment.vpc_access
  ]

  tags = {
    Name = local.name
  }
}
