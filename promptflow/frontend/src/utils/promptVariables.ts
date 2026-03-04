/**
 * Extracts variable names from a Jinja2-style template.
 * Matches {{ variable_name }} patterns and returns unique variable names.
 */
export function extractVariables(template: string): string[] {
  const regex = /\{\{\s*(\w+)\s*\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = regex.exec(template)) !== null) {
    const varName = match[1];
    if (!variables.includes(varName)) {
      variables.push(varName);
    }
  }

  return variables;
}

/**
 * Generates a handle ID for a variable in a prompt.
 * @param promptType - 'system' or 'user'
 * @param variableName - The variable name from the template
 */
export function getVariableHandleId(
  promptType: "system" | "user",
  variableName: string
): string {
  return `var_${promptType}_${variableName}`;
}

/**
 * Parses a handle ID to extract the prompt type and variable name.
 * @param handleId - The handle ID (e.g., "var_system_context")
 * @returns Object with promptType and variableName, or null if not a variable handle
 */
export function parseVariableHandleId(
  handleId: string
): { promptType: "system" | "user"; variableName: string } | null {
  const match = handleId.match(/^var_(system|user)_(\w+)$/);
  if (!match) return null;

  return {
    promptType: match[1] as "system" | "user",
    variableName: match[2],
  };
}
