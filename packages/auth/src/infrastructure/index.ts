export * from "./better-auth/create-auth";
// Types for naming createAuth's inferred type and its deps in apps; the hook itself stays internal.
export type { AdmitSignIn, SignInHookContext } from "./better-auth/sign-in-hook";
export type { GoogleProfile } from "./better-auth/google-profile";
