import { ArrowRight, MessageSquare, ArrowLeft } from "lucide-react";

interface NodePaletteProps {
  onDragStart: (event: React.DragEvent, nodeType: string) => void;
}

export function NodePalette({ onDragStart }: NodePaletteProps) {
  const nodeTypes = [
    {
      type: "input",
      label: "Input",
      description: "Flow input variable",
      icon: ArrowRight,
      color: "green",
    },
    {
      type: "prompt",
      label: "Prompt",
      description: "Execute a prompt",
      icon: MessageSquare,
      color: "blue",
    },
    {
      type: "output",
      label: "Output",
      description: "Flow output result",
      icon: ArrowLeft,
      color: "purple",
    },
  ];

  return (
    <div className="bg-white border rounded-lg p-4 w-64">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Node Types</h3>
      <div className="space-y-2">
        {nodeTypes.map((node) => (
          <div
            key={node.type}
            draggable
            onDragStart={(e) => onDragStart(e, node.type)}
            className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-grab active:cursor-grabbing
              bg-${node.color}-50 border-${node.color}-200 hover:border-${node.color}-400 transition-colors`}
            style={{
              backgroundColor:
                node.color === "green"
                  ? "#f0fdf4"
                  : node.color === "blue"
                  ? "#eff6ff"
                  : "#faf5ff",
              borderColor:
                node.color === "green"
                  ? "#bbf7d0"
                  : node.color === "blue"
                  ? "#bfdbfe"
                  : "#e9d5ff",
            }}
          >
            <node.icon
              className="w-5 h-5"
              style={{
                color:
                  node.color === "green"
                    ? "#16a34a"
                    : node.color === "blue"
                    ? "#2563eb"
                    : "#9333ea",
              }}
            />
            <div>
              <div
                className="text-sm font-medium"
                style={{
                  color:
                    node.color === "green"
                      ? "#166534"
                      : node.color === "blue"
                      ? "#1e40af"
                      : "#6b21a8",
                }}
              >
                {node.label}
              </div>
              <div className="text-xs text-gray-500">{node.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
