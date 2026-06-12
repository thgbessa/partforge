const jwt = require('jsonwebtoken');
const db  = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'partforge-secret-change-in-production';

function gerarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, email: usuario.email, cargo: usuario.cargo, nome: usuario.nome },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function autenticar(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer '))
    return res.status(401).json({ erro: 'Token não fornecido' });

  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.get('SELECT id, nome, cargo, email, ativo FROM usuarios WHERE id = ?', [payload.id]);
    if (!user || !user.ativo) return res.status(401).json({ erro: 'Sessão inválida' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

function isAdmin(req, res, next) {
  if (!['Gerente','Back Office','Assessor'].includes(req.user.cargo))
    return res.status(403).json({ erro: 'Acesso negado' });
  next();
}

module.exports = { gerarToken, autenticar, isAdmin, JWT_SECRET };
