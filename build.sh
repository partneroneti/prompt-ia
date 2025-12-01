#!/bin/bash
docker buildx build \
  --platform linux/amd64 \
  -t registry.kubernetes.partner1.com.br/prompt-ia-backend \
  -f server/Dockerfile \
  --push \
  .


docker buildx build \
  --platform linux/amd64 \
  -t registry.kubernetes.partner1.com.br/prompt-ia-frontend \
  -f Dockerfile.frontend \
  --push \
  .