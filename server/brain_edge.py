import sqlite3
import numpy as np
import pandas as pd
import os
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import LSTM, Dense
from sklearn.preprocessing import MinMaxScaler

# Nome do arquivo onde o "cérebro" será guardado
MODELO_FILE = 'modelo_enchente.keras'

def treinar_e_prever():
    try:
        # 1. CONEXÃO COM O BANCO
        conn = sqlite3.connect('dados_enchentes.db')
        df = pd.read_sql_query("SELECT nivel, chuva FROM leituras ORDER BY id DESC LIMIT 100", conn)
        conn.close()

        if len(df) < 20:
            return "Dados insuficientes (mínimo 20)."

        df = df.iloc[::-1] # Ordem cronológica

        # 2. NORMALIZAÇÃO
        scaler = MinMaxScaler(feature_range=(0, 1))
        dados_escamos = scaler.fit_transform(df)

        # 3. PREPARAÇÃO DA JANELA (Windowing)
        window = 10
        X, y = [], []
        for i in range(len(dados_escamos) - window):
            X.append(dados_escamos[i:i+window])
            y.append(dados_escamos[i+window, 0])

        X, y = np.array(X), np.array(y)

        # 4. CARREGAR OU CRIAR MODELO
        if os.path.exists(MODELO_FILE):
            # Se o arquivo existe, carregamos o "cérebro" anterior
            model = load_model(MODELO_FILE)
            # Treinamos apenas um pouquinho com os dados novos (Incremental Learning)
            model.fit(X, y, epochs=5, verbose=0)
        else:
            # Se não existe, criamos um do zero
            model = Sequential([
                LSTM(50, activation='relu', input_shape=(X.shape[1], X.shape[2])),
                Dense(1)
            ])
            model.compile(optimizer='adam', loss='mse')
            model.fit(X, y, epochs=20, verbose=0)

        # 5. SALVAR O PROGRESSO
        model.save(MODELO_FILE)

        # 6. PREDIÇÃO
        ultima_janela = dados_escamos[-window:].reshape(1, window, 2)
        predicao_escamada = model.predict(ultima_janela, verbose=0)
        
        dummy = np.zeros((1, 2))
        dummy[0, 0] = predicao_escamada[0, 0]
        resultado_final = scaler.inverse_transform(dummy)[0, 0]

        # 7. LÓGICA DE TENDÊNCIA (A que ajustamos ontem)
        nivel_atual = float(df['nivel'].iloc[-1])
        chuva_atual = float(df['chuva'].iloc[-1])
        diferenca = resultado_final - nivel_atual

        if diferenca > 0.005 or (nivel_atual > 5.8 and chuva_atual > 10):
            tendencia = "SUBINDO"
        elif diferenca < -0.005:
            tendencia = "DESCENDO"
        else:
            tendencia = "ESTÁVEL"

        return {
            "atual": round(float(nivel_atual), 2),
            "previsao_5min": round(float(resultado_final), 2),
            "tendencia": tendencia,
            "chuva": round(float(chuva_atual), 2)
        }

    except Exception as e:
        return f"Erro na IA: {str(e)}"