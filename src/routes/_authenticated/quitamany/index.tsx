import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/quitamany/")({
  beforeLoad: () => {
    throw redirect({ to: "/conversas" });
  },
});
