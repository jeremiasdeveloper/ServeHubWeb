ServeHUB Web — Guía de instalación, desarrollo local y GitHub

Esta guía explica cómo preparar ServeHUB Web desde cero en Windows, ejecutarlo en localhost, comprobar que funciona y subir cambios a GitHub.

Stack detectado en el proyecto: Next.js, TypeScript, Tailwind CSS, Prisma, SQLite y Bun.
El proyecto también contiene un servicio realtime basado en Socket.IO/Bun dentro de mini-services/realtime.

1. Requisitos

Necesitas:

Windows 10/11

Git

Node.js (recomendado como respaldo para herramientas que lo requieran)

Bun

Un navegador moderno

El repositorio de ServeHUB Web

Comprobar Git

Abre PowerShell y ejecuta:

git --version

Comprobar Node.js

node --version
npm --version

Comprobar Bun

bun --version

Si Bun no está instalado en Windows, desde PowerShell:

powershell -c "irm bun.sh/install.ps1 | iex"

Después cierra y vuelve a abrir VS Code/PowerShell y comprueba:

bun --version

2. Obtener el proyecto

Si todavía no tienes el repositorio:

git clone https://github.com/jeremiasdeveloper/ServeHubWeb.git

Entra en la carpeta:

cd ServeHubWeb

Si ya tienes el proyecto localmente, abre PowerShell en la carpeta raíz del proyecto.

Por ejemplo:

C:\Users\JeremiasDev\Desktop\ServeHUB Web Version\main

Comprueba la ubicación:

pwd

3. Instalar dependencias

ServeHUB Web contiene bun.lock, por lo que Bun es el gestor de paquetes recomendado.

Ejecuta:

bun install

Esto instala las dependencias definidas en package.json.

Si termina correctamente, no necesitas ejecutar npm install.

4. Variables de entorno

El proyecto incluye:

.env.example

Este archivo sirve como plantilla.

Copia el archivo:

Copy-Item .env.example .env

Ahora abre .env y completa las variables necesarias.

Puedes abrirlo desde VS Code:

code .env

Importante

Nunca subas .env a GitHub.

El archivo .env puede contener:

contraseñas

secretos

claves privadas

tokens

URLs de servicios privados

credenciales de bases de datos

El proyecto ya incluye .gitignore, por lo que .env debería quedar fuera del repositorio.

Sí puedes subir:

.env.example

porque debe contener únicamente valores de ejemplo o nombres de variables sin secretos reales.

5. Revisar los scripts disponibles

Antes de iniciar el proyecto, puedes consultar los scripts definidos en package.json:

Get-Content package.json

Busca la sección:

"scripts": {
  ...
}

El script habitual de desarrollo de Next.js es:

dev

Si existe:

"dev": "next dev"

puedes iniciar la aplicación con:

bun run dev

6. Preparar Prisma y la base de datos

ServeHUB Web utiliza Prisma y contiene:

prisma/
└── schema.prisma

Primero genera el cliente de Prisma:

bunx prisma generate

Si el proyecto utiliza una base de datos local SQLite y la variable DATABASE_URL está configurada correctamente en .env, normalmente puedes sincronizar el esquema con:

bunx prisma db push

Si el proyecto utiliza migraciones en lugar de db push, consulta los scripts de package.json y usa el comando definido por el proyecto.

Para comprobar visualmente la base de datos mediante Prisma Studio:

bunx prisma studio

7. Cargar datos iniciales

El proyecto contiene scripts de seed, incluyendo:

scripts/seed.ts
src/lib/seed.ts

Antes de ejecutar un seed, revisa los scripts de package.json para conocer el comando oficial configurado para este proyecto.

Puedes consultar:

Get-Content package.json

Si existe un script, por ejemplo:

"db:seed": "..."

ejecútalo con:

bun run db:seed

No ejecutes un seed repetidamente en una base de datos real sin comprobar antes si el proceso es idempotente.

8. Iniciar ServeHUB Web en localhost

Desde la raíz del proyecto:

bun run dev

Next.js debería mostrar una dirección local similar a:

http://localhost:3000

Abre en el navegador:

http://localhost:3000

Si el puerto 3000 está ocupado, Next.js puede seleccionar otro puerto, por ejemplo:

http://localhost:3001

Usa siempre la URL que aparezca en la terminal.

9. Detener el servidor

En la terminal donde está ejecutándose Next.js:

Ctrl + C

Esto detiene el servidor de desarrollo.

10. Reiniciar el proyecto después

En una sesión posterior normalmente basta con:

cd "C:\Users\JeremiasDev\Desktop\ServeHUB Web Version\main"
bun install
bun run dev

Si las dependencias y la configuración ya están preparadas, incluso puede bastar con:

bun run dev

11. Servicio Realtime

El proyecto contiene:

mini-services/
└── realtime/
    ├── index.ts
    ├── package.json
    ├── bun.lock
    └── tsconfig.json

Esto indica que existe un servicio realtime independiente.

Primero revisa su package.json:

Get-Content .\mini-services\realtime\package.json

Si necesita instalar dependencias de forma independiente:

cd .\mini-services\realtime
bun install

Luego revisa los scripts disponibles:

Get-Content package.json

y utiliza el script de desarrollo correspondiente.

Para volver a la raíz:

cd ..\..

El frontend de Next.js y el servicio realtime pueden necesitar ejecutarse en terminales separadas. Usa los comandos definidos en los respectivos package.json.

12. Comprobar que la aplicación funciona

Una vez iniciado el frontend, prueba al menos:

Carga inicial / splash

Login

Navegación entre módulos

Dashboard

Empleados

Roles y permisos

Pedidos

Mesas

Notificaciones

Chat

Atención al cliente

Reclamos

Asistencia

Configuración

Cambio de idioma

Cambio de tema

Vista responsive

Funciones realtime si el servicio está habilitado

También revisa la consola del navegador:

F12 → Console

y la terminal donde ejecutaste:

bun run dev

13. Comprobar el proyecto antes de subir cambios

Antes de hacer commit, revisa el estado:

git status

Comprueba que NO aparezcan archivos secretos, especialmente:

.env

Puedes revisar los archivos ignorados con:

git status --ignored

14. Ejecutar comprobaciones de código

Revisa los scripts disponibles:

Get-Content package.json

Si existen scripts como:

"lint": "..."
"build": "..."
"typecheck": "..."
"test": "..."

ejecútalos antes de subir cambios.

Ejemplos:

bun run lint

bun run build

bun run test

Usa únicamente los scripts que realmente existan en package.json.

15. Guardar cambios con Git

Después de comprobar la aplicación:

git status

Añade los cambios:

git add .

Comprueba nuevamente:

git status

Crea el commit:

git commit -m "Describe los cambios realizados"

Ejemplos:

git commit -m "fix: corregir login"

git commit -m "feat: agregar módulo de pedidos"

16. Subir cambios a GitHub

Comprueba la rama:

git branch

Si estás en main:

git push origin main

Para configurar el upstream la primera vez:

git push -u origin main

17. Configurar correctamente el autor de Git

Para que los commits nuevos aparezcan con tu identidad:

git config --global user.name "JeremiasDev"

Configura el email asociado a tu cuenta de GitHub:

git config --global user.email "TU_EMAIL_DE_GITHUB"

Comprueba:

git config --global user.name
git config --global user.email

También puedes configurar la identidad únicamente para este repositorio:

git config user.name "JeremiasDev"
git config user.email "TU_EMAIL_DE_GITHUB"

Importante sobre commits antiguos

Cambiar git config no cambia los autores de commits que ya existen.

Los commits creados anteriormente con otra identidad conservarán su autor, a menos que se reescriba el historial.

18. Flujo normal de trabajo

A partir de ahora, el flujo recomendado es:

Iniciar el proyecto

bun install
bun run dev

Programar

Realiza tus cambios en VS Code.

Comprobar

git status

Luego ejecuta los scripts de lint/build/test que existan en package.json.

Guardar

git add .
git commit -m "Descripción de los cambios"

Subir

git push

19. Solución rápida a problemas comunes

bun no se reconoce

Instala Bun:

powershell -c "irm bun.sh/install.ps1 | iex"

Cierra y vuelve a abrir la terminal.

Comprueba:

bun --version

bun install falla

Primero comprueba:

bun --version

y:

Get-Content package.json

Si el error menciona una dependencia concreta, revisa el mensaje antes de borrar archivos o modificar el lockfile.

bun run dev falla

Comprueba:

Get-Content package.json

y confirma que exista el script:

dev

También comprueba que .env exista y tenga las variables requeridas.

Error de Prisma

Comprueba:

bunx prisma generate

y:

bunx prisma db push

Si el problema está relacionado con DATABASE_URL, revisa .env.

Puerto 3000 ocupado

Puedes comprobar procesos/puertos en PowerShell o simplemente iniciar Next.js y utilizar el puerto alternativo que indique la terminal.

Cambios que no aparecen en Git

Comprueba:

git status

Si un archivo está incluido en .gitignore, Git puede estar ignorándolo intencionalmente.

20. Seguridad antes de publicar

Antes de subir el proyecto a GitHub, verifica especialmente:

.env NO debe estar en Git.

No subir contraseñas.

No subir tokens.

No subir API keys privadas.

No subir certificados privados.

No subir archivos de bases de datos que contengan información sensible.

Revisar scripts antes de ejecutarlos.

Revisar el contenido de README.md.

Revisar que .gitignore cubra los archivos locales.

Puedes comprobar si Git está siguiendo .env:

git ls-files .env

Si no devuelve nada, .env no está siendo rastreado por Git.

21. Estructura principal del proyecto

La estructura actual incluye:

ServeHUB Web
│
├── .zscripts/
├── docs/
├── download/
├── examples/
├── mini-services/
│   └── realtime/
├── prisma/
│   └── schema.prisma
├── public/
├── scripts/
├── src/
│   ├── app/
│   │   └── api/
│   ├── components/
│   ├── hooks/
│   └── lib/
├── tests/
├── .env.example
├── .gitignore
├── bun.lock
├── Caddyfile
├── components.json
├── eslint.config.mjs
├── LICENSE
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── README.md
├── tailwind.config.ts
└── tsconfig.json

22. Comandos esenciales — resumen

Primera instalación

git clone https://github.com/jeremiasdeveloper/ServeHubWeb.git
cd ServeHubWeb
bun install
Copy-Item .env.example .env
bunx prisma generate
bunx prisma db push
bun run dev

Luego abre:

http://localhost:3000

Si el proyecto define scripts específicos para base de datos, seed o realtime, utiliza esos scripts según package.json.

Trabajo diario

bun install
bun run dev

Guardar cambios

git status
git add .
git commit -m "Descripción del cambio"
git push

23. En caso de problemas

Cuando algo falle, no borres node_modules, bun.lock, .git ni la base de datos automáticamente.

Primero copia el error completo de la terminal y revisa:

Qué comando ejecutaste.

Qué archivo menciona el error.

Si el error está relacionado con dependencias.

Si falta alguna variable de .env.

Si Prisma puede conectarse a la base de datos.

Si otro servicio necesita estar ejecutándose.

Esto permite solucionar el problema sin perder configuración o historial.
