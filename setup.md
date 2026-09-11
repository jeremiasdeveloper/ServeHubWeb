# ServeHUB — Configuración del entorno local

Guía para configurar ServeHUB desde cero en una PC nueva y ejecutar la aplicación en localhost.

---

## 1. Requisitos

Instalar:

- Git
- Bun

Node.js no es necesario para el flujo principal del proyecto, ya que se utiliza Bun.

### Verificar Git

Abrir PowerShell y ejecutar:

```powershell

git --version
Verificar Bun
bun --version

Si Bun no está instalado, ejecutar en PowerShell:

powershell -c "irm bun.sh/install.ps1 | iex"

Cerrar y volver a abrir PowerShell o VS Code después de la instalación.

Comprobar nuevamente:

bun --version
2. Obtener el proyecto

Clonar el repositorio:

git clone https://github.com/jeremiasdeveloper/ServeHubWeb.git

Entrar en la carpeta:

cd ServeHubWeb

Si el proyecto ya fue descargado/copiadо a la PC, simplemente abrir una terminal en la carpeta raíz del proyecto.

Comprobar la ubicación:

pwd

La carpeta raíz debe contener archivos como:

package.json
bun.lock
prisma/
src/
public/
.env.example
3. Instalar dependencias

Desde la raíz del proyecto ejecutar:

bun install

Esperar a que Bun termine de instalar todas las dependencias.

4. Configurar las variables de entorno

El proyecto utiliza un archivo .env.example como plantilla.

Crear el archivo .env:

Copy-Item .env.example .env

La configuración local actual utiliza SQLite:

DATABASE_URL=file:./db/custom.db
Importante

No modificar .env.example con credenciales reales.

No subir .env a GitHub.

El archivo .env es local y está destinado a contener la configuración privada de cada entorno.

5. Preparar Prisma

Generar el cliente de Prisma:

bunx prisma generate
6. Crear la base de datos local

Crear/sincronizar la base de datos SQLite:

bunx prisma db push

El comando debería indicar algo similar a:

SQLite database custom.db created
Your database is now in sync with your Prisma schema.

La base de datos será local y utilizará:

file:./db/custom.db
7. Cargar los datos de demostración

El proyecto incluye un script de seed para crear los roles, usuarios, mesas y pedidos iniciales.

Ejecutar:

bun run scripts/seed.ts

El script crea los usuarios de demostración.

Credenciales de demostración

Todos utilizan la contraseña:

0000

Usuarios disponibles:

admin      / 0000
manager01  / 0000
waiter01   / 0000
waiter02   / 0000
kitchen01  / 0000
cashier01  / 0000
8. Iniciar ServeHUB

Ejecutar:

bunx next dev -p 3000

En Windows se utiliza este comando directamente porque el script dev del proyecto utiliza tee, un comando que puede no estar disponible en PowerShell.

Cuando Next.js esté listo, aparecerá una dirección similar a:

http://localhost:3000

Abrir en el navegador:

http://localhost:3000
9. Iniciar sesión

Utilizar cualquiera de las cuentas de demostración.

Ejemplo:

Usuario: admin
Contraseña: 0000

Si la base de datos fue creada y el seed fue ejecutado correctamente, el login debería funcionar.

10. Orden completo de instalación

En una PC nueva, el flujo completo es:

git clone https://github.com/jeremiasdeveloper/ServeHubWeb.git
cd ServeHubWeb
bun install
Copy-Item .env.example .env
bunx prisma generate
bunx prisma db push
bun run scripts/seed.ts
bunx next dev -p 3000

Después abrir:

http://localhost:3000
11. Si ya existe la base de datos

Si prisma db push indica que la base de datos ya existe y está sincronizada, no es necesario recrearla.

Si los usuarios de demostración ya existen, tampoco es necesario ejecutar el seed nuevamente.

12. Solución de problemas
Bun no se reconoce

Si aparece:

bun : The term 'bun' is not recognized...

Instalar Bun:

powershell -c "irm bun.sh/install.ps1 | iex"

Cerrar y abrir nuevamente la terminal.

Comprobar:

bun --version
Error al ejecutar bun run dev

En Windows, ejecutar directamente:

bunx next dev -p 3000
Error 401 Unauthorized al iniciar sesión

Comprobar que la base de datos fue creada:

bunx prisma db push

Después ejecutar el seed:

bun run scripts/seed.ts

Volver a probar:

admin / 0000
Error relacionado con Prisma

Ejecutar:

bunx prisma generate

y después:

bunx prisma db push
13. Detener el servidor

Para detener Next.js:

Ctrl + C
14. Inicio posterior

Una vez configurado el entorno, para iniciar ServeHUB en futuras sesiones normalmente basta con:

cd ServeHubWeb
bunx next dev -p 3000

Abrir:

http://localhost:3000

No es necesario ejecutar nuevamente prisma db push ni el seed cada vez que se inicia el servidor.
