#!/bin/bash

# Script de deploy para Conductor Web Chat
# Uso: ./deploy.sh [ambiente]

set -e

# Configurações
ENVIRONMENT=${1:-development}
PROJECT_NAME="conductor-web"
PORT=${2:-8080}

echo "🚀 Deploying Conductor Web Chat - Environment: $ENVIRONMENT"

# Verificar se o Conductor Gateway está rodando
echo "🔍 Verificando Conductor Gateway..."
if ! curl -s http://localhost:5006/health > /dev/null; then
    echo "❌ Erro: Conductor Gateway não está rodando em localhost:5006"
    echo "   Execute: cd conductor_gateway && python main.py"
    exit 1
fi

echo "✅ Conductor Gateway está rodando"

# Verificar dependências
echo "🔍 Verificando dependências..."

# Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 não encontrado"
    exit 1
fi

# Node.js (opcional)
if command -v node &> /dev/null; then
    echo "✅ Node.js encontrado"
    USE_NODE=true
else
    echo "⚠️  Node.js não encontrado, usando Python HTTP server"
    USE_NODE=false
fi

# Preparar ambiente
echo "📁 Preparando ambiente..."

# Criar diretório de deploy
DEPLOY_DIR="deploy_$ENVIRONMENT"
mkdir -p $DEPLOY_DIR

# Copiar arquivos
cp index.html $DEPLOY_DIR/
cp style.css $DEPLOY_DIR/
cp script.js $DEPLOY_DIR/
cp config.js $DEPLOY_DIR/
cp README.md $DEPLOY_DIR/

# Configurar para ambiente
if [ "$ENVIRONMENT" = "production" ]; then
    echo "🔧 Configurando para produção..."
    
    # Atualizar configurações para produção
    sed -i 's/localhost:5006/your-api-domain.com/g' $DEPLOY_DIR/script.js
    sed -i 's/test-api-key-123/your-production-api-key/g' $DEPLOY_DIR/script.js
    
    # Adicionar headers de segurança
    cat > $DEPLOY_DIR/.htaccess << EOF
Header always set X-Content-Type-Options nosniff
Header always set X-Frame-Options DENY
Header always set X-XSS-Protection "1; mode=block"
Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
EOF
fi

echo "✅ Arquivos preparados em $DEPLOY_DIR/"

# Iniciar servidor
echo "🌐 Iniciando servidor web..."

if [ "$USE_NODE" = true ]; then
    echo "📦 Usando Node.js server..."
    
    # Criar package.json
    cat > $DEPLOY_DIR/package.json << EOF
{
  "name": "$PROJECT_NAME",
  "version": "1.0.0",
  "description": "Conductor Web Chat Interface",
  "main": "index.html",
  "scripts": {
    "start": "http-server -p $PORT -c-1",
    "dev": "http-server -p $PORT -c-1 -o"
  },
  "dependencies": {
    "http-server": "^14.1.1"
  }
}
EOF

    # Instalar dependências e iniciar
    cd $DEPLOY_DIR
    npm install
    npm start &
    SERVER_PID=$!
    
else
    echo "🐍 Usando Python HTTP server..."
    
    cd $DEPLOY_DIR
    python3 -m http.server $PORT &
    SERVER_PID=$!
fi

# Aguardar servidor iniciar
sleep 2

# Verificar se servidor está rodando
if curl -s http://localhost:$PORT > /dev/null; then
    echo "✅ Servidor iniciado com sucesso!"
    echo "🌐 Acesse: http://localhost:$PORT"
    echo "📱 Interface responsiva disponível"
    echo "🔧 Para parar: kill $SERVER_PID"
    
    # Abrir no navegador (se possível)
    if command -v xdg-open &> /dev/null; then
        xdg-open http://localhost:$PORT
    elif command -v open &> /dev/null; then
        open http://localhost:$PORT
    fi
    
else
    echo "❌ Erro ao iniciar servidor"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi

echo ""
echo "🎉 Deploy concluído!"
echo "📋 Próximos passos:"
echo "   1. Teste a interface em http://localhost:$PORT"
echo "   2. Verifique se o Conductor Gateway está rodando"
echo "   3. Teste os comandos de chat"
echo "   4. Configure para produção se necessário"
echo ""
echo "📚 Documentação: $DEPLOY_DIR/README.md"
echo "🔧 Configurações: $DEPLOY_DIR/config.js"
