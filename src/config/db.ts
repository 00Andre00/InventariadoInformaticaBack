import mysql, { RowDataPacket } from 'mysql2';

// Crea la conexión con la base de datos
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',  // Cambia por tu usuario de MySQL
    password: '',  // Cambia por tu contraseña de MySQL
    database: 'inventariadobackend'  // Nombre de tu base de datos
});

// Conectar a la base de datos
db.connect((err) => {
    if (err) {
        console.error('Error de conexión a la base de datos:', err);
        return;
    }
    console.log('Conectado a la base de datos MySQL');

    // Crear tabla de equipos si no existe
    const queryEquipos = `
        CREATE TABLE IF NOT EXISTS equipos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tipo VARCHAR(50) NOT NULL,
            marca VARCHAR(100) NOT NULL,
            modelo VARCHAR(100) NOT NULL,
            procesador VARCHAR(255) NOT NULL,
            grafica VARCHAR(255),
            ram VARCHAR(100) NOT NULL,
            almacenamiento VARCHAR(100) NOT NULL,
            placaMadre VARCHAR(255),
            oficina VARCHAR(100) NOT NULL,
            vlan VARCHAR(50),
            ip VARCHAR(50) NOT NULL UNIQUE,
            mac VARCHAR(50) NOT NULL UNIQUE,
            numeroSerie VARCHAR(100),
            usuario VARCHAR(100)
        )
    `;
    
    db.query(queryEquipos, (err) => {
        if (err) {
            console.error('Error al crear la tabla `equipos`:', err);
        } else {
            console.log('Tabla `equipos` verificada y/o creada correctamente');
            // Verificar y agregar columna mac si no existe (para migraciones)
            verificarYAgregarColumnas('equipos');
        }
    });

    // Crear tabla de impresoras si no existe
    const queryImpresoras = `
        CREATE TABLE IF NOT EXISTS impresoras (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nombre VARCHAR(255) NOT NULL,
            tipo VARCHAR(255) NOT NULL,
            ip VARCHAR(255) NOT NULL,
            piso VARCHAR(255) NOT NULL,
            oficina VARCHAR(255) NOT NULL,
            recurso VARCHAR(255) NOT NULL,
            modeloRecurso VARCHAR(255) NOT NULL,
            numeroSerie VARCHAR(255) NOT NULL
        )
    `;
    
    db.query(queryImpresoras, (err) => {
        if (err) {
            console.error('Error al crear la tabla `impresoras`:', err);
        } else {
            console.log('Tabla `impresoras` verificada y/o creada correctamente');
        }
    });

    // Crear tabla de dispositivos si no existe
    const queryDispositivos = `
        CREATE TABLE IF NOT EXISTS dispositivos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nombre VARCHAR(255) NOT NULL,
            tipo VARCHAR(255) NOT NULL,
            piso VARCHAR(255) NOT NULL,
            oficina VARCHAR(255) NOT NULL,
            cantidad INT DEFAULT 0,
            numeroSerie VARCHAR(255) NOT NULL
        )
    `;
    
    db.query(queryDispositivos, (err) => {
        if (err) {
            console.error('Error al crear la tabla `dispositivos`:', err);
        } else {
            console.log('Tabla `dispositivos` verificada y/o creada correctamente');
        }
    });
});

// Función para verificar y agregar columnas faltantes (opcional si migras desde una base antigua)
function verificarYAgregarColumnas(nombreTabla: string): void {
    const checkColumns = `
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = '${nombreTabla}' AND TABLE_SCHEMA = 'inventariadobackend';
    `;
    
    db.query(checkColumns, (err, result) => {
        if (err) {
            console.error(`Error al verificar las columnas de ${nombreTabla}:`, err);
            return;
        }

        const rows = result as RowDataPacket[];
        const columnas = rows.map((row) => row.COLUMN_NAME);

        if (nombreTabla === 'equipos' && !columnas.includes('mac')) {
            const addMacColumn = `
                ALTER TABLE equipos 
                ADD COLUMN mac VARCHAR(50) NOT NULL DEFAULT '',
                ADD UNIQUE (mac);
            `;
            db.query(addMacColumn, (err) => {
                if (err) {
                    console.error('Error al agregar columna \'mac\' en equipos:', err);
                } else {
                    console.log('Columna \'mac\' agregada a equipos');
                }
            });
        }

        if (!columnas.includes('tipo')) {
            const addTipoColumn = `
                ALTER TABLE ${nombreTabla} 
                ADD COLUMN tipo VARCHAR(255) NOT NULL DEFAULT '';
            `;
            db.query(addTipoColumn, (err) => {
                if (err) {
                    console.error(`Error al agregar columna 'tipo' en ${nombreTabla}:`, err);
                } else {
                    console.log(`Columna 'tipo' agregada a ${nombreTabla}`);
                }
            });
        }

        if (!columnas.includes('numeroSerie')) {
            const addNumeroSerieColumn = `
                ALTER TABLE ${nombreTabla} 
                ADD COLUMN numeroSerie VARCHAR(255) NOT NULL DEFAULT '';
            `;
            db.query(addNumeroSerieColumn, (err) => {
                if (err) {
                    console.error(`Error al agregar columna 'numeroSerie' en ${nombreTabla}:`, err);
                } else {
                    console.log(`Columna 'numeroSerie' agregada a ${nombreTabla}`);
                }
            });
        }

        if (nombreTabla === 'dispositivos' && !columnas.includes('cantidad')) {
            const addCantidadColumn = `
                ALTER TABLE dispositivos 
                ADD COLUMN cantidad INT DEFAULT 0;
            `;
            db.query(addCantidadColumn, (err) => {
                if (err) {
                    console.error('Error al agregar columna \'cantidad\' en dispositivos:', err);
                } else {
                    console.log('Columna \'cantidad\' agregada a dispositivos');
                }
            });
        }
    });
}

// Exportar la conexión
export default db;