import { createFileRoute } from "@tanstack/react-router";
import { ProjectsView } from "@/components/projects/ProjectsView";

export const Route = createFileRoute("/manager/projects")({
  component: () => <ProjectsView role="manager" />,
});

