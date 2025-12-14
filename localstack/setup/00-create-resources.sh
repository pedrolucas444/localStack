#!/usr/bin/env bash
set -euo pipefail

# This script runs automatically inside LocalStack at startup
# Requires awslocal (provided in the LocalStack image)

REGION=${DEFAULT_REGION:-us-east-1}
BUCKET=${S3_BUCKET_NAME:-shopping-images}
TABLE=${DDB_TABLE_NAME:-Tasks}
QUEUE=${SQS_QUEUE_NAME:-task-events}
TOPIC=${SNS_TOPIC_NAME:-task-notifications}

awslocal s3 mb s3://"${BUCKET}" || true

awslocal dynamodb create-table \
  --table-name "${TABLE}" \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --table-class STANDARD || true

awslocal sqs create-queue --queue-name "${QUEUE}" || true

awslocal sns create-topic --name "${TOPIC}" || true

echo "LocalStack resources initialized:"
echo "- S3 bucket: ${BUCKET}"
echo "- DynamoDB table: ${TABLE}"
echo "- SQS queue: ${QUEUE}"
echo "- SNS topic: ${TOPIC}"