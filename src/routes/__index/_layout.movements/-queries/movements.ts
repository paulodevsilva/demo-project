import { getMovementsServerFn } from "@/lib/movements.server";
import { queryOptions } from "@tanstack/react-query";

export const movementsQueryOptions = () =>
  queryOptions({
    queryKey: ["movements"],
    queryFn: () => getMovementsServerFn(),
    staleTime: 10 * 60 * 1000,
  });
