🧠 AI Text Summarizer – Full Stack Web App

Aplicación web que genera resúmenes automáticos de texto en español, combinando análisis de oraciones, ranking de relevancia y compresión de contenido.
Desarrollada con React (frontend) y Node.js + Express (backend), desplegada con Netlify Functions para una arquitectura ligera y escalable.

🚀 Características principales

🔹 Interfaz moderna y responsiva con modo claro/oscuro.

🔹 Resúmenes automáticos usando estrategias de ranking y frecuencia.

🔹 Control de longitud por número de oraciones o ratio de compresión.

🔹 Historial persistente en LocalStorage (exportable como JSON).

🔹 Copiar y descargar el resumen como .txt.

🔹 Búsqueda y reutilización de resúmenes anteriores.

🔹 Despliegue serverless (frontend + backend integrados en Netlify).

🧩 Tecnologías utilizadas
Frontend

⚛️ React

💨 Tailwind CSS

⚙️ Vite

📦 LocalStorage API

🌙 Modo oscuro automático

Backend

🟢 Node.js + Express

🔄 CORS y JSON payloads

🧠 node-summarizer

🧾 Algoritmos de rank y frecuencia

🧩 Funciones serverless (Netlify Functions)

🧠 Arquitectura general
Frontend (React) → /.netlify/functions/summarize → Backend (Express + SummarizerManager)

El frontend envía texto y número de oraciones deseadas (sentences) mediante un POST.

El backend procesa el texto con SummarizerManager (rank y frecuencia).

Se aplican validaciones, limpieza de texto y límites de compresión.

Devuelve el resumen junto a metadatos (ratio, oraciones usadas, caracteres, etc.).

⚙️ Instalación y uso
1️⃣ Clonar el repositorio
git clone https://github.com/tuusuario/ai-text-summarizer.git
cd ai-text-summarizer

2️⃣ Instalar dependencias
Backend
cd backend
npm install

Frontend
cd frontend
npm install

3️⃣ Ejecutar localmente
Backend
npm run start
# Servidor en http://localhost:4000

Frontend
npm run dev
# App en http://localhost:5173

4️⃣ Build de producción (Netlify)
npm run build

📁 Estructura del proyecto
ai-text-summarizer/
│
├── backend/
│   ├── index.js           # Servidor Express + API /summarize
│   └── package.json
│
├── frontend/
│   ├── src/App.jsx        # UI principal y lógica de resumen
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
└── README.md
