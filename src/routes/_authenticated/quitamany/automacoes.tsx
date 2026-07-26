import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/quitamany/automacoes")({
  beforeLoad: () => {
    throw redirect({ to: "/automacoes" });
  },
});
