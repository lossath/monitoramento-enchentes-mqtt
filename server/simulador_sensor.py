import paho.mqtt.client as mqtt
import json
import time
import random

# --- Configurações ---
BROKER = "broker.emqx.io"
TOPICO = "v1/enchente/pesos"
SENSOR_ID = "ESP32_SIMULADO"

client = mqtt.Client()
client.connect(BROKER, 1883, 60)

print("⛈️ Simulador de Ciclo de Inundação iniciado.")
print("Sequência: Normal -> Tempestade -> Estiagem (Baixando) -> Normal")

peso_atual = 1.5  # Começa no nível estável
estado = "NORMAL" # Estados: NORMAL, SUBINDO, TOPO, BAIXANDO
contador_estado = 0

try:
    while True:
        contador_estado += 1
        
        # --- LÓGICA DE TRANSIÇÃO DE ESTADOS ---
        if estado == "NORMAL" and contador_estado > 10:
            estado = "SUBINDO"
            contador_estado = 0
            print("\n⛈️ A chuva começou! O nível vai subir...")

        elif estado == "SUBINDO" and peso_atual >= 5.0:
            estado = "TOPO"
            contador_estado = 0
            print("\n🚨 Nível crítico atingido! Estabilizando no topo...")

        elif estado == "TOPO" and contador_estado > 15:
            estado = "BAIXANDO"
            contador_estado = 0
            print("\n🌤️ A chuva parou. O nível está baixando...")

        elif estado == "BAIXANDO" and peso_atual <= 1.5:
            estado = "NORMAL"
            contador_estado = 0
            print("\n✅ Rio voltou ao leito normal.")

        # --- CÁLCULO DO PESO BASEADO NO ESTADO ---
        variacao_ruido = random.uniform(-0.05, 0.05)
        
        if estado == "NORMAL":
            peso_atual = 1.5 + variacao_ruido
        elif estado == "SUBINDO":
            peso_atual += 0.15  # Sobe rápido
        elif estado == "TOPO":
            peso_atual = 5.0 + random.uniform(-0.1, 0.1) # Oscila no topo
        elif estado == "BAIXANDO":
            peso_atual -= 0.10  # Desce um pouco mais devagar que sobe

        # Chance de erro 999.0 (Filtro do Servidor)
        peso_envio = 999.0 if random.randint(1, 20) == 1 else round(peso_atual, 4)

        payload = json.dumps({
            "sensor_id": SENSOR_ID,
            "peso": peso_envio
        })
        
        client.publish(TOPICO, payload)
        
        status_msg = f"[{estado}] Nível: {peso_envio}"
        if peso_envio == 999.0: status_msg += " ⚠️ (ANOMALIA INJETADA)"
        print(status_msg)
        
        time.sleep(1)

except KeyboardInterrupt:
    print("\nSimulação encerrada.")