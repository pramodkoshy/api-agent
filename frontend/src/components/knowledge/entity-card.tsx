"use client";

interface EntityCardProps {
  entity: {
    name: string;
    type: string;
    relation?: string;
  };
}

const TYPE_COLORS: Record<string, string> = {
  Person: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  Organization: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  Location: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  Event: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  Product: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Technology: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

export function EntityCard({ entity }: EntityCardProps) {
  const colorClass = TYPE_COLORS[entity.type] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1">
      <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${colorClass}`}>
        {entity.type}
      </span>
      <span className="text-xs font-medium">{entity.name}</span>
      {entity.relation && (
        <span className="text-[10px] text-muted-foreground">{entity.relation}</span>
      )}
    </div>
  );
}
