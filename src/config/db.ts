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
            nombre VARCHAR(255) NOT NULL,
            tipo VARCHAR(255) NOT NULL,
            ip VARCHAR(255) NOT NULL,
            piso VARCHAR(255) NOT NULL,
            oficina VARCHAR(255) NOT NULL,
            usuario VARCHAR(255) NOT NULL,
            numeroSerie VARCHAR(255) NOT NULL
        )
    `;
    
    db.query(queryEquipos, (err, result) => {
        if (err) {
            console.error('Error al crear la tabla `equipos`:', err);
        } else {
            console.log('Tabla `equipos` verificada y/o creada correctamente');
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
    
    db.query(queryImpresoras, (err, result) => {
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
    
    db.query(queryDispositivos, (err, result) => {
        if (err) {
            console.error('Error al crear la tabla `dispositivos`:', err);
        } else {
            console.log('Tabla `dispositivos` verificada y/o creada correctamente');
        }
    });
});

// Función para verificar y agregar columnas faltantes
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
        
        // Convertir result a array y extraer nombres de columnas
        const rows = result as RowDataPacket[];
        const columnas = rows.map((row) => row.COLUMN_NAME);
        
        // Verificar y agregar columna 'tipo' si no existe
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

        // Verificar y agregar columna 'numeroSerie' si no existe
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

        // Para dispositivos, verificar columna 'cantidad' (ya existe)
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
