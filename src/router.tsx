import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Keep data around long enough to serve an offline session.
        gcTime: 1000 * 60 * 60 * 24 * 7,
        staleTime: 1000 * 30,
        // Serve the persisted cache immediately instead of pausing/hanging
        // while there is no connection.
        networkMode: "offlineFirst",
        retry: (count) =>
          typeof navigator !== "undefined" && !navigator.onLine ? false : count < 2,
        refetchOnWindowFocus: false,
      },
      mutations: { networkMode: "offlineFirst" },
    },
  });


  if (typeof window !== "undefined") {
    // Drop older cache versions: they may contain non-JSON-safe values
    // (Sets/Maps) that rehydrate as plain objects and crash pages.
    try {
      window.localStorage.removeItem("beacon-query-cache-v1");
    } catch {
      // ignore
    }
    void (async () => {
      try {
        const [{ persistQueryClient }, { createSyncStoragePersister }] = await Promise.all([
          import("@tanstack/react-query-persist-client"),
          import("@tanstack/query-sync-storage-persister"),
        ]);
        persistQueryClient({
          queryClient: queryClient as never,
          persister: createSyncStoragePersister({
            storage: window.localStorage,
            key: "beacon-query-cache-v2",
            throttleTime: 1000,
          }),
          maxAge: 1000 * 60 * 60 * 24 * 7,
        });
      } catch {
        // Persistence is a progressive enhancement; ignore failures.
      }
    })();
  }

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
