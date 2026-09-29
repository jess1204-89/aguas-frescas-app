const bcrypt = require('bcrypt');
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const supabase = require('./supabaseClient');
const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ mensaje: 'API de Aguas Frescas funcionando 🎉' });
});
app.get('/tiendas', async (req, res) => {
  const { data, error } = await supabase.from('tiendas').select('*');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const { data: usuario, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !usuario) {
    return res.status(401).json({ error: 'Usuario no encontrado' });
  }

  const passwordValida = await bcrypt.compare(password, usuario.password_hash);

  if (!passwordValida) {
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }

  res.json({
    mensaje: 'Login exitoso',
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol
    }
  });
});
app.get('/rutas/hoy/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;

  const { data: ruta, error: errorRuta } = await supabase
    .from('rutas')
    .select('id, fecha')
    .eq('usuario_id', usuarioId)
    .eq('fecha', new Date().toLocaleDateString('en-CA'))
    .single();

  if (errorRuta || !ruta) {
    return res.status(404).json({ error: 'No tienes ruta asignada hoy' });
  }

  const { data: tiendas, error: errorTiendas } = await supabase
    .from('ruta_tiendas')
    .select('orden, tiendas ( id, nombre, direccion, lat, lng )')
    .eq('ruta_id', ruta.id)
    .order('orden', { ascending: true });

  if (errorTiendas) {
    return res.status(500).json({ error: errorTiendas.message });
  }

  res.json({ ruta_id: ruta.id, fecha: ruta.fecha, tiendas });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});