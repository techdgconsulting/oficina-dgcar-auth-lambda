const jwt = require("jsonwebtoken");

function createClientToken(client, cpf) {
  const secret = process.env.CLIENT_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("CLIENT_JWT_SECRET must have at least 32 characters");
  }

  return jwt.sign(
    {
      clienteId: String(client.clienteId),
      tipo: "CLIENTE",
      status: client.status
    },
    secret,
    {
      subject: cpf,
      issuer: process.env.CLIENT_JWT_ISSUER || "oficina-dgcar-auth-lambda",
      audience: process.env.CLIENT_JWT_AUDIENCE || "oficina-dgcar-api",
      expiresIn: process.env.CLIENT_JWT_EXPIRES_IN || "15m",
      algorithm: "HS256"
    }
  );
}

module.exports = {
  createClientToken
};
