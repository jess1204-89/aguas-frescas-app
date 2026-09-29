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
app.post('/visitas/iniciar', async (req, res) => {
  const { ruta_tienda_id } = req.body;

  const { data, error } = await supabase
    .from('visitas')
    .insert({ ruta_tienda_id, hora_llegada: new Date().toISOString() })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ mensaje: 'Visita iniciada', visita: data });
});

app.post('/visitas/:visitaId/finalizar', async (req, res) => {
  const { visitaId } = req.params;

  const { data, error } = await supabase
    .from('visitas')
    .update({ hora_salida: new Date().toISOString() })
    .eq('id', visitaId)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ mensaje: 'Visita finalizada', visita: data });
});
app.post('/ventas', async (req, res) => {
  const { visita_id, producto_id, cantidad } = req.body;

  const { data: producto, error: errorProducto } = await supabase
    .from('productos')
    .select('precio')
    .eq('id', producto_id)
    .single();

  if (errorProducto || !producto) {
    return res.status(404).json({ error: 'Producto no encontrado' });
  }

  const subtotal = producto.precio * cantidad;

  const { data: venta, error: errorVenta } = await supabase
    .from('ventas')
    .insert({
      visita_id,
      producto_id,
      cantidad,
      precio_unitario: producto.precio,
      subtotal
    })
    .select()
    .single();

  if (errorVenta) {
    return res.status(500).json({ error: errorVenta.message });
  }

  res.json({ mensaje: 'Venta registrada', venta });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});