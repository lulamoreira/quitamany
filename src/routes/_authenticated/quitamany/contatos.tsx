import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/quitamany/contatos")({
  beforeLoad: () => {
    throw redirect({ to: "/contatos" });
  },
});
