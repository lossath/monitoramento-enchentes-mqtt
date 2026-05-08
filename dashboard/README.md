🌊 Guardian AI: Monitoramento de Enchentes com Edge AI
Este projeto apresenta um sistema inteligente de monitoramento de níveis fluviais 
utilizando Inteligência de Borda (Edge AI). O sistema utiliza redes neurais recorrentes 
(LSTM) para prever tendências de enchentes com base na correlação entre o nível do rio e
 a precipitação pluviométrica.

 🛠️ Arquitetura do Sistema
O projeto é dividido em três camadas principais:

Camada de Percepção (Sensores): Simuladores de sensores IoT que enviam dados via protocolo MQTT.

Camada de Inteligência (Backend/Edge): Servidor Flask em Python que processa os dados, gerencia o banco de dados SQLite e executa o modelo de Deep Learning (TensorFlow/Keras).

Camada de Apresentação (Frontend): Dashboard moderno em React com monitoramento em tempo real, alertas de falhas e visualização multivariada.


🚀 Principais Funcionalidades
Previsão com LSTM: Rede Neural que analisa os últimos 15 minutos para prever o nível dos próximos 5 minutos.

Monitoramento Multivariado: Gráficos correlacionando Nível (m) e Chuva (mm).

Resiliência e Tolerância a Falhas:

Heartbeat Monitoring: Alerta visual se um sensor ficar inativo por mais de 15s.

Last Will Message: Detecção automática de queda do servidor central.

Arquitetura Limpa: Componentização no React e separação de responsabilidades no Python.


🧪 Tecnologias Utilizadas
Camada     Tecnologia
IA/Deep Learning-----------Python, TensorFlow, Keras, NumPy
Backend--------------------Flask, Flask-CORS, Paho-MQTT
Frontend-------------------React.js, Recharts, TailwindCSS
Comunicação----------------MQTT (Broker EMQX), WebSockets
Banco de Dados-------------SQLite3

ESTRUTURA DE PASTAS

├── dashboard/          # Frontend React (Interface do Usuário)
│   ├── src/
│   │   ├── App.js      # Lógica principal e MQTT
│   │   ├── Components.js # Componentes visuais (Cards, Gráficos)
│   │   └── App.css     # Estilização Glassmorphism
├── server/             # Backend Python e IA
│   ├── brain_edge.py   # Núcleo da IA (Treino e Predição LSTM)
│   ├── teste_server.py # Servidor Flask e Gateway MQTT
│   ├── simulador.py    # Gerador de dados sintéticos de sensores
│   └── dados_enchentes.db # Banco de dados (Ignorado no Git)
└── .gitignore          # Filtro de arquivos para o repositório

⚙️ Como Executar o Projeto
1. Clone o repositório:
git clone https://github.com/seu-usuario/guardian-ai.git

2. Inicie o Servidor Backend:
cd server
    python teste_server.py
    ```

3.  **Inicie o Simulador de Sensores:**
    
```bash
    cd server
    python simulador_sensor.py
    ```

4.  **Inicie o Dashboard:**
    
```bash
    cd dashboard
    npm install
    npm start
    ```

---

## 🎓 Contexto Acadêmico

Este projeto faz parte de uma intenção de pesquisa de **Mestrado em Engenharia de Computação**, 
com foco em otimização de algoritmos de Machine Learning para hardware embarcado e 
monitoramento de desastres naturais em tempo real.

---

Autor: Augusta Estendar
