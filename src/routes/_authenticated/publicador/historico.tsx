import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/publicador/historico")({
  beforeLoad: () => {
    throw redirect({ to: "/historico" });
  },
});
