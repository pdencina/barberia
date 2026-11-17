// Pruebas que necesitan la base de PRUEBAS (rebooking-pruebas) y un .env.local: en la revision automatica de GitHub (CI=true) no hay base
// ni llaves, asi que se saltan en vez de fallar. En la Mac de Nico se ejecutan normal. Se importa como primera linea de cada una.
if (process.env.CI) {
  console.log("(se salta en la revision automatica: necesita la base de pruebas)");
  process.exit(0);
}
