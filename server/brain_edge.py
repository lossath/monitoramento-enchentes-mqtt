import sqlite3 # Faltava importar aqui!
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
import time

def treinar_e_prever():
    try:
        # 1. Conecta ao banco
        conn = sqlite3.connect('dados_enchentes.db')
        
        # 2. Pega os registros
        query = "SELECT nivel FROM leituras ORDER BY data_hora DESC LIMIT 50"
        df = pd.read_sql_query(query, conn)
        conn.close()

        # Verificação de segurança: precisa de dados para a IA não "chutar"
        if len(df) < 5: 
            return "Dados insuficientes (mínimo 5 registros)"
        
        # ORDEM CORRETA: Primeiro criamos a variável, depois usamos no print
        niveis = df['nivel'].values[::-1]
        
        # DEBUG no terminal do VS Code para você ver os dados mudando
        print(f"-> IA processando {len(niveis)} registros. Último valor: {niveis[-1]}")
        
        # 3. Preparação dos dados para a Regressão
        X = np.array(range(len(niveis))).reshape(-1, 1)
        y = niveis

        # 4. O Cérebro da IA (Edge Computing)
        modelo = LinearRegression()
        modelo.fit(X, y)

        # Previsão para o próximo ponto no tempo
        proximo_passo = np.array([[len(niveis) + 1]])
        previsao = modelo.predict(proximo_passo)[0]

        # Coeficiente angular (Tendência)
        coeficiente = modelo.coef_[0]
        intercepto = modelo.intercept_

        # Retorno formatado para o Flask/React
        return {
            "atual": float(round(niveis[-1], 2)),
            "previsao_5min": float(round(previsao, 2)),
            "tendencia": "SUBINDO" if coeficiente > 0.001 else "ESTÁVEL/DESCENDO",
            "pesos_federados": {
                "w": float(coeficiente), 
                "b": float(intercepto)
            }
        }

    except Exception as e:
        print(f"ERRO CRÍTICO NA IA: {e}")
        return f"Erro na IA: {e}"

if __name__ == "__main__":
    print("Iniciando teste local da IA...")
    while True:
        resultado = treinar_e_prever()
        print(resultado)
        time.sleep(5)