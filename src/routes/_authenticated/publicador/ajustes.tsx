import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/publicador/ajustes")({
  beforeLoad: () => {
    throw redirect({ to: "/ajustes" });
  },
});
