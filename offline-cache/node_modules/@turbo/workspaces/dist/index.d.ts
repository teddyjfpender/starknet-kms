import { PackageManager } from '@turbo/utils';

declare class Logger {
    interactive: boolean;
    dry: boolean;
    step: number;
    constructor({ interactive, dry, }?: {
        interactive?: boolean;
        dry?: boolean;
    });
    logger(...args: Array<unknown>): void;
    indented(level: number, ...args: Array<unknown>): void;
    header(title: string): void;
    installerFrames(): string[];
    gradient(text: string | number): string;
    hero(): void;
    info(...args: Array<unknown>): void;
    mainStep(title: string): void;
    subStep(...args: Array<unknown>): void;
    subStepFailure(...args: Array<unknown>): void;
    rootHeader(): void;
    rootStep(...args: Array<unknown>): void;
    workspaceHeader(): void;
    workspaceStep(...args: Array<unknown>): void;
    blankLine(): void;
    error(...args: Array<unknown>): void;
}

interface RequestedPackageManagerDetails {
    name: PackageManager;
    version?: string;
}
interface AvailablePackageManagerDetails {
    name: PackageManager;
    version: string;
}
interface Project {
    name: string;
    description?: string;
    packageManager: PackageManager;
    paths: {
        root: string;
        packageJson: string;
        lockfile: string;
        nodeModules: string;
        workspaceConfig?: string;
    };
    workspaceData: {
        globs: Array<string>;
        workspaces: Array<Workspace>;
    };
}
interface Workspace {
    name: string;
    description?: string;
    paths: {
        root: string;
        packageJson: string;
        nodeModules: string;
    };
}
interface DetectArgs {
    workspaceRoot: string;
}
interface ReadArgs {
    workspaceRoot: string;
}
interface CreateArgs {
    project: Project;
    to: AvailablePackageManagerDetails;
    logger: Logger;
    options?: Options;
}
interface RemoveArgs {
    project: Project;
    to: AvailablePackageManagerDetails;
    logger: Logger;
    options?: Options;
}
interface CleanArgs {
    project: Project;
    logger: Logger;
    options?: Options;
}
interface ConvertArgs {
    project: Project;
    to: AvailablePackageManagerDetails;
    logger: Logger;
    options?: Options;
}
interface InstallArgs {
    project: Project;
    to: RequestedPackageManagerDetails;
    logger?: Logger;
    options?: Options;
}
interface Options {
    dry?: boolean;
    skipInstall?: boolean;
    interactive?: boolean;
}
interface PackageManagerInstallDetails {
    name: string;
    template: string;
    command: PackageManager;
    installArgs: Array<string>;
    version: string;
    executable: string;
    semver: string;
    default?: boolean;
}
type ManagerDetect = (args: DetectArgs) => Promise<boolean>;
type ManagerRead = (args: ReadArgs) => Promise<Project>;
type ManagerCreate = (args: CreateArgs) => Promise<void>;
type ManagerRemove = (args: RemoveArgs) => Promise<void>;
type ManagerClean = (args: CleanArgs) => Promise<void>;
type ManagerConvert = (args: ConvertArgs) => Promise<void>;
interface ManagerHandler {
    detect: ManagerDetect;
    read: ManagerRead;
    create: ManagerCreate;
    remove: ManagerRemove;
    clean: ManagerClean;
    convertLock: ManagerConvert;
}

declare function getWorkspaceDetails({ root, }: {
    root: string;
}): Promise<Project>;

declare function getPackageManagerMeta(packageManager: RequestedPackageManagerDetails): PackageManagerInstallDetails | undefined;
declare function install(args: InstallArgs): Promise<void>;

type ConvertErrorType = "package_manager-unexpected" | "package_manager-already_in_use" | "package_manager-unable_to_detect" | "package_manager-unsupported_version" | "package_manager-could_not_be_found" | "pnpm-workspace_parse_error" | "bun-workspace_glob_error" | "package_json-parse_error" | "package_json-missing" | "invalid_directory" | "error_removing_node_modules" | "unknown";
interface ConvertErrorOptions {
    type?: ConvertErrorType;
}
declare class ConvertError extends Error {
    type: ConvertErrorType;
    constructor(message: string, opts?: ConvertErrorOptions);
}

declare const MANAGERS: Record<PackageManager, ManagerHandler>;

declare function convert({ root, to, options, }: {
    root: string;
    to: PackageManager;
    options?: Options;
}): Promise<void>;

export { ConvertError, ConvertErrorType, InstallArgs, MANAGERS, Options, Project, Workspace, convert, getPackageManagerMeta, getWorkspaceDetails, install };
