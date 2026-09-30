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
app.post('/visitas/:visitaId/pago', async (req, res) => {
  const { visitaId } = req.params;
  const { monto_recibido } = req.body;

  const { data: ventas, error: errorVentas } = await supabase
    .from('ventas')
    .select('subtotal')
    .eq('visita_id', visitaId);

  if (errorVentas) {
    return res.status(500).json({ error: errorVentas.message });
  }

  const total_venta = ventas.reduce((suma, v) => suma + Number(v.subtotal), 0);

  if (monto_recibido < total_venta) {
    return res.status(400).json({ error: 'El monto recibido es menor al total de la venta' });
  }

  const cambio = monto_recibido - total_venta;

  const { data: pago, error: errorPago } = await supabase
    .from('pagos')
    .insert({ visita_id: visitaId, total_venta, monto_recibido, cambio })
    .select()
    .single();

  if (errorPago) {
    return res.status(500).json({ error: errorPago.message });
  }

  res.json({ mensaje: 'Pago registrado', pago });
});
app.post('/devoluciones', async (req, res) => {
  const { visita_id, producto_id, cantidad, motivo } = req.body;

  const { data: devolucion, error } = await supabase
    .from('devoluciones')
    .insert({ visita_id, producto_id, cantidad, motivo })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ mensaje: 'Devolucion registrada', devolucion });
});
app.get('/rutas/:rutaId/cierre', async (req, res) => {
  const { rutaId } = req.params;

  // 1. Todas las tiendas de esta ruta
  const { data: rutaTiendas, error: errorRT } = await supabase
    .from('ruta_tiendas')
    .select('id, orden, tiendas ( nombre )')
    .eq('ruta_id', rutaId);

  if (errorRT) return res.status(500).json({ error: errorRT.message });

  const rutaTiendaIds = rutaTiendas.map(rt => rt.id);

  // 2. Todas las visitas de esas tiendas
  const { data: visitas, error: errorV } = await supabase
    .from('visitas')
    .select('id, ruta_tienda_id, hora_llegada, hora_salida')
    .in('ruta_tienda_id', rutaTiendaIds);

  if (errorV) return res.status(500).json({ error: errorV.message });

  const visitaIds = visitas.map(v => v.id);

  // 3. Todas las ventas de esas visitas, con el nombre del producto
  const { data: ventas, error: errorVe } = await supabase
    .from('ventas')
    .select('visita_id, cantidad, subtotal, productos ( nombre )')
    .in('visita_id', visitaIds);

  if (errorVe) return res.status(500).json({ error: errorVe.message });

  // 4. Todas las devoluciones de esas visitas
  const { data: devoluciones, error: errorD } = await supabase
    .from('devoluciones')
    .select('visita_id, cantidad, motivo, productos ( nombre )')
    .in('visita_id', visitaIds);

  if (errorD) return res.status(500).json({ error: errorD.message });

  // --- A partir de aquí, ya no hablamos con la base de datos, solo calculamos ---

  const totalVendido = ventas.reduce((suma, v) => suma + Number(v.subtotal), 0);
  const tiendasVisitadas = visitas.filter(v => v.hora_llegada).length;
  const tiendasSinVenta = rutaTiendas.length - new Set(ventas.map(v => v.visita_id)).size;

  // Ventas agrupadas por nombre de producto
  const ventasPorProducto = {};
  ventas.forEach(v => {
    const nombre = v.productos.nombre;
    ventasPorProducto[nombre] = (ventasPorProducto[nombre] || 0) + v.cantidad;
  });

  const productos = Object.entries(ventasPorProducto);
  const productoMasVendido = productos.length
    ? productos.reduce((max, p) => (p[1] > max[1] ? p : max))
    : null;
  const productoMenosVendido = productos.length
    ? productos.reduce((min, p) => (p[1] < min[1] ? p : min))
    : null;

  res.json({
    ruta_id: rutaId,
    total_vendido: totalVendido,
    tiendas_totales: rutaTiendas.length,
    tiendas_visitadas: tiendasVisitadas,
    tiendas_sin_venta: tiendasSinVenta,
    ventas_por_producto: ventasPorProducto,
    producto_mas_vendido: productoMasVendido ? { nombre: productoMasVendido[0], cantidad: productoMasVendido[1] } : null,
    producto_menos_vendido: productoMenosVendido ? { nombre: productoMenosVendido[0], cantidad: productoMenosVendido[1] } : null,
    devoluciones
  });
});
app.post('/rutas/:rutaId/inventario', async (req, res) => {
  const { rutaId } = req.params;
  const { productos } = req.body;

  const filas = productos.map(p => ({
    ruta_id: rutaId,
    producto_id: p.producto_id,
    cantidad_inicial: p.cantidad_inicial
  }));

  const { data, error } = await supabase
    .from('inventario_ruta')
    .insert(filas)
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ mensaje: 'Inventario inicial registrado', inventario: data });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});