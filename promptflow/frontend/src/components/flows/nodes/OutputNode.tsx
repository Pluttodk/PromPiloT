import { memo } from "react";
import { Handle, Position } from "reactflow";
import type { NodeProps } from "reactflow";
import { ArrowLeft } from "lucide-react";


export interface OutputNodeData {
  name: string;
  label?: string;
}

function OutputNode({ data, selected }: NodeProps<OutputNodeData>) {
  const isConfigured = Boolean(data.name && data.name.trim());
  const badgeColor = isConfigured ? "bg-green-500" : "bg-amber-400";

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-purple-50 min-w-[150px] ${
        selected ? "border-purple-500" : "border-purple-300"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-purple-500 border-2 border-white"
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-medium text-purple-800">Output</span>
        </div>
        <span
          className={`w-2.5 h-2.5 rounded-full ${badgeColor} flex-shrink-0`}
          title={isConfigured ? "Configured" : "Missing output name"}
        />
      </div>
      <div className="mt-2 text-xs text-purple-600">{data.name || "output"}</div>
    </div>
  );
}

export default memo(OutputNode);
