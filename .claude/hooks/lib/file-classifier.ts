export interface FileClassification {
  language: "python" | "typescript" | "terraform" | "markdown" | "json" | "other";
  surface: "api" | "frontend" | "infra" | "docs" | "other";
  domain: string;
  isTest: boolean;
  isRoute: boolean;
  isService: boolean;
  isDatabase: boolean;
  isComponent: boolean;
  isClientComponent: boolean;
  isHook: boolean;
  isPage: boolean;
  isAPI: boolean;
  isMigration: boolean;
  isInfra: boolean;
}

export function classifyFile(filePath: string): FileClassification {
  const result: FileClassification = {
    language: "other",
    surface: "other",
    domain: "unknown",
    isTest: false,
    isRoute: false,
    isService: false,
    isDatabase: false,
    isComponent: false,
    isClientComponent: false,
    isHook: false,
    isPage: false,
    isAPI: false,
    isMigration: false,
    isInfra: false,
  };

  // Language detection
  if (filePath.endsWith(".py")) result.language = "python";
  else if (/\.(ts|tsx|js|jsx)$/.test(filePath)) result.language = "typescript";
  else if (filePath.endsWith(".tf")) result.language = "terraform";
  else if (filePath.endsWith(".md")) result.language = "markdown";
  else if (filePath.endsWith(".json")) result.language = "json";

  // Surface detection
  if (filePath.startsWith("api/") || filePath.includes("/api/"))
    result.surface = "api";
  else if (filePath.startsWith("frontend/") || filePath.includes("/frontend/"))
    result.surface = "frontend";
  else if (filePath.startsWith("infra/") || filePath.includes("/infra/"))
    result.surface = "infra";
  else if (filePath.startsWith("documentation/") || filePath.startsWith("docs/"))
    result.surface = "docs";

  // Domain classification — API
  if (/\/routes?[\/.]/.test(filePath)) {
    result.domain = "routes";
    result.isRoute = true;
  }
  if (/\/services?[\/.]/.test(filePath)) {
    result.domain = "services";
    result.isService = true;
  }
  if (/\/db\/|\/models?[\/.]|\/database\//.test(filePath)) {
    result.domain = "database";
    result.isDatabase = true;
  }
  if (/\/migrations?[\/.]/.test(filePath)) {
    result.domain = "migrations";
    result.isMigration = true;
  }

  // Domain classification — Frontend
  if (/\/components?[\/.]/.test(filePath)) {
    result.domain = "components";
    result.isComponent = true;
  }
  if (/\/hooks?[\/.]/.test(filePath)) {
    result.domain = "hooks";
    result.isHook = true;
  }
  if (/\/pages?[\/.]|\/app\//.test(filePath)) {
    result.domain = "pages";
    result.isPage = true;
  }

  // Flags
  result.isAPI = result.surface === "api";
  result.isInfra = result.surface === "infra";
  result.isTest = /test[_.]|spec\.|__tests__/.test(filePath);

  return result;
}
