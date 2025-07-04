import mysql from 'mysql2';

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

    // Crear tabla si no existe
    const query = `
        CREATE TABLE IF NOT EXISTS equipos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nombre VARCHAR(255) NOT NULL,
            tipo VARCHAR(255) NOT NULL,
            ip VARCHAR(255) NOT NULL,
            piso VARCHAR(255) NOT NULL,
            oficina VARCHAR(255) NOT NULL,
            usuario VARCHAR(255) NOT NULL
        )
    `;
    
    db.query(query, (err, result) => {
        if (err) {
            console.error('Error al crear la tabla:', err);
        } else {
            console.log('Tabla `equipos` verificada y/o creada correctamente');
        }
    });
});

// Exportar la conexión
export default db;
