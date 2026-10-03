output "auth_lambda_function_name" {
  description = "CPF authentication Lambda function name."
  value       = aws_lambda_function.auth_cpf.function_name
}

output "auth_lambda_function_arn" {
  description = "CPF authentication Lambda function ARN."
  value       = aws_lambda_function.auth_cpf.arn
}

output "auth_lambda_invoke_arn" {
  description = "CPF authentication Lambda invoke ARN used by API Gateway."
  value       = aws_lambda_function.auth_cpf.invoke_arn
}

output "auth_lambda_security_group_id" {
  description = "Security group ID attached to the CPF authentication Lambda."
  value       = aws_security_group.lambda.id
}

output "auth_lambda_log_group_name" {
  description = "CloudWatch log group name used by the CPF authentication Lambda."
  value       = aws_cloudwatch_log_group.lambda.name
}
