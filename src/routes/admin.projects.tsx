import { createFileRoute } from "@tanstack/react-router";
import { ProjectsView } from "@/components/projects/ProjectsView";

export const Route = createFileRoute("/admin/projects")({
  component: () => <ProjectsView role="admin" />,
});
