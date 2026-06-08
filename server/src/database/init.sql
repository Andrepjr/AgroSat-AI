-- ============================================================
-- AgroSat AI - Script de inicialização do banco Oracle
-- Execute como DBA ou com privilégios de criação de tabelas
-- ============================================================

-- Sequências
CREATE SEQUENCE seq_usuarios START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_leituras START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_diagnosticos START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_alertas START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_conversas START WITH 1 INCREMENT BY 1 NOCACHE;

-- Tabela de usuários
CREATE TABLE usuarios (
  id           NUMBER DEFAULT seq_usuarios.NEXTVAL PRIMARY KEY,
  nome         VARCHAR2(150)  NOT NULL,
  email        VARCHAR2(200)  NOT NULL UNIQUE,
  senha_hash   VARCHAR2(255)  NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de leituras dos sensores IoT
CREATE TABLE leituras_sensores (
  id               NUMBER DEFAULT seq_leituras.NEXTVAL PRIMARY KEY,
  temperatura      NUMBER(5,2),
  umidade_solo     NUMBER(5,2),
  umidade_ar       NUMBER(5,2),
  ndvi             NUMBER(5,4),
  precipitacao     NUMBER(6,2),
  setor            VARCHAR2(50) DEFAULT 'A1',
  timestamp_leitura TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de diagnósticos gerados pelo Agente Analista
CREATE TABLE diagnosticos (
  id                  NUMBER DEFAULT seq_diagnosticos.NEXTVAL PRIMARY KEY,
  usuario_id          NUMBER REFERENCES usuarios(id),
  status_geral        VARCHAR2(20) CHECK (status_geral IN ('NORMAL','ALERTA','CRITICO')),
  analise_solo        CLOB,
  analise_clima       CLOB,
  analise_vegetacao   CLOB,
  recomendacoes       CLOB,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de alertas gerados pelo Agente Monitor
CREATE TABLE alertas (
  id          NUMBER DEFAULT seq_alertas.NEXTVAL PRIMARY KEY,
  severidade  VARCHAR2(20) CHECK (severidade IN ('ALERTA','CRITICO')),
  titulo      VARCHAR2(300) NOT NULL,
  descricao   CLOB,
  setor       VARCHAR2(50),
  lido        NUMBER(1) DEFAULT 0 CHECK (lido IN (0,1)),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de histórico do chat com o Agente Consultor
CREATE TABLE conversas (
  id          NUMBER DEFAULT seq_conversas.NEXTVAL PRIMARY KEY,
  usuario_id  NUMBER REFERENCES usuarios(id),
  role        VARCHAR2(20) CHECK (role IN ('user','assistant')),
  content     CLOB NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX idx_leituras_timestamp ON leituras_sensores(timestamp_leitura DESC);
CREATE INDEX idx_leituras_setor ON leituras_sensores(setor);
CREATE INDEX idx_diagnosticos_usuario ON diagnosticos(usuario_id, created_at DESC);
CREATE INDEX idx_alertas_lido ON alertas(lido, created_at DESC);
CREATE INDEX idx_conversas_usuario ON conversas(usuario_id, created_at ASC);

COMMIT;
