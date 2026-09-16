import type { ComponentProps } from "react";
import type { QualificationPresentation } from "../../lib/qualificationUi";
import {
  EmergencyHeatIcon,
  FireCheckIcon,
  SearchActivityIcon,
} from "@/shared/ui/components/icons";

const icons = {
  match: FireCheckIcon,
  "not-match": EmergencyHeatIcon,
  pending: SearchActivityIcon,
};

export function MatchResultIcon({
  result,
  ...props
}: ComponentProps<typeof FireCheckIcon> & {
  result: QualificationPresentation["icon"];
}) {
  const Icon = icons[result];
  return <Icon {...props} />;
}
