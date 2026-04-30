import paho.mqtt.client as mqtt
import json
import time
import os

# --- Configurações ---
BROKER = "broker.emqx.io"
TOPICO_PESOS = "v1/enchente/pesos"
TOPICO_GLOBAL = "v1/enchente/global"

pesos_recebidos = []
sensores_ativos = set()
limiar_agregacao = 3
ultimas_leituras = {}
TEMPO_LIMITE_SENSOR = 15 # Aumentei um pouco para dar fôlego

def ao_conectar(client, userdata, flags, rc):
    if rc == 0:
        print("✅ CONECTADO AO BROKER COM SUCESSO!")
        client.subscribe(TOPICO_PESOS)
    else:
        print(f"❌ FALHA NA CONEXÃO. Código: {rc}")

def ao_receber_mensagem(client, userdata, msg):
    global pesos_recebidos, sensores_ativos
    try:
        data = json.loads(msg.payload.decode())
        s_id = data.get("sensor_id")
        peso = float(data.get("peso", 0))

        # Registrar presença do sensor
        ultimas_leituras[s_id] = time.time()

        if 0.05 < peso < 10.0:
            pesos_recebidos.append(peso)
            sensores_ativos.add(s_id)
            print(f"📥 {s_id}: {peso} | Buffer: {len(pesos_recebidos)}/3")

            if len(pesos_recebidos) >= limiar_agregacao:
                media = sum(pesos_recebidos) / 3
                payload = json.dumps({"peso": round(media, 4), "status": "ONLINE"})
                client.publish(TOPICO_GLOBAL, payload, retain=True)
                print(f"--- 🧠 AGREGAÇÃO: {media:.4f} ---")
                pesos_recebidos.clear()
                sensores_ativos.clear()
        else:
            if peso != 999: print(f"⚠️ Dado fora da faixa: {peso}")

    except Exception as e:
        print(f"⚠️ Erro: {e}")

# --- SETUP DO CLIENTE ---
cliente = mqtt.Client()
cliente.on_connect = ao_conectar
cliente.on_message = ao_receber_mensagem

# Vontade de morrer (LWT)
cliente.will_set(TOPICO_GLOBAL, json.dumps({"status": "OFFLINE", "peso": 0}), qos=1, retain=True)

print("🔄 Tentando conectar...")
cliente.connect(BROKER, 1883, 60)

# Iniciando o loop
cliente.loop_start()

try:
    while True:
        # Verifica sensores mortos
        agora = time.time()
        for s_id, last_time in list(ultimas_leituras.items()):
            if agora - last_time > TEMPO_LIMITE_SENSOR:
                print(f"⚠️ Sensor {s_id} sumiu!")
                cliente.publish(TOPICO_GLOBAL, json.dumps({"status": "SENSOR_OFFLINE", "sensor_id": s_id}))
                del ultimas_leituras[s_id]
        
        time.sleep(5)
except KeyboardInterrupt:
    print("Finalizando...")
    cliente.loop_stop()