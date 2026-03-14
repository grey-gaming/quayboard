import { describe, expect, it } from "vitest";

import { createAuthService } from "../../src/services/auth-service.js";
import { HttpError } from "../../src/services/http-error.js";
import { createSecretService } from "../../src/services/secret-service.js";

const uniqueViolation = { code: "23505" };

describe("database conflict handling", () => {
  it("maps duplicate registration insert races to email_taken", async () => {
    const db = {
      insert() {
        return {
          values() {
            return {
              async returning() {
                throw uniqueViolation;
              },
            };
          },
        };
      },
      query: {
        usersTable: {
          async findFirst() {
            return undefined;
          },
        },
      },
    } as never;

    const authService = createAuthService(db);

    await expect(
      authService.register({
        displayName: "Casey",
        email: "casey@example.com",
        password: "correct-horse-battery",
      }),
    ).rejects.toMatchObject({
      code: "email_taken",
      statusCode: 409,
    } satisfies Partial<HttpError>);
  });

  it("maps duplicate secret insert races to secret_exists", async () => {
    const db = {
      insert() {
        return {
          values() {
            return {
              async returning() {
                throw uniqueViolation;
              },
            };
          },
        };
      },
      query: {
        encryptedSecretsTable: {
          async findMany() {
            return [];
          },
        },
      },
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  limit() {
                    return Promise.resolve([]);
                  },
                };
              },
            };
          },
        };
      },
    } as never;

    const secretService = createSecretService(
      db,
      {
        decrypt(value: string) {
          return value;
        },
        encrypt(value: string) {
          return `encrypted:${value}`;
        },
      },
      {
        async getOwnedProject() {
          return {};
        },
      },
    );

    await expect(
      secretService.createSecret("user-id", "project-id", {
        type: "github_pat",
        value: "ghp_example_secret",
      }),
    ).rejects.toMatchObject({
      code: "secret_exists",
      statusCode: 409,
    } satisfies Partial<HttpError>);
  });
});
