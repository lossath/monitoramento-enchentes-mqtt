import paho.mqtt.client as mqtt
import json
import time
import random

BROKER = "broker.emqx.io"
TOPICO_PESOS = "v1/enchente/pesos"

cliente = mqtt.Client()
cliente.connect(BROKER, 1883, 60)

nivel_atual = 1.2
chuva = 0.0
passo = 0

print("🌊 Iniciando Ciclo: SECA -> TEMPESTADE -> VAZANTE")

try:
    while True:
        passo += 1
        
        # --- FASE 1: A Tempestade vai armando (0 a 20) ---
        if passo <= 20:
            status = "⛈️ TEMPESTADE AUMENTANDO"
            chuva += random.uniform(2, 5)
            nivel_atual += random.uniform(0.05, 0.15)
            
        # --- FASE 2: Pico da inundação (21 a 30) ---
        elif 20 < passo <= 35:
            status = "🚨 PICO DO TRANSBORDO"
            chuva = max(0, chuva - random.uniform(1, 3)) # Chuva começa a diminuir
            nivel_atual += random.uniform(0.02, 0.08) # Rio ainda sobe pela inércia
            
        # --- FASE 3: Rio baixando (Após 35) ---
        else:
            status = "📉 VAZANTE (RIO BAIXANDO)"
            chuva = max(0, chuva - 5) # Chuva para rápido
            nivel_atual -= random.uniform(0.1, 0.2) # Rio começa a escoar

        # Limites físicos
        nivel_final = round(max(0.5, min(nivel_atual, 6.0)), 4)
        chuva_final = round(max(0, chuva), 2)

        payload = {
            "sensor_id": "ESP32_MESTRADO",
            "peso": nivel_final,
            "chuva": chuva_final
        }

        cliente.publish(TOPICO_PESOS, json.dumps(payload))
        print(f"Passo {passo} | [{status}] | Nível: {nivel_final}m | Chuva: {chuva_final}mm")
        
        # Envia a cada 2 segundos para o gráfico se formar rápido no Dashboard
        time.sleep(2)

except KeyboardInterrupt:
    print("\n🛑 Simulação encerrada.")