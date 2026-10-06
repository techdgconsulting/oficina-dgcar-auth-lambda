const bcrypt = require("bcryptjs");

async function verifyPassword(plainPassword, passwordHash) {
  if (!plainPassword || !passwordHash) {
    return false;
  }

  return bcrypt.compare(plainPassword, passwordHash);
}

module.exports = {
  verifyPassword
};
