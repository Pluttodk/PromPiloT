import { memo } from "react";
import { Handle, Position } from "reactflow";
import type { NodeProps } from "reactflow";
import { ArrowRight } from "lucide-react";

export interface InputNodeData {
  name: string;
  label?: string;
}

function InputNode({ data, selected }: NodeProps<InputNodeData>) {
  const isConfigured = Boolean(data.name && data.name.trim());
  const badgeColor = isConfigured ? "bg-green-500" : "bg-amber-400";

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-green-50 min-w-[150px] ${
        selected ? "border-green-500" : "border-green-300"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowRight className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-green-800">Input</span>
        </div>
        <span
          className={`w-2.5 h-2.5 rounded-full ${badgeColor} flex-shrink-0`}
          title={isConfigured ? "Configured" : "Missing display name"}
        />
      </div>
      <div className="mt-2 text-xs text-green-600">{data.name || "input"}</div>
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-green-500 border-2 border-white"
      />
    </div>
  );
}

export default memo(InputNode);
