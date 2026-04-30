#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// --- Configurações ---
const char* ssid = "NOME_DO_SEU_WIFI";
const char* password = "SENHA_DO_WIFI";
const char* mqtt_server = "broker.emqx.io";

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  setup_wifi();
  client.setServer(mqtt_server, 1883);
}

void setup_wifi() {
  delay(10);
  Serial.println("Conectando ao WiFi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("WiFi Conectado!");
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Tentando conexão MQTT...");
    if (client.connect("ESP32_Sensor_Oficial")) {
      Serial.println("Conectado ao Broker!");
    } else {
      delay(5000);
    }
  }
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  // SIMULANDO A LEITURA DA IA DE BORDA
  float peso_calculado = random(10, 50) / 10.0; // Gera algo entre 1.0 e 5.0

  // Criando o JSON (Exatamente como o Dashboard espera!)
  StaticJsonDocument<200> doc;
  doc["sensor_id"] = "ESP32_Borda_01";
  doc["peso"] = peso_calculado;

  char buffer[256];
  serializeJson(doc, buffer);

  // Publicando
  Serial.print("Enviando peso: ");
  Serial.println(buffer);
  client.publish("v1/enchente/pesos", buffer);

  delay(10000); // Espera 10 segundos para o próximo envio
}