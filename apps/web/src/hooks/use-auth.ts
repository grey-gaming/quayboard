import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  AuthUserResponse,
  LoginRequest,
  RegisterRequest,
} from "@quayboard/shared";

import { ApiError, apiRequest } from "../lib/api.js";

const currentUserQueryKey = ["auth", "me"];
const optionalCurrentUserQueryKey = ["auth", "me", "optional"];

export const useCurrentUserQuery = () =>
  useQuery({
    queryKey: currentUserQueryKey,
    queryFn: () => apiRequest<AuthUserResponse>("/auth/me"),
    retry: false,
  });

export const useOptionalCurrentUserQuery = () =>
  useQuery({
    queryKey: optionalCurrentUserQueryKey,
    queryFn: async () => {
      try {
        return await apiRequest<AuthUserResponse>("/auth/me");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return null;
        }

        throw error;
      }
    },
    retry: false,
  });

export const useLoginMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LoginRequest) =>
      apiRequest<AuthUserResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(currentUserQueryKey, result);
    },
  });
};

export const useRegisterMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RegisterRequest) =>
      apiRequest<AuthUserResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(currentUserQueryKey, result);
    },
  });
};

export const useLogoutMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiRequest<void>("/auth/logout", {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: currentUserQueryKey });
      queryClient.removeQueries({ queryKey: optionalCurrentUserQueryKey });
    },
  });
};
