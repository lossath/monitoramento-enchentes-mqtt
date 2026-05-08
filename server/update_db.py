import sqlite3

def atualizar_tabela():
    conn = sqlite3.connect('dados_enchentes.db')
    cursor = conn.cursor()
    try:
        # Adiciona a coluna chuva (unidade: mm)
        cursor.execute("ALTER TABLE leituras ADD COLUMN chuva REAL DEFAULT 0")
        conn.commit()
        print("✅ Coluna 'chuva' adicionada com sucesso!")
    except sqlite3.OperationalError:
        print("ℹ️ A coluna 'chuva' já existe no banco.")
    finally:
        conn.close()

if __name__ == "__main__":
    atualizar_tabela()