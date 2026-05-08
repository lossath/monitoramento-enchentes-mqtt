import paho.mqtt.client as mqtt
import json
import sqlite3
import time
from datetime import datetime

# --- Configurações ---
BROKER = "broker.emqx.io"
TOPICO_PESOS = "v1/enchente/pesos"
TOPICO_GLOBAL = "v1/enchente/global" # O tópico que o React ouve

# Variáveis para Agregação
buffer_pesos = []
LIMIAR = 3 

def salvar_no_banco(sensor, nivel, chuva, status="ONLINE"):
    try:
        conn = sqlite3.connect('dados_enchentes.db')
        cursor = conn.cursor()
        agora = datetime.now().strftime('%d/%m/%Y %H:%M:%S')
        query = "INSERT INTO leituras (data_hora, sensor_name, nivel, chuva, status) VALUES (?, ?, ?, ?, ?)"
        cursor.execute(query, (agora, sensor, nivel, chuva, status))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"❌ Erro no Banco: {e}")

def ao_receber(client, userdata, msg):
    global buffer_pesos
    try:
        data = json.loads(msg.payload.decode())
        s_id = data.get("sensor_id", "Desconhecido")
        peso = float(data.get("peso", 0))
        chuva = float(data.get("chuva", 0))

        if 0.05 < peso < 10.0:
            # 1. Salva leitura individual
            salvar_no_banco(s_id, peso, chuva, "LEITURA_DIRETA")
            print(f"💾 Salvo: {s_id} | {peso}m")

            # 2. Lógica de Agregação para o Gráfico e Card do React
            buffer_pesos.append(peso)
            if len(buffer_pesos) >= LIMIAR:
                media = round(sum(buffer_pesos) / len(buffer_pesos), 4)
                
                # ENVIA PARA O REACT (Isso vai ligar o gráfico e o card agregado)
                payload_global = json.dumps({"peso": media, "status": "ONLINE"})
                client.publish(TOPICO_GLOBAL, payload_global, retain=True)
                
                print(f"🧠 Agregação enviada para o Dashboard: {media}m")
                buffer_pesos.clear()

    except Exception as e:
        print(f"⚠️ Erro no processamento: {e}")

# --- Configuração do Cliente ---
worker = mqtt.Client()
worker.on_message = ao_receber

# LWT: Se o worker cair, o React avisa "Servidor Fora do Ar"
worker.will_set(TOPICO_GLOBAL, json.dumps({"status": "OFFLINE", "peso": 0}), qos=1, retain=True)

print("👷 Worker iniciado: Gerenciando Banco e Agregação...")
worker.connect(BROKER, 1883, 60)
worker.subscribe(TOPICO_PESOS)
worker.loop_forever()