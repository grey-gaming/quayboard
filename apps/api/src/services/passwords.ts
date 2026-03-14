import { hash, verify } from "@node-rs/argon2";

export const hashPassword = async (password: string) =>
  hash(password, {
    algorithm: 2,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

export const verifyPassword = async (passwordHash: string, password: string) =>
  verify(passwordHash, password);
