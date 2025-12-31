import { Workspace } from "../workspace/Workspace.js";
import { ServerDocumentManager } from "./DocumentManager.js";

/**
 * A root is an OpenAPI spec, holding transitively referenced component documents.
 */
export class Root {
  constructor(public rootUri: string) {}

  /**
   *
   */
  static async discoverRoots(
    _workspace: Workspace,
    _documentManager: ServerDocumentManager
  ): Promise<Root[]> {
    // TODO
    return [];
  }
}
