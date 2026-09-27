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
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});