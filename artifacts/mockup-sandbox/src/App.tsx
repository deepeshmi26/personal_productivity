import { useEffect, useState, type ComponentType } from "react";

import { modules as discoveredModules } from "./.generated/mockup-components";

type ModuleMap = Record<string, () => Promise<Record<string, unknown>>>;

function _resolveComponent(
  mod: Record<string, unknown>,
  name: string,
): ComponentType | undefined {
  const fns = Object.values(mod).filter(
    (v) => typeof v === "function",
  ) as ComponentType[];
  return (
    (mod.default as ComponentType) ||
    (mod.Preview as ComponentType) ||
    (mod[name] as ComponentType) ||
    fns[fns.length - 1]
  );
}

function PreviewRenderer({
  componentPath,
  modules,
}: {
  componentPath: string;
  modules: ModuleMap;
}) {
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setComponent(null);
    setError(null);

    async function loadComponent(): Promise<void> {
      const key = `./components/mockups/${componentPath}.tsx`;
      const loader = modules[key];
      if (!loader) {
        setError(`No component found at ${componentPath}.tsx`);
        return;
      }

      try {
        const mod = await loader();
        if (cancelled) {
          return;
        }
        const name = componentPath.split("/").pop()!;
        const comp = _resolveComponent(mod, name);
        if (!comp) {
          setError(
            `No exported React component found in ${componentPath}.tsx\n\nMake sure the file has at least one exported function component.`,
          );
          return;
        }
        setComponent(() => comp);
      } catch (e) {
        if (cancelled) {
          return;
        }

        const message = e instanceof Error ? e.message : String(e);
        setError(`Failed to load preview.\n${message}`);
      }
    }

    void loadComponent();

    return () => {
      cancelled = true;
    };
  }, [componentPath, modules]);

  if (error) {
    return (
      <pre style={{ color: "red", padding: "2rem", fontFamily: "system-ui" }}>
        {error}
      </pre>
    );
  }

  if (!Component) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray-400">
        Loading preview…
      </div>
    );
  }

  return <Component />;
}

function getBasePath(): string {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

function getPreviewUrl(componentPath: string): string {
  return `${getBasePath()}/preview/${componentPath}`;
}

function getMockupPaths(modules: ModuleMap): string[] {
  return Object.keys(modules)
    .map((key) =>
      key.replace(/^\.\/components\/mockups\//, "").replace(/\.tsx$/, ""),
    )
    .sort();
}

function formatSectionTitle(componentPath: string): string {
  const parts = componentPath.split("/");
  const name = parts.pop()!;
  const readable = name.replace(/([a-z])([A-Z])/g, "$1 $2");
  if (parts.length === 0) {
    return readable;
  }
  const group =
    parts[0]!.charAt(0).toUpperCase() + parts[0]!.slice(1).toLowerCase();
  return `${group} · ${readable}`;
}

function sectionId(componentPath: string): string {
  return componentPath.replace(/\//g, "-").toLowerCase();
}

function getGallerySections(
  allPaths: string[],
): Array<{ group: string; paths: string[] }> {
  const byGroup = new Map<string, string[]>();

  for (const componentPath of allPaths) {
    const group = componentPath.includes("/")
      ? componentPath.split("/")[0]!
      : "other";
    const paths = byGroup.get(group) ?? [];
    paths.push(componentPath);
    byGroup.set(group, paths);
  }

  return [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, paths]) => {
      const sorted = [...paths].sort();
      const overview = sorted.find(
        (p) => p.endsWith("/Overview") || p === "Overview",
      );
      return {
        group,
        paths: overview ? [overview] : sorted,
      };
    });
}

function MockupGallery({ modules }: { modules: ModuleMap }) {
  const allPaths = getMockupPaths(modules);
  const sections = getGallerySections(allPaths);
  const galleryPaths = sections.flatMap((section) => section.paths);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <h1 className="text-xl font-semibold text-gray-900">
            Mockup gallery
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            All {allPaths.length} mockups on one page. Jump to a section or open
            an individual preview in a new tab.
          </p>
          <nav className="mt-4 flex flex-wrap gap-2">
            {galleryPaths.map((componentPath) => (
              <a
                key={componentPath}
                href={`#${sectionId(componentPath)}`}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                {formatSectionTitle(componentPath)}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-6 py-10">
        {sections.map(({ group, paths }) => (
          <div key={group} className="space-y-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
              {group}
            </h2>
            {paths.map((componentPath) => (
              <section
                key={componentPath}
                id={sectionId(componentPath)}
                className="scroll-mt-36 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {formatSectionTitle(componentPath)}
                    </h3>
                    <p className="text-xs text-gray-400">{componentPath}.tsx</p>
                  </div>
                  <a
                    href={getPreviewUrl(componentPath)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    Open solo preview ↗
                  </a>
                </div>
                <div className="bg-gray-50">
                  <PreviewRenderer
                    componentPath={componentPath}
                    modules={modules}
                  />
                </div>
              </section>
            ))}
          </div>
        ))}
      </main>
    </div>
  );
}

function getPreviewPath(): string | null {
  const basePath = getBasePath();
  const { pathname } = window.location;
  const local =
    basePath && pathname.startsWith(basePath)
      ? pathname.slice(basePath.length) || "/"
      : pathname;
  const match = local.match(/^\/preview\/(.+)$/);
  return match ? match[1] : null;
}

function App() {
  const previewPath = getPreviewPath();

  if (previewPath) {
    return (
      <PreviewRenderer
        componentPath={previewPath}
        modules={discoveredModules}
      />
    );
  }

  return <MockupGallery modules={discoveredModules} />;
}

export default App;
