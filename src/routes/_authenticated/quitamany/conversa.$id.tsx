import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/quitamany/conversa/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/conversa/$id", params });
  },
});
