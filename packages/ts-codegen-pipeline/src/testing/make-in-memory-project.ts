import { Project } from 'ts-morph';

/**
 * Build a `Project` ts-morph instance backed by `useInMemoryFileSystem`,
 * pre-populated with the supplied path → content map. No real disk
 * write occurs; the returned Project resolves all paths in memory.
 *
 * Path keys are interpreted relative to the project root (`/`). Use
 * forward slashes; absolute paths (`/abs/file.ts`) are also accepted.
 */
export function makeInMemoryProject(files: Record<string, string>): Project {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      strict: true,
      target: 99 /* ESNext */,
      module: 99 /* ESNext */,
      moduleResolution: 100 /* Bundler */,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
    },
  });
  for (const [path, content] of Object.entries(files)) {
    const abs = path.startsWith('/') ? path : `/${path}`;
    project.createSourceFile(abs, content, { overwrite: true });
  }
  return project;
}
