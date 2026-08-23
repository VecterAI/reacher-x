interface ConversationDaySeparatorProps {
  label: string;
}

export function ConversationDaySeparator({
  label,
}: ConversationDaySeparatorProps) {
  if (!label) return null;

  return (
    <div className="relative flex items-center py-3" role="separator">
      <div className="border-border flex-1 border-t" />
      <span className="text-muted-foreground bg-background px-3 text-xs font-medium">
        {label}
      </span>
      <div className="border-border flex-1 border-t" />
    </div>
  );
}
