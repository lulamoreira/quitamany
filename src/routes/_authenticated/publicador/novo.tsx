import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/publicador/novo")({
  beforeLoad: () => {
    throw redirect({ to: "/novo" });
  },
});
