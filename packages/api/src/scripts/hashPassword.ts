import { hashPassword } from "../services/password.js";

// Read from stdin so passwords are never passed as process arguments.
let password = "";
for await (const chunk of process.stdin) {
  password += chunk.toString();
  if (password.length > 256)
    throw new Error("A senha deve ter no máximo 256 caracteres.");
}
if (password.length < 12)
  throw new Error("Use uma senha com pelo menos 12 caracteres.");
console.log(await hashPassword(password));
