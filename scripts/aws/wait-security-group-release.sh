#!/usr/bin/env bash
set -euo pipefail

: "${AWS_REGION:?AWS_REGION nao informado}"
: "${SECURITY_GROUP_ID:?SECURITY_GROUP_ID nao informado}"
: "${MAX_ATTEMPTS:=80}"
: "${WAIT_SECONDS:=30}"

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  eni_ids="$(aws ec2 describe-network-interfaces \
    --region "$AWS_REGION" \
    --filters "Name=group-id,Values=${SECURITY_GROUP_ID}" \
    --query 'NetworkInterfaces[].NetworkInterfaceId' \
    --output text)"

  if [ -z "$eni_ids" ]; then
    echo "Security group $SECURITY_GROUP_ID liberado para remocao."
    exit 0
  fi

  echo "Security group $SECURITY_GROUP_ID ainda possui ENIs vinculadas: $eni_ids"
  echo "Aguardando liberacao pela AWS: tentativa $attempt/$MAX_ATTEMPTS"
  sleep "$WAIT_SECONDS"
done

echo "::error::Security group $SECURITY_GROUP_ID permaneceu com ENIs vinculadas apos a espera operacional."
aws ec2 describe-network-interfaces \
  --region "$AWS_REGION" \
  --filters "Name=group-id,Values=${SECURITY_GROUP_ID}" \
  --query 'NetworkInterfaces[].{id:NetworkInterfaceId,status:Status,description:Description,requesterManaged:RequesterManaged,attachment:Attachment.AttachmentId}' \
  --output table
exit 1
