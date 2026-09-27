const bcrypt = require('bcrypt');

const passwordPlano = 'vendedor123';

bcrypt.hash(passwordPlano, 10, (err, hash) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log('Contraseña hasheada:', hash);
});