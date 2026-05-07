Enchente Guardian: Edge AI & Federated Learning Prototype

Este repositório contém o protótipo de um sistema de monitoramento
hidrométrico inteligente desenvolvido para fins de pesquisa em Computer
Engineering. O foco do projeto é a utilização de Edge AI (Inteligência de Borda)
para predição de desastres naturais em tempo real.

🚀 Evolução Técnica (Update 2026-05-07)

Nesta fase, o projeto evoluiu de uma arquitetura de monitoramento passivo para um sistema preditivo:
Inferência Local (Edge AI): Implementação de um modelo de Regressão Linear no servidor de borda (Flask)
utilizando scikit-learn. O sistema agora calcula a tendência de subida/descida do nível da água sem depender da nuvem.

Preparação para Federated Learning: O sistema já isola os pesos sinápticos ($w$ e $b$) do modelo local, permitindo futuras
agregações globais via protocolo FedAvg.

Visualização Preditiva: O Dashboard em React foi atualizado para exibir não apenas o nível atual, mas a previsão para os
próximos 5 minutos e o comportamento da IA.

🛠️ Tecnologias Adicionadas

IA: Python + Scikit-Learn (Regressão Linear)

Backend: Flask (Endpoints de Inferência)

Data Science: Pandas & Numpy para manipulação de séries temporais

Frontend: React + Tailwind CSS (Interface de decisão em tempo real)
