require('dotenv').config();
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
const app = require('./app');
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on :${port}`));
