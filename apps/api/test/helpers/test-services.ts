import type { AppServices } from "../../src/app-services.js";
import { createSseHub } from "../../src/services/sse.js";

export const createStubServices = (): AppServices => ({
  authService: {
    authenticate: async () => null,
    createSession: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getCurrentUser: async () => {
      throw new Error("Not implemented in test stub.");
    },
    login: async () => {
      throw new Error("Not implemented in test stub.");
    },
    logout: async () => undefined,
    register: async () => {
      throw new Error("Not implemented in test stub.");
    },
  },
  db: {} as AppServices["db"],
  projectService: {
    createProject: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getOwnedProject: async () => {
      throw new Error("Not implemented in test stub.");
    },
    listProjects: async () => {
      throw new Error("Not implemented in test stub.");
    },
  },
  secretService: {
    buildSecretEnvMap: async () => ({}),
    createSecret: async () => {
      throw new Error("Not implemented in test stub.");
    },
    listSecrets: async () => {
      throw new Error("Not implemented in test stub.");
    },
    updateSecret: async () => {
      throw new Error("Not implemented in test stub.");
    },
  },
  secretsCrypto: {
    decrypt(value: string) {
      return value;
    },
    encrypt(value: string) {
      return value;
    },
  },
  sseHub: createSseHub(),
});
