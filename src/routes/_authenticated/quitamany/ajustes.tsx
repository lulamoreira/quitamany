import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/quitamany/ajustes")({
  beforeLoad: () => {
    throw redirect({ to: "/ajustes" });
  },
});
