# ADI Importer - Node.js + Python Runtime
# Production-ready image with both runtimes for conversion scripts

FROM node:20-alpine

# Install Python 3 and required tools
RUN apk add --no-cache \
    python3 \
    py3-pip \
    && ln -sf python3 /usr/bin/python

# Verify installations
RUN node --version && python3 --version

# Set working directory
WORKDIR /workspace

# Default command (overridden by docker-compose)
CMD ["node"]